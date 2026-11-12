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

  return {
    // type: 'mostrador' | 'caja'; opts.variant para caja: 'cobro' | 'vuelto' | 'comprobante'
    open(type, cust, cb, opts) {
      close(); cur = { type, cust, cb, keys: null, done: false, timer: null };
      root().hidden = false;
      if (type === 'mostrador') mostrador(cust); else caja(cust, opts && opts.variant);
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
