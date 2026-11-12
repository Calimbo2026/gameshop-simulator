// Arma dist/index.html: un único archivo autocontenido (CSS, Three.js, logo y juego adentro).
// Uso: node build.js
const fs = require('fs'), path = require('path');
const r = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'src/logo.png')).toString('base64');
const js = ['data.js', 'icons.js', 'audio.js', 'world.js', 'minigames.js', 'game.js'].map(f => r('src/' + f)).join('\n');
const sub = (s, key, val) => { const i = s.indexOf(key); return s.slice(0, i) + val + s.slice(i + key.length); };
let html = r('src/index.template.html');
html = sub(html, '/*__CSS__*/', r('src/style.css'));
html = sub(html, '/*__THREE__*/', r('vendor/three.min.js'));
html = sub(html, '/*__JS__*/', '"use strict";\n' + js.replace('const GS = {};', 'const GS = {};\nGS.LOGO = "' + logo + '";'));
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/index.html'), html);
fs.writeFileSync(path.join(__dirname, 'index.html'), html);   // copia en la raíz: es la que se publica
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
