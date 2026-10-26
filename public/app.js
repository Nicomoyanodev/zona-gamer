/* Zona Gamer – catálogo */
(() => {
  const WHATSAPP = '5493513845195';
  const PAGE = 48;
  // Cuotas sin interés por tipo de juego
  const CUOTAS = { digital: 3, fisico: 6 };
  const cuotasDe = p => (p.category === 'fisicos' ? CUOTAS.fisico : ['juegos', 'preventas'].includes(p.category) ? CUOTAS.digital : 0);
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
    { id: 'todo', label: 'Todo', filter: p => p.category !== 'fisicos' },
    { id: 'ps5', label: 'PS5', filter: p => p.platform === 'PS5' && p.category === 'juegos' },
    { id: 'ps4', label: 'PS4', filter: p => p.platform === 'PS4' && p.category === 'juegos' },
    { id: 'ps3', label: 'PS3', filter: p => p.platform === 'PS3' && p.category === 'juegos' },
    { id: 'promos', label: '🔥 Promos 2x1 / 3x1', promos: true },
    { id: 'preventas', label: 'Preventas', filter: p => p.category === 'preventas' },
    { id: 'tarjetas', label: 'Tarjetas y saldo', filter: p => p.category === 'codigos' },
    { id: 'accesorios', label: 'Accesorios', filter: p => p.category === 'accesorios' },
    { id: 'retro', label: 'Sega retro', filter: p => p.category === 'retro' },
    { id: 'instalar', label: '▶ Cómo instalar', page: 'howto' },
    // Juegos físicos
    { id: 'f-todo', mode: 'fisico', label: 'Todo', filter: p => p.category === 'fisicos' },
    { id: 'f-promos', mode: 'fisico', label: '🔥 Promos PS4 usados', promos: true },
    { id: 'f-ps5', mode: 'fisico', label: 'PS5', filter: p => p.category === 'fisicos' && p.platform === 'PS5' },
    { id: 'f-ps4', mode: 'fisico', label: 'PS4', filter: p => p.category === 'fisicos' && p.platform === 'PS4' },
    { id: 'f-ps3', mode: 'fisico', label: 'PS3', filter: p => p.category === 'fisicos' && p.platform === 'PS3' },
    { id: 'f-switch', mode: 'fisico', label: 'Nintendo Switch', filter: p => p.category === 'fisicos' && (p.platform === 'Switch' || p.platform === '3DS') },
    { id: 'f-xone', mode: 'fisico', label: 'Xbox One', filter: p => p.category === 'fisicos' && p.platform === 'Xbox One' },
    { id: 'f-x360', mode: 'fisico', label: 'Xbox 360', filter: p => p.category === 'fisicos' && p.platform === 'Xbox 360' },
  ];
  const modeOf = t => t.mode || 'digital';

  // Promos de juegos físicos (se arman con el stock del catálogo)
  const usadoPS4 = p => p.category === 'fisicos' && p.platform === 'PS4' && p.condition === 'Usado';
  const PROMOS_FIS_DEF = [
    { id: 'pf-3x85', name: '3 juegos PS4 usados a elección', badge: '3 x $85.000', pick: 3, price: 85000, filter: usadoPS4 },
    // Solo los juegos con 3 o más unidades en stock
    { id: 'pf-5x100', name: '5 juegos PS4 usados seleccionados', badge: '5 x $100.000', pick: 5, price: 100000, filter: p => usadoPS4(p) && p.stock >= 3 },
  ];
  let FIS_PROMOS = [];
  const promosOf = mode => (mode === 'fisico' ? FIS_PROMOS : DATA.promos);
  const allPromos = () => [...DATA.promos, ...FIS_PROMOS];

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
  let state = { mode: 'digital', tab: 'todo', q: '', sort: 'rel', chips: new Set(), shown: PAGE };
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
    const plat = /^(PS[345]|Switch|3DS|Xbox One|Xbox 360)$/.test(p.platform) ? `<span class="plat ${p.platform.replace(/\s/g, '')}">${p.platform}</span>` : '';
    let tag = '';
    if (p.soldOut) tag = '<span class="tag out">AGOTADO</span>';
    else if (p.type === 'preventa') tag = '<span class="tag pre">PREVENTA</span>';
    else if (p.oldPrice) tag = `<span class="tag">-${Math.round((1 - p.price / p.oldPrice) * 100)}%</span>`;
    else if (p.category === 'fisicos' && p.stock === 1) tag = '<span class="tag last">ÚLTIMA UNIDAD</span>';
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
  const PLAT_ORDER = { PS5: 0, PS4: 1, PS3: 2, Switch: 3, '3DS': 4, 'Xbox One': 5, 'Xbox 360': 6 };

  function subtitle(p) {
    if (p.category === 'codigos') return p.type === 'suscripcion' ? 'Se activa en tu cuenta' : 'Código digital';
    if (p.type === 'combo') return `Combo · ${p.includes?.length || ''} juegos`;
    if (p.category === 'fisicos') return `Físico · ${p.condition}`;
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
    if (ch.has('cond:Nuevo') !== ch.has('cond:Usado')) out = out.filter(p => p.condition === (ch.has('cond:Nuevo') ? 'Nuevo' : 'Usado'));
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

  const canOrder = p => p.price != null || p.category === 'fisicos';

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
        ${priced && cuotasDe(p) ? `<div class="cuota">${cuotasDe(p)} cuotas sin interés de <b>${money(p.price / cuotasDe(p))}</b></div>` : ''}
        <div class="card-actions">
          ${p.soldOut ? '<button class="btn ghost" disabled>Agotado</button>' : `
          <a class="btn wa" data-act="ask" href="${waLink(askText(p))}" target="_blank" rel="noopener">${priced ? 'Pedir' : 'Consultar'}</a>
          ${canOrder(p) ? '<button class="btn add" data-act="add" aria-label="Agregar al pedido" title="Agregar al pedido">＋</button>' : ''}`}
        </div>
      </div>
    </article>`;
  }

  function render() {
    const tab = TABS.find(t => t.id === state.tab);
    $('#tabs').innerHTML = TABS.filter(t => modeOf(t) === state.mode).map(t => `<button class="tab" data-tab="${t.id}" aria-current="${t.id === state.tab}">${t.label}</button>`).join('');
    document.querySelectorAll('.mode-btn').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === state.mode)));
    const fis = state.mode === 'fisico';
    const nC = fis ? CUOTAS.fisico : CUOTAS.digital;
    const card = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2v2h16V7H4Zm0 5v5h16v-5H4Zm2 2h5v1.5H6V14Z"/></svg>';
    $('#cuotasStrip').innerHTML = `${card}<span>Todos los juegos ${fis ? 'físicos' : 'digitales'} <b>${nC} cuotas sin interés</b></span>`;
    $('#cuotasStrip').classList.toggle('fis', fis);
    $('#cuotasBadge').innerHTML = `<b>${nC}</b><span>cuotas<br>sin interés</span>`;
    $('#cuotasBadge').classList.toggle('fis', fis);
    $('#heroTitle').innerHTML = fis ? 'Juegos físicos <em>nuevos y usados</em>' : 'Juegos digitales <em>PS5 · PS4 · PS3</em> y tarjetas de saldo';
    $('#heroText').textContent = fis
      ? 'Stock real del local en Nuevocentro Shopping. Pedilo por WhatsApp y te lo reservamos.'
      : 'Elegí lo que quieras, armá tu pedido y mandalo por WhatsApp. Te respondemos al toque.';
    $('#q').placeholder = fis ? 'Buscar juego físico…' : 'Buscar juego, tarjeta…';
    renderChips(tab);

    const isPage = !!tab.page;
    $('#catalog').hidden = isPage;
    $('#howto').hidden = !isPage;
    if (isPage) { $('#promos').hidden = true; renderHowto(); return; }

    const searching = !!state.q;
    $('#hero').hidden = searching;
    $('#searchHead').hidden = !searching;
    $('#altDigital').hidden = true;

    const promosEl = $('#promos');
    const promos = promosOf(state.mode);
    const promoHome = state.mode === 'fisico' ? ['f-todo', 'f-ps4'].includes(state.tab) : state.tab === 'todo';
    const showPromos = tab.promos || (promoHome && !state.q && ![...state.chips].some(c => c !== 'cond:Usado'));
    promosEl.hidden = !showPromos || !promos.length;
    if (showPromos) promosEl.innerHTML = promos.map(promoCardHTML).join('');

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
    $('#count').textContent = searching ? '' : `${list.length.toLocaleString('es-AR')} producto${list.length === 1 ? '' : 's'}`;
    if (searching) renderSearchHead();
    $('#more').hidden = list.length <= state.shown;

    // Físico sin stock: mostrar la versión digital en el mismo lugar
    const alt = searching && state.mode === 'fisico' && !list.length ? digitalMatches() : [];
    $('#altDigital').hidden = !alt.length;
    document.querySelector('.toolbar').hidden = alt.length > 0;
    if (alt.length) {
      $('#altDigital').innerHTML = `
        <div class="alt-head">
          <p class="alt-title">No tenemos <b>“${esc(state.q)}”</b> en físico, <span>¡pero lo tenemos en digital!</span></p>
          <p class="muted">Te llega por WhatsApp y lo jugás con tu propio usuario.</p>
        </div>
        <div class="grid">${alt.slice(0, 8).map(cardHTML).join('')}</div>
        ${alt.length > 8 ? `<div class="more"><button class="btn ghost" data-switch="digital">Ver los ${alt.length} resultados en digitales</button></div>` : ''}`;
    }
    $('#empty').hidden = list.length > 0 || alt.length > 0;
  }

  // Juegos digitales que coinciden con la búsqueda, los más relevantes primero
  function digitalMatches() {
    const words = norm(state.q).split(' ');
    return DATA.products
      .filter(p => p.category !== 'fisicos' && words.every(w => p._s.includes(w)))
      .sort((a, b) => b._rank - a._rank || (PLAT_ORDER[a.platform] ?? 9) - (PLAT_ORDER[b.platform] ?? 9) || a.name.localeCompare(b.name, 'es'));
  }

  // Encabezado de resultados: cantidad, promos que incluyen el juego y resultados en la otra sección
  function renderSearchHead() {
    const n = list.length;
    $('#searchTitle').innerHTML = n
      ? `<b>${n.toLocaleString('es-AR')}</b> resultado${n === 1 ? '' : 's'} para <b>“${esc(state.q)}”</b>`
      : (state.mode === 'fisico' ? `Sin stock físico de <b>“${esc(state.q)}”</b>` : `No encontramos <b>“${esc(state.q)}”</b> en juegos digitales`);
    const words = norm(state.q).split(' ');
    const hints = [];
    const promos = promosOf(state.mode).filter(pr => pr.games.some(g => words.every(w => norm(g.name).includes(w))));
    if (promos.length) hints.push(`<div class="hint promo-hint"><span>🔥 También en promo:</span>${promos.map(pr => `<button class="mini" data-promo="${esc(pr.id)}">${pr.fisico ? `${pr.badge} PS4 usados` : `${pr.pick}x1 ${pr.platform} · ${money(pr.price)}`}</button>`).join('')}</div>`);
    const other = state.mode === 'fisico' ? 'digital' : 'fisico';
    const inOther = DATA.products.filter(p => (p.category === 'fisicos') === (other === 'fisico') && words.every(w => p._s.includes(w))).length;
    const altShown = state.mode === 'fisico' && !list.length;
    if (inOther && !altShown) hints.push(`<div class="hint"><span>También en ${other === 'fisico' ? 'físicos' : 'digitales'}:</span><button class="mini" data-switch="${other}">Ver ${inOther} resultado${inOther === 1 ? '' : 's'}</button></div>`);
    $('#searchHints').innerHTML = hints.join('');
  }

  function clearSearch() {
    $('#q').value = '';
    state.q = '';
    state.shown = PAGE;
    syncQueryParam();
    render();
  }

  function syncQueryParam() {
    const url = new URL(location.href);
    if (state.q) url.searchParams.set('q', state.q); else url.searchParams.delete('q');
    history.replaceState(null, '', url);
  }

  function renderChips(tab) {
    const chips = [];
    if (['todo', 'ps5', 'ps4', 'ps3', 'preventas'].includes(tab.id)) chips.push(['oferta', 'En oferta']);
    if (['todo', 'ps5', 'ps4', 'ps3'].includes(tab.id)) chips.push(['packs', 'Packs y combos']);
    if (tab.id === 'ps3') chips.push(['nuevos', 'Nuevos']);
    if (tab.mode === 'fisico') chips.push(['cond:Nuevo', 'Nuevos'], ['cond:Usado', 'Usados']);
    if (tab.id === 'ps5') chips.push(['retro', 'Retro']);
    if (tab.id === 'tarjetas') {
      const seen = new Set();
      for (const p of DATA.products) if (p.category === 'codigos' && !seen.has(p.brand)) { seen.add(p.brand); chips.push(['brand:' + p.brand, (GC[p.brand] || [p.platform])[0].replace(' V-Bucks', '')]); }
    }
    if (state.q) chips.length = 0;
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
    if (p.category === 'fisicos') facts.push(['Formato', 'Físico'], ['Estado', p.condition], ['Stock', p.stock === 1 ? '¡Última unidad!' : 'Disponible']);
    if (p.language) facts.push(['Idioma', p.language]);
    if (p.size) facts.push(['Peso', p.size]);
    if (p.details) facts.push(['Incluye', p.details]);
    let extra = '';
    if (p.account === 'Primaria') extra += `<div class="info"><p><b>¿Qué es una cuenta primaria?</b></p><p>Te damos una cuenta con el juego comprado. La configurás como principal en tu consola, descargás el juego y lo jugás con <b>tu propio usuario</b>, con tus trofeos y partidas guardadas.</p></div>`;
    if (p.retro) extra += `<div class="info"><p><b>Retro:</b> título de la línea Retro que ofrece Sony en la tienda de PlayStation.</p></div>`;
    if (p.category === 'retro') extra += `<div class="info"><p><b>Compra mínima: 10 cartuchos</b> (podés combinar distintos títulos).</p></div>`;
    if (p.category === 'fisicos') extra += `<div class="info"><p><b>Juego físico ${p.condition.toLowerCase()}.</b> Lo retirás en el local (Nuevocentro Shopping, Stand 1.05). ${p.price == null ? 'Consultanos el precio por WhatsApp y te lo reservamos.' : 'Pedilo por WhatsApp y te lo reservamos.'}</p></div>`;
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
            ${canOrder(p) ? `<button class="btn ghost" data-add="${esc(p.id)}">Agregar al pedido</button>` : ''}`}
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
      <span class="plat ${pr.platform}" style="position:static;align-self:flex-start">${pr.platform} · ${pr.fisico ? 'físicos usados' : `${pr.pick}x1`}</span>
      <h3>${esc(pr.name)}</h3>
      <div class="stack">${imgs}</div>
      <div class="price-row"><span class="price">${money(pr.price)}</span><span class="muted">por los ${pr.pick} juegos</span></div>
      <span class="btn">Elegir juegos</span>
    </div>`;
  }

  let picking = null;
  function openPromo(id) {
    const pr = allPromos().find(x => x.id === id);
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
        <div class="muted">Elegí ${pr.pick} juegos · ${money(pr.price)} en total · ${pr.fisico ? 'Físicos usados, los retirás en el local' : 'Cuenta primaria'}</div>
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
    if (p.category === 'fisicos') return `${p.platform} · físico ${p.condition.toLowerCase()}`;
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
        <strong>${x.price == null ? '<span class="ask">A consultar</span>' : money(x.price * x.qty)}</strong>
      </div>`).join('') : '<p class="cart-empty">Todavía no agregaste nada.<br>Tocá ＋ en cualquier producto.</p>';
    const toAsk = cart.filter(x => x.price == null).length;
    $('#cartTotal').textContent = money(cart.reduce((s, x) => s + (x.price || 0) * x.qty, 0)) + (toAsk ? ' + a consultar' : '');
    const sega = cart.filter(x => x.key.startsWith('sega-')).reduce((s, x) => s + x.qty, 0);
    const segaShort = sega > 0 && sega < SEGA_MIN;
    $('#cartWarn').hidden = !segaShort;
    if (segaShort) $('#cartWarn').textContent = `Cartuchos Sega: la compra mínima es de ${SEGA_MIN}. Llevás ${sega}, sumá ${SEGA_MIN - sega} más para poder enviar el pedido.`;
    $('#sendOrder').disabled = !cart.length || segaShort;
    $('#sentBox').hidden = !(lastOrder && !cart.length);
  }
  function orderText() {
    const lines = cart.map(x => `• ${x.qty > 1 ? x.qty + 'x ' : ''}${x.name}${x.sub ? ` (${x.sub})` : ''} — ${x.price == null ? 'precio a consultar' : money(x.price * x.qty)}`);
    const total = cart.reduce((s, x) => s + (x.price || 0) * x.qty, 0);
    const toAsk = cart.some(x => x.price == null);
    const totalLine = total ? `*Total: ${money(total)}*${toAsk ? ' + los productos a consultar' : ''}` : '¿Me pasás el precio y si está disponible?';
    return `¡Hola Zona Gamer! Quiero hacer este pedido:\n\n${lines.join('\n')}\n\n${totalLine}\n\n(Pedido desde la web)`;
  }
  function askText(p) {
    if (p.category === 'fisicos' && p.price == null) return `¡Hola Zona Gamer! Quería consultar el precio de:\n\n• ${p.name} (${lineSub(p)})\n\n¿Lo tienen disponible?`;
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
  function setMode(mode, { scroll = true } = {}) {
    state.mode = mode;
    $('#chooser').hidden = true;
    document.body.classList.remove('choosing');
    store.set('zg-mode', mode);
    setTab(mode === 'fisico' ? 'f-todo' : 'todo', { scroll });
  }

  function setTab(id, { scroll = true } = {}) {
    state.tab = id; state.chips = new Set(); state.shown = PAGE;
    if (state.q) { state.q = ''; $('#q').value = ''; }
    history.replaceState(null, '', location.pathname + '#' + id);
    render();
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('click', e => {
    const t = e.target;
    const sw = t.closest('[data-switch]');
    if (sw) {
      const q = state.q;
      setMode(sw.dataset.switch);
      $('#q').value = q; state.q = q; syncQueryParam(); render();
      return;
    }
    const modeBtn = t.closest('[data-mode]');
    if (modeBtn) { if (modeBtn.dataset.mode !== state.mode || !$('#chooser').hidden) setMode(modeBtn.dataset.mode); return; }
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
      cart.push({ key: pr.id + ':' + sel.sort((a, b) => a - b).join('-'), name: pr.fisico ? `Promo ${pr.badge} PS4 usados` : `Promo ${pr.pick}x1 ${pr.platform}`, sub: games.join(' + '), price: pr.price, qty: 1, image: pr.games[sel[0]].image || null });
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
      if (state.q) { state.tab = state.mode === 'fisico' ? 'f-todo' : 'todo'; state.chips = new Set(); }
      syncQueryParam();
      render();
      window.scrollTo({ top: 0 });
    }, 150);
  });
  $('#q').addEventListener('keydown', e => {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape' && state.q) clearSearch();
  });
  $('#clearQ').addEventListener('click', clearSearch);
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; state.shown = PAGE; render(); });
  $('#more').addEventListener('click', more);
  document.querySelector('.logo').addEventListener('click', e => { e.preventDefault(); $('#chooser').hidden = false; document.body.classList.add('choosing'); });
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
      FIS_PROMOS = PROMOS_FIS_DEF.map(({ filter, ...pr }) => ({
        ...pr, fisico: true, platform: 'PS4',
        games: DATA.products.filter(filter).sort((a, b) => !!b.image - !!a.image || a.name.localeCompare(b.name, 'es'))
          .map(p => ({ name: p.name, image: p.image || null, soldOut: false })),
      })).filter(pr => pr.games.length >= pr.pick);
      if (d.updated) $('#updated').textContent = 'Precios y stock actualizados: ' + new Date(d.updated).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      const qParam = new URLSearchParams(location.search).get('q');
      const fromHash = location.hash.slice(1);
      const hashTab = TABS.find(t => t.id === fromHash);
      if (hashTab) { state.tab = hashTab.id; state.mode = modeOf(hashTab); }
      else if (qParam) { state.mode = store.get('zg-mode', 'digital'); state.tab = state.mode === 'fisico' ? 'f-todo' : 'todo'; }
      else { $('#chooser').hidden = false; document.body.classList.add('choosing'); }
      if (qParam) { state.q = qParam.trim(); $('#q').value = state.q; }
      render();
      drawCart();
      loadVideos(); // para mostrar el video de canje en la ficha de cada tarjeta
    })
    .catch(() => { $('#count').textContent = 'No se pudo cargar el catálogo. Probá recargar la página.'; });
})();
