const fs = require('fs'), vm = require('vm');
const ctx = { localStorage: { getItem: () => null, setItem() {} }, location: { search: '', protocol: 'file:', host: '', pathname: '' }, window: {}, document: {}, navigator: {}, console };
vm.createContext(ctx); vm.runInContext(fs.readFileSync('src/data.js', 'utf8') + '\nthis.GS = GS;', ctx); const GS = ctx.GS;
let o = '# GameShop Simulator · Historias de cada sucursal\n\nGenerado desde `src/data.js` (versión ' + GS.CONFIG.version + '). Cada personaje viene al mostrador; en cada visita dice algo y el jugador elige una respuesta. Entre paréntesis, lo que deja cada respuesta (⭐ reputación, 🗺️ fondos de expansión).\n';
const fx = f => { const a = []; if (f.rep) a.push((f.rep > 0 ? '+' : '') + f.rep + ' ⭐'); if (f.fondo) a.push((f.fondo > 0 ? '+' : '') + f.fondo + ' 🗺️'); return a.length ? ' (' + a.join(', ') + ')' : ''; };
for (const R of GS.REGIONS) {
  o += '\n---\n\n## ' + R.name + ' · ' + R.city + (R.secret ? ' (final oculto)' : '') + '\n\n- **Provincias:** ' + R.prov.join(', ') + '\n- **Clima:** ' + R.clima + '\n' + (R.rival ? '- **Competencia:** ' + R.rival.name + ', de ' + R.rival.owner + '. ' + R.rival.rule + '\n' : '- **Competencia:** ninguna; es la casa central.\n');
  const ss = GS.STORIES.filter(S => (S.reg || 'pampeana') === R.id);
  for (const S of ss) {
    o += '\n### ' + S.name + ' — ' + S.tag + (S.once ? ' (aparece una sola vez, al azar)' : '') + '\n\nDesde la jornada ' + S.from + (S.reg ? ' en esa sucursal' : '') + '.\n';
    S.steps.forEach((st, i) => { o += '\n**Visita ' + (i + 1) + (st.end ? ' (cierre)' : '') + '.** «' + st.t + '»' + (st.alt ? '\n\n*Si antes pasó otra cosa:* «' + (typeof st.alt === 'string' ? st.alt : (st.alt.t || JSON.stringify(st.alt))) + '»' : '') + '\n\n'; (st.opts || []).forEach(op => { o += '- **' + op.b + '** → «' + op.r + '»' + fx(op.fx || {}) + '\n'; }); if (st.note) o += '\n*En la libreta:* ' + st.note + '\n'; });
  }
}
fs.writeFileSync('HISTORIAS.md', o); console.log('historias:', GS.STORIES.length, 'caracteres:', o.length);
