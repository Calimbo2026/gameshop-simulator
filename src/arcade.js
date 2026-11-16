/* GameShop Simulator — Arcade: tres juegos cortos (1 a 2 minutos) que se ganan avanzando en el modo carrera.
   Dan cosméticos, no monedas.  GS.Arcade.open(id, onEnd(score, won))  ·  GS.ARCADE = lista de juegos. */
GS.ARCADE = [
  { id: 'tetris', ic: '📦', name: 'Stock Tetris', d: 'Acomodá las cajas del depósito sin dejar huecos.', from: 3, goal: 600, prize: 'casco', prizeName: 'Casco del depósito', keys: '◀ ▶ mover · ⟳ girar · ▼ bajar' },
  { id: 'defensa', ic: '🙂', name: 'Defensa del mostrador', d: 'Respondé las quejas con sonrisas. Los % son descuentos: valen doble.', from: 8, goal: 900, prize: 'corona', prizeName: 'Corona de la atención', keys: '◀ ▶ mover · 🙂 sonreír' },
  { id: 'runner', ic: '🔌', name: 'Cable Runner', d: 'Corré por el taller saltando cables y cajas. Juntá joysticks.', from: 14, goal: 700, prize: 'vincha', prizeName: 'Vincha de velocista', keys: '⤒ saltar (dos veces = doble salto)' }
];
GS.Arcade = (() => {
  const W = 320, H = 480; let cv, g, raf = 0, G = null, keys = {}, onEnd = null, def = null, last = 0;
  const el = id => document.getElementById(id), R = (a, b) => a + Math.random() * (b - a);
  const COL = ['#e10600', '#f5c518', '#2d6cdf', '#3bb54a', '#7b4fd1', '#ff5fa2', '#21a0a0'];
  function rr(x, y, w, h, c, r) { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, r == null ? 4 : r); g.fill(); }
  function txt(t, x, y, s, c, al) { g.font = '700 ' + s + 'px system-ui, sans-serif'; g.fillStyle = c || '#fff'; g.textAlign = al || 'center'; g.fillText(t, x, y); }
  /* ---------- Stock Tetris ---------- */
  const SH = [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]]];
  const tetris = {
    init() { const s = { grid: Array.from({ length: 16 }, () => Array(9).fill(0)), t: 0, fall: 0, sp: 0.7, left: 110, mv: 0 }; this.spawn(s); return s; },
    spawn(s) { const k = Math.floor(Math.random() * 7); s.p = { m: SH[k].map(r => r.slice()), c: k + 1, x: 3, y: 0 }; if (this.hit(s, s.p.m, s.p.x, s.p.y)) s.over = true; },
    hit(s, m, x, y) { return m.some((r, j) => r.some((v, i) => v && (x + i < 0 || x + i >= 9 || y + j >= 16 || (y + j >= 0 && s.grid[y + j][x + i])))); },
    rot(m) { return m[0].map((_, i) => m.map(r => r[i]).reverse()); },
    lock(s) { const p = s.p; p.m.forEach((r, j) => r.forEach((v, i) => { if (v && p.y + j >= 0) s.grid[p.y + j][p.x + i] = p.c; })); let n = 0; s.grid = s.grid.filter(r => r.some(v => !v) || (n++, false)); while (s.grid.length < 16) s.grid.unshift(Array(9).fill(0)); if (n) { G.score += [0, 100, 250, 450, 700][n]; GS.Audio.play('ok'); s.sp = Math.max(0.22, s.sp - 0.02 * n); } G.score += 5; this.spawn(s); },
    press(s, k, rep) { const p = s.p; if (k === 'l' && !this.hit(s, p.m, p.x - 1, p.y)) p.x--; if (k === 'r' && !this.hit(s, p.m, p.x + 1, p.y)) p.x++; if ((k === 'l' || k === 'r') && !rep) s.mv = 0.26; /* un toque = un casillero; si se mantiene apretado, empieza a repetir */ if (k === 'a') { const m = this.rot(p.m); for (const dx of [0, -1, 1, -2]) if (!this.hit(s, m, p.x + dx, p.y)) { p.m = m; p.x += dx; break; } } if (k === 'd') { while (!this.hit(s, p.m, p.x, p.y + 1)) p.y++; this.lock(s); } },
    step(s, dt) { s.left -= dt; s.fall += dt; s.mv -= dt; if (s.mv <= 0) { if (keys.l) { this.press(s, 'l', true); s.mv = 0.11; } else if (keys.r) { this.press(s, 'r', true); s.mv = 0.11; } } if (s.fall > s.sp) { s.fall = 0; if (this.hit(s, s.p.m, s.p.x, s.p.y + 1)) this.lock(s); else s.p.y++; } if (s.left <= 0) s.over = true; },
    draw(s) { const c = 26, ox = (W - 9 * c) / 2, oy = 52; rr(ox - 4, oy - 4, 9 * c + 8, 16 * c + 8, '#1b1b20', 8); const cell = (x, y, k) => { rr(ox + x * c + 1, oy + y * c + 1, c - 2, c - 2, '#c99a5b', 3); rr(ox + x * c + 1, oy + y * c + c / 2 - 3, c - 2, 6, COL[k - 1], 0); };
      s.grid.forEach((r, y) => r.forEach((v, x) => v && cell(x, y, v))); s.p.m.forEach((r, j) => r.forEach((v, i) => v && s.p.y + j >= 0 && cell(s.p.x + i, s.p.y + j, s.p.c))); }
  };
  /* ---------- Defensa del mostrador ---------- */
  const defensa = {
    init() { const s = { x: W / 2, shots: [], foes: [], t: 0, cd: 0, dir: 1, left: 90, wave: 0, drop: [] }; this.wave(s); return s; },
    wave(s) { s.wave++; for (let j = 0; j < 3 + Math.min(2, s.wave - 1); j++) for (let i = 0; i < 6; i++) s.foes.push({ x: 40 + i * 44, y: 60 + j * 36, k: Math.random() < 0.15 ? 1 : 0 }); },
    press(s, k) { if (k === 'a' && s.cd <= 0) { s.shots.push({ x: s.x, y: H - 86 }); s.cd = 0.28; GS.Audio.play('click'); } },
    step(s, dt) { s.left -= dt; s.cd -= dt; if (keys.l) s.x -= 210 * dt; if (keys.r) s.x += 210 * dt; s.x = Math.max(20, Math.min(W - 20, s.x)); if (keys.a) this.press(s, 'a');
      const sp = (16 + s.wave * 7 + (30 - Math.min(30, s.foes.length)) * 1.2) * dt; let edge = false; s.foes.forEach(f => { f.x += s.dir * sp; if (f.x < 16 || f.x > W - 16) edge = true; }); if (edge) { s.dir *= -1; s.foes.forEach(f => { f.y += 14; f.x += s.dir * 4; }); }
      s.shots.forEach(b => b.y -= 380 * dt); s.shots = s.shots.filter(b => b.y > 30);
      for (const b of s.shots) for (const f of s.foes) if (!f.dead && !b.dead && Math.abs(b.x - f.x) < 17 && Math.abs(b.y - f.y) < 16) { f.dead = b.dead = true; G.score += f.k ? 60 : 30; s.drop.push({ x: f.x, y: f.y, t: 0.5, k: f.k }); }
      s.foes = s.foes.filter(f => !f.dead); s.shots = s.shots.filter(b => !b.dead); s.drop.forEach(d => d.t -= dt); s.drop = s.drop.filter(d => d.t > 0);
      if (!s.foes.length) { G.score += 100; GS.Audio.play('ok'); this.wave(s); } if (s.foes.some(f => f.y > H - 110) || s.left <= 0) s.over = true; },
    draw(s) { g.textBaseline = 'middle'; s.foes.forEach(f => txt(f.k ? '🏷️' : '😠', f.x, f.y, 24)); s.shots.forEach(b => txt('🙂', b.x, b.y, 15)); s.drop.forEach(d => txt(d.k ? '−10%' : '😊', d.x, d.y - (0.5 - d.t) * 30, 14, '#f5c518'));
      rr(0, H - 76, W, 22, '#e10600', 0); txt('GAMESHOP', W / 2, H - 64, 12); rr(s.x - 13, H - 104, 26, 28, '#e10600', 8); g.fillStyle = '#e0ac7e'; g.beginPath(); g.arc(s.x, H - 112, 11, 0, 7); g.fill(); g.textBaseline = 'alphabetic'; }
  };
  /* ---------- Cable Runner ---------- */
  const runner = {
    init() { return { y: 0, vy: 0, j: 0, sp: 150, obs: [], coins: [], next: 1, left: 75, d: 0, hit: 0, lives: 3 }; },
    press(s, k) { if ((k === 'a' || k === 'd') && s.j < 2) { s.vy = 430; s.j++; GS.Audio.play('click'); } },
    step(s, dt) { s.left -= dt; s.sp += 3 * dt; s.d += s.sp * dt; s.vy -= 1150 * dt; s.y += s.vy * dt; if (s.y <= 0) { s.y = 0; s.vy = 0; s.j = 0; } s.hit -= dt; s.next -= dt;
      if (s.next <= 0) { const k = Math.random(); s.obs.push(k < 0.5 ? { x: W + 20, w: 34, h: 16, t: 'c' } : k < 0.85 ? { x: W + 20, w: 26, h: 30, t: 'b' } : { x: W + 20, w: 26, h: 56, t: 'b2' }); if (Math.random() < 0.7) s.coins.push({ x: W + 90 + R(0, 60), y: R(20, 110) }); s.next = R(0.75, 1.5) * 150 / s.sp + 0.35; }
      s.obs.forEach(o => o.x -= s.sp * dt); s.coins.forEach(c => c.x -= s.sp * dt); const px = 60;
      for (const o of s.obs) if (s.hit <= 0 && Math.abs(o.x - px) < o.w / 2 + 9 && s.y < o.h - 4) { s.hit = 1.1; s.lives--; GS.Audio.play('error'); if (s.lives <= 0) s.over = true; }
      s.coins = s.coins.filter(c => { if (Math.abs(c.x - px) < 20 && Math.abs(c.y - (s.y + 18)) < 26) { G.score += 40; GS.Audio.play('ok'); return false; } return c.x > -20; }); s.obs = s.obs.filter(o => o.x > -40); G.score += s.sp * dt * 0.12; if (s.left <= 0) s.over = true; },
    draw(s) { const gy = H - 150; rr(0, gy, W, 6, '#3a3a42', 0); for (let i = 0; i < 8; i++) rr(((i * 60 - s.d * 0.5) % 480 + 480) % 480 - 60, gy - 150, 34, 60, '#22222a', 4);
      s.obs.forEach(o => { if (o.t === 'c') { g.strokeStyle = '#f5c518'; g.lineWidth = 5; g.beginPath(); g.moveTo(o.x - 17, gy); g.quadraticCurveTo(o.x, gy - 30, o.x + 17, gy); g.stroke(); } else { rr(o.x - o.w / 2, gy - o.h, o.w, o.h, '#c99a5b', 3); rr(o.x - o.w / 2, gy - o.h + 8, o.w, 5, '#e10600', 0); } });
      g.textBaseline = 'middle'; s.coins.forEach(c => txt('🎮', c.x, gy - c.y, 20)); txt('❤️'.repeat(s.lives), W - 12, 44, 13, '#fff', 'right'); g.textBaseline = 'alphabetic';
      if (s.hit > 0 && Math.floor(s.hit * 10) % 2) return; const py = gy - s.y, k = Math.sin(s.d * 0.09) * 6 * (s.y ? 0 : 1); rr(60 - 4 + k, py - 12, 5, 12, '#23232b', 2); rr(60 - 1 - k, py - 12, 5, 12, '#23232b', 2); rr(60 - 10, py - 32, 20, 22, '#e10600', 6); g.fillStyle = '#e0ac7e'; g.beginPath(); g.arc(60, py - 41, 10, 0, 7); g.fill(); }
  };
  const GAMES = { tetris, defensa, runner };
  function press(k) { if (G && !G.s.over && G.run) GAMES[def.id].press(G.s, k); }
  function frame(t) {
    raf = requestAnimationFrame(frame); const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t; if (!G) return; const gm = GAMES[def.id];
    if (G.run && !G.s.over) gm.step(G.s, dt);
    g.fillStyle = '#0d0d10'; g.fillRect(0, 0, W, H); gm.draw(G.s);
    txt(def.name, 12, 22, 14, '#fff', 'left'); txt(Math.floor(G.score) + ' / ' + def.goal, W - 12, 22, 14, G.score >= def.goal ? '#3bb54a' : '#f5c518', 'right'); txt('⏱ ' + Math.max(0, Math.ceil(G.s.left)), 12, 42, 12, '#9a9aa6', 'left');
    if (G.s.over && G.run) { G.run = false; finish(); }
  }
  function finish() {
    const sc = Math.floor(G.score), won = sc >= def.goal; GS.Audio.play(won ? 'fanfare' : 'endDay');
    el('arcEnd').hidden = false; el('arcEnd').innerHTML = '<h2>' + (won ? '¡Premio!' : 'Fin del juego') + '</h2><p><b>' + sc + '</b> puntos · meta ' + def.goal + '</p><p>' + (won ? '🎁 ' + def.prizeName + ': ya lo podés usar desde Arcade.' : 'Con ' + def.goal + ' te llevás: ' + def.prizeName + '.') + '</p><div class="row"><button class="btn ghost" id="arcOut">Salir</button><button class="btn" id="arcAgain">Otra vez</button></div>';
    const cb = onEnd; if (cb) cb(sc, won, def);
    el('arcOut').addEventListener('click', close); el('arcAgain').addEventListener('click', () => start());
  }
  function start() { G = { s: GAMES[def.id].init(), score: 0, run: true }; el('arcEnd').hidden = true; }
  function close() { cancelAnimationFrame(raf); raf = 0; G = null; el('arc').hidden = true; }
  function open(id, cb) {
    def = GS.ARCADE.find(a => a.id === id); onEnd = cb; cv = el('arcCv'); g = cv.getContext('2d'); cv.width = W; cv.height = H; el('arc').hidden = false; el('arcKeys').textContent = def.keys; keys = {};
    el('arcPad').className = 'pad ' + id; start(); last = performance.now(); if (!raf) raf = requestAnimationFrame(frame);
  }
  function bind() {
    document.querySelectorAll('#arcPad [data-k]').forEach(b => { const k = b.dataset.k; b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; press(k); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { keys[k] = false; })); });
    const MAP = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'a', ' ': 'a', ArrowDown: 'd' };
    document.addEventListener('keydown', e => { const k = MAP[e.key]; if (!G || !k) return; e.preventDefault(); if (!keys[k] || k === 'a' || k === 'd') { if (!e.repeat) press(k); } keys[k] = true; });
    document.addEventListener('keyup', e => { const k = MAP[e.key]; if (k) keys[k] = false; });
    el('arcX').addEventListener('click', close);
  }
  return { open, close, bind, isOpen: () => !!G, debug: () => G };
})();
