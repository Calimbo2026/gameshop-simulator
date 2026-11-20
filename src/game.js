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
    return '';      // ya no se muestra el cartel de "en construcción" ni las etapas
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
    modal('<h2>Etapas de la expansión</h2><p>El juego base ya está. Ahora crece para llevar GameShop a todo el país, en ' + GS.PHASES.length + ' etapas. Cada una se prueba y se aprueba antes de pasar a la siguiente.</p><ul class="ph-list">' + items +
      '</ul><button class="btn" data-close>Entendido</button>');
  }

  /* ---------------- Modal y avisos ---------------- */
  let modalOnClose = null;
  function modal(html, onClose) {
    $('sheet').innerHTML = html; $('modal').hidden = false; modalOnClose = onClose || null;
    $('sheet').querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  }
  function closeModal() { $('modal').hidden = true; A.play('click'); const f = modalOnClose; modalOnClose = null; if (f) f(); }
  /* Historial de avisos: todo lo que sale arriba durante la jornada queda guardado, para releerlo desde el botón 💬 de la barra */
  let LOG = null, logNew = 0;
  function logMsg(html) {
    if (state !== 'day' || !day || day.arcade) return; if (!LOG) LOG = GS.Store.get('msgLog') || [];
    LOG.unshift({ d: day.n, t: ($('clockT').textContent || '').replace(/[^0-9:]/g, ''), h: html }); if (LOG.length > 50) LOG.length = 50; GS.Store.set('msgLog', LOG);
    logNew++; const b = $('btnLog'); if (b) { b.classList.add('new'); b.dataset.n = logNew > 9 ? '9+' : logNew; }
  }
  function showLog() {
    if (!LOG) LOG = GS.Store.get('msgLog') || []; const inDay = state === 'day' && !paused; if (inDay) paused = true;
    logNew = 0; $('btnLog').classList.remove('new'); A.play('click');
    modal('<h2>💬 Mensajes</h2>' + (LOG.length ? '<div class="logl">' + LOG.map((m, i) => (i === 0 || LOG[i - 1].d !== m.d ? '<h4>Jornada ' + m.d + '</h4>' : '') + '<div class="logi"><small>' + (m.t || '') + '</small><span>' + m.h + '</span></div>').join('') + '</div>' : '<p>Todavía no llegó ningún mensaje. Acá vas a encontrar las llamadas del Dueño, los avisos de la competencia y las novedades del día.</p>') +
      '<button class="btn" data-close>' + (state === 'day' ? 'Seguir' : 'Cerrar') + '</button>', () => { if (inDay) paused = false; });
  }
  function toast(html, cls, ms, noLog, col) {
    if (!noLog && html.indexOf('<b>') === 0) logMsg(html);
    const box = $('toasts'); while (box.children.length > 1) box.removeChild(box.firstChild);
    const t = document.createElement('div'); t.className = 'toast ' + (cls || ''); t.innerHTML = html; if (col) t.style.setProperty('--rc', col); box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms || 3200);
  }

  /* ---------------- Jornada ---------------- */
  function newDay(extra) {
    return Object.assign({
      relaxed: false, arcade: null, t: 0, dur: C.day.seconds, score: 0, combo: 0, bestCombo: 0, sales: 0, served: 0, lost: 0, cajaErr: 0, otherErr: 0,
      tasksDone: 0, tasksLate: 0, customers: [], tasks: [], spawned: 0, tasksSpawned: 0,
      extras: [], n: 1, unlocked: unlockedFor(1), plan: planDay(1), rep0: repNow(), dueno: null, wave: -1, stage: 'rest', rest: 0.6, queue: [], says: [], sayQ: [], sayGap: 0, beat: 0, wv: { done: {} }, ev: {},
      cajaCount: 0, closing: false, jobSig: '', visits: [], dirt: 0, dirtPos: [], mopping: false, mopT: 0, cleaned: 0, cord: CD.start, mate: false, lookers: [], lookT: 4, spots: {}, helper: null, intr: null, intrN: 0, intrOk: 0, intrBag: [], reqBag: U.shuffle(GS.REQUESTS), archBag: U.shuffle(GS.CUSTOMERS), taskBag: []
    }, extra || {});
  }
  // Arma la jornada: cuántos clientes y tareas trae cada tanda. Va de menos a más.
  // (Etapa 3: acá entran el cartel del frente, el clima y las fechas especiales.)
  // Jornada N de la carrera: de menos a más. Cada jornada suma clientes y, según GS.UNLOCKS, estaciones nuevas.
  // (Parte B de la Etapa 3: acá entran el cartel del frente, el clima y las fechas especiales.)
  function dayNumber() { return GS.Store.get('testDay') || (GS.Store.get('days') || 0) + 1; }
  function unlockedFor(n) { return GS.UNLOCKS.slice(0, n).reduce((a, b) => a.concat(b), []); }
  const upNow = () => GS.Store.get('up') || {};
  /* Herramientas de prueba (solo con la clave en la dirección): monedas y fondos infinitos. No toca los valores guardados de la partida. */
  const DEV = () => !!GS.Store.get('dev');
  { const set0 = GS.Store.set; GS.Store.set = function (k, v) { if ((k === 'coins' || k === 'fondo') && DEV()) return; return set0.call(GS.Store, k, v); }; if (/[?&]dev=incas4552(&|$)/.test(location.search)) set0.call(GS.Store, 'dev', true); else if (GS.Store.get('dev')) set0.call(GS.Store, 'dev', false); }      /* herramientas de prueba: solo abriendo el juego con la clave; sin ella se apagan */
  // En Patagonia y Malvinas la gente anda abrigada: gorro de lana y bufanda
  const warm = o => ((GS.Store.get('branch') === 'patagonia' || GS.Store.get('branch') === 'malvinas') && !o.hat ? Object.assign({}, o, { hat: 'lana', scarf: true }) : o);
  const coinsNow = () => DEV() ? 999999 : GS.Store.get('coins') || 0;
  const monthOf = n => GS.MONTHS[(n - 1) % 12] + ', año ' + (Math.floor((n - 1) / 12) + 1);
  // El rival de la zona: su regla complica las jornadas de esa sucursal hasta que se le gana en el mostrador; después, la sucursal rinde 10% más
  const rivalId = () => GS.Store.get('branch') || 'pampeana', rivalDone = () => !!((GS.Store.get('branches') || {})[rivalId()] || {}).won, rivalOn = () => !rivalDone() && !!(GS.REGIONS.find(r => r.id === rivalId()) || {}).rival;
  const coinMult = () => { const u = upNow(); return (1 + 0.1 * ((u.mesa || 0) + (u.isla || 0) + (u.gondola || 0) + (u.luces || 0) + (u.web >= 3 ? 1 : 0)) + (rivalDone() ? 0.1 : 0)) * (rivalOn() && rivalId() === 'patagonia' ? 0.85 : 1) * (modNow() === 'apuro' || modNow() === 'lupa' ? 1.3 : 1); };
  const patMult = () => { const u = upNow(); return (1 + 0.15 * (u.escritorio || 0) + 0.1 * (u.sillas || 0) + 0.1 * (u.cafetera || 0)) * (modNow() === 'apuro' ? 0.75 : 1) * (day && day.zonda ? 0.8 : 1) * (day && day.duel ? 0.85 : 1) * (day && day.n <= GS.UNLOCKS.length ? 1.3 : 1); };      /* día de competencia: esperan menos; jornadas de aprendizaje: esperan más */
  const modNow = () => GS.Store.get('mod') || '';
  function conditionFor(n) {
    const forced = GS.Store.get('testCond'); if (forced) return forced === 'ninguna' ? null : forced;             // fechas especiales fijas y lluvia al azar (nunca en las primeras jornadas)
    if (n % 12 === 11) return 'blackfriday';             // noviembre
    if (n % 12 === 0) return 'navidad';                   // diciembre
    return n >= 3 && Math.random() < 0.25 ? 'lluvia' : null;
  }
  const unitsOf = plan => plan.reduce((a, w) => a + w.c + w.t + (w.ml || 0), 0);
  function planDay(n, cond, duel) {
    const un = unlockedFor(n), pool = TASK_STATIONS.filter(s => un.indexOf(s.id) >= 0), u = upNow(), c = cond ? GS.CONDITIONS[cond] : null, r = repNow();
    let cust = Math.min(3 + n, 7) + (u.cartel || 0) + (u.arcade || 0) + (u.vidluz || 0) + (u.web >= 2 ? 1 : 0) + (r >= 4 ? 1 : r < 2 ? -1 : 0) + (c ? c.cust : 0);   // cartel, arcade y reputación traen gente
    const learn = n <= GS.UNLOCKS.length ? GS.UNLOCKS[n - 1].filter(id => TASK_STATIONS.some(x => x.id === id)) : null;      /* jornadas 1 a 3: se ven todas las tareas nuevas del día, con menos clientes */
    const want = U.clamp(cust, 3, 12); cust = learn ? Math.min(want, 4) : Math.min(want, C.day.maxDayCustomers) + (duel ? 2 : 0);       // la jornada dura siempre unos 3 minutos: lo que el cartel y las mejoras traen de más se cobra como tickets más altos
    const tasks = learn ? learn.length : pool.length ? Math.min(n - 1, C.day.maxDayTasks) + (duel ? 1 : 0) : 0, extraMl = (un.indexOf('ml') >= 0 && u.web >= 1 ? 1 : 0) + (c && un.indexOf('ml') >= 0 && !learn ? c.ml : 0), nw = cust <= 5 && !(learn && tasks > 2) ? 3 : 4;
    const plan = Array.from({ length: nw }, () => ({ c: 0, t: 0, ml: 0 }));
    for (let i = 0; i < cust; i++) plan[nw - 1 - (i % nw)].c++;
    for (let i = 0; i < tasks; i++) plan[nw - 1 - (i % (nw - 1))].t++;
    for (let i = 0; i < (learn ? 0 : extraMl); i++) plan[1 + (i % (nw - 1))].ml++;
    if (un.indexOf('cierre') >= 0) plan.push({ c: 0, t: 1, ml: 0, final: true });
    plan.bonus = 1 + (want - cust) * 0.07;
    if (rivalOn() && rivalId() === 'nea') { const w = plan.find((x, i) => i >= 1 && !x.final && x.c > 1); if (w) { w.c--; if (un.indexOf('ml') >= 0) w.ml = (w.ml || 0) + 1; } }           // la siesta de Yacaré Games
    if (rivalOn() && rivalId() === 'malvinas' && pool.length) { const w = plan.filter(x => !x.final); w[w.length - 1].t++; }                                               // lo que se "lleva prestado" el pirata
    return plan;
  }
  function addRep(d) { if (d < 0 && rivalOn() && rivalId() === 'noa') d *= 1.6; GS.Store.set('rep', U.clamp((GS.Store.get('rep') == null ? 3 : GS.Store.get('rep')) + d, 0, 5)); }
  const repNow = () => (GS.Store.get('rep') == null ? 3 : GS.Store.get('rep'));
  const repTxt = v => v.toFixed(1).replace('.', ',');
  // El Dueño sale del depósito, camina hasta el salón, dice lo suyo y se vuelve
  function duenoSpeak(text, call) {
    const d = day; if (!d || d.arcade || state !== 'day') return;
    if (d.cond === 'lluvia' && snowy()) text = text.replace(/Día de lluvia/g, 'Día de nieve').replace(/esta lluvia/g, 'esta nieve').replace(/Llueve/g, 'Nieva').replace(/llueva/g, 'nieve').replace(/lluvia/g, 'nieve').replace(/paraguas/g, 'gorro');
    if (!bossHere()) { if (call) toast('<b>📞 El Dueño, desde Incas</b>' + text, '', 4200); return; }       // lejos de la casa central solo llama
    logMsg('<b>🗣️ El Dueño</b>' + text);
    const p = W.boss(), back = () => { if (day !== d || d.sayQ.some(q => q.cls === 'boss')) return; p.walk([[7.3, -0.3], W.BOSS_HOME], () => { p.face(0); d.dueno = null; }); };
    if (d.dueno) { sayAt(p, text, 0, 'boss', false, false, back); return; }
    d.dueno = p;
    p.walk([[7.3, -0.3], [5.0, -0.3]], () => { p.face(-0.5); sayAt(p, text, 0, 'boss', false, false, back); });
  }
  // Qué dice el Dueño: mira lo que pasó en la tanda y en el día, y elige una frase que venga al caso y que no haya dicho hace poco
  function duenoLine() {
    const d = day, w = d.wv, nw = d.plan.length, ks = [];
    if (w.lost) ks.push('perdido'); if (w.caught) ks.push('trucho'); if (w.mistakes >= 2) ks.push('errores');
    if (d.cord < 45) ks.push('cansado'); if (d.combo >= 5) ks.push('racha');
    if (w.done.ml) ks.push('web'); if (w.done.proveedor) ks.push('proveedor'); if (w.done.service || w.done.pc) ks.push('taller'); if (w.done.vidriera) ks.push('vidriera');
    if (w.helped) ks.push('cajaDos'); if (w.intrOk) ks.push('interrupcion');
    const sl = STAFF.findIndex(st => st.act === 'siesta'); if (sl >= 0) ks.push('siesta');
    if (w.served >= 2 && !w.mistakes && !w.lost) ks.push('perfecto');
    if (d.cond) ks.push(d.cond); if (w.lookers >= 2) ks.push('mirones');
    if (GS.Store.get('newUp')) { ks.push('mejora'); GS.Store.set('newUp', false); }
    if (d.wave >= 1 && d.wave === nw - 2 - (d.plan[nw - 1].final ? 1 : 0)) ks.push('tarde'); else if (d.wave === 0 && nw >= 4) ks.push('mediodia');
    if (repNow() >= 4.5) ks.push('repAlta'); else if (repNow() < 2.5) ks.push('repBaja');
    const used = GS.Store.get('duenoSeen') || [], fresh = arr => arr.filter(x => used.indexOf(x) < 0);
    let line = null;
    for (const k of U.shuffle(ks.slice(0, 4)).concat(ks.slice(4))) { const f = d.ev[k] ? [] : fresh(LN.duenoCtx[k] || []); if (f.length && Math.random() < 0.8) { line = U.pick(f); d.ev[k] = 1; break; } }   // cada tema, una sola vez por jornada
    if (!line) { const f = fresh(LN.dueno); line = U.pick(f.length ? f : LN.dueno); }
    used.push(line); GS.Store.set('duenoSeen', used.slice(-45));
    return line.replace('{quien}', sl === 0 ? 'Lucho' : 'Brian');
  }
  /* ---------------- Cordura: nunca hay Game Over, solo un mate a tiempo ---------------- */
  function addCord() {}                     // la cordura se retiró: las métricas son estrellas, monedas y fondos
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
    if (!day.intrBag.length) day.intrBag = U.shuffle(GS.INTERRUPTS.filter(q => !q.reg || q.reg === brId()));
    const ev = !day.evDone && !day.relaxed && day.n >= 4 && Math.random() < 0.5 ? U.pick(GS.EVENTS) : null; if (ev) day.evDone = 1;      // evento sorpresa: uno por jornada como mucho
    day.intr = { it: ev || day.intrBag.pop(), left: CD.intrSeconds, flip: Math.random() < 0.5 }; day.jobSig = ''; A.play('intr');
  }
  function answerIntr(ok) {
    const x = day && day.intr; if (!x || paused) return; day.intr = null; day.jobSig = ''; if (!day.moment) day.moment = x.it.who + '. ' + (ok ? x.it.r : x.it.rb);
    if (x.it.gfx) { coach('evento');            // evento sorpresa: deja algo más que un "bien resuelto", y a veces lo que parecía mala idea sale bien
      const tw = !ok && x.it.twist && Math.random() < 0.35, f = ok ? x.it.gfx : tw ? x.it.tfx : x.it.bfx, good = ok || tw;
      if (f.rep) addRep(f.rep); if (f.coins) GS.Store.set('coins', coinsNow() + f.coins); if (f.fondo) addFondo(f.fondo);
      fx((f.rep > 0 ? '+⭐ ' : f.rep < 0 ? '−⭐ ' : '') + (f.coins ? '+🪙' + f.coins + ' ' : '') + (f.fondo ? '+🪙' + f.fondo : ''), good ? '' : 'bad'); A.play(good ? 'ok' : 'error'); if (good) { day.score += 60; day.intrOk++; }
      day.moment = x.it.who + '. ' + (ok ? x.it.r : tw ? x.it.twist : x.it.rb); toast('<b>' + x.it.ic + ' ' + x.it.who + (tw ? ' · ¡salió bien igual!' : '') + '</b>' + (ok ? x.it.r : tw ? x.it.twist : x.it.rb), '', 4200); return;
    }
    if (ok) { addCord(CD.intrOk * (x.it.mate ? 2 : 1)); day.score += 40; day.intrOk++; day.wv.intrOk = 1; A.play(x.it.mate ? 'mate' : 'ok'); addRep(0.04); fx('+⭐'); toast('<b>' + x.it.ic + ' Bien resuelto</b>' + x.it.r, '', 3200); }
    else { addRep(-0.03); fx('−⭐', 'bad'); A.play('error'); toast('<b>' + x.it.ic + ' Ups</b>' + x.it.rb, '', 3200); }
  }
  function planTotals(plan) { return plan.reduce((a, w) => ({ c: a.c + w.c, t: a.t + w.t + (w.ml || 0) }), { c: 0, t: 0 }); }
  function startWave() {
    day.wave++; day.stage = 'work'; day.queue = []; day.wv = { done: {} };
    const w = day.plan[day.wave];
    if (day.duel && !w.final && day.wave === day.plan.filter(x => !x.final).length - 1) { A.setMood('final'); toast('<b>⏰ Hora pico</b>Última tanda: ' + day.duel.rv.owner + ' aprieta el acelerador.', 'rival', 3800, false, day.duel.rv.col); }
    if (day.rivalWalk && day.wave === 1) { day.rivalWalk = 0; const d0 = day; setTimeout(() => { if (day === d0 && state === 'day') rivalPass(); }, 4000); }
    for (let i = 0; i < w.c; i++) day.queue.push({ kind: 'c', t: 0.3 + i * C.day.customerGap });
    for (let i = 0; i < w.t; i++) day.queue.push({ kind: w.final ? 'f' : 't', t: (w.final ? 0.6 : 5) + i * C.day.taskGap });
    for (let i = 0; i < (w.ml || 0); i++) day.queue.push({ kind: 'm', t: 3 + i * C.day.taskGap });
    if (!day.arcade && !day.relaxed && day.n % 12 === 11 && !day.xq && (day.wave >= 1 || day.plan.filter(w => !w.final).length < 2) && !w.final) { day.xq = 1; day.queue.push({ kind: 'x', t: 5 }); }    // víspera de la semana de Navidad
    day.visits.forEach(v => { if (v.wave === day.wave && !v.sent) { v.sent = 1; day.queue.push({ kind: 'v', v: v.S, t: U.rnd(3, 8) }); } });
    if (GS.DEBUG_INTR || (day.n >= CD.intrFromDay && !w.final && day.wave >= 1 && day.intrN < (day.n >= 6 ? 3 : 2) && Math.random() < 0.6)) { day.queue.push({ kind: 'i', t: U.rnd(5, 11) }); day.intrN++; }
    day.queue.sort((a, b) => a.t - b.t);
  }
  /* el rival pasa por la vereda, se para frente a la puerta, tira su frase (con globo de su marca) y sigue de largo */
  function rivalPass() {
    const rv = RV(brId()), d = day; if (!rv || !d) return; const z = L.galeria.zMax + 1.7, p = W.makePerson(Object.assign({}, warm(rv.look), { scale: 1.12, speed: 2.6 })); p.setPos(-9.5, z); p.aura(rv.col); d.extras.push(p);
    p.walk([[L.puerta.x + 1.7, z]], () => { if (day !== d) return; p.face(Math.PI); sayAt(p, U.pick(rv.taunts), 0, 'riv', false, false, () => { if (day === d) p.walk([[10.5, z]], () => {}); }, rv); });
  }
  /* día de competencia: cada cliente que se va y cada tarea vencida es una queja; a la tercera, el día se pierde */
  function duelQueja() {
    const D = day && day.duel; if (!D || D.over) return; D.q++; fx('😠 Queja ' + D.q + ' de 3', 'bad');
    if (D.q >= 3) { D.over = 'quejas'; toast('<b>😠 Tercera queja</b>La gente se cruzó a ' + D.rv.name + '. El día se terminó.', 'rival', 3600, false, D.rv.col); day.closing = true; setTimeout(endDay, 2200); }
  }
  function endWave() {
    if (day.wave >= day.plan.length - 1) { day.closing = true; setTimeout(endDay, 2800); return; }
    day.stage = 'rest'; day.rest = C.day.restSeconds * (modNow() === 'sinrespiro' ? 0.5 : 1); W.focus(null); W.home();
    const d = day;
    setTimeout(() => {                       // en el respiro habla el Dueño, sin nada tapando el local
      if (day !== d || state !== 'day' || d.stage !== 'rest') return;
      duenoSpeak(duenoLine());
    }, 1100);
  }
  // Globitos de diálogo: de a uno por vez, para poder leerlos todos. Los demás esperan su turno en una fila.
  // amb = comentario de ambiente (compañeros, gente que mira): si la fila está cargada o pasó el momento, se descarta.
  function sayAt(person, text, ms, cls, quiet, amb, onDone, brand) {
    if (!day) return;
    if (cls === 'zz') { const el = document.createElement('div'); el.className = 'say zz'; el.textContent = text; $('labels').appendChild(el); day.says.push({ el, person, left: (ms || 3000) / 1000, zz: true }); return; }
    const q = day.sayQ; if (amb && q.length >= 2) return;
    const it = { person, text, cls: cls || '', quiet, amb, onDone, brand, age: 0, dur: U.clamp(1.5 + text.length * 0.055, 2.4, 6.5) };
    if (brand && onDone) { it.pri = true; it.dur = Math.min(it.dur, 3.2); q.unshift(it); day.says.forEach(s2 => { if (!s2.zz) s2.left = Math.min(s2.left, 0.05); }); day.sayGap = 0; }      /* el rival corta lo que se esté diciendo: la atención va con él */
    else if (cls === 'boss') { let i = 0; while (i < q.length && q[i].cls === 'boss') i++; q.splice(i, 0, it); } else q.push(it);
  }
  function pumpSays(dt) {
    const d = day; for (const q of d.sayQ) q.age += dt;
    if (d.says.some(s => !s.zz) || (d.sayGap -= dt) > 0) return;
    while (d.sayQ.length) {
      const it = d.sayQ.shift();
      if (!it.person.group.parent || (it.cls !== 'boss' && !it.pri && it.age > (it.amb ? 4.5 : 9))) { if (it.onDone) it.onDone(); continue; }   // ya se fue o quedó viejo
      if (it.cls === 'boss') A.play('speaker');
      if (!it.quiet) A.babble(it.text, it.cls === 'boss' ? 150 : it.person.voice || 330);
      const el = document.createElement('div'); el.className = 'say ' + it.cls; el.textContent = it.text; if (it.brand) { el.dataset.b = it.brand.mark + ' ' + it.brand.name; el.style.setProperty('--rc', it.brand.col); } $('labels').appendChild(el);
      d.says.push({ el, person: it.person, left: it.dur, onDone: it.onDone }); d.sayGap = 0.35; return;
    }
  }
  function enterPlay() {
    $('start').hidden = true; $('end').hidden = true; $('hud').hidden = false; $('modal').hidden = true; $('toasts').innerHTML = '';
    $('final').hidden = true; paused = false; W.home();
  }
  const DUEL_K = { pampeana: 1, cuyo: 1.03, noa: 1.05, nea: 1.05, patagonia: 1.08, malvinas: 1.12 };      /* cuánto mejor que tu promedio juega cada rival */
  function startDay(relaxed, skipDuel) {
    A.unlock();
    if (!GS.Store.get('avatar')) return showAvatar(() => startDay(relaxed));
    if (!relaxed && !skipDuel && readyDuel(brId()) && !GS.Store.get('testDay')) return showDuelIntro(() => startDay(false, true));      /* cumplidos los objetivos, la jornada es el día de competencia */
    A.play('click'); clearDay(); W.setUpgrades(upNow());
    const n = dayNumber(), duel = !relaxed && readyDuel(brId()) && !GS.Store.get('testDay'); applyBranch();
    const un = unlockedFor(n), fresh = n <= GS.UNLOCKS.length ? GS.UNLOCKS[n - 1] : [];
    const cond = conditionFor(n);
    day = newDay({ relaxed, n, cond, unlocked: un, plan: planDay(n, cond, duel), rest: n === 1 ? 0.5 : 5.5 }); state = 'day'; enterPlay(); $('jobs').hidden = false;
    { const lt = n <= GS.UNLOCKS.length ? fresh.filter(id => TASK_STATIONS.some(x => x.id === id)) : []; if (lt.length) day.taskBag = lt.map(ST).reverse();      /* jornadas de aprendizaje: primero aparecen las tareas nuevas */
      const b = brNow(), units = unitsOf(day.plan), pu = b.avg || 480;
      if (duel) { brSave({ duel: 1 }); const rv = RV(brId()), tries = b.tries || 0, edge = Math.min(5, b.edge || 0); day.duel = { rv, tries, edge, q: 0, shown: 0, total: Math.round(pu * units * (DUEL_K[brId()] || 1) * (1 - 0.02 * edge) * (1 - 0.05 * Math.min(3, tries)) / 10) * 10 }; }
      else if (!relaxed && n > GS.UNLOCKS.length) day.goal = { silver: Math.round(pu * units * 0.85 / 10) * 10, gold: Math.round(pu * units * 1.06 / 10) * 10 }; }
    A.setMood(cond === 'lluvia' ? 'rain' : cond ? 'party' : 'day');
    if (rivalOn() && !relaxed) { const rv = RV(rivalId()), d0 = day; day.zonda = rivalId() === 'cuyo' && Math.random() < 0.45;
      if (duel) { setTimeout(() => { if (day === d0 && state === 'day') toast('<b>' + rv.mark + ' Día de competencia</b>Contra ' + rv.name + '. Más puntos que ' + rv.owner + ' y menos de tres quejas.', 'rival', 5200, false, rv.col); }, 5200); setTimeout(() => coach('duelo'), 8200); }
      else if (n > GS.UNLOCKS.length) { const act = rv.fx && (rivalId() !== 'cuyo' || day.zonda);      /* el rival se hace notar: llama para burlarse y más tarde pasa por la vereda */
        setTimeout(() => { if (day === d0 && state === 'day') toast('<b>' + rv.mark + ' ' + rv.owner + ', de ' + rv.name + '</b>"' + U.pick(rv.taunts) + '"' + (act ? '<small>' + (day.zonda ? 'Hoy sopla el Zonda. ' : '') + rv.fx + '</small>' : ''), 'rival', 5600, false, rv.col); }, 6500); setTimeout(() => coach('rival'), 9500); day.rivalWalk = 1; } }
    if (day.goal) setTimeout(() => coach('medalla'), 7000);
    W.setXmas(cond === 'navidad' ? (GS.Store.get('xmas') || { a: 0, g: 0, l: 0 }) : null); W.setHats(cond === 'navidad');
    if (!relaxed) { const nw = day.plan.filter(w => !w.final).length; day.visits = dueStories(n).map((S, i) => ({ S, wave: Math.min(nw - 1, i + (nw > 2 ? 1 : 0)) })); }
    const d = day, msg = n === 1 ? 'Bienvenido a GameShop. Ya tenés un cliente en el mostrador: tocá el pedido de abajo, que tu personaje va solo.'
      : cond ? GS.CONDITIONS[cond].name.slice(3) + '. ' + GS.CONDITIONS[cond].say
      : duel ? 'Hoy es el día. ' + day.duel.rv.owner + ' abrió temprano. Atendé como sabés y cuidá las quejas: a la tercera, perdemos.'
      : fresh.length > 2 ? 'Jornada ' + n + '. Hoy aprendés ' + fresh.filter(id => id !== 'mostrador' && id !== 'caja').length + ' tareas nuevas. Sin apuro: cuando aparezca cada una, te la explico.'
      : fresh.length ? 'Jornada ' + n + '. Hoy sumamos: ' + fresh.map(id => ST(id).name).join(' y ') + '. Cuando aparezcan, te explico.' : 'Jornada ' + n + '. ' + duenoLine();
    setTimeout(() => { if (day === d) duenoSpeak(msg); }, 500);
    if (n === 2 && !relaxed) setTimeout(() => coach('errores'), 3200); if (brId() !== 'pampeana') setTimeout(() => coach((brNow().days || 0) < 1 ? 'sucursal' : 'ensenar'), 5200);
    if (brId() !== 'pampeana') { const dd = day; setTimeout(() => { if (day !== dd) return; if (bossHere()) duenoSpeak(LN.duenoCame); else if ((brNow().days || 0) % 2 === 1) duenoSpeak(U.pick(LN.duenoCall), true); }, 2600); }   // lejos de Incas: llama cada dos jornadas, o viene si la reputación baja de 4
    if (n >= 2 && !relaxed && !GS.Store.get('plotIntro') && n <= C.finalDay) { GS.Store.set('plotIntro', true); setTimeout(() => { if (day === d) duenoSpeak(PL.intro.replace('{n}', C.finalDay)); }, 3200); }
    document.body.classList.toggle('snow', snowy());
    $('rain').hidden = cond !== 'lluvia'; $('chipCond').hidden = !cond; if (cond) { $('chipCond').textContent = condInfo(cond).name; toast('<b>Hoy</b>' + condInfo(cond).name, 'dueno', 3800); }
    $('clockS').textContent = relaxed ? 'Turno tranquilo' : 'Abrimos';
    updateHud();
    GS.track('inicio_partida', { modo: relaxed ? 'tranquilo' : 'normal' });
    
  }
  /* Guía del primer día: una flecha señala dónde tocar hasta completar la primera venta y el primer cobro */
  let guideEl = null;
  function guideTick() {
    const g = $('guide'); let el = null, txt = '';
    if (state === 'day' && day && day.n === 1 && !day.arcade && !paused && !(GS.Store.get('seen') || {}).g_ok) {
      const mg = $('mg');
      if (MG.isOpen()) { const ok = mg.querySelector('#mgOk'), cu = MG.customer(), isM = !!mg.querySelector('.opt[data-id]'), res = mg.querySelector('.result');
        if (!isM && !ok && !day.gProd0) day.gCaja = 1;
        if (ok) { el = ok; txt = '-'; }                 /* '-' = solo resaltar el botón, sin tapar el texto que hay que leer */
        else if (isM && cu && !day.gProd && !res) { day.gProd0 = 1; el = mg.querySelector('.opt[data-id="' + cu.product.id + '"]'); txt = ''; }
        if (isM && res) day.gProd = 1; if (!isM) day.gProd0 = 0;
      } else { if (day.gProd0) { day.gProd = 1; day.gProd0 = 0; }
        const bs = [].slice.call($('jobs').querySelectorAll('.job:not(.idle)')), find = t => bs.filter(b => b.querySelector('b').textContent.indexOf(t) === 0)[0];
        if (!day.gProd && find('Mostrador')) { el = find('Mostrador'); txt = 'Tocá acá para atender'; } else if (!day.gCaja && find('Caja')) { el = find('Caja'); txt = 'Ahora cobrale acá'; }
        if (day.gProd && day.gCaja) { const sn = GS.Store.get('seen') || {}; sn.g_ok = 1; GS.Store.set('seen', sn); } }
    }
    if (guideEl && guideEl !== el) guideEl.classList.remove('guided'); guideEl = el;
    if (!el) { g.hidden = true; return; }
    const r = el.getBoundingClientRect(), up = r.top < 110; el.classList.add('guided'); g.hidden = txt === '-'; g.classList.toggle('up', up); $('guideT').textContent = txt; $('guideT').hidden = !txt;
    g.style.left = Math.max(96, Math.min(window.innerWidth - 96, r.left + r.width / 2)) + 'px'; g.style.top = (up ? r.bottom + 6 : r.top - g.offsetHeight - 6) + 'px';
  }
  function clearDay() {
    if (day) { day.customers.forEach(c => { if (c.person) c.person.remove(); c.label.remove(); }); day.tasks.forEach(t => { t.label.remove(); if (t.boxes) t.boxes.remove(); }); day.says.forEach(x => x.el.remove()); day.extras.forEach(x => x.remove()); }
    MG.close(); W.focus(null); W.bossHome(); W.clearDirt();
    { const yo = W.player(); if (yo) { yo.stop(); yo.setPos(L.yoMostrador[0], L.yoMostrador[1]); yo.face(0); yoAt = 'most'; yoFree = false; yoDone = null; yoRoute = []; } const b = STAFF[1]; if (b && b.busy) { b.busy = false; b.q = [['go', [[4.0, -5.0], [4.6, -4.4], [4.5, -1.2], b.hub]]]; } }
  }
  function makeLabel(icon) {
    const label = document.createElement('div'); label.className = 'plabel'; label.innerHTML = '<span class="ic">' + icon + '</span><span class="b"><i></i></span>'; label.hidden = true;
    $('labels').appendChild(label); return label;
  }

  // Cada personaje mantiene siempre su look (los mismos rasgos de siempre), tanto en el muñeco 3D como en la cara del diálogo
  function lookOf(ar) {
    const k = ar.id.charCodeAt(0) + ar.id.length * 7;
    return Object.assign({ shirt: ar.shirt, hair: ar.hair, skin: 0xe0ac7e, hairStyle: ar.hairStyle || GS.HAIRSTYLES[k % 4][0], glasses: k % 3 === 0, beard: !ar.hat && k % 4 === 1, lips: ar.lips != null ? ar.lips : k % 2 === 0, lashes: k % 5 < 2, hat: ar.hat }, k % 4 === 2 ? { build: 'robusto', wide: true } : {}, ar.look || {});      /* uno de cada cuatro es de contextura grande, como el Dueño */   // look = rasgos definidos a mano para que acompañen al nombre
  }
  function spawnCustomer() {
    const slot = freeSlot('slotM', L.colaMostrador.length); if (slot < 0) return;
    if (!day.reqBag.length) day.reqBag = U.shuffle(GS.REQUESTS);
    if (!day.archBag.length) day.archBag = U.shuffle(GS.CUSTOMERS);
    const req = day.reqBag.pop(), arche = day.cond === 'navidad' && !day.santa && day.spawned >= 2 ? (day.santa = 1, GS.SANTA) : day.archBag.pop(), product = GS.CATALOG.find(p => p.id === req.p);
    const k = arche.id.charCodeAt(0) + arche.id.length * 7;   // cada personaje mantiene su look
    const look = warm(lookOf(arche)), person = W.makePerson(look);
    const dx = L.puerta.x; person.setPos(dx + U.rnd(-0.5, 0.5), day.spawned === 0 ? (day.n === 1 ? -0.6 : L.salon.zMax + 1) : L.galeria.zMax + 2.4);
    person.voice = 230 + (k % 7) * 45; if (arche.id === 'santa') person.aura(0xffe9a8);
    const cu = { id: ++uid, arche, look, request: regHi() + req.t, product, st: 'entering', pat: 1, person, slotM: slot, slotC: -1, label: makeLabel('❓') };
    day.customers.push(cu); day.spawned++;
    const sp = day.spawned > 1 && Math.random() < 0.45 ? freeSpot() : null;
    if (sp) { day.spots[sp.i] = 1; cu.spot = sp; person.walk(sp.via.concat([sp.p]), () => { cu.st = 'browse'; cu.wait = U.rnd(2.6, 4.6) + (sp.use ? 1.6 : 0); person.face(sp.f); useSpot(person, sp, true); }); }   // primero mira un rato y después se acerca
    else toCounter(cu, day.n === 1 && day.spawned === 1 ? [] : [[dx, L.salon.zMax + 0.2]]);          /* el primer cliente del primer día ya está frente al mostrador */
    setTimeout(() => A.play('bell'), 900);
  }
  function toCounter(cu, pre) { cu.st = 'entering'; cu.person.walk(pre.concat([[L.puerta.x, -1.3], L.colaMostrador[cu.slotM]]), () => { cu.st = 'waitM'; cu.person.face(Math.PI); }); }
  /* ---------------- Gente que entra a mirar: algunos se van callados, otros comentan algo ---------------- */
  /* dónde está cada mueble de piso: el lugar elegido, o el que le toca por defecto */
  const slotOf = id => { const lay = upNow().lay || {}, i = GS.FLOOR.indexOf(id); return L.slots[lay[id] != null ? lay[id] : i]; };
  function setLay(id, k) { const u = upNow(), lay = {}; GS.FLOOR.forEach((f, i) => { lay[f] = u.lay && u.lay[f] != null ? u.lay[f] : i; }); const other = GS.FLOOR.find(f => lay[f] === k); if (other) lay[other] = lay[id]; lay[id] = k; u.lay = lay; GS.Store.set('up', u); brSave(); }
  const upPos = g => GS.FLOOR.indexOf(g.id) >= 0 ? [slotOf(g.id).x, slotOf(g.id).z] : g.pos;
  /* los clientes usan los muebles del salón: tocan lo de Apple, prueban el teclado, se sientan en las sillas o juegan en el escritorio */
  const USE = { isla: ['tap', ['😍', '✨', '🤩']], mesa: ['type', ['👍', '💡', '🤓']], sillas: ['sit', ['😌', '🤩', '👌']], escritorio: ['play', ['🎮', '🔥', '😎']] };
  function useSpot(p, sp, on) { if (!sp || !sp.use) return; const u = USE[sp.use]; if (on) p.use(u[0], true, sp.use === 'sillas' || sp.use === 'escritorio' ? W.seatOf(sp.use, 0) : null, u[1]); else p.use(null, false); }
  function freeSpot() {
    const u = upNow(), dx = L.puerta.x, H = Math.PI / 2, all = [
      { p: [-5.1, -1.3], f: -H, via: [[dx, -1.3]] }, { p: [-5.1, 2.1], f: -H, via: [[dx, 2.1]] }]
      .concat(GS.FLOOR.map(id => { if (!u[id]) return null; const sl = slotOf(id), side = sl.x < dx ? 1 : -1; return id === 'escritorio' ? { p: [sl.x + side * 1.2, sl.z + 0.8], f: -side * 0.9 + Math.PI, via: [[dx, sl.z + 1.1]], use: id } : { p: [sl.x + (id === 'sillas' ? -0.48 : 0), sl.z + (id === 'sillas' ? 0.95 : 1.02)], f: Math.PI, via: [[dx, sl.z + 1.1]], use: id }; }),
        [u.gondola && { p: [4.3, 2.2], f: H, via: [[dx, 5.5], [4.3, 5.5]] }, u.gondola && { p: [4.3, 4.0], f: H, via: [[dx, 5.5], [4.3, 5.5]] }, u.arcade && { p: [0.7, 9.3], f: Math.PI, via: [[dx, 9.3]] }]);
    const free = []; all.forEach((x, i) => { if (x && !day.spots[i]) { x.i = i; free.push(x); } });
    return free.length ? U.pick(free) : null;
  }
  function spawnLooker() {
    const sp = freeSpot(); if (!sp) return; day.spots[sp.i] = 1;
    const p = W.makePerson(warm({ shirt: U.pick([0x6b7a8f, 0x3d7a4a, 0xd9a514, 0x4a6fb5, 0xb86fa8, 0x21a0a0, 0x7b4fd1, 0xe07a5f]), hair: U.pick(GS.HAIRS), hairStyle: U.pick(GS.HAIRSTYLES)[0], glasses: Math.random() < 0.3, beard: Math.random() < 0.2, lips: Math.random() < 0.4, speed: U.rnd(2.2, 2.9) }));
    p.voice = U.rnd(230, 480); p.setPos(L.puerta.x + U.rnd(-0.4, 0.4), L.galeria.zMax + 2.4); day.extras.push(p);
    const lk = { p, sp, st: 'in', wait: 0, hops: 0 }; day.lookers.push(lk); day.wv.lookers = (day.wv.lookers || 0) + 1;
    p.walk(sp.via.concat([sp.p]), () => { lk.st = 'look'; lk.wait = U.rnd(3, 5.5) + (sp.use ? 2 : 0); p.face(sp.f); useSpot(p, sp, true); });
  }
  function lookerOut(lk) {
    lk.st = 'out'; const d = day; delete d.spots[lk.sp.i]; useSpot(lk.p, lk.sp, false);
    lk.p.walk(lk.sp.via.slice().reverse().concat([[L.puerta.x + U.rnd(-2, 2), L.galeria.zMax + 3]]), () => { lk.p.remove(); const i = d.lookers.indexOf(lk); if (i >= 0) d.lookers.splice(i, 1); });
  }
  function updateLookers(dt) {
    if (!day.closing && (day.lookT -= dt) <= 0) { day.lookT = U.rnd(8, 15) * (day.cond === 'lluvia' ? 1.8 : 1); if (day.lookers.length < 2 && day.wave >= 0) spawnLooker(); }
    for (const lk of day.lookers.slice()) {
      if (lk.st !== 'look' || (lk.wait -= dt) > 0) continue;
      const r = Math.random(), nx = lk.hops < 1 && r > 0.72 ? freeSpot() : null;
      if (nx) { useSpot(lk.p, lk.sp, false); delete day.spots[lk.sp.i]; day.spots[nx.i] = 1; const back = lk.sp.via.slice().reverse(); lk.sp = nx; lk.hops++; lk.st = 'in'; lk.p.walk(back.concat(nx.via, [nx.p]), () => { lk.st = 'look'; lk.wait = U.rnd(2.5, 4.5) + (nx.use ? 2 : 0); lk.p.face(nx.f); useSpot(lk.p, nx, true); }); continue; }
      if (r < 0.5) sayAt(lk.p, U.pick(LN.browse), 0, '', false, true);
      lookerOut(lk);
    }
    for (const cu of day.customers) if (cu.st === 'browse' && (cu.wait -= dt) <= 0) { useSpot(cu.person, cu.spot, false); delete day.spots[cu.spot.i]; toCounter(cu, cu.spot.via.slice().reverse()); }
  }
  /* ---------------- Compañeros: Lucho y Brian andan por el local haciendo sus cosas ---------------- */
  const STAFF = [], MOHAWK = [0xff5fa2, 0x2d6cdf, 0x3bb54a, 0xd9a514, 0xff2a2a, 0x7b4fd1, 0x57e6ff];
  function luchoLook(n) { const l = W.staff()[0]; if (l) l.look({ skin: GS.SKINS[3], hair: MOHAWK[n % MOHAWK.length], hairStyle: 'mohicano', glasses: true }); }   // el mohicano cambia de color cada jornada
  const canTalk = () => state === 'day' && day && !day.arcade && !day.closing;
  function staffSay(st, key, prob) { if (canTalk() && Math.random() < (prob || 0.4)) sayAt(st.p, U.pick(LN.staff[key]), 0, '', false, true); }
  function staffInit() {
    const ps = W.staff();
    STAFF.push({ p: ps[0], hub: [4.0, 0.9], q: [['wait', 2]], w: { repo: 4, taller: 2, mate: 1, vidriera: 1, siesta: 1 } }, { p: ps[1], hub: [3.6, 1.7], q: [['wait', 6]], w: { celu: 3, siesta: 2, repo: 2, mate: 1, vidriera: 1 } });
  }
  const hiBag = {};
  function regHi() {
    const id = brId(), all = RG(id).hi; if (!all.length || Math.random() > 0.5) return '';
    let b = hiBag[id]; if (!b || !b.left.length) { const last = b && b.last; b = hiBag[id] = { left: U.shuffle(all.slice()), last }; if (b.left.length > 1 && b.left[b.left.length - 1] === last) b.left.unshift(b.left.pop()); }
    b.last = b.left.pop(); return b.last + ' ';
  }
  function staffPlan(st) {
    const P = st.p, out = [[4.5, -1.2]], dd = [[4.6, -4.4], [6.0, -4.4], [7.4, -4.4]], rev = a => a.slice().reverse(), go = pts => ['go', pts];
    const other = STAFF.find(o => o !== st), w = Object.assign({}, st.w); if (other && other.act && other.act !== 'celu') delete w[other.act];     // nunca los dos en lo mismo
    let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0), k = 'celu'; for (const key in w) { if ((r -= w[key]) <= 0) { k = key; break; } }
    st.act = k;
    const round = (to, f, wait, key) => [go(to), ['face', f], ['fn', () => staffSay(st, key)], ['wait', wait], go(rev(to).slice(1).concat([st.hub]))];
    if (k === 'repo') {                       // busca una caja en el depósito y la repone en algún sector
      const tg = U.pick([{ to: [[-0.6, -1.6], [-4.3, -1.6]], back: [[-0.6, -1.6], [4.5, -1.2]], f: -1.57 }, { to: [[4.0, 0.9], [4.4, 2.0]], back: [[4.0, 0.9]], f: 1.57 }, { to: [[4.0, 0.9], [4.0, 5.5], [-0.3, 5.5], [-0.3, 8.0]], back: [[-0.3, 5.5], [4.0, 5.5], [4.0, 0.9]], f: 1.57 }]);
      st.q = [go(out.concat(dd, [[9.0, -5.1]])), ['face', 3.14], ['wait', 2.2], ['fn', () => P.carry(true)], go(rev(dd).concat(out, tg.to)), ['face', tg.f], ['fn', () => staffSay(st, 'repo')], ['wait', 2.6], ['fn', () => P.carry(false)], go(tg.back.concat([st.hub]))];
    } else if (k === 'siesta') {              // una siestita en el fondo del depósito
      st.q = [go(out.concat(dd, [[10.3, -4.3], [10.5, -4.5]])), ['fn', () => { P.lie(true); }], ['wait', 7], ['fn', () => { P.lie(false); staffSay(st, 'siesta', 0.6); }], ['wait', 1.3], go(rev(dd).concat(out, [st.hub]))];
    } else if (k === 'taller') st.q = round([[4.0, 0.9], [4.0, 5.5], [6.0, 5.5], [7.3, 5.9], [7.6, 7.0]], 0.9, 3.5, 'taller');
    else if (k === 'mate') st.q = round(out.concat([[4.6, -4.4], [4.0, -5.3], [0.9, -5.8]]), 3.14, 3, 'mate');
    else if (k === 'vidriera') st.q = round([[4.0, 0.9], [4.0, 5.5], [-0.3, 5.5], [-1.2, 9.6]], -1.57, 3.5, 'vidriera');
    else st.q = [go([[st.hub[0] + U.rnd(-0.3, 0.5), st.hub[1] + U.rnd(-0.5, 0.5)]]), ['face', U.rnd(-0.6, 0.6)], ['wait', 5], ['fn', () => staffSay(st, 'celu', 0.25)]];
    st.q.push(['fn', () => { st.act = null; }], ['wait', U.rnd(2, 6)]);
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
      const wc = day.customers.filter(c => c.st === 'waitC'); if (!wc.length || (wc.length < 2 && !(MG.isOpen() && wc[0].wc > 5) && !(wc[0].wc > 14))) return;   // cola de 2, o uno esperando mientras estás ocupado
      const cu = wc.sort((a, c) => c.slotC - a.slotC)[0], g = b.p.group.position, pre = g.x > 6.2 && g.z < -1.2 ? [[7.4, -4.4], [6.0, -4.4]] : g.x > 6.2 ? [[6.0, 5.5], [4.0, 5.5], [4.5, -1.2]] : g.z > 5.8 ? [[-0.3, 5.5], [4.0, 5.5], [4.5, -1.2]] : g.z < -4.6 ? [] : [[4.5, -1.2]];
      cu.st = 'helped'; cu.slotC = -1; cu.label.hidden = true; b.busy = true; b.moving = false; b.q = []; b.act = null; b.p.lie(false); b.p.carry(false);
      const hp = day.helper = { cu, t: -1 }, d = day;
      cu.person.walk([[3.1, -2.9]], () => cu.person.face(Math.PI));
      b.p.walk(pre.concat(g.z < -4.6 ? [] : [[4.6, -4.4], [4.0, -5.0]], [L.brianCaja]), () => { if (day !== d) return; b.p.face(0); hp.t = 2.6; sayAt(b.p, U.pick(LN.staff.caja2), 2400); });
      return;
    }
    if (h.t < 0 || (h.t -= dt) > 0) return;
    const cu = h.cu; day.helper = null; day.wv.helped = 1; day.served++; day.sales += cu.product.price; day.score += 90; addRep(0.03); A.play('cash');
    sayAt(cu.person, cu.arche.bye, 3200); leave(cu, true); toast('<b>🧾 Segunda caja</b>Brian le cobró a ' + cu.arche.name + '.', '', 2400);
    b.busy = false; b.q = [['go', [[4.0, -5.0], [4.6, -4.4], [4.5, -1.2], b.hub]], ['wait', 3]];
  }

  /* ---------------- TRAMA: el fondo para el local de al lado ---------------- */
  const PL = GS.PLOT;
  /* Los fondos de expansión se retiraron: lo que antes sumaba fondos ahora suma monedas. goalNow dice si quedan regiones por abrir. */
  const fondoNow = () => 0, goalNow = () => (GS.REGIONS.some(r => !(brAll()[r.id] || {}).open && (!r.secret || malvOk())) ? 1 : 0);
  const tierNow = () => { const r = fondoNow() / goalNow(); let t = PL.tiers[0]; PL.tiers.forEach(x => { if (r >= x.at) t = x; }); return t; };
  const daysLeft = () => Math.max(0, C.finalDay - dayNumber() + 1);
  function addFondo(v) { GS.Store.set('coins', Math.max(0, coinsNow() + v)); }
  function plotHtml() {
    const f = fondoNow(), g = goalNow(), all = brAll(), open = MAIN.filter(r => all[r.id] && all[r.id].open).length, glob = Math.round(MAIN.reduce((a, r) => a + brProgress(r.id), 0) / MAIN.length);
    return '<b>🗺️ ' + PL.name + ' · ' + glob + '%</b><span class="pb"><i style="width:' + glob + '%"></i></span><small>Sucursales: ' + open + ' de 5 · ' + ('rivales vencidos: ' + MAIN.filter(r => conquered(r.id)).length + ' de 5') + ' · tocá para ver el mapa</small>';
  }
  /* ---------------- SUCURSALES: una por región. La activa guarda sus mejoras y su reputación; las demás quedan congeladas con su encargado ---------------- */
  const MAIN = GS.REGIONS.filter(r => !r.secret);          // las 5 regiones; Malvinas es el final oculto
  const RG = id => GS.REGIONS.find(r => r.id === id), brId = () => GS.Store.get('branch') || 'pampeana', brAll = () => GS.Store.get('branches') || { pampeana: { open: 1 } }, brNow = () => brAll()[brId()] || {};
  function brSave(patch) { const all = brAll(), id = brId(); all[id] = Object.assign(all[id] || { open: 1 }, { up: upNow(), rep: repNow() }, patch || {}); GS.Store.set('branches', all); }
  function brProgress(id) {
    const b = brAll()[id]; if (!b || !b.open) return 0; const me = id === brId(), up = me ? upNow() : b.up || {}, r = me ? repNow() : (b.rep == null ? 3 : b.rep);
    let have = 0, tot = 0; GS.UPGRADES.forEach(g => { tot += g.levels.length; have += Math.min(g.levels.length, up[g.id] || 0); });
    const ss = GS.STORIES.filter(S => !S.once && (S.reg || 'pampeana') === id), h = histAll(), sd = ss.filter(S => h[S.id] && h[S.id].done).length;
    return Math.round((have / tot * 0.5 + Math.min(1, r / 4.8) * 0.3 + (ss.length ? sd / ss.length : 1) * 0.2) * 100);
  }
  const brData = id => { const b = brAll()[id] || {}, me = id === brId(), up = me ? upNow() : b.up || {}, rep = me ? repNow() : (b.rep == null ? 3 : b.rep), h = histAll(), ss = GS.STORIES.filter(S => !S.once && (S.reg || 'pampeana') === id); let have = 0, tot = 0; GS.UPGRADES.forEach(g => { tot += g.levels.length; have += Math.min(g.levels.length, up[g.id] || 0); });
    return { open: !!b.open, rep, flota: up.flota || 0, have, tot, sd: ss.filter(S => h[S.id] && h[S.id].done).length, st: ss.length }; };
  const won = id => !!(brAll()[id] || {}).won;
  const readyDuel = id => { const x = brData(id); return x.open && !won(id) && (!!(brAll()[id] || {}).duel || (x.rep >= 4.8 && x.flota >= 3)); };      /* cumplió los dos objetivos: toca el día de competencia */
  const conquered = id => { const x = brData(id); return x.open && won(id); };
  const RV = id => { const R = RG(id) || {}, S = GS.STORIES.find(x => x.id === 'rival_' + id) || {}; return R.rival ? Object.assign({ col: '#e10600', mark: '⚔️', motto: '', taunts: [] }, R.rival, { look: Object.assign({ skin: 0xe0ac7e }, S.look || {}), city: R.city, id }) : null; };
  /* partidas anteriores a los duelos: lo que ya estaba conquistado (5 estrellas y flota) queda conquistado */
  try { if (!GS.Store.get('mig70')) { const all = GS.Store.get('branches'); if (all) { const cur = GS.Store.get('branch') || 'pampeana'; Object.keys(all).forEach(id => { const b = all[id], me = id === cur, up = me ? (GS.Store.get('up') || {}) : b.up || {}, rp = me ? GS.Store.get('rep') : b.rep; if (b.open && (rp || 0) >= 4.8 && (up.flota || 0) >= 3) b.won = 1; }); GS.Store.set('branches', all); } GS.Store.set('mig70', 1); } } catch (e) {}
  const pendingOpen = () => GS.REGIONS.filter(r => (brAll()[r.id] || {}).open && !conquered(r.id));            // sucursales abiertas a las que todavía les falta
  const canExpand = () => DEV() || !pendingOpen().length;
  const brStage = id => { const p = brProgress(id); return p < 45 ? 1 : p < 80 ? 2 : 3; }, STAGE = ['', 'Humilde', 'Mejorado', 'Estrella'];
  const brCrew = id => id === 'pampeana' ? ['Lucho', 'Brian'] : ((brAll()[id] || {}).staff || []).map(c => (RG(id).crew.find(x => x.id === c) || {}).name);
  const bossHere = () => brId() === 'pampeana' || repNow() < 4;
  function applyBranch() {
    const id = brId(), R = RG(id), ps = W.staff(); W.setRegion(R, brStage(id), id === 'malvinas' && malvWon()); skyKey = ''; setSky(0.3, false); W.setUpgrades(upNow()); W.bossVisible(bossHere());
    if (id === 'pampeana') { luchoLook(dayNumber()); ps[1].look({ skin: GS.SKINS[0], hair: 0x2d6cdf, hairStyle: 'corto', glasses: false }); }
    else (brNow().staff || []).forEach((c, i) => { const e = R.crew.find(x => x.id === c); if (e && ps[i]) ps[i].look(e.look); });
  }
  function switchBranch(id) {
    brSave(); const web = upNow().web, b = brAll()[id]; GS.Store.set('branch', id);
    GS.Store.set('up', Object.assign({}, b.up || {}, web ? { web } : {})); GS.Store.set('rep', b.rep == null ? 4 : b.rep);     // la marca (la web) vale en todas
    applyBranch(); refreshStart(); GS.track('sucursal', { id });
  }
  // Mapa del país en 3D: se toca una región y abajo aparece su tarjeta (viajar, abrir o ver qué le falta)
  const mapState = lit => { const all = brAll(), o = {}; GS.REGIONS.forEach(r => { const b = all[r.id], open = (lit && !r.secret) || !!(b && b.open); if (r.secret && !open && !malvOk()) { o[r.id] = { hidden: true }; return; } o[r.id] = { flag: !!r.secret && open && malvWon(), open, can: !open && fondoNow() >= r.cost && canExpand(), cur: !lit && r.id === brId(), stage: lit ? 3 : open ? brStage(r.id) : 0 }; }); return o; };
  function mapCard(id) {
    const all = brAll(), cur = brId(), f = fondoNow(), r = RG(id), b = all[id], open = b && b.open, me = id === cur, h = histAll(), ss = GS.STORIES.filter(S => !S.once && (S.reg || 'pampeana') === id);
    if (!open) { const pend = pendingOpen(), ok = canExpand(), need = !ok ? 'Primero ganale al rival de ' + pend.map(x => x.city).join(' y ') : 'Abrir sucursal en ' + r.city;
      return '<div class="suc lock"><b>🔒 ' + r.name + ' · ' + r.city + '</b><small>🗺️ ' + r.prov.join(' · ') + '</small><small>🌦️ ' + r.clima + '</small><small>⚔️ Zona de <b>' + r.rival.name + '</b></small><button class="btn alt" data-open="' + id + '"' + (!ok ? ' disabled' : '') + '>' + need + '</button></div>'; }
    const rp = me ? repNow() : (b.rep == null ? 3 : b.rep), pr = brProgress(id), up = me ? upNow() : b.up || {}, pend = GS.UPGRADES.reduce((a, g) => a + g.levels.length - Math.min(g.levels.length, up[g.id] || 0), 0);
    return '<div class="suc' + (me ? ' me' : '') + '"><b>' + r.name + ' · ' + r.city + (pr >= 100 ? ' 💎' : conquered(id) ? ' ✅' : '') + '</b>' +
      '<small class="al">' + (conquered(id) ? '✅ Región conquistada' + (pr >= 100 ? ' · 💎 platino' : '') : readyDuel(id) ? '⚔️ ¡Listo para el día de competencia!' : 'Para desafiar al rival: ' + (rp < 4.8 ? '⭐ llegar a 5 estrellas' : '⭐ listo') + ' · ' + ((up.flota || 0) < 3 ? '🚚 completar la flota' : '🚚 listo')) + (b.manager && !me ? ' · encargado: ' + b.manager : '') + '</small>' + progBox(id) +
      (r.rival ? '<small class="rv" style="--rc:' + (r.rival.col || '#e10600') + '">' + (won(id) ? '🏆 Le ganaste a ' + r.rival.name + ': +10% de monedas acá' : (r.rival.mark || '⚔️') + ' <b>' + r.rival.name + '</b> · ' + r.rival.owner + ': ' + (r.rival.fx || r.rival.rule) + ((b.tries || 0) ? ' · revanchas: ' + b.tries : '')) + '</small>' : '') +
      (me ? '<button class="btn ghost" disabled>Estás acá</button>' : '<button class="btn" data-go="' + id + '">Viajar a ' + r.city + '</button>') + '</div>';
  }
  // Consejos del Dueño: una sola vez cada uno, sin frenar el juego
  const BOSS_LOOK = GS.BOSS_LOOK; let coachT = 0;
  function coach(id) {
    const seen = GS.Store.get('seen') || {}; if (seen['t_' + id] || !GS.TIPS[id]) return; seen['t_' + id] = 1; GS.Store.set('seen', seen);
    $('coachFace').innerHTML = avatarSvg(BOSS_LOOK, 'talk'); $('coachTxt').innerHTML = GS.TIPS[id]; const big = state !== 'day'; $('coach').classList.toggle('big', big); $('coach').hidden = false; clearTimeout(coachT); if (!big) coachT = setTimeout(() => { $('coach').hidden = true; }, 16000);   /* fuera de la jornada: tarjeta grande que se cierra con el botón */
  }
  // Primera vez: el mapa, con el Dueño explicando la misión. Termina tocando Buenos Aires.
  let onb = -1, onbThen = null;
  function onbMap(then) {            // recién acá aparece el mapa: solo para elegir Buenos Aires
    onb = 1; onbThen = then; $('modal').hidden = true; $('start').hidden = true; $('map').hidden = false; $('map').classList.add('onb'); $('mapSuc').textContent = '🏪 Sucursales 1 de 5'; $('mapCq').textContent = '🏆 Conquistadas 0 de 5'; $('mapBar').style.width = '0%'; $('mapFon').textContent = '⚔️ Rivales 0 de 5';
    const done = () => { onb = -1; $('map').classList.remove('onb'); GS.Map3D.close(); $('map').hidden = true; GS.Store.set('introSeen', true); const f = onbThen; onbThen = null; f(); };
    if (!GS.Map3D.open($('mapCv'), mapState(), id => { if (id !== 'pampeana') return toast('<b>Todavía no</b>Primero Buenos Aires: tocá la región verde.', '', 2200); A.play('ok'); done(); })) return done();
    GS.Map3D.select('pampeana'); $('mapCard').innerHTML = '<div class="guide"><div class="coach-face">' + avatarSvg(BOSS_LOOK, 'happy') + '</div><div style="flex:1"><p><b>Tocá Buenos Aires</b> para empezar tu primera jornada.</p><small>👆 Es la región verde, con la tiendita de GameShop</small></div></div>';
  }
  function showOnboard(then) {
    $('start').hidden = true; GS.track('guia_inicio', {});
    showEpic(GS.ONBOARD, null, '<button class="btn" id="onbGo">🗺️ Abrir el mapa</button>', () => $('onbGo').addEventListener('click', () => { A.play('click'); closeEpic(); onbMap(then); }), true);
  }
  let mapWasDay = false;
  function closeMap() { GS.Map3D.close(); $('map').hidden = true; if (mapWasDay) paused = false; mapWasDay = false; }
  function mapPick(id) { GS.Map3D.select(id); $('mapCard').innerHTML = mapCard(id); A.play('click'); }
  function showMap() {
    const all = brAll(), n = MAIN.filter(r => all[r.id] && all[r.id].open).length; mapWasDay = state === 'day'; if (mapWasDay) paused = true;
    $('modal').hidden = true; $('map').hidden = false; $('mapSuc').textContent = '🏪 Sucursales ' + n + ' de 5'; $('mapFon').textContent = '⚔️ Rivales vencidos ' + MAIN.filter(r => conquered(r.id)).length + ' de 5'; $('mapX').textContent = state === 'menu' ? '← Volver al menú' : '← Volver';
    if (!GS.Map3D.open($('mapCv'), mapState(), mapPick)) { closeMap(); return toast('<b>Ups</b>No se pudo dibujar el mapa en este navegador.', '', 2600); }
    { const cq = MAIN.filter(r => conquered(r.id)).length; $('mapCq').textContent = '🏆 Conquistadas ' + cq + ' de 5'; $('mapBar').style.width = (cq / 5 * 100) + '%'; }
    GS.Map3D.select(brId()); $('mapCard').innerHTML = mapCard(brId()); coach('mapa');
  }
  // Antes de irse hay que dejar un encargado. La sucursal queda congelada tal como estaba.
  function pickManager(then) {
    if (brNow().manager) return then(); const names = brCrew(brId());
    const LK = { Lucho: { hair: MOHAWK[1], hairStyle: 'mohicano', skin: GS.SKINS[3], glasses: true }, Brian: { hair: 0x2d6cdf, hairStyle: 'corto', skin: GS.SKINS[0] } }, lookOf = n => Object.assign({ shirt: 0xe10600 }, (RG(brId()).crew || []).filter(c => c.name === n).map(c => c.look)[0] || LK[n] || {});
    modal('<div class="gold-h"><i></i><b>Encargado</b><i></i></div><p style="text-align:center">Te vas de <b>' + RG(brId()).city + '</b>. ¿Quién queda a cargo? La sucursal queda tal como la dejás hasta que vuelvas.</p><div class="mgrs">' + names.map(n => '<button data-mg="' + n + '"><div class="pf">' + avatarSvg(lookOf(n), 'happy') + '</div><b>' + n + '</b><small>Tocá para elegir</small></button>').join('') + '</div>');
    $('sheet').querySelectorAll('[data-mg]').forEach(b => b.addEventListener('click', () => { brSave({ manager: b.dataset.mg }); A.play('ok'); toast('<b>' + b.dataset.mg + ', encargado</b>"' + LN.freeze + '"', '', 3400); then(); }));
  }
  function leaveTo(id) { if (state === 'day') return toast('<b>Terminá la jornada</b>Se viaja entre jornadas.', '', 2200); pickManager(() => { switchBranch(id); $('modal').hidden = true; if (state === 'end') goHome(); toast('<b>✈️ ' + RG(id).city + '</b>Sucursal ' + RG(id).name + '.', '', 2600); }); }
  function openRegion(id) {
    if (state === 'day') return toast('<b>Terminá la jornada</b>Las sucursales se abren entre jornadas.', '', 2200);
    if (!canExpand()) return toast('<b>Todavía no</b>Primero ganale al rival de ' + pendingOpen().map(x => x.city).join(' y ') + ': 5 estrellas, flota completa y el día de competencia.', '', 4200);
    const R = RG(id), sel = [];
    { const rv = GS.STORIES.find(S => S.id === 'rival_' + id), me = Object.assign({ skin: GS.SKINS[2], hair: GS.HAIRS[0], hairStyle: 'corto', shirt: 0xe10600 }, GS.Store.get('avatar') || {}); var headR = '<div class="reg-head" style="background:linear-gradient(120deg, ' + ACC[id] + ', #15151a 115%)"><small>Nueva sucursal · Región ' + R.name + '</small><b>' + R.city + '</b></div>' +
      (rv ? '<div class="vs"><figure><div class="pf">' + avatarSvg(me, 'happy') + '</div><figcaption>GameShop</figcaption></figure><b>VS</b><figure><div class="pf">' + avatarSvg(Object.assign({ skin: 0xe0ac7e }, rv.look), 'angry') + '</div><figcaption>' + R.rival.name + '</figcaption></figure></div>' : ''); }
    modal(headR + '<p>' + R.why + '</p><div class="ctx"><div><i>🗺️</i><span><b>Provincias de la región</b>' + R.prov.join(' · ') + '</span></div><div><i>🌦️</i><span><b>Clima</b>' + R.clima + '</span></div><div class="riv"><i>⚔️</i><span><b>Competencia: ' + R.rival.name + '</b>' + R.rival.owner + ' no va a regalar nada. ' + R.rival.rule + ' Para quedarte con la región vas a tener que ganarle en el día de competencia.</span></div></div><p><b>Elegí 2 empleados</b> de los 4 que se presentaron. Después vas a tener que enseñarles.</p><div class="crew">' +
      R.crew.map(c => '<button class="cand" data-c="' + c.id + '">' + GS.faceSvg(Object.assign({ shirt: 0xe10600 }, c.look), 'happy') + '<b>' + c.name + '</b><small>' + c.d + '</small></button>').join('') + '</div><div class="row"><button class="btn ghost" data-close>Todavía no</button><button class="btn" id="regOk" disabled>Abrir sucursal</button></div>');
    $('sheet').querySelectorAll('.cand').forEach(b => b.addEventListener('click', () => { const c = b.dataset.c, k = sel.indexOf(c); if (k >= 0) sel.splice(k, 1); else if (sel.length < 2) sel.push(c); $('sheet').querySelectorAll('.cand').forEach(x => x.classList.toggle('on', sel.indexOf(x.dataset.c) >= 0)); $('regOk').disabled = sel.length !== 2; A.play('click'); }));
    $('regOk').addEventListener('click', () => pickManager(() => {
      const all = brAll(); all[id] = { open: 1, staff: sel.slice(), up: {}, rep: 4, train: 0, days: 0 }; GS.Store.set('branches', all); switchBranch(id); if (state === 'end') goHome();
      W.showAll(); GS.track('abre_sucursal', { id }); $('modal').hidden = true; epicCtx = { id };
      showEpic([{ art: 'inaug', k: 'Sucursal ' + R.name + ' · ' + R.prov.length + ' provincias', t: '¡Inauguración en ' + R.city + '!', d: 'Hay fila desde la esquina. ' + brCrew(id).join(' y ') + ' están con la remera recién planchada. Empezás con un local humilde: llevalo a 5 estrellas, completá la flota y después desafiá a ' + R.rival.name + '.' }], null,
        '<button class="btn" id="inaGo">✂️ Cortar la cinta</button>', () => $('inaGo').addEventListener('click', () => { A.play('cash'); closeEpic(); refreshStart(); toast('<b>🎉 ' + R.city + ' ya está abierta</b>Comenzá la primera jornada cuando quieras.', '', 3600); }));
    }));
  }
  /* ---------------- FINAL: el país completo. Cambia según cómo se llegó; después, Nuevo Juego+ ---------------- */
  const allDone = () => MAIN.every(r => conquered(r.id));
  const malvWon = () => conquered('malvinas');
  const malvOk = () => allDone() || (DEV() && MAIN.every(r => (brAll()[r.id] || {}).open));        // en modo desarrollador alcanza con tener las 5 abiertas
  const snowy = () => brId() === 'cuyo' || brId() === 'patagonia', condInfo = c => GS.CONDITIONS[c === 'lluvia' && snowy() ? 'nieve' : c];
  /* Finales contados en imágenes: una seguidilla a pantalla completa, y al final los botones */
  const PIRATE = () => (GS.STORIES.find(S => S.id === 'rival_malvinas') || {}).look || {};
  let epicCtx = {};
  // Una tiendita de GameShop dibujada de frente (la misma del mapa), para las escenas
  const storeSvg = () => '<svg viewBox="0 0 256 250" class="ep-store"><rect x="26" y="96" width="204" height="142" fill="#fbe3c3"/><rect x="26" y="96" width="204" height="10" fill="#eec892"/><rect x="18" y="226" width="220" height="16" rx="2" fill="#fff"/>' +
    '<rect x="46" y="150" width="62" height="92" rx="2" fill="#0d5c63"/><rect x="54" y="158" width="46" height="46" fill="#9fd8c4"/><rect x="54" y="210" width="46" height="24" fill="#5f8f8f"/><circle cx="103" cy="198" r="3.400" fill="#ffd23a"/>' +
    '<rect x="124" y="152" width="96" height="60" rx="2" fill="#0d5c63"/><rect x="130" y="158" width="39" height="48" fill="#9fd8c4"/><rect x="175" y="158" width="39" height="48" fill="#9fd8c4"/><rect x="120" y="212" width="104" height="9" rx="1" fill="#fff"/>' +
    Array.from({ length: 8 }, (_, k) => { const x0 = 14 + k * 28.5, c = k % 2 ? '#fff' : '#f0103c', c2 = k % 2 ? '#dfe5ea' : '#a80a2a'; return '<path d="M' + (26 + k * 25.5) + ' 96 L' + (26 + (k + 1) * 25.5) + ' 96 L' + (x0 + 28.5) + ' 132 L' + x0 + ' 132z" fill="' + c + '"/><path d="M' + x0 + ' 132 a14.250 14.250 0 0 0 28.500 0z" fill="' + c2 + '"/>'; }).join('') +
    '<rect x="18" y="84" width="220" height="13" rx="2" fill="#fff"/><rect x="8" y="14" width="240" height="70" rx="10" fill="#f5c518"/><rect x="12" y="18" width="232" height="62" rx="8" fill="#000"/><image href="' + GS.LOGO + '" x="20" y="22" width="216" height="54" preserveAspectRatio="xMidYMid meet"/></svg>';
  /* Escena frontal de cada región: cielo, paisaje alusivo, vereda y calle, con la tienda encima */
  let scN = 0;
  function sceneSvg(id, o) {
    o = o || {}; const u = 'sc' + (++scN), H = 340, P = a => a.map(q => q.join(',')).join(' ');
    const SKY = { pampeana: ['#3f8fe0', '#bfe3fb'], cuyo: ['#2f7fd6', '#ffe1b0'], noa: ['#f28a3c', '#ffe3a6'], nea: ['#27a3c9', '#d7f5d0'], patagonia: ['#5b8fc9', '#eaf4fb'], malvinas: ['#6f8296', '#d5dde4'] }[id] || ['#3f8fe0', '#bfe3fb'];
    const peak = (x, w, h, c, snow) => '<polygon points="' + P([[x - w / 2, H], [x, H - h], [x + w / 2, H]]) + '" fill="' + c + '"/>' + (snow ? '<polygon points="' + P([[x, H - h], [x - 0.11 * w, H - 0.78 * h], [x - 0.05 * w, H - 0.83 * h], [x, H - 0.75 * h], [x + 0.05 * w, H - 0.83 * h], [x + 0.11 * w, H - 0.78 * h]]) + '" fill="#fff"/>' : '') + '<polygon points="' + P([[x, H - h], [x + w / 2, H], [x + w * 0.12, H]]) + '" fill="rgba(0,0,0,.13)"/>';
    const bld = (x, w, h, c, lit) => { let t = '<rect x="' + x + '" y="' + (H - h) + '" width="' + w + '" height="' + (h + 4) + '" fill="' + c + '"/>'; for (let yy = H - h + 8; yy < H - 8; yy += 13) for (let xx = x + 5; xx < x + w - 7; xx += 10) t += '<rect x="' + xx + '" y="' + yy + '" width="5" height="7" fill="' + (((xx * 7 + yy * 3) | 0) % 5 === 0 ? lit : 'rgba(255,255,255,.28)') + '"/>'; return t; };
    const tree = (x, y, r, c) => '<rect x="' + (x - 2.5) + '" y="' + (y - r) + '" width="5" height="' + (r + 4) + '" fill="#6b4a2b"/><circle cx="' + x + '" cy="' + (y - r * 1.5) + '" r="' + r + '" fill="' + c + '"/><circle cx="' + (x - r * 0.3) + '" cy="' + (y - r * 1.7) + '" r="' + r * 0.45 + '" fill="rgba(255,255,255,.16)"/>';
    const pine = (x, y, h, c) => '<rect x="' + (x - 2) + '" y="' + (y - 6) + '" width="4" height="8" fill="#5a3d22"/>' + [0, 1, 2].map(k => '<polygon points="' + P([[x - h * (0.3 - k * 0.06), y - 4 - k * h * 0.26], [x, y - h * 0.5 - k * h * 0.26], [x + h * (0.3 - k * 0.06), y - 4 - k * h * 0.26]]) + '" fill="' + c + '"/>').join('');
    const alamo = (x, y, h) => '<rect x="' + (x - 1.5) + '" y="' + (y - 8) + '" width="3" height="10" fill="#6b4a2b"/><ellipse cx="' + x + '" cy="' + (y - h / 2 - 4) + '" rx="' + h * 0.13 + '" ry="' + h / 2 + '" fill="#4e9a3a"/>';
    const cardon = (x, y, h) => '<g fill="none" stroke="#3f8f4f" stroke-linecap="round" stroke-width="' + h * 0.17 + '"><path d="M' + x + ' ' + y + ' V' + (y - h) + '"/><path d="M' + x + ' ' + (y - h * 0.4) + ' h' + (-h * 0.26) + ' v' + (-h * 0.3) + '"/><path d="M' + x + ' ' + (y - h * 0.55) + ' h' + (h * 0.24) + ' v' + (-h * 0.24) + '"/></g>';
    const palm = (x, y, h) => '<path d="M' + x + ' ' + y + ' q' + (h * 0.12) + ' ' + (-h * 0.5) + ' 0 ' + (-h) + '" stroke="#7a5a35" stroke-width="5" fill="none" stroke-linecap="round"/><g stroke="#2f9a45" stroke-width="5" fill="none" stroke-linecap="round">' + [[-26, 2], [-20, -14], [-6, -22], [8, -22], [22, -13], [27, 3]].map(q => '<path d="M' + x + ' ' + (y - h) + ' q' + q[0] * 0.5 + ' ' + (q[1] - 8) + ' ' + q[0] + ' ' + q[1] + '"/>').join('') + '</g>';
    const cloud = (x, y, k) => '<g fill="#fff" opacity=".9"><ellipse cx="' + x + '" cy="' + y + '" rx="' + 30 * k + '" ry="' + 10 * k + '"/><ellipse cx="' + (x - 12 * k) + '" cy="' + (y - 7 * k) + '" rx="' + 14 * k + '" ry="' + 10 * k + '"/><ellipse cx="' + (x + 10 * k) + '" cy="' + (y - 9 * k) + '" rx="' + 17 * k + '" ry="' + 12 * k + '"/></g>';
    let back = '', ground = '#7fbf5a', walk = '#d9d6cf', front = '';
    if (id === 'pampeana' || !id) { ground = '#8a929c';
      back = cloud(70, 96, 1) + cloud(330, 140, 0.8) + bld(-6, 44, 150, '#8fb3d9', '#ffe27a') + bld(96, 40, 190, '#9cbde0', '#ffe27a') + bld(250, 50, 170, '#8fb3d9', '#ffe27a') + bld(340, 44, 210, '#9cbde0', '#ffe27a') +
        '<polygon points="' + P([[176, H], [181, H - 232], [186, H - 250], [191, H - 232], [196, H]]) + '" fill="#f4f1ea"/><polygon points="' + P([[186, H - 250], [191, H - 232], [196, H], [186, H]]) + '" fill="#d6d2c8"/>' +
        bld(30, 58, 104, '#5f86b5', '#ffd23a') + bld(296, 52, 118, '#5f86b5', '#ffd23a') + bld(366, 40, 88, '#6c93c2', '#ffd23a') + bld(-10, 30, 70, '#6c93c2', '#ffd23a') + tree(52, 366, 17, '#8e6fc9') + tree(352, 366, 19, '#4e9a3a'); }
    if (id === 'cuyo') { ground = '#b99a62';
      back = cloud(320, 90, 0.9) + '<circle cx="76" cy="92" r="26" fill="#fff3b0"/>' + peak(90, 250, 200, '#7d86b8', 1) + peak(300, 300, 240, '#6f78ad', 1) + peak(196, 220, 170, '#8a92c2', 1) + peak(20, 220, 96, '#b98a5c') + peak(380, 240, 104, '#b0804f') + peak(210, 200, 70, '#c59a66') +
        [0, 1, 2, 3, 4].map(k => '<path d="M-4 ' + (H + 4 + k * 5) + ' H96 M306 ' + (H + 4 + k * 5) + ' H404" stroke="#5f9a3c" stroke-width="3.2" stroke-dasharray="7 3"/>').join('') + alamo(22, 362, 86) + alamo(40, 364, 100) + alamo(58, 362, 80) + alamo(350, 364, 96) + alamo(368, 362, 84) + alamo(386, 364, 104); }
    if (id === 'noa') { ground = '#c98f5a'; walk = '#e3d2b4';
      back = '<circle cx="320" cy="96" r="30" fill="#fff0b0"/>' + '<path d="M-10 ' + H + ' L40 150 L120 190 L200 120 L290 180 L360 130 L410 170 V' + H + ' Z" fill="#b5452f"/><path d="M-10 ' + H + ' L44 196 L120 226 L200 170 L290 222 L360 180 L410 212 V' + H + ' Z" fill="#e0823a"/><path d="M-10 ' + H + ' L48 238 L120 258 L200 216 L290 258 L360 226 L410 250 V' + H + ' Z" fill="#f0c04a"/><path d="M-10 ' + H + ' L50 276 L120 290 L200 258 L290 292 L360 268 L410 286 V' + H + ' Z" fill="#9a5aa8"/><path d="M-10 ' + H + ' L56 308 L130 318 L200 296 L290 320 L360 304 L410 314 V' + H + ' Z" fill="#c76a4a"/>' +
        '<rect x="330" y="' + (H - 34) + '" width="44" height="38" fill="#f6ead2"/><rect x="340" y="' + (H - 62) + '" width="16" height="30" fill="#f6ead2"/><polygon points="' + P([[338, H - 62], [348, H - 76], [358, H - 62]]) + '" fill="#b5452f"/><rect x="346" y="' + (H - 18) + '" width="10" height="22" rx="5" fill="#7a4a2a"/>' + cardon(34, 368, 62) + cardon(70, 362, 40) + cardon(376, 372, 50); }
    if (id === 'nea') { ground = '#b8502f'; walk = '#e2c1a6';
      back = cloud(90, 84, 1) + cloud(300, 120, 0.8) + '<path d="M-10 ' + H + ' V210 Q60 170 130 204 T270 196 T410 206 V' + H + ' Z" fill="#1f7a45"/><rect x="296" y="204" width="76" height="' + (H - 204) + '" fill="#5d4a3a"/>' + [302, 316, 330, 344, 358].map((x, k) => '<rect x="' + x + '" y="' + (206 + k % 2 * 4) + '" width="8" height="' + (H - 210) + '" rx="4" fill="#fff" opacity=".85"/>').join('') + '<ellipse cx="334" cy="' + (H - 2) + '" rx="50" ry="10" fill="#fff" opacity=".8"/>' +
        '<path d="M-10 ' + H + ' V262 Q40 236 90 262 T170 268 V' + H + ' Z" fill="#2f9a45"/>' + palm(40, 368, 120) + palm(390, 368, 110) + palm(84, 356, 80); }
    if (id === 'patagonia') { ground = '#eef4f8'; walk = '#dfe6ec';
      back = cloud(84, 80, 0.9) + peak(60, 220, 190, '#7f93b5', 1) + peak(330, 260, 220, '#748aad', 1) + peak(196, 200, 250, '#8a9dbd', 1) + '<rect x="-4" y="' + (H - 34) + '" width="408" height="36" fill="#3f86c9"/><path d="M-4 ' + (H - 24) + ' H404 M30 ' + (H - 14) + ' H150 M250 ' + (H - 14) + ' H370" stroke="#9fc8ee" stroke-width="2"/>' +
        pine(24, 368, 96, '#1f6a4a') + pine(56, 362, 70, '#27805a') + pine(350, 366, 104, '#1f6a4a') + pine(382, 362, 76, '#27805a') + [[40, 60], [120, 130], [210, 50], [300, 160], [370, 70], [90, 220], [250, 250], [160, 300], [330, 290]].map(q => '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="2.4" fill="#fff"/>').join(''); }
    if (id === 'malvinas') { ground = '#8aa06a'; walk = '#cfd3d2';
      back = cloud(90, 90, 1.2) + cloud(300, 70, 1.1) + cloud(220, 150, 0.9) + '<rect x="-4" y="250" width="408" height="' + (H - 246) + '" fill="#3d6f8f"/><path d="M-4 264 H120 M180 276 H300 M60 292 H200 M260 300 H404" stroke="#8fb4c9" stroke-width="2"/>' +
        '<path d="M-10 ' + H + ' V300 Q70 262 150 300 T300 304 V' + H + ' Z" fill="#6f8a55"/><path d="M230 ' + H + ' V306 Q310 270 410 296 V' + H + ' Z" fill="#7f9a62"/><rect x="336" y="232" width="16" height="62" fill="#fff"/><rect x="336" y="250" width="16" height="12" fill="#e10600"/><rect x="336" y="274" width="16" height="10" fill="#e10600"/><rect x="333" y="220" width="22" height="13" fill="#2a2a33"/><rect x="338" y="223" width="12" height="8" fill="#ffe27a"/><polygon points="' + P([[332, 220], [344, 208], [356, 220]]) + '" fill="#e10600"/>' +
        [[36, 366], [58, 370], [364, 370]].map(q => '<ellipse cx="' + q[0] + '" cy="' + (q[1] - 12) + '" rx="8" ry="13" fill="#1b1b1f"/><ellipse cx="' + q[0] + '" cy="' + (q[1] - 9) + '" rx="5" ry="9" fill="#fff"/><polygon points="' + P([[q[0] - 2, q[1] - 20], [q[0] + 7, q[1] - 18], [q[0] - 2, q[1] - 16]]) + '" fill="#f5a623"/>').join(''); }
    if (o.sign) front += '<rect x="50" y="296" width="5" height="96" fill="#3a3a44"/><rect x="6" y="286" width="94" height="30" rx="5" fill="#101a3a" stroke="#fff" stroke-width="2"/><text x="53" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="9.5" fill="#fff">AV. DE LOS INCAS</text><text x="53" y="311.500" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="8" fill="#ffd23a">4500 ▸ 4600</text>';
    if (o.cinta) front += '<g transform="rotate(-2 200 340)"><rect x="-10" y="326" width="420" height="26" fill="#8f0400"/><rect x="-10" y="322" width="420" height="26" fill="#e10600"/><text x="200" y="340.500" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="14" letter-spacing="4" fill="#fff">GRAN INAUGURACIÓN</text><text x="322" y="346" font-size="30">🎀</text></g>';
    return '<svg class="ep-scene" viewBox="0 -200 400 720" preserveAspectRatio="xMidYMax slice"><defs><linearGradient id="' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + SKY[0] + '"/><stop offset="1" stop-color="' + SKY[1] + '"/></linearGradient></defs><rect x="-4" y="-600" width="408" height="' + (H + 604) + '" fill="' + SKY[0] + '"/><rect x="-4" y="-60" width="408" height="' + (H + 64) + '" fill="url(#' + u + ')"/>' + back +
      '<rect x="-4" y="' + H + '" width="408" height="34" fill="' + ground + '"/><rect x="-4" y="368" width="408" height="38" fill="' + walk + '"/>' + Array.from({ length: 11 }, (_, k) => '<path d="M' + (k * 40) + ' 368 V406" stroke="rgba(0,0,0,.08)" stroke-width="2"/>').join('') + '<rect x="-4" y="406" width="408" height="7" fill="#a9a8a2"/><rect x="-4" y="413" width="408" height="150" fill="#4a4f58"/><path d="M-4 470 H404" stroke="#ffd23a" stroke-width="5" stroke-dasharray="34 22"/>' +
      (id === 'patagonia' ? '<ellipse cx="60" cy="404" rx="46" ry="8" fill="#fff"/><ellipse cx="340" cy="404" rx="52" ry="9" fill="#fff"/>' : '') + '<ellipse cx="200" cy="390" rx="108" ry="8" fill="rgba(0,0,0,.2)"/>' + storeSvg().replace('<svg viewBox="0 0 256 250" class="ep-store">', '<svg x="92" y="184" width="216" height="211" viewBox="0 0 256 250">') + front + '</svg>';
  }
  function epicArt(kind, F) {
    const el = $('epicArt'), me = Object.assign({ skin: GS.SKINS[2], hair: GS.HAIRS[0], hairStyle: 'corto', shirt: 0xe10600 }, GS.Store.get('avatar') || {}), fig = (look, mood, name) => '<figure><div class="pf">' + avatarSvg(look, mood) + '</div>' + (name ? '<figcaption>' + name + '</figcaption>' : '') + '</figure>';
    const conf = () => '<div class="conf">' + Array.from({ length: 34 }, (_, i) => '<i style="left:' + (i * 3 + Math.random() * 3) + '%;background:' + ['#f5c518', '#fff', '#74acdf', '#e10600', '#3bb54a'][i % 5] + ';animation-duration:' + (2.4 + Math.random() * 2.6) + 's;animation-delay:-' + (Math.random() * 4) + 's"></i>').join('') + '</div>';
    GS.Map3D.close();
    if (kind === 'mapa' || kind === 'sur' || kind === 'islas' || kind === 'pais') { el.innerHTML = '<canvas id="epicCv"></canvas>' + (kind === 'sur' ? '' : conf()); const st = mapState(true), mv = kind === 'sur' ? { open: false, can: true } : (kind === 'islas' || kind === 'pais') ? { open: true, stage: 3, flag: true } : { hidden: true }; st.malvinas = mv; GS.Map3D.open($('epicCv'), st, null, kind === 'sur' || kind === 'islas' ? 'malvinas' : null, kind === 'islas'); return; }
    if (kind === 'vs' || kind === 'rival' || kind === 'rivalsad' || kind === 'rivalarc' || kind === 'rivalfut' || kind === 'duelrules') {      /* escenas con el rival de la región: su cara, su marca y su color */
      const rv = RV(epicCtx.id) || RV('pampeana'), lk = warm(rv.look), brand = '<b class="ep-brand" style="--rc:' + rv.col + '"><i>' + rv.mark + '</i>' + rv.name + '<small>' + rv.motto + '</small></b>', bg = 'background:radial-gradient(120% 90% at 50% 28%, ' + rv.col + ', #0b0b0d)';
      if (kind === 'vs') return void (el.innerHTML = '<div class="ep-faces vs duo" style="--rc:' + rv.col + '">' + fig(me, 'angry', 'GameShop') + '<b>VS</b>' + fig(lk, 'angry', rv.owner) + '</div>' + brand);
      if (kind === 'rival') return void (el.innerHTML = '<div class="ep-faces big rvl" style="' + bg + '">' + fig(lk, 'happy') + '</div>' + brand);
      if (kind === 'rivalsad') return void (el.innerHTML = '<div class="ep-faces big rvl" style="' + bg + '">' + fig(lk, rv.villain ? 'angry' : 'sad') + '</div>' + brand + conf());
      if (kind === 'rivalarc') return void (el.innerHTML = (rv.villain ? '<div class="ep-faces big rvl" style="background:linear-gradient(160deg,#26262c,#0b0b0d)">' + fig(lk, 'angry') + '<i class="ep-emo">⛵</i></div>' : '<div class="ep-faces vs duo pals" style="--rc:' + rv.col + '">' + fig(me, 'happy', 'Vos') + '<b class="shake">🤝</b>' + fig(lk, 'happy', rv.owner) + '</div>'));
      if (kind === 'rivalfut') return void (el.innerHTML = '<div class="ep-faces vs duo pals fut" style="--rc:' + rv.col + '">' + fig(me, 'happy') + fig(lk, 'happy') + '<p class="ep-ally"><b>GameShop</b><i>+</i><b style="background:' + rv.col + '">' + rv.mark + ' ' + rv.name + '</b></p></div>' + conf());
      return void (el.innerHTML = '<div class="ep-res">' + [['🏁', 'Más puntos que el rival', 'El marcador de arriba compara tu puntaje con el suyo.'], ['⏱️', 'Más clientes, menos paciencia', 'Atendé rápido y sin errores: las rachas valen mucho.'], ['😠', 'Tres quejas y se pierde', 'Cada cliente que se va y cada tarea vencida es una queja.'], ['🔁', 'Si perdés, hay revancha', 'Es gratis, y cada vez un poco más fácil.']].map(q => '<div><i>' + q[0] + '</i><span><b>' + q[1] + '</b>' + q[2] + '</span></div>').join('') + '</div>');
    }
    if (kind === 'yo') return void (el.innerHTML = '<div class="ep-faces big">' + fig(me, 'happy') + '</div>');
    if (kind === 'equipo0') { const av = Object.assign({ skin: GS.SKINS[2], hair: GS.HAIRS[0], hairStyle: 'corto', shirt: 0xe10600 }, GS.Store.get('avatar') || {}), T = [[av, 'Vos', 'happy'], [{ shirt: 0xe10600, hair: MOHAWK[1], hairStyle: 'mohicano', skin: GS.SKINS[3], glasses: true }, 'Lucho', 'happy'], [{ shirt: 0xe10600, hair: 0x2d6cdf, hairStyle: 'corto', skin: GS.SKINS[0] }, 'Brian', 'normal']];
      return void (el.innerHTML = '<div class="ep-faces trio">' + T.map(q => fig(q[0], q[2], q[1])).join('') + '</div>'); }
    if (kind === 'local') return void (el.innerHTML = '<div class="ep-inaug">' + sceneSvg('pampeana', { sign: 1 }) + '<b class="ep-city"><small>Casa central</small>BUENOS AIRES</b><div class="ep-fila"><div class="pf emp">' + avatarSvg(me, 'happy') + '</div></div></div>');
    if (kind === 'reglas') return void (el.innerHTML = '<div class="ep-res">' + [['👆', 'Tocá los pedidos', 'Aparecen abajo. Tu personaje va solo hasta el mostrador, la caja o donde haga falta.'], ['🎯', 'Dale lo que pidió', 'Con otro producto, el cliente se va y se pierde la venta.'], ['💵', 'Cobrá bien', '10% en efectivo o transferencia, 3 cuotas sin interés. Cobrar mal baja la reputación.']].map(q => '<div><i>' + q[0] + '</i><span><b>' + q[1] + '</b>' + q[2] + '</span></div>').join('') + '<p>En los ratos libres: 🧹 <b>limpiá el piso</b></p></div>');
    if (kind === 'inaug') { const R = RG(epicCtx.id), crew = (brAll()[R.id] || {}).staff || [], ppl = crew.map(cid => R.crew.find(c => c.id === cid)).filter(Boolean).map(c => Object.assign({ shirt: 0xe10600 }, c.look));
      const fila = [{ shirt: 0x2d6cdf, hair: 0x5a2d0c, hairStyle: 'largo', skin: GS.SKINS[1], lashes: true }, { shirt: 0xd9a514, hair: 0x1b1b1f, hairStyle: 'corto', skin: GS.SKINS[3], glasses: true }, { shirt: 0x3bb54a, hair: 0xc9c9d6, hairStyle: 'rodete', skin: GS.SKINS[0] }, { shirt: 0x7b4fd1, hair: 0xb5651d, hairStyle: 'rulos', skin: GS.SKINS[2] }];
      return void (el.innerHTML = '<div class="ep-inaug">' + sceneSvg(R.id, { cinta: 1 }) + '<b class="ep-city' + (R.city.length > 11 ? ' lg' : '') + '"><small>Sucursal ' + R.name + '</small>' + R.city.toUpperCase() + '</b>' +
        '<div class="ep-fila">' + ppl.map(l => '<div class="pf emp">' + avatarSvg(l, 'happy') + '</div>').join('') + fila.map((l, k) => '<div class="pf">' + avatarSvg(l, k % 2 ? 'surprised' : 'happy') + '</div>').join('') + '</div></div>' + conf()); }
    if (kind === 'conq') { el.innerHTML = '<canvas id="epicCv"></canvas><div class="ep-cup"><i>🏆</i></div>' + conf(); GS.Map3D.open($('epicCv'), mapState(), null, epicCtx.id); return; }
    if (kind === 'jefe' || kind === 'jefe2') return void (el.innerHTML = '<div class="ep-faces big boss" style="background:radial-gradient(120% 90% at 50% 30%, #e10600, #5a0000)">' + fig(BOSS_LOOK, kind === 'jefe' ? 'talk' : 'happy') + '</div>');
    if (kind === 'mapa0') { el.innerHTML = '<canvas id="epicCv"></canvas>'; GS.Map3D.open($('epicCv'), mapState(), null); return; }
    if (kind === 'recursos') return void (el.innerHTML = '<div class="ep-res dg">' + expDiagram() + [['⭐', 'Las estrellas suben cuando atendés bien.'], ['🚚', 'La flota se compra con las 🪙 monedas de cada venta.'], ['⚔️', 'Con las dos cosas, desafiás al rival en el día de competencia.']].map(q => '<div><i>' + q[0] + '</i><span>' + q[1] + '</span></div>').join('') + '</div>');
    if (kind === 'dueno') return void (el.innerHTML = '<div class="ep-faces big" style="background:linear-gradient(160deg,#26262c,#0b0b0d)">' + fig(BOSS_LOOK, 'happy') + '</div>' + conf());
    if (kind === 'duelo') return void (el.innerHTML = '<div class="ep-faces vs">' + fig(me, 'angry', 'Vos') + '<b>VS</b>' + fig(PIRATE(), 'angry', 'Capitán Tormenta') + '</div>');
    if (kind === 'equipo') { const all = brAll(), ppl = [[me, 'Vos'], [{ shirt: 0xe10600, hair: MOHAWK[1], hairStyle: 'mohicano', skin: GS.SKINS[3], glasses: true }, 'Lucho'], [{ shirt: 0xe10600, hair: 0x2d6cdf, hairStyle: 'corto', skin: GS.SKINS[0] }, 'Brian']];
      MAIN.forEach(r => { if (r.crew) ((all[r.id] || {}).staff || [r.crew[0].id, r.crew[1].id]).forEach(cid => { const c = r.crew.find(x => x.id === cid); if (c) ppl.push([Object.assign({ shirt: 0xe10600 }, c.look), c.name]); }); });
      return void (el.innerHTML = '<div class="ep-faces sm">' + ppl.map(q => fig(q[0], 'happy', q[1])).join('') + '</div>'); }
    if (kind === 'copa') { const t = statsNow(); return void (el.innerHTML = '<svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet" style="background:#1d0806"><defs><radialGradient id="cg" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#7a1a10"/><stop offset="1" stop-color="#150607"/></radialGradient><linearGradient id="cu" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset=".5" stop-color="#f5c518"/><stop offset="1" stop-color="#b8860b"/></linearGradient></defs><rect width="300" height="300" fill="url(#cg)"/>' +
      Array.from({ length: 12 }, (_, i) => '<path d="M150 135 L' + (150 + Math.cos(i * 0.5236) * 260) + ' ' + (135 + Math.sin(i * 0.5236) * 260) + ' L' + (150 + Math.cos(i * 0.5236 + 0.2) * 260) + ' ' + (135 + Math.sin(i * 0.5236 + 0.2) * 260) + 'z" fill="#f5c518" opacity=".1"/>').join('') +
      '<g class="bobs"><path d="M105 70 H195 V110 Q195 160 150 168 Q105 160 105 110z" fill="url(#cu)"/><path d="M105 82 Q72 82 76 108 Q80 132 108 134" fill="none" stroke="url(#cu)" stroke-width="9"/><path d="M195 82 Q228 82 224 108 Q220 132 192 134" fill="none" stroke="url(#cu)" stroke-width="9"/><rect x="141" y="166" width="18" height="26" fill="url(#cu)"/><rect x="116" y="190" width="68" height="14" rx="4" fill="url(#cu)"/><rect x="106" y="202" width="88" height="16" rx="4" fill="#3a2a1a"/>' +
      '<text x="150" y="128" text-anchor="middle" font-family="Impact, sans-serif" font-size="46" fill="#7a0000">N°1</text></g><text x="150" y="250" text-anchor="middle" font-family="Impact, sans-serif" font-size="22" fill="#fff">⭐⭐⭐⭐⭐ × 5 sucursales</text>' +
      '<text x="150" y="276" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="13" fill="#f5c518">' + (GS.Store.get('days') || 0) + ' jornadas · ' + t.c + ' clientes · ' + U.money(t.sales || 0) + '</text></svg>' + conf()); }
    if (kind === 'barco') {
      const sail = (x, y, w, h) => '<path d="M' + (x - w) + ' ' + y + ' Q' + x + ' ' + (y + h * 0.16) + ' ' + (x + w) + ' ' + y + ' L' + (x + w * 0.86) + ' ' + (y + h) + ' Q' + x + ' ' + (y + h * 1.22) + ' ' + (x - w * 0.86) + ' ' + (y + h) + 'z" fill="url(#sl)"/><path d="M' + (x - w * 0.9) + ' ' + (y + h * 0.5) + ' Q' + x + ' ' + (y + h * 0.68) + ' ' + (x + w * 0.9) + ' ' + (y + h * 0.5) + '" fill="none" stroke="#8a6a48" stroke-width=".6" opacity=".6"/>';
      const waves = (y, a, o, cls) => '<path class="' + cls + '" d="M-60 ' + y + ' ' + Array.from({ length: 14 }, () => 'q15 -' + a + ' 30 0 t30 0').join(' ') + '" fill="none" stroke="#ffd9a0" stroke-width="1.6" opacity="' + o + '"/>';
      return void (el.innerHTML = '<svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice"><defs>' +
        '<linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2458"/><stop offset=".3" stop-color="#8a3f6a"/><stop offset=".52" stop-color="#ee6f3c"/><stop offset=".6" stop-color="#ffc56b"/></linearGradient>' +
        '<linearGradient id="sea2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f29a55"/><stop offset=".12" stop-color="#b8605a"/><stop offset=".4" stop-color="#27507c"/><stop offset="1" stop-color="#0a1c36"/></linearGradient>' +
        '<radialGradient id="sun2" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6d0"/><stop offset=".45" stop-color="#ffd27a"/><stop offset="1" stop-color="#ffb05a" stop-opacity="0"/></radialGradient>' +
        '<linearGradient id="sl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3dc"/><stop offset="1" stop-color="#c49a6c"/></linearGradient>' +
        '<linearGradient id="hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2c1c"/><stop offset="1" stop-color="#1c0f0c"/></linearGradient></defs>' +
        '<rect width="300" height="182" fill="url(#sky2)"/>' + [[70, 22], [205, 38], [120, 52], [250, 14], [36, 60]].map((q, i) => '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + (0.7 + (i % 3) * 0.3) + '" fill="#fff" opacity=".7"/>').join('') +
        '<circle cx="150" cy="172" r="78" fill="url(#sun2)" opacity=".85"/><circle cx="150" cy="172" r="30" fill="#fff1c4"/>' +
        '<g fill="#f7a57a" opacity=".55"><ellipse cx="78" cy="118" rx="44" ry="6"/><ellipse cx="104" cy="126" rx="30" ry="4"/><ellipse cx="226" cy="104" rx="38" ry="5"/><ellipse cx="208" cy="138" rx="46" ry="5"/></g><g fill="#5b2f5e" opacity=".5"><ellipse cx="60" cy="84" rx="50" ry="6"/><ellipse cx="238" cy="72" rx="40" ry="5"/></g>' +
        '<g fill="none" stroke="#2a1a2a" stroke-width="1.4" stroke-linecap="round"><path d="M92 92 q5 -5 10 0 q5 -5 10 0"/><path d="M118 78 q4 -4 8 0 q4 -4 8 0"/><path d="M214 96 q4 -4 8 0 q4 -4 8 0"/></g>' +
        '<rect y="176" width="300" height="124" fill="url(#sea2)"/>' + Array.from({ length: 9 }, (_, i) => '<rect x="' + (150 - 5 - i * 4.4) + '" y="' + (182 + i * 9) + '" width="' + (10 + i * 8.8) + '" height="2.6" rx="1.3" fill="#ffe2a6" opacity="' + (0.85 - i * 0.08) + '"/>').join('') +
        waves(192, 3, 0.35, 'wv1') + waves(208, 4, 0.3, 'wv2') +
        '<g class="sail" style="transform-origin:190px 190px"><g transform="translate(172 190) scale(0.95)"><g class="bobs">' +
          '<path d="M-52 4 H56 L48 10 H-46z" fill="#0a1c36" opacity=".35"/>' +
          '<g stroke="#2a1810" stroke-width="2.2" stroke-linecap="round"><path d="M-22 0 V-62"/><path d="M4 0 V-80"/><path d="M28 0 V-58"/><path d="M40 -8 L72 -22"/></g><g stroke="#2a1810" stroke-width=".7" opacity=".7"><path d="M4 -80 L-44 -12"/><path d="M4 -80 L68 -20"/><path d="M-22 -62 L-46 -14"/><path d="M28 -58 L70 -21"/></g>' +
          sail(-22, -58, 13, 20) + sail(-22, -34, 15, 22) + sail(4, -76, 13, 20) + sail(4, -52, 17, 24) + sail(4, -24, 18, 16) + sail(28, -54, 12, 18) + sail(28, -32, 14, 20) + '<path d="M42 -9 L70 -21 L52 -2z" fill="url(#sl)"/>' +
          '<path d="M4 -80 q10 -5 18 0 q-8 4 -18 8z" fill="#111"/><circle cx="12" cy="-78" r="1.6" fill="#fff"/>' +
          '<path d="M-52 -12 L-50 -26 H-30 V-10 H38 Q46 -10 54 -16 L50 -4 Q44 8 30 9 H-34 Q-46 8 -52 -12z" fill="url(#hl)"/><path d="M-50 -18 H-30" stroke="#f5c518" stroke-width="1.2"/><path d="M-30 -4 H44" stroke="#7a4a2a" stroke-width="1.2"/>' + [-22, -12, -2, 8, 18, 28].map(x => '<rect x="' + x + '" y="0" width="3.4" height="3" rx=".6" fill="#ffd27a"/>').join('') + '<rect x="-46" y="-23" width="4" height="4" fill="#ffd27a"/><rect x="-38" y="-23" width="4" height="4" fill="#ffd27a"/>' +
          '<path d="M-58 8 q-12 2 -26 0 M-56 12 q-16 3 -34 0" fill="none" stroke="#ffe2a6" stroke-width="1.2" opacity=".6"/>' +
        '</g></g></g>' + waves(232, 5, 0.28, 'wv1') + waves(262, 6, 0.22, 'wv2') +
        '<path d="M-10 300 V214 Q10 196 34 204 Q58 198 76 216 Q96 224 104 246 Q116 262 112 300z" fill="#14261e"/><path d="M-10 222 Q14 202 36 210 Q58 204 74 220" fill="none" stroke="#3f6a4a" stroke-width="2"/>' +
        '<g transform="translate(64 152)"><path d="M-5 58 L-3 10 H3 L5 58z" fill="#f4f4f2"/><path d="M-4.300 40 H4.300 L4.700 50 H-4.700z M-3.500 20 H3.500 L3.900 30 H-3.900z" fill="#d8432f"/><rect x="-5" y="4" width="10" height="6" fill="#1b1b1f"/><path d="M-4 4 L0 -3 L4 4z" fill="#1b1b1f"/><path d="M4 7 L70 -8 L70 20z" fill="#fff3c4" opacity=".28"/><circle cx="0" cy="7" r="2.200" fill="#fff3c4"/></g>' +
        '<g transform="translate(74 216)"><rect x="0" y="6" width="26" height="16" fill="#f4f4f2"/><path d="M-3 7 L13 -3 L29 7z" fill="#e10600"/><rect x="10" y="12" width="6" height="10" fill="#23232b"/><rect x="2" y="10" width="5" height="5" fill="#ffd27a"/><rect x="19" y="10" width="5" height="5" fill="#ffd27a"/></g>' +
        [[56, 222], [104, 244]].map(q => '<g transform="translate(' + q[0] + ' ' + q[1] + ')"><ellipse rx="3.400" ry="5.600" fill="#0c0c10"/><ellipse cx=".6" cy="1" rx="2.100" ry="3.800" fill="#fff"/></g>').join('') + '</svg>'); }
    if (kind === 'bandera') return void (el.innerHTML = '<svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="bs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f8fe0"/><stop offset=".62" stop-color="#bfe2fb"/><stop offset=".63" stop-color="#2f6f9c"/><stop offset=".7" stop-color="#3f86b4"/><stop offset=".71" stop-color="#93ad6e"/><stop offset="1" stop-color="#5f7a44"/></linearGradient><radialGradient id="bsun"><stop offset="0" stop-color="#fffbe0"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient></defs><rect width="300" height="300" fill="url(#bs)"/><circle cx="222" cy="54" r="46" fill="url(#bsun)"/><g fill="#fff" opacity=".9"><ellipse cx="70" cy="150" rx="30" ry="8"/><ellipse cx="90" cy="144" rx="20" ry="8"/><ellipse cx="236" cy="120" rx="26" ry="7"/><ellipse cx="218" cy="126" rx="22" ry="6"/></g>' +
      '<g transform="translate(196 150)"><rect x="0" y="34" width="60" height="42" fill="#f4f4f2"/><rect x="-3" y="26" width="66" height="10" fill="#e10600"/><rect x="24" y="52" width="12" height="24" fill="#23232b"/></g><rect x="92" y="40" width="6" height="200" rx="3" fill="#e8e8e8"/><circle cx="95" cy="38" r="6" fill="#f5c518"/>' +
      '<g class="wave" style="transform-box:fill-box"><rect x="98" y="46" width="130" height="28" fill="#74acdf"/><rect x="98" y="74" width="130" height="28" fill="#fff"/><rect x="98" y="102" width="130" height="28" fill="#74acdf"/><circle cx="163" cy="88" r="10" fill="#f5c518"/></g>' +
      [[60, 236], [128, 244], [150, 236]].map((q, i) => '<g transform="translate(' + q[0] + ' ' + q[1] + ')"><ellipse cx="0" cy="0" rx="9" ry="14" fill="#16161a"/><ellipse cx="1" cy="2" rx="6" ry="10" fill="#fff"/><path d="M4 -8 l7 2 l-7 2z" fill="#f5a623"/></g>').join('') + '</svg>' + conf());
    el.innerHTML = '';
  }
  function showEpic(slides, F, navHtml, bind, quiet) {
    let i = 0; $('modal').hidden = true; $('epic').hidden = false; if (!quiet) { A.play('fanfare'); A.setMood('party'); }
    const paint = () => { const sl = slides[i], last = i === slides.length - 1, boss = sl.art === 'dueno' && F && !sl.t;
      $('epicK').textContent = boss ? F.ic + ' Final: ' + F.t : sl.k; $('epicT').textContent = boss ? '"' + F.t + '"' : sl.t; $('epicD').textContent = boss ? F.d : sl.d;
      $('epicDots').innerHTML = slides.length > 1 ? slides.map((_, k) => '<i class="' + (k === i ? 'on' : '') + '"></i>').join('') : '';
      $('epicNav').innerHTML = last ? navHtml : '<button class="btn" id="epicNext">Siguiente</button>';
      if (last) bind(); else $('epicNext').addEventListener('click', () => { A.play('click'); i++; paint(); }); $('epic').scrollTop = 0; epicArt(sl.art, F); };
    paint();
  }
  function closeEpic() { GS.Map3D.close(); $('epic').hidden = true; A.setMood('menu'); }
  const endNav = extra => (extra || '') + '<div class="row"><button class="btn ghost" id="finShare">📸 Compartir</button><button class="btn" id="finNg">Nuevo Juego+</button></div><button class="btn ghost" id="finStay">Seguir en esta partida</button>';
  const endBind = () => { $('finShare').addEventListener('click', () => showCard()); $('finNg').addEventListener('click', () => { closeEpic(); showNgPlus(); }); $('finStay').addEventListener('click', () => { A.play('click'); closeEpic(); }); };
  function showFinal(preview) {
    const st = statsNow(), d = GS.Store.get('days') || 0, F = GS.FINALS.find(f => f.test(st, d)); GS.track('final', { tipo: F.id, jornadas: d });
    showEpic(GS.EPIC.pais, F, endNav('<div class="cta"><b>Esto fue un juego. El local es real.</b><a class="btn alt" href="' + C.links.tienda + '" target="_blank" rel="noopener">Conocé www.gameshop.com.ar</a></div>' + (preview ? '<small style="color:var(--mute)">Vista previa: el final real aparece al cerrar la jornada en la que las 5 sucursales quedan completas.</small>' : '')), endBind);
  }
  // Final oculto: se le ganó a Pirata Gaming, la sucursal de Malvinas quedó completa y se plantó la bandera
  function showFinalM() { GS.track('final', { tipo: 'malvinas', jornadas: GS.Store.get('days') || 0 }); showEpic(GS.EPIC.malvinas, null, endNav(''), endBind); }
  function showNgPlus() {
    GS.Map3D.close();
    modal('<h2>Nuevo Juego+</h2><p>Empezás de nuevo desde Incas, con tus logros, tus premios del Arcade y tu personaje. Elegí cómo:</p><div class="arc2">' + GS.MODS.map(m => '<button data-mod="' + m.id + '"><i>' + m.ic + '</i><b>' + m.name + '</b><small>' + m.d + '</small></button>').join('') + '</div><button class="btn ghost" data-close>Mejor no</button>');
    $('sheet').querySelectorAll('[data-mod]').forEach(b => b.addEventListener('click', () => {
      const keep = {}; ['ach', 'cos', 'arcBest', 'arcade', 'tutorial', 'seen'].forEach(k => { keep[k] = GS.Store.get(k); }); const ng = (GS.Store.get('ngp') || 0) + 1;
      GS.Store.reset(); Object.keys(keep).forEach(k => { if (keep[k] != null) GS.Store.set(k, keep[k]); }); GS.Store.set('ngp', ng); GS.Store.set('mod', b.dataset.mod); GS.Store.set('introSeen', true); GS.Store.set('plotIntro', true);
      GS.track('nuevo_juego_mas', { mod: b.dataset.mod, vuelta: ng }); $('modal').hidden = true; W.clearDirt(); applyBranch(); goHome(); refreshStart(); toast('<b>Nuevo Juego+ ' + ng + '</b>Otra vez desde Incas. Ahora ya sabés cómo es.', '', 3400);
    }));
  }
  const bar = (ic, label, val, k) => '<div class="cq"><i>' + ic + '</i><span><b>' + label + '<em>' + val + '</em></b><span class="pb"><i style="width:' + Math.round(Math.min(1, k) * 100) + '%"></i></span></span></div>';
  const progBox = (id, title) => { const x = brData(id); return '<div class="prog">' + (title ? '<b class="prog-t">' + title + (brProgress(id) >= 100 ? ' · 💎 platino' : conquered(id) ? ' · ✅ conquistada' : '') + '</b>' : '') +
    bar('⭐', 'Reputación', repTxt(x.rep) + ' de 5', x.rep / 4.8) + bar('🚚', 'Logística', ['sin flota', 'moto', 'camioneta', 'camión'][x.flota], x.flota / 3) + bar('🛠', 'Mejoras del local', x.have + ' de ' + x.tot, x.have / x.tot) + bar('📖', 'Historias de clientes', x.sd + ' de ' + x.st, x.st ? x.sd / x.st : 1) + '</div>'; };
  function showDuelIntro(then) {
    const id = brId(), rv = RV(id), b = brNow(), edge = Math.min(5, b.edge || 0); epicCtx = { id };
    showEpic([{ art: 'vs', k: (b.tries ? 'Revancha · ' : 'Día de competencia · ') + RG(id).city, t: 'GameShop contra ' + rv.name, d: rv.pre },
      { art: 'duelrules', k: 'Cómo se gana', t: 'Más puntos que ' + rv.owner, d: 'Hoy entran más clientes y esperan menos. Arriba vas a ver tu puntaje contra el de ' + rv.name + '.' + (edge ? ' Llegás con ventaja por tus medallas de oro.' : '') + (b.tries ? ' En la revancha ' + rv.owner + ' viene confiado: es un poco más fácil ganarle.' : '') }], null,
      '<button class="btn" id="duGo">⚔️ A competir</button><button class="btn ghost" id="duNo">Todavía no</button>', () => { $('duGo').addEventListener('click', () => { A.play('click'); closeEpic(); then(); }); $('duNo').addEventListener('click', () => { A.play('click'); closeEpic(); }); });
  }
  function showDuelEnd(res, after) {
    const id = brId(), rv = res.rv; epicCtx = { id };
    if (res.win) return showEpic([{ art: 'rivalsad', k: 'Día de competencia · ' + rv.name, t: '¡Le ganaste a ' + rv.owner + '!', d: '"' + rv.win + '"' }, { art: 'rivalarc', k: rv.villain ? 'Y el Capitán...' : rv.owner + ' · ' + rv.name, t: rv.villain ? 'Se fue como vino' : rv.arcT, d: rv.arc }].concat(rv.villain ? [] : [{ art: 'rivalfut', k: 'Un tiempo después', t: rv.futT, d: rv.fut }]), null,
      '<button class="btn" id="duOk">Seguir</button>', () => $('duOk').addEventListener('click', () => { A.play('click'); closeEpic(); after(); }));
    showEpic([{ art: 'rival', k: 'Día de competencia · ' + rv.name, t: res.why === 'quejas' ? 'Tres quejas, y se fueron enfrente' : 'Hoy ganó ' + rv.owner, d: '"' + rv.gloat + '" ' + (res.why === 'quejas' ? '' : 'Fueron ' + Math.round(res.him - res.me).toLocaleString('es-AR') + ' puntos de diferencia. ') + 'La revancha es gratis.' }], null,
      '<button class="btn" id="duRe">🔁 Jugar la revancha</button><button class="btn ghost" id="duLater">Más tarde</button>', () => { $('duRe').addEventListener('click', () => { closeEpic(); startDay(false, true); }); $('duLater').addEventListener('click', () => { A.play('click'); closeEpic(); after(); }); }, true);
  }
  function checkConquest() {
    const id = brId(), b = brNow(); if (b.cqSeen || !conquered(id) || state === 'day') return false;
    const g = goalNow(), others = pendingOpen(), ready = g && canExpand();
    brSave({ cqSeen: 1 }); const x = brData(id), R = RG(id), left = x.have < x.tot || x.sd < x.st; GS.track('region_conquistada', { id }); epicCtx = { id };
    showEpic([{ art: 'conq', k: 'Región ' + R.name + ' conquistada', t: '¡' + R.city + ' es nuestra!', d: 'Cinco estrellas, flota propia y ' + R.rival.name + ' vencido en buena ley. ' +
      (ready ? 'Es hora de abrir una sucursal nueva, donde vos elijas.' : !g ? 'Con esta, GameShop ya está en todas las regiones.' : 'Para abrir otra sucursal falta conquistar también ' + others.map(o => o.city).join(' y ') + '.') }], null,
      progBox(id) + '<small class="epic-note">' + (left ? 'Lo que falta no frena la expansión: sirve para dejar esta sucursal en 💎 platino.' : '💎 Y además la dejaste en platino: no le falta nada.') + '</small>' +
      '<button class="btn" id="cqMap">🗺️ Ver el mapa de sucursales</button>' + (left ? '<button class="btn ghost" id="cqStay">Seguir y completar esta zona</button>' : ''),
      () => { $('cqMap').addEventListener('click', () => { closeEpic(); showMap(); }); if ($('cqStay')) $('cqStay').addEventListener('click', () => { A.play('click'); closeEpic(); }); });
    return true;
  }
  /* Enseñarle al equipo: una clase cortita en el Taller, el único lugar del local por donde no pasan clientes ni hay muebles que se compren.
     Vos explicás con la pizarra, ellos escuchan, y al final festejan. */
  const CLASS = { yo: [7.15, 6.95], board: [8.45, 6.5, 0.66], seats: [[8.15, 8.05, 2.95], [9.0, 7.72, 3.56]], zin: [[6.0, 5.5], [7.3, 5.9]], side: [7.15, 7.7], cam: [8.0, 6.9, 0.4] };
  function routeToClass(x, z) {                 /* por dónde llega cada uno al Taller, según dónde lo agarró la clase */
    const hall = [[4.0, 0.9], [4.0, 5.5]];
    if (x > 6.5 && z > 3.9) return [];                                                                          /* ya está en el taller */
    if (x > 5.7 && z < -1.5) return [[7.4, -4.4], [6.0, -4.4], [4.6, -4.4], [4.5, -1.2]].concat(hall, CLASS.zin); /* depósito */
    if (z < -3.2) return [[4.0, -5.3], [4.6, -4.4], [4.5, -1.2]].concat(hall, CLASS.zin);                         /* detrás del mostrador */
    if (z > 5.0) return [[-0.3, 5.5], [4.0, 5.5]].concat(CLASS.zin);                                             /* galería y vidriera */
    if (x < 3.0) return [[-0.6, -1.6], [4.5, -1.2]].concat(hall, CLASS.zin);                                     /* salón */
    return hall.concat(CLASS.zin);
  }
  function teach() {
    const t = brNow().train || 0, yo = W.player(); day.taught = 1; day.jobSig = ''; brSave({ train: t + 1 }); A.play('click');
    const ls = day.lesson = { t: 0, ph: 0, lv: t + 1, who: t % 2, yoIn: false, inN: 0 }; W.zoomAt(CLASS.cam[0], CLASS.cam[1], CLASS.cam[2]);
    STAFF.forEach((st, i) => { const P = st.p, g = P.group.position, seat = CLASS.seats[i]; P.lie(false); P.carry(false); if (P.phone) P.phone(false); st.q = []; st.act = null; st.moving = false; st.busy = true; if (st.spd0 == null) st.spd0 = P.speed; P.speed = yo.speed || 7.5;
      P.walk(routeToClass(g.x, g.z).concat([CLASS.side], i ? [[8.5, 8.1]] : [], [[seat[0], seat[1]]]), () => { if (day.lesson === ls) { P.face(seat[2]); ls.inN++; } }); });
    yoGo('T2', () => { if (day.lesson !== ls) return; yo.walk([CLASS.yo], () => { if (day.lesson === ls) { yo.face(0); ls.yoIn = true; } }); });
  }
  function endLesson(cut) {
    const ls = day && day.lesson; if (!ls) return; day.lesson = null; const yo = W.player();
    W.lesson(false); if (!cut) W.focus(); if (yo) { yo.gest(false); if (ls.yoIn) { yoAt = 'T2'; yoFree = true; } }
    STAFF.forEach(st => { if (st.spd0 != null) { st.p.speed = st.spd0; st.spd0 = null; } st.p.nod(false); st.p.idea(false); st.busy = false; st.moving = false; const home = [CLASS.side, [7.3, 5.9], [6.0, 5.5], [4.0, 5.5], st.hub]; st.q = cut ? [['wait', 0.4], ['go', home]] : [['wait', 1.6], ['go', home], ['wait', 2]]; });
    if (cut) { fx('🎓 Equipo nivel ' + ls.lv); day.score += 60; }
  }
  function updateLesson(dt) {
    const ls = day.lesson; if (!ls) return; ls.t += dt; const yo = W.player();
    if (ls.ph === 0) { if ((ls.yoIn && ls.inN >= 2) || (ls.yoIn && ls.t > 13) || ls.t > 18) { ls.ph = 1; ls.t = 0; W.lesson(true, CLASS.board[0], CLASS.board[1], CLASS.board[2]); A.play('pick'); yo.face(0.95); yo.gest(true); STAFF.forEach((st, i) => { if (!st.p.moving) st.p.face(CLASS.seats[i][2]); st.p.nod(true); }); sayAt(yo, U.pick(LN.teachYo), 2600); } }
    else if (ls.ph === 1 && ls.t > 2.9) { ls.ph = 2; STAFF.forEach(st => st.p.idea(true)); A.play('intr'); sayAt(STAFF[ls.who].p, U.pick(LN.teach), 2200); }
    else if (ls.ph === 2 && ls.t > 5.0) { ls.ph = 3; yo.gest(false); STAFF.forEach(st => { st.p.nod(false); st.p.hop(1.0); }); yo.hop(0.7); A.play('ok'); fx('🎓 Equipo nivel ' + ls.lv); day.score += 60; }
    else if (ls.ph === 3 && ls.t > 6.3) endLesson(false);
  }
  /* ---------------- VISITAS CON HISTORIA: clientes que vuelven, con decisiones chiquitas que dejan marca ---------------- */
  const histAll = () => GS.Store.get('hist') || {};
  function dueStories(n) {
    const h = histAll(), out = [];
    for (const S of GS.STORIES) {
      const st = h[S.id]; if (st && st.done) continue; if ((S.reg || 'pampeana') !== brId()) continue;
      if ((S.reg ? (brNow().days || 0) + 1 : n) < S.from || (st && st.last && n < st.last + (S.gap || 1))) continue;
      if (S.once && Math.random() > 0.45) continue;
      out.push(S);
    }
    return U.shuffle(out).sort((a, b) => (a.once ? 1 : 0) - (b.once ? 1 : 0)).slice(0, n < 4 ? 1 : 2);
  }
  function spawnVisit(S) {
    const rvV = /^rival_/.test(S.id) ? RV(brId()) : null, slot = rvV ? -1 : freeSlot('slotM', L.colaMostrador.length);
    if ((!rvV && slot < 0) || day.closing) { if (!day.closing) { day.queue.push({ kind: 'v', v: S, t: 4 }); day.queue.sort((a, b) => a.t - b.t); } return; }
    const look = warm(Object.assign({ skin: 0xe0ac7e }, S.look)), person = W.makePerson(look), dx = L.puerta.x;
    person.voice = 240 + S.id.length * 30; person.setPos(dx, L.galeria.zMax + 2.4); person.aura(S.id.indexOf('rival_') === 0 && RV(brId()) ? RV(brId()).col : 0xf5c518);
    const cu = { id: ++uid, arche: { id: S.id, name: S.name, tag: S.tag, face: '📖', bye: '', lost: '' }, look, story: S, rv: rvV, st: 'entering', pat: 1, person, slotM: slot, slotC: -1, label: makeLabel(rvV ? rvV.mark : '📖') };
    day.customers.push(cu);
    if (rvV) { const d = day, at = [dx + 1.15, 1.8];      /* el rival no hace la cola: se planta en el medio del salón, mira a la pantalla y la cámara va con él */
      person.walk([[dx, L.salon.zMax + 0.2], [dx, at[1]], at], () => { if (day !== d) return; cu.st = 'waitM'; person.face(GS.CONFIG.camera.rot * Math.PI / 180); A.play('speaker');
        toast('<b>' + rvV.mark + ' ' + rvV.owner + ' entró al local</b>' + rvV.name + ' · quiere hablar con vos.', 'rival', 4200, false, rvV.col);
        if (!MG.isOpen() && !paused) W.zoomAt(at[0], at[1], 0.4);
        sayAt(person, rvV.hi, 0, 'riv', false, false, () => { if (day !== d || cu.st !== 'waitM' || state !== 'day') return; if (!MG.isOpen() && !paused) openStory(cu); }, rvV); }); }
    else toCounter(cu, [[dx, L.salon.zMax + 0.2]]); setTimeout(() => A.play('bell'), 900);
  }
  function openStory(cu) {
    const S = cu.story, h = histAll(), st = h[S.id] || { step: 0, flags: {}, notes: [] }, real = S.steps[st.step], gf = GS.Store.get('gflags') || {};
    const waiting = !!(real.need && !gf[real.need] && !(real.waitMax && (st.waits || 0) >= real.waitMax)), step = waiting ? real.wait : real, alt = step.alt && st.flags[step.alt.flag] ? step.alt : null;
    const text = alt ? alt.t : step.t, mood = alt ? alt.m : step.m; let chosen = false;
    A.unlock(); A.play('click'); cu.st = 'inM'; paused = true; if (cu.rv) W.zoomAt(cu.person.group.position.x + 2.0, cu.person.group.position.z + 2.6, 0.36); else { yoGo('most'); focusFor('mostrador'); } A.babble(text, cu.person.voice);
    const faceBox = m => '<div class="st-face">' + avatarSvg(cu.look, m) + '</div>';
    const stCls = cu.rv ? '<div class="story rv" style="--rc:' + cu.rv.col + '"><em class="st-brand">' + cu.rv.mark + ' ' + cu.rv.name + '</em>' : '<div class="story">';
    modal(stCls + '<div class="st-head">' + faceBox(mood) + '<div><b>' + S.name + '</b><span>' + S.tag + (st.step ? ' · vez ' + (st.step + 1) : '') + '</span></div></div>' +
      '<div class="bubble">' + text + '</div>' + step.opts.map((o, i) => '<button class="btn ghost st-opt" data-o="' + i + '">' + o.b + '</button>').join('') + '</div>', () => {
      paused = false; W.focus(null); $('modal').classList.remove('low');
      if (!chosen) { cu.st = 'waitM'; return; }
      cu.slotM = -1; leave(cu, false);
    });
    $('modal').classList.toggle('low', !!cu.rv);
    $('sheet').querySelectorAll('[data-o]').forEach(b => b.addEventListener('click', () => {
      const o = step.opts[Number(b.dataset.o)], fx = o.fx || {}, chips = []; chosen = true;
      if (fx.rep) { addRep(fx.rep); chips.push((fx.rep > 0 ? '▲' : '▼') + ' Reputación'); }
      if (fx.fondo) { addFondo(fx.fondo); chips.push((fx.fondo > 0 ? '+' : '−') + ' 🪙 ' + Math.abs(fx.fondo) + ' monedas'); }
      if (fx.cord) { addCord(fx.cord); chips.push((fx.cord > 0 ? '▲' : '▼') + ' Cordura'); }
      if (fx.goal) { GS.Store.set('goalAdj', (GS.Store.get('goalAdj') || 0) + fx.goal); chips.push(fx.goal < 0 ? '🏠 El local de al lado sale más barato' : '🏠 El local de al lado se encarece'); }
      if (fx.flag) st.flags[fx.flag] = 1;
      if (fx.gflag) { gf[fx.gflag] = 1; GS.Store.set('gflags', gf); }
      st.last = day.n; day.moment = S.name + ': "' + o.r + '"';
      if (S.steps[st.step] && S.steps[st.step].end && /^rival_/.test(S.id)) setTimeout(() => { const rv = RV(brId()); toast('<b>' + rv.mark + ' Duelo pactado con ' + rv.name + '</b>Con 5 estrellas y la flota completa llega el día de competencia.', 'rival', 6000, false, rv.col); }, 1800);
      if (waiting) st.waits = (st.waits || 0) + 1;                 // todavía falta algo que depende de otra historia: vuelve más adelante
      else if (!o.stay) { st.step++; st.notes.push(o.note || step.note); if (step.end || st.step >= S.steps.length) st.done = true; }
      h[S.id] = st; GS.Store.set('hist', h); GS.track('visita', { quien: S.id, paso: st.step }); A.play(fx.rep < 0 || fx.fondo < 0 ? 'error' : 'ok'); A.babble(o.r, cu.person.voice);
      $('sheet').innerHTML = stCls + '<div class="st-head">' + faceBox(o.rm || 'normal') + '<div><b>' + S.name + '</b><span>' + (st.done ? 'Historia cerrada · quedó en tu libreta' : 'Dijo que vuelve · quedó en tu libreta') + '</span></div></div>' +
        '<div class="bubble">' + o.r + '</div><div class="st-chips">' + chips.map(c => '<span>' + c + '</span>').join('') + '</div><button class="btn" data-close>Seguir</button></div>';
      $('sheet').querySelector('[data-close]').addEventListener('click', closeModal);
    }));
  }
  function showLibreta() {
    const h = histAll(), known = GS.STORIES.filter(S => h[S.id]), unk = GS.STORIES.length - known.length, wasDay = state === 'day'; if (wasDay) paused = true;
    A.unlock(); A.play('click');
    modal('<div class="gold-h"><i></i><b>Tu libreta</b><i></i></div><p style="font-size:13.5px;color:var(--mute);margin:0 0 4px">Acá quedan anotados los clientes con historia. Cerrar sus historias suma reputación, a veces monedas, y cuenta para dejar la sucursal en 💎 platino.</p>' +
      (known.length ? known.map(S => { const st = h[S.id]; return '<div class="lib"><div class="lib-face">' + avatarSvg(Object.assign({ skin: 0xe0ac7e }, S.look), st.done ? 'happy' : 'normal') + '</div><div><b>' + S.name + '</b> <em>' + S.tag + '</em><ul>' + st.notes.map(n => '<li>' + n + '</li>').join('') + '</ul><small>' + (st.done ? '✔ Historia cerrada' : '… Dijo que vuelve') + '</small></div></div>'; }).join('') : '<p>Todavía no anotaste a nadie. Hay clientes que vuelven: cuando alguien quiera hablar, vas a ver una 📖 en los pedidos.</p>') +
      (unk ? '<p style="font-size:13.5px;color:var(--mute);margin:0">Te falta conocer a ' + unk + (unk === 1 ? ' persona.' : ' personas.') + '</p>' : '') + '<button class="btn" data-close>Cerrar</button>', () => { if (wasDay) paused = false; });
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
    toast('<b>' + st.icon + ' ' + st.name + '</b>' + st.task.name + '. Cuando puedas.', '', 2200, true);
  }
  function freeSlot(key, n) {
    for (let i = 0; i < n; i++) if (!day.customers.some(c => c[key] === i && c.st !== 'leaving')) return i;
    return -1;
  }
  // Limpieza: los clientes dejan manchas; se limpian en los ratos libres. Terminar con el piso sucio baja la reputación.
  function dropDirt() {
    if (!day || day.arcade || day.dirt >= 5 || Math.random() > (upNow().plantas ? 0.22 : 0.45)) return;
    coach('mancha'); day.dirt++; day.jobSig = ''; { const x = U.rnd(-3.6, 0.6), z = U.rnd(-2.0, 4.6); day.dirtPos.push([x, z]); W.addDirt(x, z); }
  }
  // Limpiar: el personaje va con la mopa hasta cada mancha, la friega un momento y sigue con la próxima
  function mopNext() {
    const yo = W.player(); if (!day || !day.mopping) return;
    if (!day.dirtPos.length) { day.mopping = false; yo.mop(false); day.jobSig = ''; yoGo('most'); return; }
    const q = day.dirtPos[0]; yoWalkTo(q[0] - 0.35, q[1] - 0.35, () => { if (day && day.mopping) { yo.face(Math.PI / 4); day.mopT = 1.1; } });
  }
  function mopTick(dt) {
    if (!day.mopping || day.mopT <= 0) return; day.mopT -= dt; W.player().mopTick(day.t);
    if (day.mopT <= 0) { day.dirtPos.shift(); W.removeDirt(); day.dirt = Math.max(0, day.dirt - 1); day.cleaned++; day.score += 25; addRep(0.015); A.play('ok'); fx('🧹 +25'); day.jobSig = ''; mopNext(); }
  }
  function stopMop() { if (day && day.mopping) { day.mopping = false; day.mopT = 0; W.player().mop(false); } }
  function cleanUp() {
    if (!day.dirt || day.mopping) return; day.mopping = true; day.jobSig = ''; W.player().mop(true); A.play('click'); mopNext();
  }
  function leave(cu, withBag) {
    if (!cu.story && cu.st !== 'entering') dropDirt();
    cu.st = 'leaving'; cu.slotM = -1; cu.slotC = -1; cu.label.hidden = true; cu.person.bag(!!withBag);
    const dx = L.puerta.x, d = day;
    cu.person.walk((cu.rv ? [[dx, 1.8]] : [[dx, -1.2]]).concat([[dx, L.salon.zMax + 0.2], [dx + U.rnd(-2, 2), L.galeria.zMax + 3]]), () => {
      cu.person.remove(); cu.label.remove(); const i = d.customers.indexOf(cu); if (i >= 0) d.customers.splice(i, 1);
    });
  }
  function removeTask(task) { task.label.remove(); if (task.boxes) task.boxes.remove(); const i = day.tasks.indexOf(task); if (i >= 0) day.tasks.splice(i, 1); }

  // Números que suben: respuesta inmediata a cada cosa que pasa
  function fx(text, cls) {
    const el = document.createElement('div'); el.className = 'fx ' + (cls || ''); el.textContent = text; el.style.left = (38 + Math.random() * 24) + '%';
    $('fxs').appendChild(el); setTimeout(() => el.remove(), 1300);
  }
  function addScore(base, pat) {
    const mult = (1 + Math.min(day.combo, 8) * 0.25) * (!day.arcade && day.cord >= CD.focus ? 1.1 : 1), pts = Math.round((base + Math.max(0, pat) * 100) * mult);
    addCord(day.combo >= 2 ? 0.6 + CD.streak : 0.6);
    day.score += pts; day.combo++; day.bestCombo = Math.max(day.bestCombo, day.combo);
    fx('+' + pts + (day.combo > 1 ? '  x' + day.combo : ''));
    if (day.combo > 1) A.play('combo', day.combo);
  }
  function breakCombo() { day.combo = 0; }

  /* Trabajos pendientes: clientes en mostrador, clientes en caja y tareas de las otras estaciones */
  function pendingJobs() {
    const jobs = [];
    for (const c of day.customers) {
      if (c.st === 'waitM' && c.story) jobs.push({ key: 'c' + c.id, type: 'historia', ref: c, pat: 1, icon: c.rv ? c.rv.mark : '💬', title: c.rv ? c.arche.name : 'Mostrador · ' + c.arche.name, sub: c.rv ? 'Quiere hablar con vos' : c.arche.tag });
      else if (c.st === 'waitM') jobs.push({ key: 'c' + c.id, type: 'mostrador', ref: c, pat: c.pat, icon: '🛎', title: 'Mostrador', sub: 'Atender a ' + c.arche.name });
      else if (c.st === 'waitC') jobs.push({ key: 'c' + c.id + 'k', type: 'caja', ref: c, pat: c.pat, icon: '💵', title: 'Caja', sub: 'Cobrar a ' + c.arche.name });
    }
    for (const t of day.tasks) if (t.st === 'wait') jobs.push({ key: 't' + t.id, type: t.station.id, ref: t, pat: t.pat, icon: t.station.icon, title: t.station.short || t.station.name, sub: t.station.task.name });
    if (brId() !== 'pampeana' && !day.arcade && !day.taught && (brNow().train || 0) < 3 && day.stage === 'rest' && day.wave >= 0) jobs.push({ key: 'teach', type: 'ensenar', ref: null, pat: 1, icon: '🎓', title: 'Enseñarle al equipo', sub: 'Nivel ' + (brNow().train || 0) + ' de 3 · después resuelven tareas solos' });
    if (day.dirt && !day.mopping && !day.arcade && (day.stage === 'rest' || !jobs.length || day.dirt >= 3)) jobs.push({ key: 'dirt' + day.dirt, type: 'limpiar', ref: null, pat: 1, icon: '🧹', title: 'Limpiar el piso', sub: day.dirt + (day.dirt === 1 ? ' mancha' : ' manchas') + ' · un toque y listo' });
    return jobs.sort((a, b) => a.pat - b.pat);
  }
  /* ---------------- Tu personaje camina solo hasta cada tarea, por los pasillos y las puertas ----------------
     NAV es un arbolito de puntos de paso: [x, z, punto anterior, hacia dónde mira al llegar]. Para ir de un lugar a otro
     sube hasta el punto en común y baja. Si lo mandás a otro lado mientras camina, sigue desde el punto al que iba. */
  const NAV = { O: [4.5, -1.2, null], A: [4.6, -4.4, 'O'], X: [4.0, -4.9, 'A'], caja: [L.yoCaja[0], L.yoCaja[1], 'X', 0], most: [L.yoMostrador[0], L.yoMostrador[1], 'caja', 0], wa: [-3.8, -4.9, 'most', 0],
    prov: [4.3, -5.5, 'X', 1.2], ml: [4.5, -2.3, 'O', 1.57], DD: [6.0, -4.4, 'A'], D1: [7.4, -4.4, 'DD'], repo: [8.3, -4.4, 'D1', 3.14],
    H: [4.0, 0.9, 'O'], T1: [4.0, 5.5, 'H'], TD: [6.0, 5.5, 'T1'], T2: [7.3, 5.9, 'TD'], service: [8.7, 5.65, 'T2', 3.14], pc: [10.1, 6.15, 'T2', 0], G: [-0.3, 5.5, 'T1'], vid: [0.6, 7.3, 'G', 1.57] };
  const NODE_OF = { mostrador: 'most', devol: 'most', whatsapp: 'wa', stock: 'wa', caja: 'caja', cierre: 'caja', adornos: 'H', ml: 'ml', proveedor: 'prov', repo: 'repo', service: 'service', pc: 'pc', vidriera: 'vid' };
  let yoAt = 'most', yoRoute = [], yoFree = false, yoDone = null;      // yoFree: está parado fuera de los nodos (caminó a un punto libre)
  const navChain = n => { const c = []; while (n) { c.push(n); n = NAV[n][2]; } return c; };
  function yoEnd(n) { const yo = W.player(); if (NAV[n][3] != null) yo.face(NAV[n][3]); const f = yoDone; yoDone = null; if (f) f(); }
  function yoGo(target, done) {
    const yo = W.player(); if (!yo || !NAV[target]) return; yoDone = done || null;
    const moving = yoRoute.length > 0, from = moving ? yoRoute[0] : yoAt, a = navChain(from), b = navChain(target); let lca = null;
    while (a.length && b.length && a[a.length - 1] === b[b.length - 1]) { lca = a.pop(); b.pop(); }
    yoRoute = a.concat([lca], b.reverse()); if (yoRoute[0] !== from) yoRoute.unshift(from);
    if (!moving) { if (!yoFree) yoRoute.shift(); yoFree = false; if (yoRoute.length) yoStep(); else yoEnd(target); }      // si estaba suelto, primero vuelve al nodo más cercano
  }
  function yoStep() {
    const yo = W.player(), n = yoRoute[0];
    yo.walk([[NAV[n][0], NAV[n][1]]], () => { yoAt = n; yoRoute.shift(); if (yoRoute.length) yoStep(); else yoEnd(n); });
  }
  // Caminar a un punto libre del local: por los pasillos hasta el nodo más cercano (nunca a través del mostrador) y de ahí derecho
  const WALK = ['O', 'H', 'T1', 'G'];
  // Zona caminable: salón (delante del mostrador), pasillo de entrada y vereda, sin los muebles grandes que haya comprados
  function walkable(x, z) {
    const s = L.salon, area = (x > s.xMin + 0.6 && x < s.xMax - 0.5 && z > L.mostrador.z + 1.3 && z < s.zMax - 0.2) || (Math.abs(x - L.puerta.x) < 1.3 && z >= s.zMax - 0.2 && z < L.galeria.zMax + 0.2) || (z >= L.galeria.zMax + 0.2 && z < L.galeria.zMax + 3.7 && x > -11 && x < 14);
    if (!area) return false; const u = upNow(); return !GS.UPGRADES.some(g => u[g.id] && (GS.FLOOR.indexOf(g.id) >= 0 ? Math.abs(x - slotOf(g.id).x) < 1.35 && z > slotOf(g.id).z - 0.85 && z < slotOf(g.id).z + (g.id === 'escritorio' ? 1.35 : 0.85) : ['gondola', 'arcade'].indexOf(g.id) >= 0 && Math.hypot(x - g.pos[0], z - g.pos[1]) < 1.25));
  }
  const clearLine = (x0, z0, x1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.3); for (let i = 0; i <= n; i++) if (!walkable(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n)) return false; return true; };
  function yoWalkTo(x, z, cb) {
    const yo = W.player(); if (!yo) return; const P = yo.group.position;
    // que no termine parado encima de un compañero o de un cliente
    { const ppl = W.staff().map(p => p.group.position).concat(day ? day.customers.map(c => c.person.group.position) : []); for (const q of ppl) { const d = Math.hypot(x - q.x, z - q.z); if (d < 0.85) { const ax = d > 0.05 ? (x - q.x) / d : 1, az = d > 0.05 ? (z - q.z) / d : 0; x = q.x + ax * 0.95; z = q.z + az * 0.95; } } }
    const near = n0 => { let b = WALK[0], bd = 1e9; WALK.forEach(n => { const d = Math.hypot(NAV[n][0] - n0[0], NAV[n][1] - n0[1]); if (d < bd) { bd = d; b = n; } }); return b; };
    if (!yoRoute.length && clearLine(P.x, P.z, x, z)) { yoFree = true; yoDone = null; yoAt = near([x, z]); yo.walk([[x, z]], () => { if (cb) cb(); }); return; }      // sin nada grande en el medio: va derecho
    let best = WALK[0], bd = 1e9; const from = yoRoute.length ? yoRoute[0] : yoAt;
    const navLen = to => { const a = navChain(from), b = navChain(to); let l = null; while (a.length && b.length && a[a.length - 1] === b[b.length - 1]) { l = a.pop(); b.pop(); } const r = a.concat([l], b.reverse()); let d = 0; for (let i = 1; i < r.length; i++) d += Math.hypot(NAV[r[i]][0] - NAV[r[i - 1]][0], NAV[r[i]][1] - NAV[r[i - 1]][1]); return d; };
    WALK.forEach(n => { const d = navLen(n) * 0.6 + Math.hypot(NAV[n][0] - x, NAV[n][1] - z) + (clearLine(NAV[n][0], NAV[n][1], x, z) ? 0 : 6); if (d < bd) { bd = d; best = n; } });      // si hay que rodear algo, por el nodo que deje el último tramo despejado
    yoGo(best, () => { yoFree = true; yoAt = near([x, z]); yo.walk([[x, z]], () => { if (cb) cb(); }); });
  }
  function groundTap(x, z) {
    if (state !== 'day' || !day || day.arcade || paused || MG.isOpen() || day.mopping || day.closing) return;
    if (!walkable(x, z)) return; W.ping(x, z); A.play('click'); yoWalkTo(x, z);
  }
  function focusFor(type) {
    const land = window.innerWidth > window.innerHeight && window.innerHeight <= 560;
    W.focus(type, land ? 0 : 0.27, land ? 0.25 : 0);
  }
  function openStation(type) {       // toque sobre una estación en el 3D
    if (state !== 'day' || !day || day.arcade) return;
    const job = pendingJobs().find(j => j.type === type);
    if (!job) { if (!MG.isOpen() && !paused && !day.mopping && NODE_OF[type]) yoGo(NODE_OF[type]); return; }      // sin nada pendiente, igual se puede ir hasta ahí
    openJob(job);
  }
  function openJob(job) {
    if (state !== 'day' || paused || MG.isOpen() || day.closing || day.beat > 0) return;
    if (job.type !== 'limpiar') stopMop();
    if (job.type === 'historia') return openStory(job.ref);
    if (job.type === 'limpiar') return cleanUp();
    if (job.type === 'ensenar') { if (!day.lesson) teach(); return; }
    if (day.lesson) endLesson(true);
    A.unlock(); A.play('click');
    const ref = job.ref, isCust = job.type === 'mostrador' || job.type === 'caja';
    ref.st = isCust ? (job.type === 'mostrador' ? 'inM' : 'inC') : 'in'; ref.pat = Math.max(ref.pat, 0.55);
    focusFor(job.type);
    yoGo(NODE_OF[job.type]);
    const mt = day.mt = day.mt || {}, m0 = day.tt || 0, me = mt[job.type] = mt[job.type] || { n: 0, s: 0, e: 0 }; me.n++;
    const cb = {
      onMistake(kind) { me.e++; day.wv.mistakes = (day.wv.mistakes || 0) + 1; breakCombo(); addRep(kind === 'caja' ? -0.07 : -0.03); fx(kind === 'caja' ? '−⭐  −🪙' : '−⭐', 'bad'); if (kind === 'caja') { day.cajaErr++; day.coinLoss = (day.coinLoss || 0) + 15; } else day.otherErr++; if (!day.relaxed) ref.pat = Math.max(0.05, ref.pat - C.day.mistakeCost); },
      onEnd(ok, info) {
        me.s += (day.tt || 0) - m0;
        if (job.type !== 'caja') W.focus(null);
        if (job.type === 'mostrador' && !ok) {            // producto equivocado: se va y se pierde la venta
          day.lostSale = (day.lostSale || 0) + 1; day.wv.lost = 1; duelQueja(); addRep(-0.1); ref.slotM = -1; sayAt(ref.person, U.pick(LN.lostSale), 0); day.beat = 1.2; leave(ref, false); return;
        }
        if (job.type === 'mostrador') {
          addScore(100, ref.pat); addRep(0.02); { const v = GS.Store.get('vid') || 0, saw = Math.random() < v * 0.7 + (upNow().vidluz ? 0.15 : 0); if (saw) addRep(0.02); sayAt(ref.person, saw ? U.pick(LN.sawWindow) : '¡Eso! Voy a la caja.', saw ? 3000 : 1900); } ref.st = 'toCaja'; ref.slotM = -1; ref.pat = Math.max(ref.pat, 0.8);
          ref.slotC = Math.max(0, freeSlot('slotC', L.colaCaja.length));
          ref.person.walk([[Math.min(ref.person.group.position.x + 0.8, 1.6), -2.1], L.colaCaja[ref.slotC]], () => { ref.st = 'waitC'; ref.person.face(Math.PI); });
        } else if (job.type === 'caja') {
          day.served++; day.wv.served = (day.wv.served || 0) + 1;
          if (info.total) day.sales += info.total;
          if (info.cajaError) { day.score = Math.max(0, day.score - 100); addRep(-0.25); day.vueltoMal = 1; day.coinLoss = (day.coinLoss || 0) + 40; fx('−🪙 vuelto de más', 'bad'); }
          if (ref.arche.id === 'santa') { day.santaSold = 1; ref.person.gift(); }
          if (ok) { addScore(150, ref.pat); addRep(info.caught ? 0.05 : 0.04); }
          if (info.caught) {                 // comprobante trucho bien rechazado: se va renegando y sin el producto
            day.caught = (day.caught || 0) + 1; day.wv.caught = 1; sayAt(ref.person, U.pick(LN.caught), 3600); day.beat = 1.5;
            const d0 = day; setTimeout(() => { if (day === d0 && !MG.isOpen()) W.focus(null); }, 2300);
            leave(ref, false); return;
          }
          // remate en el salón: la cámara se queda un momento y el cliente dice su frase al irse
          sayAt(ref.person, ref.arche.bye, 3600); day.beat = 1.5;
          const d = day; setTimeout(() => { if (day === d && !MG.isOpen()) W.focus(null); }, 2300);
          { const sn = ref.arche.id === 'santa', d1 = day; if (sn) setTimeout(() => { if (day === d1) leave(ref, false); }, 1300); else leave(ref, !!info.total); }
        } else { day.tasksDone++; day.wv.done[job.type] = 1; day.okBy = day.okBy || {}; day.okBy[job.type] = (day.okBy[job.type] || 0) + 1; addScore(job.type === 'ml' ? 130 * (1 + 0.2 * (upNow().flota || 0)) : 130, ref.pat); if (job.type === 'ml' && upNow().flota) addRep(0.015 * upNow().flota); if (job.type === 'ml' && upNow().flota && W.dispatch() && (A.play(['', 'moto', 'van', 'truck'][Math.min(3, upNow().flota)]), 1)) toast('<b>' + ['', '🛵 Sale la moto', '🚐 Sale la camioneta', '🚚 Sale el camión'][Math.min(3, upNow().flota)] + '</b>El pedido ya va en camino.', '', 2600); addRep(job.type === 'whatsapp' ? 0.05 : 0.03); if (job.type === 'vidriera') { GS.Store.set('vid', info.quality || 0); addRep((info.quality - 0.5) * 0.12); } removeTask(ref); }
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
    if (day.beat > 0) day.beat -= dt; mopTick(dt);
    // tandas: llegan unos pocos pendientes, se resuelven y viene un respiro
    if (!day.closing) {
      if (day.stage === 'rest') { day.rest -= dt; if (day.rest <= 0) startWave(); }
      else {
        for (const q of day.queue) q.t -= dt;
        while (day.queue.length && day.queue[0].t <= 0) { const q = day.queue.shift(); if (q.kind === 'c') spawnCustomer(); else if (q.kind === 'i') spawnIntr(); else if (q.kind === 'v') spawnVisit(q.v); else if (q.kind === 'x') spawnTask(ST('adornos')); else spawnTask(q.kind === 'f' ? ST('cierre') : q.kind === 'm' ? ST('ml') : null); }
        if (!day.queue.length && !day.tasks.length && !open && !day.intr && day.customers.every(c => c.st === 'leaving')) endWave();
      }
    }
    updateLookers(dt); updateHelper(dt);
    // cordura: se recupera en los respiros y baja despacito cuando se junta mucho
    { const u = upNow();
      if (day.stage === 'rest' && day.wave >= 0 && !day.closing) addCord(CD.rest * (u.cafetera ? 1.6 : 1) * dt);
      else if (!day.relaxed && pendingJobs().length >= CD.busyFrom) addCord(-CD.busy * (u.plantas ? 0.6 : 1) * dt);
      if (day.intr && !open) { day.intr.left -= dt; if (day.intr.left <= 0) { day.intr = null; day.jobSig = ''; toast('Se resolvió solo. A veces pasa.', '', 1700); } } }
    // paciencia (en el turno tranquilo no baja)
    if (!day.relaxed) {
      for (const cu of day.customers.slice()) {
        if (cu.story) continue;                       // las visitas con historia esperan sin apuro
        if (cu.st === 'waitC') cu.wc = (cu.wc || 0) + dt;
        if (cu.st === 'waitM' || cu.st === 'waitC') cu.pat -= dt / (cfg.patienceWait * patMult());
        else if ((cu.st === 'inM' || cu.st === 'inC') && !MG.isResolving()) cu.pat -= dt / cfg.patienceGame;
        if (cu.pat <= 0 && (cu.st === 'waitM' || cu.st === 'waitC' || cu.st === 'inM' || cu.st === 'inC')) {
          if (cu.st === 'inM' || cu.st === 'inC') { if (MG.isResolving()) { cu.pat = 0.01; continue; } MG.close(); W.focus(null); }
          day.lost++; day.wv.lost = 1; duelQueja(); breakCombo(); addRep(-0.15); addCord(-CD.lost); A.play('lost');
          sayAt(cu.person, cu.arche.lost, 3600); toast('<b>' + cu.arche.name + ' se fue sin comprar</b>', '', 2200);
          leave(cu, false);
        }
      }
      for (const t of day.tasks.slice()) {
        if (t.st === 'wait' && t.pat < 0.6 && (day.deleg || 0) < (brId() === 'pampeana' ? 0 : brNow().train || 0)) {      // delegar: el equipo que aprendió resuelve tareas solo
          day.deleg = (day.deleg || 0) + 1; day.tasksDone++; day.score += 60; day.jobSig = ''; fx('🤝 Lo resolvió ' + (brCrew(brId())[day.deleg % 2] || 'el equipo')); A.play('ok'); removeTask(t); continue;
        }
        if (t.st === 'wait') t.pat -= dt / cfg.taskPatience;
        else if (!MG.isResolving()) t.pat -= dt / (cfg.patienceGame * 1.3);
        if (t.pat <= 0) {
          if (t.st === 'in') { if (MG.isResolving()) { t.pat = 0.01; continue; } MG.close(); W.focus(null); }
          day.tasksLate++; duelQueja(); breakCombo(); addRep(-0.08); addCord(-CD.late); A.play('lost');
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
      const tot = planTotals(day.plan), all = tot.c + tot.t, doneN = day.served + day.lost + (day.lostSale || 0) + day.tasksDone + day.tasksLate, f = Math.min(1, doneN / all);
      const fin = day.wave >= 0 && day.plan[day.wave].final, nw = day.plan.filter(w => !w.final).length, m = Math.round((600 + f * 540) / 10) * 10;
      setSky((m - 600) / 540, day.cond === 'lluvia');
      $('clockT').textContent = '🕙 ' + String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); $('clockB').style.width = (f * 100).toFixed(1) + '%';
      $('clockS').textContent = day.closing ? 'Cerramos: son las 19' : fin ? 'Cierre de caja' : day.stage === 'rest' && day.wave >= 0 ? 'Respiro ☕' : 'Tanda ' + Math.max(1, day.wave + 1) + '/' + nw;
    }
    $('scoreV').textContent = day.score.toLocaleString('es-AR');
    { const g = day.goal, sc = day.score, el = $('chipGoal'), nf = v => v.toLocaleString('es-AR'); el.hidden = !g; if (g) { el.textContent = sc >= g.gold ? '🥇 ¡Oro!' : sc >= g.silver ? '🥇 oro a ' + nf(g.gold) : '🥈 plata a ' + nf(g.silver); el.className = 'chip goal' + (sc >= g.gold ? ' gold' : sc >= g.silver ? ' silver' : ''); }
      const D = day.duel; $('duelBar').hidden = !D;
      if (D) { const un = Math.max(1, unitsOf(day.plan)), p = Math.min(1, (day.served + day.lost + (day.lostSale || 0) + day.tasksDone + day.tasksLate) / un), tgt = D.total * (p < 0.75 ? p * 0.9 : 0.675 + (p - 0.75) * 1.3);      /* el rival suma a tu ritmo y remata en la hora pico */
        D.shown += (tgt - D.shown) * 0.035; const him = Math.round(D.shown / 10) * 10; $('duelBar').style.setProperty('--rc', D.rv.col);
        $('duMe').textContent = nf(sc); $('duHim').textContent = nf(him); $('duName').textContent = D.rv.mark + ' ' + D.rv.name; $('duFill').style.width = (sc + him ? U.clamp(sc / (sc + him) * 100, 6, 94) : 50).toFixed(1) + '%';
        $('duQ').textContent = '😠 ' + D.q + '/3'; $('duQ').className = 'du-q' + (D.q >= 2 ? ' hot' : ''); $('duelBar').classList.toggle('ahead', sc >= him); } }
    $('chipSales').hidden = !!day.arcade; $('chipRep').hidden = !!day.arcade; $('chipRep').textContent = '⭐ ' + repTxt(repNow());
    $('chipSales').textContent = '🪙 ' + (coinsNow() + Math.round(day.score / 20 * coinMult()));
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
    pumpSays(dt || 0);
    for (const sy of day.says.slice()) {
      sy.left -= dt || 0;
      if (sy.left <= 0 || !sy.person.group.parent) { sy.el.remove(); day.says.splice(day.says.indexOf(sy), 1); if (sy.onDone) sy.onDone(); continue; }
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
    day = newDay({ arcade: id, round: 0, job: null, wait: 0.5 }); state = 'day'; enterPlay(); $('jobs').hidden = true; A.setMood('day'); setSky(0.3, false);
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
        day.round++; const job = day.job = arcadeJob(id); focusFor(id); yoGo(NODE_OF[id]);
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
      '<button class="phases" id="phasesEnd" hidden></button></div>';
    $('phasesEnd').innerHTML = phasesCompact(); $('phasesEnd').addEventListener('click', showPhases);
    $('endAgain').addEventListener('click', () => startArcade(st.id));
    $('endArc').addEventListener('click', () => { goHome(); showArcade(); }); $('endHome').addEventListener('click', goHome);
    $('end').hidden = false; $('end').scrollTop = 0;
  }
  // Arcade: tres juegos que se ganan jugando el modo carrera. Dan cosméticos (no monedas).
  const HATN = { casco: 'Casco', corona: 'Corona', vincha: 'Vincha' };
  function showArcade() {
    const days = GS.Store.get('days') || 0, cos = GS.Store.get('cos') || {}, best = GS.Store.get('arcBest') || {}, av = GS.Store.get('avatar') || {}, own = GS.ARCADE.filter(a => cos[a.prize]);
    modal('<h2>🕹️ Arcade</h2><p>Juegos cortos que se ganan avanzando en el modo carrera. Si llegás a la meta, te llevás un premio para tu personaje.</p><div class="arc2">' +
      GS.ARCADE.map(a => { const open = days >= a.from; return '<button data-arc="' + a.id + '"' + (open ? '' : ' disabled') + ' class="' + (cos[a.prize] ? 'won' : '') + '"><i>' + (open ? a.ic : '🔒') + '</i><b>' + a.name + '</b><small>' + (open ? a.d + ' Meta: ' + a.goal + (best[a.id] ? ' · tu mejor: ' + best[a.id] : '') + (cos[a.prize] ? ' · 🎁 ' + a.prizeName : '') : 'Se gana al terminar la jornada ' + a.from + '.') + '</small></button>'; }).join('') + '</div>' +
      (own.length ? '<p style="margin:0 0 6px"><b>Tus premios</b></p><div class="hats"><button class="btn ghost" data-hat="">Sin nada</button>' + own.map(a => '<button class="btn ' + (av.hat === a.prize ? '' : 'ghost') + '" data-hat="' + a.prize + '">' + HATN[a.prize] + '</button>').join('') + '</div>' : '') +
      '<div class="row"><button class="btn ghost" id="arcPrac">Practicar estaciones</button><button class="btn" data-close>Volver</button></div>');
    $('sheet').querySelectorAll('[data-arc]').forEach(b => b.addEventListener('click', () => { $('modal').hidden = true; A.setMusic && A.setMood('day'); GS.track('arcade', { juego: b.dataset.arc }); GS.Arcade.open(b.dataset.arc, (sc, won, def) => {
      const bs = GS.Store.get('arcBest') || {}; bs[def.id] = Math.max(bs[def.id] || 0, sc); GS.Store.set('arcBest', bs); if (won) { const c = GS.Store.get('cos') || {}; c[def.prize] = 1; GS.Store.set('cos', c); } }); }));
    $('sheet').querySelectorAll('[data-hat]').forEach(b => b.addEventListener('click', () => { const a = Object.assign({}, GS.Store.get('avatar') || {}, { hat: b.dataset.hat || null }); GS.Store.set('avatar', a); W.setPlayerLook(a); A.play('ok'); showArcade(); }));
    $('arcPrac').addEventListener('click', showPractice);
  }
  function showPractice() {
    const bests = GS.Store.get('arcade') || {};
    modal('<h2>Practicar</h2><p>Jugá una estación suelta: 5 rondas seguidas, sin clientes esperando.</p><div class="arc">' +
      GS.STATIONS.map(s => '<button class="arc-b' + (s.soon ? ' soon' : '') + '" data-id="' + s.id + '"' + (s.soon ? ' disabled' : '') + '><span class="ji">' + s.icon + '</span><b>' + s.name + '</b><small>' +
        (s.soon ? 'Próximamente' : bests[s.id] ? 'Récord: ' + bests[s.id].toLocaleString('es-AR') : 'Sin jugar') + '</small></button>').join('') +
      '</div><button class="btn ghost" data-close>Volver</button>');
    $('sheet').querySelectorAll('.arc-b:not(.soon)').forEach(b => b.addEventListener('click', () => startArcade(b.dataset.id)));
  }

  /* ---------------- Cierre de caja ---------------- */
  function endDay() {
    if (!day || state !== 'day' || day.arcade) return;
    stopMop(); state = 'end'; MG.close(); W.focus(null); W.showAll(); A.play('endDay'); A.setMood('menu'); $('rain').hidden = true;
    const d = day; d.intr = null;
    d.customers.slice().forEach(c => { if (c.st !== 'leaving') leave(c, false); }); d.lookers.slice().forEach(lk => { if (lk.st !== 'out') { lk.p.stop(); lookerOut(lk); } });
    d.tasks.slice().forEach(removeTask); d.says.forEach(x => x.el.remove()); d.says = [];
    $('hud').hidden = true; $('jobs').hidden = true;
    const done = d.served + d.tasksDone, missed = d.lost + d.tasksLate, errs = d.cajaErr + d.otherErr;
    let stars = 1;
    if (d.relaxed) stars = errs === 0 ? 3 : errs <= 4 ? 2 : 1;
    else { if (missed <= 2) stars = 2; if (missed === 0 && errs <= 3) stars = 3; }
    const comment = U.pick(stars === 3 ? LN.duenoEndGood : stars === 2 ? LN.duenoEndMid : LN.duenoEndBad);
    if (!GS.Store.get('testDay')) GS.Store.set('days', Math.max(GS.Store.get('days') || 0, d.n));
    brSave({ days: (brNow().days || 0) + 1 });
    const lostSale = d.lostSale || 0, ask = d.served + d.lost + lostSale, perfect = !errs && !d.lost && !lostSale && !d.tasksLate && !d.relaxed, dirty = d.dirt >= 3;
    if (dirty) addRep(-0.1);                                                        // cerrar con el piso sucio se nota
    /* medalla del día o resultado del duelo; las dos cosas cambian lo que se cobra */
    const units = Math.max(1, unitsOf(d.plan)), b0 = brNow(), nf = v => Math.round(v).toLocaleString('es-AR'); let medal = null, duelRes = null, mBonus = 1, goldRun = 0;
    if (d.duel) { const him = d.duel.total, win = !d.duel.over && d.score >= him, tt = GS.Store.get('tot') || {}; duelRes = { win, me: d.score, him, why: d.duel.over, rv: d.duel.rv, tries: d.duel.tries };
      if (win) { brSave({ won: 1, duel: 0, edge: 0, tries: 0 }); tt.duels = (tt.duels || 0) + 1; if (d.duel.tries) tt.revancha = (tt.revancha || 0) + 1; mBonus = 1.5; } else brSave({ duel: 1, tries: (b0.tries || 0) + 1 });
      GS.Store.set('tot', tt); GS.track('duelo', { region: brId(), gano: win ? 1 : 0, intento: d.duel.tries + 1 }); }
    else if (!d.relaxed) { const pu = d.score / units;
      if (d.goal) { medal = d.score >= d.goal.gold ? 'oro' : d.score >= d.goal.silver ? 'plata' : 'bronce'; mBonus = medal === 'oro' ? 1.2 : medal === 'plata' ? 1.08 : 1; goldRun = medal === 'oro' ? (b0.gold || 0) + 1 : 0;
        const tt = GS.Store.get('tot') || {}; tt.goldBest = Math.max(tt.goldBest || 0, goldRun); GS.Store.set('tot', tt); brSave({ gold: goldRun, edge: Math.min(5, (b0.edge || 0) + (medal === 'oro' ? 1 : 0)) }); GS.track('medalla', { cual: medal, jornada: d.n }); }
      brSave({ avg: Math.round(b0.avg ? b0.avg * 0.65 + pu * 0.35 : pu) }); }
    const earned = Math.max(0, Math.round(d.score / 9 * coinMult() * (d.plan.bonus || 1) * mBonus * (modNow() === 'sinrespiro' ? 1.3 : 1)) - (d.coinLoss || 0) * (modNow() === 'lupa' ? 2 : 1)); GS.Store.set('coins', coinsNow() + earned);
    const fEarn = 0;                                                                /* los fondos de expansión ya no existen */
    { const t = statsNow(); delete t.rep; delete t.flota; t.c += d.served; t.d++; t.caught += d.caught || 0; t.web += (d.okBy && d.okBy.ml) || 0; t.clean += d.cleaned; t.sales += d.sales;
      if (perfect) { t.perfect++; t.streak++; } else if (!d.relaxed) t.streak = 0; if (d.vueltoMal) t.vueltoMal++; if (!d.dirt && !d.relaxed) t.limpio++; if (dirty) t.sucio++; if (d.santaSold) t.santa++; GS.Store.set('tot', t); }
    const fresh = checkLogros(), mode = d.relaxed ? 'Tranquilo' : 'Normal';
    lastCard = { n: d.n, score: d.score, stars, cord: 0 };
    const rv = repNow(), rd = rv - d.rep0; refreshStart();
    GS.track('fin_jornada', { puntaje: d.score, atendidos: d.served, tareas: d.tasksDone, perdidos: missed + lostSale, modo: mode, segundos: Math.round(d.tt || 0), monedas: earned, fondos: fEarn });
    { const ms = GS.Store.get('metrics') || []; ms.push({ n: d.n, modo: mode, seg: Math.round(d.tt || 0), mg: Math.round(d.tj || 0), monedas: earned, at: d.served, per: d.lost + lostSale, tar: d.tasksDone, tarde: d.tasksLate, err: errs, rep: Math.round(rv * 10) / 10, mt: d.mt || {} }); GS.Store.set('metrics', ms.slice(-40)); }
    const hook = nextHook(d.n + 1), ob = d.okBy || {}, row = (ok, label, val) => '<p class="' + (ok ? 'ok' : 'no') + '"><span>' + (ok ? '✔' : '✖') + ' ' + label + '</span><b>' + val + '</b></p>';
    /* pantalla de mejoras dentro del cierre: todo lo que se puede comprar, con las monedas recién cobradas */
    const upHtml = () => { const u = upNow(), c = coinsNow(); let have = 0, tot = 0; const items = GS.UPGRADES.map(g => { tot += g.levels.length; const own = Math.min(g.levels.length, u[g.id] || 0); have += own; return { g, own, lv: g.levels[own] }; });
      const card = (it, key) => { const ok = c >= it.lv.price; return '<div class="upc' + (ok ? ' ok' : '') + (key ? ' key' : '') + '"><i>' + it.g.icon + '</i><span><b>' + it.lv.n + (it.g.levels.length > 1 ? ' <u>nivel ' + (it.own + 1) + ' de ' + it.g.levels.length + '</u>' : '') + '</b><small>' + it.lv.d + '</small>' + (ok ? '' : '<em><u style="width:' + Math.max(3, c / it.lv.price * 100).toFixed(0) + '%"></u></em>') + '</span><button class="btn' + (ok ? '' : ' ghost') + '" data-up="' + it.g.id + '"' + (ok ? '' : ' disabled') + '>' + (ok ? 'Comprar' : 'Faltan') + '<br>🪙 ' + (ok ? it.lv.price : it.lv.price - c) + '</button></div>'; };
      const fl = items.filter(x => x.g.id === 'flota')[0], rest = items.filter(x => x.g.id !== 'flota' && x.lv).sort((a, b) => a.lv.price - b.lv.price), done = items.filter(x => !x.lv);
      return '<div class="pay-t"><b>Tenés</b><span>🪙 ' + c + '</span><span class="upn">' + have + ' de ' + tot + ' mejoras</span></div>' + (fl && fl.lv ? '<h5>🚚 Para conquistar la región</h5>' + card(fl, 1) : '') + (rest.length ? '<h5>🛠 Para que el local rinda más</h5>' + rest.map(x => card(x)).join('') : '<p class="pay-n">🏆 Local completo: compraste todas las mejoras.</p>') +
        (done.length ? '<p class="pay-n">Ya tenés: ' + done.map(x => x.g.icon + ' ' + x.g.name).join(' · ') + '</p>' : '') + '<button class="sumSkip" id="endShop">Ver las mejoras dentro del local</button>'; };
    const head = (k, t) => '<div class="sum-head"><small>' + k + '</small><b>' + t + '</b></div>', place = RG(brId()).city + ' · ' + monthOf(d.n) + (d.cond ? ' · ' + condInfo(d.cond).name : '') + (d.relaxed ? ' · turno tranquilo' : '');
    $('endCol').innerHTML = '<div class="sumS" id="sumS">' +
      /* 1 · cómo te fue */
      '<section class="sumP">' + head(place, duelRes ? (duelRes.win ? '¡Ganaste el día de competencia!' : duelRes.why === 'quejas' ? 'Tres quejas: se perdió el día' : 'Hoy ganó ' + duelRes.rv.name) : perfect ? '¡Jornada impecable!' : 'Jornada ' + d.n + ' cumplida') +
      (duelRes ? '<div class="duelres ' + (duelRes.win ? 'win' : 'lose') + '" style="--rc:' + duelRes.rv.col + '"><span><b>' + nf(duelRes.me) + '</b><small>GameShop</small></span><i>VS</i><span><b>' + nf(duelRes.him) + '</b><small>' + duelRes.rv.mark + ' ' + duelRes.rv.name + '</small></span></div><p class="pay-n' + (duelRes.win ? '' : ' no') + '">' + (duelRes.win ? '🏆 La región es tuya. Cobrás 50% más de monedas por la victoria.' : duelRes.why === 'quejas' ? 'A la tercera queja la gente se cruzó enfrente. La revancha es gratis.' : 'Te faltaron ' + nf(duelRes.him - duelRes.me) + ' puntos. La revancha es gratis, y ' + duelRes.rv.owner + ' viene más confiado.') + '</p>' : '') +
      (medal ? '<div class="medal ' + medal + '"><i>' + (medal === 'oro' ? '🥇' : medal === 'plata' ? '🥈' : '🥉') + '</i><span><b>Medalla de ' + medal + '</b><small>' + nf(d.score) + ' puntos. ' + (medal === 'oro' ? 'Superaste tu marca: +20% de monedas' + (goldRun > 1 ? ' · racha de oros: ' + goldRun : '') + '.' : medal === 'plata' ? 'El oro estaba en ' + nf(d.goal.gold) + '. +8% de monedas.' : 'Plata desde ' + nf(d.goal.silver) + ', oro desde ' + nf(d.goal.gold) + '.') + '</small></span></div>' : '') +
      '<div class="sum-rep"><i>⭐</i><span><b>' + repTxt(rv) + ' <u>de 5</u></b><small>Reputación en ' + RG(brId()).city + ' · ' + (rd > 0.004 ? 'subió ' + repTxt(rd) + ' hoy' : rd < -0.004 ? 'bajó ' + repTxt(-rd) + ' hoy' : 'hoy quedó igual') + '</small></span></div>' +
      '<div class="ticket"><h3>DETALLE DEL DÍA</h3>' +
      row(ask > 0 && d.served === ask, 'Ventas concretadas', d.served + ' de ' + ask) +
      (lostSale ? row(false, 'Se fueron por producto equivocado', lostSale) : '') + (d.lost ? row(false, 'Se cansaron de esperar', d.lost) : '') +
      row(!d.cajaErr, 'Cobros sin error', d.cajaErr ? d.cajaErr + (d.cajaErr === 1 ? ' error' : ' errores') : 'todos') +
      (ob.ml ? row(true, 'Compras por la página despachadas', ob.ml) : '') + (ob.stock ? row(true, 'Controles de stock bien hechos', ob.stock) : '') +
      (d.tasksDone + d.tasksLate ? row(!d.tasksLate, 'Tareas del local a tiempo', d.tasksDone + ' de ' + (d.tasksDone + d.tasksLate)) : '') +
      (d.caught ? row(true, 'Comprobantes truchos frenados', d.caught) : '') +
      row(!dirty, 'Limpieza', dirty ? 'piso sucio' : d.cleaned ? d.cleaned + (d.cleaned === 1 ? ' mancha limpiada' : ' manchas limpiadas') : 'impecable') +
      '<hr><p><span>Facturación (ficticia)</span><b>' + U.money(d.sales) + '</b></p></div>' +
      '<div class="quote"><b>' + (d.moment ? 'El momento del día' : 'El Dueño opina') + '</b>' + (d.moment || comment) + '</div>' +
      GS.ARCADE.filter(a => a.from === d.n && !GS.Store.get('testDay')).map(a => '<div class="newrec">🕹️ Premio de la jornada: <b>' + a.name + '</b><small>Juego nuevo en el Arcade (desde el inicio). ' + a.d + '</small></div>').join('') +
      fresh.map(a => '<div class="newrec">' + a.ic + ' Logro: <b>' + a.name + '</b><small>' + a.d + '</small></div>').join('') + '</section>' +
      /* 2 · lo que cobraste */
      '<section class="sumP">' + head('Cierre de caja', 'Lo que cobraste') +
      '<div class="pay"><i>🪙</i><span><b id="sumCoins">+0</b><em>monedas</em><small>Para <u>mejorar el local</u> y comprar la flota (moto, camioneta y camión). Se gastan en Mejoras.</small></span></div>' +
      (d.coinLoss ? '<p class="pay-n no">Se fueron 🪙 ' + d.coinLoss + ' en errores de caja.</p>' : '') + (mBonus > 1 ? '<p class="pay-n">' + (duelRes ? '🏆 Victoria en el día de competencia: +50% de monedas.' : medal === 'oro' ? '🥇 Medalla de oro: +20% de monedas.' : '🥈 Medalla de plata: +8% de monedas.') + '</p>' : '') +
      '<div class="pay-t"><b>Ahora tenés</b><span>🪙 ' + coinsNow() + '</span></div>' +
      '<p class="pay-n">Las monedas salen del puntaje del día: atender rápido y sin errores paga más. Las medallas y ganar el día de competencia suman un extra.</p></section>' +
      /* 3 · mejoras */
      '<section class="sumP">' + head('Antes de seguir', 'Mejorá el local') + '<p class="pay-n">Las mejoras quedan para siempre en esta sucursal. No hace falta comprar ahora: las monedas se guardan.</p><div id="upBox" class="upbox">' + upHtml() + '</div></section>' +
      /* 4 · qué sigue */
      '<section class="sumP">' + head('Jornada ' + (d.n + 1) + ' · ' + monthOf(d.n + 1), 'Qué sigue') + '<div id="expBox">' + expCard() + '</div>' +
      '<div class="hook" id="hookBox"><i>' + hook[0] + '</i><span><b>Lo que viene</b>' + hook[1] + '</span></div>' +
      '<div class="row3"><button class="btn ghost" id="endMap">🗺️ Mapa</button><button class="btn ghost" id="endRecs">🏅 Logros</button><button class="btn ghost" id="endLib">📖 Libreta</button><button class="btn ghost" id="endCard">📸 Compartir</button><button class="btn ghost" id="endHome">← Inicio</button></div>' +
      '<button class="phases" id="phasesEnd" hidden></button></section></div>' +
      '<div class="sumN"><span class="sumD" id="sumD"><i class="on"></i><i></i><i></i><i></i></span><div class="row"><button class="btn ghost" id="sumBack" hidden>‹ Atrás</button><button class="btn" id="sumNext">Siguiente ›</button><button class="btn" id="endAgain" hidden>' + (duelRes && !duelRes.win ? '🔁 Jugar la revancha ›' : 'Siguiente jornada ›') + '</button></div>' + ((GS.Store.get('days') || 0) >= 7 ? '<button class="sumSkip" id="sumSkip">Saltar al final</button>' : '') + '</div>';
    $('phasesEnd').innerHTML = phasesCompact(); $('phasesEnd').addEventListener('click', showPhases);
    $('endMap').addEventListener('click', showMap); $('endCard').addEventListener('click', () => showCard()); $('endLib').addEventListener('click', showLibreta);
    $('endAgain').addEventListener('click', () => startDay(d.relaxed));
    $('endHome').addEventListener('click', goHome); $('endRecs').addEventListener('click', showLogros);
    $('upBox').addEventListener('click', e => { if (e.target.closest('#endShop')) return openShop(); const b = e.target.closest('[data-up]'); if (!b || b.disabled) return;
      const g = GS.UPGRADES.filter(x => x.id === b.dataset.up)[0], u = upNow(), i = u[g.id] || 0, lv = g.levels[i]; if (!lv || coinsNow() < lv.price) return;
      u[g.id] = i + 1; GS.Store.set('up', u); GS.Store.set('newUp', true); GS.Store.set('coins', coinsNow() - lv.price); brSave(); W.setUpgrades(upNow()); A.play('cash'); toast('<b>¡Mejora comprada!</b>' + lv.n, '', 2400); refreshStart();
      $('upBox').innerHTML = upHtml(); $('expBox').innerHTML = expCard(); { const h2 = nextHook(d.n + 1); $('hookBox').innerHTML = '<i>' + h2[0] + '</i><span><b>Lo que viene</b>' + h2[1] + '</span>'; }
      if (g.id === 'flota' && i === 2 && repNow() < 4.8) setTimeout(() => toast('<b>🚚 Flota completa</b>Para conquistar la región solo falta llegar a 5 estrellas (vas ' + repTxt(repNow()) + ').', '', 5000), 2500); });
    { const t = GS.Store.get('tot') || {}; if (brProgress(brId()) >= 100 && !brNow().plat) { brSave({ plat: 1 }); t.platino = (t.platino || 0) + 1; GS.Store.set('tot', t); checkLogros(); } }
    /* los festejos (región conquistada, finales) esperan a la última pantalla del resumen */
    let cele = false; const afterDuel = () => { if (state !== 'end') return; refreshStart(); $('expBox').innerHTML = expCard();
      if (allDone() && !GS.Store.get('finalN')) { GS.Store.set('finalN', 1); showFinal(); } else if (malvWon() && !GS.Store.get('finalM')) { GS.Store.set('finalM', 1); applyBranch(); showFinalM(); } else checkConquest(); };
    const celebrate = () => { if (cele || state !== 'end' || GS.Store.get('testDay')) return; cele = true; if (duelRes) showDuelEnd(duelRes, afterDuel); else afterDuel(); };
    let page = 0, counted = false; const S = $('sumS'), go = i => { S.scrollTo({ left: i * S.clientWidth, behavior: 'smooth' }); A.play('click'); };
    const onPage = () => { const i = Math.max(0, Math.min(3, Math.round(S.scrollLeft / Math.max(1, S.clientWidth)))); if (i === page && counted !== null) { if (i !== 1 || counted) return; } page = i;
      [].forEach.call($('sumD').children, (x, k) => x.classList.toggle('on', k === i)); $('sumBack').hidden = i === 0; $('sumNext').hidden = i === 3; $('endAgain').hidden = i !== 3; if ($('sumSkip')) $('sumSkip').hidden = i === 3; if (i === 2) $('upBox').innerHTML = upHtml();
      if (i === 1 && !counted) { counted = true; const el = $('sumCoins'), t0 = performance.now(); (function tick(t) { const k = Math.min(1, (t - t0) / 900); if (!el.isConnected) return; el.textContent = '+' + Math.round(earned * k); if (k < 1) requestAnimationFrame(tick); else { el.classList.add('pop'); if (earned) A.play('cash'); } })(t0); }   /* las monedas suben */
      if (i === 3) setTimeout(celebrate, 700); };
    S.addEventListener('scroll', onPage, { passive: true }); $('sumNext').addEventListener('click', () => go(page + 1)); $('sumBack').addEventListener('click', () => go(page - 1)); if ($('sumSkip')) $('sumSkip').addEventListener('click', () => go(3));
    $('end').hidden = false; $('end').scrollTop = 0; S.scrollLeft = 0; coach(GS.ARCADE.some(a => a.from === d.n) ? 'arcade' : 'resumen');
  }
  // Gancho para la jornada siguiente: lo próximo que vale la pena esperar
  function nextHook(n) {
    const m = n % 12; if (m === 11) return ['🛍️', 'La próxima jornada es noviembre: Black Friday. Viene más gente, y además hay que decorar para Navidad.'];
    if (m === 0) return ['🎄', 'La próxima es diciembre: semana de Navidad. Dicen que viene alguien de rojo a comprar.'];
    const h = histAll(), back = GS.STORIES.filter(S => h[S.id] && !h[S.id].done && n >= h[S.id].last + (S.gap || 1));
    if (back.length) return ['📖', back[0].name + ' dijo que volvía. Puede aparecer en la próxima jornada.'];
    { const id = brId(), me = brData(id), rv = RV(id);
      if (!won(id) && rv) { if (readyDuel(id)) return ['⚔️', 'La próxima jornada es el día de competencia contra ' + rv.name + '.' + ((brNow().tries || 0) ? ' Es la revancha.' : '')];
        return me.rep < 4.8 && me.flota < 3 ? ['⭐', 'Para desafiar a ' + rv.name + ' faltan dos cosas: llegar a 5 estrellas y tener la flota completa.'] : me.rep < 4.8 ? ['⭐', 'Ya tenés la flota completa. Falta llegar a 5 estrellas (vas ' + repTxt(me.rep) + ') para desafiar a ' + rv.name + '.'] : ['🚚', 'Ya tenés 5 estrellas. Falta la flota completa para desafiar a ' + rv.name + '.']; }
      if (goalNow() && canExpand()) return ['🗺️', 'Región conquistada: abrí el mapa y elegí dónde va la próxima sucursal.']; }
    const t = nextGoal(); if (t) return [t.g.icon, (coinsNow() >= t.lv.price ? 'Ya te alcanza para: ' : 'Te faltan 🪙 ' + (t.lv.price - coinsNow()) + ' para: ') + t.lv.n + '.'];
    return ['☕', 'Mañana abrimos de 10 a 19, como siempre.'];
  }
  /* ---------------- Mejoras del local (la recompensa por seguir jugando) ---------------- */
  function nextGoal() {                 // lo más barato que todavía no tiene
    const u = upNow(); let best = null;
    GS.UPGRADES.forEach(g => { const lv = g.levels[u[g.id] || 0]; if (lv && (!best || lv.price < best.lv.price)) best = { g, lv }; });
    return best;
  }
  // Tarjetas del inicio: mismo armado las dos (etiqueta, dato grande, barra con su número y un botón claro)
  const wbtn = (ic, title, info, cur, tot, unit, full, extra) => '<i class="wb-i">' + ic + '</i><span class="wb-m"><b>' + title + (extra || '') + '</b><small>' + info + '</small>' +
    (tot ? '<span class="wb-r"><span class="wb-p"><i style="width:' + Math.min(100, cur / tot * 100).toFixed(0) + '%"></i></span><span class="wb-n' + (full ? ' ok' : '') + '">' + unit + ' ' + Math.min(cur, tot) + ' <em>de ' + tot + '</em></span></span>' : '') + '</span><i class="wb-a">›</i>';
  /* Qué falta para abrir otra sucursal: tres pasos con tilde, y para qué sirve cada recurso */
  /* Gráfico: una sucursal + 5 estrellas + flota completa + ganarle al rival = otra sucursal. st marca lo que ya está cumplido. */
  function expDiagram(st) {
    st = st || {}; const pill = (ok, ic, t) => '<span class="' + (ok ? 'ok' : '') + '"><i>' + ic + '</i><b>' + t + '</b>' + (ok ? '<u>✓</u>' : '') + '</span>', arrow = '<svg class="ar" viewBox="0 0 24 40"><path d="M2 20H17M11 11l8 9-8 9" fill="none" stroke="#f5c518" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return '<div class="expd"><figure>' + storeSvg() + '<figcaption>Tu sucursal</figcaption></figure>' + arrow + '<div class="rq">' + pill(st.rep, '⭐⭐⭐⭐⭐', '5 estrellas') + '<em>+</em>' + pill(st.flota, '🛵 🚐 🚚', 'Flota completa') + '<em>+</em>' + pill(st.duel, '⚔️', 'Ganarle al rival') + '</div>' + arrow + '<figure class="new">' + storeSvg() + '<figcaption>Sucursal nueva</figcaption></figure></div>';
  }
  function expCard() {
    const id = brId(), me = brData(id), R = RG(id), rv = RV(id), w = won(id), rd = readyDuel(id), more = goalNow(), b = brNow(); if (!rv || (w && !more)) return '';
    const c = coinsNow(), fl = GS.UPGRADES.find(u => u.id === 'flota'), need = fl.levels.slice(me.flota).reduce((a, l) => a + l.price, 0), others = pendingOpen().filter(r => r.id !== id), ready = more && canExpand();
    const row = (ok, ic, t, sub, pct) => '<div class="' + (ok ? 'ok' : '') + '"><i>' + (ok ? '✅' : ic) + '</i><span><b>' + t + '</b><small>' + sub + '</small>' + (pct != null && !ok ? '<em><u style="width:' + Math.max(3, Math.min(100, pct)).toFixed(0) + '%"></u></em>' : '') + '</span></div>';
    return '<div class="expc' + (ready || rd ? ' ready' : '') + '"><h4>' + (ready ? '🎉 ¡Ya podés abrir otra sucursal!' : rd ? '⚔️ ¡Llegó el día de competencia!' : '🗺️ Cómo se conquista ' + R.city) + '</h4>' + expDiagram({ rep: me.rep >= 4.8 || w, flota: me.flota >= 3, duel: w }) +
      row(me.rep >= 4.8 || w, '⭐', '1 · Llegar a 5 estrellas en ' + R.city, me.rep >= 4.8 || w ? 'Listo: acá ya nos conocen.' : 'Vas ' + repTxt(me.rep) + ' de 5. Sube cuando atendés sin errores y el local está limpio.', me.rep / 4.8 * 100) +
      row(me.flota >= 3, '🚚', '2 · Tener la flota completa', me.flota >= 3 ? 'Listo: llegamos a toda la región.' : need <= c ? '¡Ya te alcanza! Comprá lo que falta en Mejoras → Flota de envíos.' : 'Moto, camioneta y camión: se compran con 🪙 monedas, en Mejoras → Flota de envíos. Te faltan 🪙 ' + (need - c) + '.', c / need * 100) +
      row(w, rv.mark, '3 · Ganarle a ' + rv.name + ' en el día de competencia', w ? 'Listo: le ganaste a ' + rv.owner + '.' : rd ? 'Es la próxima jornada' + ((b.tries || 0) ? ' (revancha gratis, y es más fácil)' : '') + '. Más puntos que ' + rv.owner + ' y menos de tres quejas.' : 'Se habilita solo cuando tengas las 5 estrellas y la flota completa.' + ((b.edge || 0) ? ' Ya tenés ventaja por ' + b.edge + (b.edge === 1 ? ' medalla' : ' medallas') + ' de oro.' : '')) +
      (others.length ? row(false, '🏪', 'Lo mismo en ' + others.map(r => r.city).join(' y '), 'Cada sucursal abierta tiene su propio rival.') : '') +
      '<p>' + (ready ? 'Abrí el <b>🗺️ Mapa</b> y elegí la región.' : '<b>🪙 Monedas</b>: mejoran el local y compran la flota. <b>🥇 Medallas de oro</b>: te dan ventaja para el día de competencia.') + '</p><p class="meta">🏁 <b>Meta del juego:</b> ganarles a los 5 rivales del país (' + MAIN.filter(r => conquered(r.id)).length + ' de 5).</p></div>';
  }
  function sucCard() {
    const all = brAll(), id = brId(), me = brData(id), n = MAIN.filter(r => all[r.id] && all[r.id].open).length, cq = MAIN.filter(r => conquered(r.id)).length, more = goalNow(), dots = '<span class="hc-d">' + MAIN.map(r => '<i class="' + (all[r.id] && all[r.id].open ? 'on' : '') + (r.id === id ? ' cur' : '') + '"></i>').join('') + '</span>';
    return wbtn('🗺️', 'Mis sucursales', dots + ' ' + n + ' de 5' + (won(id) ? (more && canExpand() ? ' · ¡ya podés abrir otra!' : more ? ' · falta conquistar otra sucursal' : ' · avance ' + Math.round(MAIN.reduce((a, r) => a + brProgress(r.id), 0) / MAIN.length) + '%') : readyDuel(id) ? ' · ⚔️ día de competencia listo' : ' · falta ' + (me.rep < 4.8 ? '⭐ 5 estrellas' : '') + (me.rep < 4.8 && me.flota < 3 ? ' y ' : '') + (me.flota < 3 ? '🚚 flota completa' : '')), cq, 5, '⚔️', more && canExpand());
  }
  function goalCard() {
    const t = nextGoal(), c = coinsNow(); if (!t) return wbtn('🛠', 'Mejorar el local', '🏆 Local completo: compraste todas las mejoras', 0, 0, '', false);
    return wbtn('🛠', 'Mejorar el local', (c >= t.lv.price ? '¡Ya te alcanza! ' : 'Próxima: ') + t.g.icon + ' ' + t.lv.n, c, t.lv.price, '🪙', c >= t.lv.price);
  }
  function goalHtml() {
    const t = nextGoal(), c = coinsNow(); if (!t) return '<div class="goal"><b>🏆 Local completo</b><span>Compraste todas las mejoras.</span></div>';
    const f = Math.min(1, c / t.lv.price);
    return '<div class="goal"><b>' + t.g.icon + ' Próxima mejora: ' + t.lv.n + '</b><span>' + (f >= 1 ? '¡Ya te alcanza! Andá a Mejorar el local.' : 'Ahorraste 🪙 ' + c + ' de ' + t.lv.price) + '</span><div class="pb"><i style="width:' + (f * 100).toFixed(0) + '%"></i></div></div>';
  }
  const rankOf = n => { let rk = GS.RANKS[0][1]; GS.RANKS.forEach(r => { if (n >= r[0]) rk = r[1]; }); return rk; };
  let shopSel = 0;
  function openShop() { coach('tienda');
    A.unlock(); A.play('click'); A.setMood('menu'); state = 'shop'; $('start').hidden = true; $('end').hidden = true; $('shop').hidden = false; shopSel = 0;
    const t = nextGoal(); if (t) shopSel = GS.UPGRADES.indexOf(t.g);
    renderShop();
  }
  function layPick(g) {            /* plano chiquito del salón: los cuatro lugares, con el mueble que tiene cada uno */
    if (GS.FLOOR.indexOf(g.id) < 0) return ''; const u = upNow(), at = k => GS.FLOOR.find(f => (u.lay && u.lay[f] != null ? u.lay[f] : GS.FLOOR.indexOf(f)) === k), ic = f => GS.UPGRADES.find(x => x.id === f).icon;
    return '<div class="layp"><small>📍 ¿Dónde va? Tocá un lugar del salón</small><div class="layg"><i class="lay-c">Mostrador</i>' + [0, 1, 2, 3].map(k => { const f = at(k), mine = f === g.id; return (k % 2 ? '<i class="lay-a"></i>' : '') + '<button class="layb' + (mine ? ' on' : '') + (f && !u[f] && !mine ? ' off' : '') + '" data-slot="' + k + '">' + (f ? ic(f) : '') + '</button>'; }).join('') + '<i class="lay-d">Puerta</i></div></div>';
  }
  function renderShop(preview) {
    const u = upNow(), c = coinsNow(), g = GS.UPGRADES[shopSel], own = u[g.id] || 0;
    $('shopCoins').textContent = '🪙 ' + c;
    $('shopFund').innerHTML = '';
    $('shopSlots').innerHTML = GS.UPGRADES.map((x, i) => '<button class="slotb' + (i === shopSel ? ' on' : '') + ((u[x.id] || 0) >= x.levels.length ? ' full' : '') + '" data-i="' + i + '">' + x.icon + '<small>' + x.name + '</small></button>').join('');
    const seeLv = preview == null ? Math.min(own + 1, g.levels.length) : preview;
    $('shopCards').innerHTML = g.levels.map((lv, i) => {
      const has = own > i, can = own === i && c >= lv.price, locked = own < i;
      return '<div class="card' + (has ? ' has' : '') + (i + 1 === seeLv ? ' sel' : '') + '" data-see="' + (i + 1) + '"><b>' + lv.n + '</b><span>' + lv.d + '</span><div class="row"><em>' + (has ? '✔ Ya lo tenés' : '🪙 ' + lv.price) + '</em>' +
        (has ? '' : '<button class="btn" data-buy="' + i + '"' + (can ? '' : ' disabled') + '>' + (locked ? 'Primero el anterior' : can ? 'Comprar' : 'Te faltan ' + (lv.price - c)) + '</button>') + '</div>' + layPick(g) + '</div>';
    }).join('') + (g.levels.length > 1 ? '' : '');
    const show = Object.assign({}, u); show[g.id] = seeLv;   // vista previa del modelo en su lugar
    W.setUpgrades(show); W.focusAt(upPos(g)[0], upPos(g)[1], g.zoom || 0.36, 0.2);
    $('shopHint').textContent = (shopSel + 1) + ' de ' + GS.UPGRADES.length + ' · ' + (g.levels.length > 1 ? 'Tocá un nivel para verlo en el local' : own >= g.levels.length ? 'Ya lo tenés en el local.' : 'Vista previa en el local');
  }
  function buy(i) {
    const u = upNow(), g = GS.UPGRADES[shopSel], lv = g.levels[i]; if ((u[g.id] || 0) !== i || coinsNow() < lv.price) return;
    u[g.id] = i + 1; GS.Store.set('up', u); GS.Store.set('newUp', true); GS.Store.set('coins', coinsNow() - lv.price); A.play('cash'); toast('<b>¡Mejora comprada!</b>' + lv.n, '', 2600); renderShop();
    if (g.id === 'flota' && i === 2) { if (repNow() >= 4.8) setTimeout(() => { if (!$('shop').hidden) closeShop(); }, 1500); else setTimeout(() => toast('<b>🚚 Flota completa</b>Para conquistar la región solo falta llegar a 5 estrellas (vas ' + repTxt(repNow()) + ').', '', 5000), 2700); }      // el camión era lo último: el festejo es ahora, no una jornada después
  }
  function closeShop() { $('shop').hidden = true; W.setUpgrades(upNow()); state = 'menu'; $('start').hidden = false; refreshStart(); W.showAll(); A.play('click'); brSave(); checkConquest(); }
  // Cara y busto de un personaje, en el mismo estilo que el muñeco 3D (4 colores: piel, pelo, remera y pantalón).
  // mood = la mueca: normal, talk (hablando), happy, angry, impatient, nervous, sad, surprised.
  let avN = 0;
  function avatarSvg(a, mood) {
    // Retrato tipo busto: cabeza, cuello y hombros con buzo, con volumen (luces y sombras suaves). Cada retrato usa sus propios degradados.
    const hex = n => '#' + Number(n).toString(16).padStart(6, '0'), sh = (n, f) => { const c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(x => Math.round(Math.max(0, Math.min(255, f > 0 ? x + (255 - x) * f : x * (1 + f))))); return 'rgb(' + c.join(',') + ')'; };
    const nh = a.hair == null ? 0x3a2a1a : Number(a.hair), ns = Number(a.skin || 0xe0ac7e), nt = Number(a.shirt || 0xe10600), id = 'a' + (++avN);
    const h = 'url(#h' + id + ')', sk = hex(ns), top = hex(nt), ink = hex(a.pants || 0x23232b), brow = sh(nh, nh > 0x909090 ? -0.35 : -0.3), FT = '<g transform="translate(50 44) scale(0.9) translate(-50 -48)">';
    const st = a.hairStyle || 'corto', m = mood || 'normal', hat = a.hat;
    const cap = '<path d="M20.500 50 A29.500 ' + (hat === 'lana' || hat === 'gorro' || hat === 'gorra' || hat === 'ushanka' || hat === 'boina' || hat === 'ala' ? 27 : 34.500) + ' 0 0 1 79.500 50 L75.500 50 Q73 33 50 33 Q27 33 24.500 50z" fill="' + h + '"/>';      // llega hasta arriba de la cabeza: no queda piel entre el pelo de adelante y el de atrás
    let v = '<svg viewBox="0 0 100 124" width="120" height="149"><defs><radialGradient id="s' + id + '" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="' + sh(ns, 0.22) + '"/><stop offset=".55" stop-color="' + sk + '"/><stop offset="1" stop-color="' + sh(ns, -0.2) + '"/></radialGradient>' +
      '<linearGradient id="h' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + sh(nh, 0.22) + '"/><stop offset=".5" stop-color="' + hex(nh) + '"/><stop offset="1" stop-color="' + sh(nh, -0.3) + '"/></linearGradient>' +
      '<linearGradient id="t' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sh(nt, 0.16) + '"/><stop offset="1" stop-color="' + sh(nt, -0.22) + '"/></linearGradient></defs>';
    if (st === 'largo' && hat !== 'casco') v += FT + '<path d="M17.500 48 A32.500 32.500 0 0 1 82.500 48 V88 Q82.500 98 73 98 H27 Q17.500 98 17.500 88z" fill="' + h + '"/></g>';
    const W2 = a.wide ? 3 : 0, body = '<path d="M6 134 Q6 94 32 87 L42 83 H58 L68 87 Q94 94 94 134z" fill="url(#t' + id + ')"/>', neck = '<rect x="' + (42 - W2) + '" y="68" width="' + (16 + W2 * 2) + '" height="25" rx="8" fill="' + sh(ns, -0.14) + '"/>';
    v += '<rect x="' + (42 - W2) + '" y="56" width="' + (16 + W2 * 2) + '" height="30" rx="8" fill="' + sh(ns, -0.14) + '"/><g transform="translate(0 -8)">';
    if (a.top === 'remera') v += body + neck + '<path d="M36 88 Q50 100 64 88 L61 85 Q50 95 39 85z" fill="' + sh(nt, 0.2) + '"/><path d="M10 112 Q20 108 26 114M90 112 Q80 108 74 114" fill="none" stroke="' + sh(nt, 0.28) + '" stroke-width="1.600" stroke-linecap="round"/>';
    else if (a.top === 'chomba') v += body + neck + '<path d="M44 92 H56 V112 H44z" fill="' + sh(nt, 0.14) + '"/><path d="M34 86 L50 98 L44 106 L30 92z" fill="#e10600"/><path d="M66 86 L50 98 L56 106 L70 92z" fill="#e10600"/><circle cx="50" cy="103" r="1.500" fill="#fff"/><circle cx="50" cy="109" r="1.500" fill="#fff"/><rect x="62" y="104" width="13" height="5" rx="1.500" fill="#e10600"/>';
    else if (a.top === 'campera') v += body + '<path d="M38 86 H62 L60 134 H40z" fill="#e10600"/>' + neck + '<path d="M38 88 Q50 99 62 88 L60 86 Q50 95 40 86z" fill="#b00500"/><path d="M30 86 L41 84 L44 134 H34z" fill="' + sh(nt, 0.2) + '"/><path d="M70 86 L59 84 L56 134 H66z" fill="' + sh(nt, 0.2) + '"/><path d="M43.500 90 V134M56.500 90 V134" stroke="#8a8a94" stroke-width="1.300"/>';
    else v += body + '<path d="M29 89 Q50 75 71 89 Q64 101 50 101 Q36 101 29 89z" fill="' + sh(nt, -0.3) + '"/>' + neck + '<path d="M38 92 Q50 101 62 92 Q56 104 50 104 Q44 104 38 92z" fill="' + sh(nt, 0.1) + '"/><g stroke="' + sh(nt, 0.55) + '" stroke-width="1.700" stroke-linecap="round"><path d="M45.500 100 Q44 108 44.500 115"/><path d="M54.500 100 Q56 108 55.500 115"/></g>';
    if (a.santa) v += '<path d="M42 96 H58 V134 H42z" fill="#fff"/>';
    v += '</g>';
    if (a.uniform) v += '<path d="M39 76 H61 V88 Q50 93 39 88z" fill="' + sh(nt, -0.35) + '"/><path d="M39 78 H61" stroke="#f5c518" stroke-width="1.800"/><g fill="#f5c518"><ellipse cx="15" cy="84" rx="11" ry="4.600"/><ellipse cx="85" cy="84" rx="11" ry="4.600"/><circle cx="50" cy="96" r="2"/><circle cx="50" cy="104" r="2"/><circle cx="50" cy="112" r="2"/><circle cx="50" cy="120" r="2"/></g>' +
      '<g stroke="#c9a013" stroke-width="1.300"><path d="M7 86v5M11 87v5M15 88v5M19 87v5M23 86v5M77 86v5M81 87v5M85 88v5M89 87v5M93 86v5"/></g><path d="M22 92 L70 124 H58 L16 96z" fill="#d81e2c"/>' +
      '<g><rect x="27" y="97" width="4" height="6" fill="#2d6cdf"/><circle cx="29" cy="105.500" r="2.800" fill="#f5c518"/><rect x="34" y="97" width="4" height="6" fill="#3bb54a"/><circle cx="36" cy="105.500" r="2.800" fill="#d7d7de"/></g>';      // uniforme de gala: cuello alto, charreteras, banda, botones y medallas
    v += '<ellipse cx="22.500" cy="47" rx="5.800" ry="7.400" fill="' + sk + '"/><ellipse cx="77.500" cy="47" rx="5.800" ry="7.400" fill="' + sk + '"/><ellipse cx="23" cy="47.500" rx="2.600" ry="4" fill="' + sh(ns, -0.16) + '"/><ellipse cx="77" cy="47.500" rx="2.600" ry="4" fill="' + sh(ns, -0.16) + '"/>';
    v += (a.wide ? '<path d="M22 40 Q22 17 50 17 Q78 17 78 40 Q79 60 68 68 Q59 73 50 73 Q41 73 32 68 Q21 60 22 40z" fill="url(#s' + id + ')"/>' : '<ellipse cx="50" cy="44" rx="26" ry="27" fill="url(#s' + id + ')"/>') + FT;
    v += '<circle cx="31" cy="59" r="5.500" fill="#ff6b6b" opacity=".2"/><circle cx="69" cy="59" r="5.500" fill="#ff6b6b" opacity=".2"/>';
    if (hat !== 'casco') {
      if (st === 'corto' || st === 'rodete' || st === 'largo') v += cap;
      if (st === 'corto') v += '<path d="M24 38 Q22 14 46 13 Q42 6 56 7 Q78 9 77 38 Q72 24 60 27 Q52 20 44 27 Q32 24 24 38z" fill="' + h + '"/><g fill="none" stroke="' + sh(nh, 0.3) + '" stroke-width="1.600" stroke-linecap="round" opacity=".7"><path d="M36 19 Q44 13 52 16"/><path d="M52 14 Q62 12 68 20"/></g>';
      if (st === 'jopo') { const h2 = hex(a.hair2 != null ? a.hair2 : nh); v += '<path d="M17.500 48 Q15 8 50 7 Q85 8 82.500 48 L77.500 48 Q76 31 62 29 Q50 25 38 29 Q24 31 22.500 48z" fill="' + h + '"/><path d="M17.500 48 Q17 40 19 33 L24.500 35 Q22.800 41 22.500 48z" fill="' + h2 + '"/><path d="M82.500 48 Q83 40 81 33 L75.500 35 Q77.200 41 77.500 48z" fill="' + h2 + '"/><g fill="none" stroke="' + sh(nh, 0.38) + '" stroke-width="1.700" stroke-linecap="round" opacity=".8"><path d="M32 22 Q42 12 53 13"/><path d="M48 19 Q59 11 70 19"/><path d="M38 27 Q48 19 60 22"/></g>'; }      /* una sola pieza que cubre toda la cabeza; costados cortos y más claros */
      if (st === 'cresta') v += cap + '<path d="M36 31 Q50 12 64 31 Q50 25 36 31z" fill="' + h + '"/>';
      if (st === 'rodete') v += '<circle cx="50" cy="15" r="10.500" fill="' + h + '"/>';
      if (st === 'rulos') { v += cap; for (let i = 0; i < 9; i++) { const an = Math.PI * (1.02 + i * 0.12); v += '<circle cx="' + (50 + Math.cos(an) * 29).toFixed(1) + '" cy="' + (48 + Math.sin(an) * 29).toFixed(1) + '" r="10" fill="' + h + '"/>'; } v += '<circle cx="39" cy="26" r="8.500" fill="' + h + '"/><circle cx="61" cy="26" r="8.500" fill="' + h + '"/><circle cx="50" cy="22" r="8.500" fill="' + h + '"/>'; }
      if (st === 'mohicano') v += '<path d="M42 32 L44 5 L50 14 L56 3 L58 32 Q50 27 42 32z" fill="' + h + '"/>';
    }
    if (a.beard) v += '<path d="M21.500 52 A28.500 28.500 0 0 0 78.500 52 Q73 62 61 59 Q50 54 39 59 Q27 62 21.500 52z" fill="' + h + '"/>';
    if (a.stubble) v += '<path d="M21.500 52 A28.500 28.500 0 0 0 78.500 52 Q73 62 61 59 Q50 54 39 59 Q27 62 21.500 52z" fill="#3c3c44" opacity="' + (a.stubble === 2 ? 0.4 : 0.22) + '"/>';
    if (a.santa) v += '<path d="M19 50 Q17 80 34 92 Q50 104 66 92 Q83 80 81 50 Q74 62 61 59 Q50 54 39 59 Q26 62 19 50z" fill="#fff"/><path d="M30 72 Q38 80 34 90M70 72 Q62 80 66 90M50 78 V96" fill="none" stroke="#dfe3ea" stroke-width="1.800" stroke-linecap="round"/>';
    // sombreros de los disfraces
    if (hat === 'bicornio') v += '<path d="M5 39 Q18 5 50 3 Q82 5 95 39 Q72 30 50 30 Q28 30 5 39z" fill="#1b2340"/><path d="M8 36 Q20 8 50 6 Q80 8 92 36" fill="none" stroke="#f5c518" stroke-width="2.400"/><circle cx="50" cy="18" r="5" fill="#f5c518"/><circle cx="50" cy="18" r="2.200" fill="#d81e2c"/>';
    if (hat === 'lana') v += '<path d="M21 46 Q22 15 50 14 Q78 15 79 46z" fill="' + top + '"/><path d="M19 44 Q50 32 81 44 L80 53 Q50 41 20 53z" fill="' + ink + '"/><circle cx="50" cy="12" r="6" fill="' + ink + '"/>';
    if (hat === 'gorro') v += '<path d="M20 44 Q22 14 52 12 Q76 12 84 30 L78 34 Q70 24 62 30 Q76 36 80 46z" fill="#d81e2c"/><path d="M18 46 Q50 30 82 46 L81 54 Q50 39 19 54z" fill="#fff"/><circle cx="84" cy="31" r="6" fill="#fff"/>';
    if (hat === 'orejas') v += '<ellipse cx="29" cy="22" rx="8" ry="9" fill="' + h + '"/><ellipse cx="71" cy="22" rx="8" ry="9" fill="' + h + '"/>';
    if (hat === 'casco') v += '<path d="M17 52 A33 33 0 0 1 83 52 L78 52 Q76 36 50 36 Q24 36 22 52z" fill="' + top + '"/><rect x="76" y="14" width="3.500" height="16" fill="' + top + '"/><circle cx="77.700" cy="12" r="4.200" fill="' + h + '"/>';
    if (hat === 'corona') v += '<path d="M29 30 L27 9 L38 20 L50 5 L62 20 L73 9 L71 30 Q50 22 29 30z" fill="' + top + '"/>';
    if (hat === 'vincha') v += '<path d="M21.500 42 Q50 28 78.500 42 L78 48 Q50 35 22 48z" fill="' + top + '"/>';
    { const hc = hex(a.hatCol != null ? a.hatCol : 0x2b2b30), hb = hex(a.hatBand != null ? a.hatBand : 0x17171c), hd = sh(Number(a.hatCol != null ? a.hatCol : 0x2b2b30), -0.28);      /* sombreros de los rivales */
      if (hat === 'boina') v += '<path d="M18 36 Q20 12 54 10 Q88 10 90 30 Q80 40 50 38 Q30 37 18 36z" fill="' + hc + '"/><path d="M20 35 Q50 30 80 37" fill="none" stroke="' + hd + '" stroke-width="3"/><circle cx="56" cy="9" r="3.600" fill="' + hd + '"/>';
      if (hat === 'ala') v += '<ellipse cx="50" cy="35" rx="47" ry="8.500" fill="' + hd + '"/><ellipse cx="50" cy="33" rx="47" ry="8" fill="' + hc + '"/><path d="M26 33 Q27 6 50 5 Q73 6 74 33 Q50 39 26 33z" fill="' + hc + '"/><path d="M26.300 27 Q50 33 73.700 27 L74 33 Q50 39 26 33z" fill="' + hb + '"/>';
      if (hat === 'ushanka') v += '<path d="M19 46 Q19 10 50 9 Q81 10 81 46z" fill="' + hc + '"/><path d="M22 42 Q50 28 78 42 L78 31 Q50 18 22 31z" fill="' + hb + '"/><path d="M12 44 Q12 40 20 40 L24 74 Q16 78 13 70z" fill="' + hc + '"/><path d="M88 44 Q88 40 80 40 L76 74 Q84 78 87 70z" fill="' + hc + '"/>';
      if (hat === 'gorra') v += '<path d="M20 44 Q20 12 50 11 Q80 12 80 44 Q50 34 20 44z" fill="' + hc + '"/><path d="M22 43 Q50 33 78 43 Q92 44 97 52 Q70 44 24 49z" fill="' + hd + '"/><circle cx="50" cy="11" r="2.800" fill="' + hd + '"/>'; }
    // ojos, cejas y boca según la mueca
    const dx = m === 'nervous' ? 2.200 : 0, ry = m === 'surprised' ? 6.800 : m === 'impatient' ? 3.200 : 5.200;
    if (m === 'happy') v += '<g fill="none" stroke="' + ink + '" stroke-width="3.200" stroke-linecap="round"><path d="M33.500 51 Q39 44 44.500 51"/><path d="M55.500 51 Q61 44 66.500 51"/></g>';
    else v += '<ellipse cx="' + (39 + dx) + '" cy="50" rx="4" ry="' + ry + '" fill="' + ink + '"/><ellipse cx="' + (61 + dx) + '" cy="50" rx="4" ry="' + ry + '" fill="' + ink + '"/><circle cx="' + (40.300 + dx) + '" cy="48.200" r="1.300" fill="#fff"/><circle cx="' + (62.300 + dx) + '" cy="48.200" r="1.300" fill="#fff"/>';
    if (m === 'impatient') v += '<path d="M33.500 47.200h11M55.500 47.200h11" stroke="' + sk + '" stroke-width="3"/>';
    const brows = { normal: 'M33 40 Q39 38 45 40M55 40 Q61 38 67 40', talk: 'M33 39.500 Q39 37 45 39.500M55 39.500 Q61 37 67 39.500', happy: 'M33 39 Q39 35.500 45 39M55 39 Q61 35.500 67 39', angry: 'M32 36.500 L45 41.500M68 36.500 L55 41.500',
      impatient: 'M33 41 H45M55 37.500 Q61 34.500 67 38', nervous: 'M33 41 L45 37M67 41 L55 37', sad: 'M33 41.500 L45 37.500M67 41.500 L55 37.500', surprised: 'M33 35 Q39 31.500 45 35M55 35 Q61 31.500 67 35' };
    v += '<path d="' + (brows[m] || brows.normal) + '" fill="none" stroke="' + brow + '" stroke-width="4" stroke-linecap="round"/>';
    v += '<ellipse cx="50" cy="57.500" rx="4.400" ry="3.300" fill="' + sh(ns, -0.13) + '"/><ellipse cx="49" cy="56.400" rx="1.800" ry="1.100" fill="' + sh(ns, 0.3) + '" opacity=".8"/>';                                                    // nariz
    if (a.lashes) v += '<g stroke="' + h + '" stroke-width="1.800" stroke-linecap="round"><path d="M34 45.500l-3-2.500M66 45.500l3-2.500M36 43.500l-1.500-3M64 43.500l1.500-3"/></g>';
    if (a.shades) v += '<path d="M25 44 H75 L73 55 Q67 60 60 55 L54 49 H46 L40 55 Q33 60 27 55z" fill="#111114"/><path d="M29 46 l9 0" stroke="rgba(255,255,255,.35)" stroke-width="1.600" stroke-linecap="round"/>';
    if (a.patch) v += '<path d="M21 38 L79 52" stroke="#111114" stroke-width="2.400"/><ellipse cx="61" cy="50" rx="8.500" ry="8" fill="#111114"/>';
    if (a.glasses) v += '<g fill="rgba(255,255,255,.2)" stroke="' + ink + '" stroke-width="2.400"><circle cx="39" cy="50" r="9"/><circle cx="61" cy="50" r="9"/></g><path d="M48 50h4" stroke="' + ink + '" stroke-width="2.400"/>';
    const mc = a.beard ? '#fff' : ink;
    const mouths = { normal: a.lips ? '<path d="M43 64 Q46.500 61.500 50 63.500 Q53.500 61.500 57 64 Q50 71 43 64z" fill="' + top + '"/>' : '<path d="M43 64 Q50 70 57 64" fill="none" stroke="' + mc + '" stroke-width="2.600" stroke-linecap="round"/>',
      talk: '<ellipse cx="50" cy="66" rx="5" ry="4.200" fill="' + (a.lips ? top : mc) + '"/>', happy: '<path d="M40 62 Q50 77 60 62z" fill="' + mc + '"/><path d="M45 68.500 Q50 72 55 68.500 Q50 66.500 45 68.500z" fill="#ff8a8a"/>',
      angry: '<path d="M43 68 Q50 61 57 68" fill="none" stroke="' + mc + '" stroke-width="2.800" stroke-linecap="round"/>', impatient: '<path d="M44 66 H57" fill="none" stroke="' + mc + '" stroke-width="2.800" stroke-linecap="round"/>',
      nervous: '<path d="M42 66 q3.500-3.500 7 0 t7 0" fill="none" stroke="' + mc + '" stroke-width="2.600" stroke-linecap="round"/>', sad: '<path d="M44 68 Q50 63 56 68" fill="none" stroke="' + mc + '" stroke-width="2.600" stroke-linecap="round"/>',
      surprised: '<ellipse cx="50" cy="67" rx="4.200" ry="5.400" fill="' + mc + '"/>' };
    v += mouths[m] || mouths.normal;
    if (a.santa) v += '<path d="M50 60 Q42 56 32 62 Q40 68 50 63 Q60 68 68 62 Q58 56 50 60z" fill="#fff" stroke="#dfe3ea" stroke-width=".800"/>';
    if (m === 'nervous') v += '<path d="M80 30 q4 6 0 9 q-4-3 0-9z" fill="#57b8ff"/>';
    if (m === 'angry') v += '<g stroke="#e10600" stroke-width="2.200" stroke-linecap="round"><path d="M80 24l5-4M82 30h6M80 18l2-5"/></g>';
    return v + '</g></svg>';
  }
  GS.faceSvg = avatarSvg;
  function showAvatar(then) {
    const a = Object.assign({ skin: GS.SKINS[2], hair: GS.HAIRS[0], hairStyle: 'corto', glasses: false, beard: false, lips: false }, GS.Store.get('avatar') || {}), hex = n => '#' + n.toString(16).padStart(6, '0');
    const sw = (key, list) => '<div class="sw" data-k="' + key + '">' + list.map(c => '<button style="background:' + hex(c) + '" data-c="' + c + '" class="' + (a[key] === c ? 'on' : '') + '"></button>').join('') + '</div>';
    modal('<h2>' + (GS.Store.get('introSeen') ? 'Tu personaje' : 'Primero, armá tu personaje') + '</h2><p>Sos quien atiende el mostrador. Combiná lo que quieras; después lo podés cambiar desde Opciones.</p><div class="avprev" id="avPrev"></div>' +
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
  // Menú de inicio (Campaña, Arcade, Logros, Cómo se juega, Opciones) y ventana de la campaña (jornada, sucursales, mejoras y avance de la sucursal donde estás)
  const ACC = { pampeana: '#e10600', cuyo: '#b9783f', noa: '#d9683c', nea: '#2f9a48', patagonia: '#3f86c9', malvinas: '#4f9a78' }; let menuView = 'main';
  const started = () => !!GS.Store.get('introSeen') || (GS.Store.get('days') || 0) > 0;
  function setMenu(v) { menuView = v === 'camp' && started() ? 'camp' : 'main'; $('menuMain').hidden = menuView !== 'main'; $('menuCamp').hidden = menuView !== 'camp'; $('start').scrollTop = 0; }
  function refreshStart() {
    const n = dayNumber(), fresh = n <= GS.UNLOCKS.length ? GS.UNLOCKS[n - 1] : [], R = RG(brId());
    $('campT').textContent = started() ? 'Seguir campaña' : 'Iniciar campaña'; $('campS').textContent = started() ? 'Jornada ' + n + ' · ' + R.city + ' · ' + MAIN.filter(r => (brAll()[r.id] || {}).open).length + ' de 5 sucursales' : 'Llevá GameShop a todo el país';
    { const rd = readyDuel(brId()), rv = RV(brId()); $('playT').textContent = rd ? '⚔️ Día de competencia' : 'Comenzar jornada ' + n; $('playS').textContent = rd ? 'Contra ' + rv.name + ((brNow().tries || 0) ? ' · revancha' : '') + ' · jornada ' + n : monthOf(n) + (n === 1 ? ' · inducción' : fresh.length > 2 ? ' · ' + fresh.length + ' tareas nuevas' : fresh.length ? ' · se suma: ' + fresh.map(id => ST(id).name).join(' y ') : ''); }
    $('btnShop').innerHTML = goalCard(); $('btnPlot').innerHTML = sucCard(); $('campProg').innerHTML = expCard() + progBox(brId(), 'Avance de ' + R.city);
    $('campHead').style.background = 'linear-gradient(100deg, ' + ACC[R.id] + ', rgba(20,20,24,.92) 130%)'; $('campHead').innerHTML = '<small>' + (R.id === 'pampeana' ? 'Casa central' : 'Sucursal ' + R.name) + '</small><b>' + R.city + '</b><span>⭐ ' + repTxt(repNow()) + ' · 🪙 ' + (DEV() ? '∞' : coinsNow()) + (RV(R.id) ? ' · ' + (won(R.id) ? '🏆 rival vencido' : RV(R.id).mark + ' ' + RV(R.id).name) : '') + '</span>';
    $('rankT').textContent = (DEV() ? '🛠 DEV · ' : '') + (GS.Store.get('ngp') ? '➕ NJ+' + GS.Store.get('ngp') : ''); $('rankT').hidden = !$('rankT').textContent; setMenu(menuView);
  }
  function goHome() {
    A.play('click'); A.setMood('menu'); clearDay(); $('rain').hidden = true; $('final').hidden = true; $('intro').hidden = true; setSky(0.3, false);
    day = null; state = 'menu'; paused = false;
    $('end').hidden = true; $('hud').hidden = true; $('jobs').hidden = true; $('start').hidden = false; $('toasts').innerHTML = ''; W.showAll(); setMenu('camp'); refreshStart();
  }

  /* ---------------- Escena final: el Dueño sale, los clientes festejan y queda la tarjeta ---------------- */
  let lastCard = null;
  function startFinal() {
    A.unlock(); clearDay(); ['rain', 'end', 'start', 'hud', 'jobs', 'modal', 'finCard'].forEach(id => { $(id).hidden = true; }); $('toasts').innerHTML = '';
    $('final').hidden = false; $('final').classList.remove('party'); $('finSkip').hidden = false; setSky(0.97, false);
    if (!$('confetti').children.length) $('confetti').innerHTML = Array.from({ length: 36 }, (_, i) => '<i style="left:' + (i * 2.8 + Math.random() * 2).toFixed(1) + '%;background:' + ['#ff0000', '#fff', '#f5c518', '#57e6ff'][i % 4] + ';animation-duration:' + (2.6 + Math.random() * 2.4).toFixed(2) + 's;animation-delay:-' + (Math.random() * 4).toFixed(2) + 's"></i>').join('');
    day = newDay({ fin: { i: -1, t: 3.2, crowd: [], done: false } }); state = 'final'; paused = false; W.setUpgrades(upNow()); A.setMood('final'); A.play('fanfare');
    W.focusAt(0.6, -1.4, 0.66, -0.08);
    const d = day, f = d.fin, bx = 4.3, bz = -0.5, dx = L.puerta.x;
    const spots = [[-3.3, -1.7], [-1.9, -0.9], [-0.5, -1.8], [0.5, -0.9], [-1.7, 0.6], [-1.0, 1.5], [-0.1, 0.5], [-4.6, -1.2], [1.6, -1.6]];
    const tr = tierNow(); f.tier = tr;
    f.lines = GS.FINAL.boss.map(x => x.replace('{rank}', tr.title).replace('{fondo}', '🪙 ' + fondoNow()).replace('{meta}', goalNow()).replace('{resultado}', tr.line));
    GS.CUSTOMERS.forEach((ar, i) => {
      const k = ar.id.charCodeAt(0) + ar.id.length * 7, sp = spots[i % spots.length];
      const p = W.makePerson(Object.assign(lookOf(ar), { speed: 3.6 }));
      p.setPos(dx + U.rnd(-0.4, 0.4), L.salon.zMax + 0.6 + i * 0.7); d.extras.push(p); f.crowd.push(p);
      p.walk([[dx, 3.4], sp], () => p.face(Math.atan2(bx - sp[0], bz - sp[1])));
    });
    const boss = W.boss(); d.dueno = boss;
    setTimeout(() => { if (day === d) boss.walk([[7.3, -0.3], [bx, bz]], () => boss.face(-1.25)); }, 1200);
    GS.track('final_visto', {});
  }
  function updateFinal(dt) {
    const f = day.fin;
    if (f.done && (f.t -= dt) <= 0) { f.t = 3.4; sayAt(U.pick(f.crowd), U.pick(GS.FINAL.crowd), 0, '', true, true); }
    if (!f.done && (f.t -= dt) <= 0) {
      f.i++;
      if (f.i < f.lines.length) {
        sayAt(W.boss(), f.lines[f.i], 0, 'boss'); f.t = 8.2;
        if (f.i >= 2) $('final').classList.add('party');
        if (f.i >= 1) { const d = day; setTimeout(() => { if (day !== d) return; sayAt(U.pick(f.crowd), U.pick(GS.FINAL.crowd), 0, '', false, true); }, 600); }
      } else finishFinal();
    }
    updateLabels(dt);
  }
  function finishFinal() {
    const f = day && day.fin; if (!f || f.done) return; f.done = true; GS.Store.set('finalSeen', true); GS.Store.set('final2Seen', true); const hh = histAll(), closed = GS.STORIES.filter(S => hh[S.id] && hh[S.id].done).length;
    day.says.forEach(x => x.el.remove()); day.says = []; day.sayQ = []; f.t = 0.5; $('final').classList.add('party'); $('finSkip').hidden = true; A.play('fanfare');
    $('finCard').innerHTML = '<h2>Fin de la <span>temporada</span></h2><p><b>' + f.tier.title + '</b>. ' + f.tier.line + '</p><p>Rivales vencidos: ' + MAIN.filter(r => conquered(r.id)).length + ' de 5 · Historias cerradas: ' + closed + ' de ' + GS.STORIES.length + '. El local sigue abierto: podés seguir jugando para alcanzar otro final y cerrar las historias que faltan.</p>' +
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
      { const pw = 700, ph = 250, px = (W_ - pw) / 2, py = 58, gd = g.createLinearGradient(px, py, px + pw, py + ph); [[0, '#8a5a00'], [0.18, '#f5c518'], [0.32, '#fff3b0'], [0.46, '#f5c518'], [0.62, '#9a6a00'], [0.8, '#ffe27a'], [1, '#b8860b']].forEach(q => gd.addColorStop(q[0], q[1]));
        g.save(); g.shadowColor = 'rgba(245,197,24,.45)'; g.shadowBlur = 40; g.fillStyle = gd; g.beginPath(); g.roundRect(px, py, pw, ph, 40); g.fill(); g.restore(); g.fillStyle = '#000'; g.beginPath(); g.roundRect(px + 9, py + 9, pw - 18, ph - 18, 32); g.fill();
        if (im[0]) { const lw = 600, lh = lw * im[0].height / im[0].width; g.drawImage(im[0], (W_ - lw) / 2, py + 20, lw, lh); }
        g.fillStyle = '#fff'; g.font = '900 34px "Arial Black", "Helvetica Neue", Arial, sans-serif'; const t = 'L A   E X P A N S I Ó N', tw = g.measureText(t).width; g.fillText(t, W_ / 2, py + 208); g.fillStyle = '#e10600'; g.fillRect(px + 44, py + 194, (pw - 88 - tw) / 2 - 22, 5); g.fillRect(W_ / 2 + tw / 2 + 22, py + 194, (pw - 88 - tw) / 2 - 22, 5); }
      // personaje en un círculo
      g.fillStyle = '#fff'; g.beginPath(); g.arc(W_ / 2, 560, 218, 0, 7); g.fill(); g.fillStyle = '#e9e9ee'; g.beginPath(); g.arc(W_ / 2, 560, 204, 0, 7); g.fill();
      if (im[1]) { g.save(); g.beginPath(); g.arc(W_ / 2, 560, 204, 0, 7); g.clip(); try { g.drawImage(im[1], W_ / 2 - 190, 372, 380, 472); } catch (e) {} g.restore(); }
      g.lineWidth = 10; g.strokeStyle = '#ff0000'; g.beginPath(); g.arc(W_ / 2, 560, 223, 0, 7); g.stroke();
      // rango
      const rk = (MAIN.filter(r => (brAll()[r.id] || {}).open).length + ' de 5 sucursales · jornada ' + n).toUpperCase(); g.font = F(64); const rw = Math.min(940, g.measureText(rk).width + 90);
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
      modal('<h2>Tu tarjeta</h2><img class="cardimg" id="cardImg" alt="Tarjeta de GameShop: La Expansión" src="' + data + '"><button class="btn" id="cardShare" hidden>Compartir</button>' +
        '<a class="btn ' + (navigator.share ? 'ghost' : '') + '" id="cardDown" download="gameshop-la-expansion.png" href="' + data + '">Descargar imagen</a><button class="btn ghost" data-close>Cerrar</button>');
      cv.toBlob(blob => {
        if (!blob || !navigator.share || !window.File || !$('cardShare')) return;
        const file = new File([blob], 'gameshop-la-expansion.png', { type: 'image/png' });
        if (navigator.canShare && !navigator.canShare({ files: [file] })) return;
        $('cardShare').hidden = false;
        $('cardShare').addEventListener('click', () => { GS.track('compartir', {}); navigator.share({ files: [file], title: 'GameShop: La Expansión', text: GS.FINAL.card[0].replace('{n}', Math.max(1, GS.Store.get('days') || 0)) + ' ¿Te animás a un turno?' }).catch(() => {}); });
      }, 'image/png');
    });
  }

  /* ---------------- Datos de prueba: lo que se mide en cada jornada, para ajustar la curva con números ---------------- */
  function showMetrics() {
    const ms = GS.Store.get('metrics') || [], mmss = v => Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0'), avg = k => ms.length ? Math.round(ms.reduce((a, m) => a + m[k], 0) / ms.length) : 0;
    const by = {}; ms.forEach(m => { for (const k in m.mt) { const b = by[k] = by[k] || { n: 0, s: 0, e: 0 }; b.n += m.mt[k].n; b.s += m.mt[k].s; b.e += m.mt[k].e; } });
    const txt = 'GameShop: La Expansión ' + C.version + ' · datos de prueba\n' + ms.map(m => 'J' + m.n + ' ' + m.modo + ' · ' + mmss(m.seg) + ' (minijuegos ' + mmss(m.mg) + ') · monedas ' + m.monedas + ' · atendidos ' + m.at + ' · perdidos ' + m.per + ' · tareas ' + m.tar + ' (tarde ' + m.tarde + ') · errores ' + m.err + ' · rep ' + m.rep).join('\n') +
      '\n' + Object.keys(by).map(k => k + ': ' + by[k].n + ' veces, ' + (by[k].s / Math.max(1, by[k].n)).toFixed(1) + ' s c/u, ' + by[k].e + ' errores').join('\n');
    modal('<h2>Datos de prueba</h2>' + (ms.length ? '<p>Últimas ' + ms.length + ' jornadas. Promedio: <b>' + mmss(avg('seg')) + '</b> por jornada y <b>🪙 ' + avg('monedas') + '</b>. La meta es unos 3:00.</p>' +
      '<div class="mtable"><table><tr><th>Jorn.</th><th>Duración</th><th>🪙</th><th>Atend.</th><th>Perd.</th><th>Errores</th></tr>' + ms.slice().reverse().map(m => '<tr><td>' + m.n + (m.modo === 'Tranquilo' ? ' 🧘' : '') + '</td><td>' + mmss(m.seg) + '</td><td>' + m.monedas + '</td><td>' + m.at + '</td><td>' + m.per + '</td><td>' + m.err + '</td></tr>').join('') + '</table></div>' +
      '<p style="font-size:13px;color:var(--mute);margin:0">Por tarea: ' + Object.keys(by).map(k => (ST(k) ? ST(k).short || ST(k).name : k) + ' ' + (by[k].s / Math.max(1, by[k].n)).toFixed(0) + ' s' + (by[k].e ? ' (' + by[k].e + ' err.)' : '')).join(' · ') + '</p>' +
      '<button class="btn" id="mCopy">Copiar para mandar</button>' : '<p>Todavía no hay jornadas medidas. Jugá una y volvé.</p>') + '<button class="btn ghost" data-close>Cerrar</button>');
    if ($('mCopy')) $('mCopy').addEventListener('click', () => { const ok = () => toast('Copiado. Pegalo en un mensaje.', '', 2000); if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok, () => window.prompt('Copiá este texto:', txt)); else window.prompt('Copiá este texto:', txt); });
  }
  /* ---------------- Modo carrera: la primera vez, unas placas cortas presentan el local, la gente y la trama ---------------- */
  function careerStart() {
    A.unlock();
    if (!GS.Store.get('avatar') || (dayNumber() === 1 && !GS.Store.get('introSeen') && !GS.Store.get('avOk'))) return showAvatar(() => { GS.Store.set('avOk', true); careerStart(); });
    if (dayNumber() === 1 && !GS.Store.get('introSeen')) return showOnboard(() => showIntro(() => startDay(false)));
    startDay(false);
  }
  function showIntro(then) {
    A.play('click'); state = 'intro'; $('start').hidden = true; let ended = false;
    const done = () => { if (ended) return; ended = true; closeEpic(); GS.Store.set('introSeen', true); GS.Store.set('plotIntro', true); GS.track('intro_carrera', {}); then(); };
    showEpic(GS.INTRO, null, '<button class="btn" id="inGo">¡A trabajar!</button>', () => $('inGo').addEventListener('click', () => { A.play('click'); done(); }), true);
  }

  /* ---------------- Modales: cómo se juega, récords, opciones, pausa ---------------- */
  function showHow(fromDay) {
    if (fromDay) paused = true;
    modal('<h2>Cómo se juega</h2><ul class="how">' +
      '<li><i>🚪</i><span>La jornada viene en <b>tandas</b>: entran unos pocos clientes y tareas, los resolvés y hay un respiro. Lo pendiente se muestra <b>abajo</b>.</span></li>' +
      '<li><i>👆</i><span>Tocá un pendiente para resolverlo: son minijuegos de unos segundos.</span></li>' +
      '<li><i>💵</i><span>Al cobrar acordate: 10% OFF en efectivo o transferencia, 3 cuotas sin interés con tarjeta.</span></li>' +
      '<li><i>🔥</i><span>Encadená aciertos para armar <b>racha</b>. Si te equivocás no perdés nada: solo hay un chiste.</span></li>' +
      '<li><i>🚶</i><span>No hace falta caminar: <b>tocá el pedido</b> y tu personaje va solo hasta ahí.</span></li>' +
      '<li><i>⚠️</i><span>Equivocarse cuesta: con el <b>producto equivocado</b> el cliente se va, y <b>cobrar mal</b> baja la reputación y la recaudación.</span></li>' +
      '<li><i>🧹</i><span>En los ratos libres <b>limpiá</b> las manchas del piso. A veces hay <b>interrupciones</b>: se contestan con un toque.</span></li>' +
      '<li><i>🔎</i><span>Arrastrá para mover el local y pellizcá (o usá la rueda) para acercar.</span></li></ul>' +
      '<button class="btn" data-close>¡A laburar!</button>', () => { if (fromDay) paused = false; });
  }
  function statsNow() { const t = Object.assign({ c: 0, d: 0, caught: 0, web: 0, clean: 0, sales: 0, perfect: 0, streak: 0, vueltoMal: 0, limpio: 0, sucio: 0, santa: 0 }, GS.Store.get('tot') || {}); t.rep = repNow(); t.flota = upNow().flota || 0; return t; }
  function checkLogros() { const st = statsNow(), have = GS.Store.get('ach') || [], fresh = GS.ACHIEVEMENTS.filter(a => have.indexOf(a.id) < 0 && a.test(st)); if (fresh.length) GS.Store.set('ach', have.concat(fresh.map(a => a.id))); return fresh; }
  function showLogros() {
    const have = GS.Store.get('ach') || [];
    modal('<div class="gold-h"><i></i><b>Logros</b><i></i></div><p class="ach-n"><b>' + have.length + '</b> de ' + GS.ACHIEVEMENTS.length + '<span class="map-bar"><i style="width:' + (have.length / GS.ACHIEVEMENTS.length * 100) + '%"></i></span></p><div class="medals">' + GS.ACHIEVEMENTS.map(a => { const ok = have.indexOf(a.id) >= 0;
      return '<div class="' + (ok ? 'on' : '') + '"><i>' + (ok ? a.ic : a.hidden ? '❔' : '🔒') + '</i><b>' + (ok || !a.hidden ? a.name : '???') + '</b><small>' + (ok || !a.hidden ? a.d : 'Logro oculto: aparece cuando lo conseguís') + '</small></div>'; }).join('') + '</div><button class="btn" data-close>Cerrar</button>');
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
    const row = (ic, t, sub, ctl) => '<div class="setting"><i>' + ic + '</i><span>' + t + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + ctl + '</div>', bt = (id, t) => '<button class="btn ghost" id="' + id + '">' + t + '</button>';
    modal('<div class="gold-h"><i></i><b>Opciones</b><i></i></div><div class="opts-box">' +
      '<h5>Sonido</h5>' + row('🔊', 'Sonido', '', seg('mute', [['0', 'Sí'], ['1', 'No']], A.isMuted() ? '1' : '0')) + row('🎵', 'Música', '', seg('music', [['0', 'No'], ['1', 'Suave'], ['2', 'Normal']], String(A.musicLevel()))) +
      '<h5>Pantalla</h5>' + row('✨', 'Calidad gráfica', 'Auto elige según tu equipo', seg('quality', [['auto', 'Auto'], ['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']], q)) + row('🔠', 'Texto grande', '', seg('big', [['0', 'No'], ['1', 'Sí']], GS.Store.get('big') ? '1' : '0')) + row('🌙', 'Reducir movimiento', 'Menos animaciones', seg('calm', [['0', 'No'], ['1', 'Sí']], calm ? '1' : '0')) +
      '<h5>Partida</h5>' + row('🙂', 'Tu personaje', '', bt('optAv', 'Cambiar')) +
      row('🔄', 'Temporada nueva', 'Vuelve a la jornada 1 y reinicia las historias. Conserva monedas y mejoras', bt('optDay1', 'Empezar')) + row('🗑️', 'Borrar todo', 'Jornadas, monedas, mejoras y logros', bt('optReset', 'Borrar')) +
      (DEV() ? '<h5>🛠 Herramientas de prueba</h5>' + row('📅', 'Jornada', '', seg('testDay', [['0', 'Auto'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['8', '8']], String(GS.Store.get('testDay') || 0))) + row('🌦️', 'Clima', '', seg('testCond', [['', 'Auto'], ['ninguna', 'Normal'], ['lluvia', 'Lluvia'], ['blackfriday', 'Black Friday'], ['navidad', 'Navidad']], GS.Store.get('testCond') || '')) +
        (fromPause ? '' : row('🏁', 'Completar esta sucursal', 'Todas las mejoras, 5 estrellas e historias en ' + RG(brId()).city, bt('optDevDone', 'Completar')) + row('🎬', 'Final del juego', '', bt('optFinal', 'Ver')) + row('🏴‍☠️', 'Final de Malvinas', '', bt('optFinalM', 'Ver'))) + row('📊', 'Datos de prueba', 'Duración, monedas y errores por jornada', bt('optData', 'Ver')) : '') +
      '</div><button class="btn" data-close>Listo</button>', () => { if (fromPause) showPause(); });
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
    $('optDay1').addEventListener('click', e => { GS.Store.set('days', 0); GS.Store.set('seen', {}); GS.Store.set('testDay', 0); ['hist', 'fondo', 'goalAdj', 'final2Seen', 'plotIntro', 'gflags', 'introSeen', 'xmas'].forEach(k => GS.Store.set(k, null)); refreshStart(); e.target.textContent = 'Listo ✔'; });
    $('optAv').addEventListener('click', () => showAvatar(() => showOptions(fromPause)));
    if ($('optData')) $('optData').addEventListener('click', showMetrics);
    if ($('optDevDone')) $('optDevDone').addEventListener('click', () => { const up = {}, h = histAll(), id = brId(); GS.UPGRADES.forEach(g => { up[g.id] = g.levels.length; }); GS.STORIES.forEach(S => { if (!S.once && (S.reg || 'pampeana') === id) h[S.id] = Object.assign({ notes: [], flags: {} }, h[S.id], { done: 1, step: S.steps.length, last: dayNumber() }); });
      GS.Store.set('up', up); GS.Store.set('rep', 5); GS.Store.set('hist', h); brSave(); applyBranch(); refreshStart(); A.play('ok'); toast('<b>🛠 ' + RG(id).city + ' completa</b>El final se dispara al cerrar una jornada con todo completo.', '', 3800); showOptions(fromPause); });
    if ($('optFinal')) $('optFinal').addEventListener('click', () => { modalOnClose = null; showFinal(!GS.Store.get('finalN')); });
    if ($('optFinalM')) $('optFinalM').addEventListener('click', () => { modalOnClose = null; showFinalM(); });
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
    if (mem <= 2 || cores <= 2) return 'baja';
    return mobile ? 'media' : 'alta';
  }

  /* ---------------- Bucle principal ---------------- */
  let fpsT = 0, fpsN = 0, autoQ = 'media', skyKey = '';
  // La vereda y el fondo acompañan la hora del juego: mañana fresca, mediodía claro, tarde dorada y anochecer con el farol prendido
  function setSky(f, rain) {
    f = U.clamp(f, 0, 1); const reg = true, key = Math.round(f * 60) + (rain ? 'r' : '') + brId(); if (key === skyKey) return; skyKey = key;
    const stops = [[0, [34, 62, 92]], [0.35, [46, 86, 128]], [0.62, [118, 70, 34]], [0.85, [92, 40, 52]], [1, [22, 18, 52]]]; let c = stops[0][1];
    for (let i = 1; i < stops.length; i++) if (f <= stops[i][0]) { const a = stops[i - 1], b = stops[i], k = (f - a[0]) / (b[0] - a[0]); c = a[1].map((v, j) => Math.round(v + (b[1][j] - v) * k)); break; }
    if (rain) c = c.map(v => Math.round(v * 0.45 + 30));
    if (reg) document.body.style.background = 'linear-gradient(rgb(' + c.map(v => Math.min(255, Math.round(v * 1.5 + 70))).join(',') + ') 0%, rgb(' + c.map(v => Math.min(255, Math.round(v * 0.9 + 140))).join(',') + ') 60%)';     // en las sucursales hay cielo y horizonte
    else document.body.style.background = 'radial-gradient(120% 90% at 50% 35%, rgb(' + c.join(',') + ') 0%, rgb(' + c.map(v => Math.round(v * 0.35)).join(',') + ') 50%, #000 100%)';
    W.setDayTime(f, rain);
  }
  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden) { lastT = t; return; }             // pestaña oculta: no se dibuja ni corre el reloj
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0) * (GS.DEBUG_SPEED || 1); lastT = t;
    if (state === 'day' && day && !paused) { day.tt = (day.tt || 0) + dt; if (MG.isOpen()) day.tj = (day.tj || 0) + dt; }      // medición: segundos de jornada y segundos dentro de minijuegos
    if (state === 'day' && !paused) updateDay(dt);
    if (state === 'final' && !paused) updateFinal(dt);
    if (!paused) updateStaff(dt);
    if (state === 'day' && day && !paused && day.lesson) updateLesson(dt);
    // calidad automática: si el equipo no llega a unos 22 cuadros por segundo durante un rato, baja un escalón sola
    if ((GS.Store.get('quality') || 'auto') === 'auto' && dt > 0) { fpsT += dt; fpsN++; if (fpsT >= 4) { const fps = fpsN / fpsT; fpsT = fpsN = 0; if (fps < 22 && autoQ !== 'baja') { autoQ = autoQ === 'alta' ? 'media' : 'baja'; W.setQuality(autoQ); GS.track('calidad_auto', { nivel: autoQ }); } } }
    if (!paused && (walkT -= dt) <= 0 && walkers < 4) {                 // peatones: pasan por la vereda y siguen de largo
      walkT = U.rnd(3, 7) * (day && day.cond === 'lluvia' ? 2.2 : 1); walkers++;
      const dir = Math.random() < 0.5 ? 1 : -1, z = L.galeria.zMax + U.rnd(1.6, 2.6), hs = U.pick(GS.HAIRSTYLES)[0];
      const w = W.makePerson(warm({ shirt: U.pick([0x6b7a8f, 0x3d7a4a, 0xd9a514, 0x4a6fb5, 0xb86fa8, 0x21a0a0, 0x555560]), hair: U.pick(GS.HAIRS), hairStyle: hs, glasses: Math.random() < 0.3, beard: Math.random() < 0.2, speed: U.rnd(1.3, 2) }));
      w.setPos(-7.5 * dir, z); w.walk([[7.5 * dir, z]], () => { w.remove(); walkers--; });
    }
    W.update(paused ? 0 : dt, dt); W.render();
  }

  function boot() {
    $('logoImg').src = GS.LOGO; refreshStart();
    $('phasesStart').innerHTML = phasesCompact();
    $('chipPhase').hidden = true; $('phasesStart').hidden = true;
    const q = GS.Store.get('quality') || 'auto';
    autoQ = autoQuality(); W.setQuality(q === 'auto' ? autoQ : q);
    if (!W.init($('c'))) {
      modal('<h2>Ups</h2><p>Este navegador no pudo iniciar los gráficos 3D. Probá actualizarlo o abrir el juego en otro navegador.</p>');
      return;
    }
    staffInit(); applyBranch(); GS.Arcade.bind(); if (C.launched && $('fineT')) $('fineT').firstChild.textContent = 'Precios y stock ficticios.'; if ($('btnStore')) $('btnStore').hidden = true;      // el enlace a la tienda aparece solo en el final setSky(0.3, false); document.body.classList.toggle('big', !!GS.Store.get('big')); if (C.launched) { $('phasesStart').hidden = true; $('chipPhase').hidden = true; document.querySelector('.fine').firstChild.textContent = 'Precios y stock ficticios.'; }
    GS.track.init(); GS.track('abrir_juego', { jornada: dayNumber() }); window.addEventListener('error', e => GS.track('error_js', { msg: String(e.message).slice(0, 80) }));
    if ($('btnWeb')) { if (C.links.tienda) { $('btnWeb').href = C.links.tienda; $('btnWeb').addEventListener('click', () => GS.track('click_tienda', { desde: 'menu' })); } else $('btnWeb').hidden = true; }
    if (C.links.tienda) { $('btnStore').href = C.links.tienda;      // queda oculto: el enlace a la tienda se muestra solo en el final
      $('btnStore').addEventListener('click', () => GS.track('click_tienda', { desde: 'inicio' })); }
    setCalm(!!GS.Store.get('calm')); syncMute(); W.showAll(); W.setUpgrades(upNow()); W.setPlayerLook(GS.Store.get('avatar'));
    $('btnShop').addEventListener('click', openShop); $('shopDone').addEventListener('click', closeShop);
    $('shopFund').addEventListener('click', e => { const b = e.target.closest('[data-fund]'); if (!b) return; const c = coinsNow(), v = Math.min(c, Number(b.dataset.fund) || c); if (v <= 0) return;
      const before = fondoNow() >= goalNow(); GS.Store.set('coins', c - v); addFondo(v); A.play('cash'); GS.track('aporte_fondo', { monto: v });
      toast(!before && fondoNow() >= goalNow() ? '<b>🏠 ¡Meta alcanzada!</b>Ya alcanza para el local de al lado. Lo que sumes de más mejora el final.' : '<b>🏠 Aportaste 🪙 ' + v + '</b>Fondo: ' + fondoNow() + ' de ' + goalNow() + '.', '', 2600); renderShop(); });
    $('btnPlot').addEventListener('click', () => { A.unlock(); A.play('click'); showMap(); });
    $('coachOk').addEventListener('click', () => { $('coach').hidden = true; A.play('click'); }); setInterval(guideTick, 180);
    $('mapX').addEventListener('click', () => { A.play('click'); closeMap(); }); $('mapZi').addEventListener('click', () => { A.play('click'); GS.Map3D.zoom(1.4); }); $('mapZo').addEventListener('click', () => { A.play('click'); GS.Map3D.zoom(1 / 1.4); }); $('mapLib').addEventListener('click', () => { closeMap(); showLibreta(); });
    $('mapCard').addEventListener('click', e => { const g = e.target.closest('[data-go]'), o = e.target.closest('[data-open]'); if (g) { closeMap(); leaveTo(g.dataset.go); } else if (o && !o.disabled) { closeMap(); openRegion(o.dataset.open); } });
    const shopStep = k => { if (state !== 'shop') return; shopSel = (shopSel + k + GS.UPGRADES.length) % GS.UPGRADES.length; A.play('click'); renderShop(); const on = $('shopSlots').querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' }); };
    $('shopPrev').addEventListener('click', () => shopStep(-1)); $('shopNext').addEventListener('click', () => shopStep(1));
    $('shopSlots').addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { $('shopSlots').scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    $('shopSlots').addEventListener('click', e => { const b = e.target.closest('.slotb'); if (b) { shopSel = Number(b.dataset.i); A.play('click'); renderShop(); } });
    $('shopCards').addEventListener('click', e => { const sl = e.target.closest('[data-slot]'); if (sl) { const x = $('shopCards').scrollLeft; A.play('drop'); setLay(GS.UPGRADES[shopSel].id, Number(sl.dataset.slot)); renderShop(); $('shopCards').scrollLeft = x; return; } const b = e.target.closest('[data-buy]'), c = e.target.closest('[data-see]'); if (b && !b.disabled) return buy(Number(b.dataset.buy)); if (c) { const x = $('shopCards').scrollLeft; A.play('click'); renderShop(Number(c.dataset.see)); $('shopCards').scrollLeft = x; } });
    $('shopCards').addEventListener('scroll', () => { const el = $('shopCards'), i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth * 0.86)); if (el._i !== i) { el._i = i; const u = upNow(), g = GS.UPGRADES[shopSel], sh = Object.assign({}, u); sh[g.id] = Math.max(u[g.id] || 0, i + 1); W.setUpgrades(sh); } });
    W.onTap(st => openStation(st)); W.onGround(groundTap);
    $('btnPlay').addEventListener('click', careerStart);
    $('btnCamp').addEventListener('click', () => { A.unlock(); A.play('click'); if (started()) { setMenu('camp'); refreshStart(); } else careerStart(); });
    $('btnBack').addEventListener('click', () => { A.play('click'); setMenu('main'); });
    $('btnRelax').addEventListener('click', () => startDay(true));
    $('btnArcade').addEventListener('click', () => { A.unlock(); A.play('click'); showArcade(); });
    $('btnHow').addEventListener('click', () => { A.unlock(); A.play('click'); showHow(false); });
    $('btnRecs').addEventListener('click', () => { A.unlock(); A.play('click'); showLogros(); });
    $('btnOpts').addEventListener('click', () => { A.unlock(); A.play('click'); showOptions(false); });
    $('phasesStart').addEventListener('click', showPhases);
    $('chipPhase').addEventListener('click', () => { paused = true; showPhases(); modalOnClose = () => { paused = false; }; });
    $('finSkip').addEventListener('click', finishFinal);
    $('jobs').addEventListener('click', e => { const ib = e.target.closest('[data-intr]'); if (ib) return answerIntr(ib.dataset.intr === '1'); const b = e.target.closest('.job[data-i]'); if (b && jobList[b.dataset.i]) openJob(jobList[b.dataset.i]); });
    $('btnPause').addEventListener('click', showPause); $('btnLog').addEventListener('click', showLog);
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

  return { debugVisit: id => spawnVisit(GS.STORIES.find(x => x.id === id)), debugScene: (kind, id) => { epicCtx = { id }; showEpic([{ art: kind, k: 'Sucursal ' + RG(id).name, t: '¡Inauguración en ' + RG(id).city + '!', d: '' }], null, '', () => {}, true); }, groundTap, goHome, startDay, startArcade, startFinal, showCard, drawCard, debugIntr: () => spawnIntr(), openStation, openJob, pendingJobs, endDay, debugTask: id => spawnTask(ST(id)), state: () => state, day: () => day };
})();
