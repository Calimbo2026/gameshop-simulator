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
  // Foto real del producto si la tiene; si no, el ícono
  function pic(p) {
    if (p.img) return '<img class="pimg" src="' + esc(p.img) + '" alt="" loading="lazy">';
    return GS.ICONS[p.id] ? '<span class="pic">' + GS.ICONS[p.id] + '</span>' : '<span class="i">' + p.icon + '</span>';
  }
  // Dibujo chiquito para usar dentro de un texto
  function ico(p) { return GS.ICONS[p.id] ? '<span class="pic sm">' + GS.ICONS[p.id] + '</span>' : p.icon + ' '; }
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
    if (cur && cur.cleanup) cur.cleanup();
    const r = root(); r.hidden = true; r.innerHTML = ''; cur = null;
  }

  /* ---------------- 1. MOSTRADOR: interpretar el pedido ---------------- */
  function mostrador(cust) {
    const prod = cust.product;
    // Siempre aparece el producto "parecido" al pedido, más otros dos
    const twin = GS.CATALOG.find(p => p.id === GS.SIMILAR[prod.id]) || U.pick(GS.CATALOG.filter(p => p.cat === prod.cat && p.id !== prod.id));
    const others = U.shuffle(GS.CATALOG.filter(p => p.id !== prod.id && p !== twin)).slice(0, 2);
    const options = U.shuffle([prod, twin].concat(others));
    root().innerHTML = head(cust, 'Mostrador') +
      '<div class="bubble" id="mgBubble">' + esc(cust.request) + '</div>' +
      '<div class="opts">' + options.map((p, i) => '<button class="opt" data-id="' + p.id + '"><kbd>' + (i + 1) + '</kbd>' + pic(p) + '<span class="n">' + esc(p.name) + '</span></button>').join('') + '</div>' +
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
      '<div class="info"><span>' + ico(cust.product) + esc(cust.product.name) + '</span><span>Precio de lista <b>' + U.money(P) + '</b></span></div>' +
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

  // (c) Revisar un comprobante de transferencia: encontrar el dato que está mal, o aprobar si está todo bien
  function cajaComprobante(cust) {
    const T = Math.round(cust.product.price * 0.9), fake = Math.random() < 0.6;
    const hh = 10 + Math.floor(Math.random() * 9), mm = String(Math.floor(Math.random() * 60)).padStart(2, '0');
    const f = { para: 'GameShop', monto: U.money(T), fecha: 'Hoy, ' + hh + ':' + mm, estado: 'Aprobada ✔' }; let flag = null;
    if (fake) {
      flag = U.pick(['para', 'monto', 'fecha', 'estado']);
      if (flag === 'para') f.para = U.pick(['GameChop', 'GameShopp Ofertas', 'GeimShop SRL']);
      if (flag === 'monto') f.monto = U.money(U.pick([Math.round(T / 10), T - 10000, Math.round(T * 0.5)]));
      if (flag === 'fecha') f.fecha = U.pick(['Ayer, ' + hh + ':' + mm, 'Hace 3 meses', 'Mañana, ' + hh + ':' + mm]);
      if (flag === 'estado') f.estado = U.pick(['Programada', 'Pendiente', 'Rechazada ✖']);
    }
    const rows = [['para', 'Para', 'GameShop'], ['monto', 'Monto', U.money(T)], ['fecha', 'Fecha', 'Hoy'], ['estado', 'Estado', 'Aprobada']];
    root().innerHTML = head(cust, 'Caja · Transferencia') +
      '<div class="expect"><b>Tiene que decir</b>' + rows.map(r => '<span>' + r[1] + ': <i>' + esc(r[2]) + '</i></span>').join('') + '</div>' +
      '<div class="phone"><h4>🏦 Banco Ficticio · Comprobante de transferencia</h4>' +
      rows.map((r, i) => '<button class="rowb" data-k="' + r[0] + '"><kbd>' + (i + 1) + '</kbd><span>' + r[1] + '</span><b>' + esc(f[r[0]]) + '</b></button>').join('') + '</div>' +
      '<div class="rule" id="mgBubble">¿Hay algún dato distinto? Tocalo. Si coincide todo, aprobá.</div>' +
      '<button class="btn okb" id="mgYes">✔ Coincide todo: aprobar</button>';
    const rb = [...root().querySelectorAll('.rowb')];
    const mark = () => { if (flag) root().querySelector('.rowb[data-k="' + flag + '"]').classList.add('flag'); };
    function tapRow(b) {
      if (!cur || cur.done || b.classList.contains('fine')) return;
      if (fake && b.dataset.k === flag) { mark(); GS.Audio.play('ok'); finish(true, '¡Bien visto!', 'El comprobante estaba mal. Se va sin el producto.', { total: 0, caught: true }); }
      else { b.classList.add('fine'); mistake('caja', U.pick(fake ? LN.rowFine : LN.rowFineAll)); }
    }
    function approve() {
      if (!cur || cur.done) return;
      if (!fake) { GS.Audio.play('cash'); finish(true, '¡Acreditado!', U.money(T), { total: T }); }
      else { mark(); GS.Audio.play('error'); cur.cb.onMistake('caja'); finish(false, 'Era trucho', 'Mirá el dato marcado en rojo. ' + U.pick(LN.receiptFakeApproved), { total: 0, cajaError: true }); }
    }
    rb.forEach(b => b.addEventListener('click', () => tapRow(b)));
    document.getElementById('mgYes').addEventListener('click', approve);
    cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 4) tapRow(rb[n - 1]); else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); approve(); } };
  }

  /* ---------------- 3. ARMADO DE PC: elegir la pieza y tocar en la placa dónde va (una viene al revés) ---------------- */
  function pc(job) {
    const parts = GS.PC_PARTS, tray = U.shuffle(parts), flipped = U.pick(parts).id, me = cur; let sel = null, placed = 0;
    root().innerHTML = head(job, 'Armado de PC') +
      '<div class="pcb" id="mgPcb"><i class="deco d1"></i><i class="deco d2"></i><i class="deco d3"></i>' +
      parts.map((p, i) => '<button class="pslot s-' + p.id + '" data-id="' + p.id + '"><kbd>' + 'ABCDE'[i] + '</kbd><em>' + esc(p.name) + '</em></button>').join('') + '</div>' +
      '<div class="rule" id="mgBubble">Elegí una pieza y después tocá en la placa dónde va.</div>' +
      '<div class="parts">' + tray.map((p, i) => '<button class="opt part' + (p.id === flipped ? ' flip' : '') + '" data-id="' + p.id + '"><kbd>' + (i + 1) + '</kbd><span class="pi">' + p.svg + '</span><span class="n">' + esc(p.name) + '</span></button>').join('') + '</div>';
    const slots = [...root().querySelectorAll('.pslot')], btns = [...root().querySelectorAll('.part')], pcb = document.getElementById('mgPcb');
    function pickPart(b) {
      if (!cur || cur.done || b.classList.contains('used')) return;
      if (sel === b && b.classList.contains('flip')) { b.classList.remove('flip'); GS.Audio.play('swipe'); say(U.pick(LN.flipPc) + ' Ahora tocá dónde va.', false); return; }
      sel = b; btns.forEach(x => x.classList.toggle('sel', x === b)); GS.Audio.play('click');
      say(b.classList.contains('flip') ? 'Esa está al revés: tocala de nuevo para girarla.' : 'Ahora tocá en la placa dónde va.', false);
    }
    function pickSlot(sl) {
      if (!cur || cur.done || sl.classList.contains('full')) return;
      if (!sel) { GS.Audio.play('error'); say('Primero elegí una pieza de abajo.', true); return; }
      if (sel.dataset.id !== sl.dataset.id) return mistake('pc', U.pick(LN.wrongPc));
      if (sel.classList.contains('flip')) { GS.Audio.play('error'); say('Va ahí, pero está al revés. Tocá la pieza otra vez para girarla.', true); return; }
      sl.classList.add('full'); sl.innerHTML = parts.find(p => p.id === sl.dataset.id).svg;
      sel.classList.add('used'); sel.classList.remove('sel'); sel = null; placed++; GS.Audio.play('bill');
      if (placed === parts.length) {
        pcb.classList.add('on'); GS.Audio.play('ok'); say('¡Prende! Y con lucecitas.', false);
        setTimeout(() => { if (cur === me) finish(true, '¡Prendió!', 'Y con lucecitas.', {}); }, 1100);
      } else say('¡Entró! Siguiente pieza.', false);
    }
    btns.forEach(b => b.addEventListener('click', () => pickPart(b)));
    slots.forEach(sl => sl.addEventListener('click', () => pickSlot(sl)));
    cur.keys = e => {
      const n = parseInt(e.key, 10), k = 'abcde'.indexOf((e.key || '').toLowerCase());
      if (n >= 1 && n <= btns.length) pickPart(btns[n - 1]); else if (k >= 0 && e.key.length === 1) pickSlot(slots[k]);
    };
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
    const N = 14; let left = N; const me = cur;
    root().innerHTML = head(job, 'Service · Limpieza') + '<div class="bubble" id="mgBubble">Hace ruido de avión. Adentro hay algo... peludo.</div>' +
      '<div class="fan" id="mgFan"><div class="fan-blades"><i></i><i></i><i></i><i></i></div><div class="fan-hub"></div>' +
      Array.from({ length: N }, () => { const z = Math.floor(U.rnd(34, 62)); return '<i class="dust" style="left:' + U.rnd(4, 82).toFixed(0) + '%;top:' + U.rnd(4, 66).toFixed(0) + '%;width:' + z + 'px;height:' + Math.floor(z * 0.8) + 'px;--r:' + Math.floor(U.rnd(-40, 40)) + 'deg"></i>'; }).join('') + '</div>' +
      '<div class="rule">Pasá el dedo por la pelusa hasta que el cooler quede limpio · <span id="mgLeft">' + N + '</span> restantes</div>';
    const fan = document.getElementById('mgFan'), out = document.getElementById('mgLeft');
    function clean(el) {
      if (!cur || cur.done || !el || !el.classList || !el.classList.contains('dust') || el.classList.contains('gone')) return;
      el.classList.add('gone'); left--; out.textContent = left; if (left % 2 === 0) GS.Audio.play('swipe');
      if (left === 0) { fan.classList.add('clean'); GS.Audio.play('ok'); setTimeout(() => { if (cur === me) finish(true, '¡Como nueva!', 'Salió pelusa para tejer un pulóver.', {}); }, 900); }
    }
    const at = e => clean(document.elementFromPoint(e.clientX, e.clientY));
    fan.addEventListener('pointerdown', e => { fan.setPointerCapture && fan.setPointerCapture(e.pointerId); at(e); });
    fan.addEventListener('pointermove', at);
    cur.keys = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); clean(fan.querySelector('.dust:not(.gone)')); } };
  }
  function serviceRam(job) {
    const slot = U.rnd(12, 58), sw = 30, me = cur; let pos = 0, dir = 1, last = 0;   // la RAM mide 30% del ancho; hay que soltarla justo sobre la ranura
    root().innerHTML = head(job, 'Service · Memoria RAM') + '<div class="bubble" id="mgBubble">Le agregamos memoria. Tiene que caer justo en la ranura.</div>' +
      '<div class="ramrig" id="mgRig"><div class="ramstick" id="mgMark">' + GS.PC_PARTS[1].svg + '</div><div class="ramslot" style="left:' + slot + '%;width:' + sw + '%"><i></i></div></div>' +
      '<button class="btn" id="mgSnap">¡Soltar!</button><div class="rule">Tocá cuando la memoria esté justo arriba de la ranura</div>';
    const mark = document.getElementById('mgMark'), rig = document.getElementById('mgRig');
    function tick(t) {
      if (cur !== me) return; requestAnimationFrame(tick);
      const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t; if (me.done || me.hold) return;
      pos += dir * dt * 46; if (pos >= 70) { pos = 70; dir = -1; } else if (pos <= 0) { pos = 0; dir = 1; }
      mark.style.left = pos + '%';
    }
    requestAnimationFrame(tick);
    function snap() {
      if (!cur || cur.done || me.hold) return;
      if (Math.abs(pos - slot) <= 5.5) {
        me.hold = true; mark.style.left = slot + '%'; rig.classList.add('in'); GS.Audio.play('ok');
        setTimeout(() => { if (cur === me) finish(true, '¡Clac!', 'Ahora tiene más RAM. Vos no, lamentablemente.', {}); }, 700);
      } else mistake('service', U.pick(LN.missRam));
    }
    document.getElementById('mgSnap').addEventListener('click', snap);
    cur.keys = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); snap(); } };
  }

  /* ---------------- 5. MERCADO LIBRE: caja del tamaño justo, cinta y etiqueta correcta ---------------- */
  function ml(job) {
    const prod = U.pick(GS.CATALOG), size = Object.keys(GS.BOX_SIZE).find(k => GS.BOX_SIZE[k].indexOf(prod.id) >= 0) || 'mediana';
    const num = Math.floor(U.rnd(1000, 9999)), cities = U.shuffle(GS.CITIES), city = cities[0], buyers = U.shuffle(GS.BUYERS), buyer = buyers[0], me = cur;
    const order = '<div class="order"><b>Pedido #' + num + '</b><span>' + ico(prod) + esc(prod.name) + ' · mide unos ' + GS.BOXES[size].cm + ' cm</span><span>Para: ' + buyer + ' · ' + esc(city) + '</span></div>';
    const steps = n => '<div class="steps">' + ['Caja', 'Cinta', 'Etiqueta'].map((t, i) => '<span class="' + (i < n ? 'done' : i === n ? 'now' : '') + '">' + (i + 1) + '. ' + t + '</span>').join('') + '</div>';
    function stepBox() {
      root().innerHTML = head(job, 'Mercado Libre') + steps(0) + order + '<div class="info" id="mgBubble"><b>¿En qué caja entra justo?</b></div>' +
        '<div class="opts three">' + ['chica', 'mediana', 'grande'].map((b, i) => '<button class="opt" data-ok="' + (b === size ? 1 : 0) + '"><kbd>' + (i + 1) + '</kbd><span class="i" style="font-size:' + [30, 42, 56][i] + 'px">📦</span><span class="n">Caja ' + b + '<br><small>hasta ' + GS.BOXES[b].max + ' cm</small></span></button>').join('') + '</div>';
      listOptions(b => b.dataset.ok === '1', () => { GS.Audio.play('bill'); stepTape(); }, () => mistake('ml', U.pick(LN.wrongBox)));
    }
    function stepTape() {
      let prog = 0, down = false;
      root().innerHTML = head(job, 'Mercado Libre') + steps(1) + order + '<div class="info" id="mgBubble"><b>Cerrala con cinta: deslizá el dedo de punta a punta</b></div>' +
        '<div class="tapebox" id="mgTape"><i class="seam"></i><i class="tape" id="mgTp"></i><span class="roll" id="mgRoll">🟤</span></div>';
      const box = document.getElementById('mgTape'), tp = document.getElementById('mgTp'), roll = document.getElementById('mgRoll');
      function set(p) {
        if (!cur || cur.done || p <= prog) return; if (p - prog > 0.08) GS.Audio.play('swipe');
        prog = Math.min(1, p); tp.style.width = (prog * 100) + '%'; roll.style.left = (prog * 100) + '%';
        if (prog >= 0.96) { tp.style.width = '100%'; roll.style.display = 'none'; GS.Audio.play('bill'); setTimeout(() => { if (cur === me) stepLabel(); }, 350); }
      }
      const move = e => { if (!down) return; const r = box.getBoundingClientRect(), p = (e.clientX - r.left) / r.width; if (p <= prog + 0.3) set(p); };   // sin saltos: hay que recorrerla
      box.addEventListener('pointerdown', e => { down = true; box.setPointerCapture && box.setPointerCapture(e.pointerId); move(e); });
      box.addEventListener('pointermove', move); box.addEventListener('pointerup', () => { down = false; }); box.addEventListener('pointercancel', () => { down = false; });
      cur.keys = e => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); set(prog + 0.26); } };
    }
    function stepLabel() {
      const labels = U.shuffle([{ n: num, c: city, b: buyer, ok: 1 }, { n: num + U.pick([-10, 10, 100, 1]), c: city, b: buyer, ok: 0 }, U.pick([{ n: num, c: cities[1], b: buyer, ok: 0 }, { n: num, c: city, b: buyers[1], ok: 0 }])]);
      root().innerHTML = head(job, 'Mercado Libre') + steps(2) + order + '<div class="info" id="mgBubble"><b>¿Cuál es la etiqueta de este pedido?</b></div>' +
        '<div class="opts one">' + labels.map((l, i) => '<button class="opt tagl" data-ok="' + l.ok + '"><kbd>' + (i + 1) + '</kbd><span class="bars"></span><span class="n">#' + l.n + '<small>' + l.b + ' · ' + esc(l.c) + '</small></span></button>').join('') + '</div>';
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
    // Se juega en el local: la cámara muestra todo el salón y se toca la góndola de verdad
    const boxes = U.shuffle(GS.CATALOG).slice(0, 3), me = cur; let i = 0;
    GS.World.focusAt(8.7, -4.3, 0.42, 0.16);
    const layer = document.createElement('div'); layer.className = 'zones';
    layer.innerHTML = GS.SHELVES.map((s, k) => '<button class="zone-b" data-k="' + k + '"><span>' + s.icon + '</span>' + esc(s.name) + '</button>').join('');
    document.body.appendChild(layer);
    const zb = [...layer.querySelectorAll('.zone-b')];
    me.cleanup = () => layer.remove();
    (function place() {
      if (cur !== me) return; requestAnimationFrame(place);
      GS.SHELVES.forEach((s, k) => { const p = GS.World.project(s.pos[0], 1.9, s.pos[1]); zb[k].style.left = p.x.toFixed(1) + 'px'; zb[k].style.top = p.y.toFixed(1) + 'px'; });
    })();
    function show() {
      const p = boxes[i];
      zb.forEach(b => b.classList.remove('bad'));
      root().innerHTML = head(job, 'Reposición · ' + (i + 1) + ' de 3') + '<div class="bubble" id="mgBubble">📦 En esta caja hay: ' + ico(p) + esc(p.name) + '</div>' +
        '<div class="rule">Tocá en el depósito la estantería donde va</div>';
    }
    function choose(k) {
      if (!cur || cur.done || zb[k].classList.contains('bad')) return;
      if (GS.SHELVES[k].cat === boxes[i].cat) {
        i++; if (i < boxes.length) { GS.Audio.play('bill'); show(); } else { GS.Audio.play('ok'); layer.remove(); finish(true, '¡Todo acomodado!', 'Por cinco minutos, al menos.', {}); }
      } else { zb[k].classList.add('bad'); mistake('repo', U.pick(LN.wrongShelf)); }
    }
    zb.forEach((b, k) => b.addEventListener('click', () => choose(k)));
    me.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= zb.length) choose(n - 1); };
    show();
  }

  /* ---------------- 8. CONTROL DE STOCK: contar lo que hay de verdad ---------------- */
  function stock(job) {
    const p = U.pick(GS.CATALOG), real = Math.floor(U.rnd(3, 10)), sys = Math.max(1, real + U.pick([-2, -1, 0, 1, 2]));
    root().innerHTML = head(job, 'Control de stock') + '<div class="bubble" id="mgBubble">' + esc(p.name) + ': el sistema dice que hay <b>' + sys + '</b>.</div>' +
      '<div class="shelfv">' + Array.from({ length: real }, () => '<span class="pic" style="transform:rotate(' + Math.floor(U.rnd(-14, 14)) + 'deg) translateY(' + Math.floor(U.rnd(-4, 5)) + 'px)">' + (GS.ICONS[p.id] || p.icon) + '</span>').join('') + '</div>' +
      '<div class="info"><b>¿Cuántos hay de verdad en la góndola?</b></div>' +
      '<div class="opts three low">' + [real - 1, real, real + 1].map((n, i) => '<button class="opt" data-ok="' + (n === real ? 1 : 0) + '"><kbd>' + (i + 1) + '</kbd><span class="n big">' + n + '</span></button>').join('') + '</div>';
    listOptions(b => b.dataset.ok === '1', () => { GS.Audio.play('ok'); finish(true, '¡Stock corregido!', sys === real ? 'El sistema tenía razón. Anotá la fecha.' : 'Eran ' + real + ', no ' + sys + '.', {}); }, () => mistake('stock', U.pick(LN.wrongStock)));
  }

  /* ---------------- 9. RECEPCIÓN DE PROVEEDOR: comparar el remito con lo que llegó ---------------- */
  function proveedor(job) {
    const items = U.shuffle(GS.CATALOG).slice(0, 4).map(p => ({ p, q: Math.floor(U.rnd(2, 10)) }));
    const bad = Math.random() < 0.65 ? Math.floor(Math.random() * 4) : -1, got = items.map((it, i) => i === bad ? Math.max(1, it.q + U.pick([-2, -1, 1])) : it.q);
    root().innerHTML = head(job, 'Recepción de proveedor') +
      '<div class="expect one"><b>El remito dice</b>' + items.map(it => '<span>' + esc(it.p.name) + ': <i>' + it.q + '</i></span>').join('') + '</div>' +
      '<div class="phone"><h4>📦 Lo que bajó de la carreta</h4>' + items.map((it, i) => '<button class="rowb" data-i="' + i + '"><kbd>' + (i + 1) + '</kbd><span>' + esc(it.p.name) + '</span><b>' + got[i] + '</b></button>').join('') + '</div>' +
      '<div class="rule" id="mgBubble">¿Alguna cantidad no coincide? Tocala. Si está todo, firmá.</div><button class="btn okb" id="mgYes">✔ Coincide todo: firmar</button>';
    const rb = [...root().querySelectorAll('.rowb')];
    function tapRow(b) {
      if (!cur || cur.done || b.classList.contains('fine')) return;
      if (Number(b.dataset.i) === bad) { b.classList.add('flag'); GS.Audio.play('ok'); finish(true, '¡Bien contado!', 'Faltaba mercadería. El de la carreta "justo se acordó".', {}); }
      else { b.classList.add('fine'); mistake('proveedor', U.pick(LN.lineFine)); }
    }
    function sign() {
      if (!cur || cur.done) return;
      if (bad < 0) { GS.Audio.play('ok'); finish(true, '¡Firmado!', 'Llegó todo. Qué raro. Qué lindo.', {}); }
      else { rb[bad].classList.add('flag'); GS.Audio.play('error'); cur.cb.onMistake('proveedor'); finish(false, 'Firmaste de más', 'Mirá la línea marcada: no coincidía con el remito.', {}); }
    }
    rb.forEach(b => b.addEventListener('click', () => tapRow(b))); document.getElementById('mgYes').addEventListener('click', sign);
    cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 4) tapRow(rb[n - 1]); else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sign(); } };
  }

  /* ---------------- 10. DEVOLUCIONES: aceptar o rechazar según las reglas (inventadas para el juego) ---------------- */
  function devol(job) {
    const p = U.pick(GS.CATALOG), c = { ticket: true, dias: Math.floor(U.rnd(1, 10)), estado: U.pick(['Cerrado, sin abrir', 'Abierto, sin uso']) };
    let why = '';
    if (Math.random() < 0.55) {
      const k = U.pick(['ticket', 'dias', 'estado']);
      if (k === 'ticket') { c.ticket = false; why = 'No tiene ticket.'; }
      if (k === 'dias') { c.dias = U.pick([14, 25, 60, 365]); why = 'Pasaron más de 10 días.'; }
      if (k === 'estado') { c.estado = 'Usado y con marcas'; why = 'Está usado.'; }
    }
    const ok = !why;
    root().innerHTML = head(job, 'Devoluciones') + '<div class="bubble" id="mgBubble">Quiero devolver esto: ' + ico(p) + esc(p.name) + '. ' + esc(U.pick(LN.returnExcuses)) + '</div>' +
      '<div class="expect"><b>Se acepta si (reglas del juego)</b><span>Tiene <i>ticket</i></span><span>Hasta <i>10 días</i></span><span>Está <i>sin uso</i></span></div>' +
      '<div class="phone">' + [['ticket', 'Ticket', c.ticket ? 'Sí, lo tiene' : 'No lo tiene'], ['dias', 'Lo compró hace', c.dias + (c.dias === 1 ? ' día' : ' días')], ['estado', 'Estado', c.estado]].map(r => '<div class="rowb" data-k="' + r[0] + '"><span>' + r[1] + '</span><b>' + r[2] + '</b></div>').join('') + '</div>' +
      '<div class="row"><button class="btn ghost" id="mgNo" style="font-size:18px">✖ Rechazar</button><button class="btn okb" id="mgYes">✔ Aceptar</button></div>';
    function decide(accept) {
      if (!cur || cur.done) return;
      if (accept === ok) { GS.Audio.play('ok'); finish(true, ok ? '¡Devolución aceptada!' : '¡Bien rechazada!', ok ? 'Cumplía todo. Cliente contento.' : why + ' Se lo explicaste con una sonrisa.', {}); }
      else { GS.Audio.play('error'); cur.cb.onMistake('devol'); finish(false, ok ? 'Se podía aceptar' : 'No correspondía', ok ? 'Cumplía las tres reglas.' : why, {}); }
    }
    document.getElementById('mgYes').addEventListener('click', () => decide(true)); document.getElementById('mgNo').addEventListener('click', () => decide(false));
    cur.keys = e => { if (e.key === 'ArrowRight' || e.key === '2') decide(true); else if (e.key === 'ArrowLeft' || e.key === '1') decide(false); };
  }

  /* ---------------- 11. CIERRE DE CAJA: sumar lo cobrado y ver si la caja cierra ---------------- */
  function cierre(job) {
    const cobros = Array.from({ length: 4 }, () => Math.floor(U.rnd(1, 10)) * 10000), sum = cobros.reduce((a, b) => a + b, 0), d = U.pick([0, 0, -10000, 10000, -20000, 20000]);
    const x = Math.abs(d) || 10000, right = d === 0 ? 'ok' : d < 0 ? 'falta' : 'sobra';
    root().innerHTML = head(job, 'Cierre de caja') + '<div class="bubble" id="mgBubble">Último paso del día: ¿la caja cierra?</div>' +
      '<div class="phone"><h4>🧾 Cobros en efectivo de hoy</h4>' + cobros.map((c, i) => '<div class="rowb"><span>Venta ' + (i + 1) + '</span><b>' + U.money(c) + '</b></div>').join('') + '</div>' +
      '<div class="tray"><span>En el cajón hay</span><b>' + U.money(sum + d) + '</b></div>' +
      '<div class="opts three low">' + [['falta', 'Faltan ' + U.money(x)], ['ok', 'Cierra perfecto'], ['sobra', 'Sobran ' + U.money(x)]].map((o, i) => '<button class="opt" data-ok="' + (o[0] === right ? 1 : 0) + '"><kbd>' + (i + 1) + '</kbd><span class="n">' + o[1] + '</span></button>').join('') + '</div>';
    listOptions(b => b.dataset.ok === '1', () => { GS.Audio.play('cash'); finish(true, '¡Caja cerrada!', d === 0 ? 'Cerró perfecto. Sacale una foto.' : 'Diferencia detectada. Mañana se revisa con un mate.', {}); }, () => mistake('cierre', U.pick(LN.wrongCount)));
  }

  /* ---------------- 12. VIDRIERA: elegir los 4 productos que van con el tema ---------------- */
  function vidriera(job) {
    const th = U.pick(GS.THEMES), good = U.shuffle(GS.CATALOG.filter(p => p.cat === th.cat)).slice(0, 4), bad = U.shuffle(GS.CATALOG.filter(p => p.cat !== th.cat)).slice(0, 4), all = U.shuffle(good.concat(bad));
    root().innerHTML = head(job, 'Vidriera') + '<div class="bubble" id="mgBubble">Tema de la vidriera: <b>' + esc(th.t) + '</b>. Elegí los 4 productos que mejor van.</div>' +
      '<div class="opts four">' + all.map((p, i) => '<button class="opt" data-i="' + i + '"><kbd>' + (i + 1) + '</kbd>' + pic(p) + '<span class="n">' + esc(p.name) + '</span></button>').join('') + '</div>' +
      '<div class="rule">Elegidos: <span id="mgN">0</span> de 4 · tocá de nuevo para sacar uno</div>';
    const btns = [...root().querySelectorAll('.opt')], me = cur;
    function toggle(b) {
      if (!cur || cur.done) return;
      const on = btns.filter(x => x.classList.contains('sel'));
      if (!b.classList.contains('sel') && on.length >= 4) return;
      b.classList.toggle('sel'); GS.Audio.play('bill');
      const sel = btns.filter(x => x.classList.contains('sel')); document.getElementById('mgN').textContent = sel.length;
      if (sel.length === 4) {
        const n = sel.filter(x => good.indexOf(all[x.dataset.i]) >= 0).length;
        btns.forEach(x => x.classList.add(good.indexOf(all[x.dataset.i]) >= 0 ? 'good' : 'dim'));
        setTimeout(() => { if (cur !== me) return; GS.Audio.play(n >= 3 ? 'ok' : 'click'); finish(true, n === 4 ? '¡Vidriera perfecta!' : n >= 2 ? 'Vidriera aceptable' : 'Vidriera... original', n + ' de 4 productos van con "' + th.t + '".', { quality: n / 4 }); }, 700);
      }
    }
    btns.forEach(b => b.addEventListener('click', () => toggle(b)));
    cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= btns.length) toggle(btns[n - 1]); };
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

  const GAMES = { mostrador, caja, pc, service, ml, whatsapp, repo, stock, proveedor, devol, cierre, vidriera };
  return {
    // type: 'mostrador' | 'caja'; opts.variant para caja: 'cobro' | 'vuelto' | 'comprobante'
    open(type, cust, cb, opts) {
      close(); cur = { type, cust, cb, keys: null, done: false, timer: null };
      root().hidden = false;
      GAMES[type](cust, opts && opts.variant);
    },
    close,
    // Tarjeta de inducción: el Dueño explica una estación la primera vez
    intro(station, text, onOk) {
      close(); cur = { type: 'intro', cb: {}, keys: null, done: true, timer: null };
      root().hidden = false;
      root().innerHTML = '<div class="mg-head"><div class="mg-face boss">🕴️</div><div class="mg-who"><b>El Dueño te explica</b><span>' + esc(station.icon + ' ' + station.name) + '</span></div><div class="mg-station">Inducción</div></div>' +
        '<div class="bubble">' + esc(text) + '</div><button class="btn" id="mgOk">Entendido</button>';
      const go = () => { document.removeEventListener('keydown', key); onOk(); };
      const key = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
      document.getElementById('mgOk').addEventListener('click', go); document.addEventListener('keydown', key);
    },
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
