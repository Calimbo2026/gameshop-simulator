/* =====================================================================
   JUEGO — jornada, clientes, tareas de las estaciones, Arcade, puntaje,
   HUD, pantallas y bucle principal.
   ===================================================================== */
GS.Game = (function () {
  const U = GS.util, C = GS.CONFIG, L = GS.LAYOUT, LN = GS.LINES, W = GS.World, MG = GS.Minigames, A = GS.Audio;
  const $ = id => document.getElementById(id);
  const ST = id => GS.STATIONS.find(s => s.id === id);
  const TASK_STATIONS = GS.STATIONS.filter(s => s.task && !s.finalOnly);
  let state = 'menu', day = null, paused = false, lastT = 0, calm = false, uid = 0;

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
      cajaCount: 0, closing: false, jobSig: '', reqBag: U.shuffle(GS.REQUESTS), archBag: U.shuffle(GS.CUSTOMERS), taskBag: []
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
  const coinMult = () => { const u = upNow(); return 1 + 0.1 * ((u.mesa || 0) + (u.isla || 0) + (u.gondola || 0)); };
  const patMult = () => { const u = upNow(); return 1 + 0.15 * (u.escritorio || 0) + 0.1 * (u.sillas || 0); };
  function conditionFor(n) {
    const forced = GS.Store.get('testCond'); if (forced) return forced === 'ninguna' ? null : forced;             // fechas especiales fijas y lluvia al azar (nunca en las primeras jornadas)
    if (n >= 5 && n % 10 === 5) return 'blackfriday';
    if (n >= 10 && n % 10 === 0) return 'navidad';
    return n >= 3 && Math.random() < 0.3 ? 'lluvia' : null;
  }
  function planDay(n, cond) {
    const un = unlockedFor(n), pool = TASK_STATIONS.filter(s => un.indexOf(s.id) >= 0), u = upNow(), c = cond ? GS.CONDITIONS[cond] : null, r = repNow();
    let cust = Math.min(3 + n, 7) + (u.cartel || 0) + (u.arcade || 0) + (r >= 4 ? 1 : r < 2 ? -1 : 0) + (c ? c.cust : 0);   // cartel, arcade y reputación traen gente
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
    if (d.dueno) { sayAt(d.dueno, text, 5600, 'boss'); return; }
    const p = W.makePerson({ shirt: 0x111111, hair: 0xb4b4bd, hairStyle: 'mohicano', skin: 0xe0ac7e, scale: 1.18, speed: 3.4 }); d.dueno = p; d.extras.push(p);
    p.setPos(3.4, -6.3);
    p.walk([[3.4, -5.1]], () => {
      p.face(0.2); A.play('speaker'); sayAt(p, text, 5600, 'boss');
      setTimeout(() => { if (day !== d) return; p.walk([[3.4, -6.3]], () => { p.remove(); d.dueno = null; }); }, 5900);
    });
  }
  function planTotals(plan) { return plan.reduce((a, w) => ({ c: a.c + w.c, t: a.t + w.t + (w.ml || 0) }), { c: 0, t: 0 }); }
  function startWave() {
    day.wave++; day.stage = 'work'; day.queue = [];
    const w = day.plan[day.wave];
    for (let i = 0; i < w.c; i++) day.queue.push({ kind: 'c', t: 0.3 + i * C.day.customerGap });
    for (let i = 0; i < w.t; i++) day.queue.push({ kind: w.final ? 'f' : 't', t: (w.final ? 0.6 : 5) + i * C.day.taskGap });
    for (let i = 0; i < (w.ml || 0); i++) day.queue.push({ kind: 'm', t: 3 + i * C.day.taskGap });
    day.queue.sort((a, b) => a.t - b.t);
  }
  function endWave() {
    if (day.wave >= day.plan.length - 1) { day.closing = true; setTimeout(endDay, 2800); return; }
    day.stage = 'rest'; day.rest = C.day.restSeconds; W.focus(null); W.home();
    const d = day;
    setTimeout(() => {                       // en el respiro habla el Dueño, sin nada tapando el local
      if (day !== d || state !== 'day' || d.stage !== 'rest') return;
      if (!d.duenoBag.length) d.duenoBag = U.shuffle(LN.dueno);
      duenoSpeak(d.duenoBag.pop());
    }, 1100);
  }
  // Globito de diálogo sobre la cabeza de un personaje (el remate se ve en el salón, no en un cartel)
  function sayAt(person, text, ms, cls) {
    const el = document.createElement('div'); el.className = 'say ' + (cls || ''); el.textContent = text; $('labels').appendChild(el);
    day.says.push({ el, person, left: (ms || 3200) / 1000 });
  }
  function enterPlay() {
    $('start').hidden = true; $('end').hidden = true; $('hud').hidden = false; $('modal').hidden = true; $('toasts').innerHTML = '';
    paused = false; W.home();
  }
  function startDay(relaxed) {
    A.unlock();
    if (!GS.Store.get('avatar')) return showAvatar(() => startDay(relaxed));
    A.play('click'); clearDay(); W.setUpgrades(upNow());
    const n = dayNumber(), un = unlockedFor(n), fresh = n <= GS.UNLOCKS.length ? GS.UNLOCKS[n - 1] : [];
    const cond = conditionFor(n);
    day = newDay({ relaxed, n, cond, unlocked: un, plan: planDay(n, cond), rest: 7.5 }); state = 'day'; enterPlay(); $('jobs').hidden = false;
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
    MG.close(); W.focus(null);
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
    const person = W.makePerson({ shirt: arche.shirt, hair: arche.hair, hairStyle: GS.HAIRSTYLES[k % 5][0], glasses: k % 3 === 0, beard: k % 4 === 1, lips: k % 2 === 0 });
    const dx = L.puerta.x; person.setPos(dx + U.rnd(-0.5, 0.5), day.spawned === 0 ? L.salon.zMax + 1 : L.galeria.zMax + 2.4);
    const cu = { id: ++uid, arche, request: req.t, product, st: 'entering', pat: 1, person, slotM: slot, slotC: -1, label: makeLabel('❓') };
    day.customers.push(cu); day.spawned++;
    person.walk([[dx, L.salon.zMax + 0.2], [dx, -1.3], L.colaMostrador[slot]], () => { cu.st = 'waitM'; person.face(Math.PI); });
    setTimeout(() => A.play('bell'), 900);
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
      dp.walk([[dx, L.salon.zMax + 0.2], [dx, -0.6], [4.0, -0.6], [4.0, -4.3]], () => {
        if (day === d && d.tasks.indexOf(task) >= 0) task.boxes = W.dropBoxes(3.5, -5.6);
        dp.cargo(false); dp.walk([[4.0, -0.6], [dx, -0.6], [dx, L.salon.zMax + 0.2], [dx + 1.5, L.galeria.zMax + 3]], () => dp.remove());
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
    cu.person.walk([[-0.6, -0.9], [dx, L.salon.zMax + 0.2], [dx + U.rnd(-2, 2), L.galeria.zMax + 3]], () => {
      cu.person.remove(); cu.label.remove(); const i = d.customers.indexOf(cu); if (i >= 0) d.customers.splice(i, 1);
    });
  }
  function removeTask(task) { task.label.remove(); if (task.boxes) task.boxes.remove(); const i = day.tasks.indexOf(task); if (i >= 0) day.tasks.splice(i, 1); }

  function addScore(base, pat) {
    const mult = 1 + Math.min(day.combo, 8) * 0.25, pts = Math.round((base + Math.max(0, pat) * 100) * mult);
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
    const cb = {
      onMistake(kind) { breakCombo(); addRep(-0.02); if (kind === 'caja') day.cajaErr++; else day.otherErr++; if (!day.relaxed) ref.pat = Math.max(0.05, ref.pat - C.day.mistakeCost); },
      onEnd(ok, info) {
        if (job.type !== 'caja') W.focus(null);
        if (job.type === 'mostrador') {
          addScore(100, ref.pat); addRep(0.02); sayAt(ref.person, '¡Eso! Voy a la caja.', 1900); ref.st = 'toCaja'; ref.slotM = -1; ref.pat = Math.max(ref.pat, 0.8);
          ref.slotC = Math.max(0, freeSlot('slotC', L.colaCaja.length));
          ref.person.walk([[0.1, -2.1], L.colaCaja[ref.slotC]], () => { ref.st = 'waitC'; ref.person.face(Math.PI / 2); });
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
        } else { day.tasksDone++; addScore(130, ref.pat); addRep(job.type === 'whatsapp' ? 0.05 : 0.03); removeTask(ref); }
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
        while (day.queue.length && day.queue[0].t <= 0) { const q = day.queue.shift(); if (q.kind === 'c') spawnCustomer(); else spawnTask(q.kind === 'f' ? ST('cierre') : q.kind === 'm' ? ST('ml') : null); }
        if (!day.queue.length && !day.tasks.length && !open && day.customers.every(c => c.st === 'leaving')) endWave();
      }
    }
    // paciencia (en el turno tranquilo no baja)
    if (!day.relaxed) {
      for (const cu of day.customers.slice()) {
        if (cu.st === 'waitM' || cu.st === 'waitC') cu.pat -= dt / (cfg.patienceWait * patMult());
        else if ((cu.st === 'inM' || cu.st === 'inC') && !MG.isResolving()) cu.pat -= dt / cfg.patienceGame;
        if (cu.pat <= 0 && (cu.st === 'waitM' || cu.st === 'waitC' || cu.st === 'inM' || cu.st === 'inC')) {
          if (cu.st === 'inM' || cu.st === 'inC') { if (MG.isResolving()) { cu.pat = 0.01; continue; } MG.close(); W.focus(null); }
          day.lost++; breakCombo(); addRep(-0.15); A.play('lost');
          sayAt(cu.person, cu.arche.lost, 3600); toast('<b>' + cu.arche.name + ' se fue sin comprar</b>', '', 2200);
          leave(cu, false);
        }
      }
      for (const t of day.tasks.slice()) {
        if (t.st === 'wait') t.pat -= dt / cfg.taskPatience;
        else if (!MG.isResolving()) t.pat -= dt / (cfg.patienceGame * 1.3);
        if (t.pat <= 0) {
          if (t.st === 'in') { if (MG.isResolving()) { t.pat = 0.01; continue; } MG.close(); W.focus(null); }
          day.tasksLate++; breakCombo(); addRep(-0.08); A.play('lost');
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
    $('chipCombo').hidden = day.combo < 2; $('chipCombo').textContent = '🔥 racha x' + day.combo;
  }
  // Tarjetas de pendientes (abajo): hasta 4, primero lo más urgente
  let jobList = [];
  function updateJobs() {
    const all = pendingJobs(); jobList = all.slice(0, 4);
    const sig = jobList.map(j => j.key).join(',') + '|' + all.length, box = $('jobs');
    if (sig !== day.jobSig) {
      day.jobSig = sig;
      box.innerHTML = jobList.length
        ? jobList.map((j, i) => '<button class="job" data-i="' + i + '"><span class="ji">' + j.icon + '</span><span class="jt"><b>' + j.title + '</b><small>' + j.sub + '</small></span><span class="pb"><i></i></span><kbd>' + (i + 1) + '</kbd></button>').join('') +
          (all.length > 4 ? '<div class="more">+' + (all.length - 4) + ' más esperando</div>' : '')
        : '<div class="job idle"><span class="ji">☕</span><span class="jt"><b>Todo en orden</b><small>Respirá y mirá el local. Ya va a entrar alguien.</small></span></div>';
    }
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
    day = newDay({ arcade: id, round: 0, job: null, wait: 0.5 }); state = 'day'; enterPlay(); $('jobs').hidden = true;
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
    state = 'end'; MG.close(); W.focus(null); W.showAll(); A.play('endDay'); $('hud').hidden = true;
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
    state = 'end'; MG.close(); W.focus(null); W.showAll(); A.play('endDay'); $('rain').hidden = true;
    const d = day;
    d.customers.slice().forEach(c => { if (c.st !== 'leaving') leave(c, false); });
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
    const earned = Math.round(d.score / 20 * coinMult()); GS.Store.set('coins', coinsNow() + earned);
    const rv = repNow(), rd = rv - d.rep0; refreshStart();
    GS.track('fin_jornada', { puntaje: d.score, atendidos: d.served, tareas: d.tasksDone, perdidos: missed, estrellas: stars, modo: entry.mode });
    $('endCol').innerHTML =
      '<div><div class="ticket"><h3>CIERRE DE CAJA</h3><div class="c">Jornada ' + d.n + ' · ' + rankOf(d.n) + (d.cond ? ' · ' + GS.CONDITIONS[d.cond].name : '') + (d.relaxed ? ' · turno tranquilo' : '') + '</div>' +
      '<p><span>Clientes atendidos</span><b>' + d.served + '</b></p><p><span>Tareas del local hechas</span><b>' + d.tasksDone + '</b></p>' +
      '<p><span>Se fueron sin comprar</span><b>' + d.lost + '</b></p><p><span>Tareas que se pasaron</span><b>' + d.tasksLate + '</b></p>' +
      '<p><span>Errores (con chiste)</span><b>' + errs + '</b></p>' +
      (d.caught ? '<p><span>Comprobantes truchos frenados</span><b>' + d.caught + '</b></p>' : '') +
      '<p><span>Mejor racha</span><b>x' + d.bestCombo + '</b></p><p><span>Ventas (ficticias)</span><b>' + U.money(d.sales) + '</b></p>' +
      '<p><span>Monedas ganadas hoy</span><b>🪙 ' + earned + '</b></p><p><span>Reputación del local</span><b>⭐ ' + repTxt(rv) + ' (' + (rd >= 0 ? '+' : '−') + repTxt(Math.abs(rd)) + ')</b></p><hr>' +
      '<p class="tot"><span>PUNTAJE</span><b>' + d.score.toLocaleString('es-AR') + '</b></p><div class="stars">' + '★'.repeat(stars) + '<span style="opacity:.25">' + '★'.repeat(3 - stars) + '</span></div></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">' +
      (rankOf(d.n + 1) !== rankOf(d.n) && !GS.Store.get('testDay') ? '<div class="promo">🎖 ¡Ascenso!<b>Ahora sos ' + rankOf(d.n + 1) + '</b></div>' : '') +
      (pos === 0 ? '<div class="newrec">🏆 ¡Nuevo récord personal!</div>' : '') +
      '<div class="quote"><b>El Dueño opina</b>' + comment + '</div><p class="humanline">' + human + '</p>' +
      goalHtml() + '<button class="btn alt" id="endShop">🛠 Mejorar el local</button>' +
      '<button class="btn" id="endAgain">Siguiente jornada</button><div class="row"><button class="btn ghost" id="endHome">Inicio</button><button class="btn ghost" id="endRecs">Récords</button></div>' +
      '<button class="phases" id="phasesEnd"></button></div>';
    $('phasesEnd').innerHTML = phasesCompact(); $('phasesEnd').addEventListener('click', showPhases);
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
    A.unlock(); A.play('click'); state = 'shop'; $('start').hidden = true; $('end').hidden = true; $('shop').hidden = false; shopSel = 0;
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
    $('shopHint').textContent = own >= g.levels.length ? 'Ya lo tenés en el local.' : 'Vista previa en el local' + (g.levels.length > 1 ? ' · deslizá para ver los modelos' : '');
  }
  function buy(i) {
    const u = upNow(), g = GS.UPGRADES[shopSel], lv = g.levels[i]; if ((u[g.id] || 0) !== i || coinsNow() < lv.price) return;
    u[g.id] = i + 1; GS.Store.set('up', u); GS.Store.set('coins', coinsNow() - lv.price); A.play('cash'); toast('<b>¡Mejora comprada!</b>' + lv.n, '', 2600); renderShop();
  }
  function closeShop() { $('shop').hidden = true; W.setUpgrades(upNow()); state = 'menu'; $('start').hidden = false; refreshStart(); W.showAll(); A.play('click'); }
  function avatarSvg(a) {
    const hex = n => '#' + n.toString(16).padStart(6, '0'), h = hex(a.hair), st = a.hairStyle || 'corto';
    let v = '<svg viewBox="0 0 100 120" width="110" height="132"><path d="M36 118 L44 62 H56 L64 118z" fill="#e10600"/>';
    if (st === 'largo') v += '<path d="M22 44 q0 -30 28 -30 q28 0 28 30 v34 h-14 v-30 h-28 v30 h-14z" fill="' + h + '"/>';
    v += '<circle cx="50" cy="44" r="26" fill="' + hex(a.skin) + '"/>';
    if (st === 'corto' || st === 'largo' || st === 'rodete') v += '<path d="M24 42 q0 -26 26 -26 q26 0 26 26 q-14 -14 -52 0z" fill="' + h + '"/>';
    if (st === 'rodete') v += '<circle cx="50" cy="12" r="10" fill="' + h + '"/>';
    if (st === 'rulos') v += [[30, 26], [42, 18], [58, 18], [70, 26], [24, 38], [76, 38], [50, 14]].map(c => '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="10" fill="' + h + '"/>').join('');
    if (st === 'mohicano') v += '<path d="M44 26 L46 2 H54 L56 26z" fill="' + h + '"/>';
    if (a.beard) v += '<path d="M27 50 q23 44 46 0 q-6 6 -23 6 q-17 0 -23 -6z" fill="' + h + '"/>';
    v += '<circle cx="40" cy="42" r="3.500" fill="#111"/><circle cx="60" cy="42" r="3.500" fill="#111"/>';
    if (a.glasses) v += '<g fill="none" stroke="#111" stroke-width="3"><rect x="30" y="34" width="17" height="14" rx="4"/><rect x="53" y="34" width="17" height="14" rx="4"/><path d="M47 40h6"/></g>';
    v += a.lips ? '<path d="M42 56 q8 7 16 0 q-8 -4 -16 0z" fill="#d81e5b"/>' : '<path d="M43 56 q7 5 14 0" fill="none" stroke="#7a3b1e" stroke-width="2.500" stroke-linecap="round"/>';
    return v + '</svg>';
  }
  function showAvatar(then) {
    const a = Object.assign({ skin: GS.SKINS[2], hair: GS.HAIRS[0], hairStyle: 'corto', glasses: false, beard: false, lips: false }, GS.Store.get('avatar') || {}), hex = n => '#' + n.toString(16).padStart(6, '0');
    const sw = (key, list) => '<div class="sw" data-k="' + key + '">' + list.map(c => '<button style="background:' + hex(c) + '" data-c="' + c + '" class="' + (a[key] === c ? 'on' : '') + '"></button>').join('') + '</div>';
    modal('<h2>Tu personaje</h2><p>Sos quien atiende el mostrador. Combiná lo que quieras.</p><div class="avprev" id="avPrev"></div>' +
      '<div class="setting"><span>Piel</span>' + sw('skin', GS.SKINS) + '</div><div class="setting"><span>Pelo</span>' + sw('hair', GS.HAIRS) + '</div>' +
      '<div class="setting"><span>Peinado</span><div class="seg" id="avStyle">' + GS.HAIRSTYLES.map(h => '<button data-v="' + h[0] + '" class="' + (a.hairStyle === h[0] ? 'on' : '') + '">' + h[1] + '</button>').join('') + '</div></div>' +
      '<div class="setting"><span>Accesorios</span><div class="seg" id="avAcc">' + [['glasses', 'Anteojos'], ['beard', 'Barba'], ['lips', 'Labios pintados']].map(x => '<button data-v="' + x[0] + '" class="' + (a[x[0]] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div></div>' +
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
    A.play('click'); clearDay(); $('rain').hidden = true;
    day = null; state = 'menu'; paused = false;
    $('end').hidden = true; $('hud').hidden = true; $('jobs').hidden = true; $('start').hidden = false; $('toasts').innerHTML = ''; W.showAll();
  }

  /* ---------------- Modales: cómo se juega, récords, opciones, pausa ---------------- */
  function showHow(fromDay) {
    if (fromDay) paused = true;
    modal('<h2>Cómo se juega</h2><ul class="how">' +
      '<li><i>🚪</i><span>La jornada viene en <b>tandas</b>: entran unos pocos clientes y tareas, los resolvés y hay un respiro. Lo pendiente se muestra <b>abajo</b>.</span></li>' +
      '<li><i>👆</i><span>Tocá un pendiente para resolverlo: son minijuegos de unos segundos.</span></li>' +
      '<li><i>💵</i><span>Al cobrar acordate: 10% OFF en efectivo o transferencia, 3 cuotas sin interés con tarjeta.</span></li>' +
      '<li><i>🔥</i><span>Encadená aciertos para armar <b>racha</b>. Si te equivocás no perdés nada: solo hay un chiste.</span></li>' +
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
      '<div class="setting"><span>Calidad gráfica</span>' + seg('quality', [['auto', 'Auto'], ['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']], q) + '</div>' +
      '<div class="setting"><span>Reducir movimiento</span>' + seg('calm', [['0', 'No'], ['1', 'Sí']], calm ? '1' : '0') + '</div>' +
      '<div class="setting"><span>Tu personaje</span><button class="btn ghost" id="optAv" style="width:auto">Cambiar</button></div>' +
      '<div class="setting"><span>Jornada (modo prueba)</span>' + seg('testDay', [['0', 'Auto'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['8', '8']], String(GS.Store.get('testDay') || 0)) + '</div>' +
      '<div class="setting"><span>Clima (modo prueba)</span>' + seg('testCond', [['', 'Auto'], ['ninguna', 'Normal'], ['lluvia', 'Lluvia'], ['blackfriday', 'Black Friday'], ['navidad', 'Navidad']], GS.Store.get('testCond') || '') + '</div>' +
      '<div class="setting"><span>Volver a la jornada 1<br><small>Conserva monedas y mejoras</small></span><button class="btn ghost" id="optDay1" style="width:auto">Volver</button></div>' +
      '<div class="setting"><span>Borrar todo<br><small>Jornadas, monedas, mejoras y récords</small></span><button class="btn ghost" id="optReset" style="width:auto">Reiniciar</button></div>' +
      '<button class="btn" data-close>Listo</button>', () => { if (fromPause) showPause(); });
    $('sheet').querySelectorAll('.seg').forEach(s => s.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      const name = s.dataset.seg, v = b.dataset.v;
      if (name === 'mute') { A.unlock(); A.setMuted(v === '1'); syncMute(); A.play('click'); }
      if (name === 'quality') { GS.Store.set('quality', v); W.setQuality(v === 'auto' ? autoQuality() : v); }
      if (name === 'calm') { setCalm(v === '1'); GS.Store.set('calm', calm); }
      if (name === 'testDay') { GS.Store.set('testDay', Number(v)); refreshStart(); }
      if (name === 'testCond') GS.Store.set('testCond', v);
    }));
    $('optDay1').addEventListener('click', e => { GS.Store.set('days', 0); GS.Store.set('seen', {}); GS.Store.set('testDay', 0); refreshStart(); e.target.textContent = 'Listo ✔'; });
    $('optAv').addEventListener('click', () => showAvatar(() => showOptions(fromPause)));
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
  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden) { lastT = t; return; }             // pestaña oculta: no se dibuja ni corre el reloj
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
    if (state === 'day' && !paused) updateDay(dt);
    W.update(paused ? 0 : dt); W.render();
  }

  function boot() {
    $('logoImg').src = GS.LOGO; refreshStart();
    $('phasesStart').innerHTML = phasesCompact();
    $('chipPhase').textContent = '🚧 Etapa ' + C.phase + ' de ' + GS.PHASES.length;
    const q = GS.Store.get('quality') || 'auto';
    W.setQuality(q === 'auto' ? autoQuality() : q);
    if (!W.init($('c'))) {
      modal('<h2>Ups</h2><p>Este navegador no pudo iniciar los gráficos 3D. Probá actualizarlo o abrir el juego en otro navegador.</p>');
      return;
    }
    setCalm(!!GS.Store.get('calm')); syncMute(); W.showAll(); W.setUpgrades(upNow()); W.setPlayerLook(GS.Store.get('avatar'));
    $('btnShop').addEventListener('click', openShop); $('shopDone').addEventListener('click', closeShop);
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
    $('jobs').addEventListener('click', e => { const b = e.target.closest('.job[data-i]'); if (b && jobList[b.dataset.i]) openJob(jobList[b.dataset.i]); });
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
      const n = parseInt(e.key, 10); if (n >= 1 && n <= jobList.length && !day.arcade) openJob(jobList[n - 1]);
    });
    document.addEventListener('gesturestart', e => e.preventDefault());
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  return { startDay, startArcade, openStation, openJob, pendingJobs, endDay, debugTask: id => spawnTask(ST(id)), state: () => state, day: () => day };
})();
