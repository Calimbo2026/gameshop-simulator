/* =====================================================================
   SONIDO — todo generado por código con Web Audio (sin archivos).
   Arranca con el primer toque del usuario. Incluye la música (un loop
   generativo tranquilo, distinto según el momento) y los balbuceos.
   ===================================================================== */
GS.Audio = (function () {
  let ctx = null, master = null, mGain = null, muted = !!GS.Store.get('mute'), musicOn = GS.Store.get('music') !== false;

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC(); master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
      mGain = ctx.createGain(); mGain.gain.value = musicOn ? 1 : 0; mGain.connect(master);
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

  /* ---------- Música: loop generativo, sin archivos. Cada momento tiene su clima ---------- */
  const N = n => 440 * Math.pow(2, (n - 69) / 12);      // nota MIDI a frecuencia
  const MOODS = {
    menu:  { bpm: 76,  prog: [[48, 64, 67, 71], [45, 64, 67, 72], [41, 65, 69, 72], [43, 62, 67, 71]], arp: 'sine',     hat: 0,    bass: [0, 8] },
    day:   { bpm: 96,  prog: [[48, 64, 67, 71], [45, 60, 64, 67], [41, 65, 69, 72], [43, 62, 67, 71]], arp: 'triangle', hat: 0.03, bass: [0, 6, 8, 14] },
    rain:  { bpm: 72,  prog: [[45, 64, 69, 72], [41, 65, 69, 72], [48, 64, 67, 72], [43, 62, 67, 71]], arp: 'sine',     hat: 0,    bass: [0, 8] },
    party: { bpm: 108, prog: [[48, 64, 67, 72], [43, 62, 67, 71], [45, 64, 69, 72], [41, 65, 69, 72]], arp: 'triangle', hat: 0.04, bass: [0, 4, 8, 12] },
    final: { bpm: 112, prog: [[48, 64, 67, 72], [41, 65, 69, 72], [43, 67, 71, 74], [48, 67, 72, 76]], arp: 'square',   hat: 0.04, bass: [0, 4, 8, 12] }
  };
  const ARP = [0, 1, 2, 1, 2, 1, 0, 2];
  let mood = 'menu', mStep = 0, mNext = 0, mTimer = null;
  function voice(freq, dur, type, vol, t, att) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (att || 0.015)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(mGain); o.start(t); o.stop(t + dur + 0.05);
  }
  function hat(t, vol) {
    const len = Math.floor(ctx.sampleRate * 0.03), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = buf; f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(mGain); s.start(t);
  }
  // Agenda las notas un rato antes de que suenen (así no se corta si el juego se traba un instante)
  function pump() {
    if (!ctx || muted || !musicOn || document.hidden || ctx.state !== 'running') { mNext = 0; return; }
    const m = MOODS[mood], sp = 60 / m.bpm / 4;
    if (mNext < ctx.currentTime) mNext = ctx.currentTime + 0.06;
    while (mNext < ctx.currentTime + 0.3) {
      const st = mStep % 16, ch = m.prog[Math.floor(mStep / 16) % m.prog.length], t = mNext;
      if (st === 0) for (let i = 1; i < 4; i++) voice(N(ch[i]), sp * 15, 'sine', 0.035, t, 0.25);         // colchón del acorde
      if (m.bass.indexOf(st) >= 0) voice(N(ch[0] - (st === 6 || st === 14 ? 0 : 12)), sp * 3.2, 'triangle', 0.16, t);
      if (st % 2 === 0) voice(N(ch[1 + ARP[(st / 2) % 8]] + 12), sp * 1.7, m.arp, m.arp === 'square' ? 0.028 : 0.06, t);
      if (m.hat && st % 4 === 2) hat(t, m.hat);
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
    isMusicOn: () => musicOn,
    setMusic(v) { musicOn = v; GS.Store.set('music', v); if (mGain) mGain.gain.value = v ? 1 : 0; },
    isMuted: () => muted,
    setMuted(m) { muted = m; GS.Store.set('mute', m); if (master) master.gain.value = m ? 0 : 0.5; }
  };
})();
