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
      master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
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
  const MOODS = {
    menu:  { bpm: 66, prog: [[48, 64, 67, 71], [45, 64, 67, 72], [41, 64, 69, 72], [43, 62, 67, 71]], mel: [4, null, null, 2, null, null, 3, null, 2, null, null, 0, null, null, null, null], kick: 0 },
    day:   { bpm: 80, prog: [[48, 64, 67, 71], [45, 60, 64, 67], [41, 60, 65, 69], [43, 62, 65, 71]], mel: [2, null, 3, null, 4, null, null, 3, null, 2, null, 0, null, null, 1, null], kick: 0.1 },
    rain:  { bpm: 62, prog: [[45, 64, 67, 72], [41, 64, 69, 72], [48, 64, 67, 71], [43, 62, 67, 71]], mel: [4, null, null, null, 3, null, 2, null, null, null, 0, null, null, null, null, null], kick: 0 },
    party: { bpm: 92, prog: [[48, 64, 67, 72], [43, 62, 67, 71], [45, 64, 69, 72], [41, 65, 69, 72]], mel: [0, null, 2, 3, null, 4, null, 3, 2, null, 3, null, 5, null, 4, null], kick: 0.13 },
    final: { bpm: 96, prog: [[48, 64, 67, 72], [41, 65, 69, 72], [43, 62, 67, 71], [48, 64, 67, 76]], mel: [2, 3, 4, null, 5, null, 4, 3, 4, null, 5, 6, 7, null, null, null], kick: 0.13 }
  };
  let mood = 'menu', mStep = 0, mNext = 0, mTimer = null, mLp = null;
  function voice(freq, dur, type, vol, t, att, rel) {
    if (!mLp) { mLp = ctx.createBiquadFilter(); mLp.type = 'lowpass'; mLp.frequency.value = 1500; mLp.Q.value = 0.3; mLp.connect(mGain); }
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (att || 0.02)); g.gain.setTargetAtTime(0.0001, t + (att || 0.02), (rel || dur) / 4);
    o.connect(g); g.connect(mLp); o.start(t); o.stop(t + dur + 0.1);
  }
  // Agenda las notas un rato antes de que suenen (así no se corta si el juego se traba un instante)
  function pump() {
    if (!ctx || muted || !musicOn || document.hidden || ctx.state !== 'running') { mNext = 0; return; }
    const m = MOODS[mood], sp = 60 / m.bpm / 2;                                   // paso = una corchea
    if (mNext < ctx.currentTime) mNext = ctx.currentTime + 0.08;
    while (mNext < ctx.currentTime + 0.35) {
      const st = mStep % 8, bar = Math.floor(mStep / 8), ch = m.prog[bar % m.prog.length], t = mNext + (st % 2 ? sp * 0.12 : 0);   // un poquito de swing
      if (st === 0) for (let i = 1; i < 4; i++) voice(N(ch[i]), sp * 9, 'sine', 0.05, t + i * 0.03, 0.5, sp * 6);               // colchón del acorde, entra de a poco
      if (st === 0 || st === 5) voice(N(ch[0] - 12), sp * 2.6, 'sine', st ? 0.11 : 0.16, t, 0.03);                             // bajo redondo
      if (m.kick && (st === 0 || st === 4)) voice(90, 0.16, 'sine', m.kick, t, 0.005, 0.12);                                   // pulso apenas marcado
      const deg = m.mel[(bar % 2) * 8 + st];
      if (deg != null && (bar % 4 !== 3 || st < 4)) voice(N(SCALE[deg] + (bar % 8 >= 4 && st === 0 ? 12 : 0)), sp * 2.4, 'triangle', 0.05, t, 0.03);   // melodía con aire
      mStep++; mNext += sp;
    }
  }

  // Balbuceo: sílabas cortitas en el tono de cada personaje (no dice nada, pero suena a que habla)
  function babble(text, pitch) {
    if (!ctx || muted) return;
    const n = Math.min(9, Math.max(3, Math.round(String(text).length / 9))), p = pitch || 320;
    for (let i = 0; i < n; i++) { const c = String(text).charCodeAt(i * 3 % text.length) || 65; tone(p * (1 + ((c % 7) - 3) * 0.055), 0.06, 'triangle', 0.09, i * 0.075, p * (1 + ((c % 5) - 2) * 0.05)); }
  }

  const sfx = {
    click() { tone(520, 0.05, 'square', 0.08); },
    bell()  { tone(1568, 0.5, 'sine', 0.22); tone(2093, 0.6, 'sine', 0.14, 0.09); },          // campanita de la puerta
    ok()    { tone(660, 0.1, 'triangle', 0.25); tone(990, 0.16, 'triangle', 0.25, 0.09); },
    error() { tone(160, 0.22, 'sawtooth', 0.16, 0, 110); },
    cash()  { noise(0.05, 0.25, 0, 3000); tone(1318, 0.09, 'square', 0.12, 0.05); tone(1760, 0.3, 'triangle', 0.22, 0.13); }, // caja registradora
    bill()  { noise(0.07, 0.18, 0, 2500); },
    swipe() { noise(0.14, 0.12, 0, 900); },
    lost()  { tone(392, 0.16, 'triangle', 0.2); tone(294, 0.3, 'triangle', 0.2, 0.15); },
    speaker(){ tone(880, 0.12, 'sine', 0.14); tone(698, 0.2, 'sine', 0.14, 0.13); },          // altavoz del Dueño
    combo(n){ tone(520 + Math.min(n, 8) * 70, 0.09, 'square', 0.1); },
    intr()  { tone(784, 0.09, 'sine', 0.16); tone(1047, 0.14, 'sine', 0.16, 0.1); },                    // aviso suave de interrupción
    mate()  { noise(0.22, 0.08, 0, 700); tone(330, 0.2, 'sine', 0.12, 0.2, 440); },                      // sorbito
    fanfare(){ [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? 0.7 : 0.16, 'triangle', 0.22, i * 0.14)); },
    endDay(){ [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, i * 0.13)); }
  };

  return {
    unlock,
    play(name, arg) { if (sfx[name]) sfx[name](arg); },
    babble,
    setMood(m) { if (MOODS[m] && m !== mood) { mood = m; mStep = 0; } },
    musicLevel: () => mLevel,
    setMusic(v) { mLevel = v; musicOn = v > 0; GS.Store.set('music', v); if (mGain) mGain.gain.value = MVOL[v]; },
    isMuted: () => muted,
    setMuted(m) { muted = m; GS.Store.set('mute', m); if (master) master.gain.value = m ? 0 : 0.5; }
  };
})();
