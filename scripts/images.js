// Busca la portada de cada juego (Steam primero, después Wikipedia) y guarda el resultado en caché.
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '..', 'data', 'image-cache.json');
const OVERRIDES_FILE = path.join(__dirname, '..', 'data', 'image-overrides.json');
const UA = 'ZonaGamerCatalog/1.0 (catalogo de juegos digitales; Cordoba, Argentina)';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const loadJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

const ROMAN = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10', xi: '11', xii: '12', xiii: '13', xv: '15', xvi: '16' };
const STOP = new Set(['the', 'of', 'a', 'and', 'el', 'la', 'de', 'los', 'las', 'y', 'edition', 'edicion', 'standard', 'game', 'video']);

function norm(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[™®©]/g, '').replace(/['’]s\b/g, '').replace(/spider-?man/g, 'spider man').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}
function tokens(s) {
  const out = norm(s).split(' ').filter(Boolean)
    .map(t => ROMAN[t] || SYN[t] || t)
    .map(t => (t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t)) // assassins = assassin
    .filter(t => !STOP.has(t));
  return out.filter((t, i) => !(/^\d+$/.test(t) && out[i - 1] === t)); // "2 II" -> "2"
}
const SYN = { remasterizado: 'remastered', remasterizada: 'remastered', coleccion: 'collection', trilogia: 'trilogy', edicion: 'edition' };

// Versión más simple del nombre para un segundo intento
function relaxedKey(q) {
  return q
    .replace(/\b(Remasterizad[oa]|Next Generation|Next Gen|Cross ?Gen|Combo|Bundle|Pack|\(.*?\)|Esp\.?)\b/gi, '')
    .replace(/\b(\d+)\s+(II|III|IV|V|VI)\b/g, '$1')
    .replace(/^Bob Esponja/i, 'SpongeBob SquarePants')
    .replace(/Requem/i, 'Requiem')
    .replace(/\s{2,}/g, ' ').trim();
}

// Saca del nombre todo lo que no ayuda a buscar la portada
function searchKey(name) {
  let s = name
    .replace(/[™®©]/g, '')
    .replace(/\((?:español|ingles|inglés|japones|latam|global|usa|[^)]*en 1)\)/gi, '')
    .replace(/\b(PS[2-5]|PS-?[345]|PlayStation\s?[345])\b/gi, '')
    .replace(/\b(standard|deluxe|digital deluxe|gold|ultimate|complete|definitive|game of the year|goty|premium|special|anniversary|director'?s cut|remastered|cross-gen|next level|edici[oó]n est[aá]ndar|edici[oó]n)\s*(edition|edici[oó]n)?\b/gi, m => /remastered|definitive|director/i.test(m) ? m : '')
    .replace(/\s[-–:]\s[^-–:]*\b(edition|edici[oó]n|bundle|pack)\s*$/i, '')
    .replace(/^Plantas vs\.? Zombies/i, 'Plants vs. Zombies')
    .replace(/spider-?man/gi, 'Spider-Man')
    .replace(/\s-\s*$/, '')
    .split(/\s\+\s/)[0] // en bundles uso el primer juego
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s:\-–]+$/, '')
    .trim();
  return s || name;
}

function similarity(query, candidate) {
  const a = tokens(query), b = tokens(candidate.replace(/\((?:[^)]*video game|[^)]*videojuego|\d{4})\)/gi, ''));
  if (!a.length || !b.length) return 0;
  // Los números tienen que coincidir (FIFA 22 ≠ FIFA 23)
  const na = a.filter(t => /^\d+$/.test(t)), nb = b.filter(t => /^\d+$/.test(t));
  if (na.join() !== nb.join()) return 0;
  const sb = new Set(b);
  const inter = a.filter(t => sb.has(t)).length;
  return 0.7 * inter / a.length + 0.3 * inter / b.length;
}

async function getJSON(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 429) { await sleep(15000 * (i + 1)); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch { await sleep(2000); }
  }
  return null;
}

async function urlExists(url) {
  // Solo 404/410 cuentan como rota; si el servidor limita (429) o falla, se reintenta
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } });
      if (r.ok) return true;
      if (r.status === 404 || r.status === 410) return false;
    } catch {}
    await sleep(3000 * (i + 1));
  }
  return true;
}

async function fromSteam(q) {
  const j = await getJSON(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&cc=us&l=english`);
  if (!j || !j.items) return null;
  let best = null;
  for (const it of j.items) {
    const s = similarity(q, it.name);
    if (s >= 0.85 && (!best || s > best.s)) best = { s, it };
  }
  if (!best) return null;
  const base = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${best.it.id}`;
  const cover = `${base}/library_600x900.jpg`;
  if (await urlExists(cover)) return { url: cover, src: 'steam', match: best.it.name };
  // Juegos nuevos usan rutas con hash: pedir el link real a Steam
  const header = await steamHeader(best.it.id);
  if (header) return { url: header, src: 'steam', match: best.it.name, wide: true };
  return null;
}

async function steamHeader(appId) {
  const d = await getJSON(`https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`);
  const url = d && d[appId] && d[appId].success && d[appId].data.header_image;
  return url && (await urlExists(url)) ? url : null;
}

async function fromWikipedia(q, lang = 'en') {
  const term = lang === 'en' ? `${q} video game` : `${q} videojuego`;
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=6` +
    `&gsrsearch=${encodeURIComponent(term)}&prop=pageimages|description&piprop=thumbnail&pithumbsize=500&pilicense=any`;
  const j = await getJSON(url);
  const pages = j && j.query && Object.values(j.query.pages);
  if (!pages) return null;
  let best = null;
  for (const p of pages) {
    if (!p.thumbnail) continue;
    const desc = (p.description || '').toLowerCase();
    if (!/game|videojuego|compilation|recopilaci/.test(desc)) continue;
    const s = similarity(q, p.title);
    if (s >= 0.75 && (!best || s > best.s || (s === best.s && p.index < best.p.index))) best = { s, p };
  }
  if (!best) return null;
  return { url: best.p.thumbnail.source, src: `wikipedia-${lang}`, match: best.p.title };
}

async function findCover(name) {
  const q = searchKey(name);
  const r = (await fromSteam(q)) || (await fromWikipedia(q, 'en')) || (await fromWikipedia(q, 'es'));
  if (r) return r;
  // Segundo intento: sin palabras de relleno, y si sigue sin aparecer, solo lo que va antes de ":" o " - "
  const tries = [relaxedKey(q), relaxedKey(q).split(/\s*[:\-–]\s+/)[0]]
    .filter((t, i, a) => t && t !== q && t.split(' ').length >= 2 && a.indexOf(t) === i);
  for (const t of tries) {
    const r2 = (await fromSteam(t)) || (await fromWikipedia(t, 'en'));
    if (r2) return { ...r2, loose: true };
  }
  return null;
}

// names: lista de nombres de juegos. Devuelve { nombre: {url,...} | null }
async function resolveImages(names, { concurrency = 4, log = true } = {}) {
  const cache = loadJSON(CACHE_FILE, {});
  const overrides = loadJSON(OVERRIDES_FILE, {});
  const keys = [...new Set(names.map(searchKey))];
  const retry = process.argv.includes('--reintentar');
  const todo = keys.filter(k => !(k in overrides) && (!(k in cache) || (retry && cache[k] === null)));
  if (log) console.log(`Portadas: ${keys.length} juegos distintos, ${todo.length} por buscar`);
  let done = 0, found = 0;
  const save = () => fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1));
  async function worker() {
    while (todo.length) {
      const k = todo.shift();
      const r = await findCover(k);
      cache[k] = r;
      if (r) found++;
      if (++done % 25 === 0) { save(); if (log) console.log(`  ${done} buscados, ${found} encontrados`); }
      await sleep(300);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  save();
  const out = {};
  for (const n of names) {
    const k = searchKey(n);
    out[n] = k in overrides ? (overrides[k] ? { url: overrides[k], src: 'manual' } : null) : cache[k] || null;
  }
  return out;
}

module.exports = { resolveImages, loadOverrides: () => loadJSON(OVERRIDES_FILE, {}), searchKey, similarity, steamHeader, urlExists, CACHE_FILE };

if (require.main === module) {
  (async () => {
    for (const n of process.argv.slice(2)) console.log(n, '=>', searchKey(n), JSON.stringify(await findCover(n)));
  })();
}
