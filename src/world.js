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
  const sky = {};
  let tapHandler = null, yo = null, boss = null, brian = null, lucho = null;
  const BOSS_HOME = [9.3, 0.7];

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
    cam.gx = U.clamp(cam.gx, L.salon.xMin, 11);
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
  // Cada producto tiene su caja de color (como un packaging real) con el dibujo grande en una ventana clara
  const PACK = { consolas: ['#0b4fa8', '#c8102e', '#107c10', '#2b2b33', '#e8a400', '#6a2fb5'], apple: ['#aeb7c6', '#8f9bb0', '#c9b9a6'], pc: ['#16181d', '#e86a00', '#0e6cc4', '#3c4250'], perifericos: ['#141416', '#c40000', '#0f9a93', '#6a3fc0', '#d9d9de'] };
  function iconMats(id) {
    if (iconCache[id]) return iconCache[id];
    const prod = GS.CATALOG.find(q => q.id === id), pal = PACK[prod.cat], col = pal[GS.CATALOG.indexOf(prod) % pal.length];
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), t = new T.CanvasTexture(c), img = new Image();
    const paint = () => {
      g.fillStyle = col; g.fillRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(255,255,255,.93)'; g.beginPath(); g.moveTo(26, 12); g.arcTo(116, 12, 116, 104, 16); g.arcTo(116, 104, 12, 104, 16); g.arcTo(12, 104, 12, 12, 16); g.arcTo(12, 12, 116, 12, 16); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(34, 112, 60, 6);          // rayita tipo marca en la base
    };
    paint(); img.onload = () => { paint(); g.drawImage(img, 14, 8, 100, 100); t.needsUpdate = true; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(GS.ICONS[id].replace('<svg ', '<svg width="128" height="128" '));
    const face = new T.MeshBasicMaterial({ map: t }), side = new T.MeshLambertMaterial({ color: col });
    return (iconCache[id] = [face, side, side, side, face, side]);   // +x y +z: las dos caras que ve la cámara
  }
  // Caja de producto: mismo tamaño para todas, bien alineadas (como una góndola real)
  function sprite(parent, id, x, y, z, size) {
    const m = new T.Mesh(unitBox, iconMats(id)); m.scale.set(size * 0.86, size * 0.86, size * 0.86); m.position.set(x, y + size * 0.43, z); parent.add(m); return m;
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
    sky.side = new T.MeshLambertMaterial({ color: 0x8d8d92 }); sky.joint = new T.MeshLambertMaterial({ color: 0x77777c });
    box(root, fw + 1.2, 0.04, 2.9, sky.side, 0, -0.03, zMax + 1.5);
    for (let i = -3; i <= 3; i++) box(root, 0.04, 0.045, 2.9, sky.joint, i * 1.9, -0.03, zMax + 1.5);
    box(root, fw + 1.2, 0.06, 0.1, 0xd9d9de, 0, -0.03, zMax + 2.98); box(root, fw + 1.2, 0.03, 0.56, 0x26262c, 0, -0.06, zMax + 3.3);          // cordón y un pedacito de calle
    // luz del local que sale a la vereda y dos faroles en las esquinas: se prenden cuando cae la tarde
    sky.spill = new T.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, depthWrite: false }); plane(root, fw - 0.6, 1.5, sky.spill, 0, 0.022, zMax + 0.85, 0, -Math.PI / 2);
    sky.bulb = new T.MeshBasicMaterial({ color: 0x55555c }); sky.halo = new T.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, depthWrite: false });
    [-1, 1].forEach(sd => { const x = sd * (fw / 2 + 0.25), z = zMax + 2.65;
      box(root, 0.09, 3.1, 0.09, 0x1c1c20, x, 0, z); box(root, 0.7, 0.07, 0.07, 0x1c1c20, x - sd * 0.3, 3.1, z); box(root, 0.34, 0.1, 0.2, sky.bulb, x - sd * 0.6, 3.0, z);
      const h = new T.Mesh(new T.CircleGeometry(1.7, 24), sky.halo); h.rotation.x = -Math.PI / 2; h.position.set(x - sd * 0.9, 0.024, z - 0.5); root.add(h); });
  }

  // Pared con estantes llenos de productos, a lo largo de z (para izquierda y derecha)
  const WALL_IDS = ['teclado', 'router', 'mouse', 'disco', 'auris', 'tinta', 'webcam', 'pendrive', 'parlante', 'cargador', 'mousepad', 'cable', 'mic', 'ram', 'streamdeck'];
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
        if (lvl < 3 && dir > 0) sprite(group, WALL_IDS[(sec + lvl * 5) % WALL_IDS.length], sx + 0.02, y + 0.05, z + 0.25, 0.5);   // cajas de producto (solo la pared que se ve)
        z += 0.6; sec++;
      }
    }
    // columnas negras con gráfica, como en el local
    for (let z = zA + 2.4; z < zB - 1; z += 4.8) box(group, depth + 0.04, s.wallH - 0.2, 0.3, 0x111111, sx, 0, z);
    b.build();
  }

  function buildBackWall(root) {
    const s = L.salon, g = new T.Group(); root.add(g); walls.N = g;
    const z = s.zMin, W2 = s.xMax - s.xMin;
    box(g, W2 + 0.4, s.wallH, 0.2, 0xf4f4f2, 0, 0, z - 0.1);
    box(g, W2 - 0.3, 2.3, 0.04, 0xdcdcdc, 0, 0.5, z + 0.02);                       // panel ranurado gris, de punta a punta
    // tres estantes de vidrio con LED celeste a todo lo ancho (consolas y juegos, y a la derecha lo demás)
    const glow = new T.MeshBasicMaterial({ color: 0x57e6ff }), ids = idsOf('consolas');
    for (let i = 0; i < 3; i++) {
      const y = 1.25 + i * 0.6; let k = i * 3;
      box(g, W2 - 0.6, 0.04, 0.42, glow, 0, y, z + 0.26);
      for (let x = -5.4; x < 5.6; x += 0.6) { if (i === 2 && x < -4.3) { k++; continue; } sprite(g, x < 2.3 ? ids[k++ % ids.length] : WALL_IDS[(k++ + i * 4) % WALL_IDS.length], x, y + 0.04, z + 0.3, 0.54); }
    }
    sign(g, 'CONSOLAS Y JUEGOS', 4.2, 0.36, 0, 3.0, z + 0.03);
    box(g, W2 - 0.6, 0.7, 0.5, 0xffffff, 0, 0, z + 0.3);                           // mueble bajo blanco
    box(g, 1.3, 0.75, 0.08, 0x111111, -5.0, 2.4, z + 0.3);                          // TV
    plane(g, 1.2, 0.66, new T.MeshBasicMaterial({ map: textTex('10% OFF EFECTIVO', { bg: '#e10600', fg: '#fff', w: 512, h: 256, font: '900 60px Impact, "Arial Black", sans-serif' }) }), -5.0, 2.775, z + 0.35);
  }

  function buildCounter(root) {
    const m = L.mostrador, c = L.caja, xa = m.x - m.w / 2, xb = c.x + c.w / 2;
    // un solo mostrador recto: frente negro con el logo, tapa roja y, a la derecha, el tramo de la CAJA
    box(root, m.w, m.h, m.d, 0x0c0c0c, m.x, 0, m.z); box(root, c.w, c.h, c.d, 0x0c0c0c, c.x, 0, c.z);
    box(root, xb - xa + 0.12, 0.08, m.d + 0.12, 0xe10600, (xa + xb) / 2, m.h, m.z);
    const front = logoTex(1024, 180, (g, w, h, img) => {
      g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e10600'; g.beginPath(); g.moveTo(40, 0); g.lineTo(90, 0); g.lineTo(60, h); g.lineTo(10, h); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(110, 0); g.lineTo(150, 0); g.lineTo(120, h); g.lineTo(80, h); g.fill();
      g.fillStyle = '#e10600'; g.beginPath(); g.moveTo(w - 90, 0); g.lineTo(w - 40, 0); g.lineTo(w - 70, h); g.lineTo(w - 120, h); g.fill();
      const ih = h * 0.9, iw = ih * img.width / img.height; g.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    });
    plane(root, m.w, m.h, new T.MeshBasicMaterial({ map: front }), m.x, m.h / 2, m.z + m.d / 2 + 0.01);
    const cajaTex = canvasTex(512, 270, (g, w, h) => { g.fillStyle = '#e10600'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(18, 18, w - 36, h - 36);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 150px Impact, "Arial Black", sans-serif'; g.fillText('CAJA', w / 2, h / 2 + 8); });
    plane(root, c.w, c.h, new T.MeshBasicMaterial({ map: cajaTex }), c.x, c.h / 2, c.z + c.d / 2 + 0.01);
    // cosas sobre el mostrador: monitores, caja registradora, posnet, frasco de caramelos, mate
    const top = m.h + 0.08;
    monitor(root, m.x - 1.9, top, m.z - 0.1, 0); monitor(root, m.x + 1.6, top, m.z - 0.1, 0);
    box(root, 0.5, 0.22, 0.4, 0x222222, c.x - 0.3, top, c.z - 0.1); box(root, 0.36, 0.2, 0.06, 0x57e6ff, c.x - 0.3, top + 0.22, c.z - 0.15, { emissive: 0x1c8aa0 });
    box(root, 0.16, 0.06, 0.26, 0xffffff, c.x - 0.75, top, c.z + 0.12);
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
  const glowMat = c => new T.MeshBasicMaterial({ color: c });
  const gPot = new T.CylinderGeometry(0.17, 0.12, 0.3, 8), gLeaf = new T.SphereGeometry(0.2, 8, 6);
  function plant(parent, x, z, k) {
    const g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(k || 1); parent.add(g);
    const pot = new T.Mesh(gPot, mat(0xf4f4f2)); pot.position.y = 0.15; g.add(pot);
    box(g, 0.03, 0.4, 0.03, 0x3d6b33, 0, 0.3, 0);
    [[0, 0.78, 0, 1.15], [-0.17, 0.6, 0.05, 0.9], [0.16, 0.62, -0.04, 0.95], [0.02, 0.56, 0.16, 0.8]].forEach(q => { const m = new T.Mesh(gLeaf, mat(q[3] > 1 ? 0x3bb54a : 0x2f9a41)); m.scale.setScalar(q[3]); m.position.set(q[0], q[1], q[2]); g.add(m); });
    return g;
  }
  // Mejoras nuevas de la Etapa 4: plantas, cafetera, luces LED, vidriera iluminada y segunda caja
  function buildExtras(root) {
    const s = L.salon, m = L.mostrador, c = L.caja, top = m.h + 0.08;
    { const g = upGroup(root, 'plantas', 1);
      plant(g, -5.0, 5.4, 1.15); plant(g, -2.7, 5.55, 0.9); plant(g, 5.3, 5.65, 1.05); plant(g, -5.1, -1.6, 0.85);
      box(g, 1.9, 0.02, 1.1, 0xc40000, L.puerta.x, 0.005, 5.2); box(g, 1.6, 0.022, 0.08, 0xffffff, L.puerta.x, 0.006, 4.85); box(g, 1.6, 0.022, 0.08, 0xffffff, L.puerta.x, 0.006, 5.55); }
    { const g = upGroup(root, 'cafetera', 1), x = 0.3, y = 0.7, z = s.zMin + 0.3;
      box(g, 0.44, 0.46, 0.34, 0x1a1a1e, x, y, z); box(g, 0.46, 0.06, 0.36, 0xe10600, x, y + 0.46, z); box(g, 0.2, 0.12, 0.02, 0xc9ccd1, x, y + 0.28, z + 0.18);
      box(g, 0.3, 0.03, 0.14, 0x3a3a40, x, y, z + 0.22); box(g, 0.04, 0.1, 0.04, 0x8d9199, x, y + 0.18, z + 0.2);
      const cup = new T.Mesh(new T.CylinderGeometry(0.055, 0.045, 0.09, 10), mat(0xffffff)); cup.position.set(x, y + 0.075, z + 0.22); g.add(cup);
      const th = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.32, 10), mat(0xb9c0c8)); th.position.set(x - 0.42, y + 0.16, z); g.add(th); box(g, 0.08, 0.05, 0.08, 0x111111, x - 0.42, y + 0.32, z);
      [0.36, 0.5].forEach(dx => { const k = new T.Mesh(new T.CylinderGeometry(0.05, 0.04, 0.09, 8), mat(dx > 0.4 ? 0xe10600 : 0xffffff)); k.position.set(x + dx, y + 0.045, z + 0.05); g.add(k); }); }
    { const g = upGroup(root, 'luces', 1), red = glowMat(0xff2a2a), cy = glowMat(0x57e6ff);
      box(g, s.xMax - s.xMin + 0.4, 0.07, 0.09, red, 0, s.wallH, s.zMin - 0.1); box(g, 0.09, 0.07, s.zMax - s.zMin, red, s.xMin - 0.1, s.wallH, (s.zMin + s.zMax) / 2);
      const xa = m.x - m.w / 2, xb = c.x + c.w / 2; box(g, xb - xa, 0.05, 0.05, cy, (xa + xb) / 2, 0.02, m.z + m.d / 2 + 0.04);
      const halo = new T.MeshBasicMaterial({ color: 0x57e6ff, transparent: true, opacity: 0.2, depthWrite: false });
      plane(g, xb - xa, 0.7, halo, (xa + xb) / 2, 0.012, m.z + m.d / 2 + 0.38, 0, -Math.PI / 2);
    }
    { const g = upGroup(root, 'vidluz', 1), warm = glowMat(0xfff0a8), zA = s.zMax, zB = L.galeria.zMax, p = L.galeria.pasillo, cz = (zA + zB) / 2, d = zB - zA - 0.2;
      const halo = new T.MeshBasicMaterial({ color: 0xfff0a8, transparent: true, opacity: 0.22, depthWrite: false });
      [-1, 1].forEach(side => { const x0 = side * p, x1 = side * s.xMax, cx = (x0 + x1) / 2, w = Math.abs(x1 - x0);
        box(g, 0.07, 0.07, d, warm, x0 + side * 0.06, 2.36, cz); box(g, w, 0.07, 0.07, warm, cx, 2.36, zB - 0.14);
        box(g, 0.05, 0.05, d - 0.4, warm, x0 + side * 0.52, 0.95, cz); box(g, 0.05, 0.05, d - 0.4, warm, x0 + side * 2.32, 1.4, cz);
        plane(g, w - 0.2, d - 0.3, halo, cx, 0.512, cz, 0, -Math.PI / 2); }); }
    { const g = upGroup(root, 'caja2', 1), x = c.x + 0.6;
      box(g, 0.5, 0.22, 0.4, 0x222222, x, top, c.z - 0.1); box(g, 0.36, 0.2, 0.06, 0x57e6ff, x, top + 0.22, c.z - 0.15, { emissive: 0x1c8aa0 });
      box(g, 0.5, 0.3, 0.05, 0x111111, x, top, c.z + 0.3); sign(g, 'CAJA 2', 0.46, 0.2, x, top + 0.16, c.z + 0.33); }
  }
  // Oficina del Dueño: al costado derecho, delante del depósito. De acá sale a hablar y acá vuelve.
  function buildOffice(root) {
    const x0 = L.salon.xMax + 0.5, x1 = 11.4, zA = -0.9, zB = 3.6, cx = (x0 + x1) / 2, cz = (zA + zB) / 2, gold = 0xd4a017;
    const wood = canvasTex(128, 128, g => { g.fillStyle = '#8a6444'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#6f4f35'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(128, i * 32); g.stroke(); } g.beginPath(); g.moveTo(40, 0); g.lineTo(40, 32); g.moveTo(96, 32); g.lineTo(96, 64); g.moveTo(24, 64); g.lineTo(24, 96); g.moveTo(80, 96); g.lineTo(80, 128); g.stroke(); });
    wood.wrapS = wood.wrapT = T.RepeatWrapping; wood.repeat.set(4, 4);
    box(root, x1 - x0 + 0.4, 0.5, zB - zA + 0.4, 0x18181b, cx, -0.52, cz); plane(root, x1 - x0, zB - zA, new T.MeshLambertMaterial({ map: wood }), cx, 0.005, cz, 0, -Math.PI / 2);
    box(root, x1 - x0, 2.25, 0.2, 0xf4f4f2, cx, 0, zA - 0.1); box(root, x1 - x0, 0.9, 0.02, 0x16161a, cx, 0, zA + 0.011);          // pared del fondo con zócalo oscuro
    box(root, 0.2, 0.3, zB - zA, 0xdedede, x1 + 0.1, 0, cz); box(root, x1 - x0, 0.3, 0.2, 0xdedede, cx, 0, zB + 0.1);
    sign(root, 'OFICINA DEL DUEÑO', 2.8, 0.3, cx, 2.03, zA + 0.03);
    // cuadro con el logo, estante de trofeos y pantalla con las ventas
    box(root, 1.3, 0.62, 0.05, 0x0c0c0c, 7.6, 1.1, zA + 0.03);
    plane(root, 1.2, 0.52, new T.MeshBasicMaterial({ map: logoTex(512, 220, (g, w, h, img) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const iw = w * 0.86, ih = iw * img.height / img.width; g.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih); }) }), 7.6, 1.41, zA + 0.06);
    box(root, 1.3, 0.05, 0.26, 0x2a2a2e, 9.3, 1.15, zA + 0.14);
    [[-0.42, 0.9], [0, 1.2], [0.42, 0.9]].forEach(q => { const tx = 9.3 + q[0], k = q[1];
      box(root, 0.16 * k, 0.05, 0.14, 0x1a1a1e, tx, 1.2, zA + 0.14); box(root, 0.04, 0.1 * k, 0.04, gold, tx, 1.25, zA + 0.14);
      const cup = new T.Mesh(new T.CylinderGeometry(0.09 * k, 0.05 * k, 0.16 * k, 10), mat(gold, { emissive: 0x3a2a00 })); cup.position.set(tx, 1.25 + 0.1 * k + 0.08 * k, zA + 0.14); root.add(cup); });
    box(root, 1.2, 0.72, 0.06, 0x111111, 10.75, 1.05, zA + 0.04);
    plane(root, 1.1, 0.62, new T.MeshBasicMaterial({ map: canvasTex(256, 144, (g, w, h) => { g.fillStyle = '#0d1512'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 20px Impact, "Arial Black", sans-serif'; g.fillText('VENTAS', 12, 26);
      const v = [30, 42, 38, 58, 66, 84, 104]; v.forEach((b, i) => { g.fillStyle = i === v.length - 1 ? '#e10600' : '#25c26e'; g.fillRect(16 + i * 33, h - 12 - b, 22, b); }); }) }), 10.75, 1.41, zA + 0.075);
    // alfombra, escritorio y sillón
    box(root, 3.3, 0.02, 2.5, 0x8a1010, 9.3, 0.008, 1.25); box(root, 3.0, 0.022, 0.07, 0xe9c46a, 9.3, 0.009, 0.2); box(root, 3.0, 0.022, 0.07, 0xe9c46a, 9.3, 0.009, 2.3);
    box(root, 2.2, 0.09, 0.9, 0x3a2416, 9.3, 0.74, 1.6); box(root, 0.5, 0.74, 0.8, 0x4a2e1c, 8.5, 0, 1.6); box(root, 0.5, 0.74, 0.8, 0x4a2e1c, 10.1, 0, 1.6); box(root, 1.1, 0.5, 0.05, 0x4a2e1c, 9.3, 0.24, 2.0);
    plane(root, 1.0, 0.2, new T.MeshBasicMaterial({ map: textTex('EL DUEÑO', { bg: '#111', fg: '#f5c518', w: 256, h: 52 }) }), 9.3, 0.5, 2.03);
    const mon = monitor(root, 9.85, 0.83, 1.78, Math.PI); mon.scale.setScalar(1.2);                                                        // la pantalla mira al Dueño
    plane(mon, 0.56, 0.34, new T.MeshBasicMaterial({ color: 0x56d6ff }), 0, 0.38, 0.025); box(root, 0.5, 0.02, 0.18, 0x1a1a1e, 9.85, 0.83, 1.45);
    box(root, 0.3, 0.03, 0.4, 0xffffff, 8.75, 0.83, 1.6); box(root, 0.28, 0.03, 0.38, 0xf1f1f1, 8.77, 0.86, 1.62);                       // papeles
    box(root, 0.08, 0.2, 0.05, 0x111111, 9.3, 0.83, 1.85); box(root, 0.015, 0.14, 0.015, 0x111111, 9.33, 1.03, 1.85);                       // handy
    const mate = new T.Mesh(new T.CylinderGeometry(0.07, 0.055, 0.14, 8), mat(0x6b3e1e)); mate.position.set(9.05, 0.9, 1.4); root.add(mate); box(root, 0.015, 0.14, 0.015, 0xcccccc, 9.08, 0.93, 1.4);
    gamingChair(root, 9.3, 0.1, 0, 0x111111, gold);
    // sillón para visitas contra la pared del salón, mirando al escritorio, y plantas
    box(root, 0.62, 0.34, 1.5, 0xc40000, 7.15, 0.08, 2.4); box(root, 0.16, 0.5, 1.5, 0xa80000, 6.86, 0.42, 2.4); box(root, 0.62, 0.26, 0.16, 0xa80000, 7.15, 0.42, 1.73); box(root, 0.62, 0.26, 0.16, 0xa80000, 7.15, 0.42, 3.07);
    box(root, 0.5, 0.4, 0.5, 0x3a2416, 7.3, 0, 0.9); plant(root, 10.9, -0.4, 1.1);
    plant(root, 10.9, 3.15, 1.3);
    sideDoor(root, -0.3, 'OFICINA');
  }
  // Cartel de sector para las mesas: una franja negra a lo largo del mueble y, centrada, la chapa roja con el nombre.
  // Todas a la misma altura y con el mismo tamaño de letra, del lado que mira a la cámara.
  function rail(g, text, x, z, len, side) {
    const mt = new T.MeshBasicMaterial({ map: textTex(text, { bg: '#e10600', fg: '#fff', w: 578, h: 136, font: '900 66px Impact, "Arial Black", sans-serif' }) });
    const k = new T.Group(); k.position.set(x, 0, z); if (side === 'x') k.rotation.y = Math.PI / 2; g.add(k);          // en el grupo, "z" es hacia afuera del mueble
    box(k, len, 0.42, 0.05, 0x0c0c0c, 0, 0.44, 0.03);
    const pl = plane(k, 1.7, 0.4, mt, 0, 0.73, 0.21); pl.rotation.x = -0.9;                                             // chapa inclinada hacia arriba, como un atril: se lee desde la cámara
    box(k, 1.74, 0.03, 0.34, 0x0c0c0c, 0, 0.56, 0.2);
  }
  function buildCenter(root) {
    { // isla Apple
      const g = upGroup(root, 'isla', 1), b = Batch(g), i = L.isla;
      box(g, i.w, i.h, i.d, 0xffffff, i.x, 0, i.z); box(g, i.w - 0.2, i.h - 0.3, 0.03, 0xe2e2e2, i.x, 0.2, i.z + i.d / 2 + 0.01);
      idsOf('apple').forEach((id, k) => sprite(g, id, i.x - 0.66 + k * 0.33, i.h, i.z + 0.1, 0.4));
      rail(g, 'APPLE', i.x, i.z + i.d / 2, i.w, 'z'); b.build();
    }
    { // mesa de madera con PC y accesorios
      const g = upGroup(root, 'mesa', 1), t = L.mesa, wood = 0xd9b77e;
      box(g, t.w, 0.09, t.d, wood, t.x, t.h - 0.09, t.z);
      box(g, t.w - 0.1, t.h - 0.09, 0.1, wood, t.x, 0, t.z - t.d / 2 + 0.05); box(g, t.w - 0.1, t.h - 0.09, 0.1, wood, t.x, 0, t.z + t.d / 2 - 0.05);
      box(g, 0.08, t.h - 0.09, t.d, 0xc9a56b, t.x - t.w / 2 + 0.3, 0, t.z);
      [[-1.1, 0x111111], [-0.2, 0xf4f4f4], [0.7, 0x111111]].forEach(a => box(g, 0.5, 0.62, 0.62, a[1], t.x + 0.35, 0, t.z + a[0]));
      notebook(g, t.x, t.h, t.z - 1.35); notebook(g, t.x, t.h, t.z - 0.75);
      ['gpu', 'monitor', 'ram', 'gabinete', 'disco', 'impresora', 'router', 'cargador'].forEach((id, k) => sprite(g, id, t.x + (k % 2 ? 0.32 : -0.32), t.h, t.z - 0.1 + Math.floor(k / 2) * 0.48, 0.5));
      rail(g, 'PC Y ACCESORIOS', t.x + t.w / 2, t.z, t.d, 'x');
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
      const ids = idsOf('perifericos'); let k = 0; for (let z = gd.z - gd.d / 2 + 0.3; z < gd.z + gd.d / 2 - 0.1; z += 0.5) sprite(g, ids[k++ % ids.length], gd.x, gd.h, z, 0.6);
      rail(g, 'PERIFÉRICOS GAMER', gd.x + gd.w / 2, gd.z, gd.d, 'x'); b.build();
    }
  }
  // Puestos de trabajo de la Etapa 2: service técnico, empaque de Mercado Libre y cajas para reponer
  function buildWorkStations(root) {
    const b = Batch(root), carton = 0xc49a6c;
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
  // Depósito: al costado derecho del salón, con una estantería por sector (acá se juega la reposición)
  function buildDepot(root) {
    const x0 = L.salon.xMax + 0.5, x1 = 11.4, zA = -7, zB = -1.2, b = Batch(root), cx = (x0 + x1) / 2, cz = (zA + zB) / 2;
    box(root, x1 - x0, 0.06, zB - zA, 0x9a9aa0, cx, -0.02, cz); box(root, x1 - x0 + 0.4, 0.5, zB - zA + 0.4, 0x18181b, cx, -0.52, cz);
    box(root, x1 - x0, 2.6, 0.2, 0xd8d8d4, cx, 0, zA - 0.1); box(root, 0.2, 0.3, zB - zA, 0xd8d8d4, x1 + 0.1, 0, cz);
    sign(root, 'DEPÓSITO', 2.4, 0.4, cx, 2.3, zA + 0.03);
    GS.SHELVES.forEach((sh, k) => {
      const x = sh.pos[0], z = sh.pos[1];
      [[-0.75, -0.3], [0.75, -0.3], [-0.75, 0.3], [0.75, 0.3]].forEach(q => box(root, 0.06, 1.9, 0.06, 0x3a4a6a, x + q[0], 0, z + q[1]));
      for (let l = 0; l < 3; l++) { box(root, 1.6, 0.05, 0.66, 0x51658f, x, 0.3 + l * 0.6, z); for (let i = 0; i < 3; i++) b.add(0.42, 0.34, 0.46, i % 2 ? 0xc49a6c : 0xb98d5e, x - 0.5 + i * 0.5, 0.35 + l * 0.6, z); }
      const ids = idsOf(sh.cat); sprite(root, ids[0], x - 0.5, 1.55, z, 0.5); sprite(root, ids[1 % ids.length], x, 1.55, z, 0.5); sprite(root, ids[2 % ids.length], x + 0.5, 1.55, z, 0.5);
      sign(root, sh.name.toUpperCase(), 1.6, 0.26, x, 0.16, z + 0.35);
    });
    b.build();
  }
  function notebook(root, x, y, z) {          // abierta, con la pantalla mirando a la cámara
    box(root, 0.36, 0.03, 0.5, 0x2a2a2e, x, y, z); box(root, 0.24, 0.005, 0.4, 0x1a1a1e, x + 0.03, y + 0.03, z);
    const lid = new T.Group(); lid.position.set(x - 0.18, y + 0.03, z); lid.rotation.z = 0.28; root.add(lid);
    box(lid, 0.03, 0.34, 0.5, 0x2a2a2e, 0, 0, 0); box(lid, 0.012, 0.28, 0.44, 0x56d6ff, 0.02, 0.03, 0, { emissive: 0x2a8aa0 });
  }

  // Marco de puerta sobre la pared derecha (que está "cortada"): postes rojos, dintel y cartel de los dos lados
  function sideDoor(root, z, text) {
    const x = L.salon.xMax + 0.1;
    box(root, 0.14, 2.2, 0.14, 0xe10600, x, 0, z - 0.55); box(root, 0.14, 2.2, 0.14, 0xe10600, x, 0, z + 0.55); box(root, 0.16, 0.42, 1.24, 0x111111, x, 2.2, z);
    const mt = new T.MeshBasicMaterial({ map: textTex(text, { bg: '#111', fg: '#fff', w: 256, h: 80 }) });
    plane(root, 1.1, 0.34, mt, x + 0.085, 2.41, z, Math.PI / 2); plane(root, 1.1, 0.34, mt, x - 0.085, 2.41, z, -Math.PI / 2);
  }
  // Taller: al costado derecho, delante de la oficina. Acá se reparan los equipos y se arman las PC.
  function buildTaller(root) {
    const t = L.taller, sv = L.service, cx = (t.x0 + t.x1) / 2, cz = (t.zA + t.zB) / 2, w = t.x1 - t.x0, d = t.zB - t.zA, b = Batch(root);
    const floor = canvasTex(128, 128, g => { g.fillStyle = '#aeb6b3'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#99a19e'; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128); });
    floor.wrapS = floor.wrapT = T.RepeatWrapping; floor.repeat.set(5, 5);
    box(root, w + 0.4, 0.5, d + 0.4, 0x18181b, cx, -0.52, cz); plane(root, w, d, new T.MeshLambertMaterial({ map: floor }), cx, 0.005, cz, 0, -Math.PI / 2);
    box(root, 0.2, 0.3, d, 0xdedede, t.x1 + 0.1, 0, cz); box(root, w, 0.3, 0.2, 0xdedede, cx, 0, t.zB + 0.1);
    for (let i = 0; i < 12; i++) box(root, w / 12, 0.012, 0.14, i % 2 ? 0x111111 : 0xf5c518, t.x0 + (i + 0.5) * w / 12, 0.006, t.zB - 0.12);     // franja de seguridad
    // tablero de herramientas con el cartel
    box(root, 2.9, 1.55, 0.08, 0xd9c7a3, sv.x, 0, t.zA + 0.06); sign(root, 'TALLER', 1.5, 0.32, sv.x, 1.32, t.zA + 0.11);
    [[-1.1, 0.75, 0.06, 0.4, 0xe10600], [-0.85, 0.7, 0.06, 0.5, 0xf5c518], [-0.55, 0.78, 0.2, 0.08, 0x8d9199], [0.6, 0.72, 0.06, 0.44, 0x2d6cdf], [0.9, 0.76, 0.26, 0.1, 0x8d9199], [1.15, 0.7, 0.06, 0.36, 0x3bb54a], [0, 0.66, 0.3, 0.3, 0x111111]]
      .forEach(q => box(root, q[2], q[3], 0.04, q[4], sv.x + q[0], q[1] - q[3] / 2 + 0.1, t.zA + 0.12));
    // banco de reparaciones: tapa verde, manta azul antiestática, notebook abierta, lámpara y herramientas
    box(root, sv.w, sv.h, sv.d, 0xffffff, sv.x, 0, sv.z); box(root, sv.w + 0.08, 0.06, sv.d + 0.08, 0x7ed321, sv.x, sv.h, sv.z); box(root, 0.9, 0.012, 0.6, 0x2d6cdf, sv.x - 0.35, sv.h + 0.06, sv.z);
    notebook(root, sv.x - 0.35, sv.h + 0.075, sv.z);
    box(root, 0.3, 0.05, 0.1, 0xe10600, sv.x + 0.45, sv.h + 0.06, sv.z + 0.1); box(root, 0.06, 0.04, 0.4, 0xf5c518, sv.x + 0.75, sv.h + 0.06, sv.z); box(root, 0.16, 0.08, 0.26, 0xf5c518, sv.x + 0.3, sv.h + 0.06, sv.z - 0.2);
    box(root, 0.04, 0.5, 0.04, 0x222222, sv.x + 0.98, sv.h + 0.06, sv.z - 0.28); box(root, 0.26, 0.05, 0.12, 0xfff0a8, sv.x + 0.88, sv.h + 0.56, sv.z - 0.2, { emissive: 0xa08a30 });
    const stool = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.08, 12), mat(0x222222)); stool.position.set(sv.x - 0.3, 0.55, sv.z + 0.85); root.add(stool); box(root, 0.06, 0.52, 0.06, 0x8d9199, sv.x - 0.3, 0, sv.z + 0.85);
    // mesa de armado de PC: gabinete abierto con luces y piezas esperando
    box(root, 1.7, 0.08, 0.9, 0xd9b77e, 10.1, 0.82, 6.9); [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]].forEach(q => box(root, 0.07, 0.82, 0.07, 0xb48a50, 10.1 + q[0], 0, 6.9 + q[1]));
    box(root, 0.3, 0.58, 0.56, 0x15151a, 10.5, 0.9, 6.9); box(root, 0.02, 0.44, 0.44, 0x56d6ff, 10.34, 0.97, 6.9, { emissive: 0x2a8aa0 });
    sprite(root, 'gpu', 9.65, 0.9, 6.75, 0.4); sprite(root, 'ram', 9.65, 0.9, 7.15, 0.34); sign(root, 'ARMADO DE PC', 1.5, 0.22, 10.1, 0.6, 7.36);
    // estantería con equipos esperando turno
    [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]].forEach(q => box(root, 0.06, 1.6, 0.06, 0x3a4a6a, 10.7 + q[0], 0, 4.6 + q[1]));
    for (let l = 0; l < 3; l++) { box(root, 1.1, 0.05, 0.66, 0x51658f, 10.7, 0.3 + l * 0.55, 4.6); b.add(0.42, 0.06, 0.5, 0x2a2a2e, 10.5, 0.35 + l * 0.55, 4.6); b.add(0.16, 0.012, 0.1, 0xf5c518, 10.5, 0.41 + l * 0.55, 4.72); if (l < 2) b.add(0.26, 0.36, 0.4, l ? 0x15151a : 0xf4f4f4, 10.98, 0.35 + l * 0.55, 4.6); }
    b.build();
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
  }

  /* ---------- Personajes low-poly (cabezones) ---------- */
  const SKINS = [0xf2c9a0, 0xe0ac7e, 0xc68a5c, 0x9a643c, 0xf6d7bd];
  const gBody = new T.CylinderGeometry(0.2, 0.3, 0.8, 8), gHead = new T.SphereGeometry(0.33, 12, 10),
        gHair = new T.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), gEye = new T.SphereGeometry(0.04, 6, 6),
        gShadow = new T.CircleGeometry(0.36, 16);
  const shadowMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false });
  const gCone = new T.CylinderGeometry(0.15, 0.34, 0.86, 12), gBun = new T.SphereGeometry(0.15, 8, 8), gCurl = new T.SphereGeometry(0.13, 7, 6),
        gBeard = new T.SphereGeometry(0.348, 14, 6, Math.PI * 0.06, Math.PI * 0.88, Math.PI * 0.6, Math.PI * 0.36),
        gCap = new T.SphereGeometry(0.348, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.47), gMass = new T.SphereGeometry(0.36, 12, 10);
  function makePerson(o) {
    o = o || {};
    const g = new T.Group(), base = o.scale || 1; g.scale.setScalar(base); g.userData.base = base;
    const body = new T.Mesh(gCone, mat(o.shirt || 0x4a6fb5)); body.position.y = 0.45; g.add(body);
    const head = new T.Mesh(gHead, mat(SKINS[0])); head.position.y = 1.14; g.add(head);
    [-0.12, 0.12].forEach(x => { const e = new T.Mesh(gEye, mat(0x111111)); e.position.set(x, 1.14, 0.3); g.add(e); });
    const sh = new T.Mesh(gShadow, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; g.add(sh);
    const bag = box(g, 0.26, 0.3, 0.12, 0xe10600, 0.3, 0.3, 0.1); bag.visible = false;
    const carry = box(g, 0.36, 0.28, 0.3, 0xc49a6c, 0, 0.42, 0.34); carry.visible = false;
    const phone = o.phone ? box(g, 0.1, 0.18, 0.03, 0x111111, 0.12, 0.72, 0.26) : null;
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
      const cap = () => { const m = new T.Mesh(gCap, hm); m.rotation.x = -0.5; acc.add(m); };      // casquete concéntrico con la cabeza que deja la frente libre
      if (st === 'corto' || st === 'largo' || st === 'rodete') cap();
      if (st === 'largo') { const m = new T.Mesh(gMass, hm); m.scale.set(1.06, 1.3, 0.8); m.position.set(0, -0.2, -0.16); acc.add(m); }   // melena redondeada por detrás
      if (st === 'rodete') { const b = new T.Mesh(gBun, hm); b.position.set(0, 0.4, -0.12); acc.add(b); }
      if (st === 'rulos') { for (let i = 0; i < 9; i++) { const an = i / 9 * Math.PI * 2, c = new T.Mesh(gCurl, hm); c.scale.setScalar(1.25); c.position.set(Math.cos(an) * 0.25, 0.2, Math.sin(an) * 0.25 - 0.05); acc.add(c); }
        [[0, 0.36, -0.04], [0.14, 0.33, 0.06], [-0.14, 0.33, 0.06], [0, 0.32, -0.2]].forEach(q => { const c = new T.Mesh(gCurl, hm); c.scale.setScalar(1.3); c.position.set(q[0], q[1], q[2]); acc.add(c); }); }
      if (st === 'mohicano') { box(acc, 0.1, 0.26, 0.62, hm, 0, 0.22, -0.03); box(acc, 0.1, 0.14, 0.3, hm, 0, 0.44, -0.03); }
      if (a.beard) acc.add(new T.Mesh(gBeard, hm));                                                  // sigue la forma del mentón, solo por delante
      if (a.glasses) { box(acc, 0.16, 0.12, 0.03, 0x111111, -0.12, -0.07, 0.3); box(acc, 0.16, 0.12, 0.03, 0x111111, 0.12, -0.07, 0.3); box(acc, 0.1, 0.03, 0.03, 0x111111, 0, -0.01, 0.3); }
      if (a.lashes) [-0.12, 0.12].forEach(x => { const l = box(acc, 0.13, 0.025, 0.03, 0x111111, x, 0.06, 0.3); l.rotation.z = x < 0 ? 0.3 : -0.3; });
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
      phone(v) { if (phone) phone.visible = v; },
      carry(v) { carry.visible = v; },
      lie(v) { g.rotation.x = v ? -1.3 : 0; g.position.y = v ? 0.28 : 0; },
      stop() { p.path = []; p.moving = false; p.onArrive = null; g.position.y = 0; },
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
    if (Math.abs(v3.x - c.x) < c.w / 2 + 0.2 && Math.abs(v3.z - c.z) < c.d / 2 + pad) return tapHandler('caja');
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
    sky.hemi = new T.HemisphereLight(0xffffff, 0x8f8a86, 0.66); scene.add(sky.hemi);
    const sun = sky.sun = new T.DirectionalLight(0xffffff, 0.36); sun.position.set(9, 12, 5); scene.add(sun);

    const root = new T.Group(); scene.add(root);
    buildFloor(root); buildBackWall(root);
    walls.O = new T.Group(); root.add(walls.O); shelfWall(walls.O, L.salon.xMin, 1, L.salon.zMin + 0.4, L.salon.zMax - 0.3);
    walls.E = new T.Group(); root.add(walls.E); shelfWall(walls.E, L.salon.xMax, -1, L.salon.zMin + 0.4, L.salon.zMax - 0.3);
    // zócalos bajos donde la pared está "cortada"
    { const doors = [L.depoDoor.z, -0.3, L.tallerDoor.z]; let z0 = L.salon.zMin;          // zócalo con los huecos de las tres puertas
      doors.concat([null]).forEach(dz => { const z1 = dz == null ? L.salon.zMax : dz - 0.55; if (z1 - z0 > 0.05) box(root, 0.2, 0.3, z1 - z0, 0xdedede, L.salon.xMax + 0.1, 0, (z0 + z1) / 2); if (dz != null) z0 = dz + 0.55; }); }
    buildCounter(root); buildCenter(root); buildWorkStations(root); buildDepot(root); sideDoor(root, L.depoDoor.z, 'DEPÓSITO'); buildOffice(root); buildTaller(root); sideDoor(root, L.tallerDoor.z, 'TALLER'); buildGallery(root); buildSign(root); buildExtras(root);

    // empleados (inventados): vos en el mostrador y Brian, pegado al celular, en la caja
    yo = makePerson({ shirt: 0xe10600, hair: 0x2b2b3a, skin: SKINS[1], speed: 7.5 }); yo.setPos(L.yoMostrador[0], L.yoMostrador[1]);
    // compañeros (inventados): andan por el local haciendo sus cosas. Lucho, de mohicano y anteojos, y Brian, pegado al celular.
    lucho = makePerson({ shirt: 0xe10600, hair: 0xff5fa2, hairStyle: 'mohicano', skin: GS.SKINS[3], glasses: true, speed: 2.6 }); lucho.setPos(4.0, 0.8);
    brian = makePerson({ shirt: 0xe10600, hair: 0x2d6cdf, skin: SKINS[0], phone: true, speed: 2.3 }); brian.setPos(4.5, -1.2); brian.face(-0.6);
    boss = makePerson({ shirt: 0x111111, hair: 0xb4b4bd, hairStyle: 'mohicano', skin: 0xe0ac7e, scale: 1.18, speed: 3.4 }); boss.setPos(BOSS_HOME[0], BOSS_HOME[1]);

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
    // El Dueño: un solo personaje que vive en su oficina
    // Hora del día (0 = 10 hs, 1 = 19 hs): cambia la luz, el color de la vereda y prende los faroles al anochecer
    setDayTime(f, rain) {
      if (!sky.hemi) return;
      const K = [0, 0.35, 0.62, 0.85, 1], at = arr => { for (let i = 1; i < K.length; i++) if (f <= K[i]) return [arr[i - 1], arr[i], (f - K[i - 1]) / (K[i] - K[i - 1])]; return [arr[4], arr[4], 0]; };
      const col = arr => { const q = at(arr); return new T.Color(q[0]).lerp(new T.Color(q[1]), q[2]); }, num = arr => { const q = at(arr); return q[0] + (q[1] - q[0]) * q[2]; };
      const wet = rain ? 0.68 : 1, n = U.clamp((f - 0.7) / 0.25, 0, 1);
      sky.side.color.copy(col([0x868d98, 0x9c9ca0, 0xb0977c, 0x86687a, 0x3d4058])).multiplyScalar(wet); sky.joint.color.copy(sky.side.color).multiplyScalar(0.82);
      sky.hemi.color.copy(col([0xeaf2ff, 0xffffff, 0xfff0dc, 0xfff4ea, 0xfff6ec])); sky.hemi.intensity = num([0.66, 0.68, 0.67, 0.67, 0.68]);
      sky.sun.color.copy(col([0xfff4e0, 0xffffff, 0xffdcb0, 0xffe2c0, 0xfff1dc])); sky.sun.intensity = num([0.32, 0.38, 0.36, 0.34, 0.34]) * (rain ? 0.85 : 1);   // adentro siempre a pleno: de noche lo que cambia es la vereda sky.sun.position.x = 9 - f * 11;
      sky.spill.opacity = n * 0.34 + (rain ? 0.08 : 0); sky.halo.opacity = n * 0.42; sky.bulb.color.set(0x55555c).lerp(new T.Color(0xfff2c0), n);
    },
    boss: () => boss,
    staff: () => [lucho, brian],
    player: () => yo,
    bossHome() { if (boss) { boss.stop(); boss.setPos(BOSS_HOME[0], BOSS_HOME[1]); boss.face(0); } },
    BOSS_HOME,
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
