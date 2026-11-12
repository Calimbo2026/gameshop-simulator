/* =====================================================================
   SONIDO — todo generado por código con Web Audio (sin archivos).
   Arranca con el primer toque del usuario. Música: Fase 4.
   ===================================================================== */
GS.Audio = (function () {
  let ctx = null, master = null, muted = !!GS.Store.get('mute');

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC(); master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
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
    endDay(){ [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, i * 0.13)); }
  };

  return {
    unlock,
    play(name, arg) { if (sfx[name]) sfx[name](arg); },
    isMuted: () => muted,
    setMuted(m) { muted = m; GS.Store.set('mute', m); if (master) master.gain.value = m ? 0 : 0.5; }
  };
})();
