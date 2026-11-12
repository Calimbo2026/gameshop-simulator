/* =====================================================================
   JUEGO — jornada, clientes, puntaje, HUD, pantallas y bucle principal.
   ===================================================================== */
GS.Game = (function () {
  const U = GS.util, C = GS.CONFIG, L = GS.LAYOUT, LN = GS.LINES, W = GS.World, MG = GS.Minigames, A = GS.Audio;
  const $ = id => document.getElementById(id);
  let state = 'menu', day = null, paused = false, lastT = 0, calm = false;

  /* ---------------- Etapas del proyecto ---------------- */
  function phasesCompact() {
    const cur = GS.PHASES[C.phase - 1];
    let dots = '';
    GS.PHASES.forEach((p, i) => {
      const cls = p.n < C.phase ? 'done' : p.n === C.phase ? 'now' : '';
      dots += '<span class="ph-dot ' + cls + '">' + (p.n < C.phase ? '✔' : p.n) + '</span>';
      if (i < GS.PHASES.length - 1) dots += '<span class="ph-bar ' + (p.n < C.phase ? 'done' : '') + '"></span>';
    });
    return '<div class="ph-title"><span>🚧 En construcción</span><span>ver etapas ›</span></div><div class="ph-dots">' + dots +
      '</div><div class="ph-now">Etapa <b>' + C.phase + ' de ' + GS.PHASES.length + '</b>: <b>' + cur.name + '</b></div>';
  }
  function showPhases() {
    const items = GS.PHASES.map(p => {
      const cls = p.n < C.phase ? 'done' : p.n === C.phase ? 'now' : '';
      const st = p.n < C.phase ? 'Lista' : p.n === C.phase ? 'En curso · es la que estás probando' : 'Pendiente';
      return '<li class="' + cls + '"><span class="ph-dot ' + cls + '">' + (p.n < C.phase ? '✔' : p.n) + '</span><div><em>' + st + '</em><b>' + p.name + '</b><span>' + p.desc + '</span></div></li>';
    }).join('');
    modal('<h2>Etapas del proyecto</h2><p>El juego se construye en 5 etapas. Cada una se prueba y se aprueba antes de pasar a la siguiente.</p><ul class="ph-list">' + items +
      '</ul><button class="btn" data-close>Entendido</button>');
  }

  /* ---------------- Modal y avisos ---------------- */
  let modalOnClose = null;
  function modal(html, onClose) {
    $('sheet').innerHTML = html; $('modal').hidden = false; modalOnClose = onClose || null;
    $('sheet').querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  }
  function closeModal() { $('modal').hidden = true; A.play('click'); const f = modalOnClose; modalOnClose = null; if (f) f(); }
  function toast(html, cls, ms) {
    const box = $('toasts'); while (box.children.length > 1) box.removeChild(box.firstChild);
    const t = document.createElement('div'); t.className = 'toast ' + (cls || ''); t.innerHTML = html; box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms || 3200);
  }

  /* ---------------- Jornada ---------------- */
  function startDay(relaxed) {
    A.unlock(); A.play('click');
    $('start').hidden = true; $('end').hidden = true; $('hud').hidden = false; $('stations').hidden = false;
    clearCustomers();
    day = {
      relaxed, t: 0, dur: C.day.seconds, score: 0, combo: 0, bestCombo: 0, sales: 0, served: 0, lost: 0, cajaErr: 0, mostErr: 0,
      customers: [], spawned: 0, nextSpawn: 0.4, nextDueno: U.rnd(16, 24), cajaCount: 0, closing: false,
      reqBag: U.shuffle(GS.REQUESTS), archBag: U.shuffle(GS.CUSTOMERS), bestMoment: ''
    };
    state = 'day'; paused = false; W.home(); updateHud(true);
    $('clockS').textContent = relaxed ? 'Turno tranquilo' : 'Abrimos';
    GS.track('inicio_partida', { modo: relaxed ? 'tranquilo' : 'normal' });
    if (!GS.Store.get('tutorial')) { GS.Store.set('tutorial', true); showHow(true); }
  }
  function clearCustomers() {
    if (day) day.customers.forEach(c => { c.person.remove(); c.label.remove(); });
    MG.close(); W.focus(null);
  }

  function spawnCustomer() {
    const slot = freeSlot('slotM', L.colaMostrador.length); if (slot < 0) return;
    if (!day.reqBag.length) day.reqBag = U.shuffle(GS.REQUESTS);
    if (!day.archBag.length) day.archBag = U.shuffle(GS.CUSTOMERS);
    const req = day.reqBag.pop(), arche = day.archBag.pop(), product = GS.CATALOG.find(p => p.id === req.p);
    const person = W.makePerson({ shirt: arche.shirt, hair: arche.hair });
    const dx = L.puerta.x; person.setPos(dx + U.rnd(-0.5, 0.5), day.spawned === 0 ? L.salon.zMax + 1 : L.galeria.zMax + 2.4);
    const label = document.createElement('div'); label.className = 'plabel'; label.innerHTML = '<span class="ic">❓</span><span class="b"><i></i></span>'; label.hidden = true;
    $('labels').appendChild(label);
    const cu = { arche, request: req.t, product, st: 'entering', pat: 1, person, slotM: slot, slotC: -1, label };
    day.customers.push(cu); day.spawned++;
    const s = L.colaMostrador[slot];
    person.walk([[dx, L.salon.zMax + 0.2], [dx, -1.3], s], () => { cu.st = 'waitM'; person.face(Math.PI); });
    setTimeout(() => A.play('bell'), 900);
  }
  function freeSlot(key, n) {
    for (let i = 0; i < n; i++) if (!day.customers.some(c => c[key] === i && c.st !== 'leaving')) return i;
    return -1;
  }
  function leave(cu, withBag) {
    cu.st = 'leaving'; cu.slotM = -1; cu.slotC = -1; cu.label.hidden = true; cu.person.bag(!!withBag);
    const dx = L.puerta.x;
    cu.person.walk([[-0.6, -0.9], [dx, L.salon.zMax + 0.2], [dx + U.rnd(-2, 2), L.galeria.zMax + 3]], () => {
      cu.person.remove(); cu.label.remove(); const i = day ? day.customers.indexOf(cu) : -1; if (i >= 0) day.customers.splice(i, 1);
    });
  }

  function addScore(base, pat) {
    const mult = 1 + Math.min(day.combo, 8) * 0.25, pts = Math.round((base + pat * 100) * mult);
    day.score += pts; day.combo++; day.bestCombo = Math.max(day.bestCombo, day.combo);
    toast('+' + pts + (day.combo > 1 ? ' · racha x' + day.combo : ''), 'pts', 1100);
    if (day.combo > 1) A.play('combo', day.combo);
  }
  function breakCombo() { day.combo = 0; }

  function openStation(type) {
    if (state !== 'day' || paused || MG.isOpen() || day.closing) return;
    const want = type === 'mostrador' ? 'waitM' : 'waitC';
    const cands = day.customers.filter(c => c.st === want);
    if (!cands.length) { toast(type === 'mostrador' ? 'No hay nadie esperando en el mostrador.' : 'Todavía no hay nadie para cobrar.', '', 1500); return; }
    A.unlock(); A.play('click');
    const cu = cands.sort((a, b) => a.pat - b.pat)[0];
    cu.st = type === 'mostrador' ? 'inM' : 'inC'; cu.pat = Math.max(cu.pat, 0.5);
    const land = window.innerWidth > window.innerHeight && window.innerHeight <= 560;
    W.focus(type, land ? 0 : 0.27, land ? 0.25 : 0);
    const cb = {
      onMistake(kind) { breakCombo(); if (kind === 'caja') day.cajaErr++; else day.mostErr++; if (!day.relaxed) cu.pat = Math.max(0.05, cu.pat - 0.14); },
      onEnd(ok, info) {
        W.focus(null);
        if (type === 'mostrador') {
          addScore(100, cu.pat); cu.st = 'toCaja'; cu.slotM = -1; cu.pat = Math.max(cu.pat, 0.75);
          cu.slotC = Math.max(0, freeSlot('slotC', L.colaCaja.length));
          cu.person.walk([[0.1, -2.1], L.colaCaja[cu.slotC]], () => { cu.st = 'waitC'; cu.person.face(Math.PI / 2); });
        } else {
          day.served++;
          if (info.total) day.sales += info.total;
          if (info.cajaError) { day.score = Math.max(0, day.score - 100); }
          if (ok) addScore(150, cu.pat);
          if (Math.random() < 0.6) toast('<b>' + cu.arche.name + '</b>' + cu.arche.bye, '', 2600);
          if (ok && !day.bestMoment) day.bestMoment = cu.arche.name + ': "' + cu.arche.bye + '"';
          leave(cu, !!info.total);
        }
      }
    };
    let variant = null;
    if (type === 'caja') { variant = GS.DEBUG_VARIANT ? GS.DEBUG_VARIANT : day.cajaCount === 0 ? 'cobro' : U.pick(['cobro', 'cobro', 'vuelto', 'comprobante']); day.cajaCount++; }
    MG.open(type, cu, cb, { variant });
  }

  function updateDay(dt) {
    day.t += dt;
    const cfg = C.day, open = MG.isOpen();
    // llegada de clientes
    const total = day.customers.filter(c => c.st !== 'leaving').length;
    const canSpawn = !day.closing && total < cfg.maxCustomers && (day.relaxed ? day.spawned < cfg.relaxedCustomers : day.t < day.dur - 12);
    day.nextSpawn -= dt;
    if (day.nextSpawn <= 0 && canSpawn) {
      spawnCustomer();
      const rush = day.relaxed ? 1 : 1 - 0.35 * (day.t / day.dur);   // se acelera hacia el final
      day.nextSpawn = U.rnd(cfg.spawnMin, cfg.spawnMax) * rush;
    }
    // paciencia
    for (const cu of day.customers.slice()) {
      if (day.relaxed) continue;
      if (cu.st === 'waitM' || cu.st === 'waitC') cu.pat -= dt / cfg.patienceWait;
      else if ((cu.st === 'inM' || cu.st === 'inC') && !MG.isResolving()) cu.pat -= dt / cfg.patienceGame;
      if (cu.pat <= 0 && cu.st !== 'leaving' && cu.st !== 'entering' && cu.st !== 'toCaja') {
        if ((cu.st === 'inM' || cu.st === 'inC')) { if (MG.isResolving()) { cu.pat = 0.01; continue; } MG.close(); W.focus(null); }
        day.lost++; breakCombo(); A.play('lost');
        toast('<b>' + cu.arche.name + ' se fue</b>' + cu.arche.lost, '', 3000);
        leave(cu, false);
      }
    }
    if (open && MG.customer()) MG.setPatience(day.relaxed ? 1 : MG.customer().pat);
    // el Dueño por el altavoz
    day.nextDueno -= dt;
    if (day.nextDueno <= 0 && !open) { day.nextDueno = U.rnd(26, 38); A.play('speaker'); toast('<b>📢 El Dueño, por el altavoz</b>' + U.pick(LN.dueno), 'dueno', 4600); }
    // fin de la jornada
    const over = day.relaxed ? (day.spawned >= cfg.relaxedCustomers && day.customers.every(c => c.st === 'leaving')) : day.t >= day.dur;
    if (over && !day.closing && !MG.isOpen()) { day.closing = true; setTimeout(endDay, 700); }
    updateHud(false); updateLabels();
  }

  function fmtClock(f) { const m = Math.round(600 + f * 600); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.floor(m % 60 / 10) * 10).padStart(2, '0'); }
  function updateHud(force) {
    if (!day) return;
    const f = day.relaxed ? Math.min(1, (day.served + day.lost) / C.day.relaxedCustomers) : Math.min(1, day.t / day.dur);
    $('clockT').textContent = fmtClock(f); $('clockB').style.width = (f * 100).toFixed(1) + '%';
    if (!day.relaxed) { const left = Math.max(0, Math.ceil(day.dur - day.t)); $('clockS').textContent = left <= 20 ? '¡Cerramos en ' + left + ' s!' : 'Cierra a las 20:00'; }
    $('scoreV').textContent = day.score.toLocaleString('es-AR');
    $('chipSales').textContent = '💰 ' + U.money(day.sales);
    $('chipServed').textContent = '🧍 ' + day.served + (day.served === 1 ? ' atendido' : ' atendidos');
    $('chipCombo').hidden = day.combo < 2; $('chipCombo').textContent = '🔥 racha x' + day.combo;
    stationBtn('M', 'waitM', 'esperando', 'Nadie esperando'); stationBtn('C', 'waitC', 'para cobrar', 'Nadie para cobrar');
  }
  function stationBtn(k, st, word, empty) {
    const list = day.customers.filter(c => c.st === st), n = list.length, btn = $('st' + k);
    btn.classList.toggle('on', n > 0); $('st' + k + 'q').hidden = n === 0; $('st' + k + 'q').textContent = n;
    $('st' + k + 's').textContent = n ? n + ' ' + word + ' · ¡tocá!' : empty;
    const min = n ? Math.min.apply(null, list.map(c => c.pat)) : 0, bar = $('st' + k + 'b');
    bar.style.width = (n ? Math.max(4, min * 100) : 0) + '%'; bar.style.background = min > 0.5 ? 'var(--ok)' : min > 0.25 ? 'var(--warn)' : 'var(--red)';
  }
  function updateLabels() {
    for (const cu of day.customers) {
      const show = cu.st === 'waitM' || cu.st === 'waitC' || cu.st === 'toCaja';
      cu.label.hidden = !show; if (!show) continue;
      const g = cu.person.group.position, p = W.project(g.x, 1.75, g.z);
      cu.label.style.left = p.x.toFixed(1) + 'px'; cu.label.style.top = p.y.toFixed(1) + 'px';
      cu.label.firstChild.textContent = cu.st === 'waitM' ? '❓' : '💵';
      const i = cu.label.lastChild.firstChild; i.style.width = Math.max(0, cu.pat * 100) + '%';
      i.style.background = cu.pat > 0.5 ? 'var(--ok)' : cu.pat > 0.25 ? 'var(--warn)' : 'var(--red)';
    }
  }

  /* ---------------- Cierre de caja ---------------- */
  function endDay() {
    if (!day || state !== 'day') return;
    state = 'end'; MG.close(); W.focus(null); W.showAll(); A.play('endDay');
    day.customers.slice().forEach(c => { if (c.st !== 'leaving') leave(c, false); });
    $('hud').hidden = true; $('stations').hidden = true;
    const d = day;
    let stars = 1;
    if (d.served >= 4 && d.lost <= 1) stars = 2;
    if (d.served >= 6 && d.lost === 0 && d.cajaErr === 0) stars = 3;
    if (d.relaxed) stars = d.cajaErr + d.mostErr === 0 ? 3 : d.cajaErr + d.mostErr <= 3 ? 2 : 1;
    const comment = U.pick(stars === 3 ? LN.duenoEndGood : stars === 2 ? LN.duenoEndMid : LN.duenoEndBad);
    const human = U.pick(LN.human).replace('{n}', d.served);
    const entry = { score: d.score, served: d.served, sales: d.sales, mode: d.relaxed ? 'Tranquilo' : 'Normal', date: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) };
    const pos = d.score > 0 ? GS.Store.addScore(entry) : -1;
    GS.track('fin_jornada', { puntaje: d.score, atendidos: d.served, perdidos: d.lost, estrellas: stars, modo: entry.mode });
    $('endCol').innerHTML =
      '<div><div class="ticket"><h3>CIERRE DE CAJA</h3><div class="c">GameShop Simulator · ' + (d.relaxed ? 'turno tranquilo' : 'jornada normal') + '</div>' +
      '<p><span>Clientes atendidos</span><b>' + d.served + '</b></p><p><span>Se fueron sin comprar</span><b>' + d.lost + '</b></p>' +
      '<p><span>Errores en mostrador</span><b>' + d.mostErr + '</b></p><p><span>Errores de caja</span><b>' + d.cajaErr + '</b></p>' +
      '<p><span>Mejor racha</span><b>x' + d.bestCombo + '</b></p><p><span>Ventas (ficticias)</span><b>' + U.money(d.sales) + '</b></p><hr>' +
      '<p class="tot"><span>PUNTAJE</span><b>' + d.score.toLocaleString('es-AR') + '</b></p><div class="stars">' + '★'.repeat(stars) + '<span style="opacity:.25">' + '★'.repeat(3 - stars) + '</span></div></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">' +
      (pos === 0 ? '<div class="newrec">🏆 ¡Nuevo récord personal!</div>' : '') +
      '<div class="quote"><b>El Dueño opina</b>' + comment + '</div><p class="humanline">' + human + '</p>' +
      '<button class="btn" id="endAgain">Otra jornada</button><div class="row"><button class="btn ghost" id="endHome">Inicio</button><button class="btn ghost" id="endRecs">Récords</button></div>' +
      '<button class="phases" id="phasesEnd"></button></div>';
    $('phasesEnd').innerHTML = phasesCompact(); $('phasesEnd').addEventListener('click', showPhases);
    $('endAgain').addEventListener('click', () => startDay(d.relaxed));
    $('endHome').addEventListener('click', goHome); $('endRecs').addEventListener('click', showRecords);
    $('end').hidden = false; $('end').scrollTop = 0;
  }
  function goHome() {
    A.play('click'); clearCustomers(); day = null; state = 'menu'; paused = false;
    $('end').hidden = true; $('hud').hidden = true; $('stations').hidden = true; $('start').hidden = false; $('toasts').innerHTML = ''; W.showAll();
  }

  /* ---------------- Modales: cómo se juega, récords, opciones, pausa ---------------- */
  function showHow(fromDay) {
    if (fromDay) paused = true;
    modal('<h2>Cómo se juega</h2><ul class="how">' +
      '<li><i>🚪</i><span>Entran clientes y hacen fila. Cada uno tiene una <b>barrita de paciencia</b>.</span></li>' +
      '<li><i>🛎</i><span>Tocá <b>Mostrador</b> y adiviná qué producto te están pidiendo.</span></li>' +
      '<li><i>💵</i><span>Después tocá <b>Caja</b> y cobrá bien: 10% OFF en efectivo o transferencia, 3 cuotas sin interés con tarjeta.</span></li>' +
      '<li><i>🔥</i><span>Encadená aciertos para armar <b>racha</b> y multiplicar el puntaje. Si te equivocás no perdés: solo hay un chiste.</span></li>' +
      '<li><i>👆</i><span>Arrastrá para mover el local y pellizcá (o usá la rueda) para acercar.</span></li></ul>' +
      '<button class="btn" data-close>¡A laburar!</button>', () => { if (fromDay) paused = false; });
  }
  function showRecords() {
    const best = GS.Store.get('best') || [];
    modal('<h2>Tus mejores jornadas</h2>' + (best.length ? '<ul class="recs">' + best.map((b, i) => '<li><span>' + (i + 1) + '. ' + b.mode + ' · ' + b.served + ' atendidos · ' + b.date + '</span><b>' + b.score.toLocaleString('es-AR') + '</b></li>').join('') + '</ul>'
      : '<p>Todavía no jugaste ninguna jornada. El récord a batir es cero: aprovechá.</p>') +
      '<p style="font-size:13px;color:#a9a9b2">Se guardan solo en este dispositivo.</p><button class="btn" data-close>Cerrar</button>');
  }
  function showOptions(fromPause) {
    const q = GS.Store.get('quality') || 'auto';
    const seg = (name, vals, curv) => '<div class="seg" data-seg="' + name + '">' + vals.map(v => '<button data-v="' + v[0] + '" class="' + (v[0] === curv ? 'on' : '') + '">' + v[1] + '</button>').join('') + '</div>';
    modal('<h2>Opciones</h2>' +
      '<div class="setting"><span>Sonido</span>' + seg('mute', [['0', 'Con sonido'], ['1', 'Silencio']], A.isMuted() ? '1' : '0') + '</div>' +
      '<div class="setting"><span>Calidad gráfica</span>' + seg('quality', [['auto', 'Auto'], ['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']], q) + '</div>' +
      '<div class="setting"><span>Reducir movimiento</span>' + seg('calm', [['0', 'No'], ['1', 'Sí']], calm ? '1' : '0') + '</div>' +
      '<div class="setting"><span>Borrar récords y progreso</span><button class="btn ghost" id="optReset" style="width:auto">Reiniciar</button></div>' +
      '<button class="btn" data-close>Listo</button>', () => { if (fromPause) showPause(); });
    $('sheet').querySelectorAll('.seg').forEach(s => s.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      const name = s.dataset.seg, v = b.dataset.v;
      if (name === 'mute') { A.unlock(); A.setMuted(v === '1'); syncMute(); A.play('click'); }
      if (name === 'quality') { GS.Store.set('quality', v); W.setQuality(v === 'auto' ? autoQuality() : v); }
      if (name === 'calm') { setCalm(v === '1'); GS.Store.set('calm', calm); }
    }));
    $('optReset').addEventListener('click', e => { GS.Store.reset(); e.target.textContent = 'Borrado ✔'; });
  }
  function showPause() {
    if (state !== 'day') return; paused = true;
    modal('<h2>Pausa</h2><p>El local te espera. Los clientes, no tanto.</p><button class="btn" id="pResume">Seguir</button>' +
      '<div class="row"><button class="btn ghost" id="pOpts">Opciones</button><button class="btn ghost" id="pHow">Cómo se juega</button></div><button class="btn ghost" id="pExit">Salir al inicio</button>');
    $('pResume').addEventListener('click', () => { $('modal').hidden = true; paused = false; A.play('click'); });
    $('pOpts').addEventListener('click', () => showOptions(true));
    $('pHow').addEventListener('click', () => { showHow(false); modalOnClose = showPause; });
    $('pExit').addEventListener('click', () => { $('modal').hidden = true; goHome(); });
  }
  function syncMute() { $('btnMute').textContent = A.isMuted() ? '🔇' : '🔊'; }
  function setCalm(v) { calm = v; document.body.classList.toggle('calm', v); W.setReduceMotion(v || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)); }
  function autoQuality() {
    const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4, mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (mem <= 2 || (mobile && cores <= 4)) return 'baja';
    return mobile ? 'media' : 'alta';
  }

  /* ---------------- Bucle principal ---------------- */
  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden) { lastT = t; return; }             // pestaña oculta: no se dibuja ni corre el reloj
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
    if (state === 'day' && !paused) updateDay(dt);
    W.update(paused ? 0 : dt); W.render();
  }

  function boot() {
    $('logoImg').src = GS.LOGO;
    $('phasesStart').innerHTML = phasesCompact();
    $('chipPhase').textContent = '🚧 Etapa ' + C.phase + ' de ' + GS.PHASES.length;
    const q = GS.Store.get('quality') || 'auto';
    W.setQuality(q === 'auto' ? autoQuality() : q);
    if (!W.init($('c'))) {
      modal('<h2>Ups</h2><p>Este navegador no pudo iniciar los gráficos 3D. Probá actualizarlo o abrir el juego en otro navegador.</p>');
      return;
    }
    setCalm(!!GS.Store.get('calm')); syncMute(); W.showAll();
    W.onTap(st => openStation(st));
    $('btnPlay').addEventListener('click', () => startDay(false));
    $('btnRelax').addEventListener('click', () => startDay(true));
    $('btnHow').addEventListener('click', () => { A.unlock(); A.play('click'); showHow(false); });
    $('btnRecs').addEventListener('click', () => { A.unlock(); A.play('click'); showRecords(); });
    $('btnOpts').addEventListener('click', () => { A.unlock(); A.play('click'); showOptions(false); });
    $('phasesStart').addEventListener('click', showPhases);
    $('chipPhase').addEventListener('click', () => { paused = true; showPhases(); modalOnClose = () => { paused = false; }; });
    $('stM').addEventListener('click', () => openStation('mostrador'));
    $('stC').addEventListener('click', () => openStation('caja'));
    $('btnPause').addEventListener('click', showPause);
    $('btnMute').addEventListener('click', () => { A.unlock(); A.setMuted(!A.isMuted()); syncMute(); A.play('click'); });
    window.addEventListener('resize', () => W.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => W.resize(), 250));
    document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'day' && !paused && $('modal').hidden) showPause(); });
    document.addEventListener('keydown', e => {
      if (!$('modal').hidden) { if (e.key === 'Escape' || e.key === 'Enter') { const b = $('sheet').querySelector('[data-close], #pResume'); if (b) b.click(); } return; }
      if (state !== 'day') return;
      if (e.key === 'Escape') return showPause();
      if (MG.isOpen()) return MG.key(e);
      if (e.key === '1') openStation('mostrador'); else if (e.key === '2') openStation('caja');
    });
    // evitar zoom/scroll del navegador mientras se juega
    document.addEventListener('gesturestart', e => e.preventDefault());
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  return { startDay, openStation, endDay, state: () => state, day: () => day };
})();
