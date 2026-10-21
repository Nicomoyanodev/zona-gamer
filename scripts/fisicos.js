// Juegos físicos: lee los PDFs de stock de la carpeta de Google Drive (una subcarpeta por consola).
const fs = require('fs');
const path = require('path');

const FOLDER_ID = '1rjTETCTyVmnp6wPSgOMzLFtn7YrTBEmC';
const ROOT = path.join(__dirname, '..');

const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

// fetch con reintentos y con el motivo real del error (en GitHub "fetch failed" no dice nada)
async function get(url) {
  let last;
  for (let i = 0; i < 4; i++) {
    try {
      return await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    } catch (e) {
      last = e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  const cause = last && last.cause ? ` (${last.cause.code || ''} ${last.cause.message || last.cause})` : '';
  throw new Error(`${last && last.message}${cause} en ${url.replace(/id=[\w-]+/, 'id=…')}`);
}

// Lista archivos y subcarpetas de una carpeta pública de Drive
async function listFolder(id) {
  const r = await get(`https://drive.google.com/embeddedfolderview?id=${id}`);
  if (!r.ok) throw new Error(`Drive respondió ${r.status} al listar la carpeta`);
  const html = await r.text();
  const out = [];
  const re = /<a href="https:\/\/drive\.google\.com\/(drive\/folders|file\/d)\/([\w-]+)[^"]*"[\s\S]*?<div class="flip-entry-title">([^<]*)<\/div>/g;
  let m;
  while ((m = re.exec(html))) out.push({ type: m[1] === 'file/d' ? 'file' : 'folder', id: m[2], name: m[3].trim() });
  return out;
}

async function download(id) {
  const r = await get(`https://drive.google.com/uc?export=download&id=${id}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (!r.ok || String.fromCharCode(...buf.slice(0, 4)) !== '%PDF') throw new Error(`No se pudo bajar un PDF (HTTP ${r.status}, ${r.headers.get('content-type')})`);
  return buf;
}

// Texto del PDF agrupado en renglones, de arriba hacia abajo
async function pdfLines(data) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data, verbosity: 0 }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const rows = new Map();
    for (const it of tc.items) {
      if (!it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      const key = [...rows.keys()].find(k => Math.abs(k - y) <= 2) ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ x: it.transform[4], s: it.str.trim() });
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) lines.push(rows.get(y).sort((a, b) => a.x - b.x));
  }
  return lines;
}

const PLATFORMS = [
  [/\bPS5\b/i, 'PS5'], [/\bPS4\b/i, 'PS4'], [/\bPS3\b/i, 'PS3'],
  [/SWITCH|NINTENDO/i, 'Switch'], [/X\s?BOX\s?ONE/i, 'Xbox One'], [/X\s?BOX\s?360|\b360\b/i, 'Xbox 360'],
];
const platformOf = s => (PLATFORMS.find(([re]) => re.test(s)) || [, null])[1];

// Errores de tipeo frecuentes en los listados del sistema (se corrigen en la web)
const TYPOS = [
  [/\bSainsts\b/i, 'Saints'], [/\bGlder\b/i, 'Elder'], [/\bHearths\b/i, 'Hearts'],
  [/\bInjusticegods\b/i, 'Injustice Gods'], [/\bIn?mmortales\b|\bInmortals\b/i, 'Immortals'],
  [/\bAssasins\b/i, 'Assassins'], [/\bValhal\b/i, 'Valhalla'], [/\bPersuit\b/i, 'Pursuit'],
  [/\bNightrein\b/i, 'Nightreign'], [/\bLtimate\b/i, 'Ultimate'], [/\bWonderlans\b/i, 'Wonderlands'],
  [/\bFootbal\b/i, 'Football'], [/\bFarcry\b/i, 'Far Cry'], [/\bTitan Fall\b/i, 'Titanfall'],
  [/\bNBA ?2K ?(\d+)/i, 'NBA 2K$1'], [/\bPuyopuyo\b/i, 'Puyo Puyo'], [/\bMegaman\b/i, 'Mega Man'],
  [/\bRockband\b/i, 'Rock Band'], [/\bLegacy Of Thief\b/i, 'Legacy of Thieves'], [/\bOg Rock\b/i, 'of Rock'],
  [/\bResident Evil 8 Village\b/i, 'Resident Evil Village'], [/\bXenoverse XV\b/i, 'Xenoverse'],
  [/\bParte 2\b/i, 'Part II'], [/\bDdj\b/i, ''], [/\bBlood Hound\b/i, 'Bloodhound'],
  [/\bDestiny La Coleccion\b/i, 'Destiny The Collection'], [/\bEdicion Completo\b/i, 'Complete Edition'],
  [/\bMarvel Avengers\b/i, "Marvel's Avengers"], [/\bTiger Woods PGA TOUR ?08\b/i, 'Tiger Woods PGA Tour 08'],
  [/\bEdicion Especial (.+)$/i, '$1 Edición Especial'], [/\bStreet Fighters\b/i, 'Street Fighter'],
];

// "GRAN TURISMO 7 NUEVO SELLADO PS4" -> "Gran Turismo 7"
function cleanName(raw) {
  let out = titleCase(raw);
  for (const [re, to] of TYPOS) out = out.replace(re, to);
  return out.replace(/\s{2,}/g, ' ').trim();
}

function titleCase(raw) {
  let s = raw
    .replace(/\b(SELLADOS?|SELLADAS?|NUEVOS?|NUEVAS?|USADOS?|USADAS?|OUTLET|OULET|OLET|ORIGINAL|FISICO|FÍSICO)\b/gi, ' ')
    .replace(/\bPS-?[345]\b/gi, ' ')
    .replace(/\b(SX|SERIES\s?X)\b/gi, ' Series X ')
    .replace(/\b(NINTENDO\s+SWITCH|NINTENDO|SWITCH|X\s?BOX\s?ONE\w*|X\s?BOX\s?360|XBOX|PS[345]|PLAYSTATION\s?[345]?)\b/gi, ' ')
    .replace(/(\s|-)+(ONEE?|360)\s*$/i, ' ')
    .replace(/\s+-\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const keepUpper = /^(II|III|IV|VI|VII|VIII|IX|XI|XII|XIII|XV|XVI|FC|NBA|NFL|WWE|UFC|GTA|LEGO|FIFA|MLB|NHL|WRC|DLC|HD|VR|3DS|2K\d*|MX|GT|RE|COD|DC|TMNT|PGA|F1|UEFA|PES|NFS)$/;
  return s.toLowerCase().replace(/[^\s:\-]+/g, w => {
    const up = w.toUpperCase();
    if (keepUpper.test(up) || /\d/.test(w)) return up;
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
}

// Recorre los renglones: nombre (1 o más líneas) + stock "2,00" + línea de categoría "SONY - JUEGOS PS4 NUEVOS"
function parseLines(lines, { platform, condition, file }) {
  const items = [];
  let name = [], stock = null;
  const isHeader = t => /Zona Gamer S\.A\.S|Av Duartes|Listado de Precios|^Producto|Powered by|^\d+ \/ \d+$/i.test(t);
  for (const row of lines) {
    const text = row.map(c => c.s).join(' ');
    if (isHeader(text)) continue;
    // Línea de categoría: "SONY - JUEGOS PS4 NUEVOS" o "SONY - Juego Usado Ps3"
    if (/^[A-Z0-9ÁÉÍÓÚÑ ]+\s-\s*JUEGOS?\b/i.test(text)) {
      if (name.length && stock > 0) {
        const raw = name.join(' ');
        const plat = /\b3DS\b/i.test(raw) ? '3DS' : platform;
        items.push({
          raw,
          name: cleanName(raw),
          platform: plat,
          condition: /OUTLET|OULET/i.test(raw) ? 'Usado' : condition,
          stock,
          file,
        });
      }
      name = []; stock = null;
      continue;
    }
    for (const c of row) {
      if (c.x > 400 && /^\d+([.,]\d+)?$/.test(c.s)) stock = Math.round(parseFloat(c.s.replace(',', '.')));
      else if (c.x < 400) name.push(c.s);
    }
  }
  return items;
}

async function loadFisicos({ log = true } = {}) {
  const top = await listFolder(FOLDER_ID);
  const folders = top.filter(x => x.type === 'folder');
  if (!folders.length) throw new Error('La carpeta de Drive de físicos está vacía o no es pública');
  const all = [];
  for (const folder of folders) {
    const platform = platformOf(folder.name) || folder.name;
    for (const f of (await listFolder(folder.id)).filter(x => x.type === 'file')) {
      const condition = /USAD/i.test(f.name) ? 'Usado' : 'Nuevo';
      const lines = await pdfLines(await download(f.id));
      const items = parseLines(lines, { platform, condition, file: f.name });
      if (log) console.log(`  ${folder.name} / ${f.name}: ${items.length} juegos`);
      all.push(...items);
    }
  }
  // Mismo juego repetido en el listado: se suman los stocks
  const byId = new Map();
  for (const it of all) {
    const id = `fisico-${slug(it.platform)}-${slug(it.name)}-${slug(it.condition)}`;
    if (byId.has(id)) { byId.get(id).stock += it.stock; continue; }
    byId.set(id, {
      id,
      name: it.name,
      platform: it.platform,
      category: 'fisicos',
      type: 'fisico',
      condition: it.condition,
      stock: it.stock,
      price: null,
      oldPrice: null,
    });
  }
  return [...byId.values()];
}

module.exports = { loadFisicos, cleanName, parseLines, pdfLines };

if (require.main === module) {
  loadFisicos().then(list => {
    const by = {};
    for (const p of list) by[`${p.platform} ${p.condition}`] = (by[`${p.platform} ${p.condition}`] || 0) + 1;
    console.log(list.length, 'juegos físicos', by);
    console.log(list.filter((_, i) => i % 9 === 0).map(p => `${p.platform} | ${p.condition} | ${p.stock} | ${p.name}`).join('\n'));
  }).catch(e => { console.error(e); process.exit(1); });
}
