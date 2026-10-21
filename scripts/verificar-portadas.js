// Revisa que cada portada guardada siga cargando; arregla o descarta las rotas.
const fs = require('fs');
const { steamHeader, urlExists, CACHE_FILE } = require('./images');

(async () => {
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  const keys = Object.keys(cache).filter(k => cache[k]);
  let broken = 0, fixed = 0;
  async function worker() {
    while (keys.length) {
      const k = keys.pop();
      const v = cache[k];
      if (await urlExists(v.url)) continue;
      broken++;
      const id = (v.url.match(/steam\/apps\/(\d+)\//) || [])[1];
      const h = id && (await steamHeader(id));
      if (h) { cache[k] = { ...v, url: h, wide: true }; fixed++; }
      else cache[k] = null;
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1));
  console.log(`Portadas rotas: ${broken}, arregladas: ${fixed}, descartadas: ${broken - fixed}`);
})();
