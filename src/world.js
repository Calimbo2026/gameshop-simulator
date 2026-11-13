/* =====================================================================
   MUNDO 3D — diorama low-poly del local, cámara y personajes.
   Toda la geometría se crea por código (sin modelos ni texturas externas).
   La distribución sale de GS.LAYOUT.
   ===================================================================== */
GS.World = (function () {
  const T = THREE, L = GS.LAYOUT, U = GS.util;
  let renderer, scene, camera, canvas, ok = false;
  let quality = 'media', reduceMotion = false;
  const people = [];
  const walls = {};            // grupos de pared alta: N (fondo), S (frente), E (derecha), O (izquierda)
  const animated = [];         // cosas que se animan (pantallas, cartel)
  let tapHandler = null, yo = null;

  /* ---------- Cámara tipo diorama ---------- */
  const cam = { tx: 0, tz: -0.4, dist: 100, gx: 0, gz: -0.4, gdist: 100, fit: 100, saved: null };
  const DEG = Math.PI / 180;
  let tilt = GS.CONFIG.camera.tilt * DEG, rot = GS.CONFIG.camera.rot * DEG;

  function fitDistance(radius) {
    const v = (GS.CONFIG.camera.fov * DEG) / 2;
    const h = Math.atan(Math.tan(v) * camera.aspect);
    return radius / Math.sin(Math.min(v, h));
  }
  function clampCam() {
    cam.gx = U.clamp(cam.gx, L.salon.xMin, L.salon.xMax);
    cam.gz = U.clamp(cam.gz, L.salon.zMin, L.galeria.zMax + 1);
    cam.gdist = U.clamp(cam.gdist, cam.fit * 0.3, cam.fit * 1.35);
  }
  function applyCam() {
    const ch = Math.cos(tilt), sh = Math.sin(tilt);
    camera.position.set(cam.tx + cam.dist * Math.sin(rot) * ch, 0.8 + cam.dist * sh, cam.tz + cam.dist * Math.cos(rot) * ch);
    camera.lookAt(cam.tx, 0.8, cam.tz);
    camera.near = Math.max(1, cam.dist * 0.2); camera.far = cam.dist * 3 + 100;
    camera.updateProjectionMatrix();
  }
  function updateWalls() {
    // Truco de casa de muñecas: se ocultan las paredes altas que quedan entre la cámara y el salón
    const cx = Math.sin(rot), cz = Math.cos(rot);
    if (walls.E) walls.E.visible = cx < 0.15;
    if (walls.O) walls.O.visible = cx > -0.15;
    if (walls.S) walls.S.visible = cz < 0.15;
    if (walls.N) walls.N.visible = cz > -0.15;
  }

  /* ---------- Ayudas de construcción ---------- */
  const matCache = {};
  function mat(color, opt) {
    const key = color + JSON.stringify(opt || {});
    if (!matCache[key]) matCache[key] = new T.MeshLambertMaterial(Object.assign({ color }, opt || {}));
    return matCache[key];
  }
  const unitBox = new T.BoxGeometry(1, 1, 1);
  // Caja apoyada sobre y (y = base, no centro)
  function box(parent, w, h, d, color, x, y, z, opt) {
    const m = new T.Mesh(unitBox, color && color.isMaterial ? color : mat(color, opt));
    m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); parent.add(m); return m;
  }
  // Lote de cajitas (productos) en un solo InstancedMesh por grupo: muy barato de dibujar
  function Batch(parent) {
    const items = [];
    return {
      add(w, h, d, color, x, y, z) { items.push([w, h, d, color, x, y + h / 2, z]); },
      build() {
        if (!items.length) return;
        const im = new T.InstancedMesh(unitBox, new T.MeshLambertMaterial({ color: 0xffffff }), items.length);
        const m4 = new T.Matrix4(), c = new T.Color();
        items.forEach((it, i) => {
          m4.makeScale(it[0], it[1], it[2]); m4.setPosition(it[4], it[5], it[6]);
          im.setMatrixAt(i, m4); im.setColorAt(i, c.setHex(it[3]));
        });
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        parent.add(im);
      }
    };
  }
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new T.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function textTex(text, o) {
    o = o || {};
    return canvasTex(o.w || 512, o.h || 128, (g, w, h) => {
      g.fillStyle = o.bg || '#000'; g.fillRect(0, 0, w, h);
      g.fillStyle = o.fg || '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = (o.font || '900 ' + Math.floor(h * 0.55) + 'px Impact, "Arial Black", sans-serif');
      g.fillText(text, w / 2, h / 2 + 2, w * 0.94);
    });
  }
  // Marca "GameShop" dibujada con el logo real (blanco + rojo sobre negro)
  const logoImg = new Image(); let logoReady = false; const logoWaiters = [];
  logoImg.onload = () => { logoReady = true; logoWaiters.forEach(f => f()); };
  logoImg.src = GS.LOGO;
  function logoTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); const t = new T.CanvasTexture(c); t.anisotropy = 4;
    const paint = () => { draw(g, w, h, logoImg); t.needsUpdate = true; };
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    if (logoReady) paint(); else logoWaiters.push(paint);
    return t;
  }
  function plane(parent, w, h, material, x, y, z, ry, rx) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), material);
    m.position.set(x, y, z); if (ry) m.rotation.y = ry; if (rx) m.rotation.x = rx; parent.add(m); return m;
  }

  // Productos del salón: los mismos dibujos del catálogo, parados sobre los muebles y mirando a la cámara
  const iconCache = {};
  function iconMats(id) {
    if (iconCache[id]) return iconCache[id];
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), t = new T.CanvasTexture(c), img = new Image();
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#d5d5dd'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
    img.onload = () => { g.drawImage(img, 14, 14, 100, 100); t.needsUpdate = true; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(GS.ICONS[id].replace('<svg ', '<svg width="128" height="128" '));
    const face = new T.MeshBasicMaterial({ map: t }), side = mat(0xf4f4f6);
    return (iconCache[id] = [face, side, side, side, face, side]);   // +x y +z: las dos caras que ve la cámara
  }
  // Caja de producto: mismo tamaño para todas, bien alineadas (como una góndola real)
  function sprite(parent, id, x, y, z, size) {
    const m = new T.Mesh(unitBox, iconMats(id)); m.scale.set(size * 0.74, size * 0.74, size * 0.74); m.position.set(x, y + size * 0.37, z); parent.add(m); return m;
  }
  const idsOf = cat => GS.CATALOG.filter(p => p.cat === cat).map(p => p.id);
  function sign(parent, text, w, h, x, y, z, ry) {
    return plane(parent, w, h, new T.MeshBasicMaterial({ map: textTex(text, { bg: '#e10600', fg: '#fff', w: 512, h: Math.round(512 * h / w) }) }), x, y, z, ry || 0);
  }
  const PRODUCT_COLORS = [0xffffff, 0xf2f2f2, 0x1a1a1a, 0xe10600, 0x16b8b0, 0x2d6cdf, 0x3bb54a, 0xf2f2f2, 0x222222, 0xff5fa2, 0xf5c518];
  const pc = () => U.pick(PRODUCT_COLORS);

  /* ---------- Muebles ---------- */
  function buildFloor(root) {
    const s = L.salon, zMax = L.galeria.zMax;
    const tile = canvasTex(128, 128, (g) => {
      g.fillStyle = '#e9e1d3'; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#bfb3a0'; g.lineWidth = 5; g.strokeRect(0, 0, 128, 128);
    });
    tile.wrapS = tile.wrapT = T.RepeatWrapping; tile.repeat.set(8, 12);
    const fw = s.xMax - s.xMin, fd = zMax - s.zMin;
    plane(root, fw, fd, new T.MeshLambertMaterial({ map: tile }), 0, 0, (s.zMin + zMax) / 2, 0, -Math.PI / 2);
    // base de maqueta + vereda
    box(root, fw + 1.2, 0.5, fd + 4.2, 0x18181b, 0, -0.52, (s.zMin + zMax) / 2 + 1.5);
    box(root, fw + 1.2, 0.04, 2.9, 0x8d8d92, 0, -0.03, zMax + 1.5);
    for (let i = -3; i <= 3; i++) box(root, 0.04, 0.045, 2.9, 0x77777c, i * 1.9, -0.03, zMax + 1.5);
  }

  // Pared con estantes llenos de productos, a lo largo de z (para izquierda y derecha)
  function shelfWall(group, x, dir, zA, zB) {
    const s = L.salon, b = Batch(group);
    box(group, 0.2, s.wallH, s.zMax - s.zMin, 0xf4f4f2, x + dir * -0.1, 0, (s.zMin + s.zMax) / 2);
    const depth = 0.42, sx = x + dir * (depth / 2);
    const palettes = [[0xffffff, 0xeeeeee, 0xe10600], [0x16b8b0, 0xffffff, 0x0f8f8a], [0x1a1a1a, 0x3bb54a, 0x222222], [0xffffff, 0x2d6cdf, 0xdddddd], [0xe10600, 0x1a1a1a, 0xffffff]];
    for (let lvl = 0; lvl < 4; lvl++) {
      const y = 0.55 + lvl * 0.62;
      box(group, depth, 0.05, zB - zA, 0xffffff, sx, y, (zA + zB) / 2);
      let z = zA + 0.2, sec = 0;
      while (z < zB - 0.2) {
        const pal = palettes[(Math.floor((z - zA) / 2.4) + lvl) % palettes.length];
        const w = 0.3, h = 0.34;                       // cajas parejas y alineadas
        b.add(depth * 0.7, h, w, pal[sec % pal.length], sx, y + 0.05, z + w / 2);
        z += w + 0.09; sec++;
      }
    }
    // columnas negras con gráfica, como en el local
    for (let z = zA + 2.4; z < zB - 1; z += 4.8) box(group, depth + 0.04, s.wallH - 0.2, 0.3, 0x111111, sx, 0, z);
    b.build();
  }

  function buildBackWall(root) {
    const s = L.salon, g = new T.Group(); root.add(g); walls.N = g;
    const b = Batch(g), z = s.zMin;
    box(g, s.xMax - s.xMin + 0.4, s.wallH, 0.2, 0xf4f4f2, 0, 0, z - 0.1);
    // panel ranurado gris
    box(g, 7.6, 2.3, 0.04, 0xdcdcdc, -2.0, 0.5, z + 0.02);
    // tres estantes de vidrio con LED celeste (consolas y juegos)
    const glow = new T.MeshBasicMaterial({ color: 0x57e6ff });
    for (let i = 0; i < 3; i++) {
      const y = 1.25 + i * 0.6;
      box(g, 7.2, 0.04, 0.42, glow, -2.0, y, z + 0.26);
      const ids = idsOf('consolas'); let k = i * 3;
      for (let x = -5.25; x < 1.5; x += 0.6) sprite(g, ids[k++ % ids.length], x, y + 0.04, z + 0.3, 0.54);
    }
    sign(g, 'CONSOLAS Y JUEGOS', 4.2, 0.36, -2.0, 3.0, z + 0.03);
    // mueble bajo blanco
    box(g, 7.2, 0.7, 0.5, 0xffffff, -2.0, 0, z + 0.3);
    // TV
    box(g, 1.3, 0.75, 0.08, 0x111111, -5.0, 2.35, z + 0.1);
    const tv = plane(g, 1.2, 0.66, new T.MeshBasicMaterial({ map: textTex('10% OFF EFECTIVO', { bg: '#e10600', fg: '#fff', w: 512, h: 256, font: '900 60px Impact, "Arial Black", sans-serif' }) }), -5.0, 2.72, z + 0.15);
    // puerta roja al depósito
    box(g, 0.14, 2.3, 0.14, 0xe10600, 2.75, 0, z + 0.06); box(g, 0.14, 2.3, 0.14, 0xe10600, 4.05, 0, z + 0.06);
    box(g, 1.44, 0.14, 0.14, 0xe10600, 3.4, 2.3, z + 0.06);
    box(g, 1.16, 2.3, 0.03, 0x2a1416, 3.4, 0, z + 0.03);
    plane(g, 1.2, 0.28, new T.MeshBasicMaterial({ map: textTex('DEPÓSITO', { bg: '#111', fg: '#fff', w: 256, h: 64 }) }), 3.4, 2.62, z + 0.03);
    // estantería a la derecha de la puerta
    for (let i = 0; i < 4; i++) {
      const y = 0.5 + i * 0.6; box(g, 1.5, 0.05, 0.4, 0xffffff, 5.1, y, z + 0.22);
      for (let x = 4.5; x < 5.7; x += 0.36) b.add(0.3, U.rnd(0.25, 0.4), 0.26, pc(), x, y + 0.05, z + 0.22);
    }
    b.build();
  }

  function buildCounter(root) {
    const m = L.mostrador, c = L.caja;
    // tramo largo (Mostrador): frente negro con el logo, tapa roja
    box(root, m.w, m.h, m.d, 0x0c0c0c, m.x, 0, m.z);
    box(root, m.w + 0.12, 0.08, m.d + 0.12, 0xe10600, m.x, m.h, m.z);
    const front = logoTex(1024, 180, (g, w, h, img) => {
      g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e10600'; g.beginPath(); g.moveTo(40, 0); g.lineTo(90, 0); g.lineTo(60, h); g.lineTo(10, h); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(110, 0); g.lineTo(150, 0); g.lineTo(120, h); g.lineTo(80, h); g.fill();
      g.fillStyle = '#e10600'; g.beginPath(); g.moveTo(w - 90, 0); g.lineTo(w - 40, 0); g.lineTo(w - 70, h); g.lineTo(w - 120, h); g.fill();
      const ih = h * 0.9, iw = ih * img.width / img.height; g.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    });
    plane(root, m.w, m.h, new T.MeshBasicMaterial({ map: front }), m.x, m.h / 2, m.z + m.d / 2 + 0.01);
    // tramo corto (Caja)
    box(root, c.w, c.h, c.d, 0x0c0c0c, c.x, 0, c.z);
    box(root, c.w + 0.12, 0.08, c.d + 0.12, 0xe10600, c.x, c.h, c.z);
    box(root, 0.06, c.h * 0.8, 0.5, 0xe10600, c.x + c.w / 2 + 0.01, 0.1, c.z + 0.6);
    box(root, 0.06, c.h * 0.8, 0.25, 0xffffff, c.x + c.w / 2 + 0.01, 0.1, c.z + 0.15);
    // cosas sobre el mostrador: monitores, caja registradora, frasco de caramelos, mate
    const top = m.h + 0.08;
    monitor(root, m.x - 1.9, top, m.z - 0.1, 0);
    monitor(root, m.x + 1.6, top, m.z - 0.1, 0);
    box(root, 0.5, 0.22, 0.4, 0x222222, c.x, top, c.z - 0.6); box(root, 0.36, 0.2, 0.06, 0x57e6ff, c.x - 0.05, top + 0.22, c.z - 0.6, { emissive: 0x1c8aa0 });
    box(root, 0.3, 0.06, 0.2, 0xffffff, c.x, top, c.z + 0.5);
    const jar = new T.Mesh(new T.SphereGeometry(0.14, 10, 8), mat(0xffd9ec, { transparent: true, opacity: 0.85 })); jar.position.set(m.x + 0.4, top + 0.14, m.z + 0.1); root.add(jar);
    const mate = new T.Mesh(new T.CylinderGeometry(0.07, 0.055, 0.14, 8), mat(0x6b3e1e)); mate.position.set(m.x - 0.6, top + 0.07, m.z + 0.12); root.add(mate);
    box(root, 0.015, 0.14, 0.015, 0xcccccc, m.x - 0.57, top + 0.1, m.z + 0.12);
  }
  function monitor(root, x, y, z, ry) {
    const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; root.add(g);
    box(g, 0.22, 0.03, 0.16, 0x1a1a1a, 0, 0, 0); box(g, 0.04, 0.2, 0.04, 0x1a1a1a, 0, 0, 0);
    box(g, 0.62, 0.4, 0.04, 0x111111, 0, 0.18, 0);
    return g;
  }
  function gamingChair(root, x, z, ry, color, accent) {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    const base = new T.Mesh(new T.CylinderGeometry(0.3, 0.34, 0.06, 5), mat(0x222222)); base.position.y = 0.05; g.add(base);
    box(g, 0.07, 0.36, 0.07, 0x333333, 0, 0.06, 0);
    box(g, 0.56, 0.14, 0.56, color, 0, 0.42, 0);
    const back = box(g, 0.54, 0.95, 0.12, color, 0, 0.5, -0.28); back.rotation.x = -0.14;
    box(g, 0.16, 0.9, 0.13, accent, 0, 0.52, -0.275).rotation.x = -0.14;
    box(g, 0.08, 0.06, 0.4, 0x222222, -0.32, 0.66, -0.02); box(g, 0.08, 0.06, 0.4, 0x222222, 0.32, 0.66, -0.02);
    return g;
  }
  /* Mejoras del local: cada mueble comprable vive en su propio grupo, que se muestra según el nivel comprado */
  const ups = {};
  function upGroup(root, id, lvl) { const g = new T.Group(); root.add(g); (ups[id] = ups[id] || {})[lvl] = g; return g; }
  function applyUpgrades(state) {
    for (const id in ups) for (const lvl in ups[id]) ups[id][lvl].visible = id === 'cartel' ? (state[id] || 0) === Number(lvl) : (state[id] || 0) >= Number(lvl);
  }
  function buildCenter(root) {
    { // isla Apple
      const g = upGroup(root, 'isla', 1), b = Batch(g), i = L.isla;
      box(g, i.w, i.h, i.d, 0xffffff, i.x, 0, i.z); box(g, i.w - 0.2, i.h - 0.3, 0.03, 0xe2e2e2, i.x, 0.2, i.z + i.d / 2 + 0.01);
      for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) b.add(0.2, 0.26, 0.05, pc(), i.x - 0.65 + k * 0.26, 0.3 + r * 0.36, i.z + i.d / 2 + 0.05);
      idsOf('apple').forEach((id, k) => sprite(g, id, i.x - 0.66 + k * 0.33, i.h, i.z + 0.1, 0.4));
      sign(g, 'APPLE', 1.3, 0.24, i.x, 0.14, i.z + i.d / 2 + 0.06); b.build();
    }
    { // mesa de madera con PC y accesorios
      const g = upGroup(root, 'mesa', 1), t = L.mesa, wood = 0xd9b77e;
      box(g, t.w, 0.09, t.d, wood, t.x, t.h - 0.09, t.z);
      box(g, t.w - 0.1, t.h - 0.09, 0.1, wood, t.x, 0, t.z - t.d / 2 + 0.05); box(g, t.w - 0.1, t.h - 0.09, 0.1, wood, t.x, 0, t.z + t.d / 2 - 0.05);
      box(g, 0.08, t.h - 0.09, t.d, 0xc9a56b, t.x - t.w / 2 + 0.3, 0, t.z);
      [[-1.1, 0x111111], [-0.2, 0xf4f4f4], [0.7, 0x111111]].forEach(a => box(g, 0.5, 0.62, 0.62, a[1], t.x + 0.35, 0, t.z + a[0]));
      notebook(g, t.x, t.h, t.z - 1.35); notebook(g, t.x, t.h, t.z - 0.75);
      ['gpu', 'monitor', 'ram', 'gabinete', 'disco', 'impresora', 'router', 'cargador'].forEach((id, k) => sprite(g, id, t.x + (k % 2 ? 0.32 : -0.32), t.h, t.z - 0.1 + Math.floor(k / 2) * 0.48, 0.5));
      sign(g, 'PC Y ACCESORIOS', 2.8, 0.34, t.x + t.w / 2 + 0.02, 0.42, t.z, Math.PI / 2);
    }
    { // escritorio gamer con monitor, teclado blanco y silla gris
      const g = upGroup(root, 'escritorio', 1), e = L.escritorio;
      box(g, e.w, 0.06, e.d, 0x151515, e.x, e.h - 0.06, e.z);
      box(g, 0.08, e.h - 0.06, e.d - 0.1, 0x151515, e.x - e.w / 2 + 0.08, 0, e.z); box(g, 0.08, e.h - 0.06, e.d - 0.1, 0x151515, e.x + e.w / 2 - 0.08, 0, e.z);
      const mon = monitor(g, e.x - 0.3, e.h, e.z, Math.PI / 2 - 0.25); mon.scale.set(1.5, 1.5, 1.5);
      const screen = plane(mon, 0.56, 0.34, new T.MeshBasicMaterial({ color: 0x7be07b }), 0, 0.38, 0.025); animated.push({ type: 'screen', mesh: screen });
      box(g, 0.16, 0.03, 0.44, 0xf5f5f5, e.x + 0.3, e.h, e.z); box(g, 0.4, 0.01, 0.74, 0x7b4fd1, e.x + 0.3, e.h - 0.005, e.z);
      box(g, 0.3, 0.5, 0.26, 0x15151a, e.x - 0.2, 0, e.z + 0.75); box(g, 0.02, 0.36, 0.2, 0x56d6ff, e.x - 0.04, 0.07, e.z + 0.75, { emissive: 0x2a8aa0 });
      gamingChair(g, e.x + 1.2, e.z, -Math.PI / 2, 0x8a8f98, 0xe10600);
    }
    { // sillas gamer contra la pared izquierda
      const g = upGroup(root, 'sillas', 1);
      gamingChair(g, -4.9, 2.2, Math.PI / 2, 0x151515, 0xe10600); gamingChair(g, -4.9, 3.6, Math.PI / 2 + 0.3, 0x151515, 0x2d6cdf);
    }
    { // góndola de periféricos del lado derecho
      const g = upGroup(root, 'gondola', 1), b = Batch(g), gd = L.gondola;
      box(g, gd.w, gd.h, gd.d, 0xffffff, gd.x, 0, gd.z);
      for (let lvl = 0; lvl < 2; lvl++) for (let z = gd.z - gd.d / 2 + 0.25; z < gd.z + gd.d / 2 - 0.2; z += 0.36)
        b.add(0.08, 0.3, 0.28, U.pick([0x16b8b0, 0xffffff, 0x1a1a1a, 0xe10600, 0x7b4fd1]), gd.x - gd.w / 2 - 0.05, 0.2 + lvl * 0.45, z);
      const ids = idsOf('perifericos'); let k = 0; for (let z = gd.z - gd.d / 2 + 0.3; z < gd.z + gd.d / 2 - 0.1; z += 0.5) sprite(g, ids[k++ % ids.length], gd.x, gd.h, z, 0.6);
      sign(g, 'PERIFÉRICOS GAMER', 3.4, 0.36, gd.x + gd.w / 2 + 0.02, 0.6, gd.z, Math.PI / 2); b.build();
    }
  }
  // Puestos de trabajo de la Etapa 2: service técnico, empaque de Mercado Libre y cajas para reponer
  function buildWorkStations(root) {
    const b = Batch(root), carton = 0xc49a6c;
    const sv = L.service;                       // banco de service: tapa verde, notebook abierta y herramientas
    box(root, sv.w, sv.h, sv.d, 0xffffff, sv.x, 0, sv.z); box(root, sv.w + 0.08, 0.06, sv.d + 0.08, 0x7ed321, sv.x, sv.h, sv.z);
    notebook(root, sv.x - 0.3, sv.h + 0.06, sv.z);
    box(root, 0.3, 0.05, 0.1, 0xe10600, sv.x + 0.45, sv.h + 0.06, sv.z + 0.1); box(root, 0.06, 0.04, 0.4, 0xf5c518, sv.x + 0.7, sv.h + 0.06, sv.z);
    const em = L.empaque;                       // mesa de empaque: cajas de cartón y cinta
    box(root, em.w, 0.07, em.d, 0xd9b77e, em.x, em.h - 0.07, em.z);
    box(root, 0.07, em.h - 0.07, 0.07, 0xb48a50, em.x - 0.28, 0, em.z - 0.85); box(root, 0.07, em.h - 0.07, 0.07, 0xb48a50, em.x - 0.28, 0, em.z + 0.85);
    box(root, 0.07, em.h - 0.07, 0.07, 0xb48a50, em.x + 0.28, 0, em.z - 0.85); box(root, 0.07, em.h - 0.07, 0.07, 0xb48a50, em.x + 0.28, 0, em.z + 0.85);
    b.add(0.42, 0.3, 0.42, carton, em.x, em.h, em.z - 0.55); b.add(0.3, 0.2, 0.3, carton, em.x, em.h, em.z + 0.05); b.add(0.5, 0.36, 0.5, carton, em.x, 0, em.z + 0.3);
    b.add(0.36, 0.28, 0.36, carton, em.x, 0.36, em.z + 0.3); b.add(0.02, 0.02, 0.34, 0xf5e663, em.x, em.h + 0.3, em.z - 0.55);
    const tape = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.06, 12), mat(0xb5894a)); tape.position.set(em.x - 0.1, em.h + 0.03, em.z + 0.6); root.add(tape);
    const rp = L.reposicion;                    // pila de cajas recién llegadas
    b.add(0.55, 0.4, 0.5, carton, rp.x, 0, rp.z); b.add(0.5, 0.36, 0.46, 0xb98d5e, rp.x + 0.05, 0.4, rp.z + 0.02); b.add(0.45, 0.34, 0.45, carton, rp.x + 0.6, 0, rp.z + 0.25);
    b.add(0.3, 0.24, 0.3, 0xb98d5e, rp.x - 0.02, 0.76, rp.z);
    b.build();
  }
  function notebook(root, x, y, z) {          // abierta, con la pantalla mirando a la cámara
    box(root, 0.36, 0.03, 0.5, 0x2a2a2e, x, y, z); box(root, 0.24, 0.005, 0.4, 0x1a1a1e, x + 0.03, y + 0.03, z);
    const lid = new T.Group(); lid.position.set(x - 0.18, y + 0.03, z); lid.rotation.z = 0.28; root.add(lid);
    box(lid, 0.03, 0.34, 0.5, 0x2a2a2e, 0, 0, 0); box(lid, 0.012, 0.28, 0.44, 0x56d6ff, 0.02, 0.03, 0, { emissive: 0x2a8aa0 });
  }

  // Vidriera tipo galería: dos cajas de vidrio a los costados de un pasillo, arcade en el medio
  let vk = 0;
  function buildGallery(root) {
    const s = L.salon, zA = s.zMax, zB = L.galeria.zMax, p = L.galeria.pasillo, b = Batch(root);
    const band = textTex('www.GameShop.com.ar', { bg: '#0a0a0a', fg: '#ffffff', w: 512, h: 64, font: '900 40px Impact, "Arial Black", sans-serif' });
    const glass = new T.MeshLambertMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.13, depthWrite: false });
    [-1, 1].forEach(side => {
      const x0 = side * p, x1 = side * s.xMax, cx = (x0 + x1) / 2, w = Math.abs(x1 - x0), cz = (zA + zB) / 2, d = zB - zA - 0.2;
      box(root, w, 0.5, d, 0x0c0c0c, cx, 0, cz);
      // banda con la web, del lado del pasillo y del lado de la calle
      plane(root, d, 0.42, new T.MeshBasicMaterial({ map: band }), x0 - side * 0.01, 0.25, cz, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      plane(root, w, 0.42, new T.MeshBasicMaterial({ map: band }), cx, 0.25, zB - 0.09);
      // gradas blancas con productos
      box(root, w - 1.0, 0.45, d - 0.4, 0xffffff, cx + side * 0.4, 0.5, cz);
      box(root, w - 2.4, 0.45, d - 0.4, 0xffffff, cx + side * 1.1, 0.95, cz);
      for (let z = zA + 0.5; z < zB - 0.4; z += 0.5) {
        const all = GS.CATALOG;
        sprite(root, all[vk++ % all.length].id, x0 + side * 0.8, 0.95, z, 0.46); sprite(root, all[vk++ % all.length].id, x0 + side * 1.6, 0.95, z, 0.46);
        sprite(root, all[vk++ % all.length].id, x0 + side * 2.9, 1.4, z, 0.46); sprite(root, all[vk++ % all.length].id, x0 + side * 3.7, 1.4, z, 0.46);
      }
      // vidrio
      const gl = new T.Mesh(unitBox, glass); gl.scale.set(w, 1.9, d); gl.position.set(cx, 0.5 + 0.95, cz); root.add(gl);
      // marco superior oscuro con marcas (sin logos: solo una banda)
      box(root, 0.08, 0.08, d, 0x2b2422, x0, 2.4, cz);
    });
    gamingChair(root, 4.9, zB - 1.0, -0.5, 0xffffff, 0xff8fc0).position.y = 0.5;
    // arcade genérico en el medio del pasillo
    const a = L.arcade, g = new T.Group(); g.position.set(a.x, 0, a.z); root.add(g); (ups.arcade = {})[1] = g;
    box(g, 0.75, 1.9, 0.7, 0x101014, 0, 0, 0);
    box(g, 0.77, 0.9, 0.04, 0x1d3fb3, 0, 0.05, 0.36);
    box(g, 0.6, 0.45, 0.04, 0x0a0a0a, 0, 1.1, 0.36); const as = box(g, 0.5, 0.36, 0.02, 0x7be07b, 0, 1.14, 0.385, { emissive: 0x2a8a3a });
    box(g, 0.75, 0.1, 0.3, 0x2a2a30, 0, 0.92, 0.45);
    plane(g, 0.72, 0.22, new T.MeshBasicMaterial({ map: textTex('ARCADE', { bg: '#e10600', fg: '#fff', w: 256, h: 64 }) }), 0, 1.74, 0.36);
    // puertas de vidrio hacia el salón
    [-1, 1].forEach(sd => { const dg = new T.Mesh(unitBox, glass); dg.scale.set(p - 0.1, 2.2, 0.05); dg.position.set(sd * p / 2, 1.1, zA); root.add(dg); box(root, 0.05, 0.5, 0.08, 0xc8c8c8, sd * 0.18, 0.9, zA + 0.06); });
    b.build();
  }

  // Cartel del frente en tres niveles: pintado (inicial), luminoso y pantalla LED
  function buildSign(root) {
    const s = L.salon, z = L.galeria.zMax + 0.15, W2 = s.xMax - s.xMin;
    box(root, 0.3, 4.3, 0.3, 0x0c0c0c, s.xMin - 0.1, 0, z); box(root, 0.3, 4.3, 0.3, 0x0c0c0c, s.xMax + 0.1, 0, z);
    box(root, W2 + 0.5, 0.25, 0.3, 0x0c0c0c, 0, 2.8, z);
    const logoMat = (bg, h) => new T.MeshBasicMaterial({ map: logoTex(1024, 128, (g, w, hh, img) => { g.fillStyle = bg; g.fillRect(0, 0, w, hh); const ih = hh * h, iw = ih * img.width / img.height; g.drawImage(img, (w - iw) / 2, (hh - ih) / 2, iw, ih); }) });
    { // nivel 0: chapa pintada, chica y sin luz
      const g = upGroup(root, 'cartel', 0), m = new T.MeshLambertMaterial({ map: textTex('GameShop', { bg: '#e9e4d8', fg: '#222', w: 512, h: 128 }) });
      box(g, 5.2, 0.9, 0.12, 0xcfc8b8, 0, 3.05, z); plane(g, 5.0, 0.8, m, 0, 3.5, z + 0.07); plane(g, 5.0, 0.8, m, 0, 3.5, z - 0.07, Math.PI);
    }
    { // nivel 1: cartel luminoso con el logo
      const g = upGroup(root, 'cartel', 1), m = logoMat('#000', 0.9);
      box(g, 8.6, 1.2, 0.3, 0x0c0c0c, 0, 3.05, z); plane(g, 8.4, 1.05, m, 0, 3.65, z + 0.16); plane(g, 8.4, 1.05, m, 0, 3.65, z - 0.16, Math.PI);
      box(g, 8.8, 0.06, 0.34, 0xff3b30, 0, 4.25, z, { emissive: 0xaa1100 });
    }
    { // nivel 2: pantalla LED que alterna mensajes
      const g = upGroup(root, 'cartel', 2);
      box(g, W2 + 0.5, 1.5, 0.3, 0x0c0c0c, 0, 2.8, z);
      const texs = L.cartel.textos.map((txt, i) => logoTex(1024, 128, (c, w, h, img) => {
        c.fillStyle = '#050505'; c.fillRect(0, 0, w, h);
        if (i === 0) { const ih = h * 0.62, iw = ih * img.width / img.height; c.drawImage(img, (w - iw) / 2, 4, iw, ih); }
        c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = i === 0 ? '900 30px Impact, "Arial Black", sans-serif' : '900 70px Impact, "Arial Black", sans-serif';
        c.fillText(txt, w / 2, i === 0 ? h - 22 : h / 2 + 4, w * 0.92);
        c.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
      }));
      const m = new T.MeshBasicMaterial({ map: texs[0] });
      plane(g, W2 + 0.3, 1.4, m, 0, 3.5, z + 0.16); plane(g, W2 + 0.3, 1.4, m, 0, 3.5, z - 0.16, Math.PI);
      box(g, W2 + 0.5, 0.06, 0.3, 0x1a1a1a, 0, 4.3, z); animated.push({ type: 'sign', mat: m, texs, t: 0, i: 0 });
    }
    const sw = new T.Group(); sw.position.set(-4.2, 0, z + 1.6); sw.rotation.y = 0.5; root.add(sw);
    box(sw, 1.0, 0.75, 0.05, 0x0c0c0c, 0, 0.2, 0); plane(sw, 0.94, 0.3, logoMat('#000', 0.95), 0, 0.62, 0.03);
  }

  /* ---------- Personajes low-poly (cabezones) ---------- */
  const SKINS = [0xf2c9a0, 0xe0ac7e, 0xc68a5c, 0x9a643c, 0xf6d7bd];
  const gBody = new T.CylinderGeometry(0.2, 0.3, 0.8, 8), gHead = new T.SphereGeometry(0.33, 12, 10),
        gHair = new T.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), gEye = new T.SphereGeometry(0.04, 6, 6),
        gShadow = new T.CircleGeometry(0.36, 16);
  const shadowMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false });
  const gCone = new T.CylinderGeometry(0.15, 0.34, 0.86, 12), gBun = new T.SphereGeometry(0.15, 8, 8), gCurl = new T.SphereGeometry(0.13, 7, 6),
        gBeard = new T.SphereGeometry(0.345, 12, 8, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48);
  function makePerson(o) {
    o = o || {};
    const g = new T.Group(), base = o.scale || 1; g.scale.setScalar(base); g.userData.base = base;
    const body = new T.Mesh(gCone, mat(o.shirt || 0x4a6fb5)); body.position.y = 0.45; g.add(body);
    const head = new T.Mesh(gHead, mat(SKINS[0])); head.position.y = 1.14; g.add(head);
    [-0.12, 0.12].forEach(x => { const e = new T.Mesh(gEye, mat(0x111111)); e.position.set(x, 1.14, 0.3); g.add(e); });
    const sh = new T.Mesh(gShadow, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; g.add(sh);
    const bag = box(g, 0.26, 0.3, 0.12, 0xe10600, 0.3, 0.3, 0.1); bag.visible = false;
    if (o.phone) box(g, 0.1, 0.18, 0.03, 0x111111, 0.12, 0.72, 0.26);
    let cargo = null;
    if (o.cart) {
      box(g, 0.62, 0.06, 0.8, 0x3a6fd1, 0, 0.16, 0.85); box(g, 0.05, 0.9, 0.05, 0x3a6fd1, -0.26, 0.16, 0.48); box(g, 0.05, 0.9, 0.05, 0x3a6fd1, 0.26, 0.16, 0.48);
      box(g, 0.58, 0.05, 0.05, 0x3a6fd1, 0, 1.02, 0.48);
      [-0.3, 0.3].forEach(x => { const w = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.06, 10), mat(0x111111)); w.rotation.z = Math.PI / 2; w.position.set(x, 0.12, 1.05); g.add(w); });
      cargo = new T.Group(); g.add(cargo);
      box(cargo, 0.5, 0.36, 0.5, 0xc49a6c, 0, 0.22, 0.9); box(cargo, 0.44, 0.3, 0.44, 0xb98d5e, 0.02, 0.58, 0.9); box(cargo, 0.3, 0.22, 0.3, 0xc49a6c, -0.04, 0.88, 0.9);
    }
    // Estilo libre: cualquier combinación de peinado y accesorios (sin distinguir géneros)
    let acc = null;
    function style(a) {
      if (acc) g.remove(acc); acc = new T.Group(); acc.position.y = 1.14; g.add(acc);
      head.material = mat(a.skin || SKINS[1]); const hm = mat(a.hair || 0x3a2a1a), st = a.hairStyle || 'corto';
      const cap = () => { const m = new T.Mesh(gHair, hm); m.position.y = 0.02; m.rotation.x = -0.25; acc.add(m); };
      if (st === 'corto' || st === 'largo' || st === 'rodete') cap();
      if (st === 'largo') { box(acc, 0.62, 0.52, 0.2, hm, 0, -0.44, -0.24); box(acc, 0.1, 0.4, 0.3, hm, -0.31, -0.36, -0.06); box(acc, 0.1, 0.4, 0.3, hm, 0.31, -0.36, -0.06); }
      if (st === 'rodete') { const b = new T.Mesh(gBun, hm); b.position.set(0, 0.42, -0.1); acc.add(b); }
      if (st === 'rulos') [[0, 0.3, 0], [0.2, 0.24, 0.02], [-0.2, 0.24, 0.02], [0, 0.24, -0.2], [0.16, 0.2, 0.18], [-0.16, 0.2, 0.18], [0.24, 0.1, -0.16], [-0.24, 0.1, -0.16], [0, 0.26, 0.2]].forEach(q => { const c = new T.Mesh(gCurl, hm); c.position.set(q[0], q[1], q[2]); acc.add(c); });
      if (st === 'mohicano') { box(acc, 0.1, 0.26, 0.62, hm, 0, 0.22, -0.03); box(acc, 0.1, 0.14, 0.3, hm, 0, 0.44, -0.03); }
      if (a.beard) { const m = new T.Mesh(gBeard, hm); m.rotation.x = 0.4; m.position.z = 0.03; acc.add(m); }
      if (a.glasses) { box(acc, 0.16, 0.12, 0.03, 0x111111, -0.12, -0.07, 0.3); box(acc, 0.16, 0.12, 0.03, 0x111111, 0.12, -0.07, 0.3); box(acc, 0.1, 0.03, 0.03, 0x111111, 0, -0.01, 0.3); }
      if (a.lips) box(acc, 0.14, 0.05, 0.05, 0xd81e5b, 0, -0.19, 0.28);
    }
    style(o);
    scene.add(g);
    const p = {
      group: g, path: [], speed: o.speed || 2.9, t: Math.random() * 6, onArrive: null, moving: false,
      setPos(x, z) { g.position.set(x, 0, z); },
      face(ry) { g.rotation.y = ry; },
      walk(points, cb) { p.path = points.slice(); p.onArrive = cb || null; p.moving = true; },
      bag(v) { bag.visible = v; },
      look(a) { style(a); },
      cargo(v) { if (cargo) cargo.visible = v; },
      remove() { scene.remove(g); const i = people.indexOf(p); if (i >= 0) people.splice(i, 1); }
    };
    people.push(p); return p;
  }
  function updatePeople(dt) {
    for (const p of people) {
      p.t += dt;
      const g = p.group;
      if (p.moving && p.path.length) {
        const tx = p.path[0][0], tz = p.path[0][1], dx = tx - g.position.x, dz = tz - g.position.z, d = Math.hypot(dx, dz), step = p.speed * dt;
        if (d <= step) {
          g.position.x = tx; g.position.z = tz; p.path.shift();
          if (!p.path.length) { p.moving = false; g.position.y = 0; const cb = p.onArrive; p.onArrive = null; if (cb) cb(); }
        } else {
          g.position.x += dx / d * step; g.position.z += dz / d * step;
          g.rotation.y = Math.atan2(dx, dz);
          g.position.y = reduceMotion ? 0 : Math.abs(Math.sin(p.t * 11)) * 0.07;
        }
      } else if (!reduceMotion) {
        g.scale.y = (g.userData.base || 1) * (1 + Math.sin(p.t * 2.2) * 0.015);   // respiración
      }
    }
  }

  /* ---------- Entrada: arrastre, pellizco, rueda y toque ---------- */
  function setupInput() {
    const pts = new Map(); let moved = 0, pinch = 0, downT = 0;
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; downT = performance.now();
      if (pts.size === 2) { const a = [...pts.values()]; pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
    });
    canvas.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) {
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 8) {
          const wpp = 2 * cam.dist * Math.tan(GS.CONFIG.camera.fov * DEG / 2) / canvas.clientHeight;
          const rx = Math.cos(rot), rz = -Math.sin(rot), fx = -Math.sin(rot), fz = -Math.cos(rot);
          cam.gx += -rx * dx * wpp + fx * dy * wpp / Math.sin(tilt);
          cam.gz += -rz * dx * wpp + fz * dy * wpp / Math.sin(tilt);
          clampCam(); cam.tx = cam.gx; cam.tz = cam.gz;
        }
      } else if (pts.size === 2) {
        const a = [...pts.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (pinch > 0 && d > 0) { cam.gdist *= pinch / d; clampCam(); }
        pinch = d; moved = 99;
      }
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return;
      const wasTap = pts.size === 1 && moved <= 8 && performance.now() - downT < 500;
      pts.delete(e.pointerId); pinch = 0;
      if (wasTap) handleTap(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = 0; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); cam.gdist *= e.deltaY > 0 ? 1.1 : 0.9; clampCam(); }, { passive: false });
  }
  const ray = new T.Raycaster(), v2 = new T.Vector2(), v3 = new T.Vector3(), planeY = new T.Plane(new T.Vector3(0, 1, 0), -1.0);
  function handleTap(cx, cy) {
    if (!tapHandler) return;
    const r = canvas.getBoundingClientRect();
    v2.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v2, camera);
    if (!ray.ray.intersectPlane(planeY, v3)) return;
    const m = L.mostrador, c = L.caja, pad = 0.9;
    if (Math.abs(v3.x - c.x) < c.w / 2 + pad && Math.abs(v3.z - c.z) < c.d / 2 + pad * 0.6) return tapHandler('caja');
    if (Math.abs(v3.x - m.x) < m.w / 2 + pad * 0.5 && Math.abs(v3.z - m.z) < m.d / 2 + pad && v3.x > -2.6) return tapHandler('mostrador');
    let best = null, bd = 1.7;
    for (const st of GS.STATIONS) { if (st.soon) continue; const d = Math.hypot(v3.x - st.pos[0], v3.z - st.pos[1]); if (d < bd) { bd = d; best = st.id; } }
    if (best) tapHandler(best);
  }

  /* ---------- API ---------- */
  function init(cv) {
    canvas = cv;
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: quality !== 'baja', alpha: true, powerPreference: 'high-performance' });
    } catch (e) { return false; }
    reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(GS.CONFIG.camera.fov, 1, 1, 1000);
    scene.add(new T.HemisphereLight(0xffffff, 0x8f8a86, 0.66));
    const sun = new T.DirectionalLight(0xffffff, 0.36); sun.position.set(9, 12, 5); scene.add(sun);

    const root = new T.Group(); scene.add(root);
    buildFloor(root); buildBackWall(root);
    walls.O = new T.Group(); root.add(walls.O); shelfWall(walls.O, L.salon.xMin, 1, L.salon.zMin + 0.4, L.salon.zMax - 0.3);
    walls.E = new T.Group(); root.add(walls.E); shelfWall(walls.E, L.salon.xMax, -1, L.salon.zMin + 0.4, L.salon.zMax - 0.3);
    // zócalos bajos donde la pared está "cortada"
    box(root, 0.2, 0.3, L.salon.zMax - L.salon.zMin, 0xdedede, L.salon.xMax + 0.1, 0, (L.salon.zMin + L.salon.zMax) / 2);
    buildCounter(root); buildCenter(root); buildWorkStations(root); buildGallery(root); buildSign(root);

    // empleados (inventados): vos en el mostrador y Brian, pegado al celular, en la caja
    yo = makePerson({ shirt: 0xe10600, hair: 0x2b2b3a, skin: SKINS[1] }); yo.setPos(L.mostrador.x, L.mostrador.z - 0.9);
    const brian = makePerson({ shirt: 0xe10600, hair: 0x2d6cdf, skin: SKINS[0], phone: true }); brian.setPos(L.caja.x + 1.0, L.caja.z + 0.2); brian.face(-Math.PI / 2);

    setupInput(); resize(true); updateWalls(); ok = true; return true;
  }
  function resize(reset) {
    if (!renderer) return;
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    const cap = quality === 'alta' ? 2 : quality === 'media' ? 1.5 : 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const old = cam.fit; cam.fit = fitDistance(9.1);
    if (reset || !old) { cam.dist = cam.gdist = cam.fit; } else { cam.gdist *= cam.fit / old; cam.dist = cam.gdist; }
    clampCam(); applyCam();
  }
  function update(dt) {
    if (!ok) return;
    const k = reduceMotion ? 1 : 1 - Math.pow(0.002, dt);
    cam.tx += (cam.gx - cam.tx) * k; cam.tz += (cam.gz - cam.tz) * k; cam.dist += (cam.gdist - cam.dist) * k;
    applyCam(); updatePeople(dt);
    for (const a of animated) {
      if (a.type === 'sign') { a.t += dt; if (a.t > 4) { a.t = 0; a.i = (a.i + 1) % a.texs.length; a.mat.map = a.texs[a.i]; a.mat.needsUpdate = true; } }
      else if (a.type === 'screen' && !reduceMotion) { a.t = (a.t || 0) + dt; a.mesh.material.color.setHSL((a.t * 0.05) % 1, 0.6, 0.6); }
    }
  }
  const pv = new T.Vector3();
  return {
    init, resize, update,
    render() { if (ok) renderer.render(scene, camera); },
    setQuality(q) { quality = q; if (ok) resize(); },
    setReduceMotion(v) { reduceMotion = v; },
    makePerson,
    setUpgrades: applyUpgrades,
    setPlayerLook(a) { if (yo && a) yo.look(a); },
    // Zoom a un punto del local (para la tienda de mejoras)
    focusAt(x, z, factor, biasY) {
      const d = cam.fit * (factor || 0.45), by = (biasY || 0) * 2 * d * Math.tan(GS.CONFIG.camera.fov * DEG / 2) / Math.sin(tilt);
      cam.saved = null; cam.gdist = d; cam.gx = x + Math.sin(rot) * by; cam.gz = z + Math.cos(rot) * by;
    },
    // Pila de cajas que deja el repartidor
    dropBoxes(x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      box(g, 0.5, 0.36, 0.5, 0xc49a6c, 0, 0, 0); box(g, 0.44, 0.3, 0.44, 0xb98d5e, 0.03, 0.36, 0); box(g, 0.3, 0.22, 0.3, 0xc49a6c, -0.03, 0.66, 0); box(g, 0.4, 0.3, 0.4, 0xb98d5e, 0.55, 0, 0.1);
      return { remove() { scene.remove(g); } };
    },
    onTap(fn) { tapHandler = fn; },
    // Posición en pantalla de un punto del mundo (para barras y globos en HTML)
    project(x, y, z) {
      pv.set(x, y, z).project(camera);
      return { x: (pv.x * 0.5 + 0.5) * canvas.clientWidth, y: (-pv.y * 0.5 + 0.5) * canvas.clientHeight, ok: pv.z < 1 };
    },
    // Acercar la cámara a una estación; null = volver a la vista anterior
    // biasY / biasX: fracción de pantalla que se corre la estación (para que no la tape el panel)
    focus(station, biasY, biasX) {
      if (station) {
        if (!cam.saved) cam.saved = { x: cam.gx, z: cam.gz, d: cam.gdist };
        const stn = GS.STATIONS.find(a => a.id === station), s = { x: stn.pos[0], z: stn.pos[1] }, d = Math.min(cam.fit * 0.62, fitDistance(5.2)), hw = 2 * d * Math.tan(GS.CONFIG.camera.fov * DEG / 2);
        const by = (biasY || 0) * hw / Math.sin(tilt), bx = (biasX || 0) * hw * camera.aspect;
        cam.gdist = d;
        cam.gx = s.x + Math.sin(rot) * by + Math.cos(rot) * bx;
        cam.gz = s.z + Math.cos(rot) * by - Math.sin(rot) * bx;
        cam.gx = U.clamp(cam.gx, L.salon.xMin - 6, L.salon.xMax + 6); cam.gz = U.clamp(cam.gz, L.salon.zMin - 4, L.galeria.zMax + 4);
        return;
      } else if (cam.saved) { cam.gx = cam.saved.x; cam.gz = cam.saved.z; cam.gdist = cam.saved.d; cam.saved = null; }
      clampCam();
    },
    home() { cam.saved = null; cam.gx = 0; cam.gz = 0.2; cam.gdist = cam.fit; },
    showAll() { cam.saved = null; cam.gx = 0; cam.gz = 2.4; cam.gdist = cam.fit * 1.28; }
  };
})();
