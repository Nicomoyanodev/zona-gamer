// Lee el Excel del proveedor y lo convierte en una lista de productos limpia.
const XLSX = require('xlsx');

const MARGIN = 2; // precio de venta = costo x 2 (100% de ganancia)

const num = v => (typeof v === 'number' && v > 0 ? v : null);
const str = v => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());
const sell = cost => (cost ? Math.round((cost * MARGIN) / 100) * 100 : null); // redondeo a $100

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function rows(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const out = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    const fill = [];
    for (let c = 0; c <= Math.max(range.e.c, 8); c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      row.push(cell ? cell.v : null);
      fill.push(cell && cell.s && cell.s.fgColor ? cell.s.fgColor.rgb : null);
    }
    if (row.some(v => str(v) !== '')) out.push({ row, fill, n: r + 1 });
  }
  return out;
}

// Celda pintada de rojo = juego agotado (según la referencia del proveedor)
const isRed = rgb => !!rgb && /^(FF)?FF0000$/i.test(rgb);

function priceFrom(primario, oferta) {
  const p = sell(num(primario));
  const o = sell(num(oferta));
  if (p && o && o < p) return { price: o, oldPrice: p };
  return { price: p || o || null, oldPrice: null };
}

function cleanGameTitle(t) {
  return str(t).replace(/\s+RETRO$/i, '').replace(/\s{2,}/g, ' ').trim();
}

// ---------- PS4 / PS5 ----------
function parseConsoleSheet(wb, sheet, platform) {
  const items = [];
  let section = 'juegos';
  for (const { row, fill } of rows(wb, sheet)) {
    const title = str(row[2]);
    if (!title) continue;
    if (/^(TITULO|Ofertas Especiales)$/i.test(title)) {
      section = /Ofertas/i.test(title) ? 'bundle' : 'juegos';
      continue;
    }
    if (/^(Consola|PS\d)$/i.test(title)) continue;
    const retro = /\bRETRO\s*$/i.test(title);
    const { price, oldPrice } = priceFrom(row[3], row[4]);
    if (!price) continue;
    const name = cleanGameTitle(title);
    items.push({
      id: `${slug(platform)}-${slug(name)}${retro ? '-retro' : ''}`,
      name,
      platform,
      category: 'juegos',
      type: section === 'bundle' ? 'bundle' : 'juego',
      account: /secundari/i.test(title) ? 'Secundaria' : 'Primaria',
      price,
      oldPrice,
      retro,
      details: str(row[5]) || null,
      soldOut: isRed(fill[2]),
    });
  }
  return items;
}

// ---------- PS3 ----------
function parsePS3(wb) {
  const items = [];
  for (const { row, fill } of rows(wb, 'PS3')) {
    const name = str(row[1]);
    if (!name || /^TITULO$/i.test(name)) continue;
    const price = sell(num(row[2]) || num(row[3]));
    if (!price) continue;
    const extra = str(row[6]);
    items.push({
      id: `ps3-${slug(name)}`,
      name,
      platform: 'PS3',
      category: 'juegos',
      type: /\(\d+ en 1\)|combo/i.test(name) ? 'bundle' : 'juego',
      price,
      oldPrice: null,
      isNew: /nuevo/i.test(str(row[0])),
      size: str(row[4]).replace(/[.,]$/, '') || null,
      language: str(row[5]) || null,
      details: extra && !/^idioma/i.test(extra) ? extra : null,
      soldOut: isRed(fill[1]),
    });
  }
  return items;
}

// ---------- PS3 COMBOS ----------
function parsePS3Combos(wb) {
  const items = [];
  let cur = null;
  for (const { row } of rows(wb, 'PS3 COMBOS')) {
    const text = str(row[0]);
    const price = num(row[1]);
    if (!text) continue;
    if (price) {
      cur = {
        id: `ps3-combo-${slug(text)}`,
        name: text,
        platform: 'PS3',
        category: 'juegos',
        type: 'combo',
        price: sell(price),
        oldPrice: null,
        includes: [],
        notes: [],
      };
      items.push(cur);
    } else if (cur && /^[•·\-*]/.test(text)) {
      cur.includes.push(text.replace(/^[•·\-*]\s*/, ''));
    } else if (cur) {
      const m = text.match(/^tama[ñn]o:?\s*(.*)$/i);
      if (m) cur.size = m[1];
      else cur.notes.push(text);
    }
  }
  return items;
}

// ---------- Promos 3x1 / 2x1 ----------
function parsePromo(wb, sheet, { platform, pick, label }) {
  const list = rows(wb, sheet);
  let groupCost = null;
  const games = [];
  for (const { row, fill } of list) {
    const name = str(row[2]) || (num(row[2]) ? '' : '');
    if (!name || /TITULOS A ELECCION/i.test(name)) continue;
    const cost = num(row[3]);
    if (cost) groupCost = groupCost || cost;
    games.push({ name: cleanGameTitle(name), soldOut: isRed(fill[2]) || /agotado/i.test(str(row[4])) });
  }
  if (!games.length) return null;
  return {
    id: `promo-${slug(sheet)}`,
    name: label,
    platform,
    pick,
    price: sell(groupCost),
    games,
  };
}

// ---------- Preventas ----------
function parsePreventas(wb) {
  const items = [];
  for (const { row } of rows(wb, 'PREVENTAS')) {
    const title = str(row[2]);
    if (!title || /^Descripcion$/i.test(title)) continue;
    const { price, oldPrice } = priceFrom(row[3], row[4]);
    if (!price) continue;
    const plat = (title.match(/\bPS[345]\b/i) || [str(row[1]) || 'PS5'])[0].toUpperCase();
    const name = title.replace(/\s+PS[345]\s*$/i, '').trim();
    items.push({
      id: `preventa-${slug(name)}-${slug(plat)}`,
      name,
      platform: /^PS[345]$/.test(plat) ? plat : 'PS5',
      category: 'preventas',
      type: 'preventa',
      account: 'Primaria',
      price,
      oldPrice,
    });
  }
  return items;
}

// ---------- Códigos y tarjetas ----------
const BRANDS = [
  [/PS PLUS/i, 'psplus', 'PlayStation Plus'],
  [/PSN/i, 'psn', 'PlayStation Store'],
  [/FORTNITE/i, 'fortnite', 'Fortnite'],
  [/ROBLOX/i, 'roblox', 'Roblox'],
  [/STEAM/i, 'steam', 'Steam'],
  [/FREE FIRE/i, 'freefire', 'Free Fire'],
  [/RIOT/i, 'riot', 'Riot Games'],
  [/NINTENDO/i, 'nintendo', 'Nintendo eShop'],
  [/AMAZON/i, 'amazon', 'Amazon'],
  [/XBOX/i, 'xbox', 'Xbox'],
  [/SOF[TW]?WARE/i, 'windows', 'Software'],
  [/ITUNES/i, 'apple', 'Apple / iTunes'],
];

function brandOf(name, fallback) {
  if (/valorant/i.test(name)) return { brand: 'valorant', brandName: 'Valorant' };
  if (/league of legends/i.test(name)) return { brand: 'lol', brandName: 'League of Legends' };
  if (/minecraft/i.test(name)) return { brand: 'minecraft', brandName: 'Minecraft' };
  return fallback;
}

function parseCodigos(wb) {
  const items = [];
  let section = null;
  let pendingPrice = null;
  const list = rows(wb, 'CODIGOS');
  for (let i = 0; i < list.length; i++) {
    const { row } = list[i];
    const name = str(row[1]);
    const price = num(row[2]);
    const note = [3, 4, 5].map(c => str(row[c])).filter(Boolean);

    const header = name && !price && BRANDS.find(([re]) => re.test(name)) &&
      (/^(PRODUCTOS|FORTNITE|ROBLOX|STEAM|FREE FIRE|RIOTS?|Nintendo E-Shop|AMAZON|XBOX|SOFWARE|SOFTWARE|ITUNES)/i.test(name));
    if (header) {
      const [, brand, brandName] = BRANDS.find(([re]) => re.test(name));
      section = { brand, brandName, info: [], items: [] };
      section.info.push(...note);
      continue;
    }
    if (!section) continue;
    if (note.length) section.info.push(...note);

    if (!name && price) { pendingPrice = price; continue; }
    if (!name) continue;
    // Línea de continuación del nombre (ej. "(PC) Windows Store")
    if (!price && !pendingPrice && section.items.length && /^\(/.test(name)) {
      section.items[section.items.length - 1].name += ' ' + name;
      continue;
    }
    const cost = price || pendingPrice;
    pendingPrice = null;
    const b = brandOf(name, section);
    const it = {
      id: `codigo-${slug(name)}`,
      name: name.replace(/\s+/g, ' '),
      platform: b.brandName,
      brand: b.brand,
      category: 'codigos',
      type: section.brand === 'psplus' ? 'suscripcion' : 'codigo',
      price: sell(cost),
      oldPrice: null,
      section,
    };
    section.items.push(it);
    items.push(it);
  }
  // Las instrucciones quedan una sola vez por marca
  const infos = {};
  for (const it of items) {
    infos[it.section.brand] = it.section.info.filter(t => !/^IMPORTANTE:?$/i.test(t));
    it.infoKey = it.section.brand;
    delete it.section;
  }
  return { items, infos };
}

// ---------- Accesorios ----------
function parseAccesorios(wb) {
  const items = [];
  for (const { row } of rows(wb, 'ACCSESORIOS')) {
    const name = str(row[0]);
    if (!name || /^(PS\d|JOYSTICK (PS-?\d|XBOX 360))$/i.test(name)) continue;
    const plat = (name.match(/PS-?\s?([2-5])/i) || [])[1];
    items.push({
      id: `acc-${slug(name)}`,
      name: name.replace(/\b([a-z])/g, m => m.toUpperCase()).replace(/Ps-?(\d)/gi, 'PS$1'),
      platform: plat ? `PS${plat}` : /xbox/i.test(name) ? 'Xbox 360' : 'Accesorios',
      category: 'accesorios',
      type: 'accesorio',
      price: sell(num(row[1])),
      oldPrice: null,
    });
  }
  return items;
}

// ---------- Sega ----------
function parseSega(wb) {
  const items = [];
  for (const { row } of rows(wb, 'SEGA')) {
    for (const [nc, pc] of [[1, 2], [4, 5]]) {
      const name = str(row[nc]);
      const cost = num(row[pc]);
      if (!name || !cost) continue;
      items.push({
        id: `sega-${slug(name)}`,
        name: name.split('/').map(s => s.trim()).join(' / '),
        platform: 'Sega',
        category: 'retro',
        type: /\//.test(name) ? 'cartucho4en1' : 'cartucho',
        price: sell(cost),
        oldPrice: null,
      });
    }
  }
  return items;
}

function dedupe(items) {
  const seen = new Map();
  for (const it of items) {
    let id = it.id, k = 2;
    while (seen.has(id)) id = `${it.id}-${k++}`;
    it.id = id;
    seen.set(id, it);
  }
  return items;
}

function parseWorkbook(file) {
  const wb = XLSX.readFile(file, { cellStyles: true });
  const codigos = parseCodigos(wb);
  const products = dedupe([
    ...parseConsoleSheet(wb, 'PS5', 'PS5'),
    ...parseConsoleSheet(wb, 'PS4', 'PS4'),
    ...parsePS3(wb),
    ...parsePS3Combos(wb),
    ...parsePreventas(wb),
    ...codigos.items,
    ...parseAccesorios(wb),
    ...parseSega(wb),
  ]);
  const promos = [
    parsePromo(wb, '2X1 PS5', { platform: 'PS5', pick: 2, label: '2 juegos PS5 a elección' }),
    parsePromo(wb, 'PS4 3X1 $35', { platform: 'PS4', pick: 3, label: '3 juegos PS4 a elección' }),
    parsePromo(wb, 'PS4 3 X 70K', { platform: 'PS4', pick: 3, label: '3 juegos PS4 a elección (Premium)' }),
  ].filter(Boolean);
  return { products, promos, infos: codigos.infos, sheets: wb.SheetNames };
}

module.exports = { parseWorkbook, slug };

if (require.main === module) {
  const r = parseWorkbook(process.argv[2]);
  const by = {};
  for (const p of r.products) by[p.platform + '/' + p.type] = (by[p.platform + '/' + p.type] || 0) + 1;
  console.log('Hojas:', r.sheets.join(', '));
  console.log('Productos:', r.products.length, by);
  console.log('Promos:', r.promos.map(p => `${p.name}: ${p.games.length} juegos, $${p.price}`));
  console.log('Sin precio:', r.products.filter(p => !p.price).map(p => p.name).join(' | '));
  console.log(JSON.stringify(r.products.filter(p => p.category === 'codigos').map(p => [p.brand, p.name, p.price])));
  console.log(JSON.stringify(r.infos.windows));
}
