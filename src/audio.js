/* =====================================================================
   SONIDO — todo generado por código con Web Audio (sin archivos).
   Arranca con el primer toque del usuario. Incluye la música (un loop
   generativo tranquilo, distinto según el momento) y los balbuceos.
   ===================================================================== */
GS.Audio = (function () {
  let ctx = null, master = null, mGain = null, muted = !!GS.Store.get('mute'), mLevel = GS.Store.get('music') == null || GS.Store.get('music') === true ? 1 : Number(GS.Store.get('music')) || 0, musicOn = mLevel > 0;

  const MVOL = [0, 0.55, 1];           // sin música, suave (por defecto) y normal
  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC(); master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5; const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -12; lim.knee.value = 10; lim.ratio.value = 6; lim.attack.value = 0.004; lim.release.value = 0.2; master.connect(lim); lim.connect(ctx.destination);
      mGain = ctx.createGain(); mGain.gain.value = MVOL[mLevel]; mGain.connect(master);
      if (!mTimer) mTimer = setInterval(pump, 90);
    } catch (e) { ctx = null; }
  }

  // Un tono simple con envolvente
  function tone(freq, dur, type, vol, when, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
  }
  // Ruido corto (billetes, cinta, swipe)
  function noise(dur, vol, when, hp) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (when || 0);
    const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 1500;
    const g = ctx.createGain(); g.gain.value = vol || 0.2;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }

  /* ---------- Música: de fondo, suave y sin archivos. Acordes largos, bajo redondo y una melodía con silencios,
     todo pasado por un filtro que le saca el brillo para que acompañe sin cansar. Cada momento tiene su clima. ---------- */
  const N = n => 440 * Math.pow(2, (n - 69) / 12);      // nota MIDI a frecuencia
  // prog: acordes (bajo + tres notas). mel: melodía de dos compases en corcheas (grados de la escala; null = silencio)
  const SCALE = [60, 62, 64, 67, 69, 72, 74, 76];       // pentatónica mayor de do: no hay nota que suene mal
  /* mel = frase A, melB = frase B (dos compases cada una, en corcheas). La canción respira: A, B, un tramo sin melodía y A una octava arriba. */
  const MOODS = {
    menu:  { bpm: 66, prog: [[48, 64, 67, 71], [45, 64, 67, 72], [41, 64, 69, 72], [43, 62, 67, 71]], mel: [4, null, null, 2, null, null, 3, null, 2, null, null, 0, null, null, null, null], melB: [5, null, null, 4, null, 2, null, null, 3, null, null, null, 1, null, null, null], kick: 0, hat: 0 },
    day:   { bpm: 78, prog: [[48, 64, 67, 71], [45, 60, 64, 67], [41, 60, 65, 69], [43, 62, 65, 71]], mel: [2, null, 3, null, 4, null, null, 3, null, 2, null, 0, null, null, 1, null], melB: [4, null, null, 5, null, 4, 2, null, 3, null, null, 2, null, 0, null, null], kick: 0.08, hat: 0 },
    rain:  { bpm: 62, prog: [[45, 64, 67, 72], [41, 64, 69, 72], [48, 64, 67, 71], [43, 62, 67, 71]], mel: [4, null, null, null, 3, null, 2, null, null, null, 0, null, null, null, null, null], melB: [2, null, null, null, 4, null, null, 3, null, null, null, null, 1, null, null, null], kick: 0, hat: 0 },
    party: { bpm: 92, prog: [[48, 64, 67, 72], [43, 62, 67, 71], [45, 64, 69, 72], [41, 65, 69, 72]], mel: [0, null, 2, 3, null, 4, null, 3, 2, null, 3, null, 5, null, 4, null], melB: [4, null, 5, null, 4, 3, null, 2, 3, null, 2, null, 0, null, null, null], kick: 0.13, hat: 0.02 },
    final: { bpm: 96, prog: [[48, 64, 67, 72], [41, 65, 69, 72], [43, 62, 67, 71], [48, 64, 67, 76]], mel: [2, 3, 4, null, 5, null, 4, 3, 4, null, 5, 6, 7, null, null, null], melB: [7, null, 6, 5, null, 4, 5, null, 6, null, 4, null, 5, null, null, null], kick: 0.13, hat: 0.022 }
  };
  let mood = 'menu', mStep = 0, mNext = 0, mTimer = null, mLp = null, hatBuf = null;
  function bus() {             /* filtro que saca el brillo + un eco corto que le da aire, para que acompañe sin cansar */
    if (mLp) return mLp;
    mLp = ctx.createBiquadFilter(); mLp.type = 'lowpass'; mLp.frequency.value = 1700; mLp.Q.value = 0.3; mLp.connect(mGain);
    const dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(); dl.delayTime.value = 0.34; fb.gain.value = 0.3; wet.gain.value = 0.26;
    mLp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(mGain);
    return mLp;
  }
  function voice(freq, dur, type, vol, t, att, rel) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (att || 0.02)); g.gain.setTargetAtTime(0.0001, t + (att || 0.02), (rel || dur) / 4);
    o.connect(g); g.connect(bus()); o.start(t); o.stop(t + dur + 0.1);
  }
  function pluck(freq, vol, t) {      /* melodía tipo kalimba: golpe suave que se apaga solo */
    voice(freq, 1.1, 'sine', vol, t, 0.006, 0.9); voice(freq * 2, 0.5, 'sine', vol * 0.28, t, 0.004, 0.35); voice(freq * 3.01, 0.22, 'sine', vol * 0.1, t, 0.003, 0.14);
  }
  function hat(vol, t) {
    if (!hatBuf) { const len = Math.floor(ctx.sampleRate * 0.05); hatBuf = ctx.createBuffer(1, len, ctx.sampleRate); const d = hatBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    const sr = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); sr.buffer = hatBuf; f.type = 'highpass'; f.frequency.value = 6500; g.gain.value = vol; sr.connect(f); f.connect(g); g.connect(mGain); sr.start(t);
  }
  // Agenda las notas un rato antes de que suenen (así no se corta si el juego se traba un instante)
  function pump() {
    if (!ctx || muted || !musicOn || document.hidden || ctx.state !== 'running') { mNext = 0; return; }
    const m = MOODS[mood], sp = 60 / m.bpm / 2;                                   // paso = una corchea
    if (mNext < ctx.currentTime) mNext = ctx.currentTime + 0.08;
    while (mNext < ctx.currentTime + 0.35) {
      const st = mStep % 8, bar = Math.floor(mStep / 8), ch = m.prog[bar % m.prog.length], t = mNext + (st % 2 ? sp * 0.12 : 0), sec = Math.floor(bar / 8) % 4;   // un poquito de swing; sec = tramo de la canción
      if (st === 0) for (let i = 1; i < 4; i++) voice(N(ch[i]), sp * 9, 'sine', 0.045, t + i * 0.03, 0.5, sp * 6);              // colchón del acorde, entra de a poco
      if (st === 0 || st === 5) voice(N(ch[0] - 12), sp * 2.6, 'sine', st ? 0.1 : 0.15, t, 0.03);                              // bajo redondo
      if (m.kick && (st === 0 || st === 4)) voice(90, 0.16, 'sine', m.kick, t, 0.005, 0.12);                                   // pulso apenas marcado
      if (m.hat && st % 2 === 1 && sec !== 2) hat(m.hat, t);
      const deg = (sec === 1 ? m.melB : m.mel)[(bar % 2) * 8 + st];
      if (sec === 2) { if (st === 2 && bar % 2 === 0) pluck(N(ch[2] + 12), 0.03, t); }                                          // tramo de descanso: apenas una nota cada tanto
      else if (deg != null && (bar % 4 !== 3 || st < 4)) pluck(N(SCALE[deg] + (sec === 3 ? 12 : 0)), sec === 3 ? 0.05 : 0.065, t);
      mStep++; mNext += sp;
    }
  }

  // Balbuceo: sílabas cortitas en el tono de cada personaje (no dice nada, pero suena a que habla)
  function babble(text, pitch) {
    if (!ctx || muted) return;
    const n = Math.min(9, Math.max(3, Math.round(String(text).length / 9))), p = pitch || 320;
    for (let i = 0; i < n; i++) { const c = String(text).charCodeAt(i * 3 % text.length) || 65; tone(p * (1 + ((c % 7) - 3) * 0.055), 0.06, 'triangle', 0.09, i * 0.075, p * (1 + ((c % 5) - 2) * 0.05)); }
  }

  /* motor de un vehículo que arranca y se aleja: una onda áspera con "petardeo" (rate), que sube de vueltas y se apaga */
  function engine(base, dur, rate, cut, vol, when) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (when || 0), o = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), am = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.Q.value = 1.2;
    [o, o2].forEach((x, i) => { const k = i ? 0.502 : 1; x.frequency.setValueAtTime(base * 0.8 * k, t); x.frequency.linearRampToValueAtTime(base * 1.25 * k, t + dur * 0.22); x.frequency.setValueAtTime(base * 0.95 * k, t + dur * 0.24); x.frequency.linearRampToValueAtTime(base * 1.7 * k, t + dur); });   /* acelera, mete un cambio y sigue */
    lfo.type = 'square'; lfo.frequency.setValueAtTime(rate * 0.8, t); lfo.frequency.linearRampToValueAtTime(rate * 1.6, t + dur); lg.gain.value = 0.35; am.gain.value = 0.65; lfo.connect(lg); lg.connect(am.gain);
    f.frequency.setValueAtTime(cut * 0.7, t); f.frequency.linearRampToValueAtTime(cut * 1.4, t + dur * 0.3); f.frequency.linearRampToValueAtTime(cut * 0.5, t + dur);                                      /* al alejarse pierde brillo */
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.12); g.gain.setValueAtTime(vol, t + dur * 0.3); g.gain.linearRampToValueAtTime(vol * 0.35, t + dur * 0.75); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(am); o2.connect(am); am.connect(f); f.connect(g); g.connect(master); [o, o2, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.05); });
  }
  let cN = 0, cT = 0;                 // billetes contados seguidos: cada uno suena un poquito más agudo
  const sfx = {
    click() { tone(620, 0.045, 'sine', 0.11, 0, 430); },
    pick()  { tone(400, 0.07, 'sine', 0.15, 0, 660); },                                         // levantar algo con el dedo
    drop()  { tone(280, 0.09, 'sine', 0.22, 0, 140); noise(0.035, 0.07, 0, 1800); },           // apoyarlo
    bell()  { tone(1568, 0.5, 'sine', 0.22); tone(2093, 0.6, 'sine', 0.14, 0.09); },          // campanita de la puerta
    ok()    { tone(660, 0.1, 'triangle', 0.22); tone(880, 0.1, 'triangle', 0.2, 0.08); tone(1320, 0.22, 'sine', 0.2, 0.16); },
    error() { tone(233, 0.11, 'triangle', 0.24, 0, 196); tone(175, 0.2, 'triangle', 0.24, 0.12, 147); },   // "no-no" grave, sin chicharra
    cash()  { noise(0.05, 0.25, 0, 3000); tone(1318, 0.09, 'triangle', 0.14, 0.05); tone(1760, 0.3, 'triangle', 0.22, 0.13); }, // caja registradora
    bill()  { noise(0.07, 0.18, 0, 2500); },
    count() { const now = Date.now(); cN = now - cT < 2500 ? Math.min(cN + 1, 11) : 0; cT = now; noise(0.05, 0.12, 0, 2600); tone(N(SCALE[cN % 8] + 12 + (cN >= 8 ? 12 : 0)), 0.12, 'sine', 0.16, 0.02); },
    swipe() { noise(0.14, 0.12, 0, 900); },
    flip()  { noise(0.08, 0.1, 0, 1300); tone(480, 0.07, 'sine', 0.1, 0.05, 760); },            // dar vuelta algo
    send()  { tone(520, 0.11, 'sine', 0.15, 0, 1040); noise(0.06, 0.05, 0.02, 3000); },         // mensaje enviado
    stamp() { tone(150, 0.1, 'sine', 0.3, 0, 70); noise(0.05, 0.12, 0, 600); },                 // firma / sello
    power() { tone(98, 0.6, 'sine', 0.2, 0, 196); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.13, 0.28 + i * 0.09)); },   // la PC arranca
    moto()  { tone(880, 0.09, 'square', 0.07, 0.35); tone(880, 0.12, 'square', 0.07, 0.5); engine(120, 2.6, 30, 1500, 0.13, 0.6); },                            /* bocinita y motor chillón */
    van()   { tone(415, 0.16, 'square', 0.06, 0.4); tone(349, 0.16, 'square', 0.06, 0.4); engine(82, 2.8, 19, 900, 0.16, 0.65); },                            /* bocina de dos notas y motor mediano */
    truck() { noise(0.5, 0.1, 0.25, 1400); tone(185, 0.55, 'sawtooth', 0.07, 0.45); tone(233, 0.55, 'sawtooth', 0.07, 0.45); engine(52, 3.2, 11, 520, 0.2, 0.75); },   /* freno de aire, bocinazo grave y motor diésel */
    lost()  { tone(392, 0.16, 'triangle', 0.2); tone(294, 0.3, 'triangle', 0.2, 0.15); },
    speaker(){ tone(880, 0.12, 'sine', 0.14); tone(698, 0.2, 'sine', 0.14, 0.13); },          // altavoz del Dueño
    combo(n){ tone(N(SCALE[Math.min(n, 7)] + 12), 0.1, 'triangle', 0.13); },
    intr()  { tone(784, 0.09, 'sine', 0.16); tone(1047, 0.14, 'sine', 0.16, 0.1); },                    // aviso suave de interrupción
    mate()  { noise(0.22, 0.08, 0, 700); tone(330, 0.2, 'sine', 0.12, 0.2, 440); },                      // sorbito
    fanfare(){ [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => { tone(f, i === 6 ? 0.7 : 0.16, 'triangle', 0.2, i * 0.14); if (i === 6) { tone(f / 2, 0.7, 'sine', 0.14, i * 0.14); tone(f * 0.75, 0.7, 'sine', 0.1, i * 0.14); } }); },
    endDay(){ [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, i * 0.13)); tone(262, 0.6, 'sine', 0.12, 0.39); }
  };

  return {
    unlock,
    play(name, arg) { if (sfx[name]) sfx[name](arg); },
    babble,
    setMood(m) { if (MOODS[m] && m !== mood) { mood = m; mStep = 0; } },
    musicLevel: () => mLevel,
    setMusic(v) { mLevel = v; musicOn = v > 0; GS.Store.set('music', v); if (mGain) mGain.gain.value = MVOL[v]; },
    isMuted: () => muted,
    peek: () => ({ ctx, master, moods: Object.keys(MOODS), sfx: Object.keys(sfx) }),
    setMuted(m) { muted = m; GS.Store.set('mute', m); if (master) master.gain.value = m ? 0 : 0.5; }
  };
})();
