// Arma la web de una sucursal (por ahora DINOTECH) en sitios/<id>/: la misma web y los mismos
// juegos digitales que Zona Gamer, con el nombre, el logo, el WhatsApp y el stock de físicos de la sucursal.
//
// Uso: node scripts/sucursal.js dinotech [--local] [--sin-imagenes]
//   --local         toma los digitales de public/data/catalogo.json (si no, de zonagamer.app)
//   --sin-imagenes  no busca portadas nuevas
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const SUC_DIR = path.join(ROOT, 'sucursales');

// Todas las sucursales configuradas en sucursales/<id>/config.json
function sucursales() {
  if (!fs.existsSync(SUC_DIR)) return [];
  return fs.readdirSync(SUC_DIR)
    .filter(id => fs.existsSync(path.join(SUC_DIR, id, 'config.json')))
    .map(cargar);
}

function cargar(id) {
  const file = path.join(SUC_DIR, id, 'config.json');
  if (!fs.existsSync(file)) throw new Error(`No existe la sucursal "${id}" (falta ${path.relative(ROOT, file)})`);
  return { id, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  return r.json();
}

// "Usados para PS4" / "Nuevos y usados para PS5, PS4 y Nintendo Switch"
function textoFisicos(fisicos) {
  const ORDEN = ['PS5', 'PS4', 'PS3', 'Switch', '3DS', 'Xbox One', 'Xbox 360'];
  const NOMBRE = { Switch: 'Nintendo Switch', '3DS': 'Nintendo 3DS' };
  const plats = [...new Set(fisicos.map(p => p.platform))].sort((a, b) => (ORDEN.indexOf(a) + 1 || 99) - (ORDEN.indexOf(b) + 1 || 99)).map(p => NOMBRE[p] || p);
  const conds = new Set(fisicos.map(p => p.condition));
  const estado = conds.has('Nuevo') && conds.has('Usado') ? 'Nuevos y usados' : conds.has('Nuevo') ? 'Nuevos' : 'Usados';
  const lista = plats.length > 1 ? `${plats.slice(0, -1).join(', ')} y ${plats[plats.length - 1]}` : plats[0] || 'consolas';
  return `${estado} para ${lista}. En el local.`;
}

// Cambia un texto del index.html; si no lo encuentra, frena (así no se publica con datos de Zona Gamer)
function cambiar(html, re, to, que) {
  if (!re.test(html)) throw new Error(`No encontré en index.html: ${que}`);
  return html.replace(re, to);
}

async function build(id, { local = false, noImages = false } = {}) {
  const { loadFisicos } = require('./fisicos');
  const { applyCovers } = require('./images');
  const { stampAssets } = require('./sello');
  const s = cargar(id);
  const out = path.join(ROOT, 'sitios', id);
  const imgSrc = path.join(SUC_DIR, id, 'img');
  const tiene = f => fs.existsSync(path.join(imgSrc, f));
  console.log(`Armando la web de ${s.nombre} en ${path.relative(ROOT, out)}`);

  // 1. Copia de la web, sin los datos, el dominio ni las imágenes de marca de Zona Gamer
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(PUB, out, {
    recursive: true,
    filter: src => !['data', 'CNAME', 'img', 'sucursal.js'].includes(path.relative(PUB, src).split(path.sep)[0]),
  });
  if (fs.existsSync(imgSrc)) fs.cpSync(imgSrc, path.join(out, 'img'), { recursive: true });

  // 2. Catálogo: digitales de Zona Gamer + físicos de la sucursal
  const base = local
    ? JSON.parse(fs.readFileSync(path.join(PUB, 'data', 'catalogo.json'), 'utf8'))
    : await getJSON('https://zonagamer.app/data/catalogo.json');
  const digitales = (base.products || []).filter(p => p.category !== 'fisicos');
  if (digitales.length < 1000) throw new Error(`El catálogo de Zona Gamer trajo solo ${digitales.length} productos digitales. No se publica.`);

  let fisicos;
  try {
    console.log('Juegos físicos:');
    fisicos = await loadFisicos({ dolar: base.dolar, folderId: s.fisicosDrive, fixedPrices: false });
    if (!fisicos.length) throw new Error('los PDFs no tienen juegos con stock');
  } catch (e) {
    // Si Drive falla, se reusa la lista publicada de la sucursal (no se publica una web sin stock)
    console.warn(`No se pudieron leer los físicos (${e.message}). Se reusa la lista publicada.`);
    const live = await getJSON(`https://${s.dominio}/data/catalogo.json`);
    fisicos = (live.products || []).filter(p => p.category === 'fisicos');
    if (!fisicos.length) throw new Error('Tampoco hay una lista publicada de físicos. No se publica.');
  }
  console.log(`${fisicos.length} juegos físicos en stock`);
  await applyCovers(fisicos, [], { noImages });
  console.log(`Portadas: ${fisicos.filter(p => p.image).length}/${fisicos.length} físicos con imagen`);

  fs.mkdirSync(path.join(out, 'data'), { recursive: true });
  fs.writeFileSync(path.join(out, 'data', 'catalogo.json'), JSON.stringify({
    updated: new Date().toISOString(), dolar: base.dolar || null,
    products: [...digitales, ...fisicos], promos: base.promos || [], infos: base.infos || {},
  }));

  // 3. Datos de la sucursal para app.js
  const suc = { nombre: s.nombre, whatsapp: s.whatsapp, retiro: s.retiro, heroFisicos: s.heroFisicos };
  fs.writeFileSync(path.join(out, 'sucursal.js'), `// Generado por scripts/sucursal.js con sucursales/${id}/config.json\nwindow.SUCURSAL = ${JSON.stringify(suc, null, 2)};\n`);
  fs.writeFileSync(path.join(out, 'CNAME'), s.dominio + '\n');

  // 4. index.html con el nombre, el logo y los datos de la sucursal
  const [t1, t2] = s.logoTexto || [s.nombre, ''];
  const nombreLogo = `${esc(t1)}<b>${esc(t2)}</b>`;
  const N = esc(s.nombre);
  let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  html = html.replace(/Zona Gamer ·/g, `${N} ·`);
  html = cambiar(html, /Nuevocentro Shopping, Córdoba\./, `${esc(s.direccion)}, Córdoba.`, 'descripción');
  html = html.replace(/https:\/\/zonagamer\.app\//g, `https://${s.dominio}/`);
  if (!tiene('og.jpg')) html = cambiar(html, /[ \t]*<meta property="og:image"[^>]*>\r?\n/, '', 'og:image');
  if (!tiene('favicon.png')) {
    const fav = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#000"/><text x="32" y="45" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="40" fill="#ff0000">${s.nombre[0]}</text></svg>`)}`;
    html = cambiar(html, /href="img\/favicon\.png"/, `href="${fav}"`, 'favicon');
  }
  if (!tiene('apple-touch-icon.png')) html = cambiar(html, /[ \t]*<link rel="apple-touch-icon"[^>]*>\r?\n/, '', 'apple-touch-icon');
  html = cambiar(html, /aria-label="Zona Gamer, inicio"/, `aria-label="${N}, inicio"`, 'logo del encabezado');
  if (!tiene('emblema.png')) html = cambiar(html, /[ \t]*<img src="img\/emblema\.png"[^>]*>\r?\n/, '', 'emblema');
  html = cambiar(html, /<span class="logo-text">ZONA<b>GAMER<\/b><\/span>/, `<span class="logo-text">${nombreLogo}</span>`, 'nombre del encabezado');
  for (const cls of ['foot-logo', 'chooser-logo']) {
    const re = new RegExp(`<img class="${cls}" src="img/logo\\.png" alt="Zona Gamer">`);
    html = cambiar(html, re, tiene('logo.png') ? `<img class="${cls}" src="img/logo.png" alt="${N}">` : `<p class="${cls} logo-escrito">${nombreLogo}</p>`, cls);
  }
  html = cambiar(html, /<p>Av\. Duarte Quirós[^<]*<br>[^<]*<\/p>/, `<p>${esc(s.direccion)}<br>${esc(s.ciudad)}</p>`, 'dirección del pie');
  html = cambiar(html, /WhatsApp \+54 9 351 384-5195/, `WhatsApp ${esc(s.whatsappTexto)}`, 'WhatsApp del pie');
  html = cambiar(html, /<span class="choice-text">Nuevos y usados para[^<]*<\/span>/, `<span class="choice-text">${esc(textoFisicos(fisicos))}</span>`, 'texto de físicos');
  // Sin el logo propio: se sacan las texturas con el logo de Zona Gamer y se muestra el nombre escrito
  const css = [
    '.logo-escrito { font: 800 30px/1 var(--display); letter-spacing: 3px; color: var(--text); width: auto; }',
    '.logo-escrito b { color: var(--red); margin-left: 4px; }',
    '.chooser-logo.logo-escrito { font-size: 42px; width: auto; margin: 0 auto 22px; text-shadow: 0 0 24px rgba(255, 0, 0, .45); filter: none; }',
    '.foot-logo.logo-escrito { font-size: 22px; margin: 0 0 10px; }',
    '@media (max-width: 640px) { .logo-text { display: inline; font-size: 16px; } .chooser-logo.logo-escrito { font-size: 32px; } }',
  ];
  if (!tiene('emblema.png')) css.push('.ph::before { display: none; }');
  if (!tiene('logo-textura.png')) css.push('.hero::after { display: none; }');
  html = cambiar(html, /<\/head>/, `  <style>/* ${N} */\n  ${css.join('\n  ')}\n  </style>\n</head>`, '</head>');
  const quedo = html.match(/Zona Gamer|ZONA|zonagamer|Nuevocentro|Duarte Quir|384-5195/i);
  if (quedo) throw new Error(`Quedó un dato de Zona Gamer en index.html: "${quedo[0]}"`);
  fs.writeFileSync(path.join(out, 'index.html'), html);
  stampAssets(out);
  console.log(`Listo: ${path.relative(ROOT, out)} (${digitales.length} digitales + ${fisicos.length} físicos)`);
}

module.exports = { sucursales, cargar, build, textoFisicos };

if (require.main === module) {
  const id = process.argv.slice(2).find(a => !a.startsWith('--'));
  if (!id) { console.error('Uso: node scripts/sucursal.js <sucursal> (ej. dinotech)'); process.exit(1); }
  build(id, { local: process.argv.includes('--local'), noImages: process.argv.includes('--sin-imagenes') })
    .catch(e => { console.error(e.message); process.exit(1); });
}
