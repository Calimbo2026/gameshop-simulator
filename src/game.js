/* =====================================================================
   JUEGO — jornada, clientes, tareas de las estaciones, Arcade, puntaje,
   HUD, pantallas y bucle principal.
   ===================================================================== */
GS.Game = (function () {
  const U = GS.util, C = GS.CONFIG, CD = GS.CONFIG.cord, L = GS.LAYOUT, LN = GS.LINES, W = GS.World, MG = GS.Minigames, A = GS.Audio;
  const $ = id => document.getElementById(id);
  const ST = id => GS.STATIONS.find(s => s.id === id);
  const TASK_STATIONS = GS.STATIONS.filter(s => s.task && !s.finalOnly);
  let walkT = 2, walkers = 0;
  let state = 'menu', day = null, paused = false, lastT = 0, calm = false, uid = 0;

  /* ---------------- Etapas del proyecto ---------------- */
  function phasesCompact() {
    if (C.launched) return '';
    const cur = GS.PHASES[C.phase - 1];
    let dots = '';
    GS.PHASES.forEach((p, i) => {
      const cls = p.n < C.phase ? 'done' : p.n === C.phase ? 'now' : '';
      dots += '<span class="ph-dot ' + cls + '">' + (p.n < C.phase ? '✔' : p.n) + '</span>';
      if (i < GS.PHASES.length - 1) dots += '<span class="ph-bar ' + (p.n < C.phase ? 'done' : '') + '"></span>';
    });
    return '<div class="ph-title"><span>🚧 En construcción</span><span>ver etapas ›</span></div><div class="ph-dots">' + dots +
      '</div><div class="ph-now">Etapa <b>' + C.phase + ' de ' + GS.PHASES.length + '</b>: <b>' + cur.name + '</b>' + (C.phaseNote ? '<br><small>' + C.phaseNote + '</small>' : '') + '</div>';
  }
  function showPhases() {
    const items = GS.PHASES.map(p => {
      const cls = p.n < C.phase ? 'done' : p.n === C.phase ? 'now' : '';
      const st = p.n < C.phase ? 'Lista' : p.n === C.phase ? 'En curso · es la que estás probando' : 'Pendiente';
      return '<li class="' + cls + '"><span class="ph-dot ' + cls + '">' + (p.n < C.phase ? '✔' : p.n) + '</span><div><em>' + st + '</em><b>' + p.name + '</b><span>' + p.desc +
        (p.n === C.phase && C.phaseNote ? ' <i>' + C.phaseNote + '.</i>' : '') + '</span></div></li>';
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
  function newDay(extra) {
    return Object.assign({
      relaxed: false, arcade: null, t: 0, dur: C.day.seconds, score: 0, combo: 0, bestCombo: 0, sales: 0, served: 0, lost: 0, cajaErr: 0, otherErr: 0,
      tasksDone: 0, tasksLate: 0, customers: [], tasks: [], spawned: 0, tasksSpawned: 0,
      extras: [], n: 1, unlocked: unlockedFor(1), plan: planDay(1), rep0: repNow(), dueno: null, wave: -1, stage: 'rest', rest: 0.6, queue: [], says: [], beat: 0, duenoBag: U.shuffle(LN.dueno),
      cajaCount: 0, closing: false, jobSig: '', cord: CD.start, mate: false, lookers: [], lookT: 4, spots: {}, helper: null, intr: null, intrN: 0, intrOk: 0, intrBag: [], reqBag: U.shuffle(GS.REQUESTS), archBag: U.shuffle(GS.CUSTOMERS), taskBag: []
    }, extra || {});
  }
  // Arma la jornada: cuántos clientes y tareas trae cada tanda. Va de menos a más.
  // (Etapa 3: acá entran el cartel del frente, el clima y las fechas especiales.)
  // Jornada N de la carrera: de menos a más. Cada jornada suma clientes y, según GS.UNLOCKS, estaciones nuevas.
  // (Parte B de la Etapa 3: acá entran el cartel del frente, el clima y las fechas especiales.)
  function dayNumber() { return GS.Store.get('testDay') || (GS.Store.get('days') || 0) + 1; }
  function unlockedFor(n) { return GS.UNLOCKS.slice(0, n).reduce((a, b) => a.concat(b), []); }
  const upNow = () => GS.Store.get('up') || {};
  const coinsNow = () => GS.Store.get('coins') || 0;
  const coinMult = () => { const u = upNow(); return 1 + 0.1 * ((u.mesa || 0) + (u.isla || 0) + (u.gondola || 0) + (u.luces || 0)); };
  const patMult = () => { const u = upNow(); return 1 + 0.15 * (u.escritorio || 0) + 0.1 * (u.sillas || 0); };
  function conditionFor(n) {
    const forced = GS.Store.get('testCond'); if (forced) return forced === 'ninguna' ? null : forced;             // fechas especiales fijas y lluvia al azar (nunca en las primeras jornadas)
    if (n >= 5 && n % 10 === 5) return 'blackfriday';
    if (n >= 10 && n % 10 === 0) return 'navidad';
    return n >= 3 && Math.random() < 0.3 ? 'lluvia' : null;
  }
  function planDay(n, cond) {
    const un = unlockedFor(n), pool = TASK_STATIONS.filter(s => un.indexOf(s.id) >= 0), u = upNow(), c = cond ? GS.CONDITIONS[cond] : null, r = repNow();
    let cust = Math.min(3 + n, 7) + (u.cartel || 0) + (u.arcade || 0) + (u.vidluz || 0) + (r >= 4 ? 1 : r < 2 ? -1 : 0) + (c ? c.cust : 0);   // cartel, arcade y reputación traen gente
    cust = U.clamp(cust, 3, 12);
    const tasks = pool.length ? Math.min(n - 1, 5) : 0, extraMl = c && un.indexOf('ml') >= 0 ? c.ml : 0, nw = cust <= 5 ? 3 : 4;
    const plan = Array.from({ length: nw }, () => ({ c: 0, t: 0, ml: 0 }));
    for (let i = 0; i < cust; i++) plan[nw - 1 - (i % nw)].c++;
    for (let i = 0; i < tasks; i++) plan[nw - 1 - (i % (nw - 1))].t++;
    for (let i = 0; i < extraMl; i++) plan[1 + (i % (nw - 1))].ml++;
    if (un.indexOf('cierre') >= 0) plan.push({ c: 0, t: 1, ml: 0, final: true });
    return plan;
  }
  function addRep(d) { GS.Store.set('rep', U.clamp((GS.Store.get('rep') == null ? 3 : GS.Store.get('rep')) + d, 0, 5)); }
  const repNow = () => (GS.Store.get('rep') == null ? 3 : GS.Store.get('rep'));
  const repTxt = v => v.toFixed(1).replace('.', ',');
  // El Dueño sale del depósito, camina hasta el salón, dice lo suyo y se vuelve
  function duenoSpeak(text) {
    const d = day; if (!d || d.arcade || state !== 'day') return;
    const p = W.boss();
    if (d.dueno) { sayAt(p, text, 5600, 'boss'); return; }
    d.dueno = p;
    p.walk([[7.3, -0.3], [5.0, -0.3]], () => {
      p.face(-0.5); A.play('speaker'); sayAt(p, text, 5600, 'boss');
      setTimeout(() => { if (day !== d) return; p.walk([[7.3, -0.3], W.BOSS_HOME], () => { p.face(0); d.dueno = null; }); }, 5900);
    });
  }
  /* ---------------- Cordura: nunca hay Game Over, solo un mate a tiempo ---------------- */
  function addCord(v) { if (day && !day.arcade) day.cord = U.clamp(day.cord + v, 0, 100); }
  function mateRescue() {
    day.mate = true; addCord(CD.mateBoost); A.play('mate');
    day.customers.forEach(c => { c.pat = Math.min(1, c.pat + 0.25); }); day.tasks.forEach(t => { t.pat = Math.min(1, t.pat + 0.25); });
    toast('<b>🧉 Brian te ceba un mate</b>"Respirá, que yo te cubro un toque." Todos esperan un poco más.', 'dueno', 4600);
  }
  function showCord() {
    paused = true;
    modal('<h2>🧠 Cordura</h2><ul class="how"><li><i>☕</i><span><b>Sube</b> en los respiros, con las rachas y cuando resolvés bien una interrupción.</span></li>' +
      '<li><i>😵</i><span><b>Baja</b> con los errores, cuando alguien se va sin comprar o cuando se juntan muchos pendientes.</span></li>' +
      '<li><i>🎯</i><span>Con ' + CD.focus + ' o más estás <b>enfocado</b>: +10% de puntos. Al cierre, la cordura que te queda suma puntos.</span></li>' +
      '<li><i>🧉</i><span>Si baja mucho no pasa nada malo: Brian te ceba un mate y todos esperan un poco más.</span></li></ul><button class="btn" data-close>Entendido</button>', () => { paused = false; });
  }
  /* ---------------- Interrupciones suaves: un toque y listo; si no contestás, se resuelven solas ---------------- */
  function spawnIntr() {
    if (MG.isOpen() || day.beat > 0 || day.intr) { day.queue.push({ kind: 'i', t: 2.5 }); day.queue.sort((a, b) => a.t - b.t); return; }
    if (!day.intrBag.length) day.intrBag = U.shuffle(GS.INTERRUPTS);
    day.intr = { it: day.intrBag.pop(), left: CD.intrSeconds, flip: Math.random() < 0.5 }; day.jobSig = ''; A.play('intr');
  }
  function answerIntr(ok) {
    const x = day && day.intr; if (!x || paused) return; day.intr = null; day.jobSig = '';
    if (ok) { addCord(CD.intrOk * (x.it.mate ? 2 : 1)); day.score += 40; day.intrOk++; A.play(x.it.mate ? 'mate' : 'ok'); toast('<b>' + x.it.ic + ' Bien resuelto · sube la cordura</b>' + x.it.r, '', 3200); }
    else { addCord(-CD.intrBad); A.play('error'); toast('<b>' + x.it.ic + ' Ups</b>' + x.it.rb, '', 3200); }
  }
  function planTotals(plan) { return plan.reduce((a, w) => ({ c: a.c + w.c, t: a.t + w.t + (w.ml || 0) }), { c: 0, t: 0 }); }
  function startWave() {
    day.wave++; day.stage = 'work'; day.queue = [];
    const w = day.plan[day.wave];
    for (let i = 0; i < w.c; i++) day.queue.push({ kind: 'c', t: 0.3 + i * C.day.customerGap });
    for (let i = 0; i < w.t; i++) day.queue.push({ kind: w.final ? 'f' : 't', t: (w.final ? 0.6 : 5) + i * C.day.taskGap });
    for (let i = 0; i < (w.ml || 0); i++) day.queue.push({ kind: 'm', t: 3 + i * C.day.taskGap });
    if (GS.DEBUG_INTR || (day.n >= CD.intrFromDay && !w.final && day.wave >= 1 && day.intrN < (day.n >= 6 ? 3 : 2) && Math.random() < 0.6)) { day.queue.push({ kind: 'i', t: U.rnd(5, 11) }); day.intrN++; }
    day.queue.sort((a, b) => a.t - b.t);
  }
  function endWave() {
    if (day.wave >= day.plan.length - 1) { day.closing = true; setTimeout(endDay, 2800); return; }
    day.stage = 'rest'; day.rest = C.day.restSeconds; W.focus(null); W.home();
    { const seen = GS.Store.get('seen') || {}; if (!seen.cord) { seen.cord = 1; GS.Store.set('seen', seen); toast('<b>🧠 Cordura</b>Sube en los respiros y con las rachas. Si baja mucho, Brian te ceba un mate.', 'dueno', 5200); } }
    const d = day;
    setTimeout(() => {                       // en el respiro habla el Dueño, sin nada tapando el local
      if (day !== d || state !== 'day' || d.stage !== 'rest') return;
      if (!d.duenoBag.length) d.duenoBag = U.shuffle(LN.dueno);
      duenoSpeak(d.duenoBag.pop());
    }, 1100);
  }
  // Globito de diálogo sobre la cabeza de un personaje (el remate se ve en el salón, no en un cartel)
  function sayAt(person, text, ms, cls, quiet) {
    if (!quiet) A.babble(text, cls === 'boss' ? 150 : person.voice || 330);
    const el = document.createElement('div'); el.className = 'say ' + (cls || ''); el.textContent = text; $('labels').appendChild(el);
    day.says.push({ el, person, left: (ms || 3200) / 1000 });
  }
  function enterPlay() {
    $('start').hidden = true; $('end').hidden = true; $('hud').hidden = false; $('modal').hidden = true; $('toasts').innerHTML = '';
    $('final').hidden = true; paused = false; W.home();
  }
  function startDay(relaxed) {
    A.unlock();
    if (!GS.Store.get('avatar')) return showAvatar(() => startDay(relaxed));
    A.play('click'); clearDay(); W.setUpgrades(upNow());
    const n = dayNumber(); luchoLook(n);
    const un = unlockedFor(n), fresh = n <= GS.UNLOCKS.length ? GS.UNLOCKS[n - 1] : [];
    const cond = conditionFor(n);
    day = newDay({ relaxed, n, cond, unlocked: un, plan: planDay(n, cond), rest: 7.5 }); state = 'day'; enterPlay(); $('jobs').hidden = false;
    A.setMood(cond === 'lluvia' ? 'rain' : cond ? 'party' : 'day');
    const d = day, msg = n === 1 ? 'Bienvenido a GameShop. Abrimos de 10 a 19. Hoy: mostrador y caja. Con las monedas que ganes vamos a ir mejorando el local.'
      : cond ? GS.CONDITIONS[cond].name.slice(3) + '. ' + GS.CONDITIONS[cond].say
      : fresh.length ? 'Jornada ' + n + '. Hoy sumamos: ' + fresh.map(id => ST(id).name).join(' y ') + '. Cuando aparezcan, te explico.' : 'Jornada ' + n + '. ' + U.pick(LN.dueno);
    setTimeout(() => { if (day === d) duenoSpeak(msg); }, 500);
    $('rain').hidden = cond !== 'lluvia'; $('chipCond').hidden = !cond; if (cond) { $('chipCond').textContent = GS.CONDITIONS[cond].name; toast('<b>Hoy</b>' + GS.CONDITIONS[cond].name, 'dueno', 3800); }
    $('clockS').textContent = relaxed ? 'Turno tranquilo' : 'Abrimos';
    updateHud();
    GS.track('inicio_partida', { modo: relaxed ? 'tranquilo' : 'normal' });
    
  }
  function clearDay() {
    if (day) { day.customers.forEach(c => { if (c.person) c.person.remove(); c.label.remove(); }); day.tasks.forEach(t => { t.label.remove(); if (t.boxes) t.boxes.remove(); }); day.says.forEach(x => x.el.remove()); day.extras.forEach(x => x.remove()); }
    MG.close(); W.focus(null); W.bossHome();
    { const yo = W.player(); if (yo) { yo.stop(); yo.setPos(L.yoMostrador[0], L.yoMostrador[1]); yo.face(0); } const b = STAFF[1]; if (b && b.busy) { b.busy = false; b.q = [['go', [[4.0, -5.0], [4.6, -4.4], [4.5, -1.2], b.hub]]]; } }
  }
  function makeLabel(icon) {
    const label = document.createElement('div'); label.className = 'plabel'; label.innerHTML = '<span class="ic">' + icon + '</span><span class="b"><i></i></span>'; label.hidden = true;
    $('labels').appendChild(label); return label;
  }

  function spawnCustomer() {
    const slot = freeSlot('slotM', L.colaMostrador.length); if (slot < 0) return;
    if (!day.reqBag.length) day.reqBag = U.shuffle(GS.REQUESTS);
    if (!day.archBag.length) day.archBag = U.shuffle(GS.CUSTOMERS);
    const req = day.reqBag.pop(), arche = day.archBag.pop(), product = GS.CATALOG.find(p => p.id === req.p);
    const k = arche.id.charCodeAt(0) + arche.id.length * 7;   // cada personaje mantiene su look
    const person = W.makePerson({ shirt: arche.shirt, hair: arche.hair, hairStyle: GS.HAIRSTYLES[k % 5][0], glasses: k % 3 === 0, beard: k % 4 === 1, lips: k % 2 === 0, lashes: k % 5 < 2 });
    const dx = L.puerta.x; person.setPos(dx + U.rnd(-0.5, 0.5), day.spawned === 0 ? L.salon.zMax + 1 : L.galeria.zMax + 2.4);
    person.voice = 230 + (k % 7) * 45;
    const cu = { id: ++uid, arche, request: req.t, product, st: 'entering', pat: 1, person, slotM: slot, slotC: -1, label: makeLabel('❓') };
    day.customers.push(cu); day.spawned++;
    const sp = day.spawned > 1 && Math.random() < 0.45 ? freeSpot() : null;
    if (sp) { day.spots[sp.i] = 1; cu.spot = sp; person.walk(sp.via.concat([sp.p]), () => { cu.st = 'browse'; cu.wait = U.rnd(2.6, 4.6); person.face(sp.f); }); }   // primero mira un rato y después se acerca
    else toCounter(cu, [[dx, L.salon.zMax + 0.2]]);
    setTimeout(() => A.play('bell'), 900);
  }
  function toCounter(cu, pre) { cu.st = 'entering'; cu.person.walk(pre.concat([[L.puerta.x, -1.3], L.colaMostrador[cu.slotM]]), () => { cu.st = 'waitM'; cu.person.face(Math.PI); }); }
  /* ---------------- Gente que entra a mirar: algunos se van callados, otros comentan algo ---------------- */
  function freeSpot() {
    const u = upNow(), dx = L.puerta.x, H = Math.PI / 2, all = [
      { p: [-4.2, 1.5], f: -H, via: [[dx, 1.5]] }, { p: [-4.2, 4.4], f: -H, via: [[dx, 4.4]] }, { p: [-4.2, -1.3], f: -H, via: [[dx, -1.3]] },
      u.isla && { p: [-3.2, 1.7], f: Math.PI, via: [[dx, 1.7]] }, u.mesa && { p: [0.7, 1.0], f: H, via: [[dx, 1.0]] }, u.mesa && { p: [0.7, 2.7], f: H, via: [[dx, 2.7]] },
      u.gondola && { p: [4.3, 2.2], f: H, via: [[dx, 5.5], [4.3, 5.5]] }, u.gondola && { p: [4.3, 4.0], f: H, via: [[dx, 5.5], [4.3, 5.5]] }, u.arcade && { p: [0.7, 9.3], f: Math.PI, via: [[dx, 9.3]] }];
    const free = []; all.forEach((x, i) => { if (x && !day.spots[i]) { x.i = i; free.push(x); } });
    return free.length ? U.pick(free) : null;
  }
  function spawnLooker() {
    const sp = freeSpot(); if (!sp) return; day.spots[sp.i] = 1;
    const p = W.makePerson({ shirt: U.pick([0x6b7a8f, 0x3d7a4a, 0xd9a514, 0x4a6fb5, 0xb86fa8, 0x21a0a0, 0x7b4fd1, 0xe07a5f]), hair: U.pick(GS.HAIRS), hairStyle: U.pick(GS.HAIRSTYLES)[0], glasses: Math.random() < 0.3, beard: Math.random() < 0.2, lips: Math.random() < 0.4, speed: U.rnd(2.2, 2.9) });
    p.voice = U.rnd(230, 480); p.setPos(L.puerta.x + U.rnd(-0.4, 0.4), L.galeria.zMax + 2.4); day.extras.push(p);
    const lk = { p, sp, st: 'in', wait: 0, hops: 0 }; day.lookers.push(lk);
    p.walk(sp.via.concat([sp.p]), () => { lk.st = 'look'; lk.wait = U.rnd(3, 5.5); p.face(sp.f); });
  }
  function lookerOut(lk) {
    lk.st = 'out'; const d = day; delete d.spots[lk.sp.i];
    lk.p.walk(lk.sp.via.slice().reverse().concat([[L.puerta.x + U.rnd(-2, 2), L.galeria.zMax + 3]]), () => { lk.p.remove(); const i = d.lookers.indexOf(lk); if (i >= 0) d.lookers.splice(i, 1); });
  }
  function updateLookers(dt) {
    if (!day.closing && (day.lookT -= dt) <= 0) { day.lookT = U.rnd(8, 15) * (day.cond === 'lluvia' ? 1.8 : 1); if (day.lookers.length < 2 && day.wave >= 0) spawnLooker(); }
    for (const lk of day.lookers.slice()) {
      if (lk.st !== 'look' || (lk.wait -= dt) > 0) continue;
      const r = Math.random(), nx = lk.hops < 1 && r > 0.72 ? freeSpot() : null;
      if (nx) { delete day.spots[lk.sp.i]; day.spots[nx.i] = 1; const back = lk.sp.via.slice().reverse(); lk.sp = nx; lk.hops++; lk.st = 'in'; lk.p.walk(back.concat(nx.via, [nx.p]), () => { lk.st = 'look'; lk.wait = U.rnd(2.5, 4.5); lk.p.face(nx.f); }); continue; }
      if (r < 0.5) sayAt(lk.p, U.pick(LN.browse), 3200);
      lookerOut(lk);
    }
    for (const cu of day.customers) if (cu.st === 'browse' && (cu.wait -= dt) <= 0) { delete day.spots[cu.spot.i]; toCounter(cu, cu.spot.via.slice().reverse()); }
  }
  /* ---------------- Compañeros: Lucho y Brian andan por el local haciendo sus cosas ---------------- */
  const STAFF = [], MOHAWK = [0xff5fa2, 0x2d6cdf, 0x3bb54a, 0xd9a514, 0xff2a2a, 0x7b4fd1, 0x57e6ff];
  function luchoLook(n) { const l = W.staff()[0]; if (l) l.look({ skin: GS.SKINS[3], hair: MOHAWK[n % MOHAWK.length], hairStyle: 'mohicano', glasses: true }); }   // el mohicano cambia de color cada jornada
  const canTalk = () => state === 'day' && day && !day.arcade && !day.closing;
  function staffSay(st, key, prob) { if (canTalk() && Math.random() < (prob || 0.4)) sayAt(st.p, U.pick(LN.staff[key]), 2900, '', true); }
  function staffInit() {
    const ps = W.staff();
    STAFF.push({ p: ps[0], hub: [4.0, 0.9], q: [['wait', 2]], w: { repo: 4, taller: 2, mate: 1, vidriera: 1, siesta: 1 } }, { p: ps[1], hub: [3.6, 1.7], q: [['wait', 6]], w: { celu: 3, siesta: 2, repo: 2, mate: 1, vidriera: 1 } });
  }
  function staffPlan(st) {
    const P = st.p, out = [[4.5, -1.2]], dd = [[4.6, -4.4], [6.0, -4.4], [7.4, -4.4]], rev = a => a.slice().reverse(), go = pts => ['go', pts];
    let r = Math.random() * Object.values(st.w).reduce((a, b) => a + b, 0), k = 'celu'; for (const key in st.w) { if ((r -= st.w[key]) <= 0) { k = key; break; } }
    const round = (to, f, wait, key) => [go(to), ['face', f], ['fn', () => staffSay(st, key)], ['wait', wait], go(rev(to).slice(1).concat([st.hub]))];
    if (k === 'repo') {                       // busca una caja en el depósito y la repone en algún sector
      const tg = U.pick([{ to: [[-0.6, -1.6], [-4.3, -1.6]], back: [[-0.6, -1.6], [4.5, -1.2]], f: -1.57 }, { to: [[4.0, 0.9], [4.4, 2.0]], back: [[4.0, 0.9]], f: 1.57 }, { to: [[4.0, 0.9], [4.0, 5.5], [-0.3, 5.5], [-0.3, 8.0]], back: [[-0.3, 5.5], [4.0, 5.5], [4.0, 0.9]], f: 1.57 }]);
      st.q = [go(out.concat(dd, [[8.3, -4.6]])), ['face', 3.14], ['wait', 2.2], ['fn', () => P.carry(true)], go(rev(dd).concat(out, tg.to)), ['face', tg.f], ['fn', () => staffSay(st, 'repo')], ['wait', 2.6], ['fn', () => P.carry(false)], go(tg.back.concat([st.hub]))];
    } else if (k === 'siesta') {              // una siestita en el fondo del depósito
      st.q = [go(out.concat(dd, [[10.3, -4.4]])), ['fn', () => { P.lie(true); if (canTalk()) sayAt(P, '💤', 6500, '', true); }], ['wait', 7], ['fn', () => { P.lie(false); staffSay(st, 'siesta', 0.6); }], ['wait', 1.3], go(rev(dd).concat(out, [st.hub]))];
    } else if (k === 'taller') st.q = round([[4.0, 0.9], [4.0, 5.5], [6.0, 5.5], [7.4, 5.7]], 0.9, 3.5, 'taller');
    else if (k === 'mate') st.q = round(out.concat([[4.6, -4.4], [4.0, -5.3], [0.9, -5.8]]), 3.14, 3, 'mate');
    else if (k === 'vidriera') st.q = round([[4.0, 0.9], [4.0, 5.5], [-0.3, 5.5], [-0.3, 8.2]], 1.57, 3.5, 'vidriera');
    else st.q = [go([[st.hub[0] + U.rnd(-0.3, 0.5), st.hub[1] + U.rnd(-0.5, 0.5)]]), ['face', U.rnd(-0.6, 0.6)], ['wait', 5], ['fn', () => staffSay(st, 'celu', 0.25)]];
    st.q.push(['wait', U.rnd(2, 6)]);
  }
  function updateStaff(dt) {
    for (const st of STAFF) {
      if (st.busy || st.moving) continue;
      const step = st.q[0]; if (!step) { staffPlan(st); continue; }
      if (step[0] === 'go') { st.q.shift(); st.moving = true; st.p.walk(step[1], () => { st.moving = false; }); }
      else if (step[0] === 'wait') { if ((step[1] -= dt) <= 0) st.q.shift(); }
      else { st.q.shift(); if (step[0] === 'face') st.p.face(step[1]); else step[1](); }
    }
  }
  // Segunda caja: si se juntan 2 o más para pagar, Brian viene y le cobra a uno
  function updateHelper(dt) {
    const b = STAFF[1], h = day.helper;
    if (!h) {
      if (!upNow().caja2 || !b || b.busy) return;
      const wc = day.customers.filter(c => c.st === 'waitC'); if (wc.length < 2) return;
      const cu = wc.sort((a, c) => c.slotC - a.slotC)[0], g = b.p.group.position, pre = g.x > 6.2 && g.z < -1.2 ? [[7.4, -4.4], [6.0, -4.4]] : g.x > 6.2 ? [[6.0, 5.5], [4.0, 5.5], [4.5, -1.2]] : g.z > 5.8 ? [[-0.3, 5.5], [4.0, 5.5], [4.5, -1.2]] : g.z < -4.6 ? [] : [[4.5, -1.2]];
      cu.st = 'helped'; cu.slotC = -1; cu.label.hidden = true; b.busy = true; b.moving = false; b.q = []; b.p.lie(false); b.p.carry(false);
      const hp = day.helper = { cu, t: -1 }, d = day;
      cu.person.walk([[3.1, -2.9]], () => cu.person.face(Math.PI));
      b.p.walk(pre.concat(g.z < -4.6 ? [] : [[4.6, -4.4], [4.0, -5.0]], [L.brianCaja]), () => { if (day !== d) return; b.p.face(0); hp.t = 2.6; sayAt(b.p, U.pick(LN.staff.caja2), 2400); });
      return;
    }
    if (h.t < 0 || (h.t -= dt) > 0) return;
    const cu = h.cu; day.helper = null; day.served++; day.sales += cu.product.price; day.score += 90; addRep(0.03); A.play('cash');
    sayAt(cu.person, cu.arche.bye, 3200); leave(cu, true); toast('<b>🧾 Segunda caja</b>Brian le cobró a ' + cu.arche.name + '.', '', 2400);
    b.busy = false; b.q = [['go', [[4.0, -5.0], [4.6, -4.4], [4.5, -1.2], b.hub]], ['wait', 3]];
  }

  function spawnTask(forced) {
    const pool = TASK_STATIONS.filter(x => day.unlocked.indexOf(x.id) >= 0); if (!pool.length && !forced) return;
    if (!day.taskBag.length) day.taskBag = U.shuffle(pool);
    let st = forced || day.taskBag.pop();
    if (forced && forced.id === 'ml' && day.tasks.some(t => t.station === forced)) { day.queue.push({ kind: 'm', t: 6 }); return; }   // de a un pedido por vez
    if (!forced && day.tasks.some(t => t.station === st)) { const alt = pool.filter(s => !day.tasks.some(t => t.station === s)); if (!alt.length) return; st = U.pick(alt); }
    const task = { id: ++uid, station: st, arche: { face: st.icon, name: st.task.name, tag: st.task.tag }, pat: 1, st: 'wait', label: makeLabel(st.icon) };
    day.tasks.push(task); day.tasksSpawned++; A.play('speaker');
    if (st.id === 'proveedor') {                    // llega el repartidor con la carreta y deja las cajas
      const dx = L.puerta.x, dp = W.makePerson({ shirt: 0x8a6b3f, hair: 0x3a2a1a, hairStyle: 'pelado', beard: true, cart: true, speed: 2.4 }), d = day;
      dp.setPos(dx, L.galeria.zMax + 2.4); d.extras.push(dp);
      dp.walk([[dx, L.salon.zMax + 0.2], [dx, -0.9], [4.5, -0.9], [4.6, -4.0]], () => {
        if (day === d && d.tasks.indexOf(task) >= 0) task.boxes = W.dropBoxes(4.9, -5.4);
        dp.cargo(false); dp.walk([[4.5, -0.9], [dx, -0.9], [dx, L.salon.zMax + 0.2], [dx + 1.5, L.galeria.zMax + 3]], () => dp.remove());
      });
    }
    toast('<b>' + st.icon + ' ' + st.name + '</b>' + st.task.name + '. Cuando puedas.', '', 2200);
  }
  function freeSlot(key, n) {
    for (let i = 0; i < n; i++) if (!day.customers.some(c => c[key] === i && c.st !== 'leaving')) return i;
    return -1;
  }
  function leave(cu, withBag) {
    cu.st = 'leaving'; cu.slotM = -1; cu.slotC = -1; cu.label.hidden = true; cu.person.bag(!!withBag);
    const dx = L.puerta.x, d = day;
    cu.person.walk([[dx, -1.2], [dx, L.salon.zMax + 0.2], [dx + U.rnd(-2, 2), L.galeria.zMax + 3]], () => {
      cu.person.remove(); cu.label.remove(); const i = d.customers.indexOf(cu); if (i >= 0) d.customers.splice(i, 1);
    });
  }
  function removeTask(task) { task.label.remove(); if (task.boxes) task.boxes.remove(); const i = day.tasks.indexOf(task); if (i >= 0) day.tasks.splice(i, 1); }

  function addScore(base, pat) {
    const mult = (1 + Math.min(day.combo, 8) * 0.25) * (!day.arcade && day.cord >= CD.focus ? 1.1 : 1), pts = Math.round((base + Math.max(0, pat) * 100) * mult);
    addCord(day.combo >= 2 ? 1.5 + CD.streak : 1.5);
    day.score += pts; day.combo++; day.bestCombo = Math.max(day.bestCombo, day.combo);
    toast('+' + pts + (day.combo > 1 ? ' · racha x' + day.combo : ''), 'pts', 1100);
    if (day.combo > 1) A.play('combo', day.combo);
  }
  function breakCombo() { day.combo = 0; }

  /* Trabajos pendientes: clientes en mostrador, clientes en caja y tareas de las otras estaciones */
  function pendingJobs() {
    const jobs = [];
    for (const c of day.customers) {
      if (c.st === 'waitM') jobs.push({ key: 'c' + c.id, type: 'mostrador', ref: c, pat: c.pat, icon: '🛎', title: 'Mostrador', sub: 'Atender a ' + c.arche.name });
      else if (c.st === 'waitC') jobs.push({ key: 'c' + c.id + 'k', type: 'caja', ref: c, pat: c.pat, icon: '💵', title: 'Caja', sub: 'Cobrar a ' + c.arche.name });
    }
    for (const t of day.tasks) if (t.st === 'wait') jobs.push({ key: 't' + t.id, type: t.station.id, ref: t, pat: t.pat, icon: t.station.icon, title: t.station.name, sub: t.station.task.name });
    return jobs.sort((a, b) => a.pat - b.pat);
  }
  function focusFor(type) {
    const land = window.innerWidth > window.innerHeight && window.innerHeight <= 560;
    W.focus(type, land ? 0 : 0.27, land ? 0.25 : 0);
  }
  function openStation(type) {       // toque sobre una estación en el 3D
    if (state !== 'day' || !day || day.arcade) return;
    const job = pendingJobs().find(j => j.type === type);
    if (!job) { if (!MG.isOpen() && !paused) toast('No hay nada pendiente en ' + ST(type).name + '.', '', 1400); return; }
    openJob(job);
  }
  function openJob(job) {
    if (state !== 'day' || paused || MG.isOpen() || day.closing || day.beat > 0) return;
    A.unlock(); A.play('click');
    const ref = job.ref, isCust = job.type === 'mostrador' || job.type === 'caja';
    ref.st = isCust ? (job.type === 'mostrador' ? 'inM' : 'inC') : 'in'; ref.pat = Math.max(ref.pat, 0.55);
    focusFor(job.type);
    { const at = job.type === 'caja' || job.type === 'cierre' ? L.yoCaja : ['mostrador', 'whatsapp', 'devol', 'stock'].indexOf(job.type) >= 0 ? L.yoMostrador : null, yo = W.player(); if (at && yo) yo.walk([at], () => yo.face(0)); }
    const cb = {
      onMistake(kind) { breakCombo(); addRep(-0.02); addCord(-CD.mistake); if (kind === 'caja') day.cajaErr++; else day.otherErr++; if (!day.relaxed) ref.pat = Math.max(0.05, ref.pat - C.day.mistakeCost); },
      onEnd(ok, info) {
        if (job.type !== 'caja') W.focus(null);
        if (job.type === 'mostrador') {
          addScore(100, ref.pat); addRep(0.02); { const v = GS.Store.get('vid') || 0, saw = Math.random() < v * 0.7 + (upNow().vidluz ? 0.15 : 0); if (saw) addRep(0.02); sayAt(ref.person, saw ? U.pick(LN.sawWindow) : '¡Eso! Voy a la caja.', saw ? 3000 : 1900); } ref.st = 'toCaja'; ref.slotM = -1; ref.pat = Math.max(ref.pat, 0.8);
          ref.slotC = Math.max(0, freeSlot('slotC', L.colaCaja.length));
          ref.person.walk([[Math.min(ref.person.group.position.x + 0.8, 1.6), -2.1], L.colaCaja[ref.slotC]], () => { ref.st = 'waitC'; ref.person.face(Math.PI); });
        } else if (job.type === 'caja') {
          day.served++;
          if (info.total) day.sales += info.total;
          if (info.cajaError) { day.score = Math.max(0, day.score - 100); addRep(-0.25); }
          if (ok) { addScore(150, ref.pat); addRep(info.caught ? 0.05 : 0.04); }
          if (info.caught) {                 // comprobante trucho bien rechazado: se va renegando y sin el producto
            day.caught = (day.caught || 0) + 1; sayAt(ref.person, U.pick(LN.caught), 3600); day.beat = 1.5;
            const d0 = day; setTimeout(() => { if (day === d0 && !MG.isOpen()) W.focus(null); }, 2300);
            leave(ref, false); return;
          }
          // remate en el salón: la cámara se queda un momento y el cliente dice su frase al irse
          sayAt(ref.person, ref.arche.bye, 3600); day.beat = 1.5;
          const d = day; setTimeout(() => { if (day === d && !MG.isOpen()) W.focus(null); }, 2300);
          leave(ref, !!info.total);
        } else { day.tasksDone++; addScore(130, ref.pat); addRep(job.type === 'whatsapp' ? 0.05 : 0.03); if (job.type === 'vidriera') { GS.Store.set('vid', info.quality || 0); addRep((info.quality - 0.5) * 0.12); } removeTask(ref); }
      }
    };
    const seen = GS.Store.get('seen') || {};
    if (!seen[job.type] && GS.EXPLAIN[job.type] && !GS.DEBUG_NOINTRO) {
      MG.intro(ST(job.type), GS.EXPLAIN[job.type], () => { seen[job.type] = 1; GS.Store.set('seen', seen); start(); });
    } else start();
    function start() {
    let variant = null;
    if (job.type === 'caja') { variant = GS.DEBUG_VARIANT ? GS.DEBUG_VARIANT : day.cajaCount === 0 ? 'cobro' : U.pick(['comprobante', 'comprobante', 'cobro', 'vuelto']); day.cajaCount++; }
    if (job.type === 'service' && GS.DEBUG_VARIANT) variant = GS.DEBUG_VARIANT;
    MG.open(job.type, ref, cb, { variant });
    }
  }

  function updateDay(dt) {
    if (day.arcade) return updateArcade(dt);
    day.t += dt;
    const cfg = C.day, open = MG.isOpen();
    if (day.beat > 0) day.beat -= dt;
    // tandas: llegan unos pocos pendientes, se resuelven y viene un respiro
    if (!day.closing) {
      if (day.stage === 'rest') { day.rest -= dt; if (day.rest <= 0) startWave(); }
      else {
        for (const q of day.queue) q.t -= dt;
        while (day.queue.length && day.queue[0].t <= 0) { const q = day.queue.shift(); if (q.kind === 'c') spawnCustomer(); else if (q.kind === 'i') spawnIntr(); else spawnTask(q.kind === 'f' ? ST('cierre') : q.kind === 'm' ? ST('ml') : null); }
        if (!day.queue.length && !day.tasks.length && !open && !day.intr && day.customers.every(c => c.st === 'leaving')) endWave();
      }
    }
    updateLookers(dt); updateHelper(dt);
    // cordura: se recupera en los respiros y baja despacito cuando se junta mucho
    { const u = upNow();
      if (day.stage === 'rest' && day.wave >= 0 && !day.closing) addCord(CD.rest * (u.cafetera ? 1.6 : 1) * dt);
      else if (!day.relaxed && pendingJobs().length >= CD.busyFrom) addCord(-CD.busy * (u.plantas ? 0.6 : 1) * dt);
      if (day.cord < CD.burnt && !day.mate && !day.closing) mateRescue();
      if (day.intr && !open) { day.intr.left -= dt; if (day.intr.left <= 0) { day.intr = null; day.jobSig = ''; toast('Se resolvió solo. A veces pasa.', '', 1700); } } }
    // paciencia (en el turno tranquilo no baja)
    if (!day.relaxed) {
      for (const cu of day.customers.slice()) {
        if (cu.st === 'waitM' || cu.st === 'waitC') cu.pat -= dt / (cfg.patienceWait * patMult());
        else if ((cu.st === 'inM' || cu.st === 'inC') && !MG.isResolving()) cu.pat -= dt / cfg.patienceGame;
        if (cu.pat <= 0 && (cu.st === 'waitM' || cu.st === 'waitC' || cu.st === 'inM' || cu.st === 'inC')) {
          if (cu.st === 'inM' || cu.st === 'inC') { if (MG.isResolving()) { cu.pat = 0.01; continue; } MG.close(); W.focus(null); }
          day.lost++; breakCombo(); addRep(-0.15); addCord(-CD.lost); A.play('lost');
          sayAt(cu.person, cu.arche.lost, 3600); toast('<b>' + cu.arche.name + ' se fue sin comprar</b>', '', 2200);
          leave(cu, false);
        }
      }
      for (const t of day.tasks.slice()) {
        if (t.st === 'wait') t.pat -= dt / cfg.taskPatience;
        else if (!MG.isResolving()) t.pat -= dt / (cfg.patienceGame * 1.3);
        if (t.pat <= 0) {
          if (t.st === 'in') { if (MG.isResolving()) { t.pat = 0.01; continue; } MG.close(); W.focus(null); }
          day.tasksLate++; breakCombo(); addRep(-0.08); addCord(-CD.late); A.play('lost');
          toast('<b>' + t.station.icon + ' ' + t.station.name + '</b>' + t.station.task.late, '', 3200); removeTask(t);
        }
      }
    }
    if (open && MG.customer()) MG.setPatience(day.relaxed ? 1 : MG.customer().pat);
    updateHud(); updateJobs(); updateLabels(dt);
  }

  function fmtClock(f) { const m = Math.round(600 + f * 600); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.floor(m % 60 / 10) * 10).padStart(2, '0'); }
  function updateHud() {
    if (!day) return;
    if (day.arcade) {
      $('clockT').textContent = 'Ronda ' + Math.max(1, Math.min(day.round, C.day.arcadeRounds)) + '/' + C.day.arcadeRounds; $('clockS').textContent = 'Arcade · ' + ST(day.arcade).name;
      $('clockB').style.width = (Math.max(0, day.round - 1) / C.day.arcadeRounds * 100) + '%';
    } else {
      const tot = planTotals(day.plan), all = tot.c + tot.t, doneN = day.served + day.lost + day.tasksDone + day.tasksLate, f = Math.min(1, doneN / all);
      const fin = day.wave >= 0 && day.plan[day.wave].final, nw = day.plan.filter(w => !w.final).length, m = Math.round((600 + f * 540) / 10) * 10;
      $('clockT').textContent = '🕙 ' + String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); $('clockB').style.width = (f * 100).toFixed(1) + '%';
      $('clockS').textContent = day.closing ? 'Cerramos: son las 19' : fin ? 'Cierre de caja' : day.stage === 'rest' && day.wave >= 0 ? 'Respiro ☕' : 'Tanda ' + Math.max(1, day.wave + 1) + '/' + nw;
    }
    $('scoreV').textContent = day.score.toLocaleString('es-AR');
    $('chipSales').hidden = !!day.arcade; $('chipRep').hidden = !!day.arcade; $('chipRep').textContent = '⭐ ' + repTxt(repNow());
    $('chipSales').textContent = '🪙 ' + (coinsNow() + Math.round(day.score / 20 * coinMult()));
    { const k = Math.round(day.cord), el = $('chipCord'); el.hidden = !!day.arcade || !!day.fin; el.textContent = (k < CD.burnt ? '😵 ' : '🧠 ') + k + (k >= CD.focus ? ' · enfocado' : ''); el.className = 'chip cord' + (k >= CD.focus ? ' hi' : k < CD.burnt ? ' lo' : ''); }
    $('chipCombo').hidden = day.combo < 2; $('chipCombo').textContent = '🔥 racha x' + day.combo;
  }
  // Tarjetas de pendientes (abajo): hasta 4, primero lo más urgente
  let jobList = [];
  function updateJobs() {
    const all = pendingJobs(); jobList = all.slice(0, 4);
    const ix = day.intr, sig = jobList.map(j => j.key).join(',') + '|' + all.length + (ix ? '|i' + ix.it.t : ''), box = $('jobs');
    if (sig !== day.jobSig) {
      day.jobSig = sig;
      const bt = (ok, k) => '<button data-intr="' + (ok ? 1 : 0) + '">' + (ok ? ix.it.ok : ix.it.bad) + '</button>';
      box.innerHTML = (ix ? '<div class="intr"><span class="ji">' + ix.it.ic + '</span><span class="jt"><b>' + ix.it.who + '</b><small>' + ix.it.t + '</small></span><div class="ib">' + bt(!ix.flip) + bt(ix.flip) + '</div><span class="pb"><i id="intrBar"></i></span></div>' : '') + (jobList.length
        ? jobList.map((j, i) => '<button class="job" data-i="' + i + '"><span class="ji">' + j.icon + '</span><span class="jt"><b>' + j.title + '</b><small>' + j.sub + '</small></span><span class="pb"><i></i></span><kbd>' + (i + 1) + '</kbd></button>').join('') +
          (all.length > 4 ? '<div class="more">+' + (all.length - 4) + ' más esperando</div>' : '')
        : ix ? '' : '<div class="job idle"><span class="ji">☕</span><span class="jt"><b>Todo en orden</b><small>Respirá y mirá el local. Ya va a entrar alguien.</small></span></div>');
    }
    if (ix && $('intrBar')) $('intrBar').style.width = Math.max(0, ix.left / CD.intrSeconds * 100) + '%';
    box.classList.toggle('beat', day.beat > 0);
    const bars = box.querySelectorAll('.job .pb i');
    jobList.forEach((j, i) => { if (bars[i]) { bars[i].style.width = Math.max(4, j.pat * 100) + '%'; bars[i].style.background = barColor(j.pat); } });
  }
  const barColor = p => p > 0.5 ? 'var(--ok)' : p > 0.25 ? 'var(--warn)' : 'var(--red)';
  function setLabel(label, x, z, pat, icon) {
    const p = W.project(x, 1.75, z);
    label.style.left = p.x.toFixed(1) + 'px'; label.style.top = p.y.toFixed(1) + 'px';
    if (icon) label.firstChild.textContent = icon;
    const i = label.lastChild.firstChild; i.style.width = Math.max(0, pat * 100) + '%'; i.style.background = barColor(pat);
  }
  function updateLabels(dt) {
    for (const sy of day.says.slice()) {
      sy.left -= dt || 0;
      if (sy.left <= 0) { sy.el.remove(); day.says.splice(day.says.indexOf(sy), 1); continue; }
      const g = sy.person.group.position, p = W.project(g.x, sy.el.classList.contains('boss') ? 2.7 : 2.25, g.z); { const hw = sy.el.offsetWidth / 2 + 8; sy.el.style.left = U.clamp(p.x, hw, window.innerWidth - hw).toFixed(1) + 'px'; } sy.el.style.top = Math.max(sy.el.offsetHeight + 120, p.y).toFixed(1) + 'px';
    }
    for (const cu of day.customers) {
      const show = cu.st === 'waitM' || cu.st === 'waitC' || cu.st === 'toCaja';
      cu.label.hidden = !show; if (!show) continue;
      const g = cu.person.group.position; setLabel(cu.label, g.x, g.z, cu.pat, cu.st === 'waitM' ? '❓' : '💵');
    }
    for (const t of day.tasks) { t.label.hidden = t.st !== 'wait'; if (t.st === 'wait') setLabel(t.label, t.station.pos[0], t.station.pos[1], t.pat); }
  }

  /* ---------------- Arcade: una estación suelta, 5 rondas seguidas ---------------- */
  function startArcade(id) {
    A.unlock(); A.play('click'); clearDay();
    day = newDay({ arcade: id, round: 0, job: null, wait: 0.5 }); state = 'day'; enterPlay(); $('jobs').hidden = true; A.setMood('day');
    updateHud(); GS.track('inicio_minijuego', { estacion: id, modo: 'arcade' });
  }
  function arcadeJob(id) {
    const st = ST(id);
    if (id === 'mostrador' || id === 'caja') {
      if (!day.reqBag.length) day.reqBag = U.shuffle(GS.REQUESTS);
      if (!day.archBag.length) day.archBag = U.shuffle(GS.CUSTOMERS);
      const req = day.reqBag.pop();
      return { arche: day.archBag.pop(), request: req.t, product: GS.CATALOG.find(p => p.id === req.p), pat: 1 };
    }
    return { arche: { face: st.icon, name: st.task.name, tag: st.task.tag }, pat: 1 };
  }
  function updateArcade(dt) {
    const id = day.arcade;
    if (!MG.isOpen() && !day.closing) {
      day.wait -= dt;
      if (day.wait <= 0) {
        if (day.round >= C.day.arcadeRounds) { day.closing = true; setTimeout(endArcade, 300); return; }
        day.round++; const job = day.job = arcadeJob(id); focusFor(id);
        let variant = null;
        if (id === 'caja') variant = ['cobro', 'vuelto', 'comprobante', 'cobro', 'vuelto'][day.round - 1];
        if (id === 'service') variant = ['diag', 'pelusa', 'ram', 'diag', 'ram'][day.round - 1];
        MG.open(id, job, {
          onMistake(kind) { breakCombo(); day.otherErr++; job.pat = Math.max(0, job.pat - 0.1); },
          onEnd(ok, info) { if (ok) addScore(100, job.pat); else breakCombo(); day.tasksDone++; day.wait = 0.5; day.job = null; }
        }, { variant });
      }
    } else if (day.job && !MG.isResolving()) { day.job.pat = Math.max(0, day.job.pat - dt / C.day.arcadeSeconds); MG.setPatience(day.job.pat); }
    updateHud();
  }
  function endArcade() {
    if (!day || state !== 'day') return;
    state = 'end'; MG.close(); W.focus(null); W.showAll(); A.play('endDay'); A.setMood('menu'); $('hud').hidden = true;
    const d = day, st = ST(d.arcade), bests = GS.Store.get('arcade') || {}, prev = bests[st.id] || 0, rec = d.score > prev;
    if (rec) { bests[st.id] = d.score; GS.Store.set('arcade', bests); }
    GS.track('fin_minijuego', { estacion: st.id, puntaje: d.score });
    $('endCol').innerHTML =
      '<div><div class="ticket"><h3>ARCADE</h3><div class="c">' + st.icon + ' ' + st.name + ' · ' + C.day.arcadeRounds + ' rondas</div>' +
      '<p><span>Errores</span><b>' + d.otherErr + '</b></p><p><span>Mejor racha</span><b>x' + d.bestCombo + '</b></p><p><span>Tu récord anterior</span><b>' + prev.toLocaleString('es-AR') + '</b></p><hr>' +
      '<p class="tot"><span>PUNTAJE</span><b>' + d.score.toLocaleString('es-AR') + '</b></p></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">' + (rec ? '<div class="newrec">🏆 ¡Nuevo récord en ' + st.name + '!</div>' : '') +
      '<button class="btn" id="endAgain">Otra vez</button><div class="row"><button class="btn ghost" id="endArc">Otra estación</button><button class="btn ghost" id="endHome">Inicio</button></div>' +
      '<button class="phases" id="phasesEnd"></button></div>';
    $('phasesEnd').innerHTML = phasesCompact(); $('phasesEnd').addEventListener('click', showPhases);
    $('endAgain').addEventListener('click', () => startArcade(st.id));
    $('endArc').addEventListener('click', () => { goHome(); showArcade(); }); $('endHome').addEventListener('click', goHome);
    $('end').hidden = false; $('end').scrollTop = 0;
  }
  function showArcade() {
    const bests = GS.Store.get('arcade') || {};
    modal('<h2>Arcade</h2><p>Jugá una estación suelta: 5 rondas seguidas, sin clientes esperando.</p><div class="arc">' +
      GS.STATIONS.map(s => '<button class="arc-b' + (s.soon ? ' soon' : '') + '" data-id="' + s.id + '"' + (s.soon ? ' disabled' : '') + '><span class="ji">' + s.icon + '</span><b>' + s.name + '</b><small>' +
        (s.soon ? 'Próximamente' : bests[s.id] ? 'Récord: ' + bests[s.id].toLocaleString('es-AR') : 'Sin jugar') + '</small></button>').join('') +
      '</div><button class="btn ghost" data-close>Volver</button>');
    $('sheet').querySelectorAll('.arc-b:not(.soon)').forEach(b => b.addEventListener('click', () => startArcade(b.dataset.id)));
  }

  /* ---------------- Cierre de caja ---------------- */
  function endDay() {
    if (!day || state !== 'day' || day.arcade) return;
    state = 'end'; MG.close(); W.focus(null); W.showAll(); A.play('endDay'); A.setMood('menu'); $('rain').hidden = true;
    const d = day; d.intr = null;
    const cordEnd = Math.round(d.cord), cordPts = cordEnd * CD.bonus; d.score += cordPts;
    d.customers.slice().forEach(c => { if (c.st !== 'leaving') leave(c, false); }); d.lookers.slice().forEach(lk => { if (lk.st !== 'out') { lk.p.stop(); lookerOut(lk); } });
    d.tasks.slice().forEach(removeTask); d.says.forEach(x => x.el.remove()); d.says = [];
    $('hud').hidden = true; $('jobs').hidden = true;
    const done = d.served + d.tasksDone, missed = d.lost + d.tasksLate, errs = d.cajaErr + d.otherErr;
    let stars = 1;
    if (d.relaxed) stars = errs === 0 ? 3 : errs <= 4 ? 2 : 1;
    else { if (missed <= 2) stars = 2; if (missed === 0 && errs <= 3) stars = 3; }
    const comment = U.pick(stars === 3 ? LN.duenoEndGood : stars === 2 ? LN.duenoEndMid : LN.duenoEndBad);
    const human = U.pick(LN.human).replace('{n}', d.served);
    const entry = { score: d.score, served: done, sales: d.sales, mode: d.relaxed ? 'Tranquilo' : 'Normal', date: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) };
    const pos = d.score > 0 ? GS.Store.addScore(entry) : -1;
    if (!GS.Store.get('testDay')) GS.Store.set('days', Math.max(GS.Store.get('days') || 0, d.n));
    { const tot = GS.Store.get('tot') || { c: 0, d: 0 }; tot.c += d.served; tot.d++; GS.Store.set('tot', tot); }
    const isFinal = d.n === C.finalDay && !GS.Store.get('testDay') && !GS.Store.get('finalSeen');
    lastCard = { n: d.n, score: d.score, stars, cord: cordEnd };
    const earned = Math.round(d.score / 20 * coinMult()); GS.Store.set('coins', coinsNow() + earned);
    const rv = repNow(), rd = rv - d.rep0; refreshStart();
    GS.track('fin_jornada', { puntaje: d.score, atendidos: d.served, tareas: d.tasksDone, perdidos: missed, estrellas: stars, modo: entry.mode });
    $('endCol').innerHTML =
      '<div><div class="ticket"><h3>CIERRE DE CAJA</h3><div class="c">Jornada ' + d.n + ' · ' + rankOf(d.n) + (d.cond ? ' · ' + GS.CONDITIONS[d.cond].name : '') + (d.relaxed ? ' · turno tranquilo' : '') + '</div>' +
      '<p><span>Clientes atendidos</span><b>' + d.served + '</b></p><p><span>Tareas del local hechas</span><b>' + d.tasksDone + '</b></p>' +
      '<p><span>Se fueron sin comprar</span><b>' + d.lost + '</b></p><p><span>Tareas que se pasaron</span><b>' + d.tasksLate + '</b></p>' +
      '<p><span>Errores (con chiste)</span><b>' + errs + '</b></p>' +
      (d.caught ? '<p><span>Comprobantes truchos frenados</span><b>' + d.caught + '</b></p>' : '') +
      (d.intrOk ? '<p><span>Interrupciones bien resueltas</span><b>' + d.intrOk + '</b></p>' : '') +
      '<p><span>Cordura al cierre</span><b>🧠 ' + cordEnd + ' (+' + cordPts + ' pts)</b></p>' +
      '<p><span>Mejor racha</span><b>x' + d.bestCombo + '</b></p><p><span>Ventas (ficticias)</span><b>' + U.money(d.sales) + '</b></p>' +
      '<p><span>Monedas ganadas hoy</span><b>🪙 ' + earned + '</b></p><p><span>Reputación del local</span><b>⭐ ' + repTxt(rv) + ' (' + (rd >= 0 ? '+' : '−') + repTxt(Math.abs(rd)) + ')</b></p><hr>' +
      '<p class="tot"><span>PUNTAJE</span><b>' + d.score.toLocaleString('es-AR') + '</b></p><div class="stars">' + '★'.repeat(stars) + '<span style="opacity:.25">' + '★'.repeat(3 - stars) + '</span></div></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">' +
      (rankOf(d.n + 1) !== rankOf(d.n) && !GS.Store.get('testDay') ? '<div class="promo">🎖 ¡Ascenso!<b>Ahora sos ' + rankOf(d.n + 1) + '</b></div>' : '') +
      (pos === 0 ? '<div class="newrec">🏆 ¡Nuevo récord personal!</div>' : '') +
      '<div class="quote"><b>El Dueño opina</b>' + comment + '</div><p class="humanline">' + human + '</p>' +
      goalHtml() + '<button class="btn alt" id="endShop">🛠 Mejorar el local</button>' +
      (isFinal ? '<button class="btn gold" id="endFinal">🎬 Ver el final de la temporada</button>' : '') +
      '<button class="btn' + (isFinal ? ' ghost' : '') + '" id="endAgain">Siguiente jornada</button><button class="btn ghost" id="endCard">📸 Tarjeta para compartir</button>' +
      '<div class="row"><button class="btn ghost" id="endHome">Inicio</button><button class="btn ghost" id="endRecs">Récords</button></div>' +
      (C.links.tienda ? '<a class="btn ghost" id="endStore" target="_blank" rel="noopener" href="' + C.links.tienda + '">🛒 Ver la tienda de verdad</a>' : '') +
      '<button class="phases" id="phasesEnd"' + (C.launched ? ' hidden' : '') + '></button></div>';
    $('phasesEnd').innerHTML = phasesCompact(); $('phasesEnd').addEventListener('click', showPhases);
    if ($('endStore')) $('endStore').addEventListener('click', () => GS.track('click_tienda', { desde: 'cierre' }));
    $('endCard').addEventListener('click', () => showCard()); if (isFinal) $('endFinal').addEventListener('click', () => startFinal());
    $('endAgain').addEventListener('click', () => startDay(d.relaxed));
    $('endHome').addEventListener('click', goHome); $('endRecs').addEventListener('click', showRecords); $('endShop').addEventListener('click', openShop);
    $('end').hidden = false; $('end').scrollTop = 0;
  }
  /* ---------------- Mejoras del local (la recompensa por seguir jugando) ---------------- */
  function nextGoal() {                 // lo más barato que todavía no tiene
    const u = upNow(); let best = null;
    GS.UPGRADES.forEach(g => { const lv = g.levels[u[g.id] || 0]; if (lv && (!best || lv.price < best.lv.price)) best = { g, lv }; });
    return best;
  }
  function goalHtml() {
    const t = nextGoal(), c = coinsNow(); if (!t) return '<div class="goal"><b>🏆 Local completo</b><span>Compraste todas las mejoras.</span></div>';
    const f = Math.min(1, c / t.lv.price);
    return '<div class="goal"><b>' + t.g.icon + ' Próxima mejora: ' + t.lv.n + '</b><span>' + (f >= 1 ? '¡Ya te alcanza! Andá a Mejorar el local.' : 'Ahorraste 🪙 ' + c + ' de ' + t.lv.price) + '</span><div class="pb"><i style="width:' + (f * 100).toFixed(0) + '%"></i></div></div>';
  }
  const rankOf = n => { let rk = GS.RANKS[0][1]; GS.RANKS.forEach(r => { if (n >= r[0]) rk = r[1]; }); return rk; };
  let shopSel = 0;
  function openShop() {
    A.unlock(); A.play('click'); A.setMood('menu'); state = 'shop'; $('start').hidden = true; $('end').hidden = true; $('shop').hidden = false; shopSel = 0;
    const t = nextGoal(); if (t) shopSel = GS.UPGRADES.indexOf(t.g);
    renderShop();
  }
  function renderShop(preview) {
    const u = upNow(), c = coinsNow(), g = GS.UPGRADES[shopSel], own = u[g.id] || 0;
    $('shopCoins').textContent = '🪙 ' + c;
    $('shopSlots').innerHTML = GS.UPGRADES.map((x, i) => '<button class="slotb' + (i === shopSel ? ' on' : '') + ((u[x.id] || 0) >= x.levels.length ? ' full' : '') + '" data-i="' + i + '">' + x.icon + '<small>' + x.name + '</small></button>').join('');
    $('shopCards').innerHTML = g.levels.map((lv, i) => {
      const has = own > i, can = own === i && c >= lv.price, locked = own < i;
      return '<div class="card' + (has ? ' has' : '') + '"><b>' + lv.n + '</b><span>' + lv.d + '</span><div class="row"><em>' + (has ? '✔ Ya lo tenés' : '🪙 ' + lv.price) + '</em>' +
        (has ? '' : '<button class="btn" data-buy="' + i + '"' + (can ? '' : ' disabled') + '>' + (locked ? 'Primero el anterior' : can ? 'Comprar' : 'Te faltan ' + (lv.price - c)) + '</button>') + '</div></div>';
    }).join('') + (g.levels.length > 1 ? '' : '');
    const show = Object.assign({}, u); show[g.id] = Math.max(own, preview == null ? Math.min(own + 1, g.levels.length) : preview);   // vista previa del modelo en su lugar
    W.setUpgrades(show); W.focusAt(g.pos[0], g.pos[1], g.zoom || 0.36, 0.2);
    $('shopHint').textContent = (shopSel + 1) + ' de ' + GS.UPGRADES.length + ' · ' + (own >= g.levels.length ? 'Ya lo tenés en el local.' : 'Vista previa en el local');
  }
  function buy(i) {
    const u = upNow(), g = GS.UPGRADES[shopSel], lv = g.levels[i]; if ((u[g.id] || 0) !== i || coinsNow() < lv.price) return;
    u[g.id] = i + 1; GS.Store.set('up', u); GS.Store.set('coins', coinsNow() - lv.price); A.play('cash'); toast('<b>¡Mejora comprada!</b>' + lv.n, '', 2600); renderShop();
  }
  function closeShop() { $('shop').hidden = true; W.setUpgrades(upNow()); state = 'menu'; $('start').hidden = false; refreshStart(); W.showAll(); A.play('click'); }
  function avatarSvg(a) {
    const hex = n => '#' + n.toString(16).padStart(6, '0'), h = hex(a.hair), sk = hex(a.skin), st = a.hairStyle || 'corto';
    const top = '<path d="M22.600 46 A27.400 27.400 0 0 1 77.400 46 L73.500 46 Q71 33 50 33.500 Q29 33 26.500 46z" fill="' + h + '"/>';   // casquete concéntrico con la cabeza, con patillas
    let v = '<svg viewBox="0 0 100 124" width="120" height="149"><path d="M33 122 L43 66 H57 L67 122z" fill="#e10600"/><path d="M43 66 H57 L50 76z" fill="#fff"/>';
    if (st === 'largo') v += '<path d="M19.500 44 A30.500 30.500 0 0 1 80.500 44 V82 Q80.500 92 71 92 H29 Q19.500 92 19.500 82z" fill="' + h + '"/>';
    v += '<circle cx="50" cy="44" r="26" fill="' + sk + '"/><circle cx="33" cy="52" r="5" fill="#ff6b6b" opacity=".22"/><circle cx="67" cy="52" r="5" fill="#ff6b6b" opacity=".22"/>';
    if (st === 'corto' || st === 'rodete') v += top;
    if (st === 'largo') v += top;
    if (st === 'rodete') v += '<circle cx="50" cy="13" r="10" fill="' + h + '"/>';
    if (st === 'rulos') { v += top; for (let i = 0; i < 9; i++) { const an = Math.PI * (1.02 + i * 0.12); v += '<circle cx="' + (50 + Math.cos(an) * 26).toFixed(1) + '" cy="' + (44 + Math.sin(an) * 26).toFixed(1) + '" r="9.500" fill="' + h + '"/>'; } v += '<circle cx="40" cy="24" r="8" fill="' + h + '"/><circle cx="60" cy="24" r="8" fill="' + h + '"/><circle cx="50" cy="20" r="8" fill="' + h + '"/>'; }
    if (st === 'mohicano') v += '<path d="M43 30 L45 6 L50 14 L55 4 L57 30 Q50 26 43 30z" fill="' + h + '"/>';
    if (a.beard) v += '<path d="M24.500 48 A26.500 26.500 0 0 0 75.500 48 Q70 57 60 54 Q50 49 40 54 Q30 57 24.500 48z" fill="' + h + '"/>';
    v += '<ellipse cx="40" cy="43" rx="3.400" ry="4.200" fill="#16161c"/><ellipse cx="60" cy="43" rx="3.400" ry="4.200" fill="#16161c"/><circle cx="41.200" cy="41.500" r="1.100" fill="#fff"/><circle cx="61.200" cy="41.500" r="1.100" fill="#fff"/>';
    if (a.lashes) v += '<g stroke="#16161c" stroke-width="1.800" stroke-linecap="round"><path d="M35.500 39.500l-3-2.500M38 37.800l-1.500-3.300M41 37.300l.5-3.500M64.500 39.500l3-2.500M62 37.800l1.500-3.300M59 37.300l-.5-3.500"/></g>';
    if (a.glasses) v += '<g fill="rgba(255,255,255,.18)" stroke="#16161c" stroke-width="2.400"><circle cx="40" cy="43" r="8.500"/><circle cx="60" cy="43" r="8.500"/></g><path d="M48.500 43h3" stroke="#16161c" stroke-width="2.400"/>';
    v += a.lips ? '<path d="M43 58 Q46.500 55.500 50 57.500 Q53.500 55.500 57 58 Q50 65 43 58z" fill="#d81e5b"/>' : '<path d="M43.500 58 Q50 63 56.500 58" fill="none" stroke="' + (a.beard ? '#fff' : '#8a4a2a') + '" stroke-width="2.400" stroke-linecap="round" opacity=".9"/>';
    return v + '</svg>';
  }
  function showAvatar(then) {
    const a = Object.assign({ skin: GS.SKINS[2], hair: GS.HAIRS[0], hairStyle: 'corto', glasses: false, beard: false, lips: false }, GS.Store.get('avatar') || {}), hex = n => '#' + n.toString(16).padStart(6, '0');
    const sw = (key, list) => '<div class="sw" data-k="' + key + '">' + list.map(c => '<button style="background:' + hex(c) + '" data-c="' + c + '" class="' + (a[key] === c ? 'on' : '') + '"></button>').join('') + '</div>';
    modal('<h2>Tu personaje</h2><p>Sos quien atiende el mostrador. Combiná lo que quieras.</p><div class="avprev" id="avPrev"></div>' +
      '<div class="setting"><span>Piel</span>' + sw('skin', GS.SKINS) + '</div><div class="setting"><span>Pelo</span>' + sw('hair', GS.HAIRS) + '</div>' +
      '<div class="setting"><span>Peinado</span><div class="seg" id="avStyle">' + GS.HAIRSTYLES.map(h => '<button data-v="' + h[0] + '" class="' + (a.hairStyle === h[0] ? 'on' : '') + '">' + h[1] + '</button>').join('') + '</div></div>' +
      '<div class="setting"><span>Accesorios</span><div class="seg" id="avAcc">' + [['glasses', 'Anteojos'], ['beard', 'Barba'], ['lips', 'Labios pintados'], ['lashes', 'Pestañas']].map(x => '<button data-v="' + x[0] + '" class="' + (a[x[0]] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div></div>' +
      '<button class="btn" data-close>Listo</button>', () => { GS.Store.set('avatar', a); W.setPlayerLook(a); if (then) then(); });
    const paint = () => { $('avPrev').innerHTML = avatarSvg(a); W.setPlayerLook(a); };
    $('sheet').querySelectorAll('.sw').forEach(s => s.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; a[s.dataset.k] = Number(b.dataset.c); s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); paint(); }));
    $('avStyle').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; a.hairStyle = b.dataset.v; $('avStyle').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); paint(); });
    $('avAcc').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; a[b.dataset.v] = !a[b.dataset.v]; b.classList.toggle('on', a[b.dataset.v]); paint(); });
    paint();
  }
  function refreshStart() {
    const n = dayNumber(), fresh = n <= GS.UNLOCKS.length ? GS.UNLOCKS[n - 1] : [];
    $('playT').textContent = 'Jugar la jornada ' + n; $('goalStart').innerHTML = goalHtml();
    $('rankT').textContent = '🎖 ' + rankOf(n) + ' · ⭐ ' + repTxt(repNow()) + ' · 🪙 ' + coinsNow();
    $('playS').textContent = n === 1 ? 'Inducción: mostrador y caja · de 10 a 19' : fresh.length ? 'Se suma: ' + fresh.map(id => ST(id).name).join(' y ') : 'De 10 a 19 · reputación ⭐ ' + repTxt(repNow());
  }
  function goHome() {
    A.play('click'); A.setMood('menu'); clearDay(); $('rain').hidden = true; $('final').hidden = true;
    day = null; state = 'menu'; paused = false;
    $('end').hidden = true; $('hud').hidden = true; $('jobs').hidden = true; $('start').hidden = false; $('toasts').innerHTML = ''; W.showAll();
  }

  /* ---------------- Escena final: el Dueño sale, los clientes festejan y queda la tarjeta ---------------- */
  let lastCard = null;
  function startFinal() {
    A.unlock(); clearDay(); ['rain', 'end', 'start', 'hud', 'jobs', 'modal', 'finCard'].forEach(id => { $(id).hidden = true; }); $('toasts').innerHTML = '';
    $('final').hidden = false; $('final').classList.remove('party'); $('finSkip').hidden = false;
    if (!$('confetti').children.length) $('confetti').innerHTML = Array.from({ length: 36 }, (_, i) => '<i style="left:' + (i * 2.8 + Math.random() * 2).toFixed(1) + '%;background:' + ['#ff0000', '#fff', '#f5c518', '#57e6ff'][i % 4] + ';animation-duration:' + (2.6 + Math.random() * 2.4).toFixed(2) + 's;animation-delay:-' + (Math.random() * 4).toFixed(2) + 's"></i>').join('');
    day = newDay({ fin: { i: -1, t: 3.2, crowd: [], done: false } }); state = 'final'; paused = false; W.setUpgrades(upNow()); A.setMood('final'); A.play('fanfare');
    W.focusAt(0.6, -1.4, 0.66, -0.08);
    const d = day, f = d.fin, bx = 4.3, bz = -0.5, dx = L.puerta.x;
    const spots = [[-3.3, -1.7], [-1.9, -0.9], [-0.5, -1.8], [0.5, -0.5], [-2.8, 0.5], [-1.1, 0.7], [0.3, 1.3], [-4.2, -0.4], [1.2, -1.6]];
    f.lines = GS.FINAL.boss.map(x => x.replace('{rank}', rankOf(C.finalDay + 1)));
    GS.CUSTOMERS.forEach((ar, i) => {
      const k = ar.id.charCodeAt(0) + ar.id.length * 7, sp = spots[i % spots.length];
      const p = W.makePerson({ shirt: ar.shirt, hair: ar.hair, hairStyle: GS.HAIRSTYLES[k % 5][0], glasses: k % 3 === 0, beard: k % 4 === 1, lips: k % 2 === 0, lashes: k % 5 < 2, speed: 3.6 });
      p.setPos(dx + U.rnd(-0.4, 0.4), L.salon.zMax + 0.6 + i * 0.7); d.extras.push(p); f.crowd.push(p);
      p.walk([[dx, 3.4], sp], () => p.face(Math.atan2(bx - sp[0], bz - sp[1])));
    });
    const boss = W.boss(); d.dueno = boss;
    setTimeout(() => { if (day === d) boss.walk([[7.3, -0.3], [bx, bz]], () => boss.face(-1.25)); }, 1200);
    GS.track('final_visto', {});
  }
  function updateFinal(dt) {
    const f = day.fin;
    if (!f.done && (f.t -= dt) <= 0) {
      f.i++;
      if (f.i < f.lines.length) {
        A.play('speaker'); sayAt(W.boss(), f.lines[f.i], 5400, 'boss'); f.t = 5.9;
        if (f.i >= 2) $('final').classList.add('party');
        if (f.i >= 1) { const d = day; setTimeout(() => { if (day !== d) return; U.shuffle(f.crowd).slice(0, 3).forEach((p, j) => sayAt(p, U.pick(GS.FINAL.crowd), 2000, '', j > 0)); }, 3300); }
      } else finishFinal();
    }
    updateLabels(dt);
  }
  function finishFinal() {
    const f = day && day.fin; if (!f || f.done) return; f.done = true; GS.Store.set('finalSeen', true);
    day.says.forEach(x => x.el.remove()); day.says = []; $('final').classList.add('party'); $('finSkip').hidden = true; A.play('fanfare');
    f.crowd.forEach((p, j) => { if (j % 2 === 0) sayAt(p, U.pick(GS.FINAL.crowd), 60000, '', true); });
    $('finCard').innerHTML = '<h2>Fin de la <span>temporada</span></h2><p>Llegaste a <b>' + rankOf(C.finalDay + 1) + '</b>. El local sigue abierto: podés seguir jugando jornadas, comprar las mejoras que falten y batir tus récords.</p>' +
      '<button class="btn" id="finShare">📸 Tarjeta para compartir</button><button class="btn ghost" id="finGo">Seguir jugando</button><small>Un juego de GameShop · Gracias por jugar</small>';
    $('finCard').hidden = false;
    $('finShare').addEventListener('click', () => showCard(true)); $('finGo').addEventListener('click', goHome);
  }
  /* ---------------- Tarjeta para compartir: una imagen con tu personaje, tu rango y tus números ---------------- */
  const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  function drawCard(fin) {
    const n = Math.max(1, GS.Store.get('days') || 0), tot = GS.Store.get('tot') || { c: 0 }, best = (GS.Store.get('best') || [])[0], lc = lastCard || {};
    const a = Object.assign({ skin: GS.SKINS[2], hair: GS.HAIRS[0], hairStyle: 'corto' }, GS.Store.get('avatar') || {});
    const url = C.shareUrl || (/^http/.test(location.protocol) ? (location.host + location.pathname).replace(/\/(index\.html)?$/, '') : 'www.gameshop.com.ar');
    const svg = avatarSvg(a).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace('width="120" height="149"', 'width="480" height="596"');
    return Promise.all([loadImg(GS.LOGO), loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg))]).then(im => {
      const W_ = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W_; cv.height = H; const g = cv.getContext('2d'), F = (px, w) => (w || '900') + ' ' + px + 'px Impact, Haettenschweiler, "Arial Narrow", "Arial Black", sans-serif';
      const bg = g.createRadialGradient(W_ / 2, 520, 60, W_ / 2, 520, 900); bg.addColorStop(0, '#4a0d0d'); bg.addColorStop(0.5, '#170607'); bg.addColorStop(1, '#000'); g.fillStyle = bg; g.fillRect(0, 0, W_, H);
      const stripe = (x, w, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w - 150, 300); g.lineTo(x - 150, 300); g.fill(); };
      g.save(); g.globalAlpha = 0.9; stripe(120, 46, '#ff0000'); stripe(196, 30, '#fff'); stripe(W_ - 20, 46, '#ff0000'); stripe(W_ - 96, 30, '#fff'); g.restore();
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if (im[0]) { const lw = 600, lh = lw * im[0].height / im[0].width; g.drawImage(im[0], (W_ - lw) / 2, 78, lw, lh); }
      g.fillStyle = '#fff'; g.font = F(58, '400'); g.fillText('S I M U L A T O R', W_ / 2, 300);
      // personaje en un círculo
      g.fillStyle = '#fff'; g.beginPath(); g.arc(W_ / 2, 560, 218, 0, 7); g.fill(); g.fillStyle = '#e9e9ee'; g.beginPath(); g.arc(W_ / 2, 560, 204, 0, 7); g.fill();
      if (im[1]) { g.save(); g.beginPath(); g.arc(W_ / 2, 560, 204, 0, 7); g.clip(); try { g.drawImage(im[1], W_ / 2 - 190, 372, 380, 472); } catch (e) {} g.restore(); }
      g.lineWidth = 10; g.strokeStyle = '#ff0000'; g.beginPath(); g.arc(W_ / 2, 560, 223, 0, 7); g.stroke();
      // rango
      const rk = rankOf(n + 1).toUpperCase(); g.font = F(64); const rw = Math.min(940, g.measureText(rk).width + 90);
      g.fillStyle = '#f5c518'; g.beginPath(); g.moveTo(W_ / 2 - rw / 2 + 24, 770); g.lineTo(W_ / 2 + rw / 2, 770); g.lineTo(W_ / 2 + rw / 2 - 24, 868); g.lineTo(W_ / 2 - rw / 2, 868); g.fill();
      g.fillStyle = '#000'; g.fillText(rk, W_ / 2, 843, 860);
      g.fillStyle = '#fff'; g.font = F(50, '700'); g.fillText(GS.FINAL.card[0].replace('{n}', n), W_ / 2, 946, 980);
      // tres números
      const stats = [[(best ? best.score : lc.score || 0).toLocaleString('es-AR'), 'MEJOR PUNTAJE'], [String(tot.c), 'CLIENTES ATENDIDOS'], [repTxt(repNow()) + ' / 5', 'REPUTACIÓN']];
      stats.forEach((st, i) => { const x = 60 + i * 325, w = 310; g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x, 990, w, 150); g.fillStyle = '#ff0000'; g.fillRect(x, 990, w, 8);
        g.fillStyle = '#fff'; g.font = F(72); g.fillText(st[0], x + w / 2, 1080, w - 24); g.fillStyle = '#c9c9d2'; g.font = '700 24px system-ui, Arial, sans-serif'; g.fillText(st[1], x + w / 2, 1120, w - 16); });
      if (fin || GS.Store.get('finalSeen')) { g.fillStyle = '#f5c518'; g.font = F(34, '700'); g.fillText('★  TEMPORADA COMPLETA  ★', W_ / 2, 368); }
      g.fillStyle = '#ff0000'; g.fillRect(0, 1180, W_, 170); g.fillStyle = '#fff'; g.font = F(60); g.fillText('¿TE ANIMÁS A UN TURNO?', W_ / 2, 1256, 1000); g.font = '700 34px system-ui, Arial, sans-serif'; g.fillText(url, W_ / 2, 1312, 1000);
      return cv;
    });
  }
  function showCard(fin) {
    A.unlock(); A.play('click');
    drawCard(fin).then(cv => {
      let data = ''; try { data = cv.toDataURL('image/png'); } catch (e) {}
      if (!data) return modal('<h2>Tu tarjeta</h2><p>Este navegador no pudo armar la imagen. Probá con una captura de pantalla del cierre de caja.</p><button class="btn" data-close>Cerrar</button>');
      modal('<h2>Tu tarjeta</h2><img class="cardimg" id="cardImg" alt="Tarjeta de GameShop Simulator" src="' + data + '"><button class="btn" id="cardShare" hidden>Compartir</button>' +
        '<a class="btn ' + (navigator.share ? 'ghost' : '') + '" id="cardDown" download="gameshop-simulator.png" href="' + data + '">Descargar imagen</a><button class="btn ghost" data-close>Cerrar</button>');
      cv.toBlob(blob => {
        if (!blob || !navigator.share || !window.File || !$('cardShare')) return;
        const file = new File([blob], 'gameshop-simulator.png', { type: 'image/png' });
        if (navigator.canShare && !navigator.canShare({ files: [file] })) return;
        $('cardShare').hidden = false;
        $('cardShare').addEventListener('click', () => { GS.track('compartir', {}); navigator.share({ files: [file], title: 'GameShop Simulator', text: GS.FINAL.card[0].replace('{n}', Math.max(1, GS.Store.get('days') || 0)) + ' ¿Te animás a un turno?' }).catch(() => {}); });
      }, 'image/png');
    });
  }

  /* ---------------- Modales: cómo se juega, récords, opciones, pausa ---------------- */
  function showHow(fromDay) {
    if (fromDay) paused = true;
    modal('<h2>Cómo se juega</h2><ul class="how">' +
      '<li><i>🚪</i><span>La jornada viene en <b>tandas</b>: entran unos pocos clientes y tareas, los resolvés y hay un respiro. Lo pendiente se muestra <b>abajo</b>.</span></li>' +
      '<li><i>👆</i><span>Tocá un pendiente para resolverlo: son minijuegos de unos segundos.</span></li>' +
      '<li><i>💵</i><span>Al cobrar acordate: 10% OFF en efectivo o transferencia, 3 cuotas sin interés con tarjeta.</span></li>' +
      '<li><i>🔥</i><span>Encadená aciertos para armar <b>racha</b>. Si te equivocás no perdés nada: solo hay un chiste.</span></li>' +
      '<li><i>🧠</i><span>Tu <b>cordura</b> sube en los respiros y baja si se junta mucho. A veces hay <b>interrupciones</b>: se contestan con un toque, y si no, se resuelven solas.</span></li>' +
      '<li><i>🔎</i><span>Arrastrá para mover el local y pellizcá (o usá la rueda) para acercar.</span></li></ul>' +
      '<button class="btn" data-close>¡A laburar!</button>', () => { if (fromDay) paused = false; });
  }
  function showRecords() {
    const best = GS.Store.get('best') || [];
    modal('<h2>Tus mejores jornadas</h2>' + (best.length ? '<ul class="recs">' + best.map((b, i) => '<li><span>' + (i + 1) + '. ' + b.mode + ' · ' + b.served + ' hechos · ' + b.date + '</span><b>' + b.score.toLocaleString('es-AR') + '</b></li>').join('') + '</ul>'
      : '<p>Todavía no jugaste ninguna jornada. El récord a batir es cero: aprovechá.</p>') +
      '<p style="font-size:13px;color:#a9a9b2">Se guardan solo en este dispositivo.</p><button class="btn" data-close>Cerrar</button>');
  }
  function showOptions(fromPause) {
    const q = GS.Store.get('quality') || 'auto';
    const seg = (name, vals, curv) => '<div class="seg" data-seg="' + name + '">' + vals.map(v => '<button data-v="' + v[0] + '" class="' + (v[0] === curv ? 'on' : '') + '">' + v[1] + '</button>').join('') + '</div>';
    modal('<h2>Opciones</h2>' +
      '<div class="setting"><span>Sonido</span>' + seg('mute', [['0', 'Con sonido'], ['1', 'Silencio']], A.isMuted() ? '1' : '0') + '</div>' +
      '<div class="setting"><span>Música</span>' + seg('music', [['0', 'Sin música'], ['1', 'Suave'], ['2', 'Normal']], String(A.musicLevel())) + '</div>' +
      '<div class="setting"><span>Calidad gráfica</span>' + seg('quality', [['auto', 'Auto'], ['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']], q) + '</div>' +
      '<div class="setting"><span>Texto grande</span>' + seg('big', [['0', 'No'], ['1', 'Sí']], GS.Store.get('big') ? '1' : '0') + '</div>' +
      '<div class="setting"><span>Reducir movimiento</span>' + seg('calm', [['0', 'No'], ['1', 'Sí']], calm ? '1' : '0') + '</div>' +
      '<div class="setting"><span>Tu personaje</span><button class="btn ghost" id="optAv" style="width:auto">Cambiar</button></div>' +
      '<div class="setting"><span>Jornada (modo prueba)</span>' + seg('testDay', [['0', 'Auto'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['8', '8']], String(GS.Store.get('testDay') || 0)) + '</div>' +
      '<div class="setting"><span>Clima (modo prueba)</span>' + seg('testCond', [['', 'Auto'], ['ninguna', 'Normal'], ['lluvia', 'Lluvia'], ['blackfriday', 'Black Friday'], ['navidad', 'Navidad']], GS.Store.get('testCond') || '') + '</div>' +
      (fromPause ? '' : '<div class="setting"><span>Escena final<br><small>' + (GS.Store.get('finalSeen') ? 'Volver a verla' : 'Se ve al terminar la jornada ' + C.finalDay + ' (modo prueba)') + '</small></span><button class="btn ghost" id="optFinal" style="width:auto">Ver</button></div>') +
      '<div class="setting"><span>Volver a la jornada 1<br><small>Conserva monedas y mejoras</small></span><button class="btn ghost" id="optDay1" style="width:auto">Volver</button></div>' +
      '<div class="setting"><span>Borrar todo<br><small>Jornadas, monedas, mejoras y récords</small></span><button class="btn ghost" id="optReset" style="width:auto">Reiniciar</button></div>' +
      '<button class="btn" data-close>Listo</button>', () => { if (fromPause) showPause(); });
    $('sheet').querySelectorAll('.seg').forEach(s => s.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      const name = s.dataset.seg, v = b.dataset.v;
      if (name === 'mute') { A.unlock(); A.setMuted(v === '1'); syncMute(); A.play('click'); }
      if (name === 'music') { A.unlock(); A.setMusic(Number(v)); }
      if (name === 'quality') { GS.Store.set('quality', v); autoQ = autoQuality(); W.setQuality(v === 'auto' ? autoQ : v); }
      if (name === 'big') { GS.Store.set('big', v === '1'); document.body.classList.toggle('big', v === '1'); }
      if (name === 'calm') { setCalm(v === '1'); GS.Store.set('calm', calm); }
      if (name === 'testDay') { GS.Store.set('testDay', Number(v)); refreshStart(); }
      if (name === 'testCond') GS.Store.set('testCond', v);
    }));
    $('optDay1').addEventListener('click', e => { GS.Store.set('days', 0); GS.Store.set('seen', {}); GS.Store.set('testDay', 0); refreshStart(); e.target.textContent = 'Listo ✔'; });
    $('optAv').addEventListener('click', () => showAvatar(() => showOptions(fromPause)));
    if ($('optFinal')) $('optFinal').addEventListener('click', () => { modalOnClose = null; $('modal').hidden = true; startFinal(); });
    $('optReset').addEventListener('click', e => { GS.Store.reset(); W.setUpgrades({}); refreshStart(); e.target.textContent = 'Borrado ✔'; });
  }
  function showPause() {
    if (state !== 'day') return; paused = true;
    modal('<h2>Pausa</h2><p>El local te espera. Sin apuro.</p><button class="btn" id="pResume">Seguir</button>' +
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
  let fpsT = 0, fpsN = 0, autoQ = 'media';
  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden) { lastT = t; return; }             // pestaña oculta: no se dibuja ni corre el reloj
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
    if (state === 'day' && !paused) updateDay(dt);
    if (state === 'final' && !paused) updateFinal(dt);
    if (!paused) updateStaff(dt);
    // calidad automática: si el equipo no llega a unos 22 cuadros por segundo durante un rato, baja un escalón sola
    if ((GS.Store.get('quality') || 'auto') === 'auto' && dt > 0) { fpsT += dt; fpsN++; if (fpsT >= 4) { const fps = fpsN / fpsT; fpsT = fpsN = 0; if (fps < 22 && autoQ !== 'baja') { autoQ = autoQ === 'alta' ? 'media' : 'baja'; W.setQuality(autoQ); GS.track('calidad_auto', { nivel: autoQ }); } } }
    if (!paused && (walkT -= dt) <= 0 && walkers < 4) {                 // peatones: pasan por la vereda y siguen de largo
      walkT = U.rnd(3, 7) * (day && day.cond === 'lluvia' ? 2.2 : 1); walkers++;
      const dir = Math.random() < 0.5 ? 1 : -1, z = L.galeria.zMax + U.rnd(1.6, 2.6), hs = U.pick(GS.HAIRSTYLES)[0];
      const w = W.makePerson({ shirt: U.pick([0x6b7a8f, 0x3d7a4a, 0xd9a514, 0x4a6fb5, 0xb86fa8, 0x21a0a0, 0x555560]), hair: U.pick(GS.HAIRS), hairStyle: hs, glasses: Math.random() < 0.3, beard: Math.random() < 0.2, speed: U.rnd(1.3, 2) });
      w.setPos(-7.5 * dir, z); w.walk([[7.5 * dir, z]], () => { w.remove(); walkers--; });
    }
    W.update(paused ? 0 : dt); W.render();
  }

  function boot() {
    $('logoImg').src = GS.LOGO; refreshStart();
    $('phasesStart').innerHTML = phasesCompact();
    $('chipPhase').textContent = '🚧 Etapa ' + C.phase + ' de ' + GS.PHASES.length;
    const q = GS.Store.get('quality') || 'auto';
    autoQ = autoQuality(); W.setQuality(q === 'auto' ? autoQ : q);
    if (!W.init($('c'))) {
      modal('<h2>Ups</h2><p>Este navegador no pudo iniciar los gráficos 3D. Probá actualizarlo o abrir el juego en otro navegador.</p>');
      return;
    }
    staffInit(); luchoLook(dayNumber()); document.body.classList.toggle('big', !!GS.Store.get('big')); if (C.launched) { $('phasesStart').hidden = true; $('chipPhase').hidden = true; document.querySelector('.fine').firstChild.textContent = 'Precios y stock ficticios.'; }
    GS.track.init(); GS.track('abrir_juego', { jornada: dayNumber() }); window.addEventListener('error', e => GS.track('error_js', { msg: String(e.message).slice(0, 80) }));
    if (C.links.tienda) { $('btnStore').hidden = false; $('btnStore').href = C.links.tienda; $('btnStore').addEventListener('click', () => GS.track('click_tienda', { desde: 'inicio' })); }
    setCalm(!!GS.Store.get('calm')); syncMute(); W.showAll(); W.setUpgrades(upNow()); W.setPlayerLook(GS.Store.get('avatar'));
    $('btnShop').addEventListener('click', openShop); $('shopDone').addEventListener('click', closeShop);
    const shopStep = k => { if (state !== 'shop') return; shopSel = (shopSel + k + GS.UPGRADES.length) % GS.UPGRADES.length; A.play('click'); renderShop(); const on = $('shopSlots').querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' }); };
    $('shopPrev').addEventListener('click', () => shopStep(-1)); $('shopNext').addEventListener('click', () => shopStep(1));
    $('shopSlots').addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { $('shopSlots').scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    $('shopSlots').addEventListener('click', e => { const b = e.target.closest('.slotb'); if (b) { shopSel = Number(b.dataset.i); A.play('click'); renderShop(); } });
    $('shopCards').addEventListener('click', e => { const b = e.target.closest('[data-buy]'); if (b) buy(Number(b.dataset.buy)); });
    $('shopCards').addEventListener('scroll', () => { const el = $('shopCards'), i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth * 0.86)); if (el._i !== i) { el._i = i; const u = upNow(), g = GS.UPGRADES[shopSel], sh = Object.assign({}, u); sh[g.id] = Math.max(u[g.id] || 0, i + 1); W.setUpgrades(sh); } });
    W.onTap(st => openStation(st));
    $('btnPlay').addEventListener('click', () => startDay(false));
    $('btnRelax').addEventListener('click', () => startDay(true));
    $('btnArcade').addEventListener('click', () => { A.unlock(); A.play('click'); showArcade(); });
    $('btnHow').addEventListener('click', () => { A.unlock(); A.play('click'); showHow(false); });
    $('btnRecs').addEventListener('click', () => { A.unlock(); A.play('click'); showRecords(); });
    $('btnOpts').addEventListener('click', () => { A.unlock(); A.play('click'); showOptions(false); });
    $('phasesStart').addEventListener('click', showPhases);
    $('chipPhase').addEventListener('click', () => { paused = true; showPhases(); modalOnClose = () => { paused = false; }; });
    $('chipCord').addEventListener('click', showCord); $('finSkip').addEventListener('click', finishFinal);
    $('jobs').addEventListener('click', e => { const ib = e.target.closest('[data-intr]'); if (ib) return answerIntr(ib.dataset.intr === '1'); const b = e.target.closest('.job[data-i]'); if (b && jobList[b.dataset.i]) openJob(jobList[b.dataset.i]); });
    $('btnPause').addEventListener('click', showPause);
    $('btnMute').addEventListener('click', () => { A.unlock(); A.setMuted(!A.isMuted()); syncMute(); A.play('click'); });
    window.addEventListener('resize', () => W.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => W.resize(), 250));
    document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'day' && !paused && $('modal').hidden) showPause(); });
    document.addEventListener('keydown', e => {
      if (!$('modal').hidden) { if (e.key === 'Escape' || e.key === 'Enter') { const b = $('sheet').querySelector('[data-close], #pResume'); if (b) b.click(); } return; }
      if (state === 'shop') { if (e.key === 'ArrowLeft') shopStep(-1); else if (e.key === 'ArrowRight') shopStep(1); else if (e.key === 'Escape') closeShop(); return; }
      if (state !== 'day') return;
      if (e.key === 'Escape') return showPause();
      if (MG.isOpen()) return MG.key(e);
      if (day.intr && (e.key === 'a' || e.key === 'b' || e.key === 'A' || e.key === 'B')) { const first = e.key.toLowerCase() === 'a'; return answerIntr(first ? !day.intr.flip : day.intr.flip); }
      const n = parseInt(e.key, 10); if (n >= 1 && n <= jobList.length && !day.arcade) openJob(jobList[n - 1]);
    });
    document.addEventListener('gesturestart', e => e.preventDefault());
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  return { startDay, startArcade, startFinal, showCard, drawCard, debugIntr: () => spawnIntr(), openStation, openJob, pendingJobs, endDay, debugTask: id => spawnTask(ST(id)), state: () => state, day: () => day };
})();
