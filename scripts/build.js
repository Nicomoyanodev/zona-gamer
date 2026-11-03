// Baja el Excel del proveedor, lo procesa, busca portadas y genera public/data/catalogo.json
const fs = require('fs');
const path = require('path');
const { parseWorkbook } = require('./parse');
const { applyCovers } = require('./images');
const { stampAssets } = require('./sello');
const { loadFisicos, getDolarBlue, applyFixedPrices } = require('./fisicos');

const ROOT = path.join(__dirname, '..');
const XLSX_FILE = path.join(ROOT, 'data', 'proveedor.xlsx');
const OUT = path.join(ROOT, 'public', 'data', 'catalogo.json');

// El ID del Excel del proveedor no va en el código (el repo es público):
// en GitHub está en el secreto SHEET_ID; en la compu, en data/sheet-id.txt
function sheetId() {
  if (process.env.SHEET_ID) return process.env.SHEET_ID.trim();
  try { return fs.readFileSync(path.join(ROOT, 'data', 'sheet-id.txt'), 'utf8').trim(); } catch {}
  throw new Error('Falta el ID del Excel: definí SHEET_ID o creá data/sheet-id.txt');
}

async function download() {
  const SHEET_ID = sheetId();
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
  const r = await fetch(url, { redirect: 'follow' });
  const buf = Buffer.from(await r.arrayBuffer());
  // Un .xlsx es un ZIP: empieza con "PK"
  if (!r.ok || buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error(`No se pudo bajar el Excel (HTTP ${r.status})`);
  fs.mkdirSync(path.dirname(XLSX_FILE), { recursive: true });
  fs.writeFileSync(XLSX_FILE, buf);
  console.log(`Excel descargado (${Math.round(buf.length / 1024)} KB)`);
}

async function main() {
  const offline = process.argv.includes('--offline');
  const noImages = process.argv.includes('--sin-imagenes');
  if (!offline) await download();

  const { products, promos, infos } = parseWorkbook(XLSX_FILE);
  console.log(`${products.length} productos, ${promos.length} promos`);

  // Protección: si el Excel vino vacío o cambió de formato, no publicar (queda la versión anterior)
  const MIN_PRODUCTS = 1000;
  if (products.length < MIN_PRODUCTS) throw new Error(`Solo se leyeron ${products.length} productos (mínimo ${MIN_PRODUCTS}). ¿Cambió el formato del Excel? No se publica.`);
  const priced = products.filter(p => p.price).length;
  if (priced < products.length * 0.8) throw new Error(`Solo ${priced} de ${products.length} productos tienen precio. No se publica.`);

  // Juegos físicos (PDFs de stock en Drive). Si Drive falla, se reusa la lista publicada
  // para no frenar la actualización de los digitales.
  let fisicos = [];
  let dolar = null;
  try {
    // Los precios en dólares de los PDFs se pasan a pesos con el dólar blue + 20
    dolar = await getDolarBlue();
    console.log(`Dólar blue: ${dolar.venta} (${dolar.fuente}) + ${dolar.extra} = ${dolar.venta + dolar.extra} por dólar`);
    console.log('Juegos físicos:');
    fisicos = await loadFisicos({ dolar });
    console.log(`${fisicos.length} juegos físicos en stock`);
  } catch (e) {
    console.warn('No se pudieron leer los físicos (' + e.message + '). Se reusa la lista publicada.');
    try {
      const live = await (await fetch('https://zonagamer.app/data/catalogo.json')).json();
      fisicos = applyFixedPrices((live.products || []).filter(p => p.category === 'fisicos'));
      dolar = live.dolar || null;
    } catch {}
  }
  products.push(...fisicos);

  await applyCovers(products, promos, { noImages });

  const withImg = products.filter(p => p.image).length;
  const games = products.filter(p => ['juegos', 'preventas', 'fisicos'].includes(p.category)).length;
  console.log(`Portadas: ${withImg}/${games} juegos con imagen`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), dolar, products, promos, infos }));
  console.log(`Listo: ${path.relative(ROOT, OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
  stampAssets(path.join(ROOT, 'public'));
}

main().catch(e => { console.error(e.message); process.exit(1); });
