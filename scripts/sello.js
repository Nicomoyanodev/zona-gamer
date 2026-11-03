// Cloudflare guarda app.js y styles.css por horas: se agrega ?v=<hash> para que
// cuando cambian, los navegadores bajen la versión nueva enseguida.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function stampAssets(dir) {
  const file = path.join(dir, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  for (const asset of ['styles.css', 'sucursal.js', 'app.js']) {
    const v = crypto.createHash('md5').update(fs.readFileSync(path.join(dir, asset))).digest('hex').slice(0, 8);
    html = html.replace(new RegExp(`(["'])${asset.replace('.', '\\.')}(\\?v=[\\w]+)?\\1`), `$1${asset}?v=${v}$1`);
  }
  fs.writeFileSync(file, html);
}

module.exports = { stampAssets };
