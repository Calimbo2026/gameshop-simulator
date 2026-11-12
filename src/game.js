/* =====================================================================
   JUEGO — jornada, clientes, tareas de las estaciones, Arcade, puntaje,
   HUD, pantallas y bucle principal.
   ===================================================================== */
GS.Game = (function () {
  const U = GS.util, C = GS.CONFIG, L = GS.LAYOUT, LN = GS.LINES, W = GS.World, MG = GS.Minigames, A = GS.Audio;
  const $ = id => document.getElementById(id);
  const ST = id => GS.STATIONS.find(s => s.id === id);
  const TASK_STATIONS = GS.STATIONS.filter(s => s.task);
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
      tasksDone: 0, tasksLate: 0, customers: [], tasks: [], spawned: 0, tasksSpawned: 0, nextSpawn: 0.4, nextTask: C.day.taskFirst, nextDueno: U.rnd(18, 26),
      cajaCount: 0, closing: false, jobSig: '', reqBag: U.shuffle(GS.REQUESTS), archBag: U.shuffle(GS.CUSTOMERS), taskBag: []
    }, extra || {});
  }
  function enterPlay() {
    $('start').hidden = true; $('end').hidden = true; $('hud').hidden = false; $('modal').hidden = true; $('toasts').innerHTML = '';
    paused = false; W.home();
  }
  function startDay(relaxed) {
    A.unlock(); A.play('click'); clearDay();
    day = newDay({ relaxed }); state = 'day'; enterPlay(); $('jobs').hidden = false;
    $('clockS').textContent = relaxed ? 'Turno tranquilo' : 'Abrimos';
    updateHud();
    GS.track('inicio_partida', { modo: relaxed ? 'tranquilo' : 'normal' });
    if (!GS.Store.get('tutorial2')) { GS.Store.set('tutorial2', true); showHow(true); }
  }
  function clearDay() {
    if (day) { day.customers.forEach(c => { if (c.person) c.person.remove(); c.label.remove(); }); day.tasks.forEach(t => t.label.remove()); }
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
    const person = W.makePerson({ shirt: arche.shirt, hair: arche.hair });
    const dx = L.puerta.x; person.setPos(dx + U.rnd(-0.5, 0.5), day.spawned === 0 ? L.salon.zMax + 1 : L.galeria.zMax + 2.4);
    const cu = { id: ++uid, arche, request: req.t, product, st: 'entering', pat: 1, person, slotM: slot, slotC: -1, label: makeLabel('❓') };
    day.customers.push(cu); day.spawned++;
    person.walk([[dx, L.salon.zMax + 0.2], [dx, -1.3], L.colaMostrador[slot]], () => { cu.st = 'waitM'; person.face(Math.PI); });
    setTimeout(() => A.play('bell'), 900);
  }
  function spawnTask() {
    if (!day.taskBag.length) day.taskBag = U.shuffle(TASK_STATIONS);
    let st = day.taskBag.pop();
    if (day.tasks.some(t => t.station === st)) { const alt = TASK_STATIONS.filter(s => !day.tasks.some(t => t.station === s)); if (!alt.length) return; st = U.pick(alt); }
    const task = { id: ++uid, station: st, arche: { face: st.icon, name: st.task.name, tag: st.task.tag }, pat: 1, st: 'wait', label: makeLabel(st.icon) };
    day.tasks.push(task); day.tasksSpawned++; A.play('speaker');
    toast('<b>' + st.icon + ' ' + st.name + '</b>' + st.task.name + '. Cuando puedas.', '', 2400);
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
  function removeTask(task) { task.label.remove(); const i = day.tasks.indexOf(task); if (i >= 0) day.tasks.splice(i, 1); }

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
    if (state !== 'day' || paused || MG.isOpen() || day.closing) return;
    A.unlock(); A.play('click');
    const ref = job.ref, isCust = job.type === 'mostrador' || job.type === 'caja';
    ref.st = isCust ? (job.type === 'mostrador' ? 'inM' : 'inC') : 'in'; ref.pat = Math.max(ref.pat, 0.55);
    focusFor(job.type);
    const cb = {
      onMistake(kind) { breakCombo(); if (kind === 'caja') day.cajaErr++; else day.otherErr++; if (!day.relaxed) ref.pat = Math.max(0.05, ref.pat - C.day.mistakeCost); },
      onEnd(ok, info) {
        W.focus(null);
        if (job.type === 'mostrador') {
          addScore(100, ref.pat); ref.st = 'toCaja'; ref.slotM = -1; ref.pat = Math.max(ref.pat, 0.8);
          ref.slotC = Math.max(0, freeSlot('slotC', L.colaCaja.length));
          ref.person.walk([[0.1, -2.1], L.colaCaja[ref.slotC]], () => { ref.st = 'waitC'; ref.person.face(Math.PI / 2); });
        } else if (job.type === 'caja') {
          day.served++;
          if (info.total) day.sales += info.total;
          if (info.cajaError) day.score = Math.max(0, day.score - 100);
          if (ok) addScore(150, ref.pat);
          if (Math.random() < 0.6) toast('<b>' + ref.arche.name + '</b>' + ref.arche.bye, '', 2600);
          leave(ref, !!info.total);
        } else { day.tasksDone++; addScore(130, ref.pat); removeTask(ref); }
      }
    };
    let variant = null;
    if (job.type === 'caja') { variant = GS.DEBUG_VARIANT ? GS.DEBUG_VARIANT : day.cajaCount === 0 ? 'cobro' : U.pick(['cobro', 'cobro', 'vuelto', 'comprobante']); day.cajaCount++; }
    if (job.type === 'service' && GS.DEBUG_VARIANT) variant = GS.DEBUG_VARIANT;
    MG.open(job.type, ref, cb, { variant });
  }

  function updateDay(dt) {
    if (day.arcade) return updateArcade(dt);
    day.t += dt;
    const cfg = C.day, open = MG.isOpen();
    // llegada de clientes
    const total = day.customers.filter(c => c.st !== 'leaving').length;
    const canSpawn = !day.closing && total < cfg.maxCustomers && (day.relaxed ? day.spawned < cfg.relaxedCustomers : day.t < day.dur - 15);
    day.nextSpawn -= dt;
    if (day.nextSpawn <= 0 && canSpawn) {
      spawnCustomer();
      const rush = day.relaxed ? 0.8 : 1 - 0.2 * (day.t / day.dur);
      day.nextSpawn = U.rnd(cfg.spawnMin, cfg.spawnMax) * rush;
    }
    // tareas de las otras estaciones
    day.nextTask -= dt;
    const canTask = !day.closing && day.tasks.length < cfg.maxTasks && (day.relaxed ? day.tasksSpawned < cfg.relaxedTasks : day.t < day.dur - 25);
    if (day.nextTask <= 0 && canTask) { spawnTask(); day.nextTask = U.rnd(cfg.taskMin, cfg.taskMax); }
    // paciencia (en el turno tranquilo no baja)
    if (!day.relaxed) {
      for (const cu of day.customers.slice()) {
        if (cu.st === 'waitM' || cu.st === 'waitC') cu.pat -= dt / cfg.patienceWait;
        else if ((cu.st === 'inM' || cu.st === 'inC') && !MG.isResolving()) cu.pat -= dt / cfg.patienceGame;
        if (cu.pat <= 0 && (cu.st === 'waitM' || cu.st === 'waitC' || cu.st === 'inM' || cu.st === 'inC')) {
          if (cu.st === 'inM' || cu.st === 'inC') { if (MG.isResolving()) { cu.pat = 0.01; continue; } MG.close(); W.focus(null); }
          day.lost++; breakCombo(); A.play('lost');
          toast('<b>' + cu.arche.name + ' se fue</b>' + cu.arche.lost, '', 3000);
          leave(cu, false);
        }
      }
      for (const t of day.tasks.slice()) {
        if (t.st === 'wait') t.pat -= dt / cfg.taskPatience;
        else if (!MG.isResolving()) t.pat -= dt / (cfg.patienceGame * 1.3);
        if (t.pat <= 0) {
          if (t.st === 'in') { if (MG.isResolving()) { t.pat = 0.01; continue; } MG.close(); W.focus(null); }
          day.tasksLate++; breakCombo(); A.play('lost');
          toast('<b>' + t.station.icon + ' ' + t.station.name + '</b>' + t.station.task.late, '', 3200); removeTask(t);
        }
      }
    }
    if (open && MG.customer()) MG.setPatience(day.relaxed ? 1 : MG.customer().pat);
    // el Dueño por el altavoz
    day.nextDueno -= dt;
    if (day.nextDueno <= 0 && !open) { day.nextDueno = U.rnd(30, 42); A.play('speaker'); toast('<b>📢 El Dueño, por el altavoz</b>' + U.pick(LN.dueno), 'dueno', 4600); }
    // fin de la jornada
    const over = day.relaxed
      ? (day.spawned >= cfg.relaxedCustomers && day.tasksSpawned >= cfg.relaxedTasks && !day.tasks.length && day.customers.every(c => c.st === 'leaving'))
      : day.t >= day.dur;
    if (over && !day.closing && !MG.isOpen()) { day.closing = true; setTimeout(endDay, 700); }
    updateHud(); updateJobs(); updateLabels();
  }

  function fmtClock(f) { const m = Math.round(600 + f * 600); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.floor(m % 60 / 10) * 10).padStart(2, '0'); }
  function updateHud() {
    if (!day) return;
    if (day.arcade) {
      $('clockT').textContent = 'Ronda ' + Math.max(1, Math.min(day.round, C.day.arcadeRounds)) + '/' + C.day.arcadeRounds; $('clockS').textContent = 'Arcade · ' + ST(day.arcade).name;
      $('clockB').style.width = (Math.max(0, day.round - 1) / C.day.arcadeRounds * 100) + '%';
    } else {
      const total = C.day.relaxedCustomers + C.day.relaxedTasks;
      const f = day.relaxed ? Math.min(1, (day.served + day.lost + day.tasksDone) / total) : Math.min(1, day.t / day.dur);
      $('clockT').textContent = fmtClock(f); $('clockB').style.width = (f * 100).toFixed(1) + '%';
      if (!day.relaxed) { const left = Math.max(0, Math.ceil(day.dur - day.t)); $('clockS').textContent = left <= 20 ? 'Cerramos en ' + left + ' s' : 'Cierra a las 20:00'; }
    }
    $('scoreV').textContent = day.score.toLocaleString('es-AR');
    $('chipSales').hidden = !!day.arcade; $('chipServed').hidden = !!day.arcade;
    $('chipSales').textContent = '💰 ' + U.money(day.sales);
    $('chipServed').textContent = '✅ ' + (day.served + day.tasksDone) + ' hechos';
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
        : '<div class="job idle"><span class="ji">☕</span><span class="jt"><b>Todo en orden</b><small>Respirá. Ya va a entrar alguien.</small></span></div>';
    }
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
  function updateLabels() {
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
    state = 'end'; MG.close(); W.focus(null); W.showAll(); A.play('endDay');
    const d = day;
    d.customers.slice().forEach(c => { if (c.st !== 'leaving') leave(c, false); });
    d.tasks.slice().forEach(removeTask);
    $('hud').hidden = true; $('jobs').hidden = true;
    const done = d.served + d.tasksDone, missed = d.lost + d.tasksLate, errs = d.cajaErr + d.otherErr;
    let stars = 1;
    if (d.relaxed) stars = errs === 0 ? 3 : errs <= 4 ? 2 : 1;
    else { if (done >= 6 && missed <= 2) stars = 2; if (done >= 9 && missed === 0 && d.cajaErr <= 1) stars = 3; }
    const comment = U.pick(stars === 3 ? LN.duenoEndGood : stars === 2 ? LN.duenoEndMid : LN.duenoEndBad);
    const human = U.pick(LN.human).replace('{n}', d.served);
    const entry = { score: d.score, served: done, sales: d.sales, mode: d.relaxed ? 'Tranquilo' : 'Normal', date: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) };
    const pos = d.score > 0 ? GS.Store.addScore(entry) : -1;
    GS.track('fin_jornada', { puntaje: d.score, atendidos: d.served, tareas: d.tasksDone, perdidos: missed, estrellas: stars, modo: entry.mode });
    $('endCol').innerHTML =
      '<div><div class="ticket"><h3>CIERRE DE CAJA</h3><div class="c">GameShop Simulator · ' + (d.relaxed ? 'turno tranquilo' : 'jornada normal') + '</div>' +
      '<p><span>Clientes atendidos</span><b>' + d.served + '</b></p><p><span>Tareas del local hechas</span><b>' + d.tasksDone + '</b></p>' +
      '<p><span>Se fueron sin comprar</span><b>' + d.lost + '</b></p><p><span>Tareas que se pasaron</span><b>' + d.tasksLate + '</b></p>' +
      '<p><span>Errores (con chiste)</span><b>' + errs + '</b></p>' +
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
    A.play('click'); clearDay();
    day = null; state = 'menu'; paused = false;
    $('end').hidden = true; $('hud').hidden = true; $('jobs').hidden = true; $('start').hidden = false; $('toasts').innerHTML = ''; W.showAll();
  }

  /* ---------------- Modales: cómo se juega, récords, opciones, pausa ---------------- */
  function showHow(fromDay) {
    if (fromDay) paused = true;
    modal('<h2>Cómo se juega</h2><ul class="how">' +
      '<li><i>🚪</i><span>Entran clientes y aparecen tareas del local. Todo lo pendiente se muestra <b>abajo</b>, con una barrita de tiempo.</span></li>' +
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

  return { startDay, startArcade, openStation, openJob, pendingJobs, endDay, state: () => state, day: () => day };
})();
