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
    cam.gdist = U.clamp(cam.gdist, cam.fit * 0.3, cam.fit * 1.75);
  }
  let stg = null, stVy = 0, stOff = false, drone = null, stTy = 0.8, stTyG = 0.8; const tiltBase = GS.CONFIG.camera.tilt * DEG;
  function applyCam() {
    const ch = Math.cos(tilt), sh = Math.sin(tilt);
    camera.position.set(cam.tx + cam.dist * Math.sin(rot) * ch, stTy + cam.dist * sh, cam.tz + cam.dist * Math.cos(rot) * ch);
    camera.lookAt(cam.tx, stTy, cam.tz);
    if (Math.abs(stVy) > 0.002) { const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1; camera.setViewOffset(w, h, 0, stVy * h, w, h); stOff = true; } else if (stOff) { camera.clearViewOffset(); stOff = false; }
    camera.near = Math.max(1, cam.dist * 0.2, cam.dist - 42); camera.far = cam.dist * 2 + 110;      /* rango de profundidad ajustado: más precisión, menos parpadeo en las uniones */
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
    if (!matCache[key]) { let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0; matCache[key] = new T.MeshLambertMaterial(Object.assign({ color, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: (h % 13) * 1.5 }, opt || {})); }
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
  /* Productos de exhibición sin caja: modelitos simples, con base en y = 0 y unos 0,35 m de ancho. model() los ubica mirando a la cámara. */
  const cylM = (g, r1, r2, h, c, x, y, z, ax, opt) => { const m = new T.Mesh(new T.CylinderGeometry(r1, r2, h, 12), c && c.isMaterial ? c : mat(c, opt)); if (ax === 'x') m.rotation.z = Math.PI / 2; if (ax === 'z') m.rotation.x = Math.PI / 2; m.position.set(x, y + (ax ? 0 : h / 2), z); g.add(m); return m; };
  const ballM = (g, sx, sy, sz, c, x, y, z, opt) => { const m = new T.Mesh(gBall, mat(c, opt)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); g.add(m); return m; };
  const gBall = new T.SphereGeometry(1, 12, 9), GLOW = c => ({ emissive: c });
  const padM = c => g => { box(g, 0.1, 0.07, 0.07, 0x2c2c33, 0, 0, 0); const b = box(g, 0.3, 0.07, 0.13, c, 0, 0.07, 0); b.rotation.x = -0.5; [-1, 1].forEach(sd => { cylM(g, 0.045, 0.04, 0.13, c, sd * 0.115, 0.03, 0.05).rotation.x = -0.5; ballM(g, 0.024, 0.014, 0.024, 0x111111, sd * 0.055, 0.135, 0.01); ballM(g, 0.012, 0.008, 0.012, sd < 0 ? 0x1b1b1f : 0xf4f4f6, sd * 0.11, 0.165, -0.035); }); box(g, 0.1, 0.012, 0.05, 0x1b1b1f, 0, 0.142, -0.03).rotation.x = -0.5; box(g, 0.11, 0.008, 0.008, 0x56c8ff, 0, 0.166, -0.062, GLOW(0x56c8ff)).rotation.x = -0.5; };
  const caseM = id => g => { const m = new T.Mesh(unitBox, iconMats(id)); m.scale.set(0.03, 0.3, 0.24); m.position.set(0, 0.17, 0); m.rotation.y = -Math.PI / 2 + 0.0; m.rotation.z = 0.12; g.add(m); box(g, 0.1, 0.02, 0.16, 0x2c2c33, 0, 0, -0.02); };
  const MODELS = {
    ps5: g => { cylM(g, 0.13, 0.14, 0.02, 0x15151a, 0, 0, 0); box(g, 0.08, 0.4, 0.24, 0x101014, 0, 0.02, 0); [-1, 1].forEach(sd => { const pl = box(g, 0.045, 0.44, 0.3, 0xf7f7f9, sd * 0.07, 0.02, 0); pl.rotation.z = sd * -0.06; box(g, 0.01, 0.38, 0.012, 0x3aa0ff, sd * 0.042, 0.04, 0.125, GLOW(0x2a70c0)); }); },
    xbox: g => { box(g, 0.2, 0.4, 0.2, 0x1b1b20, 0, 0, 0); box(g, 0.16, 0.012, 0.16, 0x3bd24a, 0, 0.4, 0, GLOW(0x1f8a2c)); ballM(g, 0.016, 0.016, 0.006, 0xf4f4f6, -0.06, 0.34, 0.1); box(g, 0.012, 0.1, 0.006, 0x3a3a44, -0.06, 0.1, 0.1); },
    switch2: g => { box(g, 0.3, 0.12, 0.09, 0x1b1b20, 0, 0, -0.03); const t = new T.Group(); t.position.set(0, 0.1, 0.03); t.rotation.x = -0.18; g.add(t); box(t, 0.26, 0.2, 0.03, 0x111114, 0, 0, 0); box(t, 0.22, 0.15, 0.006, 0x56c8ff, 0, 0.025, 0.017, GLOW(0x2a7090)); box(t, 0.06, 0.2, 0.034, 0x2bb8f0, -0.16, 0, 0); box(t, 0.06, 0.2, 0.034, 0xff4f3d, 0.16, 0, 0); },
    quest: g => { cylM(g, 0.09, 0.1, 0.02, 0x2c2c33, 0, 0, 0); cylM(g, 0.02, 0.02, 0.12, 0x2c2c33, 0, 0.02, 0); box(g, 0.3, 0.15, 0.14, 0xf6f7f9, 0, 0.13, 0.02); box(g, 0.25, 0.09, 0.012, 0x1b1b20, 0, 0.16, 0.091); box(g, 0.32, 0.04, 0.24, 0xc5c9d2, 0, 0.2, -0.1); },
    dualsense: padM(0xff8fc0), ds_blanco: padM(0xf6f6f8), ds_negro: padM(0x2c2c33), ds_rojo: padM(0xd81e2c), ds_azul: padM(0x2d6cdf), ds_violeta: padM(0x8a4fd1), joyxbox: padM(0x3a3a44),
    juego: caseM('juego'), juego2: caseM('juego2'), juego3: caseM('juego3'), juego4: caseM('juego4'),
    auris: g => { cylM(g, 0.1, 0.11, 0.02, 0x1b1b20, 0, 0, 0); cylM(g, 0.016, 0.016, 0.32, 0x2c2c33, 0, 0.02, 0); const t = new T.Mesh(new T.TorusGeometry(0.12, 0.02, 6, 14, Math.PI), mat(0x1d1d23)); t.position.y = 0.3; g.add(t); [-1, 1].forEach(sd => { cylM(g, 0.07, 0.07, 0.05, 0xe10600, sd * 0.125, 0.27, 0, 'x'); cylM(g, 0.055, 0.055, 0.03, 0x1d1d23, sd * 0.09, 0.27, 0, 'x'); }); },
    teclado: g => { const k = new T.Group(); k.rotation.x = 0.12; g.add(k); box(k, 0.44, 0.03, 0.16, 0x17171c, 0, 0, 0); [0xff4fa3, 0x56c8ff, 0x3aff9c].forEach((c, i) => box(k, 0.4, 0.014, 0.034, c, 0, 0.03, -0.045 + i * 0.045, GLOW(c))); },
    mouse: g => { ballM(g, 0.065, 0.045, 0.1, 0x1f1f25, 0, 0.035, 0); box(g, 0.012, 0.012, 0.05, 0x56e0ff, 0, 0.074, -0.03, GLOW(0x2a90b0)); box(g, 0.2, 0.006, 0.24, 0x2c2c33, 0, 0, 0); },
    monitor: g => { const m = monitor(g, 0, 0, 0, 0); m.scale.setScalar(0.72); plane(m, 0.56, 0.34, new T.MeshBasicMaterial({ color: 0x6a4bd0 }), 0, 0.38, 0.025); box(m, 0.56, 0.12, 0.004, 0xff4fa3, 0, 0.21, 0.026, GLOW(0xff4fa3)); box(m, 0.56, 0.04, 0.005, 0x2d1650, 0, 0.21, 0.027); ballM(m, 0.04, 0.04, 0.003, 0xffd27a, 0.14, 0.45, 0.027, GLOW(0xffd27a)); box(m, 0.16, 0.02, 0.005, 0x7bff5a, -0.17, 0.5, 0.027, GLOW(0x7bff5a)); box(m, 0.3, 0.012, 0.1, 0x17171c, 0, 0, 0.02); },
    gabinete: g => { box(g, 0.2, 0.42, 0.38, 0x15151a, 0, 0, 0); box(g, 0.012, 0.34, 0.3, 0x56d6ff, 0.101, 0.04, 0, GLOW(0x2a8aa0)); [0.1, 0.21, 0.32].forEach((y, i) => cylM(g, 0.045, 0.045, 0.012, [0xff4fa3, 0x56c8ff, 0x3aff9c][i], 0, y, 0.191, 'z', GLOW([0xff4fa3, 0x56c8ff, 0x3aff9c][i]))); },
    parlante: g => { cylM(g, 0.085, 0.085, 0.3, 0xe2341d, 0, 0.09, 0, 'x'); [-1, 1].forEach(sd => { cylM(g, 0.08, 0.08, 0.02, 0x1d1d23, sd * 0.155, 0.09, 0, 'x'); }); box(g, 0.2, 0.01, 0.1, 0x2c2c33, 0, 0, 0); },
    volante: g => { box(g, 0.24, 0.1, 0.2, 0x2a2a31, 0, 0, -0.04); const t = new T.Mesh(new T.TorusGeometry(0.13, 0.026, 8, 18), mat(0x1b1b20)); t.position.set(0, 0.2, 0.06); t.rotation.x = -0.35; g.add(t); const h = cylM(g, 0.04, 0.04, 0.03, 0xe10600, 0, 0.2, 0.06, 'z'); h.rotation.x = Math.PI / 2 - 0.35; const sp = box(g, 0.24, 0.03, 0.02, 0x8d9199, 0, 0.185, 0.06); sp.rotation.x = -0.35; },
    mic: g => { cylM(g, 0.09, 0.1, 0.02, 0x1d1d23, 0, 0, 0); cylM(g, 0.012, 0.012, 0.16, 0x55555f, 0, 0.02, 0); cylM(g, 0.05, 0.05, 0.16, 0x33333a, 0, 0.18, 0); cylM(g, 0.052, 0.052, 0.02, 0xe10600, 0, 0.25, 0); ballM(g, 0.05, 0.05, 0.05, 0x9aa0ad, 0, 0.34, 0); },
    ipad: g => { box(g, 0.14, 0.02, 0.12, 0xc5c9d2, 0, 0, -0.03); const t = new T.Group(); t.position.set(0, 0.02, 0); t.rotation.x = -0.3; g.add(t); box(t, 0.23, 0.32, 0.016, 0x2a2a31, 0, 0, 0); box(t, 0.2, 0.29, 0.004, 0x4a9cff, 0, 0.015, 0.009, GLOW(0x2a5a9a)); box(t, 0.2, 0.1, 0.005, 0xff4fa3, 0, 0.015, 0.0095, GLOW(0x8a2a5a)); },
    watch: g => { cylM(g, 0.07, 0.08, 0.02, 0xf4f6f9, 0, 0, 0); box(g, 0.05, 0.2, 0.03, 0xff7a45, 0, 0.02, 0); box(g, 0.09, 0.1, 0.045, 0x2a2a31, 0, 0.1, 0); box(g, 0.07, 0.08, 0.004, 0x7bff5a, 0, 0.11, 0.024, GLOW(0x2a8a2a)); },
    airpods: g => { box(g, 0.12, 0.09, 0.06, 0xf4f6f9, 0, 0, 0); box(g, 0.12, 0.012, 0.06, 0xc5c9d2, 0, 0.062, 0); [-1, 1].forEach(sd => { box(g, 0.02, 0.07, 0.02, 0xffffff, sd * 0.03, 0.09, 0); ballM(g, 0.022, 0.022, 0.022, 0xffffff, sd * 0.03, 0.17, 0); }); ballM(g, 0.008, 0.008, 0.004, 0x3bd24a, 0, 0.04, 0.031); },
    homepod: g => { ballM(g, 0.11, 0.1, 0.11, 0x2a2a31, 0, 0.1, 0); cylM(g, 0.06, 0.06, 0.006, 0x8a6bff, 0, 0.196, 0, null, GLOW(0x6a4bd0)); },
    magic: g => { ballM(g, 0.07, 0.028, 0.11, 0xfafbfc, 0, 0.026, 0); box(g, 0.2, 0.006, 0.26, 0xc5c9d2, 0, 0, 0); },
    gpu: g => { box(g, 0.1, 0.06, 0.1, 0x2c2c33, 0, 0, 0); const k = new T.Group(); k.position.y = 0.06; k.rotation.x = 0.5; g.add(k); box(k, 0.4, 0.05, 0.16, 0x1d1d23, 0, 0, 0); box(k, 0.4, 0.012, 0.03, 0xe10600, 0, 0.05, -0.065); [-0.13, 0, 0.13].forEach(x => cylM(k, 0.05, 0.05, 0.012, 0x0c0c10, x, 0.05, 0.01)); },
    ram: g => { [-0.03, 0.03].forEach((z, i) => { box(g, 0.32, 0.09, 0.014, 0x26262c, 0, 0.02, z); box(g, 0.32, 0.018, 0.016, i ? 0x56c8ff : 0xff4fa3, 0, 0.11, z, GLOW(i ? 0x56c8ff : 0xff4fa3)); }); box(g, 0.34, 0.02, 0.12, 0x2c2c33, 0, 0, 0); },
    disco: g => { box(g, 0.13, 0.025, 0.19, 0x23232a, 0, 0, 0); box(g, 0.05, 0.004, 0.02, 0xe10600, 0, 0.025, 0.06); ballM(g, 0.008, 0.004, 0.008, 0x56c8ff, 0.04, 0.027, -0.07, GLOW(0x56c8ff)); },
    impresora: g => { box(g, 0.36, 0.14, 0.28, 0xe6e9ee, 0, 0, 0); box(g, 0.36, 0.05, 0.284, 0x2a2a31, 0, 0, 0); const pp = box(g, 0.24, 0.006, 0.16, 0xffffff, 0, 0.17, -0.1); pp.rotation.x = -0.9; box(g, 0.24, 0.006, 0.12, 0xffffff, 0, 0.05, 0.18); box(g, 0.08, 0.04, 0.004, 0x56c8ff, -0.1, 0.08, 0.141, GLOW(0x2a7090)); },
    router: g => { box(g, 0.3, 0.05, 0.18, 0x1f1f25, 0, 0, 0); [-0.11, 0, 0.11].forEach(x => box(g, 0.016, 0.2, 0.016, 0x1b1b20, x, 0.05, -0.07)); [-0.08, -0.04, 0].forEach(x => ballM(g, 0.008, 0.008, 0.004, 0x3bd24a, x, 0.025, 0.091, GLOW(0x3bd24a))); },
    cargador: g => { box(g, 0.17, 0.05, 0.09, 0x23232a, 0, 0, 0); box(g, 0.09, 0.004, 0.05, 0xd6dbe3, -0.02, 0.05, 0); cylM(g, 0.008, 0.008, 0.14, 0x26262c, 0.15, 0.012, 0.02, 'x'); },
    notebook: g => { const k = new T.Group(); k.rotation.y = Math.PI / 2; g.add(k); notebook(k, 0, 0, 0); }
  };
  function model(parent, id, x, y, z, s, ry) {
    if (!MODELS[id]) return sprite(parent, id, x, y, z, 0.4 * (s || 1));
    const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry == null ? Math.PI / 4 : ry; g.scale.setScalar(s || 1); parent.add(g); MODELS[id](g); return g;
  }
  function sign(parent, text, w, h, x, y, z, ry) {
    return plane(parent, w, h, new T.MeshBasicMaterial({ map: textTex(text, { bg: '#e10600', fg: '#fff', w: 512, h: Math.round(512 * h / w) }) }), x, y, z, ry || 0);
  }
  const PRODUCT_COLORS = [0xffffff, 0xf2f2f2, 0x1a1a1a, 0xe10600, 0x16b8b0, 0x2d6cdf, 0x3bb54a, 0xf2f2f2, 0x222222, 0xff5fa2, 0xf5c518];
  const pc = () => U.pick(PRODUCT_COLORS);

  /* ---------- Muebles ---------- */
  const BLOCK = { x0: -11.5, x1: 14.6, z0: -10.2 }; let lotMat = null;      // la manzana del local
  function buildFloor(root) {
    const s = L.salon, zMax = L.galeria.zMax;
    const tile = canvasTex(128, 128, (g) => {
      g.fillStyle = '#e9e1d3'; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#bfb3a0'; g.lineWidth = 5; g.strokeRect(0, 0, 128, 128);
    });
    tile.wrapS = tile.wrapT = T.RepeatWrapping; tile.repeat.set(8, 12);
    const fw = s.xMax - s.xMin, fd = zMax - s.zMin;
    floorMat = new T.MeshLambertMaterial({ map: tile }); plane(root, fw, fd, floorMat, 0, 0, (s.zMin + zMax) / 2, 0, -Math.PI / 2);
    // base de maqueta + vereda
    box(root, fw + 1.2, 0.5, fd + 4.2, 0x18181b, 0, -0.52, (s.zMin + zMax) / 2 + 1.5);
    sky.side = new T.MeshLambertMaterial({ color: 0x8d8d92 }); sky.joint = new T.MeshLambertMaterial({ color: 0x77777c, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -6 });
    // La manzana: GameShop queda solo, entre cuatro calles. Vereda al frente, veredas más angostas a los costados y atrás, y un terreno prolijo alrededor del local.
    const B = BLOCK, bw = B.x1 - B.x0, bcx = (B.x0 + B.x1) / 2, zS = zMax + 4.05, sw = 1.9; lotMat = new T.MeshLambertMaterial({ color: 0x9a9da6, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: 24 });
    box(root, bw, 0.28, zMax + 0.2 - B.z0, lotMat, bcx, -0.31, (B.z0 + zMax + 0.2) / 2);                                                   // terreno
    box(root, bw, 0.32, 3.9, sky.side, bcx, -0.31, zMax + 2.05);                                                                             // vereda del frente
    box(root, bw, 0.3, sw, sky.side, bcx, -0.31, B.z0 + sw / 2); box(root, sw, 0.3, zMax - B.z0, sky.side, B.x0 + sw / 2, -0.31, (B.z0 + zMax) / 2); box(root, sw, 0.3, zMax - B.z0, sky.side, B.x1 - sw / 2, -0.31, (B.z0 + zMax) / 2);
    for (let x = B.x0 + 1.9; x < B.x1 - 0.5; x += 1.9) { box(root, 0.04, 0.012, 3.8, sky.joint, x, 0.005, zMax + 2.1); box(root, 0.04, 0.012, sw, sky.joint, x, -0.014, B.z0 + sw / 2); }
    for (let z = B.z0 + 1.9; z < zMax; z += 1.9) { box(root, sw, 0.012, 0.04, sky.joint, B.x0 + sw / 2, -0.014, z); box(root, sw, 0.012, 0.04, sky.joint, B.x1 - sw / 2, -0.014, z); }
    box(root, bw + 0.3, 0.26, 0.16, 0xc9c9ce, bcx, -0.3, zS + 0.01); box(root, bw + 0.3, 0.26, 0.16, 0xc9c9ce, bcx, -0.3, B.z0 - 0.08); box(root, 0.16, 0.26, zS - B.z0, 0xc9c9ce, B.x0 - 0.08, -0.3, (B.z0 + zS) / 2); box(root, 0.16, 0.26, zS - B.z0, 0xc9c9ce, B.x1 + 0.08, -0.3, (B.z0 + zS) / 2);    // cordón
    box(root, 230, 0.06, 3.4, 0x3c3c44, 0, -0.3, zMax + 5.8); for (let x = -90; x < 90; x += 3) box(root, 1.2, 0.1, 0.14, 0xe8e8e8, x, -0.3, zMax + 5.8);                 // calle del frente
    { const zb = B.z0 - 1.95, xw = B.x0 - 1.95, xe = B.x1 + 1.95, d = zMax + 4.1 - (zb - 1.7), zc = (zMax + 4.1 + zb - 1.7) / 2;                                             // y las otras tres
      box(root, xe - xw + 3.4, 0.06, 3.4, 0x3c3c44, (xw + xe) / 2, -0.3, zb); box(root, 3.4, 0.06, d, 0x3c3c44, xw, -0.3, zc); box(root, 3.4, 0.06, d, 0x3c3c44, xe, -0.3, zc);
      for (let x = xw + 3; x < xe - 2; x += 3) box(root, 1.2, 0.1, 0.14, 0xe8e8e8, x, -0.3, zb); for (let z = zb + 3; z < zMax + 3; z += 3) { box(root, 0.14, 0.1, 1.2, 0xe8e8e8, xw, -0.3, z); box(root, 0.14, 0.1, 1.2, 0xe8e8e8, xe, -0.3, z); } }
    // perímetro del local: cerco verde contra las paredes de atrás y del costado, estacionamiento y contenedores
    for (let z = s.zMin + 0.4; z < zMax - 0.5; z += 1.05) box(root, 0.55, 0.5, 0.95, 0x3f8f3a, s.xMin - 1.05, -0.015, z);
    for (let x = s.xMin - 0.5; x < 11.4; x += 1.05) box(root, 0.95, 0.5, 0.55, 0x3f8f3a, x, -0.015, s.zMin - 1.05);
    for (let z = -6; z <= 6.5; z += 2.5) box(root, 0.9, 0.012, 0.08, 0xf2f2f2, 12.25, -0.014, z); box(root, 0.08, 0.012, 12.6, 0xf2f2f2, 11.85, -0.014, 0.2);
    { const bin = (bx, bz, c, c2, ic) => { const g = new T.Group(); g.position.set(bx, -0.015, bz); root.add(g);
        const geo = new T.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2 * 0.84, 1, 4, 1); geo.rotateY(Math.PI / 4); const body = new T.Mesh(geo, mat(c, { flatShading: true })); body.scale.set(1.1, 1.0, 0.86); body.position.y = 0.64; g.add(body);
        box(g, 1.22, 0.07, 0.98, c2, 0, 1.13, 0); box(g, 1.06, 0.07, 0.82, c, 0, 1.2, 0); box(g, 0.86, 0.05, 0.66, c2, 0, 1.27, 0);                    /* tapa en escalones */
        box(g, 0.56, 0.05, 0.07, 0x16161a, 0, 1.13, 0.52); box(g, 0.9, 0.07, 0.07, 0x16161a, 0, 1.16, -0.5);                                             /* manija y bisagra */
        [-0.4, 0.4].forEach(dx => { const w = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 0.1, 12), mat(0x16161a)); w.rotation.z = Math.PI / 2; w.position.set(dx, 0.14, -0.32); g.add(w); box(g, 0.1, 0.14, 0.1, 0x16161a, dx, 0, 0.3); });
        const lb = new T.MeshBasicMaterial({ map: canvasTex(128, 128, (k, W) => { k.fillStyle = '#fff'; k.beginPath(); k.roundRect(4, 4, W - 8, W - 8, 22); k.fill(); k.fillStyle = '#' + c2.toString(16).padStart(6, '0'); k.beginPath(); k.roundRect(12, 12, W - 24, W - 24, 16); k.fill(); k.strokeStyle = k.fillStyle = '#fff'; k.lineCap = 'round'; k.translate(W / 2, W / 2);
          if (ic === 'r') for (let a = 0; a < 3; a++) { k.save(); k.rotate(a * 2.0944); k.lineWidth = 11; k.beginPath(); k.arc(0, 0, 30, -1.35, 0.25); k.stroke(); k.rotate(0.25); k.beginPath(); k.moveTo(30 - 15, -2); k.lineTo(30 + 15, -2); k.lineTo(30, 18); k.fill(); k.restore(); }
          else { k.fillRect(-30, -34, 60, 9); k.fillRect(-9, -42, 18, 9); k.beginPath(); k.moveTo(-25, -20); k.lineTo(25, -20); k.lineTo(19, 38); k.lineTo(-19, 38); k.fill(); k.strokeStyle = '#' + c2.toString(16).padStart(6, '0'); k.lineWidth = 5; [-10, 0, 10].forEach(x => { k.beginPath(); k.moveTo(x, -10); k.lineTo(x * 0.8, 28); k.stroke(); }); } }) });
        plane(g, 0.46, 0.46, lb, 0, 0.72, 0.414, 0, -0.07); plane(g, 0.4, 0.4, lb, 0.527, 0.72, 0, Math.PI / 2); };
      box(root, 3.5, 0.03, 1.5, 0xb9bcc2, 10.4, -0.015, 9.6); box(root, 3.5, 0.5, 0.1, 0x8d9199, 10.4, -0.015, 8.9);                                    /* base y murete */
      bin(9.55, 9.6, 0x2f8f4e, 0x1f6a37, 'r'); bin(11.25, 9.6, 0x2d6cdf, 0x1f4a9f, 't'); }
    [[13.5, zMax + 3.1], [-10.4, -3], [-10.4, 3.5], [-6, -9.3], [0, -9.3], [6, -9.3], [12, -9.3], [13.6, -9.3]].forEach((q, i) => { box(root, 1.1, 0.14, 1.1, 0x5a4634, q[0], 0.0, q[1]); const tr = new T.Mesh(new T.CylinderGeometry(0.13, 0.17, 1.9, 7), mat(0x6b4a2a)); tr.position.set(q[0], 1.0, q[1]); root.add(tr);
      const top = new T.Mesh(new T.SphereGeometry(1.0, 7, 5), mat(i % 2 ? 0x3c9a48 : 0x2f8a3f, { flatShading: true })); top.scale.y = 0.85; top.position.set(q[0], 2.5, q[1]); root.add(top); });
    // luz del local que sale a la vereda y dos faroles en las esquinas: se prenden cuando cae la tarde
    sky.spill = new T.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, depthWrite: false }); plane(root, fw - 0.6, 1.5, sky.spill, 0, 0.022, zMax + 0.85, 0, -Math.PI / 2);
    sky.bulb = new T.MeshBasicMaterial({ color: 0x55555c }); sky.halo = new T.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, depthWrite: false });
    sky.halo.map = canvasTex(128, 128, (c, W) => { const g = c.createRadialGradient(W / 2, W / 2, 2, W / 2, W / 2, W / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, W, W); });
    sky.cone = new T.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide });
    [-1, 1].forEach(sd => { const x = sd * (fw / 2 + 0.25), z = zMax + 2.65, dk = mat(0x1c1c20), hx = x - sd * 0.95;
      const cyl = (r1, r2, h, y, m) => { const c = new T.Mesh(new T.CylinderGeometry(r1, r2, h, 10), m || dk); c.position.set(x, y + h / 2, z); root.add(c); return c; };
      cyl(0.22, 0.28, 0.14, 0); cyl(0.12, 0.18, 0.52, 0.14); cyl(0.15, 0.15, 0.07, 0.66, mat(0xf5c518)); cyl(0.055, 0.08, 3.1, 0.73); cyl(0.09, 0.09, 0.08, 3.83, mat(0xf5c518));
      box(root, 1.1, 0.08, 0.08, dk, x - sd * 0.5, 3.72, z); const br = box(root, 0.6, 0.05, 0.05, dk, x - sd * 0.24, 3.46, z); br.rotation.z = sd * -0.75;                       /* brazo y tensor */
      box(root, 0.7, 0.12, 0.34, dk, hx, 3.58, z); box(root, 0.5, 0.08, 0.24, dk, hx, 3.7, z); box(root, 0.56, 0.05, 0.24, sky.bulb, hx, 3.535, z);                             /* cabezal y luz */
      box(root, 0.04, 0.95, 0.5, 0xe10600, x, 2.2, z + 0.34); box(root, 0.05, 0.05, 0.56, dk, x, 3.15, z + 0.3); box(root, 0.06, 0.2, 0.51, 0xffffff, x, 2.2, z + 0.34);       /* banderín */
      const cn = new T.Mesh(new T.ConeGeometry(1.7, 3.5, 20, 1, true), sky.cone); cn.position.set(hx, 1.78, z); root.add(cn);
      const h = new T.Mesh(new T.CircleGeometry(2.3, 24), sky.halo); h.rotation.x = -Math.PI / 2; h.position.set(hx, 0.024, z); root.add(h); });
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
  let lastUp = {}, roofOn = false; const pieces = {};
  function placePieces(lay) { GS.FLOOR.forEach((id, i) => { const k = pieces[id], sl = L.slots[lay && lay[id] != null ? lay[id] : i]; if (k && sl) k.position.set(sl.x, 0, sl.z); }); }
  function applyUpgrades(state) { lastUp = state; placePieces(state && state.lay); if (roofOn) return hideSign();
    for (const id in ups) for (const lvl in ups[id]) ups[id][lvl].visible = id === 'cartel' || id === 'flota' ? (state[id] || 0) === Number(lvl) : (state[id] || 0) >= Number(lvl);
  }
  function hideSign() { for (const id in ups) for (const lvl in ups[id]) if (id !== 'cartel') ups[id][lvl].visible = id === 'flota' ? (lastUp[id] || 0) === Number(lvl) : (lastUp[id] || 0) >= Number(lvl); else ups[id][lvl].visible = false; }      // con el techo puesto, el cartel del frente queda debajo
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
    /* Muebles de piso: cada uno se arma centrado en su propio grupo, con el frente hacia la puerta (+z), y se ubica en uno de los lugares del salón (L.slots). */
    const piece = id => { const g = upGroup(root, id, 1), k = new T.Group(); g.add(k); pieces[id] = k; return k; };
    { // isla Apple
      const k = piece('isla'), b = Batch(k), i = L.isla;
      box(k, i.w, i.h, i.d, 0xffffff, 0, 0, 0); box(k, i.w - 0.2, i.h - 0.3, 0.03, 0xe2e2e2, 0, 0.2, i.d / 2 + 0.01);
      idsOf('apple').forEach((id, n, a) => model(k, id, -(a.length - 1) * 0.2 + n * 0.4, i.h, n % 2 ? 0.14 : -0.14, 1.7));
      rail(k, 'APPLE', 0, i.d / 2, i.w, 'z'); b.build();
    }
    { // mesa de madera con PC y accesorios: del tamaño de la isla, con tres zonas que miran a la puerta (notebooks, puesto armado y componentes)
      const k = piece('mesa'), wood = 0xd9b77e, h = 0.9, w = 2.0, d = 0.95, Q = -Math.PI / 2;
      box(k, w, 0.09, d, wood, 0, h - 0.09, 0); [-1, 1].forEach(sd => box(k, 0.1, h - 0.09, d - 0.1, wood, sd * (w / 2 - 0.08), 0, 0)); box(k, w - 0.2, h - 0.09, 0.08, 0xc9a56b, 0, 0, -d / 2 + 0.1);
      /* pocos productos, grandes y con aire entre ellos: una notebook, un puesto con monitor y teclado, y un gabinete */
      const it = (id, x, z, sc, ry) => model(k, id, x, h, z, sc, ry || 0);
      { const n = new T.Group(); n.position.set(-0.66, h, -0.06); n.rotation.y = Q + 0.12; n.scale.setScalar(1.05); k.add(n); notebook(n, 0, 0, 0); }
      it('monitor', 0.04, -0.2, 1.75); it('teclado', 0.04, 0.2, 1.35); it('mouse', 0.42, 0.22, 1.3);
      it('gabinete', 0.76, -0.1, 1.6, Q);
      rail(k, 'PC Y ACCESORIOS', 0, d / 2, w, 'z');
    }
    { // escritorio gamer con monitor, teclado blanco y silla gris
      const e = L.escritorio, k0 = piece('escritorio');
      const k = new T.Group(); k.position.set(0, 0, -0.3); k0.add(k);                                             /* el frente del escritorio mira a +z, donde va la silla */
      box(k, e.w, 0.05, e.d, 0x17171c, 0, e.h - 0.05, 0); box(k, e.w, 0.02, 0.03, 0xff4fa3, 0, e.h - 0.07, e.d / 2 - 0.01, GLOW(0xff4fa3)); box(k, e.w - 0.1, 0.34, 0.03, 0x101014, 0, e.h - 0.4, -e.d / 2 + 0.05);
      [-1, 1].forEach(sd => { box(k, 0.06, e.h - 0.05, e.d - 0.12, 0x101014, sd * (e.w / 2 - 0.06), 0, 0); box(k, 0.1, 0.03, e.d, 0x101014, sd * (e.w / 2 - 0.06), 0, 0); });
      box(k, 1.0, 0.008, 0.42, 0x26262c, -0.12, e.h, 0.12); box(k, 1.0, 0.009, 0.02, 0x8a6bff, -0.12, e.h, 0.33, GLOW(0x8a6bff));                 /* pad XL */
      const mon = monitor(k, -0.12, e.h, -0.2, 0); mon.scale.setScalar(1.55);
      const screen = plane(mon, 0.56, 0.34, new T.MeshBasicMaterial({ color: 0x7be07b }), 0, 0.38, 0.025); animated.push({ type: 'screen', mesh: screen });
      box(k, 0.46, 0.028, 0.15, 0x17171c, -0.2, e.h + 0.008, 0.12); [0xff4fa3, 0x56c8ff, 0x3aff9c].forEach((c, i) => box(k, 0.42, 0.012, 0.03, c, -0.2, e.h + 0.036, 0.078 + i * 0.042, GLOW(c)));   /* teclado */
      ballM(k, 0.045, 0.032, 0.07, 0x1f1f25, 0.2, e.h + 0.035, 0.14); box(k, 0.01, 0.01, 0.04, 0x56e0ff, 0.2, e.h + 0.064, 0.12, GLOW(0x56e0ff));                                       /* mouse */
      [-0.62, 0.38].forEach(x => { box(k, 0.1, 0.2, 0.1, 0x1d1d23, x, e.h, -0.24); cylM(k, 0.035, 0.035, 0.01, 0x55555f, x, e.h + 0.11, -0.188, 'z'); });                                   /* parlantes */
      box(k, 0.2, 0.44, 0.4, 0x15151a, 0.64, e.h, -0.08); box(k, 0.012, 0.36, 0.32, 0x56d6ff, 0.539, e.h + 0.04, -0.08, GLOW(0x2a8aa0)); [0.1, 0.22, 0.34].forEach((y, i) => cylM(k, 0.05, 0.05, 0.012, [0xff4fa3, 0x56c8ff, 0x3aff9c][i], 0.64, e.h + y, 0.121, 'z', GLOW([0xff4fa3, 0x56c8ff, 0x3aff9c][i])));   /* gabinete con vidrio */
      cylM(k, 0.07, 0.08, 0.02, 0x1b1b20, -0.66, e.h, 0.18); cylM(k, 0.014, 0.014, 0.26, 0x2c2c33, -0.66, e.h + 0.02, 0.18); { const t = new T.Mesh(new T.TorusGeometry(0.09, 0.016, 6, 12, Math.PI), mat(0x1d1d23)); t.position.set(-0.66, e.h + 0.26, 0.18); k.add(t); [-1, 1].forEach(sd => cylM(k, 0.05, 0.05, 0.04, 0xe10600, -0.66 + sd * 0.095, e.h + 0.235, 0.18, 'x')); }   /* auriculares en su soporte */
      k0.userData.seats = [gamingChair(k, -0.12, e.d / 2 + 0.5, Math.PI, 0x17171c, 0xe10600)];
    }
    { // sillas gamer en exhibición, sobre una tarima
      const k = piece('sillas');
      box(k, 2.0, 0.05, 1.0, 0x17171c, 0, 0, 0); box(k, 2.0, 0.052, 0.05, 0xe10600, 0, 0, 0.475);
      k.userData.seats = [gamingChair(k, -0.48, 0, 0.18, 0x151515, 0xe10600), gamingChair(k, 0.5, 0, -0.22, 0x151515, 0x2d6cdf)]; k.userData.seats.forEach(c => { c.position.y = 0.05; });
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
    { /* rincón de la siesta: un cartón en el piso y unas cajas para recostarse */
      const n = new T.Group(); n.position.set(10.5, 0, -4.55); n.rotation.y = 0.5; root.add(n);
      box(n, 1.0, 0.03, 1.5, 0xb98d5e, 0, 0.02, 0.5); box(n, 0.96, 0.012, 0.04, 0x9a7446, 0, 0.05, 0.5); box(n, 0.9, 0.5, 0.5, 0xc49a6c, 0, 0, -0.42); box(n, 0.5, 0.36, 0.44, 0xb98d5e, -0.16, 0.5, -0.44); box(n, 0.9, 0.02, 0.06, 0x8a6a40, 0, 0.5, -0.42);
      const pl = box(n, 0.46, 0.12, 0.22, 0xf4f4f2, 0.2, 0.52, -0.3); pl.rotation.x = 0.5; const th = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.26, 10), mat(0xe10600)); th.position.set(-0.62, 0.13, 0.3); n.add(th); box(n, 0.09, 0.05, 0.09, 0x2c2c33, -0.62, 0.26, 0.3); }
    b.build();
  }
  function notebook(root, x, y, z) {          // abierta, con la pantalla mirando a la cámara
    box(root, 0.36, 0.03, 0.5, 0x2a2a2e, x, y, z); box(root, 0.24, 0.005, 0.4, 0x1a1a1e, x + 0.03, y + 0.03, z);
    const lid = new T.Group(); lid.position.set(x - 0.18, y + 0.03, z); lid.rotation.z = 0.28; root.add(lid);
    box(lid, 0.03, 0.34, 0.5, 0x2a2a2e, 0, 0, 0); box(lid, 0.012, 0.28, 0.44, 0x56d6ff, 0.02, 0.03, 0, { emissive: 0x2a8aa0 });
  }

  // Capa regional: misma base de local, con paleta, paisaje y fachada de cada región. stage 1..3 = humilde, mejorado, estrella.
  let floorMat = null, regG = null;
  // Estructura: una sola platea clara bajo todo el edificio (tapa las bases oscuras y las uniones entre ambientes), tabiques bajos en las juntas
  // y cierre de la vidriera. Del lado de la cámara los muros son bajos para no tapar el interior.
  function buildShell(root) {
    const s = L.salon, t = L.taller, zG = L.galeria.zMax, x1 = 11.4, wall = 0xf4f4f2, low = 0xdedede, glass = new T.MeshLambertMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.16, depthWrite: false });
    box(root, s.xMax - s.xMin + 0.5, 0.3, zG - s.zMin + 0.45, 0xcfd0d4, 0, -0.306, (s.zMin + zG) / 2); box(root, x1 + 0.35 - s.xMax, 0.3, t.zB + 0.35 - s.zMin + 0.2, 0xcfd0d4, (s.xMax + x1 + 0.35) / 2, -0.306, (s.zMin - 0.2 + t.zB + 0.35) / 2);      // platea
    box(root, 0.2, s.wallH, zG - s.zMax + 0.1, wall, s.xMin - 0.1, 0, (s.zMax + zG) / 2 + 0.05); box(root, 0.02, 0.9, zG - s.zMax, 0x16161a, s.xMin + 0.011, 0, (s.zMax + zG) / 2);                    // la pared del costado sigue hasta la vidriera
    box(root, 0.24, 0.34, 15.9, low, x1 + 0.1, 0, 0.7); [-7.1, t.zB + 0.1].forEach(z => box(root, 0.34, 0.5, 0.34, 0xbfc1c7, x1 + 0.1, 0, z));                                                       // muro bajo corrido del lado del estacionamiento
    box(root, x1 - 6.5, 0.36, 0.3, low, (6.5 + x1) / 2, 0, -1.05 + 0.02); box(root, x1 - 6.5, 0.36, 0.34, low, (6.5 + x1) / 2, 0, 3.775);                                                              // tabiques entre depósito, oficina y taller
    { const gz = (s.zMax + zG) / 2, gd = zG - s.zMax, gx = s.xMax + 0.15; glass.side = T.DoubleSide; glass.opacity = 0.3;                              // pared de la vidriera del lado del taller: media pared, vidrio con marco negro y dintel
      box(root, 0.3, 1.05, gd, wall, gx, 0, gz); box(root, 0.32, 0.3, gd + 0.02, 0x16161a, gx, 0, gz); box(root, 0.34, 0.08, gd, 0x0c0c0c, gx, 1.05, gz);
      plane(root, gd, 1.5, glass, gx, 1.88, gz, Math.PI / 2); box(root, 0.3, 0.14, gd, 0x0c0c0c, gx, 2.62, gz); [s.zMax + 0.1, gz, zG - 0.1].forEach(z => box(root, 0.16, 1.5, 0.16, 0x0c0c0c, gx, 1.13, z)); }
    // unión del salón con el depósito: un pilar que empalma las dos paredes del fondo, y el remate de la pared del depósito a la misma altura
    box(root, 0.55, s.wallH, 0.34, wall, s.xMax + 0.27, 0, s.zMin - 0.1); box(root, 0.6, 0.12, 0.4, 0xdcdcdc, s.xMax + 0.27, s.wallH, s.zMin - 0.1);
    box(root, x1 - 6.5 + 0.2, s.wallH - 2.6, 0.2, 0xd8d8d4, (6.5 + x1) / 2 + 0.1, 2.6, s.zMin - 0.1); box(root, 0.3, s.wallH, 0.3, 0xd8d8d4, x1 + 0.1, 0, s.zMin - 0.1);   // cierre de la vidriera del lado del taller: zócalo, vidrio y dintel
    box(root, 0.12, 0.012, s.zMax - s.zMin, 0x8d9199, s.xMax + 0.25, 0.006, (s.zMin + s.zMax) / 2);                                                                                                     // umbral metálico entre el salón y los ambientes
  }
  // Techo: aparece al alejar la cámara al máximo; al acercar apenas, se abre y se ve el interior
  let roofG = null, roofMats = [], critters = [];
  // Animales sueltos del paisaje: eligen un punto cercano fuera del local, caminan hasta ahí, esperan y vuelven a elegir
  function updateCritters(dt) {
    for (const c of critters) {
      const p = c.o.position, dx = c.tx - p.x, dz = c.tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.15) { c.wait -= dt; c.o.rotation.z = 0; if (c.wait <= 0) { for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28, r = 2 + Math.random() * 6, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r, R2 = Math.hypot(x, z); if (c.free(x, z) && c.free((x + p.x) / 2, (z + p.z) / 2) && R2 < 30 && R2 > 9) { c.tx = x; c.tz = z; break; } } c.wait = 1 + Math.random() * 5; } continue; }
      p.x += dx / d * c.sp * dt; p.z += dz / d * c.sp * dt; c.o.rotation.y = Math.atan2(dx, dz); c.ph += dt * (c.kind === 'p' ? 11 : 7); c.o.rotation.z = c.kind === 'p' ? Math.sin(c.ph) * 0.16 : 0; p.y = -0.3 + (c.kind === 's' ? Math.abs(Math.sin(c.ph)) * 0.05 : 0);
    }
  }
  function buildRoof(root) {
    const g = roofG = new T.Group(), s = L.salon, RM = (c, o) => { const m = new T.MeshLambertMaterial(Object.assign({ color: c, transparent: true }, o || {})); roofMats.push(m); return m; }; root.add(g); g.visible = false;
    const red = RM(0xc4452f, { flatShading: true }), top = RM(0x8f2f20), white = RM(0xf6f6f2), yellow = RM(0xf2c230), fascia = RM(0x9c2f20), light = RM(0xd7d9de), grey = RM(0x8d9199);
    // una mansarda: faldones inclinados hacia un techo plano, con nervaduras blancas que bajan hasta el alero
    const mansard = (cx, cz, w, d, y, h, k, ribs) => {
      box(g, w + 0.5, 0.2, d + 0.5, yellow, cx, y - 0.34, cz); box(g, w + 0.7, 0.16, d + 0.7, fascia, cx, y - 0.14, cz);
      const geo = new T.CylinderGeometry(Math.SQRT1_2 * k, Math.SQRT1_2, h, 4, 1); geo.rotateY(Math.PI / 4); const m = new T.Mesh(geo, [red, top, top]); m.scale.set(w + 0.7, 1, d + 0.7); m.position.set(cx, y + h / 2, cz); g.add(m);
      const W2 = (w + 0.7) / 2, D2 = (d + 0.7) / 2, beam = (ax, az, bx, bz) => { const a = new T.Vector3(cx + ax, y + 0.06, cz + az), b = new T.Vector3(cx + bx, y + h + 0.08, cz + bz), mm = new T.Mesh(new T.BoxGeometry(0.3, 0.26, a.distanceTo(b) + 0.5), white); mm.position.copy(a).add(b).multiplyScalar(0.5); mm.lookAt(b); g.add(mm); };
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(q => beam(q[0] * W2, q[1] * D2, q[0] * W2 * k, q[1] * D2 * k));                                   // limatesas
      for (let i = 1; i < ribs[0]; i++) { const t = (i / ribs[0] * 2 - 1) * W2; beam(t, D2, t * k, D2 * k); beam(t, -D2, t * k, -D2 * k); }
      for (let i = 1; i < ribs[1]; i++) { const t = (i / ribs[1] * 2 - 1) * D2; beam(W2, t, W2 * k, t * k); beam(-W2, t, -W2 * k, t * k); }
      { const tw = (w + 0.7) * k, td = (d + 0.7) * k; box(g, tw + 0.1, 0.1, td + 0.1, top, cx, y + h, cz); [[0, -td / 2, tw + 0.4, 0.3], [0, td / 2, tw + 0.4, 0.3], [-tw / 2, 0, 0.3, td + 0.4], [tw / 2, 0, 0.3, td + 0.4]].forEach(q => box(g, q[2], 0.2, q[3], white, cx + q[0], y + h, cz + q[1])); }                                                                 // borde blanco del techo plano
    };
    const y = s.wallH + 0.45, w = s.xMax - s.xMin + 0.4, zN = s.zMin - 0.2, zS = L.galeria.zMax + 0.4;
    mansard(0, (zN + zS) / 2, w, zS - zN, y, 1.9, 0.62, [4, 6]); mansard(8.95, 0.65, 5.2, 15.7, y - 0.5, 1.3, 0.55, [2, 5]);
    { const x1 = 11.4, t = L.taller, zG = L.galeria.zMax, hW = y - 0.84, hM = y - 0.34, wl = RM(0xf4f4f2), base = RM(0x2b2b31), band = RM(0xe10600), frame = RM(0x16161a), win = RM(0x9fd0ee), door = RM(0x5f6670), zA = s.zMin - 0.2, zB = t.zB + 0.35, zc = (zA + zB) / 2, xw = x1 + 0.13;
      box(g, 0.28, hW, zB - zA, wl, xw, 0, zc); box(g, 0.32, 0.42, zB - zA + 0.04, base, xw, 0, zc); box(g, 0.32, 0.14, zB - zA + 0.04, band, xw, hW - 0.5, zc);                      /* costado del estacionamiento */
      [-5.3, -2.9, 0.6, 5.0, 7.0].forEach(z => { box(g, 0.31, 1.12, 1.52, frame, xw, 0.98, z); box(g, 0.34, 0.96, 1.36, win, xw, 1.06, z); box(g, 0.36, 0.96, 0.06, frame, xw, 1.06, z); });
      box(g, 0.31, 2.06, 1.0, frame, xw, 0, 2.7); box(g, 0.34, 1.96, 0.86, door, xw, 0, 2.7);                                                                                     /* puerta de servicio */
      { const xa = s.xMax + 0.3, xb = x1 + 0.27, xc = (xa + xb) / 2, zw = zB - 0.13; box(g, xb - xa, hW, 0.28, wl, xc, 0, zw); box(g, xb - xa + 0.04, 0.42, 0.32, base, xc, 0, zw); box(g, xb - xa + 0.04, 0.14, 0.32, band, xc, hW - 0.5, zw);
        box(g, 2.9, 1.12, 0.31, frame, xc, 0.98, zw); box(g, 2.74, 0.96, 0.34, win, xc, 1.06, zw); box(g, 0.06, 0.96, 0.36, frame, xc, 1.06, zw); }                               /* frente del taller */
      box(g, 0.3, hM - 2.7, zG + 0.2 - zB, wl, s.xMax + 0.15, 2.7, (zB + zG + 0.2) / 2); box(g, s.xMax - s.xMin + 0.4, hM - 2.4, 0.3, frame, 0, 2.4, zG + 0.05); }                /* dinteles hasta el alero */
    [[-1.6, -2.4], [1.4, -2.4], [0, 4.6]].forEach(q => { box(g, 1.5, 0.6, 1.1, light, q[0], y + 1.97, q[1]); box(g, 1.0, 0.08, 0.7, grey, q[0], y + 2.57, q[1]); });     // equipos de aire arriba
    // Logo corpóreo: letras con volumen paradas sobre el faldón del frente. "Game" en negro y "Shop" en rojo.
    // Se arma con el logo real (misma tipografía): lo blanco pasa a negro, lo rojo queda rojo y el fondo negro se vuelve transparente.
    const logo = (side) => { const W = 1024, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const t = new T.CanvasTexture(c); t.anisotropy = 4;
      const paint = () => { const mk = () => { const o = document.createElement('canvas'); o.width = W; o.height = H; return o; }, o = mk(), og = o.getContext('2d'), iw = 940, ih = iw * logoImg.height / logoImg.width; og.drawImage(logoImg, (W - iw) / 2, (H - ih) / 2, iw, ih);
        const im = og.getImageData(0, 0, W, H), d = im.data; for (let k = 0; k < d.length; k += 4) { const a = Math.max(d[k], d[k + 1], d[k + 2]), wh = d[k + 1] > 110; d[k] = wh ? 20 : 225; d[k + 1] = wh ? 20 : 6; d[k + 2] = wh ? 22 : 0; d[k + 3] = a; } og.putImageData(im, 0, 0);
        const sil = mk(), sg = sil.getContext('2d'); sg.drawImage(o, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = side ? '#5a5d66' : '#ffffff'; sg.fillRect(0, 0, W, H);
        const g2 = c.getContext('2d'); g2.clearRect(0, 0, W, H); for (let a = 0; a < 16; a++) g2.drawImage(sil, Math.cos(a * 0.3927) * 7, Math.sin(a * 0.3927) * 7); g2.drawImage(o, 0, 0);
        if (side) { g2.globalCompositeOperation = 'source-atop'; g2.fillStyle = 'rgba(0,0,0,0.4)'; g2.fillRect(0, 0, W, H); g2.globalCompositeOperation = 'source-over'; } t.needsUpdate = true; };
      if (logoReady) paint(); else logoWaiters.push(paint); return t; };
    const lf = new T.MeshBasicMaterial({ map: logo(false), transparent: true, alphaTest: 0.08 }), ls = new T.MeshBasicMaterial({ map: logo(true), transparent: true, alphaTest: 0.08 }); roofMats.push(lf, ls);
    const lg = new T.Group(); lg.position.set(0, y + 1.55, zS - 2.5); lg.rotation.x = -0.85; g.add(lg);
    for (let i = 0; i < 18; i++) plane(lg, 11.6, 2.9, i === 17 ? lf : ls, 0, 0, i * 0.04);
    [-4, 0, 4].forEach(x => { const b = box(lg, 0.16, 0.16, 1.1, grey, x, -0.9, -0.5); });                                                                          // parantes
  }
  function setRegion(R, stage, flag) {
    if (regG) { scene.remove(regG); regG = null; } critters = [];
    lotMat.color.set({ ciudad: 0x9a9da6, cuyo: 0xbdb072, noa: 0xcfa678, nea: 0x5aa052, patagonia: 0x97b47e, malvinas: 0x88aa64 }[R && R.decor] || 0x9a9da6);
    floorMat.color.set(R && R.floor || 0xffffff); mat(0xf4f4f2).color.set(R && R.wall || 0xf4f4f2);
    if (!R || !R.decor) return;
    const g = regG = new T.Group(), s = L.salon, zF = L.galeria.zMax + 2.3, zB = s.zMin - 3.4, xW = s.xMin - 3.6; scene.add(g);
    const cone = (r, h, c, x, y, z, seg) => { const m = new T.Mesh(new T.ConeGeometry(r, h, seg || 6), mat(c)); m.position.set(x, y + h / 2, z); g.add(m); return m; };
    const cyl = (r, h, c, x, y, z) => { const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 8), mat(c)); m.position.set(x, y + h / 2, z); g.add(m); return m; };
    // Paisaje: terreno que se pierde en la bruma, cordones de cerros lejos del local (dos filas, tamaños distintos) y vegetación suelta
    let sd = R.id.length * 977 + 13; const rnd = () => (sd = (sd * 9301 + 49297) % 233280) / 233280, rr = (a, b) => a + rnd() * (b - a), GY = -0.3;
    const LAND = { cuyo: { ground: 0xc9a777, haze: 0xe9dcc6, patch: 0xb08f5c, h: [6, 13], wide: 1, bands: [[0.2, 0x93905c], [0.48, 0x8a7a6a], [0.72, 0xa0948a], [1, 0xffffff]] },
      noa: { ground: 0xd9a273, haze: 0xf1dcc4, patch: 0xc2875a, h: [4, 8.5], wide: 1.5, bands: [[0.15, 0xb5651d], [0.3, 0xc2452d], [0.44, 0xe08a3c], [0.58, 0xe3c34a], [0.72, 0x8e4a8f], [0.86, 0xd98a6a], [1, 0xf0d9c8]] },
      nea: { ground: 0xb85a34, haze: 0xdcc9a6, patch: 0x3c9447, h: [1.6, 3.0], wide: 1.5, bands: [[0.5, 0x2b8039], [1, 0x48ac58]] },
      ciudad: { ground: 0x7b7e86, haze: 0x9fb0c2, patch: 0x6f727a, h: [1, 2], wide: 1, bands: [[1, 0x777777]] },
      malvinas: { ground: 0x93ad6e, haze: 0xcfe0ea, patch: 0xb7c59a, h: [1.4, 2.8], wide: 1.9, bands: [[0.55, 0x7f9a5c], [0.85, 0x8c8f88], [1, 0xa9aca6]] },
      patagonia: { ground: 0xa7b68e, haze: 0xe2ecf3, patch: 0xf2f6f8, h: [7, 14], wide: 1, bands: [[0.18, 0x2f6b45], [0.44, 0x6f7f95], [0.66, 0xa3b3c6], [1, 0xffffff]] } }[R.decor];
    const free = (x, z) => !(x > -15.3 && x < 18.4 && z > -14.0 && z < zF + 5.4) && !(z > zF - 2.8 && z < zF + 5.4), col = new T.Color();
    { const d = new T.Mesh(new T.CircleGeometry(42, 40), new T.MeshBasicMaterial({ color: LAND.ground })); d.rotation.x = -Math.PI / 2; d.position.y = GY; g.add(d);
      const rg = new T.RingGeometry(41.8, 110, 40, 1), p = rg.attributes.position, cs = []; for (let i = 0; i < p.count; i++) { col.set(Math.hypot(p.getX(i), p.getY(i)) < 60 ? LAND.ground : LAND.haze); cs.push(col.r, col.g, col.b); }
      rg.setAttribute('color', new T.Float32BufferAttribute(cs, 3)); const m = new T.Mesh(rg, new T.MeshBasicMaterial({ vertexColors: true })); m.rotation.x = -Math.PI / 2; m.position.y = GY; g.add(m);
      for (let i = 0; i < 22; i++) { const a = rr(0, 6.28), r = rr(11, 38), x = Math.cos(a) * r, z = Math.sin(a) * r; if (!free(x, z)) continue; const c = new T.Mesh(new T.CircleGeometry(rr(1.2, 3.4), 9), new T.MeshBasicMaterial({ color: LAND.patch, transparent: true, opacity: 0.55, depthWrite: false })); c.rotation.x = -Math.PI / 2; c.scale.y = rr(0.5, 1); c.rotation.z = rr(0, 3); c.position.set(x, GY + 0.02, z); g.add(c); }
}
    const mtnMat = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const mts = [], RX0 = -16.6, RX1 = 19.8, RZ0 = -15.4, RZ1 = zF + 5.6, hitsRoad = (x, z, R) => { const dx = Math.max(RX0 - x, 0, x - RX1), dz = Math.max(RZ0 - z, 0, z - RZ1); return dx * dx + dz * dz < R * R || (z + R > zF + 1.4 && z - R < zF + 5.6); };
    const clear = (x, z, pad) => free(x, z) && !mts.some(m => Math.hypot(x - m[0], z - m[1]) < m[2] + (pad || 0));
    const mountain = (x, z, r, h) => {
      const R = r * 1.55, hitsHome = () => homes.some(q => Math.hypot(x - q[0], z - q[1]) < R + 2.4) || wat.some(q => Math.hypot(x - q[0], z - q[1]) < R + q[2]); for (let i = 0; i < 60 && (hitsRoad(x, z, R) || hitsHome()); i++) { x *= 1.06; z = z > zF ? z + 1 : z * 1.06 - (Math.abs(z) < 1 ? 1 : 0); } if (hitsRoad(x, z, R) || hitsHome()) return; mts.push([x, z, R * 0.8]);
      const geo = new T.ConeGeometry(r, h, 9, 6), p = geo.attributes.position, cs = [], seed = rr(0, 99);
      for (let i = 0; i < p.count; i++) { const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), t = (py + h / 2) / h, q = Math.sin(px * 12.9898 + pz * 78.233 + py * 37.719 + seed) * 43758.5453, j = q - Math.floor(q) - 0.5;
        if (t > 0.02 && t < 0.98) { p.setX(i, px * (1 + j * 0.5)); p.setZ(i, pz * (1 + j * 0.5)); p.setY(i, py + j * h * 0.07); }
        let b = LAND.bands[LAND.bands.length - 1]; for (const k of LAND.bands) if (t <= k[0] + j * 0.1) { b = k; break; } col.set(b[1]); col.offsetHSL(0, 0, j * 0.07); cs.push(col.r, col.g, col.b); }
      geo.setAttribute('color', new T.Float32BufferAttribute(cs, 3)); geo.computeVertexNormals(); const m = new T.Mesh(geo, mtnMat); m.position.set(x, GY + h / 2 - 0.1, z); m.scale.z = rr(0.75, 1.25); m.rotation.y = rr(0, 6.28); g.add(m);
    };
    const land = () => {
      [[21, 25, R.decor === 'nea' ? 3 : 4, 0.55, 0.75], [29, 38, R.decor === 'nea' ? 4 : 7, 0.85, 1.0]].forEach(row => { for (let i = 0; i < row[2]; i++) { const a = Math.PI * (0.9 + 0.78 * (i + rr(0.1, 0.9)) / row[2]), d = rr(row[0], row[1]), h = rr(LAND.h[0], LAND.h[1]) * rr(row[3], row[4]); mountain(Math.cos(a) * d, Math.sin(a) * d, h * rr(0.55, 0.8) * LAND.wide, h); } });
      for (let i = 0; i < 3; i++) { const a = Math.PI * rr(0.95, 1.6), d = rr(18.5, 20.5), h = rr(1.0, 1.9); mountain(Math.cos(a) * d, Math.sin(a) * d, h * 1.5 * LAND.wide, h); }          // lomas cercanas
    };
    const scatter = (n, fn, r0, r1) => { for (let i = 0, k = 0; i < n && k < n * 6; k++) { const a = rr(0, 6.28), r = rr(r0 || 10.5, r1 || 30), x = Math.cos(a) * r, z = Math.sin(a) * r; if (!clear(x, z, 0.4)) continue; fn(x, z, rr(0.75, 1.3)); i++; } };
    const cactus = (x, z, k) => { cyl(0.2 * k, 1.7 * k, 0x3f8f3a, x, GY, z); cyl(0.12 * k, 0.7 * k, 0x3f8f3a, x + 0.36 * k, GY + 0.8 * k, z); box(g, 0.3 * k, 0.12, 0.12, 0x3f8f3a, x + 0.2 * k, GY + 0.8 * k, z); cyl(0.12 * k, 0.55 * k, 0x3f8f3a, x - 0.36 * k, GY + 0.55 * k, z); box(g, 0.3 * k, 0.12, 0.12, 0x3f8f3a, x - 0.2 * k, GY + 0.55 * k, z); };
    const pine = (x, z, k) => { cyl(0.12 * k, 0.5, 0x6b4a2a, x, GY, z); [0, 1, 2].forEach(i => cone((0.7 - i * 0.17) * k, 0.9 * k, i === 2 && R.decor === 'patagonia' ? 0xeaf2f4 : 0x1f6a3a, x, GY + 0.4 + i * 0.55 * k, z, 7)); };
    const bush = (x, z, k, c) => { const m = new T.Mesh(new T.SphereGeometry(0.6 * k, 7, 5), mat(c || 0x4d9a4a, { flatShading: true })); m.position.set(x, GY + 0.3 * k, z); m.scale.y = 0.7; g.add(m); };
    const tree = (x, z, k) => { cyl(0.16 * k, 1.4 * k, 0x6b4a2a, x, GY, z); const m = new T.Mesh(new T.SphereGeometry(0.95 * k, 7, 5), mat(rnd() < 0.5 ? 0x2b8039 : 0x3c9a48, { flatShading: true })); m.position.set(x, GY + 1.9 * k, z); g.add(m); };
    // Viviendas: cada región con su estilo y su densidad. Se ubican fuera de las calles y de los cerros, sin encimarse.
    const homes = [], house = (x, z, o, ry) => { const hg = new T.Group(); hg.position.set(x, GY, z); hg.rotation.y = ry + rr(-0.05, 0.05); g.add(hg); const w = rr(o.w[0], o.w[1]), d = rr(o.d[0], o.d[1]), h = rr(o.h[0], o.h[1]), wc = o.walls[Math.floor(rnd() * o.walls.length)], rc = o.roofs[Math.floor(rnd() * o.roofs.length)];
      box(hg, w, h, d, wc, 0, 0, 0); box(hg, 0.5, 0.9, 0.06, 0x4a3524, 0, 0, d / 2 + 0.01); [-1, 1].forEach(sd => box(hg, 0.5, 0.45, 0.06, 0x7fd4ff, sd * w * 0.3, h * 0.45, d / 2 + 0.01));
      if (o.roof === 'plano') { box(hg, w + 0.2, 0.18, d + 0.2, rc, 0, h, 0); if (o.parra && rnd() < 0.6) { [-1, 1].forEach(sd => box(hg, 0.1, h, 0.1, 0x6b4a2a, sd * w * 0.45, 0, d / 2 + 1.1)); box(hg, w, 0.14, 1.3, 0x3f8f3a, 0, h, d / 2 + 0.6); } }
      else { const rf = new T.Mesh(new T.ConeGeometry(Math.SQRT1_2, 1, 4), mat(rc, { flatShading: true })); rf.rotation.y = Math.PI / 4; rf.scale.set(w + 0.5, h * o.pitch, d + 0.5); rf.position.y = h + h * o.pitch / 2; hg.add(rf); if (o.snow) { const sn = new T.Mesh(new T.ConeGeometry(Math.SQRT1_2, 1, 4), mat(0xffffff, { flatShading: true })); sn.rotation.y = Math.PI / 4; sn.scale.set((w + 0.5) * 0.62, h * o.pitch * 0.62, (d + 0.5) * 0.62); sn.position.y = h + h * o.pitch * 0.69 + 0.03; hg.add(sn); } }
      if (o.chimney) box(hg, 0.34, h * o.pitch * 0.8 + 0.5, 0.34, 0x7a5a48, w * 0.28, h, -d * 0.2); if (o.stilts) box(hg, w + 0.6, 0.12, d + 1.2, 0x8a6b4a, 0, 0, 0.3); };
    const village = (n, o) => {            // barrio: lotes a los dos lados de cada calle, con el frente (y la puerta) hacia ella; se ocupan primero los más cercanos al local
      const town = n > 8, ZF2 = L.galeria.zMax + 5.8, VX = town ? [XW - 14, XW, XE, XE + 14] : [XW, XE], HZ = town ? [ZB - 14, ZB, ZF2, ZF2 + 14] : [ZB, ZF2], slots = [];
      if (town) { roads(50); [VX[0], VX[3]].forEach(x => street(x, -6, 3.4, 88)); [HZ[0], HZ[3]].forEach(z => street(0, z, 100, 3.4)); }
      const ok = (x, z) => [[0, 0], [2.3, 2.3], [-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3]].every(q => free(x + q[0], z + q[1])) && !mts.some(m => Math.hypot(x - m[0], z - m[1]) < m[2] + 2.4) && !VX.some(v => Math.abs(x - v) < 3.9) && !HZ.some(h => Math.abs(z - h) < 3.9);
      for (let t = -45; t <= 45; t += 5.3) { VX.forEach(v => [-1, 1].forEach(sd => { const x = v + sd * 4.4, z = t + 1; if (z < 38 && ok(x, z)) slots.push([x, z, sd > 0 ? -Math.PI / 2 : Math.PI / 2]); })); HZ.forEach(h => [-1, 1].forEach(sd => { const x = t, z = h + sd * 4.4; if (ok(x, z)) slots.push([x, z, sd > 0 ? Math.PI : 0]); })); }
      slots.forEach(q => { q[3] = Math.hypot(q[0] - 1.5, q[1] - 1) + rr(0, town ? 7 : 18); }); slots.sort((a, b) => a[3] - b[3]); let put = 0;
      for (const q of slots) { if (put >= n) break; if (homes.some(hm => Math.hypot(q[0] - hm[0], q[1] - hm[1]) < 4.7)) continue; const two = town && rnd() < 0.2; homes.push([q[0], q[1]]); mts.push([q[0], q[1], 2.6]); put++; house(q[0], q[1], two ? Object.assign({}, o, { h: [o.h[0] * 1.9, o.h[1] * 1.9], pitch: (o.pitch || 0.4) * 0.55 }) : o, q[2]); } };
    const street = (x, z, w, d) => { box(g, w, 0.05, d, 0x3c3c44, x, GY, z); const n = Math.floor(Math.max(w, d) / 3); for (let i = 0; i < n; i++) box(g, w > d ? 1.2 : 0.14, 0.1, w > d ? 0.14 : 1.2, 0xe8e8e8, w > d ? x - w / 2 + 1.5 + i * 3 : x, GY, w > d ? z : z - d / 2 + 1.5 + i * 3); };
    const XW = BLOCK.x0 - 1.95, XE = BLOCK.x1 + 1.95, ZB = BLOCK.z0 - 1.95, ZS = L.galeria.zMax + 7.5;
    const roads = far => { const seg = (a, b, fixed, alongX) => { if (b - a < 2) return; alongX ? street((a + b) / 2, fixed, b - a, 3.4) : street(fixed, (a + b) / 2, 3.4, b - a); };     // siguen las calles de la manzana sin encimarse con ellas
      seg(-far, XW - 1.7, ZB, true); seg(XE + 1.7, far, ZB, true); [XW, XE].forEach(x => { seg(-far, ZB - 1.7, x, false); seg(ZS, far * 0.75, x, false); }); };
    const wat = [], water = (x, z, w, d, ry) => { for (let t = -1; t <= 1.001; t += Math.min(1, d / w)) { const c = [x + Math.cos(ry || 0) * w * t * 0.92, z - Math.sin(ry || 0) * w * t * 0.92, d + 1.2]; wat.push(c); mts.push(c); } const m = new T.Mesh(new T.CircleGeometry(1, 20), new T.MeshBasicMaterial({ color: 0x4aa3d8 })); m.rotation.x = -Math.PI / 2; m.rotation.z = ry || 0; m.scale.set(w, d, 1); m.position.set(x, GY + 0.03, z); g.add(m); };
    // Tótem de la sucursal: cantero, dos parantes y un cartel de dos caras, a un costado del frente para no tapar nada
    const totem = new T.Group(); totem.position.set(-9.3, 0, zF - 1.0); totem.rotation.y = 0.5; g.add(totem);
    { const gold = mat(0xf5c518), gold2 = mat(0xb8860b);
      box(totem, 4.3, 0.34, 1.3, 0x2b2b31, 0, 0, 0); box(totem, 3.9, 0.2, 0.94, 0x3f8f3a, 0, 0.34, 0);                                              /* cantero */
      [-1.7, -0.55, 0.55, 1.7].forEach(x => { const b = new T.Mesh(new T.SphereGeometry(0.26, 7, 5), mat(0x2f8a3f, { flatShading: true })); b.scale.y = 0.75; b.position.set(x, 0.62, 0.3); totem.add(b); });
      [-1.15, 1.15].forEach(x => { box(totem, 0.4, 0.9, 0.34, 0x16161a, x, 0.5, 0); box(totem, 0.48, 0.08, 0.42, gold, x, 0.56, 0); });                 /* patas */
      box(totem, 4.0, 2.3, 0.3, 0x0a0a0c, 0, 1.4, 0);                                                                                                /* placa negra */
      box(totem, 4.2, 0.12, 0.36, gold, 0, 3.69, 0); box(totem, 4.2, 0.12, 0.36, gold2, 0, 1.3, 0); [-2.04, 2.04].forEach(x => box(totem, 0.12, 2.5, 0.36, gold, x, 1.3, 0));
      const tx = logoTex(760, 430, (c, W, H, img) => { c.fillStyle = '#0a0a0c'; c.fillRect(0, 0, W, H); const iw = 500, ih = iw * img.height / img.width; c.drawImage(img, (W - iw) / 2, 22, iw, ih);
        c.textAlign = 'center'; c.textBaseline = 'middle'; const sub = R.id === 'pampeana' ? 'CASA CENTRAL' : 'SUCURSAL ' + R.name.toUpperCase();
        c.font = '900 30px "Arial Black", "Helvetica Neue", Arial, sans-serif'; try { c.letterSpacing = '9px'; } catch (e) {} const tw = c.measureText(sub).width; c.fillStyle = '#fff'; c.fillText(sub, W / 2 + 4, 186);
        c.fillStyle = '#e10600'; c.fillRect(46, 183, (W - 92 - tw) / 2 - 22, 6); c.fillRect(W / 2 + tw / 2 + 22, 183, (W - 92 - tw) / 2 - 22, 6); try { c.letterSpacing = '2px'; } catch (e) {}
        const gd = c.createLinearGradient(0, 226, 0, 346); gd.addColorStop(0, '#fff3b0'); gd.addColorStop(0.5, '#f5c518'); gd.addColorStop(1, '#b8860b'); c.font = '900 124px Impact, "Arial Narrow", sans-serif'; c.fillStyle = '#000'; c.fillText(R.city.toUpperCase(), W / 2 + 3, 296, W - 70); c.fillStyle = gd; c.fillText(R.city.toUpperCase(), W / 2, 290, W - 70);
        try { c.letterSpacing = '1px'; } catch (e) {} c.font = '700 28px system-ui, sans-serif'; c.fillStyle = '#fff'; c.fillText('www.gameshop.com.ar', W / 2, 392); }), tm = new T.MeshBasicMaterial({ map: tx });
      plane(totem, 3.86, 2.18, tm, 0, 2.55, 0.16); plane(totem, 3.86, 2.18, tm, 0, 2.55, -0.16, Math.PI); }
    if (R.decor === 'cuyo') { village(36, { w: [2.6, 3.6], d: [2.4, 3.2], h: [1.5, 1.9], walls: [0xd9b38c, 0xc9a37a, 0xe6d3b3, 0xb5651d], roofs: [0xb0563a, 0x9c8b78, 0xc9a777], roof: 'plano', parra: true }); land(); scatter(16, (x, z, k) => bush(x, z, k, 0x8d9a4c));         // casas bajas de adobe, algunas con parral
      for (let v = 0, k = 0; v < 2 && k < 60; k++) { const a = rr(0, 6.28), r = rr(20, 30), vx = Math.cos(a) * r, vz = Math.sin(a) * r; if (![[0, 0], [3, 0], [-3, 0], [0, 2.5], [0, -2.5], [3, 2.5], [-3, -2.5]].every(q => clear(vx + q[0], vz + q[1], 1.2))) continue; mts.push([vx, vz, 4.5]); v++; const ang = rr(0, 3.1), ca = Math.cos(ang), sa = Math.sin(ang);
        for (let r2 = 0; r2 < 5; r2++) { const len = Math.round(rr(4, 7)); for (let i2 = 0; i2 < len; i2++) { const lx = (i2 - len / 2) * rr(0.8, 1.0), lz = (r2 - 2) * 1.15 + rr(-0.08, 0.08), X = vx + lx * ca - lz * sa, Z = vz + lx * sa + lz * ca; bush(X, Z, rr(0.5, 0.72), rnd() < 0.3 ? 0x4f9a3f : 0x3f8f3a); if (i2 % 3 === 0) cyl(0.05, 0.8, 0x6b4a2a, X, GY, Z); } } }      // viñedo
      [[-2.6, 0], [-1.9, 0.5]].forEach(q => { cyl(0.36, 0.8, 0x7a4a22, q[0], 0, zF + q[1]); cyl(0.38, 0.08, 0x2b2b2b, q[0], 0.2, zF + q[1]); cyl(0.38, 0.08, 0x2b2b2b, q[0], 0.55, zF + q[1]); });
      [1.6, 2.4, 3.2].forEach(x => { box(g, 0.08, 1.2, 0.08, 0x6b4a2a, x, 0, zF + 0.6); box(g, 0.7, 0.5, 0.4, 0x3f8f3a, x, 0.9, zF + 0.6); box(g, 0.16, 0.2, 0.16, 0x6a2d7a, x + 0.1, 0.72, zF + 0.75); }); }
    if (R.decor === 'noa') { village(32, { w: [2.6, 3.6], d: [2.4, 3.2], h: [1.5, 1.9], walls: [0xf4efe6, 0xf7f2e8, 0xe9dcc6], roofs: [0xb5482f, 0xa33d28], roof: 'tejas', pitch: 0.45 }); land();       // casas coloniales blancas con techo de tejas
      scatter(14, cactus); scatter(10, (x, z, k) => bush(x, z, k * 0.7, 0x9a8a4a)); [[-2.4, 0.2], [1.8, 0.6], [3.4, 0.1]].forEach(q => { cyl(0.2, 1.7, 0x3f8f3a, q[0], 0, zF + q[1]); cyl(0.12, 0.7, 0x3f8f3a, q[0] + 0.36, 0.8, zF + q[1]); box(g, 0.3, 0.12, 0.12, 0x3f8f3a, q[0] + 0.2, 0.8, zF + q[1]); cyl(0.12, 0.55, 0x3f8f3a, q[0] - 0.36, 0.55, zF + q[1]); box(g, 0.3, 0.12, 0.12, 0x3f8f3a, q[0] - 0.2, 0.55, zF + q[1]); }); }
    if (R.decor === 'nea') { water(-46, -44, 30, 2.4, 0.5); water(14, -52, 30, 2.8, -0.15); village(28, { w: [2.6, 3.4], d: [2.4, 3.0], h: [1.4, 1.8], walls: [0x4f9ad6, 0xe3c34a, 0xd9683c, 0x5fb37a, 0xf4efe6], roofs: [0x9aa3ad, 0x7d8894, 0xa33d28], roof: 'chapa', pitch: 0.35, stilts: true }); land();       // casas de madera de colores con techo de chapa y galería
      scatter(34, tree, 11, 34); scatter(12, (x, z, k) => bush(x, z, k)); [[-19, -17], [-21, -6], [-20, 4], [-10, -19], [-2, -18], [7, -18], [-24, -12]].forEach(q => { cyl(0.22, 3.4, 0x7a5a36, q[0], -0.5, q[1]); for (let k = 0; k < 6; k++) { const l = box(g, 1.7, 0.08, 0.42, 0x2f9a48, q[0] + Math.cos(k) * 0.7, 2.86, q[1] + Math.sin(k) * 0.7); l.rotation.y = -k; l.rotation.z = -0.35; } });
      [[-2.4, 0.2], [2.2, 0.5]].forEach(q => { cyl(0.16, 2.2, 0x7a5a36, q[0], 0, zF + q[1]); for (let k = 0; k < 6; k++) { const l = box(g, 1.2, 0.06, 0.32, 0x2f9a48, q[0] + Math.cos(k) * 0.5, 2.16, zF + q[1] + Math.sin(k) * 0.5); l.rotation.y = -k; l.rotation.z = -0.35; } }); }
    if (R.decor === 'ciudad') {                       // Buenos Aires: manzanas con edificios hacia el fondo, calles que cruzan, el Obelisco a lo lejos y una plaza enfrente
      const wt = [4, 7, 11].map((rows, i) => canvasTex(96, 32 * rows, (c, W, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); for (let y = 0; y < rows; y++) for (let x = 0; x < 4; x++) { c.fillStyle = rnd() < 0.28 ? '#ffe9a8' : '#3a4656'; c.fillRect(8 + x * 22, 8 + y * 32, 14, 18); } }));
      const cols = [0xb9a58c, 0x9aa3ad, 0xc9b9a3, 0x8f9aa8, 0xb38a72, 0xd6cfc2, 0x7f8c99], bm = {};
      const building = (x, z, w, d, h) => { const k = h < 5 ? 0 : h < 9 ? 1 : 2, c = cols[Math.floor(rnd() * cols.length)], key = k + '_' + c; bm[key] = bm[key] || new T.MeshLambertMaterial({ map: wt[k], color: c }); box(g, w, h, d, bm[key], x, -0.02, z); box(g, w + 0.25, 0.22, d + 0.25, 0x3a3d45, x, h - 0.02, z); if (rnd() < 0.6) box(g, 0.9, 0.7, 0.9, 0x8d9199, x + rr(-0.6, 0.6), h + 0.2, z + rr(-0.6, 0.6)); };
      const ZF2 = L.galeria.zMax + 5.8, VX = [-52.5, -33, XW, XE, 36], HZ = [-52, -33, ZB, ZF2, ZF2 + 19];
      roads(115); [VX[0], VX[1], VX[4]].forEach(x => street(x, -20, 3.4, 160)); [HZ[0], HZ[1], HZ[4]].forEach(z => street(0, z, 230, 3.4));
      for (let a = 0; a < VX.length - 1; a++) for (let b = 0; b < HZ.length - 1; b++) { if (a === 2 && b === 2) continue;                    // la del medio es la de GameShop
        const x0 = VX[a] + 1.75, x1 = VX[a + 1] - 1.75, z0 = HZ[b] + 1.75, z1 = HZ[b + 1] - 1.75, bw = x1 - x0, bd = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, near = b === 3 || a === 3;       // del lado de la cámara, construcciones bajas
        box(g, bw, 0.3, bd, sky.side, cx, -0.31, cz); box(g, bw + 0.3, 0.26, bd + 0.3, 0xc9c9ce, cx, -0.32, cz);                                                                                  // vereda y cordón de la manzana
        if (a === 2 && b === 3) {                                                                                                                                                                 // la plaza: ocupa su manzana entera
          box(g, bw - 2.4, 0.06, bd - 2.4, 0x5f9e55, cx, -0.01, cz); box(g, bw - 2.4, 0.07, 1.3, 0xd9cfb8, cx, -0.01, cz); box(g, 1.3, 0.07, bd - 2.4, 0xd9cfb8, cx, -0.01, cz);
          cyl(1.9, 0.08, 0xd9cfb8, cx, 0.0, cz); cyl(1.2, 0.34, 0xb9bcc4, cx, 0.05, cz); cyl(1.0, 0.38, 0x4aa3d8, cx, 0.05, cz); cyl(0.12, 1.0, 0xb9bcc4, cx, 0.05, cz);
          for (let tx = x0 + 2.6; tx <= x1 - 2.4; tx += 3.6) for (let tz = z0 + 2.6; tz <= z1 - 2.4; tz += 3.5) { if (Math.abs(tx - cx) < 1.6 || Math.abs(tz - cz) < 1.6) continue; cyl(0.14, 1.3, 0x6b4a2a, tx, 0.04, tz); const m = new T.Mesh(new T.SphereGeometry(0.95, 7, 5), mat(rnd() < 0.5 ? 0x2b8039 : 0x3c9a48, { flatShading: true })); m.position.set(tx, 1.9, tz); g.add(m); }
          [[-3.2, -1.1], [3.2, -1.1], [-3.2, 1.1], [3.2, 1.1]].forEach(q => { box(g, 1.3, 0.12, 0.4, 0x7a5a36, cx + q[0], 0.3, cz + q[1]); box(g, 0.1, 0.3, 0.4, 0x2b2b31, cx + q[0] - 0.5, 0.04, cz + q[1]); box(g, 0.1, 0.3, 0.4, 0x2b2b31, cx + q[0] + 0.5, 0.04, cz + q[1]); });      // bancos
          continue; }
        if (a === 1 && b === 1) { cyl(5.2, 0.06, 0xd9cfb8, cx, 0.0, cz); box(g, 1.6, 14, 1.6, 0xf4f4f2, cx, 0.02, cz); const tip = cone(1.13, 1.9, 0xf4f4f2, cx, 14.02, cz, 4); tip.rotation.y = Math.PI / 4;                 // la plaza del Obelisco
          [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, -7], [0, 7], [-7, 0], [7, 0]].forEach(q => { if (Math.abs(q[0]) > bw / 2 - 1.5 || Math.abs(q[1]) > bd / 2 - 1.5) return; cyl(0.14, 1.3, 0x6b4a2a, cx + q[0], 0.02, cz + q[1]); const m = new T.Mesh(new T.SphereGeometry(0.9, 7, 5), mat(0x3c9a48, { flatShading: true })); m.position.set(cx + q[0], 1.9, cz + q[1]); g.add(m); }); continue; }
        const nx = Math.max(1, Math.round((bw - 1.8) / 5)), nz = Math.max(1, Math.round((bd - 1.8) / 5)), sx = (bw - 1.8) / nx, sz = (bd - 1.8) / nz;                                              // edificada completa, sin baldíos
        for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) { const px = x0 + 0.9 + (ix + 0.5) * sx, pz = z0 + 0.9 + (iz + 0.5) * sz, far = Math.max(0, -pz - 14) * 0.2 + Math.max(0, -px - 14) * 0.16; building(px, pz, sx - rr(0.5, 0.9), sz - rr(0.5, 0.9), near ? rr(2.6, 4.4) : rr(4, 7.5) + far * rr(0.6, 1.2)); } }
      [[-20, 0x2d6cdf], [-28, 0xf5c518], [23, 0xd7d9de], [31, 0x3bb54a]].forEach(q => { const z = zF + 4.3; box(g, 1.9, 0.5, 0.9, q[1], q[0], GY + 0.16, z); box(g, 1.0, 0.4, 0.84, 0x26262c, q[0] - 0.1, GY + 0.66, z); [-0.6, 0.6].forEach(dx => box(g, 0.36, 0.32, 0.96, 0x111111, q[0] + dx, GY, z)); });          // autos en el carril de enfrente
    }
    if (R.decor === 'malvinas') { water(-38, -34, 34, 14, 0.4); water(16, -44, 40, 12, -0.1); village(5, { w: [2.4, 3.0], d: [2.2, 2.8], h: [1.4, 1.7], walls: [0xf4f4f2, 0xe9eef2], roofs: [0xd8432f, 0x3f8f5a, 0x2d6cdf], roof: 'chapa', pitch: 0.5, chimney: true }); land();       // pocas casitas blancas con techo de chapa de colores
      { let fx = -26, fz = -20; for (let k = 0; k < 30 && !clear(fx, fz, 2.5); k++) { fx -= 1; fz -= 0.5; } cyl(1.1, 0.5, 0x8c8f88, fx, GY, fz); [0, 1, 2, 3].forEach(i => cyl(0.85 - i * 0.09, 1.5, i % 2 ? 0xd8432f : 0xf4f4f2, fx, GY + 0.5 + i * 1.5, fz)); cyl(0.95, 0.14, 0x26262c, fx, GY + 6.5, fz); cyl(0.5, 0.7, 0xffe9a8, fx, GY + 6.64, fz); cone(0.75, 0.6, 0x26262c, fx, GY + 7.34, fz, 8); mts.push([fx, fz, 2.5]); }      // el faro
      scatter(12, (x, z, k) => bush(x, z, k * 0.6, 0xa9b56a));
      const critter = (kind, x, z, k) => { const o = new T.Group(); if (kind === 'p') { const b = new T.Mesh(new T.SphereGeometry(0.26 * k, 7, 6), mat(0x16161a)); b.scale.y = 1.6; b.position.y = 0.42 * k; o.add(b); const p = new T.Mesh(new T.SphereGeometry(0.19 * k, 7, 6), mat(0xffffff)); p.scale.y = 1.4; p.position.set(0, 0.38 * k, 0.13 * k); o.add(p); box(o, 0.1, 0.06, 0.14, 0xf5a623, 0, 0.62 * k, 0.26 * k); }
        else { const b = new T.Mesh(new T.SphereGeometry(0.42 * k, 7, 5), mat(0xf4f1e8, { flatShading: true })); b.scale.set(0.9, 0.9, 1.3); b.position.y = 0.5 * k; o.add(b); box(o, 0.2, 0.2, 0.2, 0x2b2b2b, 0, 0.55 * k, 0.55 * k); }
        o.position.set(x, GY, z); g.add(o); critters.push({ o, kind, tx: x, tz: z, wait: rr(0, 4), sp: kind === 'p' ? 0.7 : 0.45, ph: rr(0, 6), free: (cx, cz) => clear(cx, cz, 0.4) }); };
      scatter(10, (x, z, k) => critter('p', x, z, k), 10.5, 22); scatter(8, (x, z, k) => critter('s', x, z, k), 11, 26); }      // pingüinos y ovejas que deambulan
    if (flag) { const fx = L.puerta.x + 3.4, fz = zF - 0.6; box(g, 0.1, 4.6, 0.1, 0xe8e8e8, fx, 0, fz); [0x74acdf, 0xffffff, 0x74acdf].forEach((c, i) => box(g, 2.0, 0.4, 0.05, new T.MeshBasicMaterial({ color: c }), fx + 1.05, 4.2 - i * 0.4, fz)); const sun = new T.Mesh(new T.CircleGeometry(0.14, 12), new T.MeshBasicMaterial({ color: 0xf5c518 })); sun.position.set(fx + 1.05, 4.0, fz + 0.04); g.add(sun); }      // la bandera, al completar la sucursal
    if (R.decor === 'patagonia') { water(-42, -30, 8, 4.5, 0.3); village(26, { w: [2.6, 3.4], d: [2.6, 3.2], h: [1.5, 1.9], walls: [0x8a5a34, 0x7a4a28, 0x9a6a40], roofs: [0x4a3524, 0x5a3a26], roof: 'alpino', pitch: 1.0, snow: true, chimney: true }); land();       // cabañas de troncos con techo empinado y nieve
      scatter(26, pine, 11, 32); [[-2.5, 0.3], [1.7, 0.6], [3.3, 0.1]].forEach(q => { cyl(0.12, 0.5, 0x6b4a2a, q[0], 0, zF + q[1]); [0, 1, 2].forEach(k => cone(0.62 - k * 0.15, 0.8, 0x1f6a3a, q[0], 0.4 + k * 0.5, zF + q[1], 7)); });
      [[-1, 0.4], [0.6, 0.9], [2.6, 1.0], [-3.6, 0.8]].forEach(q => { const m = new T.Mesh(new T.CircleGeometry(0.6, 9), mat(0xffffff)); m.rotation.x = -Math.PI / 2; m.position.set(q[0], 0.02, zF + q[1]); g.add(m); }); }
    if (stage >= 2) [-1, 1].forEach(sd => { const px = sd * (L.galeria.pasillo + 0.42), pz = L.galeria.zMax + 0.42; box(g, 0.5, 0.4, 0.5, 0xb5651d, px, 0, pz); box(g, 0.54, 0.06, 0.54, 0x8f4d14, px, 0.36, pz); box(g, 0.42, 0.3, 0.42, 0x3f8f3a, px, 0.42, pz); [[0, 0], [-0.13, 0.1], [0.12, -0.11]].forEach((q, i) => box(g, 0.12, 0.12, 0.12, i ? 0xffd166 : 0xff5fa2, px + q[0], 0.72 + (i ? -0.04 : 0), pz + q[1])); });   // mejorado: canteros
    if (stage >= 3) { box(g, 1.5, 0.03, 2.4, 0xb00000, L.puerta.x, 0, zF - 0.6); const st = new T.Mesh(new T.OctahedronGeometry(0.34), new T.MeshBasicMaterial({ color: 0xf5c518 })); st.position.set(0, 3.85, 0); totem.add(st); }   // estrella: alfombra roja y estrella en el tótem
  }
  // Flota de envíos, estacionada sobre la vereda: moto, camioneta o camión (se ve solo el nivel actual)
  const fleetK = {}; let disp = null;                /* vehículo saliendo a repartir: { k, t, cam, ret } */
  function buildFleet(root) {
    const z = L.galeria.zMax + 5.0, x = 4.6, wheel = (g, wx, wz, r) => { const w = new T.Mesh(new T.CylinderGeometry(r, r, 0.12, 12), mat(0x111111)); w.rotation.x = Math.PI / 2; w.position.set(wx, r, wz); g.add(w); };
    const RED = 0xe10600, WH = 0xf7f7f5, DK = 0x1b1b20, GL = 0x7fd4ff, tyre = (g, wx, wz, r, w) => { const t = new T.Mesh(new T.CylinderGeometry(r, r, w || 0.16, 14), mat(0x15151a)); t.rotation.x = Math.PI / 2; t.position.set(wx, r, wz); g.add(t); const h = new T.Mesh(new T.CylinderGeometry(r * 0.52, r * 0.52, (w || 0.16) + 0.02, 10), mat(0xc5c9d2)); h.rotation.x = Math.PI / 2; h.position.set(wx, r, wz); g.add(h); };
    const logoM = new T.MeshBasicMaterial({ map: logoTex(512, 176, (c, W, H, img) => { c.fillStyle = '#0a0a0c'; c.fillRect(0, 0, W, H); c.strokeStyle = '#f5c518'; c.lineWidth = 8; c.strokeRect(4, 4, W - 8, H - 8); const iw = W * 0.84, ih = iw * img.height / img.width; c.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih); }) });
    const logo = (g, w, lx, ly, lz) => { plane(g, w, w * 0.344, logoM, lx, ly, lz + 0.006); plane(g, w, w * 0.344, logoM, lx, ly, -lz - 0.006 + 2 * (g.userData.z0 || 0), Math.PI); };
    const veh = lv => { const g = upGroup(root, 'flota', lv), k = new T.Group(); k.position.set(x, 0, z); g.add(k); fleetK[lv] = k; k.userData.x0 = x; k.userData.z0 = z; return k; };
    { const k = veh(1);                                                                                                  /* moto de reparto */
      tyre(k, 0.56, 0, 0.21, 0.1); tyre(k, -0.5, 0, 0.21, 0.12); box(k, 0.36, 0.05, 0.16, RED, 0.56, 0.4, 0); box(k, 0.44, 0.06, 0.2, RED, -0.5, 0.42, 0);
      box(k, 0.62, 0.07, 0.3, DK, 0.02, 0.2, 0); box(k, 0.5, 0.26, 0.26, RED, -0.42, 0.27, 0); box(k, 0.52, 0.09, 0.28, DK, -0.36, 0.53, 0);                                    /* piso, carenado trasero y asiento */
      const sh = box(k, 0.07, 0.56, 0.32, RED, 0.36, 0.22, 0); sh.rotation.z = -0.3; const fk = box(k, 0.06, 0.6, 0.06, 0x8d9199, 0.5, 0.2, 0); fk.rotation.z = -0.3;
      box(k, 0.06, 0.05, 0.6, DK, 0.38, 0.84, 0); [-1, 1].forEach(sd => box(k, 0.07, 0.07, 0.12, 0x2c2c33, 0.38, 0.83, sd * 0.3)); box(k, 0.05, 0.12, 0.14, 0xfff3b0, 0.47, 0.66, 0, { emissive: 0xa08a30 }); const ws = box(k, 0.02, 0.22, 0.3, GL, 0.36, 0.86, 0); ws.rotation.z = -0.25;
      box(k, 0.5, 0.46, 0.44, RED, -0.62, 0.62, 0); box(k, 0.54, 0.05, 0.48, DK, -0.62, 1.08, 0); plane(k, 0.44, 0.151, logoM, -0.62, 0.86, 0.226); plane(k, 0.44, 0.151, logoM, -0.62, 0.86, -0.226, Math.PI); box(k, 0.03, 0.1, 0.2, 0xff3b30, -0.87, 0.5, 0, { emissive: 0x801010 });
      { const r = new T.Group(); k.add(r); const SK = 0xe0ac7e, PT = 0x26262c;                                                     /* repartidor: remera roja, casco rojo con franja blanca y visor */
        const tor = box(r, 0.3, 0.46, 0.4, RED, -0.2, 0.62, 0); tor.rotation.z = -0.22; [-1, 1].forEach(sd => { const th = box(r, 0.4, 0.14, 0.15, PT, -0.06, 0.58, sd * 0.13); th.rotation.z = -0.12; box(r, 0.13, 0.36, 0.14, PT, 0.12, 0.27, sd * 0.13); box(r, 0.22, 0.09, 0.15, 0x111114, 0.16, 0.27, sd * 0.13);
          const ar = box(r, 0.5, 0.11, 0.11, RED, 0.1, 0.9, sd * 0.24); ar.rotation.z = -0.3; ar.rotation.y = sd * -0.14; ballM(r, 0.07, 0.07, 0.07, SK, 0.37, 0.87, sd * 0.29); });
        ballM(r, 0.27, 0.27, 0.27, SK, -0.1, 1.33, 0); const hm = new T.Mesh(new T.SphereGeometry(0.31, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(RED)); hm.position.set(-0.1, 1.33, 0); hm.rotation.z = 0.12; r.add(hm);
        const st = box(r, 0.5, 0.05, 0.1, 0xffffff, -0.12, 1.6, 0); st.rotation.z = 0.12; box(r, 0.05, 0.16, 0.44, 0x16161a, 0.2, 1.3, 0); box(r, 0.3, 0.06, 0.64, RED, -0.08, 1.24, 0); plane(r, 0.2, 0.069, logoM, -0.12, 1.42, 0.305); plane(r, 0.2, 0.069, logoM, -0.12, 1.42, -0.305, Math.PI); } }
    { const k = veh(2);                                                                                                  /* utilitario */
      [-0.82, 0.86].forEach(dx => { tyre(k, dx, 0.5, 0.25); tyre(k, dx, -0.5, 0.25); });
      box(k, 2.7, 0.16, 1.08, DK, 0, 0.2, 0); box(k, 1.65, 1.02, 1.12, WH, -0.5, 0.34, 0); box(k, 1.67, 0.16, 1.14, RED, -0.5, 0.5, 0);                                         /* chasis, caja y franja */
      box(k, 0.72, 0.5, 1.1, WH, 0.68, 0.34, 0); box(k, 0.5, 0.26, 1.08, WH, 1.12, 0.34, 0); box(k, 0.74, 0.16, 1.12, RED, 0.68, 0.5, 0); box(k, 0.52, 0.08, 1.1, RED, 1.12, 0.47, 0);    /* cabina y capó */
      box(k, 0.62, 0.5, 1.06, WH, 0.56, 0.84, 0); box(k, 0.5, 0.38, 1.1, 0x23324a, 0.6, 0.88, 0); const wsh = box(k, 0.04, 0.5, 0.98, GL, 0.94, 0.82, 0); wsh.rotation.z = -0.42; box(k, 1.0, 0.05, 1.08, WH, 0.36, 1.34, 0);
      box(k, 0.1, 0.18, 1.12, DK, 1.36, 0.3, 0); box(k, 0.08, 0.16, 1.1, DK, -1.34, 0.3, 0); [-1, 1].forEach(sd => { box(k, 0.05, 0.09, 0.22, 0xfff3b0, 1.385, 0.465, sd * 0.38, { emissive: 0xa08a30 }); box(k, 0.04, 0.2, 0.12, 0xff3b30, -1.335, 0.62, sd * 0.48, { emissive: 0x801010 }); box(k, 0.06, 0.1, 0.14, DK, 0.92, 0.9, sd * 0.62); });
      box(k, 0.06, 0.2, 0.9, 0x2c2c33, 1.392, 0.3, 0); plane(k, 1.3, 0.447, logoM, -0.5, 0.98, 0.566); plane(k, 1.3, 0.447, logoM, -0.5, 0.98, -0.566, Math.PI); box(k, 0.02, 0.9, 0.02, 0x9aa0ad, -0.5, 0.4, 0.565); }
    { const k = veh(3);                                                                                                  /* camión */
      [-1.3, -0.72, 1.3].forEach(dx => { tyre(k, dx, 0.56, 0.3, 0.2); tyre(k, dx, -0.56, 0.3, 0.2); });
      box(k, 3.7, 0.16, 1.0, DK, 0, 0.3, 0); box(k, 2.5, 1.62, 1.32, WH, -0.6, 0.5, 0); box(k, 2.52, 0.22, 1.34, RED, -0.6, 0.5, 0); box(k, 0.04, 1.4, 1.2, 0xd9dbe0, -1.86, 0.6, 0);
      box(k, 0.98, 1.1, 1.26, RED, 1.32, 0.42, 0); box(k, 0.7, 0.5, 1.28, 0x23324a, 1.34, 1.0, 0); box(k, 0.04, 0.46, 1.12, GL, 1.82, 1.02, 0); box(k, 0.9, 0.06, 1.28, RED, 1.3, 1.52, 0); box(k, 0.44, 0.34, 1.16, RED, 1.06, 1.58, 0); box(k, 0.2, 0.2, 1.16, RED, 1.38, 1.58, 0);
      box(k, 0.06, 0.42, 1.0, 0x2c2c33, 1.82, 0.46, 0); box(k, 0.14, 0.2, 1.3, DK, 1.8, 0.26, 0); box(k, 0.1, 0.16, 1.3, DK, -1.86, 0.3, 0); [-1, 1].forEach(sd => { box(k, 0.04, 0.12, 0.24, 0xfff3b0, 1.86, 0.5, sd * 0.46, { emissive: 0xa08a30 }); box(k, 0.04, 0.16, 0.14, 0xff3b30, -1.875, 0.6, sd * 0.56, { emissive: 0x801010 }); box(k, 0.07, 0.2, 0.1, DK, 1.74, 1.14, sd * 0.72); box(k, 0.04, 0.3, 0.5, 0x2c2c33, -0.1, 0.16, sd * 0.56); });
      cylM(k, 0.045, 0.045, 0.9, 0x9aa0ad, 0.78, 1.1, 0.6); plane(k, 2.1, 0.722, logoM, -0.6, 1.26, 0.666); plane(k, 2.1, 0.722, logoM, -0.6, 1.26, -0.666, Math.PI); plane(k, 0.9, 0.31, logoM, -1.885, 1.5, 0, -Math.PI / 2); }
  }
  // Manchas en el piso (limpieza): aparecen de a poco y se limpian todas juntas
  const dirtGeo = new T.CircleGeometry(0.34, 9), dirtMat = new T.MeshBasicMaterial({ color: 0x4a3a2a, transparent: true, opacity: 0.55, depthWrite: false }); let dirt = [];
  function addDirt(x, z) { const m = new T.Mesh(dirtGeo, dirtMat); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6; m.scale.set(0.7 + Math.random() * 0.6, 0.6 + Math.random() * 0.5, 1); m.position.set(x, 0.016, z); scene.add(m); dirt.push(m); }
  function clearDirt() { dirt.forEach(m => scene.remove(m)); dirt = []; }
  function removeDirt() { const m = dirt.shift(); if (m) scene.remove(m); }
  // El local de al lado (la trama): pegado a la izquierda, con la persiana baja y un cartel inclinado en el techo
  let nextSigns = null, xmasG = null;
  function buildNext(root) {
    const s = L.salon, zA = s.zMax, zB = L.galeria.zMax, x1 = s.xMin - 0.7, x0 = x1 - 5.6, cx = (x0 + x1) / 2, cz = (zA + zB) / 2, w = x1 - x0, h = 2.7;
    box(root, w + 0.4, 0.5, zB - zA + 3.4, 0x18181b, cx, -0.52, cz + 1.5); box(root, w + 0.4, 0.04, 2.9, sky.side, cx, -0.03, zB + 1.5);
    box(root, w, h, zB - zA, 0x8b8f98, cx, 0, cz); box(root, w + 0.2, 0.14, zB - zA + 0.2, 0x5b5f68, cx, h, cz);
    const shut = canvasTex(256, 128, (g, cw, ch) => { for (let y = 0; y < ch; y += 8) { g.fillStyle = (y / 8) % 2 ? '#7f848d' : '#9aa0aa'; g.fillRect(0, y, cw, 8); } });
    plane(root, w - 1.0, 2.0, new T.MeshLambertMaterial({ map: shut }), cx, 1.02, zB + 0.012); box(root, w - 0.6, 0.16, 0.2, 0x3a3d44, cx, 2.05, zB + 0.1);
    const mk = (txt, bg, fg) => new T.MeshBasicMaterial({ map: textTex(txt, { bg, fg, w: 640, h: 190, font: '900 96px Impact, "Arial Black", sans-serif' }) });
    const k = new T.Group(); k.position.set(cx, h + 0.14, cz + 0.6); root.add(k); box(k, 4.5, 0.08, 1.5, 0x1b1b1f, 0, 0.02, 0);
    const a = plane(k, 4.3, 1.28, mk('SE VENDE', '#ffffff', '#e10600'), 0, 0.5, 0.1), b = plane(k, 4.3, 1.28, mk('GAMESHOP 2', '#e10600', '#ffffff'), 0, 0.5, 0.1);
    a.rotation.x = b.rotation.x = -0.95; a.visible = b.visible = false; k.visible = false; nextSigns = [a, b];     // el vecino queda como un local más de la cuadra
    box(k, 0.08, 0.6, 0.08, 0x1b1b1f, -1.9, 0, -0.45); box(k, 0.08, 0.6, 0.08, 0x1b1b1f, 1.9, 0, -0.45);
  }
  // Decoración de Navidad: árbol (a), guirnaldas (g) y lucecitas (l), según lo que eligió el jugador el día anterior
  function setXmas(cfg) {
    if (xmasG) { scene.remove(xmasG); xmasG = null; }
    if (!cfg) return;
    const g = xmasG = new T.Group(); scene.add(g);
    const m = L.mostrador, c = L.caja, s = L.salon, basic = col => new T.MeshBasicMaterial({ color: col });
    if (cfg.a != null) {
      const cols = [[0x2f9a41, 0x3bb54a], [0xf4f4f6, 0xdfe6ee], [0x1a1a1e, 0xd81e2c]][cfg.a], tx = 0.7, tz = 5.35;
      box(g, 0.16, 0.34, 0.16, 0x6b3e1e, tx, 0, tz);
      [[0.62, 0.7, 0.3], [0.5, 0.62, 0.78], [0.36, 0.56, 1.2]].forEach((q, i) => { const cn = new T.Mesh(new T.ConeGeometry(q[0], q[1], 12), mat(cols[i % 2])); cn.position.set(tx, q[2] + q[1] / 2, tz); g.add(cn); });
      const star = new T.Mesh(new T.OctahedronGeometry(0.13), basic(0xf5c518)); star.position.set(tx, 1.86, tz); g.add(star);
      const orn = cfg.a === 2 ? [0xffffff, 0xf5c518] : [0xd81e2c, 0xf5c518];
      for (let i = 0; i < 12; i++) { const an = i * 2.4, y = 0.45 + (i % 6) * 0.2, r = 0.56 - (y - 0.3) * 0.36, o = new T.Mesh(new T.SphereGeometry(0.055, 8, 6), basic(orn[i % 2])); o.position.set(tx + Math.cos(an) * r, y, tz + Math.sin(an) * r); g.add(o); }
      box(g, 0.3, 0.22, 0.3, 0xd81e2c, tx - 0.55, 0, tz + 0.25); box(g, 0.32, 0.04, 0.06, 0xf5c518, tx - 0.55, 0.22, tz + 0.25); box(g, 0.24, 0.3, 0.24, 0x2d6cdf, tx + 0.5, 0, tz + 0.3); box(g, 0.26, 0.04, 0.06, 0xffffff, tx + 0.5, 0.3, tz + 0.3);
    }
    if (cfg.g != null) {                           // guirnaldas en ondas a lo largo del mostrador y de la pared del fondo
      const gm = mat([0xd81e2c, 0xe9b500, 0x2f9a41][cfg.g]), geo = new T.SphereGeometry(0.075, 7, 6), xa = m.x - m.w / 2 + 0.1, xb = c.x + c.w / 2 - 0.1;
      const run = (x0, x1, y, z) => { const n = Math.round((x1 - x0) / 0.14); for (let i = 0; i <= n; i++) { const t = i / n, b = new T.Mesh(geo, gm); b.position.set(x0 + (x1 - x0) * t, y - Math.abs(Math.sin(t * Math.PI * 6)) * 0.2, z); g.add(b); } };
      run(xa, xb, m.h - 0.04, m.z + m.d / 2 + 0.07); run(s.xMin + 0.4, s.xMax - 0.4, s.wallH - 0.25, s.zMin + 0.1);
      [xa, (xa + xb) / 2, xb].forEach(x => { box(g, 0.2, 0.14, 0.05, 0xd81e2c, x - 0.1, m.h - 0.12, m.z + m.d / 2 + 0.1); });
    }
    if (cfg.l != null) {                           // lucecitas sobre la pared izquierda, el fondo y el frente de las vidrieras
      const pal = [[0xffd98a], [0xff3b3b, 0x3bd16f, 0x3b8bff, 0xffd23b], [0xe6f3ff]][cfg.l], mats = pal.map(basic), geo = new T.SphereGeometry(0.06, 7, 6); let k = 0;
      const dot = (x, y, z) => { const b = new T.Mesh(geo, mats[k++ % mats.length]); b.position.set(x, y, z); g.add(b); };
      for (let z = s.zMin + 0.3; z < s.zMax; z += 0.42) dot(s.xMin + 0.08, s.wallH - 0.5 - Math.abs(Math.sin(z * 2.2)) * 0.14, z);
      for (let x = s.xMin + 0.3; x < s.xMax; x += 0.42) dot(x, s.wallH - 0.62 - Math.abs(Math.sin(x * 2.2)) * 0.14, s.zMin + 0.16);
      [-1, 1].forEach(sd => { for (let x = L.galeria.pasillo + 0.2; x < s.xMax - 0.1; x += 0.4) dot(sd * x, 2.5 - Math.abs(Math.sin(x * 2.4)) * 0.12, L.galeria.zMax - 0.02); });
    }
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
  /* Vidrieras armadas a mano. u: de 0 (pasillo) a 1 (pared); z: de 0 (salón) a 1 (calle). ped: ['b', ancho, alto, color, fondo, zócalo] o ['c', radio, alto, color, zócalo].
     it: [producto, corrimiento a lo ancho, corrimiento en z, giro]. PROP ajusta cada modelo para que las proporciones entre productos sean las reales. */
  const PROP = { ps5: 0.92, xbox: 0.78, switch2: 0.72, quest: 0.7, dualsense: 0.56, ds_blanco: 0.56, ds_negro: 0.56, ds_rojo: 0.56, ds_azul: 0.56, ds_violeta: 0.56, joyxbox: 0.56, juego: 0.62, juego2: 0.62, juego3: 0.62, juego4: 0.62, auris: 0.8, teclado: 1.0, mouse: 0.95, monitor: 1.4, gabinete: 1.05,
    parlante: 0.75, volante: 1.0, mic: 0.7, ipad: 0.8, watch: 0.5, airpods: 0.55, homepod: 0.55, notebook: 0.8, gpu: 0.78, magic: 0.9 };
  const SHOW = {
    L: [
      { u: 0.8, z: 0.13, ped: ['b', 0.9, 0.78, 0x17171c, 0.74, 0xf5c518], it: [['ps5', -0.14, -0.06, 0.1], ['ds_blanco', 0.24, 0.16, 0.35]], tag: [-0.2, 0.3] },
      { u: 0.47, z: 0.15, ped: ['c', 0.46, 0.56, 0xe10600], it: [['xbox', -0.1, -0.08, 0], ['joyxbox', 0.18, 0.18, 0.4]] },
      { u: 0.15, z: 0.2, ped: ['b', 0.66, 0.84, 0xffffff, 0.66], it: [['quest', 0, 0, 0.15]] },
      { u: 0.76, z: 0.47, ped: ['b', 1.4, 0.3, 0xffffff, 0.8], it: [['switch2', -0.38, 0.06, 0.05], ['juego', 0.02, -0.2, 0.15], ['juego2', 0.26, -0.08, 0.05], ['juego3', 0.5, 0.06, -0.1]], tag: [0.06, 0.3] },
      { u: 0.37, z: 0.46, ped: ['b', 0.95, 0.5, 0x17171c, 0.7, 0xe10600], it: [['dualsense', -0.26, 0.12, 0.3], ['ds_azul', 0.06, -0.1, 0], ['ds_rojo', 0.3, 0.14, -0.3]] },
      { u: 0.13, z: 0.58, ped: ['c', 0.4, 0.4, 0xffffff, 0xe10600], it: [['volante', 0, 0, 0.1]] },
      { u: 0.56, z: 0.77, ped: ['b', 1.5, 0.36, 0x17171c, 0.6, 0xf5c518], it: [['auris', -0.5, 0, 0], ['ds_violeta', -0.08, 0.06, 0.2], ['juego4', 0.24, -0.08, 0], ['ds_negro', 0.54, 0.08, -0.3]] }
    ],
    R: [
      { u: 0.6, z: 0.16, ped: ['b', 1.9, 0.46, 0x17171c, 0.9, 0xff4fa3], it: [['monitor', 0.06, -0.2, -0.78], ['teclado', 0, 0.2, -0.78], ['mouse', 0.7, 0.2, -0.78], ['auris', -0.74, -0.12, -0.3]], tag: [-0.74, 0.3] },
      { u: 0.16, z: 0.14, ped: ['b', 0.7, 0.6, 0xffffff, 0.7], it: [['gabinete', 0, 0, 0.1]] },
      { u: 0.17, z: 0.47, ped: ['c', 0.42, 0.56, 0xe10600], it: [['mic', -0.12, -0.08, 0], ['parlante', 0.12, 0.2, 0.3]] },
      { u: 0.55, z: 0.5, ped: ['b', 1.4, 0.3, 0xffffff, 0.76], it: [['notebook', -0.3, 0, 0.15], ['ipad', 0.36, -0.1, 0.1], ['magic', 0.4, 0.24, 0.5]], tag: [-0.02, 0.32] },
      { u: 0.88, z: 0.5, ped: ['b', 0.6, 0.72, 0x17171c, 0.6, 0xf5c518], it: [['homepod', -0.1, -0.08, 0], ['watch', 0.14, 0.02, 0.2], ['airpods', -0.04, 0.2, 0.4]] },
      { u: 0.3, z: 0.79, ped: ['c', 0.44, 0.38, 0xffffff, 0xe10600], it: [['gpu', 0, -0.04, 0.2], ['juego2', 0.2, 0.22, -0.2]] }
    ]
  };
  const VID = ['ps5', 'dualsense', 'auris', 'switch2', 'teclado', 'juego', 'xbox', 'ds_azul', 'gabinete', 'quest', 'mouse', 'juego2', 'monitor', 'ds_rojo', 'volante', 'parlante', 'mic', 'juego3', 'ipad', 'ds_violeta', 'homepod', 'juego4', 'notebook', 'ds_blanco', 'watch', 'gpu', 'airpods', 'joyxbox'];
  const slideDoors = []; let doorK = 0;            /* puertas de vidrio corredizas: se abren solas cuando alguien se acerca */
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
      // exhibición: tarima clara y pedestales de distintas alturas, cada uno con un grupito de productos a escala entre sí
      box(root, w - 0.3, 0.06, d - 0.3, 0xecebe6, cx, 0.5, cz);
      SHOW[side < 0 ? 'L' : 'R'].forEach(c => { const px = x0 + side * c.u * w, pz = zA + 0.1 + c.z * d, P = c.ped, top = 0.56 + P[2];
        if (P[0] === 'c') { cylM(root, P[1], P[1], P[2], P[3], px, 0.56, pz); cylM(root, P[1] + 0.03, P[1] + 0.03, 0.03, P[4] || 0xf5c518, px, 0.56, pz); }
        else { box(root, P[1], P[2], P[4], P[3], px, 0.56, pz); box(root, P[1] + 0.04, 0.03, P[4] + 0.04, P[5] || 0x9aa0ad, px, 0.56, pz); }
        c.it.forEach(q => model(root, q[0], px + side * q[1], top, pz + q[2], 2.3 * (PROP[q[0]] || 1), Math.PI / 4 + (q[3] || 0)));
        if (c.tag) { const t = c.tag, g = new T.Group(); g.position.set(px + side * t[0], top, pz + t[1]); g.rotation.y = Math.PI / 4; root.add(g); const b = box(g, 0.26, 0.17, 0.014, 0xffffff, 0, 0, 0); b.rotation.x = -0.35; const r = box(g, 0.26, 0.05, 0.016, 0xe10600, 0, 0.11, -0.04); r.rotation.x = -0.35; }
      });
      // vidrio
      const gl = new T.Mesh(unitBox, glass); gl.scale.set(w, 1.9, d); gl.position.set(cx, 0.5 + 0.95, cz); root.add(gl);
      // marco superior oscuro con marcas (sin logos: solo una banda)
      box(root, 0.08, 0.08, d, 0x2b2422, x0, 2.4, cz);
    });
    { /* cartel de promo en la pared del fondo de la vidriera izquierda */
      const d = zB - zA - 0.5, h = d * 0.3, cz = (zA + zB) / 2, tx = logoTex(1200, 360, (c, W, H, img) => { c.fillStyle = '#0a0a0c'; c.fillRect(0, 0, W, H); const iw = 400, ih = iw * img.height / img.width; c.drawImage(img, 44, (H - ih) / 2, iw, ih);
        c.fillStyle = '#e10600'; c.fillRect(478, 50, 6, H - 100); c.textBaseline = 'middle'; c.textAlign = 'left'; const gd = c.createLinearGradient(0, 60, 0, 220); gd.addColorStop(0, '#fff3b0'); gd.addColorStop(0.55, '#f5c518'); gd.addColorStop(1, '#b8860b');
        c.font = '900 176px Impact, "Arial Black", sans-serif'; c.fillStyle = gd; c.fillText('10% OFF', 516, 138, 640); c.font = '900 50px "Arial Black", "Helvetica Neue", Arial, sans-serif'; c.fillStyle = '#fff'; c.fillText('EN EFECTIVO O TRANSFERENCIA', 518, 272, 640); });
      box(root, 0.08, h + 0.14, d + 0.14, 0xf5c518, s.xMin + 0.04, 1.72, cz); plane(root, d, h, new T.MeshBasicMaterial({ map: tx }), s.xMin + 0.085, 1.79 + h / 2, cz, Math.PI / 2); }
    gamingChair(root, 4.95, zB - 1.25, -0.5, 0xffffff, 0xff8fc0).position.y = 0.56;
    // arcade genérico en el medio del pasillo
    const a = L.arcade, g = new T.Group(); g.position.set(a.x, 0, a.z); root.add(g); (ups.arcade = {})[1] = g;
    box(g, 0.75, 1.9, 0.7, 0x101014, 0, 0, 0);
    box(g, 0.77, 0.9, 0.04, 0x1d3fb3, 0, 0.05, 0.36);
    box(g, 0.6, 0.45, 0.04, 0x0a0a0a, 0, 1.1, 0.36); const as = box(g, 0.5, 0.36, 0.02, 0x7be07b, 0, 1.14, 0.385, { emissive: 0x2a8a3a });
    box(g, 0.75, 0.1, 0.3, 0x2a2a30, 0, 0.92, 0.45);
    plane(g, 0.72, 0.22, new T.MeshBasicMaterial({ map: textTex('ARCADE', { bg: '#e10600', fg: '#fff', w: 256, h: 64 }) }), 0, 1.74, 0.36);
    // puertas de vidrio hacia el salón
    [-1, 1].forEach(sd => { const dg = new T.Group(); dg.position.set(sd * p / 2, 0, zA); root.add(dg); const gm = new T.Mesh(unitBox, glass); gm.scale.set(p - 0.1, 2.2, 0.05); gm.position.y = 1.1; dg.add(gm);
      box(dg, 0.05, 0.5, 0.08, 0xc8c8c8, -sd * (p / 2 - 0.18), 0.9, 0.06); box(dg, p - 0.1, 0.07, 0.07, 0x2b2422, 0, 2.2, 0); box(dg, 0.06, 2.2, 0.07, 0x2b2422, -sd * (p / 2 - 0.08), 0, 0); slideDoors.push({ g: dg, sd, x0: sd * p / 2 }); });
    box(root, 2 * p + 0.3, 0.1, 0.16, 0x2b2422, 0, 2.27, zA);                                                                                           /* riel */
    b.build();
  }

  // Cartel del frente en tres niveles: pintado (inicial), luminoso y pantalla LED
  function buildSign(root) {
    const s = L.salon, z = L.galeria.zMax + 0.15, W2 = s.xMax - s.xMin;
    box(root, 0.3, 3.24, 0.3, 0x0c0c0c, s.xMin - 0.1, 0, z); box(root, 0.3, 3.24, 0.3, 0x0c0c0c, s.xMax + 0.1, 0, z);
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

  /* ---------- Personajes: muñequitos cabezones con brazos y piernas, en 4 colores plenos ----------
     Cada personaje usa exactamente cuatro colores: PIEL, PELO, REMERA y PANTALÓN. Las zapatillas, los ojos, las cejas y los
     anteojos van del color del pantalón; la barba y las pestañas, del color del pelo; los labios, del color de la remera.
     Así cada uno se puede llevar a una impresión 3D de cuatro filamentos. */
  const SKINS = [0xf2c9a0, 0xe0ac7e, 0xc68a5c, 0x9a643c, 0xf6d7bd];
  const PANTS = [0x23232b, 0x2a3550, 0x3a2a1a, 0x1f3d2a, 0x4a4a55];
  const HR = 0.36;                                                    // radio de la cabeza
  const gHead = new T.SphereGeometry(HR, 36, 26), gEar = new T.SphereGeometry(0.085, 14, 10), gEye = new T.SphereGeometry(0.05, 16, 12),
        gTorso = new T.CylinderGeometry(0.15, 0.2, 0.36, 24), gHip = new T.CylinderGeometry(0.2, 0.19, 0.16, 24), gLegP = new T.CylinderGeometry(0.085, 0.08, 0.14, 14),
        gLeg = new T.CylinderGeometry(0.06, 0.055, 0.2, 14), gArm = new T.CylinderGeometry(0.052, 0.046, 0.26, 14), gSleeve = new T.CylinderGeometry(0.075, 0.07, 0.13, 14),
        gHand = new T.SphereGeometry(0.062, 14, 10), gSmile = new T.TorusGeometry(0.075, 0.013, 8, 22, Math.PI),
        gShadow = new T.CircleGeometry(0.36, 28), gShoe = new T.SphereGeometry(0.07, 16, 12), gShoulder = new T.SphereGeometry(0.076, 16, 12);
  const shadowMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false });
  const gBun = new T.SphereGeometry(0.16, 18, 14), gCurl = new T.SphereGeometry(0.14, 14, 10), gTuft = new T.SphereGeometry(0.13, 14, 10),
        gBeard = new T.SphereGeometry(HR + 0.018, 30, 10, Math.PI * 0.06, Math.PI * 0.88, Math.PI * 0.6, Math.PI * 0.36),
        gCap = new T.SphereGeometry(HR + 0.02, 36, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), gMass = new T.SphereGeometry(HR + 0.03, 28, 20),
        gHelmet = new T.SphereGeometry(HR + 0.06, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const glintMat = new T.MeshBasicMaterial({ color: 0xffffff }), mixC = (a, b, k) => ((Math.round((a >> 16 & 255) * (1 - k) + (b >> 16 & 255) * k) << 16) | (Math.round((a >> 8 & 255) * (1 - k) + (b >> 8 & 255) * k) << 8) | Math.round((a & 255) * (1 - k) + (b & 255) * k)), lumC = c => (c >> 16 & 255) * 0.3 + (c >> 8 & 255) * 0.59 + (c & 255) * 0.11;
  let bagLM = null;
  function bagLogoMat() { if (bagLM) return bagLM; bagLM = new T.MeshBasicMaterial({ map: logoTex(512, 256, (g, w, h, img) => { g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, w, h); const iw = w * 0.97, ih = iw * img.height / img.width; g.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih); }) }); return bagLM; }
  let sparkT = null;
  function sparkTex() { if (sparkT) return sparkT; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 2); x.lineTo(36, 28); x.lineTo(62, 32); x.lineTo(36, 36); x.lineTo(32, 62); x.lineTo(28, 36); x.lineTo(2, 32); x.lineTo(28, 28); x.closePath(); x.fill(); sparkT = new T.CanvasTexture(c); return sparkT; }
  function makePerson(o) {
    o = o || {};
    const g = new T.Group(), base = o.scale || 1; g.scale.setScalar(base); g.userData.base = base;
    const HY = 1.14, parts = { skin: [], top: [], bot: [], ink: [] };
    const add = (parent, geo, kind, x, y, z) => { const m = new T.Mesh(geo, mat(0xffffff)); m.position.set(x, y, z); parent.add(m); parts[kind].push(m); return m; };
    // piernas (giran desde la cadera al caminar): pernera del pantalón, pierna y zapatilla
    const legs = [-1, 1].map(sd => { const L2 = new T.Group(); L2.position.set(sd * 0.1, 0.42, 0); g.add(L2);
      add(L2, gLegP, 'bot', 0, -0.07, 0); add(L2, gLeg, 'skin', 0, -0.23, 0);
      const sole = box(L2, 0.135, 0.035, 0.27, 0xffffff, 0, -0.447, 0.05); parts.bot.push(sole); const up = add(L2, gShoe, 'bot', 0, -0.4, 0.045); up.scale.set(1, 0.78, 1.72); const toe = add(L2, gShoe, 'bot', 0, -0.405, 0.125); toe.scale.set(0.98, 0.62, 0.9); const cuff = add(L2, gLegP, 'bot', 0, -0.345, -0.005); cuff.scale.set(0.82, 0.4, 0.82); return L2; });      /* zapatilla: suela, empeine redondeado, puntera y caña */
    add(g, gHip, 'bot', 0, 0.46, 0); add(g, gTorso, 'top', 0, 0.7, 0);
    // brazos (giran desde el hombro): manga, brazo y mano
    const arms = [-1, 1].map(sd => { const A2 = new T.Group(); A2.position.set(sd * 0.2, 0.82, 0); A2.rotation.z = sd * 0.16; g.add(A2);
      add(A2, gSleeve, 'top', 0, -0.06, 0); add(A2, gShoulder, 'top', 0, 0.005, 0); add(A2, gArm, 'skin', 0, -0.24, 0); add(A2, gHand, 'skin', 0, -0.39, 0); return A2; });
    const bag = new T.Group(); bag.visible = false;      /* bolsa de compras negra con el logo de GameShop: cuelga de la mano por las manijas */
    { arms[1].add(bag); bag.position.set(0.02, -0.6, 0.03); bag.rotation.z = -0.16; box(bag, 0.36, 0.27, 0.07, 0x0a0a0a, 0, -0.135, 0); const lm = bagLogoMat(); plane(bag, 0.35, 0.175, lm, 0, 0, 0.037); plane(bag, 0.35, 0.175, lm, 0, 0, -0.037, Math.PI);
      [-1, 1].forEach(sd => { const h = new T.Mesh(new T.TorusGeometry(0.095, 0.02, 6, 16, Math.PI), mat(0xf4f4f2)); h.position.set(0, 0.13, sd * 0.03); bag.add(h); }); }
    const NK = 0.9, hd = new T.Group(); hd.position.y = NK; g.add(hd);      /* la cabeza gira desde el cuello: sirve para mirar hacia arriba */
    const head = add(hd, gHead, 'skin', 0, (HY - NK), 0); [-1, 1].forEach(sd => add(hd, gEar, 'skin', sd * (HR - 0.01), (HY - NK) - 0.03, 0));
    const eyes = [-1, 1].map(sd => { const e = new T.Mesh(gEye, mat(0x1c1c22)); e.position.set(sd * 0.13, (HY - NK) - 0.012, HR - 0.04); e.rotation.y = sd * 0.36; e.scale.set(1.08, 1.42, 0.5); hd.add(e); const gl = new T.Mesh(gEye, glintMat); gl.scale.set(0.3, 0.24, 0.3); gl.position.set(0.014, 0.02, 0.043); e.add(gl); const g2 = new T.Mesh(gEye, glintMat); g2.scale.set(0.14, 0.11, 0.14); g2.position.set(-0.016, -0.016, 0.046); e.add(g2); return e; });      /* ojos apoyados en la cara, con dos brillos */
    const smile = add(hd, gSmile, 'ink', 0, (HY - NK) - 0.12, HR - 0.03); smile.rotation.z = Math.PI; smile.rotation.x = 0.36;      /* la sonrisa sigue la curva de la cara: queda al ras */
    const sh = new T.Mesh(gShadow, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; g.add(sh);
    const carry = box(g, 0.36, 0.28, 0.3, 0xc49a6c, 0, 0.5, 0.3); carry.visible = false;
    const mopG = new T.Group(); mopG.visible = false; g.add(mopG); { const st = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1.35, 6), mat(0xb5894f)); st.position.set(0, 0.62, 0.42); st.rotation.x = -0.5; mopG.add(st); box(mopG, 0.5, 0.1, 0.22, 0x57b7e6, 0, 0, 0.76); box(mopG, 0.5, 0.05, 0.3, 0xe9f4fb, 0, 0, 0.82); }      // mopa
    const phone = o.phone ? box(g, 0.1, 0.18, 0.03, 0x111111, 0.16, 0.6, 0.2) : null;
    let cargo = null;
    if (o.cart) {
      box(g, 0.62, 0.06, 0.8, 0x3a6fd1, 0, 0.16, 0.85); box(g, 0.05, 0.9, 0.05, 0x3a6fd1, -0.26, 0.16, 0.48); box(g, 0.05, 0.9, 0.05, 0x3a6fd1, 0.26, 0.16, 0.48);
      box(g, 0.58, 0.05, 0.05, 0x3a6fd1, 0, 1.02, 0.48);
      [-0.3, 0.3].forEach(x => { const w = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.06, 10), mat(0x111111)); w.rotation.z = Math.PI / 2; w.position.set(x, 0.12, 1.05); g.add(w); });
      cargo = new T.Group(); g.add(cargo);
      box(cargo, 0.5, 0.36, 0.5, 0xc49a6c, 0, 0.22, 0.9); box(cargo, 0.44, 0.3, 0.44, 0xb98d5e, 0.02, 0.58, 0.9); box(cargo, 0.3, 0.22, 0.3, 0xc49a6c, -0.04, 0.88, 0.9);
    }
    // Estilo libre: cualquier combinación de peinado y accesorios (sin distinguir géneros), siempre con los cuatro colores
    let acc = null, bacc = null, armX = [], cur = {};
    function style(a) {
      cur = Object.assign({}, cur, a);
      const skinC = cur.skin || SKINS[1], hairC = cur.hair == null ? 0x3a2a1a : cur.hair, topC = cur.shirt || 0x4a6fb5, botC = cur.pants || PANTS[(topC >> 3) % PANTS.length];
      parts.skin.forEach(m => { m.material = mat(skinC); }); parts.top.forEach(m => { m.material = mat(topC); }); parts.bot.forEach(m => { m.material = mat(botC); }); const inkC = lumC(botC) < 95 ? botC : 0x1c1c22; parts.ink.forEach(m => { m.material = mat(inkC); }); eyes.forEach(e => { e.material = mat(inkC); });      /* trazos de la cara: el color del pantalón si es oscuro, si no tinta */
      if (acc) hd.remove(acc); acc = new T.Group(); acc.position.y = HY - NK; hd.add(acc);
      if (bacc) g.remove(bacc); bacc = new T.Group(); g.add(bacc); armX.forEach(m => m.parent.remove(m)); armX = [];
      { const tmB = mat(topC), gold = mat(0xf5c518), sph = (r, m, x, y, z, sx, sy, sz) => { const q = new T.Mesh(new T.SphereGeometry(r, 14, 10), m); q.position.set(x, y, z); q.scale.set(sx || 1, sy || 1, sz || 1); bacc.add(q); return q; }, cy = (r1, r2, hh, m, x, y, z) => { const q = new T.Mesh(new T.CylinderGeometry(r1, r2, hh, 18), m); q.position.set(x, y, z); bacc.add(q); return q; };
        const fat = cur.build === 'robusto' ? 1.34 : cur.santa ? 1.25 : 1; arms.forEach((a, i) => { a.scale.set(fat, 1, fat); a.position.x = (i ? 1 : -1) * (0.2 + (fat - 1) * 0.13); a.position.y = fat > 1 ? 0.8 : 0.82; }); legs.forEach(l => l.scale.set(fat > 1 ? 1.2 : 1, 1, fat > 1 ? 1.2 : 1));
        if (cur.build === 'robusto') {                 /* contextura grande: pecho ancho, hombros y algo de panza */
          cy(0.215, 0.25, 0.4, tmB, 0, 0.7, 0.005); sph(0.235, tmB, 0, 0.6, 0.04, 1.05, 0.85, 1); cy(0.125, 0.135, 0.1, mat(skinC), 0, 0.91, 0); cy(0.235, 0.225, 0.12, mat(botC), 0, 0.46, 0);
          if (cur.top === 'chomba') { const c1 = new T.Mesh(new T.TorusGeometry(0.135, 0.035, 8, 18), mat(0xe10600)); c1.rotation.x = Math.PI / 2; c1.position.y = 0.9; bacc.add(c1); box(bacc, 0.05, 0.16, 0.02, 0xe10600, 0, 0.8, 0.222); box(bacc, 0.07, 0.05, 0.02, 0xe10600, 0.11, 0.78, 0.215); }
          if (cur.top === 'campera') { box(bacc, 0.15, 0.36, 0.02, 0xe10600, 0, 0.7, 0.235); const c1 = new T.Mesh(new T.TorusGeometry(0.15, 0.04, 8, 18), tmB); c1.rotation.x = Math.PI / 2; c1.position.y = 0.9; bacc.add(c1); [-1, 1].forEach(sd => box(bacc, 0.025, 0.36, 0.03, 0x3a3a42, sd * 0.085, 0.7, 0.24)); }
        }
        if (!cur.santa && !cur.uniform) { const rb = cur.build === 'robusto', R = rb ? 1.32 : 1, dk = mat(mixC(topC, 0x000000, 0.2)), ny = rb ? 0.905 : 0.885;      /* detalles de la ropa: capucha, bolsillo y cordones del buzo; cuello de la remera */
          if (!cur.top) { const hd = new T.Mesh(new T.TorusGeometry(0.125 * R, 0.055, 10, 22, Math.PI), tmB); hd.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI); hd.position.set(0, ny - 0.005, -0.03); bacc.add(hd); const pk = new T.Mesh(gEar, dk); pk.scale.set(1.5 * R, 0.62, 0.3); pk.position.set(0, 0.6, (rb ? 0.262 : 0.182)); pk.rotation.x = -0.14; bacc.add(pk);
            [-1, 1].forEach(sd => { const cd = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.11, 6), glintMat); cd.position.set(sd * 0.035, 0.79, (rb ? 0.232 : 0.158)); cd.rotation.x = -0.14; bacc.add(cd); }); }
          if (cur.top === 'remera') { const c1 = new T.Mesh(new T.TorusGeometry(0.1 * (rb ? 1.25 : 1), 0.02, 8, 22), dk); c1.rotation.x = Math.PI / 2; c1.position.y = ny; bacc.add(c1); }
        }
        if (cur.build !== 'robusto' && !cur.santa && !cur.uniform) {      /* chomba y campera en el cuerpo común */
          if (cur.top === 'chomba') { const c1 = new T.Mesh(new T.TorusGeometry(0.105, 0.032, 8, 18), mat(0xe10600)); c1.rotation.x = Math.PI / 2; c1.position.y = 0.885; bacc.add(c1); box(bacc, 0.045, 0.15, 0.02, 0xe10600, 0, 0.72, 0.158).rotation.x = -0.13; box(bacc, 0.06, 0.045, 0.02, 0xe10600, 0.085, 0.74, 0.15).rotation.x = -0.13; }
          if (cur.top === 'campera') { box(bacc, 0.12, 0.33, 0.02, 0xe10600, 0, 0.54, 0.172).rotation.x = -0.135; const c1 = new T.Mesh(new T.TorusGeometry(0.115, 0.036, 8, 18), tmB); c1.rotation.x = Math.PI / 2; c1.position.y = 0.885; bacc.add(c1); [-1, 1].forEach(sd => { box(bacc, 0.022, 0.33, 0.03, 0x3a3a42, sd * 0.07, 0.54, 0.176).rotation.x = -0.135; }); }
        }
        if (cur.santa) {                              /* Papá Noel: panza, cinturón con hebilla, borde blanco y la bolsa de regalos al hombro */
          const wh = mat(0xffffff), dk = mat(0x17171c), sk2 = mat(0xb07a3f);
          sph(0.3, tmB, 0, 0.64, 0.05, 1, 0.93, 1); cy(0.2, 0.26, 0.2, tmB, 0, 0.82, 0); cy(0.307, 0.307, 0.075, dk, 0, 0.6, 0.05); box(bacc, 0.12, 0.1, 0.03, gold, 0, 0.6, 0.35); box(bacc, 0.06, 0.05, 0.035, dk, 0, 0.6, 0.352);
          const tr = new T.Mesh(new T.TorusGeometry(0.245, 0.055, 8, 20), wh); tr.rotation.x = Math.PI / 2; tr.position.set(0, 0.43, 0.02); bacc.add(tr); box(bacc, 0.07, 0.42, 0.03, wh, 0, 0.72, 0.325).rotation.x = -0.08; const cl = new T.Mesh(new T.TorusGeometry(0.17, 0.05, 8, 18), wh); cl.rotation.x = Math.PI / 2; cl.position.y = 0.9; bacc.add(cl);
          sph(0.4, sk2, -0.5, 0.62, -0.22, 1, 1.15, 0.95); sph(0.3, sk2, -0.5, 0.98, -0.22, 1, 0.8, 1); const tie = new T.Mesh(new T.TorusGeometry(0.2, 0.035, 6, 16), gold); tie.position.set(-0.5, 1.14, -0.22); tie.rotation.x = Math.PI / 2; bacc.add(tie);
          [[0x3bb54a, -0.61, 1.2, -0.26, 0.3], [0x2d6cdf, -0.4, 1.22, -0.3, -0.4], [0xf5c518, -0.5, 1.31, -0.16, 0.7]].forEach(q => { const b = box(bacc, 0.15, 0.15, 0.15, q[0], q[1], q[2], q[3]); b.rotation.set(0.3, q[4], 0.25); box(b, 0.155, 0.035, 0.155, 0xffffff, 0, 0, 0); box(b, 0.035, 0.155, 0.155, 0xffffff, 0, 0, 0); });
          arms.forEach(a => { const cf = new T.Mesh(new T.CylinderGeometry(0.065, 0.065, 0.06, 10), wh); cf.position.y = -0.3; a.add(cf); armX.push(cf); });
        }
        if (cur.uniform) {                            /* el Capitán: casaca larga, charreteras, banda, botones, garfio y loro al hombro */
          const rd = mat(0xd81e2c); cy(0.21, 0.3, 0.3, tmB, 0, 0.4, 0); cy(0.19, 0.225, 0.4, tmB, 0, 0.7, 0); cy(0.232, 0.232, 0.06, mat(0x17171c), 0, 0.53, 0); box(bacc, 0.09, 0.08, 0.03, gold, 0, 0.53, 0.225);
          [-1, 1].forEach(sd => { sph(0.1, gold, sd * 0.235, 0.89, 0, 1.25, 0.42, 1.15); cy(0.115, 0.125, 0.07, gold, sd * 0.25, 0.84, 0); });
          const sash = new T.Mesh(new T.TorusGeometry(0.215, 0.04, 8, 22), rd); sash.rotation.set(Math.PI / 2, 0.72, 0); sash.position.set(0, 0.71, 0); sash.scale.set(1, 1, 1.0); bacc.add(sash);
          [0.84, 0.74, 0.64].forEach((y, i) => sph(0.026, gold, 0.07, y, 0.2 + i * 0.012)); const cl = new T.Mesh(new T.TorusGeometry(0.15, 0.04, 8, 18), gold); cl.rotation.x = Math.PI / 2; cl.position.y = 0.905; bacc.add(cl);
          { const hk = new T.Mesh(new T.TorusGeometry(0.06, 0.018, 6, 14, Math.PI * 1.4), mat(0xd7d7de)); hk.position.y = -0.44; hk.rotation.z = Math.PI * 0.8; arms[1].add(hk); armX.push(hk); const cu2 = new T.Mesh(new T.CylinderGeometry(0.07, 0.06, 0.07, 10), gold); cu2.position.y = -0.33; arms[1].add(cu2); armX.push(cu2); arms.forEach(a => { const cf = new T.Mesh(new T.CylinderGeometry(0.068, 0.068, 0.05, 10), gold); cf.position.y = -0.17; a.add(cf); armX.push(cf); }); }
        }
      }
      const hm = mat(hairC), st = cur.hairStyle || 'corto', hat = cur.hat, capHat = hat === 'gorro' || hat === 'lana' || hat === 'ushanka' || hat === 'gorra';
      const cap = () => { const m = new T.Mesh(gCap, hm); m.rotation.x = -0.42; acc.add(m); };                    // casquete que deja la frente libre
      const tufts = () => [[0.02, 0.36, 0.1, 1], [-0.14, 0.34, 0.14, 0.85], [0.17, 0.33, 0.1, 0.8], [0, 0.3, 0.22, 0.7]].forEach(q => { const m = new T.Mesh(gTuft, hm); m.scale.set(q[3] * 1.3, q[3] * 0.8, q[3] * 1.3); m.position.set(q[0], q[1], q[2]); acc.add(m); });   // jopo despeinado
      if (hat !== 'casco') {
        if (st === 'corto' || st === 'largo' || st === 'rodete' || st === 'cresta') cap();
        if (st === 'cresta' && !capHat) [[0.33, 0.17, 1], [0.38, 0.03, 1.1], [0.37, -0.12, 1.05], [0.3, -0.25, 0.95]].forEach(q => { const m = new T.Mesh(gTuft, hm); m.scale.set(1.5, 0.62 * q[2], 1.25); m.position.set(0, q[0], q[1]); acc.add(m); });
        if (st === 'corto' && !capHat && hat !== 'boina' && hat !== 'ala' && hat !== 'bicornio') tufts();
        if (st === 'jopo') { cap();      /* corto a los costados (más claro) y peinado hacia arriba adelante */
          { const tp = new T.Mesh(gHead, hm); tp.scale.set(0.93, 0.6, 0.99); tp.position.set(0, 0.17, -0.02); acc.add(tp); const q1 = new T.Mesh(gHead, hm); q1.scale.set(0.72, 0.3, 0.4); q1.position.set(0.03, 0.32, 0.19); q1.rotation.x = -0.35; acc.add(q1); [[-0.2, 0.27, 0.2, 0.2], [-0.07, 0.33, 0.25, 0.08], [0.08, 0.34, 0.25, -0.06], [0.21, 0.28, 0.2, -0.2], [-0.13, 0.38, 0.12, 0.1], [0.12, 0.39, 0.12, -0.1], [0, 0.41, 0.02, 0]].forEach(q => { const m = new T.Mesh(gTuft, hm); m.scale.set(0.66, 0.66, 0.74); m.position.set(q[0], q[1] - 0.03, q[2]); m.rotation.set(-0.55, 0, q[3]); acc.add(m); }); }      /* mechones peinados hacia arriba */ }
        if (st === 'largo') { const m = new T.Mesh(gMass, hm); m.scale.set(1.06, 1.3, 0.8); m.position.set(0, -0.2, -0.17); acc.add(m); }
        if (st === 'rodete' && !capHat) { const b = new T.Mesh(gBun, hm); b.position.set(0, 0.42, -0.12); acc.add(b); }
        if (st === 'rulos' && capHat) cap();
        if (st === 'rulos' && !capHat) { for (let i = 0; i < 9; i++) { const an = i / 9 * Math.PI * 2, c = new T.Mesh(gCurl, hm); c.scale.setScalar(1.25); c.position.set(Math.cos(an) * 0.27, 0.22, Math.sin(an) * 0.27 - 0.05); acc.add(c); }
          [[0, 0.39, -0.04], [0.15, 0.36, 0.06], [-0.15, 0.36, 0.06], [0, 0.35, -0.2]].forEach(q => { const c = new T.Mesh(gCurl, hm); c.scale.setScalar(1.3); c.position.set(q[0], q[1], q[2]); acc.add(c); }); }
        if (st === 'mohicano' && !capHat) [[0.3, 0.2, 0.9], [0.4, 0.08, 1.15], [0.43, -0.06, 1.3], [0.38, -0.2, 1.15], [0.27, -0.31, 0.95]].forEach(q => { const m = new T.Mesh(gTuft, hm); m.scale.set(0.62, q[2] * 1.25, 1.05); m.position.set(0, q[0], q[1]); acc.add(m); });   // cresta de mechones, más alta en el medio
      }
      if (cur.beard) acc.add(new T.Mesh(gBeard, hm));
      if (cur.stubble) { const sb = new T.Mesh(gBeard, mat(mixC(skinC, 0x4a4a52, 0.38))); sb.scale.setScalar(0.975); acc.add(sb); }
      if (cur.santa) { const wh = mat(0xffffff); [[0, -0.3, 0.2, 0.25, 1.25, 1.05, 0.8], [-0.2, -0.2, 0.2, 0.15, 1, 1.1, 0.9], [0.2, -0.2, 0.2, 0.15, 1, 1.1, 0.9], [0, -0.47, 0.18, 0.15, 1.1, 1, 0.8], [-0.085, -0.115, 0.335, 0.075, 1.5, 0.75, 0.8], [0.085, -0.115, 0.335, 0.075, 1.5, 0.75, 0.8]].forEach(q => { const m = new T.Mesh(gHead, wh); m.scale.set(q[3] / HR * q[4], q[3] / HR * q[5], q[3] / HR * q[6]); m.position.set(q[0], q[1], q[2]); acc.add(m); });
        const ns = new T.Mesh(gEar, mat(0xe58a7a)); ns.scale.setScalar(0.75); ns.position.set(0, -0.06, HR + 0.02); acc.add(ns); }
      const bm = mat(inkC), tm = mat(topC);
      [-1, 1].forEach(sd => { const b = new T.Mesh(gEar, bm); b.scale.set(0.78, 0.2, 0.22); b.position.set(sd * 0.135, 0.105, HR - 0.036); b.rotation.set(-0.3, sd * 0.4, sd * -0.14); acc.add(b); });     // cejas redondeadas
      if (!cur.santa) { const ns = new T.Mesh(gEar, mat(mixC(skinC, 0x6b3a1e, 0.16))); ns.scale.set(0.42, 0.34, 0.36); ns.position.set(0, -0.055, HR - 0.006); acc.add(ns);      /* nariz chiquita y un poco de color en las mejillas */
        [-1, 1].forEach(sd => { const ck = new T.Mesh(gEar, mat(mixC(skinC, 0xff5a5a, 0.3))); ck.scale.set(0.62, 0.42, 0.14); ck.position.set(sd * 0.215, -0.095, HR * 0.775); ck.rotation.y = sd * 0.66; ck.rotation.x = 0.28; acc.add(ck); }); }
      /* sombreros y detalles de los rivales: boina, sombrero de ala, ushanka, gorra, anteojos oscuros y parche */
      { const hc = mat(cur.hatCol != null ? cur.hatCol : 0x2b2b30), hb = mat(cur.hatBand != null ? cur.hatBand : 0x17171c), cyl = (r1, r2, hh, m, y, x, z) => { const c = new T.Mesh(new T.CylinderGeometry(r1, r2, hh, 20), m); c.position.set(x || 0, y, z || 0); acc.add(c); return c; };
        if (hat === 'boina') { const bd = new T.Mesh(new T.TorusGeometry(HR * 0.93, 0.05, 8, 22), hb); bd.rotation.x = Math.PI / 2 + 0.12; bd.position.set(0, HR * 0.62, -0.02); acc.add(bd); const top = new T.Mesh(gHead, hc); top.scale.set(1.34, 0.42, 1.3); top.position.set(0.05, HR * 0.9, -0.03); top.rotation.set(0.1, 0, -0.14); acc.add(top); const pm = new T.Mesh(gEar, hc); pm.scale.setScalar(0.5); pm.position.set(0.07, HR * 0.9 + 0.16, -0.03); acc.add(pm); }
        if (hat === 'ala') { cyl(HR * 1.5, HR * 1.55, 0.035, hc, HR * 0.62); cyl(HR * 0.86, HR * 0.98, 0.26, hc, HR * 0.62 + 0.14); cyl(HR * 1.0, HR * 1.0, 0.07, hb, HR * 0.62 + 0.05); }
        if (hat === 'ushanka') { const dome = new T.Mesh(gHelmet, hc); dome.scale.setScalar(1.0); dome.position.y = 0.04; acc.add(dome); [-1, 1].forEach(sd => box(acc, 0.11, 0.34, 0.3, hc, sd * (HR + 0.03), -0.26, 0)); box(acc, HR * 1.5, 0.15, 0.09, hb, 0, 0.1, HR * 0.92); }
        if (hat === 'gorra') { const dome = new T.Mesh(new T.SphereGeometry(HR + 0.04, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.46), hc); dome.rotation.x = -0.3; dome.position.y = 0.01; acc.add(dome); const r0 = HR + 0.005, th = 0.9, ex = Math.sin(th) * r0, ey = Math.cos(th) * r0, vsh = new T.Shape(); vsh.moveTo(-ex, ey); vsh.absarc(0, 0, r0, Math.PI / 2 + th, Math.PI / 2 - th, true); vsh.bezierCurveTo(ex + 0.03, ey + 0.15, 0.17, r0 + 0.16, 0, r0 + 0.16); vsh.bezierCurveTo(-0.17, r0 + 0.16, -ex - 0.03, ey + 0.15, -ex, ey);      /* visera: media luna que nace del borde del casquete y baja apenas */
          const vs = new T.Mesh(new T.ExtrudeGeometry(vsh, { depth: 0.016, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 18 }), hb); vs.rotation.x = Math.PI / 2 - 0.3; vs.position.set(0, 0.125, -0.02);      /* apenas levantada, para que no tape los ojos desde la cámara del juego */ acc.add(vs); const bt = new T.Mesh(gEar, hb); bt.scale.setScalar(0.5); bt.position.set(0, HR + 0.03, -0.11); acc.add(bt); }      /* gorra: casquete que deja la cara libre, visera y botón */
        if (cur.shades) { const sm = mat(0x111114); [-1, 1].forEach(sd => { const d = new T.Mesh(gEar, sm); d.scale.set(1.08, 1.08, 0.22); d.position.set(sd * 0.132, -0.012, HR - 0.016); d.rotation.y = sd * 0.34; acc.add(d); box(acc, 0.02, 0.02, HR * 0.9, sm, sd * 0.235, -0.01, HR * 0.4); }); box(acc, 0.075, 0.022, 0.02, sm, 0, -0.01, HR + 0.004); }      /* anteojos de sol: como los comunes, con los dos cristales negros llenos */
        if (cur.patch) { box(acc, 0.17, 0.17, 0.03, 0x111114, 0.13, -0.03, HR - 0.005); const band = new T.Mesh(new T.TorusGeometry(HR + 0.005, 0.014, 6, 24), mat(0x111114)); band.rotation.x = Math.PI / 2; band.rotation.y = 0.28; band.position.y = 0.06; acc.add(band); } }
      if (cur.glasses) { [-1, 1].forEach(sd => { const r = new T.Mesh(new T.TorusGeometry(0.088, 0.013, 8, 28), bm); r.position.set(sd * 0.132, -0.012, HR - 0.012); r.rotation.y = sd * 0.34; acc.add(r); box(acc, 0.02, 0.02, HR * 0.9, bm, sd * 0.235, -0.01, HR * 0.4); }); box(acc, 0.075, 0.02, 0.02, bm, 0, -0.01, HR + 0.004); }      /* marcos finos, puente y patillas */
      if (cur.lashes) [-1, 1].forEach(sd => [[0.19, 0.05, 0.62], [0.2, 0.02, 0.3]].forEach(q => { const l = new T.Mesh(gEar, bm); l.scale.set(0.34, 0.09, 0.12); l.position.set(sd * q[0], q[1], HR - 0.085); l.rotation.set(0, sd * 0.6, sd * q[2]); acc.add(l); }));      /* pestañas: dos trazos finos en el borde del ojo */
      smile.visible = !cur.lips; if (cur.lips) { const lm = cur.lipCol != null ? mat(cur.lipCol) : tm, lp = new T.Mesh(gHead, lm); lp.scale.set(0.2, 0.075, 0.06); lp.position.set(0, -0.165, HR * 0.885); lp.rotation.x = 0.48; acc.add(lp); }
      // sombreros de los disfraces (siempre con los colores del personaje)
      if (hat === 'gorro') {                       // gorrito navideño (rojo y blanco, es un accesorio de la semana de Navidad)
        const red = mat(0xd81e2c), wh = mat(0xffffff), band = new T.Mesh(new T.TorusGeometry(HR - 0.005, 0.075, 8, 20), wh); band.rotation.x = Math.PI / 2; band.position.y = 0.17; acc.add(band);
        const dome = new T.Mesh(gHelmet, red); dome.scale.setScalar(0.94); dome.position.y = 0.03; acc.add(dome);
        const cone = new T.Mesh(new T.ConeGeometry(0.3, 0.5, 14), red); cone.position.set(0.05, 0.54, -0.02); cone.rotation.z = -0.28; acc.add(cone);
        const pom = new T.Mesh(gEar, wh); pom.scale.setScalar(1.15); pom.position.set(0.17, 0.8, -0.02); acc.add(pom);
      }
      if (hat === 'orejas') { [-1, 1].forEach(sd => { const e = new T.Mesh(gTuft, hm); e.scale.set(0.9, 1, 0.5); e.position.set(sd * 0.22, 0.37, 0); acc.add(e); }); }
      if (hat === 'casco') { const h = new T.Mesh(gHelmet, tm); h.rotation.x = -0.5; acc.add(h); box(acc, 0.05, 0.2, 0.05, tm, 0.28, 0.42, -0.05); const b = new T.Mesh(gEar, hm); b.position.set(0.28, 0.64, -0.05); acc.add(b); }
      if (hat === 'corona') { const gd = mat(0xf5c518), gd2 = mat(0xf5c518, { side: T.DoubleSide }), R = 0.21, band = new T.Mesh(new T.CylinderGeometry(R, R * 0.9, 0.13, 18, 1, true), gd2); band.position.y = HR + 0.02; acc.add(band);
        const rim = new T.Mesh(new T.TorusGeometry(R * 0.9, 0.022, 6, 18), gd); rim.rotation.x = Math.PI / 2; rim.position.y = HR - 0.045; acc.add(rim);
        for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2 + 0.26, cx = Math.cos(an) * R, cz = Math.sin(an) * R, sp = new T.Mesh(new T.ConeGeometry(0.06, 0.17, 4), gd); sp.position.set(cx, HR + 0.165, cz); sp.rotation.y = -an; acc.add(sp);
          const tip = new T.Mesh(gEar, gd); tip.scale.setScalar(0.32); tip.position.set(cx, HR + 0.26, cz); acc.add(tip); const jw = new T.Mesh(gEar, i % 2 ? mat(0xe10600) : tm); jw.scale.setScalar(0.36); jw.position.set(Math.cos(an) * (R + 0.012), HR + 0.02, Math.sin(an) * (R + 0.012)); acc.add(jw); } }
      if (hat === 'lana') { const dome = new T.Mesh(gHelmet, tm); dome.scale.setScalar(0.95); dome.position.y = 0.03; acc.add(dome); const band = new T.Mesh(new T.TorusGeometry(HR - 0.005, 0.07, 8, 20), bm); band.rotation.x = Math.PI / 2; band.position.y = 0.15; acc.add(band); const pom = new T.Mesh(gEar, bm); pom.scale.setScalar(1.1); pom.position.set(0, HR + 0.1, 0); acc.add(pom); }      // gorro de lana
      if (cur.scarf) { const sc = new T.Mesh(new T.TorusGeometry(HR * 0.6, 0.1, 8, 16), bm); sc.rotation.x = Math.PI / 2; sc.position.y = -HR * 0.93; acc.add(sc); box(acc, 0.16, 0.34, 0.08, bm, 0.14, -HR - 0.42, HR * 0.55); }      // bufanda
      if (hat === 'bicornio') { const nv = mat(0x1b2340), gd = mat(0xf5c518), sh2 = new T.Shape(); sh2.moveTo(-0.66, 0.1); sh2.quadraticCurveTo(-0.5, 0.2, -0.3, 0.42); sh2.quadraticCurveTo(0, 0.62, 0.3, 0.42); sh2.quadraticCurveTo(0.5, 0.2, 0.66, 0.1); sh2.quadraticCurveTo(0.3, -0.02, 0, -0.02); sh2.quadraticCurveTo(-0.3, -0.02, -0.66, 0.1);      /* bicornio de capitán: silueta curva, ribete dorado, escarapela y pluma */
        const hatM = new T.Mesh(new T.ExtrudeGeometry(sh2, { depth: 0.3, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2, curveSegments: 14 }), nv); hatM.position.set(0, HR * 0.6, -0.15); acc.add(hatM);
        [0.19, -0.19].forEach(z => { const tb = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([[-0.66, 0.1], [-0.5, 0.21], [-0.3, 0.43], [0, 0.535], [0.3, 0.43], [0.5, 0.21], [0.66, 0.1]].map(q => new T.Vector3(q[0], q[1], 0))), 24, 0.024, 6), gd); tb.position.set(0, HR * 0.6, z); acc.add(tb); });
        const ck = new T.Mesh(new T.CylinderGeometry(0.085, 0.085, 0.03, 16), gd); ck.rotation.x = Math.PI / 2; ck.position.set(0, HR * 0.6 + 0.24, 0.2); acc.add(ck); const ck2 = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.04, 14), mat(0xd81e2c)); ck2.rotation.x = Math.PI / 2; ck2.position.set(0, HR * 0.6 + 0.24, 0.205); acc.add(ck2);
        const pl = new T.Mesh(gHead, mat(0xd81e2c)); pl.scale.set(0.2, 0.75, 0.3); pl.position.set(0.3, HR * 0.6 + 0.56, 0); pl.rotation.z = -0.5; acc.add(pl);
        { const gr = mat(0x2f9a48), P = new T.Group(); P.position.set(-0.53, HR * 0.6 + 0.3, 0.02); P.rotation.y = 0.5; P.scale.setScalar(1.25); acc.add(P); const b = new T.Mesh(new T.SphereGeometry(0.085, 10, 8), gr); b.scale.set(1, 1.35, 1); b.position.y = 0.1; P.add(b); const hd = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), gr); hd.position.set(0, 0.25, 0.03); P.add(hd);
          const bk = new T.Mesh(new T.ConeGeometry(0.035, 0.09, 8), gd); bk.rotation.x = Math.PI / 2 + 0.5; bk.position.set(0, 0.23, 0.11); P.add(bk); box(P, 0.05, 0.2, 0.03, 0xd81e2c, 0, -0.02, -0.08).rotation.x = 0.5; [-1, 1].forEach(sd => { box(P, 0.03, 0.13, 0.1, 0x1f6d33, sd * 0.085, 0.1, -0.01); box(P, 0.022, 0.022, 0.03, 0x111114, sd * 0.035, 0.27, 0.085); }); } }
      if (hat === 'vincha') { const r = new T.Mesh(new T.TorusGeometry(HR - 0.022, 0.045, 6, 20), tm); r.rotation.x = Math.PI / 2 - 0.12; r.position.y = 0.15; acc.add(r); box(acc, 0.06, 0.22, 0.03, tm, 0.12, -0.02, -HR - 0.02).rotation.z = 0.3; }
    }
    style(o);
    scene.add(g);
    const p = {
      group: g, path: [], speed: o.speed || 2.9, t: Math.random() * 6, onArrive: null, moving: false, legs, arms, hd,
      setPos(x, z) { g.position.set(x, 0, z); },
      face(ry) { g.rotation.y = ry; },
      walk(points, cb) { p.path = points.slice(); p.onArrive = cb || null; p.moving = true; },
      bag(v) { bag.visible = v; p.bagOn = v; },
      lookUp(v) { p.upG = v || 0; },
      /* halo de las visitas especiales: aro de luz en el piso, columna suave y chispas que suben */
      aura(col, plain) { if (p.au) return; const c = new T.Color(col || 0xf5c518), mk = (geo, op) => new T.Mesh(geo, new T.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide })), A2 = new T.Group(); g.add(A2);
        const ring = mk(new T.RingGeometry(0.46, 0.62, 36), 0.85), disc = mk(new T.CircleGeometry(0.62, 30), 0.3), col2 = mk(new T.CylinderGeometry(0.42, 0.56, 1.7, 24, 1, true), 0.13); ring.rotation.x = disc.rotation.x = -Math.PI / 2; ring.position.y = 0.035; disc.position.y = 0.03; col2.position.y = 0.87; A2.add(ring, disc); if (!plain) A2.add(col2);
        const sp = (plain ? [] : [0, 1, 2, 3, 4, 5]).map(i => { const q = new T.Sprite(new T.SpriteMaterial({ map: sparkTex(), color: c.clone().lerp(new T.Color(0xffffff), 0.55), transparent: true, depthWrite: false, blending: T.AdditiveBlending })); q.userData.ph = i / 6; A2.add(q); return q; }); p.au = { ring, col2, sp }; },
      /* Papá Noel guarda el regalo en la bolsa: sale de las manos, pasa por arriba del hombro y cae adentro */
      gift() { if (p.gf) g.remove(p.gf.m); const m = new T.Group(); box(m, 0.2, 0.2, 0.2, 0x3bb54a, 0, 0, 0); box(m, 0.21, 0.05, 0.21, 0xf5c518, 0, 0, 0); box(m, 0.05, 0.21, 0.21, 0xf5c518, 0, 0, 0); g.add(m); p.gf = { m, t: 0 }; arms.forEach(a => { a.rotation.x = -1.5; }); p.holding = true; },
      look(a) { style(a); },
      cargo(v) { if (cargo) cargo.visible = v; },
      phone(v) { if (phone) phone.visible = v; },
      mop(v) { mopG.visible = v; p.holding = v; arms.forEach(a => { a.rotation.x = v ? -0.9 : 0; }); mopG.position.z = 0; },
      mopTick(t) { const k = Math.sin(t * 9); arms.forEach(a => { a.rotation.x = -0.9 + k * 0.3; }); mopG.position.z = k * 0.14; mopG.position.x = Math.cos(t * 4.5) * 0.06; },
      carry(v) { carry.visible = v; arms.forEach(a => { a.rotation.x = v ? -1.1 : 0; }); p.holding = v; },
      /* la clase: el que enseña mueve el brazo, los que escuchan asienten, y al final festejan con un saltito y una lamparita */
      /* usar un mueble del salón: 'sit' (se sienta y gira en la silla), 'play' (se sienta y juega), 'tap' (toca un producto), 'type' (prueba un teclado). Cada tanto le sale un emoji de que le gusta. */
      use(kind, on, seat, emos) { g.rotation.order = 'YXZ';
        if (on) { p.using = kind; p.seat = seat || null; if (seat) { p.seatRy = seat.rotation.y; p.seatK = 0; } p.emos = emos || null; p.emoT = 0.8; return; }
        if (!p.using) return; p.using = null; if (p.seat) { p.seat.rotation.y = p.seatRy; p.seat = null; } g.position.y = 0; g.rotation.x = 0; legs.forEach(l => { l.rotation.x = 0; }); arms.forEach(a => { a.rotation.x = 0; }); },
      emote(ch) { if (!p.emoS) { p.emoS = new T.Sprite(new T.SpriteMaterial({ map: emoTex(ch), transparent: true, depthTest: false })); p.emoS.renderOrder = 9; g.add(p.emoS); } p.emoS.material.map = emoTex(ch); p.emoS.visible = true; p.emoA = 0; },
      gest(v) { p.gesturing = !!v; if (!v) rest(p); },
      nod(v) { p.nodding = !!v; g.rotation.order = 'YXZ'; if (!v) g.rotation.x = 0; },
      hop(sec) { p.hopT = sec || 0.9; },
      idea(v) { if (v && !p.ideaS) { p.ideaS = new T.Sprite(new T.SpriteMaterial({ map: emoTex('💡'), transparent: true, depthTest: false })); p.ideaS.renderOrder = 9; p.ideaS.position.set(0, 2.05, 0); g.add(p.ideaS); } if (p.ideaS) { p.ideaS.visible = !!v; p.ideaT = p.t; } },
      /* siesta: sentado en el piso, piernas estiradas, recostado contra las cajas, ojos cerrados (la respiración va en update) */
      lie(v) { p.sleeping = !!v; if (v && !p.zs) { p.zs = [0, 1, 2].map(i => { const z = new T.Sprite(new T.SpriteMaterial({ map: zTex(), transparent: true, opacity: 0, depthTest: false })); z.renderOrder = 9; z.userData.ph = i / 3; g.add(z); return z; }); } if (p.zs) p.zs.forEach(z => { z.visible = !!v; z.material.opacity = 0; }); g.rotation.order = 'YXZ'; if (v) { p.yaw0 = g.rotation.y; g.rotation.y = 0.5; } else g.rotation.y = p.yaw0 || 0;
        g.rotation.x = v ? -0.4 : 0; g.position.y = v ? -0.3 : 0; g.scale.y = base; sh.visible = !v; legs.forEach((l, i) => { l.rotation.x = v ? -1.42 : 0; l.rotation.z = v ? (i ? 0.16 : -0.16) : 0; });
        arms.forEach((a, i) => { a.rotation.x = v ? -0.5 : 0; a.rotation.z = (i ? 1 : -1) * (v ? -0.1 : 0.16); }); eyes.forEach(e => { e.scale.y = v ? 0.16 : 1.35; }); },
      stop() { p.path = []; p.moving = false; p.onArrive = null; g.position.y = 0; rest(p); },
      remove() { scene.remove(g); const i = people.indexOf(p); if (i >= 0) people.splice(i, 1); }
    };
    people.push(p); return p;
  }
  let zT = null;
  function zTex() { if (zT) return zT; const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d'); x.font = '900 78px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = 12; x.strokeStyle = '#17171c'; x.strokeText('Z', 48, 52); x.fillStyle = '#ffffff'; x.fillText('Z', 48, 52); zT = new T.CanvasTexture(c); return zT; }
  const emoT = {}, tmpV = new T.Vector3();
  function emoTex(ch) { if (emoT[ch]) return emoT[ch]; const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d'); x.font = '72px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 48, 54); return (emoT[ch] = new T.CanvasTexture(c)); }
  /* pizarra de la clase: aparece cuando le enseñás al equipo */
  let board = null;
  function lesson(v, x, z, ry) {
    if (!board) {
      board = new T.Group(); board.visible = false; board.scale.setScalar(0.01); scene.add(board);
      [-0.46, 0.46].forEach(dx => { const l = box(board, 0.05, 1.62, 0.05, 0x3a2f28, dx, 0, -0.1); l.rotation.x = -0.1; }); const bk = box(board, 0.05, 1.5, 0.05, 0x3a2f28, 0, 0, -0.42); bk.rotation.x = 0.22;
      box(board, 1.2, 0.86, 0.05, 0x2b2422, 0, 0.72, 0); box(board, 1.0, 0.04, 0.12, 0x2b2422, 0, 0.7, 0.07);
      const tx = canvasTex(512, 360, (c, W, H) => { c.fillStyle = '#fbfbf7'; c.fillRect(0, 0, W, H); c.fillStyle = '#e10600'; c.fillRect(0, 0, W, 74); c.fillStyle = '#fff'; c.font = '900 46px "Arial Black", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CLASE DE HOY', W / 2, 40);
        [0, 1, 2].forEach(i => { const y = 126 + i * 78; c.fillStyle = '#17171c'; c.beginPath(); c.arc(62, y, 24, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = '900 30px Arial, sans-serif'; c.fillText(String(i + 1), 62, y + 2); c.fillStyle = '#c9c9c2'; c.fillRect(106, y - 16, [250, 200, 280][i], 12); c.fillRect(106, y + 6, [170, 240, 150][i], 12);
          c.strokeStyle = '#1faa4b'; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(424, y); c.lineTo(440, y + 16); c.lineTo(470, y - 18); c.stroke(); }); });
      plane(board, 1.1, 0.77, new T.MeshBasicMaterial({ map: tx }), 0, 1.15, 0.031);
    }
    if (v) { board.position.set(x, 0, z); board.rotation.y = ry || 0; board.visible = true; } board.userData.on = !!v;
  }
  function rest(p) { if (p.sleeping || p.using) return; p.legs.forEach(l => { l.rotation.x = 0; }); if (!p.holding) p.arms.forEach(a => { a.rotation.x = 0; }); }
  function updatePeople(dt) {
    if (board && board.visible) { const k = board.scale.x + ((board.userData.on ? 1.15 : 0) - board.scale.x) * Math.min(1, dt * 9); board.scale.setScalar(Math.max(0.01, k)); if (!board.userData.on && k < 0.03) board.visible = false; }
    for (const p of people) {
      if (p.ideaS && p.ideaS.visible) { const k = Math.min(1, (p.t - p.ideaT) * 5), sz = 0.62 * k * (1 + Math.sin(p.t * 8) * 0.07); p.ideaS.scale.set(sz, sz, 1); }
      if (p.hopT > 0) { p.hopT -= dt; const on = p.hopT > 0; p.group.position.y = on ? Math.abs(Math.sin(p.hopT * 10)) * 0.24 : 0; p.arms.forEach(a => { a.rotation.x = on ? -2.7 : 0; }); }
      else if (!p.moving && p.gesturing) { p.arms[1].rotation.x = -2.25 + Math.sin(p.t * 7) * 0.42; p.arms[0].rotation.x = -0.5 + Math.sin(p.t * 3.5) * 0.22; }
      if (p.emoS && p.emoS.visible) { p.emoA += dt; const u = p.emoA / 1.7, sz = 0.56 * Math.min(1, u * 7) / (p.group.scale.x || 1); p.emoS.position.set(0.1, 2.0 + u * 0.55, 0); p.emoS.scale.set(sz, sz, 1); p.emoS.material.opacity = Math.min(1, (1 - u) * 3); if (u >= 1) p.emoS.visible = false; }
      if (p.using && !p.moving) { const g2 = p.group, A = p.arms, Lg = p.legs;
        if (p.emos && (p.emoT -= dt) <= 0) { p.emote(p.emos[Math.floor(Math.random() * p.emos.length)]); p.emoT = 2.3 + Math.random(); }
        if (p.seat) { p.seat.getWorldPosition(tmpV); p.seatK = Math.min(1, p.seatK + dt * 3.5); g2.position.x += (tmpV.x - g2.position.x) * p.seatK; g2.position.z += (tmpV.z - g2.position.z) * p.seatK; g2.position.y = (tmpV.y + 0.15) * p.seatK;
          if (p.using === 'sit') p.seat.rotation.y = p.seatRy + Math.sin(p.t * 1.7) * 0.5 * p.seatK;
          g2.rotation.y = p.seat.rotation.y; Lg.forEach(l => { l.rotation.x = -1.35 * p.seatK; });
          if (p.using === 'play') { g2.rotation.x = 0.1; A.forEach((a, i) => { a.rotation.x = -1.2 + Math.sin(p.t * 14 + i * 2.2) * 0.17; }); }
          else { const up = Math.max(0, Math.sin(p.t * 1.7 + 0.6)); A.forEach(a => { a.rotation.x = -0.5 - up * up * 2.0; }); } }
        else if (p.using === 'type') { g2.rotation.x = 0.1; A.forEach((a, i) => { a.rotation.x = -1.25 + Math.sin(p.t * 13 + i * 2.4) * 0.18; }); }
        else { g2.rotation.x = 0.09; A[1].rotation.x = -1.4 + Math.sin(p.t * 5) * 0.28; A[0].rotation.x = -0.25; } }
      if (p.nodding && !p.moving && !p.sleeping) p.group.rotation.x = 0.08 + Math.sin(p.t * 6.5) * 0.07;
      p.t += dt;
      const g = p.group;
      if (p.upG != null) { const h2 = p.hd; h2.rotation.x += (-p.upG - h2.rotation.x) * Math.min(1, dt * 6); if (!p.upG && Math.abs(h2.rotation.x) < 0.002) { h2.rotation.x = 0; p.upG = null; } }
      if (p.au) { const k = 1 + Math.sin(p.t * 3.2) * 0.09; p.au.ring.scale.set(k, k, 1); p.au.ring.material.opacity = 0.65 + Math.sin(p.t * 3.2) * 0.2; p.au.col2.rotation.y = p.t * 0.6; p.au.sp.forEach(q => { const u = (p.t * 0.42 + q.userData.ph) % 1, an = q.userData.ph * 6.283 * 2 + p.t * 1.3, sz = 0.26 * Math.sin(u * Math.PI); q.position.set(Math.cos(an) * 0.5, 0.1 + u * 1.75, Math.sin(an) * 0.5); q.scale.set(sz, sz, 1); }); }
      if (p.gf) { const G = p.gf; G.t += dt; const u = Math.min(1, G.t / 1.15), e = u < 0.3 ? 0 : (u - 0.3) / 0.7; G.m.position.set(-0.5 * e, 0.78 + Math.sin(e * Math.PI) * 0.95 + e * 0.4, 0.42 - e * 0.64); G.m.rotation.set(e * 4, e * 3, 0); G.m.scale.setScalar(1 - e * 0.35); p.arms.forEach(a => { a.rotation.x = -1.5 - e * 1.2; }); if (u >= 1) { g.remove(G.m); p.gf = null; p.holding = false; p.arms.forEach(a => { a.rotation.x = 0; }); } }
      if (p.sleeping) { if (p.zs) p.zs.forEach(z => { const u = (p.t / 2.7 + z.userData.ph) % 1, sz = 0.2 + u * 0.3; z.position.set(0.3 + u * 0.5 + Math.sin(u * 7) * 0.07, 1.14 + 0.3 + u * 1.1, 0.25); z.scale.set(sz, sz, 1); z.material.opacity = Math.min(1, u * 5, (1 - u) * 2.5); }); const br = Math.sin(p.t * 2.1); g.rotation.x = -0.4 + br * 0.025; g.scale.y = (g.userData.base || 1) * (1 + br * 0.018); continue; }
      if (p.moving && p.path.length) {
        const tx = p.path[0][0], tz = p.path[0][1], dx = tx - g.position.x, dz = tz - g.position.z, d = Math.hypot(dx, dz), step = p.speed * dt;
        if (d <= step) {
          g.position.x = tx; g.position.z = tz; p.path.shift();
          if (!p.path.length) { p.moving = false; g.position.y = 0; rest(p); const cb = p.onArrive; p.onArrive = null; if (cb) cb(); }
        } else {
          g.position.x += dx / d * step; g.position.z += dz / d * step;
          g.rotation.y = Math.atan2(dx, dz);
          if (!reduceMotion) {                                                  // pasitos: piernas y brazos alternados
            const sw = Math.sin(p.t * (7 + p.speed * 1.6)) * 0.75;
            p.legs[0].rotation.x = sw; p.legs[1].rotation.x = -sw; if (!p.holding) { p.arms[0].rotation.x = -sw * 0.8; p.arms[1].rotation.x = sw * (p.bagOn ? 0.16 : 0.8); }
            g.position.y = Math.abs(sw) * 0.035;
          }
        }
      } else if (!reduceMotion) {
        g.scale.y = (g.userData.base || 1) * (1 + Math.sin(p.t * 2.2) * 0.012);   // respiración
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
    if (best) tapHandler(best); else if (groundHandler) groundHandler(v3.x, v3.z);
  }
  // marca en el piso donde se tocó
  let groundHandler = null, pingM = null, pingT = 0;
  function ping(x, z) { if (!pingM) { pingM = new T.Mesh(new T.RingGeometry(0.28, 0.4, 24), new T.MeshBasicMaterial({ color: 0xf5c518, transparent: true, depthWrite: false })); pingM.rotation.x = -Math.PI / 2; scene.add(pingM); } pingM.position.set(x, 0.03, z); pingT = 0.7; pingM.visible = true; }

  /* ---------- API ---------- */
  function init(cv) {
    canvas = cv;
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
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
    buildCounter(root); buildCenter(root); buildWorkStations(root); buildDepot(root); sideDoor(root, L.depoDoor.z, 'DEPÓSITO'); buildOffice(root); buildTaller(root); sideDoor(root, L.tallerDoor.z, 'TALLER'); buildGallery(root); buildSign(root); buildExtras(root); buildShell(root); buildFleet(root); for (const k in ups.flota) ups.flota[k].position.y = -0.24; buildRoof(root);

    // empleados (inventados): vos en el mostrador y Brian, pegado al celular, en la caja
    yo = makePerson({ shirt: 0xe10600, hair: 0x2b2b3a, skin: SKINS[1], speed: 7.5 }); yo.setPos(L.yoMostrador[0], L.yoMostrador[1]);
    // compañeros (inventados): andan por el local haciendo sus cosas. Lucho, de mohicano y anteojos, y Brian, pegado al celular.
    lucho = makePerson({ shirt: 0xe10600, hair: 0xff5fa2, hairStyle: 'mohicano', skin: GS.SKINS[3], glasses: true, speed: 2.6 }); lucho.setPos(4.0, 0.8);
    brian = makePerson({ shirt: 0xe10600, hair: 0x2d6cdf, skin: SKINS[0], phone: true, speed: 2.3 }); brian.setPos(4.5, -1.2); brian.face(-0.6);
    boss = makePerson(Object.assign({}, GS.BOSS_LOOK, { scale: 1.18, speed: 3.4 })); boss.setPos(BOSS_HOME[0], BOSS_HOME[1]);

    setupInput(); resize(true); updateWalls(); ok = true; return true;
  }
  function resize(reset) {
    if (!renderer) return;
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    const cap = quality === 'alta' ? 2.5 : quality === 'media' ? 2 : 1.5;          /* en pantallas de celular (3x) menos que esto se ve pixelado */
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const old = cam.fit; cam.fit = fitDistance(9.1);
    if (reset || !old) { cam.dist = cam.gdist = cam.fit; } else { cam.gdist *= cam.fit / old; cam.dist = cam.gdist; }
    clampCam(); applyCam();
  }
  function update(dt, camDt) {
    if (disp) { const d = disp, k = d.k, x0 = k.userData.x0; d.t += dt;                                       /* arranca, acelera, se pierde por la calle y al rato vuelve por el otro lado */
      if (d.t < 0) { }
      else if (d.t < 0.45) { k.position.y = Math.abs(Math.sin(d.t * 40)) * 0.025; }
      else if (d.t < 3.2) { const u = d.t - 0.45; k.position.y = 0; k.position.x = x0 + 4.6 * u * u; k.rotation.z = Math.min(0.05, u * 0.1); k.visible = k.position.x < x0 + 30; }
      else if (d.t < 6.5) { k.visible = false; k.rotation.z = 0; }
      else if (d.t < 8.7) { const u = (d.t - 6.5) / 2.2, e = 1 - (1 - u) * (1 - u); k.visible = true; k.position.x = x0 - 24 * (1 - e); }
      else { k.position.set(x0, 0, k.userData.z0); k.visible = true; disp = null; }
      if (d.cam) { if (d.t < 2.5) { cam.gx = Math.min(k.position.x, x0 + 5) + 1.2; cam.gz = k.userData.z0 - 1.2; cam.gdist = cam.fit * 0.46; } else { d.cam = false; cam.gx = d.ret.x; cam.gz = d.ret.z; cam.gdist = d.ret.d; } }
    }
    if (slideDoors.length) { let near = false; const zD = L.salon.zMax, hw = L.galeria.pasillo + 0.4; for (const q of people) { const gp = q.group.position; if (q.group.visible && q.group.parent && Math.abs(gp.z - zD) < 1.6 && Math.abs(gp.x) < hw) { near = true; break; } }
      doorK += ((near ? 1 : 0) - doorK) * Math.min(1, dt * 7); slideDoors.forEach(d => { d.g.position.x = d.x0 + d.sd * doorK * (L.galeria.pasillo - 0.3); }); }
    if (!ok) return;
    if (drone) { const D = drone; D.t += camDt != null ? camDt : dt; const u0 = reduceMotion ? 1 : Math.min(1, D.t / D.dur), u = u0 * u0 * (3 - 2 * u0), lp = (a, b) => a + (b - a) * u;      /* vuelo de dron: de la puerta, a ras del piso, hasta la vista normal del local */
      tilt = lp(D.tilt, tiltBase); stVy = lp(D.vy, 0); stTy = lp(D.ty, 0.8); cam.tx = lp(D.x, cam.gx); cam.tz = lp(D.z, cam.gz); cam.dist = lp(D.d, cam.gdist); if (u0 >= 1) drone = null; applyCam(); updateWalls(); return; }
    const k = reduceMotion ? 1 : 1 - Math.pow(0.002, camDt != null ? camDt : dt);      /* la cámara se sigue acomodando aunque el juego esté en pausa */
    cam.tx += (cam.gx - cam.tx) * k; cam.tz += (cam.gz - cam.tz) * k; cam.dist += (cam.gdist - cam.dist) * k; stTy += (stTyG - stTy) * k;
    applyCam(); updatePeople(dt);
    if (pingT > 0) { pingT -= dt; const k = 1 - pingT / 0.7; pingM.scale.setScalar(0.6 + k * 0.9); pingM.material.opacity = 1 - k; if (pingT <= 0) pingM.visible = false; }
    if (critters.length) updateCritters(dt);
    if (roofG) { const o = U.clamp((cam.dist / cam.fit - 1.42) / 0.16, 0, 1); roofG.visible = o > 0.02; if (roofG.visible) roofMats.forEach(m => { m.opacity = o; }); if (roofG.visible !== roofOn) { roofOn = roofG.visible; applyUpgrades(lastUp); } }
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
    setPlayerLook(a) { if (yo && a) yo.look(a); if (stg && stg.clone && a) stg.clone.look(a); },
    /* escenario: el personaje parado en la puerta del local, con la cámara baja y cerca (menú y editor de personaje) */
    stage(o) {
      if (!o) { if (!stg) return; if (stg.clone) stg.clone.remove(); if (stg.save) { const s = stg.save; cam.gx = cam.tx = s.x; cam.gz = cam.tz = s.z; cam.gdist = cam.dist = s.d; cam.saved = s.saved; } tilt = tiltBase; stVy = 0; stTy = stTyG = 0.8; stg = null; drone = null; applyCam(); return; }
      const pos = [L.puerta.x, L.galeria.zMax + 1.25]; drone = null;
      if (!stg) { stg = { save: o.clone ? { x: cam.gx, z: cam.gz, d: cam.gdist, saved: cam.saved } : null, clone: null }; if (o.clone) { stg.clone = makePerson(Object.assign({}, o.look)); } else if (yo) { yo.stop(); } }
      const who = stg.clone || yo, was = stg.on; stg.on = true; if (who && !(o.soft && was)) { who.setPos(pos[0], pos[1]); who.face(rot); }
      tilt = 0.3; stVy = o.vy || 0; cam.saved = null; cam.gx = pos[0]; cam.gz = pos[1]; cam.gdist = cam.fit * (o.k || 0.15); stTyG = o.ty != null ? o.ty : 0.8;
      if (!(o.soft && was)) { cam.tx = cam.gx; cam.tz = cam.gz; cam.dist = cam.gdist; stTy = stTyG; } applyCam();      /* soft: la cámara viaja suave hasta el nuevo encuadre (cabeza, ropa, cuerpo entero) */
    },
    staged: () => !!stg,
    stageSpin(d) { const who = stg && (stg.clone || yo); if (who) who.group.rotation.y += d; },
    droneHome(dur) { if (!stg) return; const D = { t: 0, dur: dur || 2.6, tilt, vy: stVy, ty: stTy, x: cam.tx, z: cam.tz, d: cam.dist }; stg = null; stTyG = 0.8; cam.saved = null; cam.gx = 0; cam.gz = 0.2; cam.gdist = cam.fit; drone = D; },
    // El Dueño: un solo personaje que vive en su oficina
    // Hora del día (0 = 10 hs, 1 = 19 hs): cambia la luz, el color de la vereda y prende los faroles al anochecer
    setDayTime(f, rain) {
      if (!sky.hemi) return;
      const K = [0, 0.35, 0.62, 0.85, 1], at = arr => { for (let i = 1; i < K.length; i++) if (f <= K[i]) return [arr[i - 1], arr[i], (f - K[i - 1]) / (K[i] - K[i - 1])]; return [arr[4], arr[4], 0]; };
      const col = arr => { const q = at(arr); return new T.Color(q[0]).lerp(new T.Color(q[1]), q[2]); }, num = arr => { const q = at(arr); return q[0] + (q[1] - q[0]) * q[2]; };
      const wet = rain ? 0.68 : 1, n = U.clamp((f - 0.7) / 0.25, 0, 1);
      sky.side.color.copy(col([0x868d98, 0x9c9ca0, 0xb0977c, 0x86687a, 0x3d4058])).multiplyScalar(wet); sky.joint.color.copy(sky.side.color).multiplyScalar(0.82);
      sky.hemi.color.copy(col([0xeaf2ff, 0xffffff, 0xfff0dc, 0xfff4ea, 0xfff6ec])); sky.hemi.intensity = num([0.66, 0.68, 0.67, 0.67, 0.68]) * (rain ? 0.9 : 1);
      sky.sun.color.copy(col([0xfff4e0, 0xffffff, 0xffdcb0, 0xffe2c0, 0xfff1dc])); sky.sun.intensity = num([0.32, 0.38, 0.36, 0.34, 0.34]) * (rain ? 0.9 : 1);   // adentro siempre a pleno: de noche lo que cambia es la vereda sky.sun.position.x = 9 - f * 11;
      sky.spill.opacity = n * 0.34 + (rain ? 0.08 : 0); sky.halo.opacity = n * 0.6; if (sky.cone) sky.cone.opacity = n * 0.1; sky.bulb.color.set(0x55555c).lerp(new T.Color(0xfff2c0), n);
    },
    setXmas,
    setHats(on) { [yo, lucho, brian, boss].forEach(p => { if (p) p.look({ hat: on ? 'gorro' : null }); }); },
    setNext() {},
    addDirt, clearDirt, removeDirt, setRegion,
    bossVisible(v) { if (boss) boss.group.visible = v; },
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
    onTap(fn) { tapHandler = fn; }, onGround(fn) { groundHandler = fn; }, ping,
    // Posición en pantalla de un punto del mundo (para barras y globos en HTML)
    project(x, y, z) {
      pv.set(x, y, z).project(camera);
      return { x: (pv.x * 0.5 + 0.5) * canvas.clientWidth, y: (-pv.y * 0.5 + 0.5) * canvas.clientHeight, ok: pv.z < 1 };
    },
    // Acercar la cámara a una estación; null = volver a la vista anterior
    // biasY / biasX: fracción de pantalla que se corre la estación (para que no la tape el panel)
    focus(station, biasY, biasX) {
      if (station && disp && disp.cam) { disp.cam = false; cam.saved = disp.ret; }          /* si se abre otra tarea, la cámara deja de seguir al reparto */
      if (!station && disp && disp.cam) { if (cam.saved) { disp.ret = cam.saved; cam.saved = null; } return; }
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
    home() { cam.saved = null; if (disp) disp.cam = false; cam.gx = 0; cam.gz = 0.2; cam.gdist = cam.fit; },
    // El vehículo de la flota sale a repartir (después de despachar una compra por la página). Devuelve false si no hay vehículo.
    dispatch() { const k = fleetK[lastUp.flota || 0]; if (!k || disp || roofOn) return false; disp = { k, t: -0.8, cam: true, ret: cam.saved ? Object.assign({}, cam.saved) : { x: cam.gx, z: cam.gz, d: cam.gdist } }; return true; },
    zoomAt(x, z, k) { if (disp && disp.cam) { disp.cam = false; cam.saved = disp.ret; } if (!cam.saved) cam.saved = { x: cam.gx, z: cam.gz, d: cam.gdist }; cam.gx = x; cam.gz = z; cam.gdist = cam.fit * k; },
    seatOf: (id, n) => { const k = pieces[id]; return k && k.userData.seats ? k.userData.seats[n || 0] : null; },
    debugScene: () => scene,
    lesson,
    debugTilt(v) { tilt = v; },
    debugCam(x, z, k) { cam.saved = null; cam.gx = x; cam.gz = z; cam.gdist = cam.fit * k; },
    showAll() { cam.saved = null; cam.gx = 0; cam.gz = 2.4; cam.gdist = cam.fit * 1.28; }
  };
})();
