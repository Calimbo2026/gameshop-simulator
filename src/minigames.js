/* =====================================================================
   MINIJUEGOS (2D, superpuestos al salón). Fase 1: Mostrador y Caja.
   Regla: un gesto principal, 5 a 15 segundos, nunca un Game Over duro.
   Cada minijuego avisa al juego con callbacks: onMistake(tipo) y onEnd(ok, info).
   ===================================================================== */
GS.Minigames = (function () {
  const U = GS.util, LN = GS.LINES;
  const root = () => document.getElementById('mg');
  let cur = null;     // minijuego abierto: { type, cust, cb, keys, done, timer }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function head(cust, station) {
    return '<div class="mg-head"><div class="mg-face">' + cust.arche.face + '</div><div class="mg-who"><b>' + esc(cust.arche.name) + '</b><span>' + esc(cust.arche.tag) +
      '</span><div class="mg-pat"><i id="mgPat"></i></div></div><div class="mg-station">' + station + '</div></div>';
  }
  function say(text, joke) {
    const b = document.getElementById('mgBubble'); if (!b) return;
    b.textContent = text; b.classList.toggle('joke', !!joke);
    if (joke) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
  }
  function mistake(kind, text) { GS.Audio.play('error'); say(text, true); cur.cb.onMistake(kind); }
  function finish(ok, title, sub, info) {
    if (!cur || cur.done) return; cur.done = true;
    const r = document.createElement('div'); r.className = 'result' + (ok ? '' : ' bad');
    r.innerHTML = '<div>' + esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
    root().appendChild(r);
    const c = cur;
    c.timer = setTimeout(() => { const cb = c.cb; close(); cb.onEnd(ok, info || {}); }, ok ? 800 : 1500);
  }
  function close() {
    if (cur && cur.timer) clearTimeout(cur.timer);
    const r = root(); r.hidden = true; r.innerHTML = ''; cur = null;
  }

  /* ---------------- 1. MOSTRADOR: interpretar el pedido ---------------- */
  function mostrador(cust) {
    const prod = cust.product;
    const same = U.shuffle(GS.CATALOG.filter(p => p.cat === prod.cat && p.id !== prod.id)).slice(0, 2);
    const others = U.shuffle(GS.CATALOG.filter(p => p.id !== prod.id && same.indexOf(p) < 0)).slice(0, 3 - same.length);
    const options = U.shuffle([prod].concat(same, others));
    root().innerHTML = head(cust, 'Mostrador') +
      '<div class="bubble" id="mgBubble">' + esc(cust.request) + '</div>' +
      '<div class="opts">' + options.map((p, i) => '<button class="opt" data-id="' + p.id + '"><kbd>' + (i + 1) + '</kbd><span class="i">' + p.icon + '</span><span class="n">' + esc(p.name) + '</span></button>').join('') + '</div>' +
      '<div class="rule">Tocá el producto que te está pidiendo</div>';
    const btns = [...root().querySelectorAll('.opt')];
    function choose(b) {
      if (!cur || cur.done || b.classList.contains('bad')) return;
      if (b.dataset.id === prod.id) { b.classList.add('good'); GS.Audio.play('ok'); finish(true, '¡Era eso!', prod.name + ' · pasa por caja', {}); }
      else { b.classList.add('bad'); mistake('mostrador', U.pick(LN.wrongProduct)); }
    }
    btns.forEach(b => b.addEventListener('click', () => choose(b)));
    cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= btns.length) choose(btns[n - 1]); };
  }

  /* ---------------- 2. CAJA: tres variantes ---------------- */
  function caja(cust, variant) {
    if (variant === 'vuelto') return cajaVuelto(cust);
    if (variant === 'comprobante') return cajaComprobante(cust);
    return cajaCobro(cust);
  }

  // (a) Aplicar bien el 10% OFF o las cuotas
  function cajaCobro(cust) {
    const P = cust.product.price, kind = U.pick(['cash', 'transfer', 'cuotas', 'debit']);
    let line, q, correct, wrong, total, fmt = U.money, why;
    if (kind === 'cash' || kind === 'transfer') {
      line = U.pick(kind === 'cash' ? LN.payCash : LN.payTransfer); q = '¿Cuánto le cobrás?'; correct = Math.round(P * 0.9); wrong = [P, Math.round(P * 0.8)]; total = correct;
      why = 'Efectivo o transferencia: 10% OFF.';
    } else if (kind === 'cuotas') {
      line = U.pick(LN.payCuotas); q = '¿De cuánto es cada cuota?'; correct = Math.round(P / 3); wrong = [Math.round(P * 0.3), Math.round(P / 2)]; total = P; fmt = n => '3 × ' + U.money(n);
      why = 'Son 3 cuotas sin interés sobre el precio de lista.';
    } else {
      line = U.pick(LN.payDebit); q = '¿Cuánto le cobrás?'; correct = P; wrong = [Math.round(P * 0.9), Math.round(P * 1.1)]; total = P;
      why = 'El 10% OFF es solo en efectivo o transferencia.';
    }
    const options = U.shuffle([correct].concat(wrong));
    root().innerHTML = head(cust, 'Caja') +
      '<div class="bubble" id="mgBubble">' + esc(line) + '</div>' +
      '<div class="info"><span>' + cust.product.icon + ' ' + esc(cust.product.name) + '</span><span>Precio de lista <b>' + U.money(P) + '</b></span></div>' +
      '<div class="info"><b>' + q + '</b></div>' +
      '<div class="opts one">' + options.map((v, i) => '<button class="opt" data-v="' + v + '"><kbd>' + (i + 1) + '</kbd><span class="n">' + fmt(v) + '</span></button>').join('') + '</div>' +
      '<div class="rule">10% OFF en efectivo o transferencia · 3 cuotas sin interés con tarjeta</div>';
    const btns = [...root().querySelectorAll('.opt')];
    function choose(b) {
      if (!cur || cur.done || b.classList.contains('bad')) return;
      if (Number(b.dataset.v) === correct) { b.classList.add('good'); GS.Audio.play('cash'); finish(true, '¡Cobrado!', U.money(total), { total }); }
      else { b.classList.add('bad'); mistake('caja', U.pick(LN.wrongCash) + ' (' + why + ')'); }
    }
    btns.forEach(b => b.addEventListener('click', () => choose(b)));
    cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= btns.length) choose(btns[n - 1]); };
  }

  // (b) Dar el vuelto sumando billetes
  function cajaVuelto(cust) {
    const T = Math.round(cust.product.price * 0.9);
    const cands = [Math.ceil((T + 1) / 10000) * 10000, Math.ceil((T + 1) / 20000) * 20000 + 20000, Math.ceil((T + 1) / 50000) * 50000]
      .filter(g => g - T >= 1000 && g - T <= 45000);
    const G = cands.length ? U.pick(cands) : T + 5000, change = G - T;
    const bills = [20000, 10000, 2000, 1000]; let given = 0;
    root().innerHTML = head(cust, 'Caja · Vuelto') +
      '<div class="bubble" id="mgBubble">Pago en efectivo. Tomá, cobrate.</div>' +
      '<div class="info"><span>Total con 10% OFF <b>' + U.money(T) + '</b></span><span>Paga con <b>' + U.money(G) + '</b></span></div>' +
      '<div class="tray"><span>Vuelto que le das</span><b id="mgGiven">$0</b></div>' +
      '<div class="bills">' + bills.map((b, i) => '<button class="bill" data-b="' + b + '">' + U.money(b) + '</button>').join('') + '</div>' +
      '<div class="row"><button class="btn ghost" id="mgClear">Borrar</button><button class="btn" id="mgGive" style="flex:2;font-size:19px;padding:12px">Dar el vuelto</button></div>';
    const out = document.getElementById('mgGiven');
    const add = b => { if (!cur || cur.done) return; given += b; out.textContent = U.money(given); GS.Audio.play('bill'); };
    const clear = () => { given = 0; out.textContent = '$0'; GS.Audio.play('click'); };
    function give() {
      if (!cur || cur.done) return;
      if (given === change) { GS.Audio.play('cash'); finish(true, '¡Vuelto justo!', 'Cobraste ' + U.money(T), { total: T }); }
      else { mistake('caja', U.pick(given < change ? LN.changeShort : LN.changeOver)); given = 0; out.textContent = '$0'; }
    }
    root().querySelectorAll('.bill').forEach(b => b.addEventListener('click', () => add(Number(b.dataset.b))));
    document.getElementById('mgClear').addEventListener('click', clear);
    document.getElementById('mgGive').addEventListener('click', give);
    cur.keys = e => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) add(bills[n - 1]); else if (e.key === 'Backspace') clear(); else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); give(); }
    };
  }

  // (c) Revisar un comprobante de transferencia y aprobar o rechazar con swipe
  function cajaComprobante(cust) {
    const T = Math.round(cust.product.price * 0.9), fake = Math.random() < 0.55;
    const hh = 10 + Math.floor(Math.random() * 9), mm = String(Math.floor(Math.random() * 60)).padStart(2, '0');
    const f = { para: 'GameShop', monto: U.money(T), fecha: 'Hoy, ' + hh + ':' + mm, estado: 'Aprobada' }; let flag = null;
    if (fake) {
      flag = U.pick(['para', 'monto', 'fecha', 'estado']);
      if (flag === 'para') f.para = U.pick(['GameChop', 'GameShopp Ofertas', 'Game Shop Trucho']);
      if (flag === 'monto') f.monto = U.money(U.pick([Math.round(T / 10), T - 10000, Math.round(T * 0.5)]));
      if (flag === 'fecha') f.fecha = U.pick(['Ayer, ' + hh + ':' + mm, 'Hace 3 meses', 'Mañana, ' + hh + ':' + mm]);
      if (flag === 'estado') f.estado = U.pick(['Programada', 'Pendiente', 'Rechazada']);
    }
    const rowp = (k, label) => '<p data-k="' + k + '"><span>' + label + '</span><b>' + esc(f[k]) + '</b></p>';
    root().innerHTML = head(cust, 'Caja · Transferencia') +
      '<div class="bubble" id="mgBubble">Ya te transferí. Mirá, acá está el comprobante.</div>' +
      '<div class="info"><span>Tenés que recibir</span><b>' + U.money(T) + ' a GameShop, hoy</b></div>' +
      '<div class="receipt" id="mgRec"><span class="stamp yes">OK</span><span class="stamp no" style="right:auto;left:12px;transform:rotate(10deg)">NO</span>' +
      '<h4>Comprobante de transferencia</h4>' + rowp('para', 'Para') + rowp('monto', 'Monto') + rowp('fecha', 'Fecha') + rowp('estado', 'Estado') + '</div>' +
      '<div class="swipe-hint"><span>← deslizá para rechazar</span><span>deslizá para aprobar →</span></div>' +
      '<div class="row"><button class="btn ghost" id="mgNo" style="font-size:18px">✖ Rechazar</button><button class="btn" id="mgYes" style="font-size:18px;padding:12px">✔ Aprobar</button></div>';
    const rec = document.getElementById('mgRec'), sy = rec.querySelector('.stamp.yes'), sn = rec.querySelector('.stamp.no');
    function decide(approve) {
      if (!cur || cur.done) return;
      GS.Audio.play('swipe');
      rec.style.transition = 'transform .2s'; rec.style.transform = 'translateX(' + (approve ? 60 : -60) + 'px) rotate(' + (approve ? 5 : -5) + 'deg)';
      (approve ? sy : sn).style.opacity = 1;
      if (flag) rec.querySelector('[data-k="' + flag + '"]').classList.add('flag');
      if (approve && !fake) { GS.Audio.play('cash'); finish(true, '¡Acreditado!', U.money(T), { total: T }); }
      else if (!approve && fake) { GS.Audio.play('ok'); finish(true, '¡Bien visto!', U.pick(LN.receiptFake) + ' Cobraste ' + U.money(T), { total: T }); }
      else if (approve && fake) { GS.Audio.play('error'); cur.cb.onMistake('caja'); finish(false, 'Era trucho', U.pick(LN.receiptFakeApproved), { total: 0, cajaError: true }); }
      else { GS.Audio.play('error'); cur.cb.onMistake('caja'); finish(false, 'Estaba bien', U.pick(LN.receiptOkRejected) + ' Igual cobraste.', { total: T }); }
    }
    document.getElementById('mgYes').addEventListener('click', () => decide(true));
    document.getElementById('mgNo').addEventListener('click', () => decide(false));
    // swipe
    let sx = null, dx = 0;
    rec.addEventListener('pointerdown', e => { if (cur && !cur.done) { sx = e.clientX; dx = 0; rec.setPointerCapture && rec.setPointerCapture(e.pointerId); rec.style.transition = 'none'; } });
    rec.addEventListener('pointermove', e => {
      if (sx === null || !cur || cur.done) return; dx = e.clientX - sx;
      rec.style.transform = 'translateX(' + dx + 'px) rotate(' + dx / 22 + 'deg)';
      sy.style.opacity = U.clamp(dx / 70, 0, 1); sn.style.opacity = U.clamp(-dx / 70, 0, 1);
    });
    const end = () => {
      if (sx === null) return; sx = null;
      if (Math.abs(dx) > 70) decide(dx > 0);
      else if (cur && !cur.done) { rec.style.transition = 'transform .15s'; rec.style.transform = ''; sy.style.opacity = 0; sn.style.opacity = 0; }
    };
    rec.addEventListener('pointerup', end); rec.addEventListener('pointercancel', end);
    cur.keys = e => { if (e.key === 'ArrowRight') decide(true); else if (e.key === 'ArrowLeft') decide(false); };
  }


  /* ---------------- 3. ARMADO DE PC: cada pieza en su lugar (una viene al revés) ---------------- */
  function pc(job) {
    const parts = GS.PC_PARTS, tray = U.shuffle(parts), flipped = U.pick(parts).id; let step = 0, isFlipped = true;
    root().innerHTML = head(job, 'Armado de PC') +
      '<div class="bubble" id="mgBubble">Armame la PC. Las piezas están ahí. Creo que están todas.</div>' +
      '<div class="board">' + parts.map((p, i) => '<div class="slot" data-i="' + i + '"><span>' + (i + 1) + '</span>' + esc(p.name) + '</div>').join('') + '</div>' +
      '<div class="rule" id="mgStep"></div>' +
      '<div class="parts">' + tray.map((p, i) => '<button class="opt part' + (p.id === flipped ? ' flip' : '') + '" data-id="' + p.id + '"><kbd>' + (i + 1) + '</kbd><span class="i">' + p.icon + '</span><span class="n">' + esc(p.name) + '</span></button>').join('') + '</div>';
    const slots = [...root().querySelectorAll('.slot')], btns = [...root().querySelectorAll('.part')], stepEl = document.getElementById('mgStep');
    const paint = () => { slots.forEach((s, i) => { s.classList.toggle('now', i === step); s.classList.toggle('done', i < step); }); if (step < parts.length) stepEl.textContent = 'Ahora va: ' + parts[step].name + '. Tocá la pieza.'; };
    function choose(b) {
      if (!cur || cur.done || b.classList.contains('used')) return;
      if (b.dataset.id === flipped && isFlipped) { isFlipped = false; b.classList.remove('flip'); GS.Audio.play('swipe'); say(U.pick(LN.flipPc), false); return; }
      if (b.dataset.id === parts[step].id) {
        b.classList.add('used'); GS.Audio.play('bill'); step++; paint();
        if (step === parts.length) { GS.Audio.play('ok'); finish(true, '¡Prendió!', 'Y con lucecitas.', {}); }
      } else mistake('pc', U.pick(LN.wrongPc));
    }
    btns.forEach(b => b.addEventListener('click', () => choose(b)));
    cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= btns.length) choose(btns[n - 1]); };
    paint();
  }

  /* ---------------- 4. SERVICE TÉCNICO: diagnóstico, limpieza o encajar la RAM ---------------- */
  function service(job, variant) {
    variant = variant || U.pick(['diag', 'diag', 'pelusa', 'ram']);
    if (variant === 'pelusa') return servicePelusa(job);
    if (variant === 'ram') return serviceRam(job);
    const d = U.pick(GS.DIAGNOSTICS), options = U.shuffle([d.ok].concat(d.bad));
    root().innerHTML = head(job, 'Service · Diagnóstico') + '<div class="bubble" id="mgBubble">' + esc(d.s) + '</div><div class="info"><b>¿Qué le pasa?</b></div>' +
      '<div class="opts one txt">' + options.map((o, i) => '<button class="opt" data-ok="' + (o === d.ok ? 1 : 0) + '"><kbd>' + (i + 1) + '</kbd><span class="n">' + esc(o) + '</span></button>').join('') + '</div>';
    listOptions(b => b.dataset.ok === '1', () => finish(true, '¡Diagnosticado!', d.ok, {}), () => mistake('service', U.pick(LN.wrongDiag)));
  }
  function servicePelusa(job) {
    const N = 20; let left = N;
    root().innerHTML = head(job, 'Service · Limpieza') + '<div class="bubble" id="mgBubble">Hace ruido de avión. Adentro hay algo... peludo.</div>' +
      '<div class="fan" id="mgFan"><div class="fan-ic">🌀</div>' + Array.from({ length: N }, () => '<i class="dust" style="--r:' + Math.floor(U.rnd(-30, 30)) + 'deg"></i>').join('') + '</div>' +
      '<div class="rule">Pasá el dedo por la pelusa para limpiarla · <span id="mgLeft">' + N + '</span> restantes</div>';
    const fan = document.getElementById('mgFan'), out = document.getElementById('mgLeft');
    function clean(el) {
      if (!cur || cur.done || !el || !el.classList || !el.classList.contains('dust') || el.classList.contains('gone')) return;
      el.classList.add('gone'); left--; out.textContent = left; if (left % 3 === 0) GS.Audio.play('swipe');
      if (left === 0) { GS.Audio.play('ok'); finish(true, '¡Como nueva!', 'Salió pelusa para tejer un pulóver.', {}); }
    }
    const at = e => clean(document.elementFromPoint(e.clientX, e.clientY));
    fan.addEventListener('pointerdown', e => { fan.setPointerCapture && fan.setPointerCapture(e.pointerId); at(e); });
    fan.addEventListener('pointermove', at);
    cur.keys = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); clean(fan.querySelector('.dust:not(.gone)')); } };
  }
  function serviceRam(job) {
    const zone = U.rnd(18, 62), zw = 22, me = cur; let pos = 0, dir = 1, last = 0;
    root().innerHTML = head(job, 'Service · Memoria RAM') + '<div class="bubble" id="mgBubble">Le agregamos memoria. Tiene que entrar justo, con un "clac".</div>' +
      '<div class="timing"><i class="zone" style="left:' + zone + '%;width:' + zw + '%"></i><i class="mark" id="mgMark"></i></div>' +
      '<button class="btn" id="mgSnap">¡Encajar!</button><div class="rule">Tocá cuando la marca esté en la zona verde</div>';
    const mark = document.getElementById('mgMark');
    function tick(t) {
      if (cur !== me) return; requestAnimationFrame(tick);
      const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t; if (me.done) return;
      pos += dir * dt * 62; if (pos >= 100) { pos = 100; dir = -1; } else if (pos <= 0) { pos = 0; dir = 1; }
      mark.style.left = pos + '%';
    }
    requestAnimationFrame(tick);
    function snap() {
      if (!cur || cur.done) return;
      if (pos >= zone && pos <= zone + zw) { GS.Audio.play('ok'); finish(true, '¡Clac!', 'Ahora tiene más RAM. Vos no, lamentablemente.', {}); }
      else mistake('service', U.pick(LN.missRam));
    }
    document.getElementById('mgSnap').addEventListener('click', snap);
    cur.keys = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); snap(); } };
  }

  /* ---------------- 5. MERCADO LIBRE: caja del tamaño justo y etiqueta correcta ---------------- */
  function ml(job) {
    const prod = U.pick(GS.CATALOG), size = Object.keys(GS.BOX_SIZE).find(k => GS.BOX_SIZE[k].indexOf(prod.id) >= 0) || 'mediana';
    const num = Math.floor(U.rnd(1000, 9999)), cities = U.shuffle(GS.CITIES), city = cities[0];
    const orderTxt = 'Pedido #' + num + ' · ' + prod.icon + ' ' + prod.name + ' · va a ' + city;
    function stepBox() {
      root().innerHTML = head(job, 'Mercado Libre · Empaque') + '<div class="bubble" id="mgBubble">' + esc(orderTxt) + '</div><div class="info"><b>¿En qué caja lo mandás?</b></div>' +
        '<div class="opts three">' + [['chica', 34], ['mediana', 46], ['grande', 60]].map((b, i) => '<button class="opt" data-ok="' + (b[0] === size ? 1 : 0) + '"><kbd>' + (i + 1) + '</kbd><span class="i" style="font-size:' + b[1] + 'px">📦</span><span class="n">Caja ' + b[0] + '</span></button>').join('') + '</div>' +
        '<div class="rule">Ni que baile adentro ni que haya que doblarlo</div>';
      listOptions(b => b.dataset.ok === '1', () => { GS.Audio.play('bill'); stepLabel(); }, () => mistake('ml', U.pick(LN.wrongBox)));
    }
    function stepLabel() {
      const labels = U.shuffle([{ n: num, c: city, ok: 1 }, { n: num + U.pick([-10, 10, 100, 1]), c: city, ok: 0 }, { n: num, c: cities[1], ok: 0 }]);
      root().innerHTML = head(job, 'Mercado Libre · Etiqueta') + '<div class="bubble" id="mgBubble">' + esc(orderTxt) + '</div><div class="info"><b>Cinta puesta. ¿Qué etiqueta le pegás?</b></div>' +
        '<div class="opts one">' + labels.map((l, i) => '<button class="opt tagl" data-ok="' + l.ok + '"><kbd>' + (i + 1) + '</kbd><span class="n">#' + l.n + ' · ' + esc(l.c) + '</span></button>').join('') + '</div>' +
        '<div class="rule">Mirá bien el número y el destino</div>';
      listOptions(b => b.dataset.ok === '1', () => { GS.Audio.play('ok'); finish(true, '¡Despachado!', 'Sale hoy, antes de las 14.', {}); }, () => mistake('ml', U.pick(LN.wrongLabel)));
    }
    stepBox();
  }

  /* ---------------- 6. WHATSAPP: elegir la respuesta correcta ---------------- */
  function whatsapp(job) {
    const c = U.pick(GS.CHATS), options = U.shuffle([c.ok].concat(c.bad));
    root().innerHTML = head(job, 'WhatsApp') + '<div class="chat"><div class="msg in" id="mgBubble">' + esc(c.m) + '</div></div><div class="info"><b>¿Qué le contestás?</b></div>' +
      '<div class="opts one txt">' + options.map((o, i) => '<button class="opt" data-ok="' + (o === c.ok ? 1 : 0) + '"><kbd>' + (i + 1) + '</kbd><span class="n">' + esc(o) + '</span></button>').join('') + '</div>';
    listOptions(b => b.dataset.ok === '1', () => finish(true, '¡Respondido!', 'Un cliente menos escribiendo "???".', {}), () => mistake('whatsapp', U.pick(LN.wrongChat)));
  }

  /* ---------------- 7. REPOSICIÓN: cada caja a su góndola ---------------- */
  function repo(job) {
    const boxes = U.shuffle(GS.CATALOG).slice(0, 3); let i = 0;
    function show() {
      const p = boxes[i];
      root().innerHTML = head(job, 'Reposición · ' + (i + 1) + ' de 3') + '<div class="bubble" id="mgBubble">📦 En esta caja hay: ' + p.icon + ' ' + esc(p.name) + '</div><div class="info"><b>¿A qué góndola va?</b></div>' +
        '<div class="opts">' + GS.SHELVES.map((s, k) => '<button class="opt" data-ok="' + (s.cat === p.cat ? 1 : 0) + '"><kbd>' + (k + 1) + '</kbd><span class="i">' + s.icon + '</span><span class="n">' + esc(s.name) + '</span></button>').join('') + '</div>';
      listOptions(b => b.dataset.ok === '1', () => { i++; if (i < boxes.length) { GS.Audio.play('bill'); show(); } else { GS.Audio.play('ok'); finish(true, '¡Todo acomodado!', 'Por cinco minutos, al menos.', {}); } }, () => mistake('repo', U.pick(LN.wrongShelf)));
    }
    show();
  }

  // Ayuda común: lista de opciones con una correcta; las equivocadas se apagan
  function listOptions(isOk, onOk, onBad) {
    const btns = [...root().querySelectorAll('.opt')];
    function choose(b) {
      if (!cur || cur.done || b.classList.contains('bad')) return;
      if (isOk(b)) { b.classList.add('good'); onOk(); } else { b.classList.add('bad'); onBad(); }
    }
    btns.forEach(b => b.addEventListener('click', () => choose(b)));
    cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= btns.length) choose(btns[n - 1]); };
  }

  const GAMES = { mostrador, caja, pc, service, ml, whatsapp, repo };
  return {
    // type: 'mostrador' | 'caja'; opts.variant para caja: 'cobro' | 'vuelto' | 'comprobante'
    open(type, cust, cb, opts) {
      close(); cur = { type, cust, cb, keys: null, done: false, timer: null };
      root().hidden = false;
      GAMES[type](cust, opts && opts.variant);
    },
    close,
    isOpen: () => !!cur,
    isResolving: () => !!(cur && cur.done),
    customer: () => (cur ? cur.cust : null),
    setPatience(p) {
      const i = document.getElementById('mgPat'); if (!i) return;
      i.style.width = Math.round(p * 100) + '%'; i.style.background = p > 0.5 ? 'var(--ok)' : p > 0.25 ? 'var(--warn)' : 'var(--red)';
    },
    key(e) { if (cur && !cur.done && cur.keys) cur.keys(e); }
  };
})();
