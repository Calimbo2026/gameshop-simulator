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
    const pic = cust.look && GS.faceSvg;      // los clientes muestran su cara, con la mueca que corresponde a lo que pasa
    return '<div class="mg-head"><div class="mg-face' + (pic ? ' pic' : '') + '" id="mgFace">' + (pic ? GS.faceSvg(cust.look, cust.pat < 0.35 ? 'impatient' : 'talk') : cust.arche.face) + '</div><div class="mg-who"><b>' + esc(cust.arche.name) + '</b><span>' + esc(cust.arche.tag) +
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
  function face(m) { const el = document.getElementById('mgFace'); if (el && cur && cur.cust && cur.cust.look && GS.faceSvg) el.innerHTML = GS.faceSvg(cur.cust.look, m); }
  /* Juicio equivocado en una jornada: no se avisa en el momento. La tarea termina igual y el aviso del Dueño llega un rato después (slip = lo que dice el aviso). */
  const late = () => !!(cur && cur.cb.deferred);
  function mistake(kind, text, slip) { if (slip && late()) { GS.Audio.play('click'); return finish(true, 'Listo', '', { slip: { kind, text: slip }, total: 0 }); } GS.Audio.play('error'); say(text, true); face('angry'); const c = cur; setTimeout(() => { if (cur === c && !c.done) face(c.cust.pat < 0.35 ? 'impatient' : 'sad'); }, 1600); cur.cb.onMistake(kind); }
  function finish(ok, title, sub, info) {
    if (!cur || cur.done) return; cur.done = true; face(info && info.caught ? 'nervous' : ok ? 'happy' : info && info.cajaError ? 'happy' : 'angry');
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
      '<div class="bubble" id="mgBubble">' + esc(cust.request) + '</div>' + (GS.LOOKS[prod.id] ? '<div class="ask-how"><small>👀 Cómo es</small>' + esc(GS.LOOKS[prod.id]) + '</div>' : '') +
      '<div class="opts">' + options.map((p, i) => '<button class="opt" data-id="' + p.id + '"><kbd>' + (i + 1) + '</kbd>' + pic(p) + '<span class="n">' + esc(p.name) + '</span></button>').join('') + '</div>' +
      '<div class="rule">Tocá el producto que coincide con la descripción</div>';
    const btns = [...root().querySelectorAll('.opt')];
    function choose(b) {
      if (!cur || cur.done || b.classList.contains('bad')) return;
      if (b.dataset.id === prod.id) { b.classList.add('good'); GS.Audio.play('ok'); finish(true, '¡Era eso!', prod.name + ' · pasa por caja', {}); }
      else if (late()) mistake('mostrador', '', 'Pidió ' + prod.name + ' y se llevó ' + ((GS.CATALOG.filter(x => x.id === b.dataset.id)[0] || {}).name || 'otra cosa') + '. Va a volver a cambiarlo.');
      else if ((GS.Store.get('days') || 0) < 1) { b.classList.add('bad'); mistake('mostrador', U.pick(LN.wrongProduct)); }      // el primer día se puede reintentar
      else { b.classList.add('bad'); GS.Audio.play('lost'); cur.cb.onMistake('mostrador'); finish(false, 'Venta perdida', U.pick(LN.lostSale), { lostSale: true }); }   // producto equivocado: el cliente se va
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
    let line, q, how, correct, wrong, total, fmt = U.money, why, okTitle = '¡Cobrado!';
    if (kind === 'cash' || kind === 'transfer') {
      // Se pregunta el descuento (el 10% del precio), no el total: es la cuenta que hay que saber hacer en la caja
      line = U.pick(kind === 'cash' ? LN.payCash : LN.payTransfer); how = kind === 'cash' ? 'Paga en EFECTIVO' : 'Paga por TRANSFERENCIA';
      q = 'Tiene 10% OFF. ¿Cuántos pesos le descontás?'; correct = Math.round(P * 0.1); wrong = [Math.round(P * 0.01), Math.round(P * 0.2)]; total = P - correct;
      why = 'El 10% de ' + U.money(P) + ' es ' + U.money(correct) + ': se le corre una coma al precio.'; okTitle = '¡Descuento justo!';
    } else if (kind === 'cuotas') {
      line = U.pick(LN.payCuotas); how = 'Paga con TARJETA en 3 cuotas'; q = '¿De cuánto es cada cuota?'; correct = Math.round(P / 3); wrong = [Math.round(P * 0.3), Math.round(P / 2)]; total = P; fmt = n => '3 × ' + U.money(n);
      why = 'Son 3 cuotas sin interés sobre el precio de lista.';
    } else {
      line = U.pick(LN.payDebit); how = 'Paga con DÉBITO'; q = '¿Cuántos pesos le descontás?'; correct = 0; wrong = [Math.round(P * 0.1), Math.round(P * 0.05)]; total = P; fmt = n => n ? U.money(n) : 'Nada: $0';
      why = 'El 10% OFF es solo en efectivo o transferencia. Con débito no hay descuento.';
    }
    const options = U.shuffle([correct].concat(wrong));
    root().innerHTML = head(cust, 'Caja') +
      '<div class="bubble" id="mgBubble">' + esc(line) + '</div>' +
      '<div class="info"><span>' + ico(cust.product) + esc(cust.product.name) + '</span><span>Precio de lista <b>' + U.money(P) + '</b></span></div>' +
      '<div class="ask"><span>' + how + '</span><b>' + q + '</b></div>' +
      '<div class="opts one">' + options.map((v, i) => '<button class="opt" data-v="' + v + '"><kbd>' + (i + 1) + '</kbd><span class="n">' + fmt(v) + '</span></button>').join('') + '</div>' +
      '<div class="rule">10% OFF en efectivo o transferencia · 3 cuotas sin interés con tarjeta</div>';
    const btns = [...root().querySelectorAll('.opt')];
    function choose(b) {
      if (!cur || cur.done || b.classList.contains('bad')) return;
      if (Number(b.dataset.v) === correct) { b.classList.add('good'); GS.Audio.play('cash'); finish(true, okTitle, 'Le cobrás ' + U.money(total), { total }); }
      else { b.classList.add('bad'); mistake('caja', U.pick(LN.wrongCash) + ' (' + why + ')', 'Cobro mal hecho. ' + why); }
    }
    btns.forEach(b => b.addEventListener('click', () => choose(b)));
    cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= btns.length) choose(btns[n - 1]); };
  }

  // (b) Dar el vuelto sumando billetes
  function cajaVuelto(cust) {
    const T = Math.floor(cust.product.price * 0.9 / 1000) * 1000;      // en efectivo se redondea a favor del cliente: siempre se puede armar con los billetes
    const cands = [Math.ceil((T + 1) / 10000) * 10000, Math.ceil((T + 1) / 20000) * 20000 + 20000, Math.ceil((T + 1) / 50000) * 50000]
      .filter(g => g - T >= 1000 && g - T <= 45000);
    const G = cands.length ? U.pick(cands) : T + 5000, change = G - T;
    const bills = [20000, 10000, 2000, 1000], V = GS.Vueltos.billSvg, give = [], me = cur;
    const paid = []; { let g = G; [20000, 10000].forEach(d => { const n = Math.floor(g / d); if (n) { paid.push([d, n]); g -= n * d; } }); }      /* lo que apoya el cliente: pilas de 20.000 y de 10.000 */
    root().innerHTML = head(cust, 'Caja · Vuelto') +
      '<div class="vt-reg"><i></i><div><small>TOTAL A COBRAR · con 10% OFF</small><output>' + U.money(T) + '</output></div></div>' +
      '<div class="vt-counter" id="mgVt" data-t="' + T + '" data-g="' + G + '"><small>EL CLIENTE TE DA · ' + U.money(G) + '</small><div class="vt-paid">' + paid.map((q, i) => '<span class="vb paid" style="--r:' + (i ? 4 : -4) + 'deg">' + V(q[0]) + (q[1] > 1 ? '<em>×' + q[1] + '</em>' : '') + '</span>').join('') + '</div>' +
        '<div class="vt-hand"><small>TU VUELTO</small><output id="mgGiven">$0</output><div class="vt-give" id="mgPile"><em>Sacá los billetes del cajón</em></div></div></div>' +
      '<div class="vt-tray"><small>CAJÓN DE LA CAJA</small><div>' + bills.map(b => '<button class="bill vb tray" data-b="' + b + '" aria-label="Billete de ' + U.money(b) + '">' + V(b) + '</button>').join('') + '</div></div>' +
      '<div class="row"><button class="btn ghost" id="mgClear">Borrar</button><button class="btn" id="mgGive" style="flex:2;font-size:19px;padding:12px">Dar el vuelto</button></div>';
    const out = document.getElementById('mgGiven'), pile = document.getElementById('mgPile');
    const paint = () => { const sum = give.reduce((a, b) => a + b, 0); out.textContent = U.money(sum); pile.innerHTML = give.length ? give.map((d, i) => '<button class="vb mine" data-i="' + i + '">' + V(d) + '</button>').join('') : '<em>Sacá los billetes del cajón</em>'; };
    const add = b => { if (cur !== me || me.done || give.length >= 12) return; give.push(b); paint(); GS.Audio.play('bill'); };
    const clear = () => { give.length = 0; paint(); GS.Audio.play('click'); };
    pile.addEventListener('click', e => { const b = e.target.closest('.mine'); if (!b || cur !== me || me.done) return; give.splice(Number(b.dataset.i), 1); paint(); GS.Audio.play('drop'); });
    function giveIt() {
      if (cur !== me || me.done) return; const given = give.reduce((a, b) => a + b, 0);
      if (given === change) { GS.Audio.play('cash'); finish(true, '¡Vuelto justo!', 'Cobraste ' + U.money(T), { total: T }); }
      else { mistake('caja', U.pick(given < change ? LN.changeShort : LN.changeOver), 'Diste ' + U.money(given) + ' de vuelto y eran ' + U.money(change) + '. ' + (given < change ? 'El cliente volvió a reclamar.' : 'La diferencia salió de la caja.')); clear(); }
    }
    root().querySelectorAll('.bill').forEach(b => b.addEventListener('click', () => add(Number(b.dataset.b))));
    document.getElementById('mgClear').addEventListener('click', clear);
    document.getElementById('mgGive').addEventListener('click', giveIt);
    cur.keys = e => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) add(bills[n - 1]); else if (e.key === 'Backspace') clear(); else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); giveIt(); }
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
    face(fake ? (Math.random() < 0.6 ? 'nervous' : 'normal') : Math.random() < 0.12 ? 'nervous' : 'normal');     // el que trae un comprobante trucho suele transpirar (no siempre)
    const rb = [...root().querySelectorAll('.rowb')];
    const mark = () => { if (flag) root().querySelector('.rowb[data-k="' + flag + '"]').classList.add('flag'); };
    function tapRow(b) {
      if (!cur || cur.done || b.classList.contains('fine')) return;
      if (fake && b.dataset.k === flag) { mark(); GS.Audio.play('ok'); finish(true, '¡Bien visto!', 'El comprobante estaba mal. Se va sin el producto.', { total: 0, caught: true }); }
      else { b.classList.add('fine'); mistake('caja', U.pick(fake ? LN.rowFine : LN.rowFineAll), fake ? 'Comprobante: marcaste un dato que estaba bien. El trucho era otro y pasó.' : 'Rechazaste un comprobante que estaba bien. El cliente se fue ofendido.'); }
    }
    function approve() {
      if (!cur || cur.done) return;
      if (!fake) { GS.Audio.play('cash'); finish(true, '¡Acreditado!', U.money(T), { total: T }); }
      else if (late()) mistake('caja', '', 'Aprobaste un comprobante trucho: se llevó el producto sin pagar.');
      else { mark(); GS.Audio.play('error'); cur.cb.onMistake('caja'); finish(false, 'Era trucho', 'Mirá el dato marcado en rojo. ' + U.pick(LN.receiptFakeApproved), { total: 0, cajaError: true }); }
    }
    rb.forEach(b => b.addEventListener('click', () => tapRow(b)));
    document.getElementById('mgYes').addEventListener('click', approve);
    cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 4) tapRow(rb[n - 1]); else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); approve(); } };
  }

  /* ---------------- 3. ARMADO DE PC: arrastrar cada pieza a su lugar en el motherboard, dentro del gabinete (una viene al revés) ----------------
     También se puede tocar la pieza y después el lugar. Las medidas de PCS están en la grilla 320 x 200 del dibujo. */
  const PCS = { cpu: [104, 22, 44, 44], ram: [160, 18, 24, 56, 1], ssd: [98, 72, 56, 17.5], gpu: [56, 92, 88, 55], psu: [14, 152, 54, 40] };
  function pcCase() {
    const fan = (cx, cy, r, c) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#0c0c10" stroke="#33333c" stroke-width="1.500"/><circle class="led" cx="' + cx + '" cy="' + cy + '" r="' + (r - 3) + '" fill="none" stroke="' + c + '" stroke-width="2.200" opacity=".35"/><g class="spin" style="transform-origin:' + cx + 'px ' + cy + 'px"><path d="M' + cx + ' ' + (cy - r + 5) + 'v' + (2 * r - 10) + 'M' + (cx - r + 5) + ' ' + cy + 'h' + (2 * r - 10) + 'M' + (cx - r * 0.6) + ' ' + (cy - r * 0.6) + 'l' + r * 1.2 + ' ' + r * 1.2 + 'M' + (cx + r * 0.6) + ' ' + (cy - r * 0.6) + 'l' + (-r * 1.2) + ' ' + r * 1.2 + '" stroke="#3a3a44" stroke-width="2.400" stroke-linecap="round"/></g><circle cx="' + cx + '" cy="' + cy + '" r="3.500" fill="#26262c"/>';
    return '<svg class="pcsvg" viewBox="0 0 320 200" preserveAspectRatio="none"><rect x="1" y="1" width="318" height="198" rx="9" fill="#1d1d23"/><rect x="7" y="7" width="306" height="186" rx="5" fill="#11131b"/><rect x="18" y="194" width="34" height="6" rx="2" fill="#0c0c10"/><rect x="268" y="194" width="34" height="6" rx="2" fill="#0c0c10"/>' +
      '<rect x="7" y="148" width="306" height="45" fill="#0a0b10"/><path d="M7 148H313" stroke="#26262c" stroke-width="2"/><rect x="84" y="166" width="44" height="6" rx="3" fill="#e10600"/><g fill="#1a1c25">' + Array.from({ length: 9 }, (_, i) => '<rect x="' + (150 + i * 12) + '" y="158" width="6" height="26" rx="3"/>').join('') + '</g>' +
      fan(27, 46, 15, '#56c8ff') + fan(284, 44, 24, '#ff4fa3') + fan(284, 106, 24, '#3aff9c') +
      '<rect x="46" y="10" width="200" height="136" rx="3" fill="#182441" stroke="#0c1224" stroke-width="1.500"/><rect x="46" y="14" width="9" height="62" fill="#9aa0ad"/><g fill="#55555f"><rect x="47.500" y="18" width="6" height="8"/><rect x="47.500" y="30" width="6" height="12"/><rect x="47.500" y="46" width="6" height="8"/><rect x="47.500" y="58" width="6" height="12"/></g>' +
      '<g fill="none" stroke="#2a3d6e" stroke-width="1.200"><path d="M150 44h8M126 68v4M126 90v4M60 84h34v-8M190 60v38h-30M200 30h30v60M150 120h60M70 20h24M214 110v26"/></g>' +
      '<rect x="62" y="16" width="34" height="13" rx="2" fill="#2c2c33"/><path d="M66 19v7M71 19v7M76 19v7M81 19v7M86 19v7M91 19v7" stroke="#55555f" stroke-width="1.400"/><rect x="62" y="34" width="13" height="36" rx="2" fill="#2c2c33"/><path d="M65 38h7M65 43h7M65 48h7M65 53h7M65 58h7M65 63h7" stroke="#55555f" stroke-width="1.400"/>' +
      '<rect x="100" y="18" width="52" height="52" rx="3" fill="#0e1528" stroke="#3a4a7a" stroke-width="1.200"/><rect x="190" y="18" width="5" height="56" rx="1.500" fill="#0c0c10" stroke="#3a4a7a" stroke-width=".8"/><rect x="200" y="18" width="5" height="56" rx="1.500" fill="#0c0c10" stroke="#3a4a7a" stroke-width=".8"/><rect x="158" y="14" width="28" height="64" rx="2" fill="#0e1528" stroke="#3a4a7a" stroke-width="1.200"/>' +
      '<rect x="94" y="70" width="64" height="21" rx="2" fill="#0e1528" stroke="#3a4a7a" stroke-width="1.200"/><rect x="52" y="140" width="110" height="5" rx="1.500" fill="#0c0c10" stroke="#3a4a7a" stroke-width=".8"/><rect x="52" y="90" width="96" height="59" rx="3" fill="#0e1528" stroke="#3a4a7a" stroke-width="1.200" opacity=".85"/>' +
      '<rect x="172" y="96" width="46" height="36" rx="4" fill="#2c2c33"/><rect class="led" x="176" y="100" width="38" height="4" rx="2" fill="#e10600" opacity=".5"/><path d="M178 112h34M178 118h34M178 124h34" stroke="#3f3f49" stroke-width="2"/><rect x="232" y="24" width="9" height="40" rx="1.500" fill="#f4f4f2"/><path d="M233.500 28h6M233.500 34h6M233.500 40h6M233.500 46h6M233.500 52h6M233.500 58h6" stroke="#55555f" stroke-width="1.600"/>' +
      '<circle cx="226" cy="84" r="6" fill="#c5c9d2" stroke="#8d93a0" stroke-width="1"/><g fill="#0c0c10"><rect x="226" y="104" width="14" height="6" rx="1"/><rect x="226" y="114" width="14" height="6" rx="1"/><rect x="226" y="124" width="14" height="6" rx="1"/></g>' +
      '<g fill="#c5c9d2"><circle cx="51" cy="82" r="1.800"/><circle cx="241" cy="15" r="1.800"/><circle cx="241" cy="141" r="1.800"/><circle cx="166" cy="141" r="1.800"/></g>' +
      '<rect x="10" y="150" width="62" height="42" rx="3" fill="#0e1016" stroke="#33333c" stroke-width="1.200"/><g fill="none" stroke-linecap="round" stroke-width="2.600"><path d="M72 160q30-4 60-14" stroke="#f5c518"/><path d="M72 167q60 0 100-12t68-60" stroke="#26262c"/><path d="M72 174q70 6 110-8" stroke="#e10600" opacity=".8"/></g>' +
      '<g id="pcIn"></g><path d="M7 60L70 7H110L7 100Z" fill="#fff" opacity=".04"/></svg>';
  }
  function pc(job) {
    const parts = GS.PC_PARTS, tray = U.shuffle(parts), flipped = U.pick(parts).id, me = cur, P = {}; let sel = null, drag = null, noClick = 0;
    const pct = (v, t) => (v / t * 100).toFixed(2) + '%';
    root().innerHTML = head(job, 'Armado de PC') +
      '<div class="pcb pcase" id="mgPcb">' + pcCase() +
      parts.map((p, i) => { const q = PCS[p.id]; return '<button class="pslot s-' + p.id + '" data-id="' + p.id + '" style="left:' + pct(q[0], 320) + ';top:' + pct(q[1], 200) + ';width:' + pct(q[2], 320) + ';height:' + pct(q[3], 200) + '"><kbd>' + 'ABCDE'[i] + '</kbd><em>' + esc(p.short || p.name) + '</em></button>'; }).join('') +
      '<button class="pcpow" id="mgPower"><i>⏻</i><span>Encender</span></button></div>' +
      '<div class="rule" id="mgBubble">Arrastrá cada pieza a su lugar. La muesca amarilla de la pieza tiene que coincidir con la del lugar.</div>' +
      '<div class="parts">' + tray.map((p, i) => '<button class="opt part' + (p.id === flipped ? ' flip' : '') + '" data-id="' + p.id + '"><kbd>' + (i + 1) + '</kbd><span class="pi">' + p.svg + '</span><span class="n">' + esc(p.name) + '</span></button>').join('') + '</div>';
    const slots = [...root().querySelectorAll('.pslot')], btns = [...root().querySelectorAll('.part')], pcb = document.getElementById('mgPcb'), trayOf = id => btns.filter(b => b.dataset.id === id)[0];
    const live = () => cur === me && !cur.done;
    /* cada pieza sobre el gabinete: queda donde se la suelta (x, y = centro, en la grilla 320 x 200) */
    function pieceEl(id) {
      const q = PCS[id], W = q[2], H = q[3], svg = parts.find(p => p.id === id).svg, put = (x, y, w, h) => svg.replace('<svg ', '<svg x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" ');
      const el = document.createElement('div'); el.className = 'pp'; el.dataset.id = id; el.style.width = pct(W, 320); el.style.height = pct(H, 200);
      el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '">' + (q[4] ? '<g transform="translate(' + W / 2 + ' ' + H / 2 + ') rotate(90)">' + put(-H / 2, -W / 2, H, W) + '</g>' : put(0, 0, W, H)) + '</svg>';
      el.addEventListener('pointerdown', e => startDrag(id, e, el)); el.addEventListener('pointermove', moveDrag); el.addEventListener('pointerup', endDrag); el.addEventListener('pointercancel', endDrag);
      pcb.appendChild(el); return el;
    }
    function setPos(id, x, y) { const p = P[id], q = PCS[id]; p.x = U.clamp(x, q[2] / 2 + 4, 316 - q[2] / 2); p.y = U.clamp(y, q[3] / 2 + 4, 196 - q[3] / 2); p.el.style.left = pct(p.x, 320); p.el.style.top = pct(p.y, 200); }
    function place(id, x, y, flip) { if (!P[id]) P[id] = { el: pieceEl(id), flip: !!flip }; const p = P[id]; p.el.classList.toggle('flipd', p.flip); p.el.classList.remove('bad'); setPos(id, x, y); const t = trayOf(id); t.classList.add('used'); t.classList.remove('sel'); if (sel === t) sel = null; refresh(); }
    function unplace(id) { if (!P[id]) return; P[id].el.remove(); delete P[id]; trayOf(id).classList.remove('used'); refresh(); }
    function refresh() { const n = Object.keys(P).length; document.getElementById('mgPower').classList.toggle('rdy', n === parts.length); slots.forEach(s => s.classList.toggle('full', false)); }
    const good = id => { const p = P[id], q = PCS[id]; return p && Math.abs(p.x - (q[0] + q[2] / 2)) <= q[2] * 0.32 + 7 && Math.abs(p.y - (q[1] + q[3] / 2)) <= q[3] * 0.32 + 7; };
    const toGrid = (cx, cy) => { const r = pcb.getBoundingClientRect(); return [(cx - r.left) / r.width * 320, (cy - r.top) / r.height * 200, cx >= r.left - 10 && cx <= r.right + 10 && cy >= r.top - 10 && cy <= r.bottom + 10]; };
    function pickPart(b) {
      if (!live() || b.classList.contains('used')) return;
      if (sel === b && b.classList.contains('flip')) { b.classList.remove('flip'); GS.Audio.play('swipe'); say(U.pick(LN.flipPc) + ' Ahora arrastrala a su lugar.', false); return; }
      sel = b; btns.forEach(x => x.classList.toggle('sel', x === b)); GS.Audio.play('click');
      say(b.classList.contains('flip') ? 'Esa está al revés: tocala de nuevo para girarla.' : 'Ahora arrastrala (o tocá) dónde va.', false);
    }
    function pickSlot(sl) {            /* tocar una pieza y después un lugar también vale */
      if (!live()) return; if (!sel) { say('Arrastrá una pieza de abajo hasta acá.', false); return; }
      const q = PCS[sl.dataset.id], id = sel.dataset.id; place(id, q[0] + q[2] / 2, q[1] + q[3] / 2, sel.classList.contains('flip')); GS.Audio.play('bill'); say('Quedó ahí. Cuando estén todas, tocá Encender.', false);
    }
    function startDrag(id, e, src) { if (!live()) return; drag = { id, x: e.clientX, y: e.clientY, on: false, src, tray: src.classList.contains('part') }; try { src.setPointerCapture(e.pointerId); } catch (er) {} }
    function moveDrag(e) { if (!drag) return; const lift = e.pointerType === 'mouse' ? 0 : 30;
      if (!drag.on) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return; drag.on = true; GS.Audio.play('click'); const g = toGrid(e.clientX, e.clientY - lift); if (drag.tray) { place(drag.id, g[0], g[1], drag.src.classList.contains('flip')); } P[drag.id].el.classList.add('drag'); pcb.classList.add('dragging'); }
      const g = toGrid(e.clientX, e.clientY - lift), p = P[drag.id]; p.el.classList.remove('bad'); p.x = g[0]; p.y = g[1]; p.el.style.left = pct(g[0], 320); p.el.style.top = pct(g[1], 200); }
    function endDrag(e) { if (!drag) return; const d = drag; drag = null; pcb.classList.remove('dragging');
      if (!d.on) { if (!d.tray && live()) { const p = P[d.id]; p.flip = !p.flip; p.el.classList.toggle('flipd', p.flip); p.el.classList.remove('bad'); GS.Audio.play('swipe'); say(p.flip ? 'La diste vuelta.' : U.pick(LN.flipPc), false); } return; }
      noClick = Date.now(); const lift = e.pointerType === 'mouse' ? 0 : 30, g = toGrid(e.clientX, e.clientY - lift), p = P[d.id]; p.el.classList.remove('drag');
      if (!g[2]) { unplace(d.id); say('La pieza volvió a la bandeja.', false); return; }
      setPos(d.id, g[0], g[1]); GS.Audio.play('drop'); say(Object.keys(P).length === parts.length ? 'Están todas. Tocá Encender.' : 'Quedó ahí. Seguí con las demás.', false); }
    function power() {
      if (!live()) return; const ids = parts.map(p => p.id), miss = ids.filter(id => !P[id]);
      if (miss.length) { GS.Audio.play('error'); say(miss.length === 1 ? 'Falta una pieza. Así no enciende.' : 'Faltan ' + miss.length + ' piezas. Así no enciende.', true); return; }
      const bad = ids.filter(id => !good(id) || P[id].flip);
      if (bad.length) { ids.forEach(id => P[id].el.classList.toggle('bad', bad.indexOf(id) >= 0)); pcb.classList.remove('fail'); void pcb.offsetWidth; pcb.classList.add('fail');
        const rev = bad.filter(id => good(id) && P[id].flip).length; return mistake('pc', 'No enciende. ' + (bad.length === 1 ? (rev ? 'Hay una pieza al revés: tocala para girarla.' : 'Hay una pieza fuera de lugar.') : 'Hay ' + bad.length + ' piezas mal puestas (en rojo).')); }
      ids.forEach(id => { const q = PCS[id]; P[id].el.classList.add('snap'); setPos(id, q[0] + q[2] / 2, q[1] + q[3] / 2); }); slots.forEach(s => s.classList.add('full'));
      pcb.classList.add('on'); GS.Audio.play('power'); say('¡Prende! Y con lucecitas.', false); cur.locked = 1;
      setTimeout(() => { if (cur === me) finish(true, '¡Prendió!', 'Y con lucecitas.', {}); }, 1300);
    }
    btns.forEach(b => { b.addEventListener('pointerdown', e => { if (!b.classList.contains('used')) startDrag(b.dataset.id, e, b); }); b.addEventListener('pointermove', moveDrag); b.addEventListener('pointerup', endDrag); b.addEventListener('pointercancel', endDrag);
      b.addEventListener('click', () => { if (Date.now() - noClick < 350) return; pickPart(b); }); });
    slots.forEach(sl => sl.addEventListener('click', () => pickSlot(sl)));
    document.getElementById('mgPower').addEventListener('click', power);
    cur.keys = e => {
      const n = parseInt(e.key, 10), k = 'abcde'.indexOf((e.key || '').toLowerCase());
      if (n >= 1 && n <= btns.length) pickPart(btns[n - 1]); else if (k >= 0 && e.key.length === 1) pickSlot(slots[k]); else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); power(); }
    };
  }

  /* ---------------- 4. SERVICE TÉCNICO: diagnóstico, limpieza o encajar la RAM ---------------- */
  function service(job, variant) {
    variant = variant || U.pick(['diag', 'diag', 'pelusa', 'ram']);
    if (variant === 'pelusa') return servicePelusa(job);
    if (variant === 'ram') return serviceRam(job);
    /* diagnóstico: la PC abierta muestra una pista chiquita; hay que tocar la pieza que causa el problema */
    const d = U.pick(DIAG_PC), me = cur, NM = { cpu: 'El procesador', ram: 'La memoria', ssd: 'El disco', gpu: 'La placa de video', psu: 'La fuente', fan: 'Ese cooler' };
    const Z = [['cpu'].concat(PCS.cpu), ['ram'].concat(PCS.ram), ['ssd', 96, 68, 60, 25], ['gpu'].concat(PCS.gpu), ['psu'].concat(PCS.psu), ['fan', 10, 29, 34, 34], ['fan', 258, 18, 52, 52], ['fan', 258, 80, 52, 52]];
    const FX = {
      cpu: '<rect class="fxh" x="104" y="22" width="44" height="44" rx="4" fill="#ff5a1f"/><g class="fxw" fill="none" stroke="#ffb066" stroke-width="2.2" stroke-linecap="round"><path d="M114 36q4-5 0-10q-4-5 0-10"/><path d="M126 38q4-5 0-10q-4-5 0-10"/><path d="M138 36q4-5 0-10q-4-5 0-10"/></g>',
      fan: '<g fill="#a09a8c" stroke="#77725f" stroke-width=".8"><ellipse cx="276" cy="38" rx="9" ry="6"/><ellipse cx="292" cy="50" rx="10" ry="6.5"/><ellipse cx="290" cy="34" rx="6" ry="4.5"/><ellipse cx="275" cy="54" rx="7" ry="4.5"/><ellipse cx="284" cy="44" rx="6" ry="5"/></g>',
      gpu: '', ram: '<rect x="162.5" y="38" width="19" height="10" rx="2" fill="#fff" stroke="#17171c" stroke-width=".8"/><text x="172" y="45.6" font-size="6.6" font-weight="800" text-anchor="middle" fill="#17171c" font-family="Arial, sans-serif">4GB</text>',
      psu: '<path d="M70 160q28-3 60-14" stroke="#0a0b10" stroke-width="5" fill="none"/><path d="M70 162q16 3 18 18" stroke="#f5c518" stroke-width="2.6" fill="none" stroke-linecap="round"/><rect x="83" y="179" width="10" height="9" rx="2" fill="#2c2c33" stroke="#55555f" stroke-width=".8"/><path d="M86 188v4M90 188v4" stroke="#c5c9d2" stroke-width="1.4"/>',
      ssd: '<rect x="102" y="83.5" width="48" height="3.4" rx="1.7" fill="#3a0d0d"/><rect class="fxb" x="102" y="83.5" width="48" height="3.4" rx="1.7" fill="#ff3b30"/>' };
    root().innerHTML = head(job, 'Taller · Diagnóstico') + '<div class="bubble">' + esc(d.s) + '</div>' +
      '<div class="pcb pcase dg" id="mgPcb">' + pcCase() + GS.PC_PARTS.map(p => partHtml(p.id, d.id === 'gpu' && p.id === 'gpu' ? 'loose' : '')).join('') + '<svg class="dgfx" viewBox="0 0 320 200" preserveAspectRatio="none">' + FX[d.id] + '</svg>' +
      Z.map(z => '<button class="dgz" data-id="' + z[0] + '" data-ok="' + (z[0] === d.id ? 1 : 0) + '" style="left:' + pc100(z[1], 320) + ';top:' + pc100(z[2], 200) + ';width:' + pc100(z[3], 320) + ';height:' + pc100(z[4], 200) + '"></button>').join('') + '</div>' +
      '<div class="rule" id="mgBubble">' + (firstTime('diag') ? '👆 Primera vez: leé qué le pasa, buscá algo raro adentro de la PC y tocá esa pieza. Se pueden tocar las que parpadean.' : 'Mirá bien la PC y tocá la pieza que está causando el problema.') + '</div>';
    if (firstTime('diag')) root().querySelectorAll('.dgz').forEach(z => z.classList.add('hintz'));
    root().querySelectorAll('.dgz').forEach(b => b.addEventListener('click', () => {
      if (cur !== me || me.done || me.hold || b.classList.contains('bad')) return;
      if (b.dataset.ok === '1') { me.hold = true; learned('diag'); root().querySelectorAll('.dgz').forEach(z => z.classList.remove('hintz')); root().querySelectorAll('.dgz[data-ok="1"]').forEach(x => x.classList.add('good')); GS.Audio.play('ok'); setTimeout(() => { if (cur === me) finish(true, d.t, d.r, {}); }, 550); }
      else { root().querySelectorAll('.dgz[data-id="' + b.dataset.id + '"]').forEach(x => x.classList.add('bad')); mistake('service', NM[b.dataset.id] + ' está bien. ' + U.pick(['Buscá algo raro.', 'Mirá con más cariño.', 'Casi. Bah, no.']), 'Taller: diagnóstico errado. ' + NM[b.dataset.id] + ' estaba bien, y la falla sigue ahí.'); }
    }));
    cur.keys = () => {};
  }
  function servicePelusa(job) {
    const N = 14; let left = N; const me = cur;
    root().innerHTML = head(job, 'Taller · Limpieza') + '<div class="bubble" id="mgBubble">Hace ruido de avión. Adentro hay algo... peludo.</div>' +
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
    root().innerHTML = head(job, 'Taller · Memoria RAM') + '<div class="bubble" id="mgBubble">Le agregamos memoria. Tiene que caer justo en la ranura.</div>' +
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

  /* ---------------- 5. COMPRAS POR LA PÁGINA: caja del tamaño justo, cinta y etiqueta correcta ---------------- */
  function ml(job) {
    const prod = U.pick(GS.CATALOG), SZ = ['chica', 'mediana', 'grande'], size = SZ.find(k => GS.BOX_SIZE[k].indexOf(prod.id) >= 0) || 'mediana';
    const num = Math.floor(U.rnd(1000, 9999)), cities = U.shuffle(GS.CITIES), city = cities[0], buyers = U.shuffle(GS.BUYERS), buyer = buyers[0], me = cur, icon = GS.ICONS[prod.id] || '<span class="i">' + prod.icon + '</span>';
    const order = '<div class="order"><b>Pedido #' + num + '</b><span>' + ico(prod) + esc(prod.name) + ' · mide unos ' + GS.BOXES[size].cm + ' cm</span><span>Para: ' + buyer + ' · ' + esc(city) + '</span></div>';
    const steps = n => '<div class="steps">' + ['Caja', 'Cinta', 'Etiqueta'].map((t, i) => '<span class="' + (i < n ? 'done' : i === n ? 'now' : '') + '">' + (i + 1) + '. ' + t + '</span>').join('') + '</div>';
    const live = () => cur === me && !me.done && !me.hold;
    function stepBox() {
      root().innerHTML = head(job, 'Compra por la página') + steps(0) + order +
        '<div class="pk-prod" id="pkP"><span class="pk-ic">' + icon + '</span><small>👆 Arrastralo a la caja donde entra justo</small></div>' +
        '<div class="pk-boxes">' + SZ.map((b, i) => '<button class="pk-box b' + i + '" data-b="' + b + '" data-ok="' + (b === size ? 1 : 0) + '"><kbd>' + (i + 1) + '</kbd><span class="pk-dr">' + boxSvg(true) + '<span class="pk-in">' + icon + '</span></span><span class="n">Caja ' + b + '<small>hasta ' + GS.BOXES[b].max + ' cm</small></span></button>').join('') + '</div>' +
        '<div class="rule" id="mgBubble">' + (firstTime('ml') ? '👆 Primera vez: arrastrá el producto hasta una caja. Fijate cuánto mide y hasta cuánto entra en cada una.' : 'Ni apretado ni bailando: tiene que entrar justo.') + '</div>';
      const P = document.getElementById('pkP'), bx = [...root().querySelectorAll('.pk-box')];
      if (firstTime('ml')) hand(P, root().querySelector('.pk-boxes'));
      function tryBox(b) {
        if (!live() || b.classList.contains('bad')) return;
        if (b.dataset.ok === '1') { me.hold = true; learned('ml'); b.classList.add('in'); P.classList.add('gone'); GS.Audio.play('drop'); return void setTimeout(() => { if (cur === me) { me.hold = false; stepTape(); } }, 700); }
        const small = SZ.indexOf(b.dataset.b) < SZ.indexOf(size); b.classList.add('bad', small ? 'sm' : 'bg');
        mistake('ml', small ? U.pick(['No entra ni empujando. Probá una más grande.', 'Entra... si lo doblás. No lo dobles.']) : U.pick(['Baila adentro como maraca. Probá una más chica.', 'Con esa caja pagás flete por aire.']));
      }
      grab(P, '<span class="pk-ic">' + icon + '</span>', t => { const b = t && t.closest && t.closest('.pk-box'); if (b) tryBox(b); else say('Soltalo arriba de una caja.', false); }, 'pk');
      bx.forEach(b => b.addEventListener('click', () => tryBox(b)));
      cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 3) tryBox(bx[n - 1]); };
    }
    function stepTape() {
      let prog = 0, down = false;
      root().innerHTML = head(job, 'Compra por la página') + steps(1) + order + '<div class="info" id="mgBubble"><b>Cerrala con cinta: deslizá el dedo de punta a punta</b></div>' +
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
      const lab = l => '<span class="bars"></span><span class="n">#' + l.n + '<small>' + l.b + ' · ' + esc(l.c) + '</small></span>';
      root().innerHTML = head(job, 'Compra por la página') + steps(2) + '<div class="pk-row">' + order + '<div class="pk-closed" id="pkC">' + boxSvg(false) + '<i class="pk-spot">Pegá acá</i></div></div>' +
        '<div class="opts one pk-labs">' + labels.map((l, i) => '<button class="opt tagl" data-ok="' + l.ok + '"><kbd>' + (i + 1) + '</kbd>' + lab(l) + '</button>').join('') + '</div>' +
        '<div class="rule" id="mgBubble">' + (firstTime('ml2') ? '👆 Primera vez: compará número, comprador y ciudad con el pedido, y arrastrá esa etiqueta hasta la caja.' : 'Arrastrá a la caja la etiqueta que coincide con el pedido.') + '</div>';
      const bs = [...root().querySelectorAll('.tagl')], C = document.getElementById('pkC');
      if (firstTime('ml2')) hand(root().querySelector('.pk-labs'), C);
      function tryLab(b) {
        if (!live() || b.classList.contains('bad')) return;
        if (b.dataset.ok === '1') { me.hold = true; learned('ml2'); b.classList.add('good', 'gone'); C.classList.add('done'); GS.Audio.play('stamp'); GS.Audio.play('ok'); return void setTimeout(() => { if (cur === me) { me.hold = false; finish(true, '¡Despachado!', 'Sale hoy, antes de las 14.', {}); } }, 600); }
        b.classList.add('bad'); mistake('ml', U.pick(LN.wrongLabel), 'Compra web: le pegaste la etiqueta de otro pedido. El paquete salió para cualquier lado.');
      }
      bs.forEach((b, i) => { grab(b, () => '<span class="opt tagl">' + lab(labels[i]) + '</span>', t => { if (t && t.closest && t.closest('.pk-closed')) tryLab(b); else say('Soltala arriba de la caja.', false); }, 'lab');
        b.addEventListener('click', () => { if (!dragged(b)) tryLab(b); }); });
      cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 3) tryLab(bs[n - 1]); };
    }
    stepBox();
  }

  /* ---------------- 6. WHATSAPP: elegir la respuesta correcta ---------------- */
  function whatsapp(job) {
    const c = U.pick(GS.CHATS), options = U.shuffle([c.ok].concat(c.bad)), me = cur, hh = 10 + Math.floor(Math.random() * 9), mm = ('0' + Math.floor(Math.random() * 60)).slice(-2);
    root().innerHTML = head(job, 'WhatsApp') + '<div class="chat wa"><div class="wa-top"><i>👤</i><b>+54 9 11 ' + Math.floor(U.rnd(2000, 6999)) + '-' + Math.floor(U.rnd(1000, 9999)) + '</b><small>en línea</small></div>' +
      '<div class="wa-body" id="waB"><div class="msg in"><span>' + esc(c.m) + '</span><em>' + hh + ':' + mm + '</em></div></div></div><div class="info" id="mgBubble"><b>¿Qué le contestás?</b></div>' +
      '<div class="opts one txt">' + options.map((o, i) => '<button class="opt" data-ok="' + (o === c.ok ? 1 : 0) + '"><kbd>' + (i + 1) + '</kbd><span class="n">' + esc(o) + '</span></button>').join('') + '</div>';
    listOptions(b => b.dataset.ok === '1', () => {
      if (me.hold) return; me.hold = true; GS.Audio.play('send');
      const out = document.createElement('div'); out.className = 'msg out'; out.innerHTML = esc(c.ok) + '<em>' + hh + ':' + mm + ' <u>✓✓</u></em>'; document.getElementById('waB').appendChild(out);
      setTimeout(() => { if (cur === me) finish(true, '¡Respondido!', 'Un cliente menos escribiendo "???".', {}); }, 750);
    }, () => { if (!me.hold) mistake('whatsapp', U.pick(LN.wrongChat), 'WhatsApp: esa respuesta no era. El cliente quedó más confundido que antes.'); });
  }

  /* ---------------- 7. ORDENAR DEPÓSITO: en las estanterías hay tres productos mal ubicados; hay que llevar cada uno a la suya ----------------
     Los intrusos salen de CLEAR (productos que nadie discute de qué sector son) y NOGO evita los cruces dudosos. */
  function repo(job) {
    const SH = GS.SHELVES, me = cur, first = !(GS.Store.get('seen') || {}).g_repo;
    const CLEAR = { consolas: ['ps5', 'switch2', 'xbox', 'juego', 'juego2', 'dualsense'], apple: ['ipad', 'watch', 'airpods', 'homepod'], pc: ['notebook', 'gabinete', 'gpu', 'ram', 'impresora'], perifericos: ['auris', 'teclado', 'mic', 'webcam'] };
    const NOGO = { auris: ['apple'], airpods: ['perifericos'], notebook: ['apple'], ipad: ['pc'], teclado: ['pc'], webcam: ['pc'], mic: ['pc'], gpu: ['perifericos'], ram: ['perifericos'] };
    const byCat = c => GS.CATALOG.filter(p => p.cat === c).map(p => p.id), cols = { consolas: '#2d6cdf', apple: '#8d93a0', pc: '#e8782a', perifericos: '#8a4fd1' };
    const targets = U.shuffle(SH.map((s, k) => k)).slice(0, 3), used = {}, st = SH.map((s, k) => ({ k, cat: s.cat, items: U.shuffle(byCat(s.cat)).slice(0, 4).map(id => ({ id, cat: s.cat })) }));
    targets.forEach(k => { const opts = []; SH.forEach(o => { if (o.cat !== SH[k].cat) CLEAR[o.cat].forEach(id => { if (!used[id] && (NOGO[id] || []).indexOf(SH[k].cat) < 0) opts.push({ id, cat: o.cat }); }); });
      const it = U.pick(opts); used[it.id] = 1; SH.forEach((o, j) => { if (o.cat === it.cat) st[j].items = st[j].items.filter(x => x.id !== it.id); }); it.bad = 1; st[k].items.splice(Math.floor(U.rnd(0, st[k].items.length + 1)), 0, it); });
    let left = 3, sel = null, drag = null, noClick = 0, hint = first;
    const itemHtml = it => '<button class="dp-it' + (it.fixed ? ' ok' : '') + '" data-id="' + it.id + '"' + (it.fixed ? ' disabled' : '') + '>' + (GS.ICONS[it.id] || '') + '</button>';
    function draw() {
      root().innerHTML = head(job, 'Ordenar depósito') + '<div class="dp-top"><b id="dpN">Mal ubicados: ' + (3 - left) + ' de 3</b><span>Arrastrá cada intruso a su estantería</span></div>' +
        '<div class="dp-grid" id="dpGrid">' + st.map(s => '<div class="dp-sh" data-k="' + s.k + '" style="--c:' + cols[s.cat] + '"><h5><i>' + SH[s.k].icon + '</i>' + esc(SH[s.k].name) + '</h5><div class="dp-row">' + s.items.map(itemHtml).join('') + '</div></div>').join('') + '</div>' +
        '<div class="rule" id="mgBubble">' + (hint ? '👆 Mirá bien: hay un producto que no es de esa estantería. Arrastralo a la suya.' : 'Buscá los productos que no van y llevalos a su estantería.') + '</div>';
      const g = document.getElementById('dpGrid'); if (hint) { const b = g.querySelector('.dp-it[data-id="' + st[targets[0]].items.filter(x => x.bad)[0].id + '"]'); if (b) b.classList.add('guided'); }
      g.querySelectorAll('.dp-it:not(.ok)').forEach(b => { b.addEventListener('pointerdown', e => { if (live()) { drag = { b, x: e.clientX, y: e.clientY, g: null }; try { b.setPointerCapture(e.pointerId); } catch (er) {} } }); b.addEventListener('pointermove', move); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', () => stop());
        b.addEventListener('click', () => { if (Date.now() - noClick < 350 || !live()) return; sel = b; g.querySelectorAll('.dp-it').forEach(x => x.classList.toggle('sel', x === b)); GS.Audio.play('click'); say('Ahora tocá la estantería donde va.', false); }); });
      g.querySelectorAll('.dp-sh').forEach(sh => sh.addEventListener('click', e => { if (e.target.closest('.dp-it') || !sel || !live()) return; drop(sel.dataset.id, Number(sh.dataset.k)); }));
    }
    const live = () => cur === me && !cur.done, find = id => { for (const s of st) for (const it of s.items) if (it.id === id) return { s, it }; };
    const shAt = (x, y) => { const el = document.elementFromPoint(x, y), sh = el && el.closest('.dp-sh'); return sh ? Number(sh.dataset.k) : -1; };
    function stop() { if (drag && drag.g) drag.g.remove(); document.querySelectorAll('.dp-sh.over').forEach(x => x.classList.remove('over')); drag = null; }
    function move(e) { if (!drag) return; if (!drag.g) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return; const g = document.createElement('div'); g.className = 'pghost'; g.innerHTML = GS.ICONS[drag.b.dataset.id] || ''; document.body.appendChild(g); drag.g = g; drag.b.classList.add('lift'); GS.Audio.play('pick'); }
      const lift = e.pointerType === 'mouse' ? 0 : 34; drag.g.style.left = e.clientX + 'px'; drag.g.style.top = (e.clientY - lift) + 'px'; drag.g.style.visibility = 'hidden'; const k = shAt(e.clientX, e.clientY - lift); drag.g.style.visibility = ''; document.querySelectorAll('.dp-sh').forEach(x => x.classList.toggle('over', Number(x.dataset.k) === k)); }
    function up(e) { if (!drag) return; const d = drag, moved = !!d.g, lift = e.pointerType === 'mouse' ? 0 : 34; if (moved) d.g.style.visibility = 'hidden'; const k = moved ? shAt(e.clientX, e.clientY - lift) : -1; d.b.classList.remove('lift'); stop(); if (!moved) return; noClick = Date.now(); if (k >= 0) drop(d.b.dataset.id, k); }
    function drop(id, k) {
      const f = find(id); if (!f || !live()) return; sel = null;
      if (f.s.k === k) { if (f.it.bad) say('Ya está en esa estantería, y ahí no va. Llevalo a otra.', true); else say('Ese ya está en su lugar.', false); GS.Audio.play('error'); return; }
      if (!f.it.bad) return mistake('repo', 'Ese estaba bien donde estaba. Buscá el que no va.', 'Depósito: moviste un producto que estaba bien guardado.');
      if (SH[k].cat !== f.it.cat) return mistake('repo', U.pick(LN.wrongShelf), 'Depósito: guardaste un producto en la estantería equivocada.');
      f.s.items = f.s.items.filter(x => x !== f.it); f.it.bad = 0; f.it.fixed = 1; st[k].items.push(f.it); left--; GS.Audio.play('drop');
      if (hint) { hint = false; const sn = GS.Store.get('seen') || {}; sn.g_repo = 1; GS.Store.set('seen', sn); }
      if (!left) { draw(); cur.locked = 1; GS.Audio.play('ok'); return void setTimeout(() => { if (cur === me) finish(true, '¡Depósito ordenado!', 'Por cinco minutos, al menos.', {}); }, 650); }
      draw(); say(left === 1 ? '¡Bien! Queda uno mal ubicado.' : '¡Bien! Quedan ' + left + ' mal ubicados.', false);
    }
    me.cleanup = stop; me.keys = () => {}; draw();
  }

  /* ---------------- 8. CONTROL DE STOCK: contar lo que hay de verdad ---------------- */
  function stock(job) {
    const p = U.pick(GS.CATALOG), real = Math.floor(U.rnd(4, 12)), sys = Math.max(1, real + U.pick([-2, -1, 0, 1, 2])), me = cur, icon = GS.ICONS[p.id] || p.icon; let n = sys;
    root().innerHTML = head(job, 'Control de stock') + '<div class="bubble">' + esc(p.name) + ': el sistema dice que hay <b>' + sys + '</b>.</div>' +
      '<div class="shelfv sk">' + Array.from({ length: real }, (_, i) => '<span class="pic' + (i > 0 && Math.random() < 0.4 ? ' bk' : '') + '" style="--r:' + Math.floor(U.rnd(-12, 12)) + 'deg;--y:' + Math.floor(U.rnd(-3, 4)) + 'px">' + icon + '</span>').join('') + '</div>' +
      '<div class="sk-ctl"><button class="sk-b" id="skM">−</button><div class="sk-n"><b id="skN">' + n + '</b><small>en la góndola</small></div><button class="sk-b" id="skP">+</button></div>' +
      '<button class="btn okb" id="skOk">✔ Confirmar</button><div class="rule" id="mgBubble">' + (firstTime('stock') ? '👆 Primera vez: contá los productos de la góndola (algunos quedan atrás), llevá el número con + y − y tocá Confirmar.' : 'Contá los que hay de verdad (ojo con los de atrás) y corregí el número.') + '</div>';
    if (firstTime('stock')) root().querySelector('.sk-ctl').classList.add('guided');
    const out = document.getElementById('skN'), live = () => cur === me && !me.done;
    const step = k => { if (!live()) return; learned('stock'); n = U.clamp(n + k, 0, 20); out.textContent = n; GS.Audio.play('click'); };
    function ok() {
      if (!live()) return;
      if (n === real) { learned('stock'); GS.Audio.play('ok'); finish(true, '¡Stock corregido!', sys === real ? 'El sistema tenía razón. Anotá la fecha.' : 'Eran ' + real + ', no ' + sys + '.', {}); }
      else mistake('stock', n < real ? U.pick(['Hay más. ¿Contaste los de atrás?', 'Te quedaste corto. Contá de nuevo, sin apuro.']) : U.pick(['Hay menos. Alguno lo contaste dos veces.', 'Ese número le gustaría al sistema, pero no.']), 'Stock mal contado: anotaste ' + n + ' y había ' + real + '.');
    }
    document.getElementById('skM').addEventListener('click', () => step(-1)); document.getElementById('skP').addEventListener('click', () => step(1)); document.getElementById('skOk').addEventListener('click', ok);
    cur.keys = e => { if (e.key === 'ArrowLeft' || e.key === '-' || e.key === 'ArrowDown') step(-1); else if (e.key === 'ArrowRight' || e.key === '+' || e.key === 'ArrowUp') step(1); else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ok(); } };
  }

  /* ---------------- 9. RECEPCIÓN DE PROVEEDOR: comparar el remito con lo que llegó ---------------- */
  function proveedor(job) {
    const items = U.shuffle(GS.CATALOG).slice(0, 4).map(p => ({ p, q: Math.floor(U.rnd(2, 10)) }));
    const bad = Math.random() < 0.65 ? Math.floor(Math.random() * 4) : -1, got = items.map((it, i) => i === bad ? Math.max(1, it.q + U.pick([-2, -1, 1])) : it.q);
    root().innerHTML = head(job, 'Recepción de proveedor') +
      '<div class="remito"><b>🧾 El remito dice</b>' + items.map(it => '<span>' + ico(it.p) + '<em>' + esc(it.p.name) + '</em><i>× ' + it.q + '</i></span>').join('') + '</div>' +
      '<div class="pv"><h4>📦 Lo que bajó de la carreta</h4>' + items.map((it, i) => '<button class="pvrow" data-i="' + i + '" data-n="' + got[i] + '"><kbd>' + (i + 1) + '</kbd><span class="pic sm">' + (GS.ICONS[it.p.id] || it.p.icon) + '</span><span class="pvb">' + '<i></i>'.repeat(got[i]) + '</span></button>').join('') + '</div>' +
      '<div class="rule" id="mgBubble">' + (firstTime('prov') ? '👆 Primera vez: contá las cajitas de cada pila y comparalas con el remito. Si una no coincide, tocala. Si está todo bien, firmá.' : 'Contá las cajas de cada pila. ¿Alguna no coincide con el remito? Tocala. Si está todo, firmá.') + '</div><button class="btn okb" id="mgYes">✔ Coincide todo: firmar</button>';
    const rb = [...root().querySelectorAll('.pvrow')]; if (firstTime('prov')) { root().querySelector('.remito').classList.add('guided'); setTimeout(() => learned('prov'), 4000); }
    function tapRow(b) {
      if (!cur || cur.done || b.classList.contains('fine')) return;
      if (Number(b.dataset.i) === bad) { b.classList.add('flag'); GS.Audio.play('ok'); finish(true, '¡Bien contado!', (got[bad] < items[bad].q ? 'Faltaba' : 'Sobraba') + ' mercadería. El de la carreta "justo se acordó".', {}); }
      else { b.classList.add('fine'); mistake('proveedor', U.pick(LN.lineFine), 'Remito: marcaste una línea que estaba bien. La que no coincidía era otra.'); }
    }
    function sign() {
      if (!cur || cur.done) return;
      if (bad < 0) { GS.Audio.play('stamp'); GS.Audio.play('ok'); finish(true, '¡Firmado!', 'Llegó todo. Qué raro. Qué lindo.', {}); }
      else if (late()) mistake('proveedor', '', 'Firmaste el remito y no coincidía con lo que llegó.');
      else { rb[bad].classList.add('flag'); GS.Audio.play('error'); cur.cb.onMistake('proveedor'); finish(false, 'Firmaste de más', 'Mirá la pila marcada: no coincidía con el remito.', {}); }
    }
    rb.forEach(b => b.addEventListener('click', () => tapRow(b))); document.getElementById('mgYes').addEventListener('click', sign);
    cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 4) tapRow(rb[n - 1]); else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sign(); } };
  }

  /* ---------------- 10. DEVOLUCIONES: aceptar o rechazar según las reglas (inventadas para el juego) ---------------- */
  function devol(job) {
    const p = U.pick(GS.CATALOG), c = { ticket: true, dias: Math.floor(U.rnd(1, 10)), estado: U.pick(['Cerrado, sin abrir', 'Abierto, sin uso']) }, me = cur;
    let why = '';
    if (Math.random() < 0.55) {
      const k = U.pick(['ticket', 'dias', 'estado']);
      if (k === 'ticket') { c.ticket = false; why = 'No tiene ticket.'; }
      if (k === 'dias') { c.dias = U.pick([14, 25, 60, 365]); why = 'Pasaron más de 10 días.'; }
      if (k === 'estado') { c.estado = 'Usado y con marcas'; why = 'Está usado.'; }
    }
    const ok = !why, used = c.estado.charAt(0) === 'U', icon = GS.ICONS[p.id] || '<span class="i">' + p.icon + '</span>';
    root().innerHTML = head(job, 'Devoluciones') + '<div class="bubble">Quiero devolver esto: ' + esc(p.name) + '. ' + esc(U.pick(LN.returnExcuses)) + '</div>' +
      '<div class="expect"><b>Se acepta si (reglas del juego)</b><span>Tiene <i>ticket</i></span><span>Hasta <i>10 días</i></span><span>Está <i>sin uso</i></span></div>' +
      '<div class="dv"><button class="dvc' + (used ? ' used' : '') + '" data-k="estado"><span class="dv-f"><span class="pk-ic">' + icon + '</span><small>👆 Tocá para revisarlo</small></span><span class="dv-b"><span class="pk-ic">' + icon + '<svg class="dv-sc" viewBox="0 0 60 60"><path d="M8 14l16 10M30 8l-6 18M40 40l14 8M12 44l10-6M44 14l8 12" stroke="#e10600" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg></span><b>' + c.estado + '</b></span></button>' +
      '<button class="dvc tk" data-k="ticket"><span class="dv-f"><span class="dv-tk">🧾</span><small>👆 Tocá para ver el ticket</small></span><span class="dv-b">' + (c.ticket ? '<span class="dv-paper"><u>TICKET</u><i>' + esc(p.name) + '</i><b>Hace ' + c.dias + (c.dias === 1 ? ' día' : ' días') + '</b></span>' : '<span class="dv-tk">🤷</span><b>No lo tiene</b><small>"Lo debo haber tirado"</small>') + '</span></button></div>' +
      '<div class="row"><button class="btn ghost" id="mgNo" data-ok="' + (ok ? 0 : 1) + '" style="font-size:18px">✖ Rechazar</button><button class="btn okb" id="mgYes" data-ok="' + (ok ? 1 : 0) + '">✔ Aceptar</button></div><div class="rule" id="mgBubble">' + (firstTime('devol') ? '👆 Primera vez: tocá el producto y el ticket para revisarlos. Si cumple las tres reglas, aceptá; si no, rechazá.' : 'Revisá el producto y el ticket antes de decidir.') + '</div>';
    const cards = [...root().querySelectorAll('.dvc')];
    cards.forEach(b => b.addEventListener('click', () => { if (cur !== me || me.done || b.classList.contains('seen')) return; learned('devol'); b.classList.add('seen'); GS.Audio.play('flip'); if (cards.every(x => x.classList.contains('seen'))) say('Ya viste todo. ¿Se acepta o no?', false); }));
    function decide(accept) {
      if (!cur || cur.done) return;
      if (!cards.every(x => x.classList.contains('seen'))) { GS.Audio.play('error'); cards.forEach(x => { if (!x.classList.contains('seen')) { x.classList.remove('nudge'); void x.offsetWidth; x.classList.add('nudge'); } }); return say('Primero revisá el producto y el ticket.', true); }
      if (accept === ok) { GS.Audio.play('ok'); finish(true, ok ? '¡Devolución aceptada!' : '¡Bien rechazada!', ok ? 'Cumplía todo. Cliente contento.' : why + ' Se lo explicaste con una sonrisa.', {}); }
      else if (late()) mistake('devol', '', ok ? 'Rechazaste una devolución que cumplía las tres reglas.' : 'Aceptaste una devolución que no correspondía. ' + why);
      else { GS.Audio.play('error'); cur.cb.onMistake('devol'); finish(false, ok ? 'Se podía aceptar' : 'No correspondía', ok ? 'Cumplía las tres reglas.' : why, {}); }
    }
    document.getElementById('mgYes').addEventListener('click', () => decide(true)); document.getElementById('mgNo').addEventListener('click', () => decide(false));
    cur.keys = e => { if (e.key === 'ArrowRight' || e.key === '2') decide(true); else if (e.key === 'ArrowLeft' || e.key === '1') decide(false); else if (e.key === ' ') { e.preventDefault(); const x = cards.find(y => !y.classList.contains('seen')); if (x) x.click(); } };
  }

  /* ---------------- 11. CIERRE DE CAJA: sumar lo cobrado y ver si la caja cierra ---------------- */
  function cierre(job) {
    const bills = U.shuffle([20000, 20000, 10000, 10000, 10000, 2000, 2000, 1000, 1000, 20000, 10000]).slice(0, Math.floor(U.rnd(6, 9))), sum = bills.reduce((a, b) => a + b, 0), d = U.pick([0, 0, -10000, 10000, -20000, 20000]);
    const x = Math.abs(d) || 10000, right = d === 0 ? 'ok' : d < 0 ? 'falta' : 'sobra', sys = sum - d, me = cur; let cnt = 0, left = bills.length;   /* d = lo que hay en el cajón menos lo que dice el sistema */
    root().innerHTML = head(job, 'Cierre de caja') + '<div class="tray"><span>El sistema dice que hoy se cobró</span><b>' + U.money(sys) + '</b></div>' +
      '<div class="cj"><h4>💵 El cajón · tocá cada billete para contarlo</h4><div class="cj-b">' + bills.map(v => '<button class="cb vbx v' + v + '" data-v="' + v + '" style="--r:' + Math.floor(U.rnd(-5, 6)) + 'deg" aria-label="' + U.money(v) + '">' + GS.Vueltos.billSvg(v) + '</button>').join('') + '</div></div>' +
      '<div class="tray cnt"><span>Llevás contado</span><b id="cjT">' + U.money(0) + '</b></div>' +
      '<div class="opts three low cj-o off">' + [['falta', 'Faltan ' + U.money(x)], ['ok', 'Cierra perfecto'], ['sobra', 'Sobran ' + U.money(x)]].map((o, i) => '<button class="opt" data-ok="' + (o[0] === right ? 1 : 0) + '"><kbd>' + (i + 1) + '</kbd><span class="n">' + o[1] + '</span></button>').join('') + '</div>' +
      '<div class="rule" id="mgBubble">' + (firstTime('cierre') ? '👆 Primera vez: tocá los billetes de a uno para contarlos. Después compará el total con lo que dice el sistema.' : 'Contá la plata del cajón y fijate si coincide con el sistema.') + '</div>';
    const tot = document.getElementById('cjT'), ob = root().querySelector('.cj-o'), bs = [...root().querySelectorAll('.cb')]; if (firstTime('cierre')) bs[0].classList.add('guided');
    function count(b) { if (cur !== me || me.done || b.classList.contains('cnt')) return; b.classList.add('cnt'); cnt += Number(b.dataset.v); left--; tot.textContent = U.money(cnt); GS.Audio.play('count'); learned('cierre'); if (!left) { ob.classList.remove('off'); say('En el cajón hay ' + U.money(cnt) + '. ¿Cierra con el sistema?', false); } }
    bs.forEach(b => b.addEventListener('click', () => count(b)));
    const os = [...ob.querySelectorAll('.opt')];
    function choose(b) {
      if (cur !== me || me.done || b.classList.contains('bad')) return;
      if (left) { GS.Audio.play('error'); return say('Primero contá todos los billetes del cajón.', true); }
      if (b.dataset.ok === '1') { b.classList.add('good'); GS.Audio.play('cash'); finish(true, '¡Caja cerrada!', d === 0 ? 'Cerró perfecto. Sacale una foto.' : 'Diferencia detectada. Mañana se revisa con un mate.', {}); }
      else { b.classList.add('bad'); mistake('cierre', U.pick(LN.wrongCount), 'Cierre de caja: la cuenta no daba. Mañana hay que recontar todo.'); }
    }
    os.forEach(b => b.addEventListener('click', () => choose(b)));
    cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 3) choose(os[n - 1]); else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); const b = bs.find(y => !y.classList.contains('cnt')); if (b) count(b); } };
  }

  /* ---------------- 12. VIDRIERA: elegir los 4 productos que van con el tema ---------------- */
  function vidriera(job) {
    const th = U.pick(GS.THEMES), good = U.shuffle(GS.CATALOG.filter(p => th.ids.indexOf(p.id) >= 0)).slice(0, 4), bad = U.shuffle(GS.CATALOG.filter(p => th.ids.indexOf(p.id) < 0)).slice(0, 4), all = U.shuffle(good.concat(bad));
    root().innerHTML = head(job, 'Vidriera') + '<div class="bubble" id="mgBubble">Esta semana la vidriera es <b>' + esc(th.t) + '</b>: ' + esc(th.hint) + '.</div>' +
      '<div class="info"><b>Hay 8 productos: 4 van con el tema y 4 no. Elegí los 4 que van.</b></div>' +
      '<div class="opts four">' + all.map((p, i) => '<button class="opt" data-i="' + i + '"><kbd>' + (i + 1) + '</kbd>' + pic(p) + '<span class="n">' + esc(p.name) + '</span></button>').join('') + '</div>' +
      '<div class="rule">Elegidos: <span id="mgN">0</span> de 4 · tocá de nuevo para sacar uno · al elegir el cuarto se arma la vidriera</div>';
    const btns = [...root().querySelectorAll('.opt')], me = cur;
    function toggle(b) {
      if (!cur || cur.done) return;
      const on = btns.filter(x => x.classList.contains('sel'));
      if (!b.classList.contains('sel') && on.length >= 4) return;
      b.classList.toggle('sel'); GS.Audio.play('bill');
      const sel = btns.filter(x => x.classList.contains('sel')); document.getElementById('mgN').textContent = sel.length;
      if (sel.length === 4) {
        const n = sel.filter(x => good.indexOf(all[x.dataset.i]) >= 0).length;
        btns.forEach(x => { const g = good.indexOf(all[x.dataset.i]) >= 0; x.classList.add(g ? 'good' : 'dim'); if (!g && x.classList.contains('sel')) x.classList.add('bad'); });
        setTimeout(() => { if (cur !== me) return; GS.Audio.play(n >= 3 ? 'ok' : 'click'); finish(true, n === 4 ? '¡Vidriera perfecta!' : n >= 2 ? 'Vidriera aceptable' : 'Vidriera... original', n + ' de 4 iban con "' + th.t + '" (' + th.hint + ').', { quality: n / 4 }); }, 1300);
      }
    }
    btns.forEach(b => b.addEventListener('click', () => toggle(b)));
    cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= btns.length) toggle(btns[n - 1]); };
  }

  // Ayuda común: lista de opciones con una correcta; las equivocadas se apagan
  /* ---------------- ayudas compartidas: arrastrar con el dedo, piezas de PC y cajas dibujadas ---------------- */
  const pc100 = (v, t) => (v / t * 100).toFixed(2) + '%';
  function grab(el, ghost, onDrop, cls) {          /* levanta una copia que sigue al dedo; al soltar avisa sobre qué elemento quedó */
    const me = cur; let d = null;
    const end = () => { if (d && d.g) d.g.remove(); el.classList.remove('lift'); d = null; };
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => { if (cur !== me || me.done || me.hold) return; d = { x: e.clientX, y: e.clientY, g: null }; try { el.setPointerCapture(e.pointerId); } catch (er) {} });
    el.addEventListener('pointermove', e => { if (!d) return;
      if (!d.g) { if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return; const g = document.createElement('div'); g.className = 'pghost ' + (cls || ''); g.innerHTML = typeof ghost === 'function' ? ghost() : ghost; document.body.appendChild(g); d.g = g; el.classList.add('lift'); GS.Audio.play('pick'); }
      const lift = e.pointerType === 'mouse' ? 0 : 34; d.g.style.left = e.clientX + 'px'; d.g.style.top = (e.clientY - lift) + 'px'; });
    el.addEventListener('pointerup', e => { if (!d) return; const moved = !!d.g, lift = e.pointerType === 'mouse' ? 0 : 34; let t = null; if (moved) { d.g.style.visibility = 'hidden'; t = document.elementFromPoint(e.clientX, e.clientY - lift); } end(); if (moved) { el.dataset.nc = Date.now(); onDrop(t); } });
    el.addEventListener('pointercancel', end);
    (me.grabs = me.grabs || []).push(end); me.cleanup = () => me.grabs.forEach(f => f());
  }
  /* guía de la primera vez: se muestra hasta que el jugador hace bien el gesto, y no vuelve */
  const firstTime = k => !(GS.Store.get('seen') || {})['g_' + k];
  function learned(k) {
    if (!firstTime(k)) return; const sn = GS.Store.get('seen') || {}; sn['g_' + k] = 1; GS.Store.set('seen', sn);
    root().querySelectorAll('.guided').forEach(e => e.classList.remove('guided')); root().querySelectorAll('.ghand').forEach(e => e.remove());
  }
  function hand(from, to) {            /* una manito que va y viene mostrando el gesto de arrastrar */
    if (!from || !to) return; const r = root(), R = r.getBoundingClientRect(), a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), h = document.createElement('i');
    h.className = 'ghand'; h.textContent = '👆'; h.style.left = (a.left + a.width / 2 - R.left) + 'px'; h.style.top = (a.top + a.height / 2 - R.top + r.scrollTop) + 'px';
    h.style.setProperty('--dx', (b.left + b.width / 2 - a.left - a.width / 2) + 'px'); h.style.setProperty('--dy', (b.top + b.height / 2 - a.top - a.height / 2) + 'px'); r.appendChild(h);
  }
  const dragged = el => Date.now() - Number(el.dataset.nc || 0) < 350;
  function partHtml(id, cls) {
    const q = PCS[id], W = q[2], H = q[3], svg = GS.PC_PARTS.find(p => p.id === id).svg, put = (x, y, w, h) => svg.replace('<svg ', '<svg x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" ');
    return '<div class="pp ' + (cls || '') + '" style="left:' + pc100(q[0] + W / 2, 320) + ';top:' + pc100(q[1] + H / 2, 200) + ';width:' + pc100(W, 320) + ';height:' + pc100(H, 200) + '"><svg viewBox="0 0 ' + W + ' ' + H + '">' + (q[4] ? '<g transform="translate(' + W / 2 + ' ' + H / 2 + ') rotate(90)">' + put(-H / 2, -W / 2, H, W) + '</g>' : put(0, 0, W, H)) + '</svg></div>';
  }
  function boxSvg(open) {
    return '<svg class="bx" viewBox="0 0 100 84">' + (open ? '<path d="M8 30L50 18L92 30L50 42Z" fill="#7d5d39"/><path d="M8 30L1 12L43 2L50 18Z" fill="#d8b385"/><path d="M92 30L99 12L57 2L50 18Z" fill="#c9a274"/>' : '') +
      '<path d="M8 30V68L50 82V42Z" fill="#c49a6c"/><path d="M92 30V68L50 82V42Z" fill="#a9804f"/>' + (open ? '<path d="M8 30L0 44L42 58L50 42Z" fill="#d8b385" opacity=".0"/>' : '<path d="M8 30L50 18L92 30L50 42Z" fill="#d8b385"/><path d="M26 23.500L68 35.500L74 33.800L32 21.800Z" fill="#f1e2a0" opacity=".9"/><path d="M68 35.500V52L74 50V33.800Z" fill="#e3d28c" opacity=".9"/>') +
      '<path d="M8 30L50 42L92 30" fill="none" stroke="#6e5132" stroke-width="1.200"/><path d="M50 42V82" stroke="#6e5132" stroke-width="1.200"/></svg>';
  }
  const DIAG_PC = [
    { id: 'cpu', s: 'Se apaga sola cuando juego. Justo cuando voy ganando, eh.', t: '¡Era el procesador!', r: 'Levantaba temperatura: limpieza y pasta térmica nueva.' },
    { id: 'fan', s: 'Hace ruido de turbina de avión. Los vecinos preguntan a qué hora despega.', t: '¡Era el cooler!', r: 'Tapado de pelusa. Salió para tejer un pulóver.' },
    { id: 'gpu', s: 'Prende, pero el monitor queda en negro. Y no, no es el brillo.', t: '¡Era la placa de video!', r: 'Estaba mal calzada. Un clic y volvió la imagen.' },
    { id: 'ram', s: 'Anda lentísima: abro dos pestañas y se queda pensando en la vida.', t: '¡Era la memoria!', r: 'Con tan poca RAM no alcanza: se la ampliamos.' },
    { id: 'psu', s: 'No prende. Ni una lucecita. "No hice nada, se rompió sola."', t: '¡Era la fuente!', r: 'Tenía un cable desenchufado. Clásico.' },
    { id: 'ssd', s: 'Dice que no tiene espacio. Tengo 9.000 fotos del mismo asado.', t: '¡Era el disco!', r: 'Lleno hasta el tope: liberamos espacio y le sumamos otro.' }
  ];
  function listOptions(isOk, onOk, onBad) {
    const btns = [...root().querySelectorAll('.opt')];
    function choose(b) {
      if (!cur || cur.done || b.classList.contains('bad')) return;
      if (isOk(b)) { b.classList.add('good'); onOk(); } else { b.classList.add('bad'); onBad(); }
    }
    btns.forEach(b => b.addEventListener('click', () => choose(b)));
    cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= btns.length) choose(btns[n - 1]); };
  }

  function adornos(job) {
    const steps = [['a', '¿Qué árbol ponemos al lado de la entrada?', [['🌲', 'Clásico verde'], ['❄️', 'Blanco nevado'], ['🎮', 'Gamer rojo y negro']]],
      ['g', '¿De qué color van las guirnaldas del mostrador?', [['🔴', 'Rojas'], ['🟡', 'Doradas'], ['🟢', 'Verdes']]],
      ['l', '¿Y las lucecitas?', [['🕯️', 'Cálidas'], ['🌈', 'De colores'], ['💎', 'Blancas']]]], cfg = {}, me = cur; let i = 0;
    function draw() {
      const st = steps[i];
      root().innerHTML = head(job, 'Adornos de Navidad') + '<div class="bubble" id="mgBubble">Paso ' + (i + 1) + ' de 3. Mirá el local: lo que elijas aparece en el momento.</div>' +
        '<div class="ask"><span>Mañana empieza la semana de Navidad</span><b>' + st[1] + '</b></div>' +
        '<div class="opts three low">' + st[2].map((o, k) => '<button class="opt" data-k="' + k + '"><kbd>' + (k + 1) + '</kbd><span class="n big">' + o[0] + '</span><span class="n">' + o[1] + '</span></button>').join('') + '</div>';
      const btns = [...root().querySelectorAll('.opt')];
      const pickIt = b => { if (cur !== me || me.done) return; cfg[st[0]] = Number(b.dataset.k); GS.Audio.play('ok'); GS.World.setXmas(cfg); i++; if (i < steps.length) draw(); else { GS.Store.set('xmas', cfg); finish(true, '¡Quedó hermoso!', 'Mañana el local amanece decorado. Y con gorritos.', {}); } };
      btns.forEach(b => b.addEventListener('click', () => pickIt(b)));
      cur.keys = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 3) pickIt(btns[n - 1]); };
    }
    draw();
  }
  const GAMES = { mostrador, caja, pc, service, ml, whatsapp, repo, stock, proveedor, devol, cierre, vidriera, adornos };
  return {
    // type: 'mostrador' | 'caja'; opts.variant para caja: 'cobro' | 'vuelto' | 'comprobante'
    open(type, cust, cb, opts) {
      close(); cur = { type, cust, cb, keys: null, done: false, timer: null };
      root().hidden = false;
      GAMES[type](cust, opts && opts.variant);
      const r = root(); r.scrollTop = 0; r.style.touchAction = r.scrollHeight > r.clientHeight + 6 ? 'pan-y' : '';     // si no entra en la pantalla del celular, se puede deslizar
    },
    close,
    // Tarjeta de inducción: el Dueño explica una estación la primera vez
    intro(station, text, onOk) {
      close(); cur = { type: 'intro', cb: {}, keys: null, done: true, timer: null };
      root().hidden = false;
      root().innerHTML = '<div class="mg-head"><div class="mg-face pic">' + GS.faceSvg(GS.BOSS_LOOK, 'talk') + '</div><div class="mg-who"><b>El Dueño te explica</b><span>' + esc(station.icon + ' ' + station.name) + '</span></div><div class="mg-station">Inducción</div></div>' +
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
