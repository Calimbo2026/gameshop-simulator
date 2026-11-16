/* GameShop Simulator — Mapa 3D del país. Argentina con su forma real (Malvinas incluidas), dividida en las 5 regiones,
   vista en ángulo como el local. Cada región abierta muestra una miniatura de su sucursal; las cerradas, un candado.
   GS.Map3D.open(canvas, estado, onPick)   estado = { id: { open, can, cur, stage } }   ·   select(id)   ·   close() */
GS.Map3D = (() => {
  const T = THREE; let renderer = null, scene, camera, cv, raf = 0, onPick = null, tops = {}, bob = [], sel = null, cvOf = null, zc = null;
  // Fronteras (longitud, latitud). Se arman las regiones uniendo tramos, así los bordes internos coinciden.
  const S = {
    nNoa: [[-67.18, -22.82], [-66.3, -21.8], [-65.2, -22.1], [-64.4, -22.7], [-63.9, -22.0], [-62.8, -22.0], [-62.35, -22.45]],
    nNea: [[-62.35, -22.45], [-61.0, -23.8], [-59.9, -24.1], [-58.8, -24.8], [-57.65, -25.3], [-58.2, -26.6], [-58.6, -27.3], [-57.5, -27.4], [-56.4, -27.5], [-55.9, -27.35], [-55.3, -26.9], [-54.7, -26.3], [-54.6, -25.6], [-54.1, -25.55], [-53.65, -26.25], [-53.8, -27.15], [-54.8, -27.6], [-55.8, -28.3], [-56.6, -29.0], [-57.3, -29.8], [-57.8, -30.6]],
    ePam: [[-57.8, -30.6], [-58.0, -31.4], [-58.2, -32.4], [-58.5, -33.1], [-58.4, -34.0], [-58.35, -34.6], [-57.9, -34.85], [-57.2, -35.4], [-57.4, -36.0], [-56.7, -36.35], [-56.95, -37.25], [-57.55, -38.05], [-58.75, -38.6], [-60.0, -38.9], [-61.3, -39.0], [-62.2, -38.85], [-62.1, -39.6], [-62.2, -40.5], [-62.8, -41.15]],
    ePat: [[-62.8, -41.15], [-63.8, -41.15], [-64.9, -40.75], [-65.15, -41.4], [-64.95, -42.0], [-64.4, -42.15], [-63.9, -42.1], [-63.6, -42.5], [-64.0, -42.85], [-64.4, -42.6], [-65.0, -42.75], [-64.4, -43.0], [-65.0, -43.3], [-65.3, -44.2], [-65.6, -45.0], [-66.5, -45.2], [-67.5, -45.9], [-67.6, -46.5], [-66.7, -47.0], [-65.8, -47.2], [-65.9, -47.9], [-67.0, -48.7], [-67.7, -49.3], [-68.3, -50.1], [-69.0, -50.9], [-68.9, -51.6], [-68.35, -52.35]],
    wPat: [[-68.35, -52.35], [-69.5, -52.15], [-70.0, -52.0], [-71.9, -52.0], [-72.3, -51.0], [-73.1, -50.2], [-73.3, -49.5], [-72.6, -48.6], [-72.3, -47.6], [-71.8, -46.8], [-71.7, -45.8], [-71.4, -44.8], [-71.8, -43.9], [-71.75, -43.0], [-72.1, -42.2], [-71.85, -41.4], [-71.9, -40.6], [-71.7, -39.8], [-71.2, -39.0], [-70.9, -38.4], [-71.15, -37.6], [-71.1, -36.8], [-70.4, -36.2]],
    wCuy: [[-70.4, -36.2], [-70.4, -35.3], [-69.8, -34.3], [-69.9, -33.3], [-70.1, -32.5], [-70.5, -31.5], [-69.9, -30.3], [-70.0, -29.3], [-69.7, -28.4]],
    wNoa: [[-69.7, -28.4], [-69.1, -27.6], [-68.5, -27.1], [-68.5, -26.3], [-68.5, -25.2], [-68.4, -24.5], [-67.3, -24.0], [-67.0, -23.0], [-67.18, -22.82]],
    noaNea: [[-62.35, -22.45], [-62.3, -24.1], [-61.7, -25.7], [-61.7, -28.0]],
    neaPam: [[-61.7, -28.0], [-59.0, -28.0], [-59.2, -29.2], [-59.6, -30.35], [-57.8, -30.6]],
    noaPam: [[-61.7, -28.0], [-61.8, -29.2], [-62.1, -30.2], [-63.4, -29.9], [-64.9, -29.5], [-65.4, -30.1], [-65.8, -31.9]],
    noaCuy: [[-65.8, -31.9], [-67.0, -31.9], [-67.3, -31.0], [-67.9, -30.2], [-68.7, -29.4], [-69.7, -28.4]],
    cuyPam: [[-65.8, -31.9], [-65.0, -32.6], [-64.9, -33.3], [-65.1, -34.2], [-65.1, -36.0], [-68.25, -36.0], [-68.25, -37.55]],
    cuyPat: [[-68.25, -37.55], [-69.5, -37.1], [-70.4, -36.2]],
    pamPat: [[-68.25, -37.55], [-67.5, -38.0], [-66.0, -38.6], [-64.5, -39.1], [-63.4, -39.2], [-63.4, -40.6], [-62.8, -41.15]]
  };
  const rv = a => a.slice().reverse(), join = (...a) => a.reduce((o, s) => o.concat(o.length ? s.slice(1) : s), []);
  const REG = {
    noa: { col: 0xd9683c, at: [-65.4, -26.2], polys: [join(S.nNoa, S.noaNea, S.noaPam, S.noaCuy, S.wNoa)] },
    nea: { col: 0x3f9d4d, at: [-58.9, -26.6], polys: [join(S.nNea, rv(S.neaPam), rv(S.noaNea))] },
    cuyo: { col: 0xc58a55, at: [-67.9, -33.6], polys: [join(S.cuyPam, S.cuyPat, S.wCuy, rv(S.noaCuy))] },
    pampeana: { col: 0x8bbf4a, at: [-61.6, -35.0], polys: [join(S.neaPam, S.ePam, rv(S.pamPat), rv(S.cuyPam), rv(S.noaPam))] },
    patagonia: { col: 0x8fb9dc, at: [-68.7, -43.6], polys: [join(S.pamPat, S.ePat, S.wPat, rv(S.cuyPat)),
      [[-68.6, -52.65], [-68.1, -53.1], [-67.6, -53.9], [-66.6, -54.45], [-65.15, -54.65], [-66.4, -55.0], [-67.6, -54.9], [-68.6, -54.9]],                 // Tierra del Fuego
      [[-64.7, -54.72], [-63.85, -54.72], [-64.2, -54.9]]                                                                                                     // Isla de los Estados
      ] },
    malvinas: { col: 0x7fb07a, at: [-58.75, -51.75], polys: [[[-61.3, -51.45], [-60.5, -51.3], [-59.75, -51.45], [-59.9, -52.0], [-60.6, -52.25], [-61.1, -51.95]],      // Gran Malvina
      [[-59.55, -51.4], [-58.6, -51.25], [-57.75, -51.55], [-58.3, -52.0], [-59.0, -52.35], [-59.6, -52.0]]] }                                                           // Soledad
  };
  const X = lon => (lon + 64.6) * 0.8, Y = lat => lat + 38.6;              // proyección simple: 1 grado de latitud = 1 unidad
  const M = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  function box(g, w, h, d, c, x, y, z) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), c.isMaterial ? c : M(c)); m.position.set(x, y + h / 2, z); g.add(m); return m; }
  function cone(g, r, h, c, x, y, z, seg) { const m = new T.Mesh(new T.ConeGeometry(r, h, seg || 6), M(c, { flatShading: true })); m.position.set(x, y + h / 2, z); g.add(m); return m; }
  function label(text, sub, px) {
    const c = document.createElement('canvas'); c.width = 384; c.height = 128; const g = c.getContext('2d');
    g.font = '900 ' + (px || 54) + 'px Impact, "Arial Narrow", system-ui, sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = '#0b0b0d'; g.strokeText(text, 192, 58); g.fillStyle = '#fff'; g.fillText(text, 192, 58);
    if (sub) { g.font = '700 34px system-ui, sans-serif'; g.lineWidth = 9; g.strokeText(sub, 192, 106); g.fillStyle = '#f5c518'; g.fillText(sub, 192, 106); }
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(6, 2, 1); s.renderOrder = 9; return s;
  }
  // Miniatura caricaturizada de la sucursal, con algo típico de la región al lado
  function miniShop(id, stage) {
    const g = new T.Group(), k = 0.9 + stage * 0.1;
    box(g, 2.2 * k, 1.3, 1.6, 0xf4f4f2, 0, 0, 0); box(g, 2.4 * k, 0.2, 1.8, 0x1b1b1f, 0, 1.3, 0); box(g, 2.3 * k, 0.5, 0.14, 0xe10600, 0, 0.82, 0.86); box(g, 0.5, 0.7, 0.1, 0x23232b, 0, 0, 0.84);
    box(g, 0.55, 0.45, 0.1, 0x7fd4ff, -0.68 * k, 0.22, 0.84); box(g, 0.55, 0.45, 0.1, 0x7fd4ff, 0.68 * k, 0.22, 0.84); box(g, 1.0, 0.12, 0.12, 0xffffff, 0, 1.0, 0.94);
    if (stage >= 2) box(g, 2.3 * k, 0.1, 0.5, 0xf5c518, 0, 0.62, 1.1); if (stage >= 3) { const st = new T.Mesh(new T.OctahedronGeometry(0.42), new T.MeshBasicMaterial({ color: 0xf5c518 })); st.position.set(0, 2.2, 0); g.add(st); bob.push({ o: st, y: 2.2, a: 0.18, spin: 1 }); }
    if (id === 'pampeana') { box(g, 0.34, 2.4, 0.34, 0xffffff, 1.9, 0, 0.2); cone(g, 0.26, 0.5, 0xffffff, 1.9, 2.4, 0.2, 4).rotation.y = Math.PI / 4; }                                    // obelisco
    if (id === 'cuyo') { cone(g, 1.3, 2.4, 0x8a7a6a, -1.9, 0, -0.5, 6); cone(g, 0.5, 0.9, 0xffffff, -1.9, 1.52, -0.5, 6); box(g, 0.4, 0.5, 0.4, 0x7a4a22, 1.7, 0, 0.5); box(g, 0.3, 0.3, 0.3, 0x6a2d7a, 1.7, 0.5, 0.5); }   // cordillera, barrica y uvas
    if (id === 'noa') { cone(g, 1.4, 1.8, 0xc2452d, -1.9, 0, -0.5, 7); cone(g, 1.0, 1.3, 0xe3c34a, -1.9, 0.52, -0.5, 7); cone(g, 0.55, 0.75, 0x8e4a8f, -1.9, 1.08, -0.5, 7); box(g, 0.22, 1.3, 0.22, 0x2f8f3a, 1.7, 0, 0.4); box(g, 0.6, 0.18, 0.18, 0x2f8f3a, 1.7, 0.6, 0.4); box(g, 0.18, 0.4, 0.18, 0x2f8f3a, 1.98, 0.6, 0.4); box(g, 0.18, 0.5, 0.18, 0x2f8f3a, 1.42, 0.6, 0.4); }   // cerro de colores y cardón
    if (id === 'nea') { [[-1.8, 0], [1.8, 0.3]].forEach(q => { box(g, 0.2, 1.8, 0.2, 0x7a5a36, q[0], 0, q[1]); for (let i = 0; i < 5; i++) { const l = box(g, 1.1, 0.08, 0.3, 0x1f7a34, q[0] + Math.cos(i * 1.26) * 0.45, 1.75, q[1] + Math.sin(i * 1.26) * 0.45); l.rotation.y = -i * 1.26; l.rotation.z = -0.4; } }); }   // palmeras
    if (id === 'patagonia') { cone(g, 1.4, 2.6, 0x6f7f95, -2.0, 0, -0.5, 6); cone(g, 0.6, 1.1, 0xffffff, -2.0, 1.52, -0.5, 6); [0, 1, 2].forEach(i => cone(g, 0.6 - i * 0.14, 0.8, 0x1f6a3a, 1.8, 0.25 + i * 0.5, 0.4, 7)); box(g, 0.16, 0.3, 0.16, 0x6b4a2a, 1.8, 0, 0.4); }   // cerro nevado y pino
    return g;
  }
  function padlock(can) {
    const g = new T.Group(), m = M(can ? 0xf5c518 : 0x9a9aa6); box(g, 1.5, 1.2, 0.6, m, 0, 0, 0);
    const sh = new T.Mesh(new T.TorusGeometry(0.48, 0.14, 8, 14, Math.PI), M(0xd7d7de)); sh.position.set(0, 1.2, 0); g.add(sh); box(g, 0.22, 0.4, 0.1, 0x23232b, 0, 0.4, 0.32); return g;
  }
  function build(state) {
    scene = new T.Scene(); tops = {}; bob = [];
    scene.add(new T.HemisphereLight(0xffffff, 0x5a6a80, 0.62)); const d = new T.DirectionalLight(0xffffff, 0.42); d.position.set(8, 20, 12); scene.add(d);
    const sea = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshBasicMaterial({ color: 0x12304f })); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.05; scene.add(sea);
    for (const id in REG) {
      const R = REG[id], st = state[id] || {}, h = st.open ? (st.cur ? 1.25 : 0.9) : 0.45, top = M(st.open ? R.col : st.hidden ? 0x7d8794 : 0x565a66), side = M(st.open ? new T.Color(R.col).multiplyScalar(0.62) : 0x363944), grp = new T.Group(); grp.userData.h = h; scene.add(grp); tops[id] = { grp, top, base: top.color.clone(), meshes: [] };
      R.polys.forEach(poly => { const sh = new T.Shape(); poly.forEach((p, i) => i ? sh.lineTo(X(p[0]), Y(p[1])) : sh.moveTo(X(p[0]), Y(p[1])));
        const geo = new T.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); const m = new T.Mesh(geo, [top, side]); if (!st.hidden) m.userData.reg = id; grp.add(m); tops[id].meshes.push(m); });
      if (st.hidden) continue;                                   // las islas se ven, pero sin candado ni cartel hasta que se destraban
      const px = X(R.at[0]), pz = -Y(R.at[1]), it = st.open ? miniShop(id, st.stage || 1) : padlock(st.can); if (id === 'malvinas') it.scale.setScalar(0.62); it.position.set(px, h, pz); it.traverse(o => { o.userData.reg = id; }); grp.add(it); tops[id].meshes.push(it);
      if (st.flag) { const fx = px - 1.6, fz = pz + 0.2; box(grp, 0.12, 4.2, 0.12, 0xe8e8e8, fx, h, fz); [0x74acdf, 0xffffff, 0x74acdf].forEach((c, i) => box(grp, 2.1, 0.42, 0.06, new T.MeshBasicMaterial({ color: c }), fx + 1.1, h + 3.75 - i * 0.42, fz)); const sun = new T.Mesh(new T.CircleGeometry(0.15, 12), new T.MeshBasicMaterial({ color: 0xf5c518 })); sun.position.set(fx + 1.1, h + 3.54, fz + 0.04); grp.add(sun); }   // la bandera
      if (!st.open) bob.push({ o: it, y: h + 0.3, a: st.can ? 0.35 : 0.08, sp: st.can ? 4 : 1.5 });
      if (st.cur) { const pin = cone(grp, 0.5, 1.0, 0xf5c518, px, 0, pz, 4); pin.rotation.x = Math.PI; bob.push({ o: pin, y: h + 4.1, a: 0.3, sp: 3, spin: 2 }); }
      const g = (GS.REGIONS.find(r => r.id === id) || {}), lb = label((g.name || id).toUpperCase(), st.open ? g.city : st.can ? '¡Se puede abrir!' : ''); lb.position.set(px, h + (st.open ? 3.3 : 2.6), pz + 0.2); grp.add(lb);
    }
    if ((state.malvinas || {}).hidden) { const mv = label('ISLAS MALVINAS', '', 40); mv.scale.set(4.5, 1.5, 1); mv.position.set(X(-59.5), 1.6, -Y(-51.0)); scene.add(mv); }
  }
  function fit() {
    const w = cv.clientWidth || 300, h = cv.clientHeight || 400, a = w / h, half = zc ? 4.2 : Math.max(14.6, 10.2 / a);       // el país entra entero, parado o apaisado
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, h, false);
    camera.left = -half * a; camera.right = half * a; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
  }
  function frame(t) {
    raf = requestAnimationFrame(frame); const s = t / 1000;
    bob.forEach(b => { b.o.position.y = b.y + Math.sin(s * (b.sp || 2)) * b.a; if (b.spin) b.o.rotation.y = s * b.spin; });
    for (const id in tops) { const k = id === sel ? 0.1 + Math.sin(s * 5) * 0.05 : 0; tops[id].top.emissive.setScalar(k); }
    renderer.render(scene, camera);
  }
  function pick(e) {
    const r = cv.getBoundingClientRect(), v = new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), rc = new T.Raycaster(); rc.setFromCamera(v, camera);
    const hit = rc.intersectObjects(scene.children, true).find(h => h.object.userData.reg); if (hit && onPick) onPick(hit.object.userData.reg);
  }
  function open(canvas, state, cb, zoomTo) {
    close(); cv = canvas; onPick = cb; sel = null;
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { renderer = null; return false; }
    camera = new T.OrthographicCamera(-10, 10, 10, -10, 0.1, 400); const c = new T.Vector3(0.9, 0, 0.4), el = 48 * Math.PI / 180, az = -6 * Math.PI / 180, D = 120;
    camera.position.set(c.x + Math.sin(az) * Math.cos(el) * D, Math.sin(el) * D, c.z + Math.cos(az) * Math.cos(el) * D); camera.lookAt(c);
    if (zoomTo && REG[zoomTo]) { zc = [X(REG[zoomTo].at[0]), -Y(REG[zoomTo].at[1])]; camera.position.x += zc[0] - c.x; camera.position.z += zc[1] - c.z; } else zc = null;
    build(state); fit(); cvOf = pick; canvas.addEventListener('click', pick); window.addEventListener('resize', fit); raf = requestAnimationFrame(frame); return true;
  }
  function close() { if (raf) cancelAnimationFrame(raf); raf = 0; if (cv && cvOf) cv.removeEventListener('click', cvOf); window.removeEventListener('resize', fit); if (renderer) { renderer.dispose(); renderer = null; } cv = null; }
  return { open, close, select(id) { sel = id; }, isOpen: () => !!renderer };
})();
