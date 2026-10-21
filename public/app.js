/* Zona Gamer – catálogo */
(() => {
  const WHATSAPP = '5493513845195';
  const PAGE = 48;
  const SEGA_MIN = 10; // compra mínima de cartuchos Sega (según el proveedor)

  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$' + Math.round(n).toLocaleString('es-AR');
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const waLink = text => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  const TABS = [
    { id: 'todo', label: 'Todo' },
    { id: 'ps5', label: 'PS5', filter: p => p.platform === 'PS5' && p.category === 'juegos' },
    { id: 'ps4', label: 'PS4', filter: p => p.platform === 'PS4' && p.category === 'juegos' },
    { id: 'ps3', label: 'PS3', filter: p => p.platform === 'PS3' && p.category === 'juegos' },
    { id: 'promos', label: '🔥 Promos 2x1 / 3x1', promos: true },
    { id: 'preventas', label: 'Preventas', filter: p => p.category === 'preventas' },
    { id: 'tarjetas', label: 'Tarjetas y saldo', filter: p => p.category === 'codigos' },
    { id: 'accesorios', label: 'Accesorios', filter: p => p.category === 'accesorios' },
    { id: 'retro', label: 'Sega retro', filter: p => p.category === 'retro' },
    { id: 'instalar', label: '▶ Cómo instalar', page: 'howto' },
  ];

  const GC = {
    psplus: ['PlayStation Plus', 'linear-gradient(135deg,#1a1a1a,#3a3000 60%,#f5c400)'],
    psn: ['PlayStation Store', 'linear-gradient(135deg,#00246b,#0070d1)'],
    fortnite: ['Fortnite V-Bucks', 'linear-gradient(135deg,#2b0f6b,#7b2ff7 60%,#00b3ff)'],
    roblox: ['Roblox', 'linear-gradient(135deg,#111,#3b3b3b)'],
    steam: ['Steam', 'linear-gradient(135deg,#0b1424,#1b2838 50%,#2a475e)'],
    freefire: ['Free Fire', 'linear-gradient(135deg,#7a1d00,#ff6a00)'],
    valorant: ['Valorant', 'linear-gradient(135deg,#0f1923,#ff4655)'],
    lol: ['League of Legends', 'linear-gradient(135deg,#010a13,#0a323c 60%,#c89b3c)'],
    nintendo: ['Nintendo eShop', 'linear-gradient(135deg,#8a000b,#e60012)'],
    amazon: ['Amazon', 'linear-gradient(135deg,#131921,#232f3e 60%,#ff9900)'],
    xbox: ['Xbox', 'linear-gradient(135deg,#0b3d0b,#107c10)'],
    minecraft: ['Minecraft', 'linear-gradient(135deg,#2d5a1b,#5a9e2f)'],
    windows: ['Windows', 'linear-gradient(135deg,#003a75,#0078d4)'],
    apple: ['Apple Gift Card', 'linear-gradient(135deg,#111,#444)'],
  };

  let DATA = { products: [], promos: [], infos: {} };
  let state = { tab: 'todo', q: '', sort: 'rel', chips: new Set(), shown: PAGE };
  let cart = store.get('zg-cart', []);
  let lastOrder = null; // pedido recién enviado, para reabrir WhatsApp o recuperarlo
  let list = [];

  /* ---------- Imágenes ---------- */
  function placeholder(p) {
    const colors = { PS5: 'linear-gradient(160deg,#2a0000,#050505)', PS4: 'linear-gradient(160deg,#1c1c1c,#050505)', PS3: 'linear-gradient(160deg,#141414,#000)', Sega: 'linear-gradient(160deg,#2a0000,#000)' };
    const icon = p.category === 'accesorios' ? '🎮 ' : '';
    return `<div class="ph" style="--phbg:${colors[p.platform] || 'linear-gradient(160deg,#1a1a1a,#000)'}"><small>${esc(p.platform)}</small>${icon}${esc(p.name)}</div>`;
  }

  function giftAmount(p) {
    const n = p.name;
    let m;
    if ((m = n.match(/(\d+)\s*(MES(?:ES)?|meses|Mes)/i))) {
      const tier = (n.match(/ESENCIAL|ESSENTIAL|EXTRA|DELUXE|ULTIMATE|CORE/i) || [''])[0];
      return [`${m[1]} ${+m[1] === 1 ? 'mes' : 'meses'}`, tier ? tier[0] + tier.slice(1).toLowerCase() : ''];
    }
    if ((m = n.match(/(\d[\d.]*)\s*vBucks/i))) return [`${m[1]} V-Bucks`, ''];
    if ((m = n.match(/(\d+)\s*Diamantes/i))) return [`${m[1]} 💎`, 'Diamantes'];
    if ((m = n.match(/(\d+)\s*POINTS/i))) return [`${m[1]} VP`, 'Valorant Points'];
    if ((m = n.match(/(\d+)\s*RP/i))) return [`${m[1]} RP`, 'Riot Points'];
    if ((m = n.match(/\$?(\d+)\s*USD/i))) {
      const extra = (n.match(/\((\d+) Roblox/i) || [])[1];
      const region = (n.match(/ARGENTINA|USA|EEUU|GLOBAL/i) || [''])[0];
      return [`USD ${m[1]}`, extra ? `≈ ${extra} Robux` : region ? (region.toUpperCase() === 'EEUU' ? 'USA' : region[0] + region.slice(1).toLowerCase()) : ''];
    }
    if (/windows 11/i.test(n)) return ['Windows 11 Pro', 'Licencia original'];
    if (/minecraft/i.test(n)) return ['Java + Bedrock', 'PC'];
    return [n, ''];
  }

  function coverHTML(p, { big = false } = {}) {
    if (p.category === 'codigos') {
      const [brand, bg] = GC[p.brand] || [p.platform, '#333'];
      const [amount, small] = giftAmount(p);
      return `<div class="cover code"><div class="giftcard" style="--gc:${bg}"><div class="gc-brand">${esc(brand)}</div><div class="gc-amount">${esc(amount)}${small ? `<small>${esc(small)}</small>` : ''}</div></div></div>`;
    }
    const plat = /^PS[345]$/.test(p.platform) ? `<span class="plat ${p.platform}">${p.platform}</span>` : '';
    let tag = '';
    if (p.soldOut) tag = '<span class="tag out">AGOTADO</span>';
    else if (p.type === 'preventa') tag = '<span class="tag pre">PREVENTA</span>';
    else if (p.oldPrice) tag = `<span class="tag">-${Math.round((1 - p.price / p.oldPrice) * 100)}%</span>`;
    else if (p.isNew) tag = '<span class="tag new">NUEVO</span>';
    const img = p.image
      ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="${big ? 'eager' : 'lazy'}" referrerpolicy="no-referrer" data-ph="1">`
      : placeholder(p);
    return `<div class="cover${p.imageWide ? ' wide' : ''}">${img}${plat}${tag}</div>`;
  }

  // Si una imagen no carga, se reemplaza por la portada generada
  document.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    if (!img.dataset.ph) { img.remove(); return; }
    const p = byId.get(img.closest('[data-id]')?.dataset.id);
    img.outerHTML = p ? placeholder(p) : '';
  }, true);

  /* ---------- Listado ---------- */
  const byId = new Map();
  const PLAT_ORDER = { PS5: 0, PS4: 1, PS3: 2 };

  function subtitle(p) {
    if (p.category === 'codigos') return p.type === 'suscripcion' ? 'Se activa en tu cuenta' : 'Código digital';
    if (p.type === 'combo') return `Combo · ${p.includes?.length || ''} juegos`;
    if (p.category === 'accesorios') return 'Accesorio';
    if (p.category === 'retro') return (p.type === 'cartucho4en1' ? 'Cartucho 4 en 1' : 'Cartucho Sega') + ' · mín. 10';
    const bits = [];
    if (p.account) bits.push(`Cuenta ${p.account.toLowerCase()}`);
    if (p.retro) bits.push('Retro');
    if (p.language) bits.push(p.language.length > 22 ? p.language.slice(0, 20) + '…' : p.language);
    if (p.type === 'bundle') bits.unshift('Pack');
    return bits.join(' · ') || 'Digital';
  }

  function filtered() {
    const tab = TABS.find(t => t.id === state.tab);
    let out = DATA.products.filter(p => (tab.filter ? tab.filter(p) : true));
    const ch = state.chips;
    if (ch.has('oferta')) out = out.filter(p => p.oldPrice);
    if (ch.has('packs')) out = out.filter(p => p.type === 'bundle' || p.type === 'combo');
    if (ch.has('nuevos')) out = out.filter(p => p.isNew);
    if (ch.has('retro')) out = out.filter(p => p.retro);
    for (const c of ch) if (c.startsWith('brand:')) { const b = [...ch].filter(x => x.startsWith('brand:')).map(x => x.slice(6)); out = out.filter(p => b.includes(p.brand)); break; }
    if (state.q) {
      const words = norm(state.q).split(' ');
      out = out.filter(p => words.every(w => p._s.includes(w)));
    }
    const s = state.sort;
    const name = (a, b) => a.name.localeCompare(b.name, 'es');
    if (s === 'az') out.sort(name);
    else if (s === 'low') out.sort((a, b) => (a.price ?? 1e12) - (b.price ?? 1e12));
    else if (s === 'high') out.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    else out.sort((a, b) => b._rank - a._rank || (PLAT_ORDER[a.platform] ?? 9) - (PLAT_ORDER[b.platform] ?? 9) || name(a, b));
    return out;
  }

  function cardHTML(p) {
    const priced = p.price != null;
    const price = priced
      ? `<span class="price">${money(p.price)}</span>${p.oldPrice ? `<span class="old">${money(p.oldPrice)}</span>` : ''}`
      : '<span class="ask">Consultar precio</span>';
    return `<article class="card${p.soldOut ? ' soldout' : ''}" data-id="${esc(p.id)}">
      ${coverHTML(p)}
      <div class="card-body">
        <h3 class="card-title">${esc(p.name)}</h3>
        <div class="card-sub">${esc(subtitle(p))}</div>
        <div class="price-row">${price}</div>
        <div class="card-actions">
          ${p.soldOut ? '<button class="btn ghost" disabled>Agotado</button>' : `
          <a class="btn wa" data-act="ask" href="${waLink(askText(p))}" target="_blank" rel="noopener">${priced ? 'Pedir' : 'Consultar'}</a>
          ${priced ? '<button class="btn add" data-act="add" aria-label="Agregar al pedido" title="Agregar al pedido">＋</button>' : ''}`}
        </div>
      </div>
    </article>`;
  }

  function render() {
    const tab = TABS.find(t => t.id === state.tab);
    $('#tabs').innerHTML = TABS.map(t => `<button class="tab" data-tab="${t.id}" aria-current="${t.id === state.tab}">${t.label}</button>`).join('');
    renderChips(tab);

    const isPage = !!tab.page;
    $('#catalog').hidden = isPage;
    $('#howto').hidden = !isPage;
    if (isPage) { $('#promos').hidden = true; renderHowto(); return; }

    const promosEl = $('#promos');
    const showPromos = tab.promos || (state.tab === 'todo' && !state.q && !state.chips.size);
    promosEl.hidden = !showPromos || !DATA.promos.length;
    if (showPromos) promosEl.innerHTML = DATA.promos.map(promoCardHTML).join('');

    if (tab.promos) {
      list = [];
      $('#grid').innerHTML = '';
      $('#count').textContent = 'Elegí tus juegos y armá tu combo.';
      $('#more').hidden = true;
      $('#empty').hidden = true;
      return;
    }
    $('#notice').hidden = state.tab !== 'retro';
    list = filtered();
    $('#grid').innerHTML = list.slice(0, state.shown).map(cardHTML).join('');
    $('#count').textContent = `${list.length.toLocaleString('es-AR')} producto${list.length === 1 ? '' : 's'}`;
    $('#more').hidden = list.length <= state.shown;
    $('#empty').hidden = list.length > 0;
  }

  function renderChips(tab) {
    const chips = [];
    if (['todo', 'ps5', 'ps4', 'ps3', 'preventas'].includes(tab.id)) chips.push(['oferta', 'En oferta']);
    if (['todo', 'ps5', 'ps4', 'ps3'].includes(tab.id)) chips.push(['packs', 'Packs y combos']);
    if (tab.id === 'ps3') chips.push(['nuevos', 'Nuevos']);
    if (tab.id === 'ps5') chips.push(['retro', 'Retro']);
    if (tab.id === 'tarjetas') {
      const seen = new Set();
      for (const p of DATA.products) if (p.category === 'codigos' && !seen.has(p.brand)) { seen.add(p.brand); chips.push(['brand:' + p.brand, (GC[p.brand] || [p.platform])[0].replace(' V-Bucks', '')]); }
    }
    $('#chips').innerHTML = chips.map(([k, l]) => `<button class="chip" data-chip="${esc(k)}" aria-pressed="${state.chips.has(k)}">${esc(l)}</button>`).join('');
  }

  function more() {
    const from = state.shown;
    state.shown += PAGE;
    $('#grid').insertAdjacentHTML('beforeend', list.slice(from, state.shown).map(cardHTML).join(''));
    $('#more').hidden = list.length <= state.shown;
  }

  /* ---------- Detalle ---------- */
  function detailHTML(p) {
    const facts = [];
    facts.push(['Plataforma', p.platform]);
    if (p.account) facts.push(['Tipo de cuenta', p.account]);
    if (p.language) facts.push(['Idioma', p.language]);
    if (p.size) facts.push(['Peso', p.size]);
    if (p.details) facts.push(['Incluye', p.details]);
    let extra = '';
    if (p.account === 'Primaria') extra += `<div class="info"><p><b>¿Qué es una cuenta primaria?</b></p><p>Te damos una cuenta con el juego comprado. La configurás como principal en tu consola, descargás el juego y lo jugás con <b>tu propio usuario</b>, con tus trofeos y partidas guardadas.</p></div>`;
    if (p.retro) extra += `<div class="info"><p><b>Retro:</b> título de la línea Retro que ofrece Sony en la tienda de PlayStation.</p></div>`;
    if (p.category === 'retro') extra += `<div class="info"><p><b>Compra mínima: 10 cartuchos</b> (podés combinar distintos títulos).</p></div>`;
    if (p.type === 'preventa') extra += `<div class="info"><p><b>Preventa:</b> lo reservás ahora y lo recibís el día del lanzamiento.</p></div>`;
    if (p.includes?.length) extra += `<p><b>Incluye ${p.includes.length} juegos:</b></p><ul class="includes">${p.includes.map(i => `<li>${esc(i)}</li>`).join('')}</ul>${(p.notes || []).map(n => `<p class="muted">${esc(n)}</p>`).join('')}`;
    const vid = videoFor(p);
    if (vid) extra += `<div class="detail-video"><p><b>Ver cómo se canjea:</b></p>${ytButton(ytId(vid.youtube), vid.titulo)}</div>`;
    const info = DATA.infos[p.infoKey];
    if (info?.length) extra += `<div class="info">${info.map(t => `<p>${esc(t)}</p>`).join('')}</div>`;
    const priced = p.price != null;
    return `<button class="icon close" data-close aria-label="Cerrar">✕</button>
      <div class="modal-inner" data-id="${esc(p.id)}">
        ${coverHTML(p, { big: true })}
        <div>
          <h2>${esc(p.name)}</h2>
          <div class="price-row">${priced ? `<span class="price" style="font-size:28px">${money(p.price)}</span>${p.oldPrice ? `<span class="old">${money(p.oldPrice)}</span>` : ''}` : '<span class="ask">Consultar precio</span>'}</div>
          <ul class="facts">${facts.map(([k, v]) => `<li><span>${esc(k)}:</span> ${esc(v)}</li>`).join('')}</ul>
          ${extra}
          <div class="actions">
            ${p.soldOut ? '<button class="btn ghost" disabled>Agotado</button>' : `
            <a class="btn wa" href="${waLink(askText(p))}" target="_blank" rel="noopener">${priced ? 'Pedir por WhatsApp' : 'Consultar por WhatsApp'}</a>
            ${priced ? `<button class="btn ghost" data-add="${esc(p.id)}">Agregar al pedido</button>` : ''}`}
          </div>
        </div>
      </div>`;
  }

  function openDetail(id) {
    const p = byId.get(id);
    if (!p) return;
    const d = $('#detail');
    d.innerHTML = detailHTML(p);
    d.showModal();
  }

  /* ---------- Promos ---------- */
  function promoCardHTML(pr) {
    const imgs = pr.games.filter(g => g.image).slice(0, 5).map(g => `<img src="${esc(g.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join('');
    return `<div class="promo" data-promo="${esc(pr.id)}" role="button" tabindex="0">
      <span class="plat ${pr.platform}" style="position:static;align-self:flex-start">${pr.platform} · ${pr.pick}x1</span>
      <h3>${esc(pr.name)}</h3>
      <div class="stack">${imgs}</div>
      <div class="price-row"><span class="price">${money(pr.price)}</span><span class="muted">por los ${pr.pick} juegos</span></div>
      <span class="btn">Elegir juegos</span>
    </div>`;
  }

  let picking = null;
  function openPromo(id) {
    const pr = DATA.promos.find(x => x.id === id);
    if (!pr) return;
    picking = { pr, sel: [] };
    drawPromo();
    $('#promoDlg').showModal();
  }
  function drawPromo() {
    const { pr, sel } = picking;
    const full = sel.length >= pr.pick;
    $('#promoDlg').innerHTML = `
      <div class="pick-head">
        <button class="icon close" data-close aria-label="Cerrar">✕</button>
        <h2>${esc(pr.name)}</h2>
        <div class="muted">Elegí ${pr.pick} juegos · ${money(pr.price)} en total · Cuenta primaria</div>
      </div>
      <div class="pick-grid">${pr.games.map((g, i) => {
        const on = sel.includes(i);
        const img = g.image ? `<div class="cover"><img src="${esc(g.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>` : `<div class="cover">${placeholder({ name: g.name, platform: pr.platform })}</div>`;
        return `<button class="pick" data-pick="${i}" aria-pressed="${on}" ${g.soldOut || (full && !on) ? 'disabled' : ''}>${img}<div class="t">${esc(g.name)}${g.soldOut ? ' (agotado)' : ''}</div></button>`;
      }).join('')}</div>
      <div class="pick-foot">
        <strong>${sel.length} de ${pr.pick} elegidos</strong>
        <button class="btn wa" id="promoAdd" ${full ? '' : 'disabled'}>Agregar al pedido</button>
      </div>`;
  }

  /* ---------- Cómo instalar ---------- */
  let VIDEOS = null;
  function ytId(url) {
    const m = String(url || '').match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
    return m ? m[1] : null;
  }
  let videosReq = null;
  function loadVideos() {
    videosReq = videosReq || fetch('tutoriales/videos.json', { cache: 'no-cache' }).then(r => r.json())
      .then(d => { VIDEOS = d.videos || []; })
      .catch(() => { VIDEOS = []; });
    return videosReq;
  }
  function ytButton(id, title) {
    return `<button class="yt" data-yt="${id}" aria-label="Reproducir: ${esc(title)}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><span class="yt-play" aria-hidden="true"></span></button>`;
  }
  function videoCard(v) {
    const id = ytId(v.youtube);
    const media = id ? ytButton(id, v.titulo) : '<div class="yt soon"><span>Video próximamente</span></div>';
    return `<article class="video-card">${media}<div class="video-body"><span class="plat ${esc(v.consola)}" style="position:static">${esc(v.consola)}</span><h3>${esc(v.titulo)}</h3>${v.descripcion ? `<p class="muted">${esc(v.descripcion)}</p>` : ''}</div></article>`;
  }
  // Video de canje que corresponde a una tarjeta (PS Plus usa el de PlayStation)
  function videoFor(p) {
    if (!VIDEOS || p.category !== 'codigos') return null;
    const brand = p.brand === 'psplus' ? 'psn' : p.brand;
    return VIDEOS.find(v => v.marca === brand && ytId(v.youtube)) || null;
  }
  function renderHowto() {
    const el = $('#howto');
    if (!VIDEOS) {
      el.innerHTML = '<p class="count">Cargando videos…</p>';
      loadVideos().then(() => { if (state.tab === 'instalar') renderHowto(); });
      return;
    }
    const of = s => VIDEOS.filter(v => (v.seccion || 'instalar') === s).map(videoCard).join('');
    const install = of('instalar'), redeem = of('canjear');
    el.innerHTML = `
      <nav class="howto-nav"><a href="#" data-jump="h-instalar">Instalar juegos</a><a href="#" data-jump="h-canjear">Canjear tarjetas y códigos</a></nav>
      <h2 class="section-title" id="h-instalar">Cómo instalar tu juego</h2>
      <p class="count">Elegí tu consola y seguí el video paso a paso. Cuando compres, te mandamos por WhatsApp los datos de la cuenta.</p>
      <div class="videos">${install || '<p class="empty">Pronto vas a encontrar acá los videos.</p>'}</div>
      ${redeem ? `
      <h2 class="section-title" id="h-canjear" style="margin-top:34px">Cómo canjear tarjetas y códigos</h2>
      <p class="count">Te mandamos el código por WhatsApp. Estos videos muestran dónde ingresarlo en cada plataforma.</p>
      <div class="videos">${redeem}</div>` : ''}
      <div class="howto-help"><p>¿Te trabaste en algún paso? Te ayudamos.</p><a class="btn wa" target="_blank" rel="noopener" href="${waLink('¡Hola Zona Gamer! Necesito ayuda para instalar un juego o canjear un código.')}">Pedir ayuda por WhatsApp</a></div>`;
  }

  /* ---------- Carrito ---------- */
  function saveCart() { store.set('zg-cart', cart); drawCart(); }
  function addToCart(p) {
    const it = cart.find(x => x.key === p.id);
    if (it) it.qty++;
    else cart.push({ key: p.id, name: p.name, sub: lineSub(p), price: p.price, qty: 1, image: p.image || null });
    saveCart();
    toast(`Agregado: ${p.name}`);
  }
  function lineSub(p) {
    if (p.category === 'codigos') return p.platform;
    return [p.platform, p.account && `cuenta ${p.account.toLowerCase()}`, p.retro && 'retro'].filter(Boolean).join(' · ');
  }
  function drawCart() {
    const n = cart.reduce((s, x) => s + x.qty, 0);
    $('#cartCount').hidden = !n;
    $('#cartCount').textContent = n;
    $('#cartItems').innerHTML = cart.length ? cart.map((x, i) => `
      <div class="line">
        <div class="thumb">${x.image ? `<img src="${esc(x.image)}" alt="" referrerpolicy="no-referrer">` : ''}</div>
        <div><div class="n">${esc(x.name)}</div><div class="s">${esc(x.sub)}</div>
          <div class="qty"><button data-q="${i}" data-d="-1" aria-label="Quitar uno">−</button>${x.qty}<button data-q="${i}" data-d="1" aria-label="Sumar uno">+</button></div></div>
        <strong>${money(x.price * x.qty)}</strong>
      </div>`).join('') : '<p class="cart-empty">Todavía no agregaste nada.<br>Tocá ＋ en cualquier producto.</p>';
    $('#cartTotal').textContent = money(cart.reduce((s, x) => s + x.price * x.qty, 0));
    const sega = cart.filter(x => x.key.startsWith('sega-')).reduce((s, x) => s + x.qty, 0);
    const segaShort = sega > 0 && sega < SEGA_MIN;
    $('#cartWarn').hidden = !segaShort;
    if (segaShort) $('#cartWarn').textContent = `Cartuchos Sega: la compra mínima es de ${SEGA_MIN}. Llevás ${sega}, sumá ${SEGA_MIN - sega} más para poder enviar el pedido.`;
    $('#sendOrder').disabled = !cart.length || segaShort;
    $('#sentBox').hidden = !(lastOrder && !cart.length);
  }
  function orderText() {
    const lines = cart.map(x => `• ${x.qty > 1 ? x.qty + 'x ' : ''}${x.name}${x.sub ? ` (${x.sub})` : ''} — ${money(x.price * x.qty)}`);
    const total = cart.reduce((s, x) => s + x.price * x.qty, 0);
    return `¡Hola Zona Gamer! Quiero hacer este pedido:\n\n${lines.join('\n')}\n\n*Total: ${money(total)}*\n\n(Pedido desde la web)`;
  }
  function askText(p) {
    if (p.price == null) return `¡Hola Zona Gamer! Quería consultar por: ${p.name} (${p.platform}).`;
    return `¡Hola Zona Gamer! Quiero comprar:\n\n• ${p.name} (${lineSub(p)}) — ${money(p.price)}\n\n¿Está disponible?`;
  }
  function openCart(open) {
    $('#drawer').classList.toggle('open', open);
    $('#drawer').setAttribute('aria-hidden', String(!open));
    $('#scrim').hidden = !open;
  }

  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 1800);
  }

  /* ---------- Eventos ---------- */
  function setTab(id) {
    state.tab = id; state.chips = new Set(); state.shown = PAGE;
    history.replaceState(null, '', id === 'todo' ? location.pathname : '#' + id);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('click', e => {
    const t = e.target;
    const tab = t.closest('[data-tab]');
    if (tab) return setTab(tab.dataset.tab);
    const chip = t.closest('[data-chip]');
    if (chip) {
      const k = chip.dataset.chip;
      state.chips.has(k) ? state.chips.delete(k) : state.chips.add(k);
      state.shown = PAGE;
      return render();
    }
    if (t.closest('[data-close]')) return t.closest('dialog').close();
    if (t.matches('dialog')) return t.close(); // click afuera del modal
    const add = t.closest('[data-act="add"]');
    if (add) { addToCart(byId.get(add.closest('[data-id]').dataset.id)); return; }
    if (t.closest('[data-act="ask"]')) return;
    const addD = t.closest('[data-add]');
    if (addD) { addToCart(byId.get(addD.dataset.add)); $('#detail').close(); return; }
    const card = t.closest('.card');
    if (card) return openDetail(card.dataset.id);
    const promo = t.closest('[data-promo]');
    if (promo) return openPromo(promo.dataset.promo);
    const pick = t.closest('[data-pick]');
    if (pick && picking) {
      const i = +pick.dataset.pick;
      const at = picking.sel.indexOf(i);
      at >= 0 ? picking.sel.splice(at, 1) : picking.sel.push(i);
      return drawPromo();
    }
    if (t.closest('#promoAdd') && picking) {
      const { pr, sel } = picking;
      const games = sel.map(i => pr.games[i].name);
      cart.push({ key: pr.id + ':' + sel.sort((a, b) => a - b).join('-'), name: `Promo ${pr.pick}x1 ${pr.platform}`, sub: games.join(' + '), price: pr.price, qty: 1, image: pr.games[sel[0]].image || null });
      saveCart();
      $('#promoDlg').close();
      toast('Promo agregada al pedido');
      return;
    }
    const jump = t.closest('[data-jump]');
    if (jump) { e.preventDefault(); document.getElementById(jump.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const yt = t.closest('[data-yt]');
    if (yt) {
      yt.outerHTML = `<div class="yt"><iframe src="https://www.youtube-nocookie.com/embed/${yt.dataset.yt}?autoplay=1&rel=0" title="Video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
      return;
    }
    const q = t.closest('[data-q]');
    if (q) {
      const it = cart[+q.dataset.q];
      it.qty += +q.dataset.d;
      if (it.qty <= 0) cart.splice(+q.dataset.q, 1);
      return saveCart();
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('[data-promo]')) openPromo(e.target.dataset.promo);
    if (e.key === 'Escape') openCart(false);
  });

  let qT;
  $('#q').addEventListener('input', e => {
    clearTimeout(qT);
    qT = setTimeout(() => {
      state.q = e.target.value.trim();
      state.shown = PAGE;
      if (state.q && TABS.find(t => t.id === state.tab).promos) state.tab = 'todo';
      render();
    }, 150);
  });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; state.shown = PAGE; render(); });
  $('#more').addEventListener('click', more);
  // Al cerrar la ficha se corta el video que estuviera sonando
  $('#detail').addEventListener('close', () => { $('#detail').innerHTML = ''; });
  $('#cartBtn').addEventListener('click', () => openCart(true));
  $('#closeCart').addEventListener('click', () => openCart(false));
  $('#scrim').addEventListener('click', () => openCart(false));
  $('#clearCart').addEventListener('click', () => { cart = []; lastOrder = null; saveCart(); });
  // Al enviar: se abre WhatsApp y el carrito se vacía (se puede reabrir o recuperar)
  $('#sendOrder').addEventListener('click', () => {
    const text = orderText();
    window.open(waLink(text), '_blank', 'noopener');
    lastOrder = { text, items: cart };
    cart = [];
    saveCart();
  });
  $('#resend').addEventListener('click', e => { e.preventDefault(); if (lastOrder) window.open(waLink(lastOrder.text), '_blank', 'noopener'); });
  $('#restore').addEventListener('click', e => { e.preventDefault(); if (lastOrder) { cart = lastOrder.items; lastOrder = null; saveCart(); } });

  // Carga automática al llegar al final
  new IntersectionObserver(es => { if (es[0].isIntersecting && !$('#more').hidden) more(); }, { rootMargin: '600px' }).observe($('#more'));

  const hello = waLink('¡Hola Zona Gamer! Quería hacer una consulta.');
  ['#heroWa', '#footWa', '#emptyWa'].forEach(s => { $(s).href = hello; });

  /* ---------- Inicio ---------- */
  fetch('data/catalogo.json', { cache: 'no-cache' })
    .then(r => r.json())
    .then(d => {
      DATA = d;
      for (const p of DATA.products) {
        byId.set(p.id, p);
        p._s = norm(`${p.name} ${p.platform} ${p.brand || ''} ${(p.includes || []).join(' ')}`);
        p._rank = (p.image ? 3 : 0) + (p.oldPrice ? 2 : 0) + (p.type === 'preventa' ? 1 : 0) - (p.soldOut ? 5 : 0) - (p.price == null ? 1 : 0);
      }
      if (d.updated) $('#updated').textContent = 'Precios actualizados: ' + new Date(d.updated).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      const fromHash = location.hash.slice(1);
      if (TABS.some(t => t.id === fromHash)) state.tab = fromHash;
      render();
      drawCart();
      loadVideos(); // para mostrar el video de canje en la ficha de cada tarjeta
    })
    .catch(() => { $('#count').textContent = 'No se pudo cargar el catálogo. Probá recargar la página.'; });
})();
