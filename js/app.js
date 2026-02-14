// ===================================================================
// DATA LOADING
// ===================================================================
let CATEGORIES = [];
let PRODUCTS = [];
let SITES = [];
let BUILDINGS = [];
let FLOORS = [];
let BUILDINGS_GEO = null;
let FURNITURE_ITEMS = [];
let STILWELTEN = [];
let PLANUNGSBEISPIELE = [];
let CAD_SECTIONS = [];
let LOCATIONS = { id: 'ch', label: 'Schweiz', type: 'country', count: 0, children: [] };

async function loadData() {
  const [catRes, prodRes, siteRes, bldRes, flrRes, furnRes, stilRes, planRes, cadRes] = await Promise.all([
    fetch('data/categories.json'),
    fetch('data/products.json'),
    fetch('data/sites.json'),
    fetch('data/buildings.json'),
    fetch('data/floors.json'),
    fetch('data/furniture-items.json'),
    fetch('data/stilwelten.json'),
    fetch('data/planungsbeispiele.json'),
    fetch('data/cad-sections.json')
  ]);
  CATEGORIES = await catRes.json();
  PRODUCTS = await prodRes.json();
  SITES = await siteRes.json();
  BUILDINGS = await bldRes.json();
  FLOORS = await flrRes.json();
  FURNITURE_ITEMS = await furnRes.json();
  STILWELTEN = await stilRes.json();
  PLANUNGSBEISPIELE = await planRes.json();
  CAD_SECTIONS = await cadRes.json();

  // Build GeoJSON from buildings data
  BUILDINGS_GEO = {
    type: 'FeatureCollection',
    features: BUILDINGS.map(b => ({
      type: 'Feature',
      id: b.buildingId,
      properties: {
        buildingId: b.buildingId,
        siteId: b.siteId,
        name: b.name,
        objectCode: b.objectCode,
        category: b.category,
        areaGross: b.areaGross
      },
      geometry: {
        type: 'Point',
        coordinates: [b.coords[1], b.coords[0]]
      }
    }))
  };
  buildLocationTree();
}

function buildLocationTree() {
  // Build floor nodes grouped by building
  const floorsByBuilding = {};
  for (const f of FLOORS) {
    if (!floorsByBuilding[f.buildingId]) floorsByBuilding[f.buildingId] = [];
    floorsByBuilding[f.buildingId].push({
      id: f.floorId,
      label: f.name,
      type: 'floor',
      flaeche: f.areaGross ? f.areaGross.toLocaleString('de-CH') + ' m\u00b2' : '',
      plaetze: f.workspaceCount || 0,
      raeume: f.roomCount || 0,
      rooms: f.rooms || []
    });
  }
  // Sort floors by verticalOrder
  for (const bid in floorsByBuilding) {
    const floorData = FLOORS.filter(f => f.buildingId === bid);
    floorsByBuilding[bid].sort((a, b) => {
      const fa = floorData.find(f => f.floorId === a.id);
      const fb = floorData.find(f => f.floorId === b.id);
      return (fa ? fa.verticalOrder : 0) - (fb ? fb.verticalOrder : 0);
    });
  }

  // Build building nodes grouped by site
  const buildingsBySite = {};
  for (const b of BUILDINGS) {
    if (!buildingsBySite[b.siteId]) buildingsBySite[b.siteId] = [];
    buildingsBySite[b.siteId].push({
      id: b.buildingId,
      label: b.name,
      code: b.objectCode,
      address: b.address.street + ', ' + b.address.postalCode + ' ' + b.address.city,
      type: 'building',
      photo: b.photo,
      coords: b.coords,
      baujahr: b.yearBuilt,
      status: b.status,
      kategorie: b.category,
      flaeche: b.areaGross ? b.areaGross.toLocaleString('de-CH') + ' m\u00b2' : '',
      children: floorsByBuilding[b.buildingId] || []
    });
  }

  // Build site nodes
  const siteNodes = SITES.map(s => ({
    id: s.siteId,
    label: s.name,
    type: 'kanton',
    count: (buildingsBySite[s.siteId] || []).length,
    children: buildingsBySite[s.siteId] || []
  }));

  // Assemble root
  const totalCount = siteNodes.reduce((sum, s) => sum + s.count, 0);
  LOCATIONS = {
    id: 'ch',
    label: 'Schweiz',
    type: 'country',
    count: totalCount,
    children: siteNodes
  };
}

// ===================================================================
// STATE
// ===================================================================
let state = {
  page: 'shop',
  subPage: null,
  productId: null,
  activeCategory: 'alle',
  expandedCategories: new Set(['stuehle']),
  searchQuery: '',
  sortBy: 'name-asc',
  openDropdown: null,
  mobileMenuOpen: false,
  cart: [],
  cartStep: 1,
  globalSearchQuery: '',
  searchFilterCategory: '',
  searchFilterBrand: '',
  searchSortBy: 'name-asc',
  // Occupancy planning
  occSelectedId: null,
  occExpandedIds: new Set(['ch']),
  occTab: 'map',
  occMapStyle: 'light-v11'
};

const MAP_STYLES = {
  'light-v11': { name: 'Light', url: 'mapbox://styles/mapbox/light-v11' },
  'streets-v12': { name: 'Standard', url: 'mapbox://styles/mapbox/streets-v12' },
  'satellite-v9': { name: 'Luftbild', url: 'mapbox://styles/mapbox/satellite-v9' },
  'satellite-streets-v12': { name: 'Hybrid', url: 'mapbox://styles/mapbox/satellite-streets-v12' }
};

// Helper: find a node + its parent chain by id
function occFindNode(id, node, path) {
  if (!node) node = LOCATIONS;
  if (!path) path = [];
  if (node.id === id) return { node, path };
  if (node.children) {
    for (const child of node.children) {
      const result = occFindNode(id, child, [...path, node]);
      if (result) return result;
    }
  }
  return null;
}

// Helper: get the parent building for a floor node
function occGetParentBuilding(floorId) {
  const result = occFindNode(floorId);
  if (!result) return null;
  return result.path.find(n => n.type === 'building') || null;
}

// SVG icons per location type
const RP_ICONS = {
  country: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3v10l4-2 4 2 4-2V1l-4 2-4-2-4 2z"/></svg>',
  kanton: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M5 3V1h6v2"/><line x1="2" y1="7" x2="14" y2="7"/></svg>',
  building: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="2" width="10" height="13" rx="1"/><line x1="6" y1="5" x2="6" y2="5.01"/><line x1="8" y1="5" x2="8" y2="5.01"/><line x1="10" y1="5" x2="10" y2="5.01"/><line x1="6" y1="8" x2="6" y2="8.01"/><line x1="8" y1="8" x2="8" y2="8.01"/><line x1="10" y1="8" x2="10" y2="8.01"/><path d="M6 15v-3h4v3"/></svg>',
  floor: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="10" rx="1"/><line x1="2" y1="8" x2="9" y2="8"/><line x1="7" y1="3" x2="7" y2="10"/></svg>'
};

// ===================================================================
// CART
// ===================================================================
function addToCart(productId) {
  const existing = state.cart.find(item => item.productId === productId);
  if (existing) {
    existing.quantity++;
  } else {
    state.cart.push({ productId, quantity: 1 });
  }
  updateCartBadge();
}

function removeFromCart(index) {
  state.cart.splice(index, 1);
  updateCartBadge();
  navigateTo('cart');
}

function updateCartQuantity(index, qty) {
  const q = Math.max(1, Math.min(99, parseInt(qty) || 1));
  state.cart[index].quantity = q;
  navigateTo('cart');
}

function getCartCount() {
  return state.cart.reduce((sum, item) => sum + item.quantity, 0);
}

function getCartTotal() {
  return state.cart.reduce((sum, item) => {
    const p = PRODUCTS.find(x => x.id === item.productId);
    return sum + (p ? p.price * item.quantity : 0);
  }, 0);
}

function updateCartBadge() {
  const count = getCartCount();
  const btn = document.querySelector('.top-header__action[aria-label="Warenkorb"]');
  if (!btn) return;
  let badge = btn.querySelector('.cart-badge');
  if (count > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cart-badge';
      btn.appendChild(badge);
    }
    badge.textContent = count;
  } else if (badge) {
    badge.remove();
  }
}

// ===================================================================
// ICONS
// ===================================================================
const ICONS = {
  chevronRight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,6 15,12 9,18"/></svg>`,
  arrowRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>`,
  placeholder: `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>`,
  chair: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><path d="M7 18v3M17 18v3M5 10V6a2 2 0 012-2h10a2 2 0 012 2v4M5 10h14a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4a2 2 0 012-2z"/></svg>`,
  desk: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><rect x="2" y="7" width="20" height="3" rx="1"/><line x1="4" y1="10" x2="4" y2="20"/><line x1="20" y1="10" x2="20" y2="20"/><rect x="6" y="12" width="6" height="5" rx="0.5"/></svg>`,
  lamp: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><path d="M9 21h6M12 21v-6M8 3l-4 12h16L16 3z"/></svg>`,
  shelf: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>`,
  cabinet: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="14" cy="7" r="1"/><circle cx="14" cy="17" r="1"/></svg>`,
  korpus: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><rect x="5" y="4" width="14" height="16" rx="1"/><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="14" x2="19" y2="14"/><circle cx="15" cy="6.5" r="0.8"/><circle cx="15" cy="11.5" r="0.8"/><circle cx="15" cy="16.5" r="0.8"/></svg>`,
  garderobe: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><line x1="12" y1="2" x2="12" y2="22"/><line x1="6" y1="6" x2="12" y2="4"/><line x1="18" y1="6" x2="12" y2="4"/><circle cx="12" cy="22" r="2"/></svg>`,
  sofa: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><path d="M4 12V8a4 4 0 014-4h8a4 4 0 014 4v4"/><rect x="2" y="12" width="20" height="6" rx="2"/><line x1="4" y1="18" x2="4" y2="21"/><line x1="20" y1="18" x2="20" y2="21"/></svg>`,
  misc: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>`
};

function getProductImage(product) {
  const photoId = product.photo;
  if (photoId) {
    return `<img src="https://images.unsplash.com/${photoId}?w=600&h=400&fit=crop&auto=format&q=80" srcset="https://images.unsplash.com/${photoId}?w=400&h=267&fit=crop&auto=format&q=80 400w, https://images.unsplash.com/${photoId}?w=600&h=400&fit=crop&auto=format&q=80 600w, https://images.unsplash.com/${photoId}?w=800&h=533&fit=crop&auto=format&q=80 800w" sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 280px" alt="${product.name}" loading="lazy">`;
  }
  return getProductIcon(product);
}

function getProductIcon(product) {
  const cat = product.category;
  if (cat === 'stuehle') return ICONS.chair;
  if (cat === 'tische') return ICONS.desk;
  if (cat === 'lampen') return ICONS.lamp;
  if (cat === 'regale') return ICONS.shelf;
  if (cat === 'usm') return ICONS.shelf;
  if (cat === 'schraenke' || cat === 'sicherheitsschraenke') return ICONS.cabinet;
  if (cat === 'korpus') return ICONS.korpus;
  if (cat === 'garderobe') return ICONS.garderobe;
  if (cat === 'clubsessel-sofa') return ICONS.sofa;
  return ICONS.misc;
}

// ===================================================================
// HELPERS
// ===================================================================
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function getCategoryLabel(id) {
  function find(cats) {
    for (const c of cats) {
      if (c.id === id) return c.label;
      if (c.children && c.children.length) {
        const found = find(c.children);
        if (found) return found;
      }
    }
    return null;
  }
  return find(CATEGORIES) || id;
}

function getParentCategory(subcatId) {
  for (const c of CATEGORIES) {
    if (c.id === subcatId) return null;
    if (c.children) {
      for (const ch of c.children) {
        if (ch.id === subcatId) return c;
        if (ch.children) {
          for (const gch of ch.children) {
            if (gch.id === subcatId) return ch;
          }
        }
      }
    }
  }
  return null;
}

function getAllSubcategoryIds(catId) {
  const ids = [catId];
  function collect(cats) {
    for (const c of cats) {
      if (c.id === catId) {
        function addAll(children) {
          for (const ch of children) {
            ids.push(ch.id);
            if (ch.children) addAll(ch.children);
          }
        }
        if (c.children) addAll(c.children);
        return true;
      }
      if (c.children && collect(c.children)) return true;
    }
    return false;
  }
  collect(CATEGORIES);
  return ids;
}

function countProductsInCategory(catId) {
  if (catId === 'alle') return PRODUCTS.length;
  const ids = getAllSubcategoryIds(catId);
  return PRODUCTS.filter(p => ids.includes(p.category) || ids.includes(p.subcategory)).length;
}

function countFurnitureInCategory(catId) {
  const available = FURNITURE_ITEMS.filter(f => f.status === 'Zur Abgabe');
  if (catId === 'alle') return available.length;
  const ids = getAllSubcategoryIds(catId);
  return available.filter(f => ids.includes(f.categoryId)).length;
}

// ---- BREADCRUMB HELPER ----
// Usage: renderBreadcrumb(['Produktkatalog', "navigateTo('shop')"], ['Stühle'])
// Last item = current page (no link). Previous items = links.
function renderBreadcrumb(...items) {
  const SEP = ` <span class="breadcrumb__sep">${ICONS.chevronRight}</span> `;
  let html = `<a href="#" onclick="navigateTo('home');return false">Home</a>`;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    html += SEP;
    if (i < items.length - 1 && item.length > 1) {
      html += `<a href="#" onclick="${item[1]};return false">${item[0]}</a>`;
    } else {
      html += `<span class="breadcrumb__current">${item[0]}</span>`;
    }
  }
  return `<div class="breadcrumb-bar"><nav class="breadcrumb" aria-label="Breadcrumb">${html}</nav></div>`;
}

function findCategory(id) {
  function find(cats) {
    for (const c of cats) {
      if (c.id === id) return c;
      if (c.children) {
        const found = find(c.children);
        if (found) return found;
      }
    }
    return null;
  }
  return find(CATEGORIES);
}

function filterProducts() {
  let filtered = [...PRODUCTS];

  if (state.activeCategory !== 'alle') {
    const ids = getAllSubcategoryIds(state.activeCategory);
    filtered = filtered.filter(p => ids.includes(p.category) || ids.includes(p.subcategory));
  }

  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q)
    );
  }

  // Sort
  switch (state.sortBy) {
    case 'name-asc':
      filtered.sort((a, b) => a.name.localeCompare(b.name, 'de'));
      break;
    case 'name-desc':
      filtered.sort((a, b) => b.name.localeCompare(a.name, 'de'));
      break;
    case 'price-asc':
      filtered.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      filtered.sort((a, b) => b.price - a.price);
      break;
    case 'new':
      filtered.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
      break;
  }

  return filtered;
}

function filterFurnitureItems() {
  let filtered = FURNITURE_ITEMS.filter(f => f.status === 'Zur Abgabe');

  if (state.activeCategory !== 'alle') {
    const ids = getAllSubcategoryIds(state.activeCategory);
    filtered = filtered.filter(f => ids.includes(f.categoryId));
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      f.brand.toLowerCase().includes(q)
    );
  }

  switch (state.sortBy) {
    case 'name-asc':  filtered.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'name-desc': filtered.sort((a, b) => b.name.localeCompare(a.name)); break;
    case 'price-asc': filtered.sort((a, b) => a.price - b.price); break;
    case 'price-desc': filtered.sort((a, b) => b.price - a.price); break;
  }

  return filtered;
}

function debounce(fn, ms) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ===================================================================
// RENDERING
// ===================================================================
function render() {
  const app = document.getElementById('app');

  // Update nav active states
  const activePage = ['scan', 'register', 'charter', 'item'].includes(state.page) ? 'circular'
                   : ['style-worlds', 'examples', 'cad'].includes(state.page) ? 'planning'
                   : state.page;
  document.querySelectorAll('.main-navigation__link').forEach(link => {
    const nav = link.dataset.nav;
    if (nav === activePage) {
      link.classList.add('main-navigation__link--active');
    } else {
      link.classList.remove('main-navigation__link--active');
    }
  });

  // Trigger page transition
  app.style.animation = 'none';
  app.offsetHeight; // force reflow
  app.style.animation = '';

  switch (state.page) {
    case 'home': app.innerHTML = renderHome(); break;
    case 'shop': app.innerHTML = renderShop(); attachShopEvents(); break;
    case 'product': app.innerHTML = renderProductDetail(state.productId); attachProductDetailEvents(); break;
    case 'item': app.innerHTML = renderFurnitureDetail(state.subPage); break;
    case 'planning': app.innerHTML = renderPlanning(); break;
    case 'occupancy': app.innerHTML = renderOccupancy(); attachOccupancyEvents(); break;
    case 'circular': app.innerHTML = renderCircular(); attachShopEvents(); break;
    case 'scan': app.innerHTML = renderScan(); break;
    case 'register': app.innerHTML = renderRegister(); break;
    case 'charter': app.innerHTML = renderCharter(); break;
    case 'style-worlds': app.innerHTML = renderStyleWorlds(); break;
    case 'examples': app.innerHTML = renderExamples(); break;
    case 'cad': app.innerHTML = renderCad(); attachAccordionEvents(); break;
    case 'cart': app.innerHTML = renderCart(); attachCartEvents(); break;
    case 'search': app.innerHTML = renderSearch(); attachSearchEvents(); break;
    default: app.innerHTML = renderShop(); attachShopEvents();
  }
}

// ---- HOME ----
function renderHome() {
  return `
    <section class="hero" id="mainContent">
      <div class="hero__content">
        <h1 class="hero__title">Arbeitsplatz-Management</h1>
        <p class="hero__description">Die Plattform f\u00fcr die Einrichtung und Verwaltung von Arbeitspl\u00e4tzen in der Bundesverwaltung. Mobiliar bestellen, R\u00e4ume planen, gebrauchte M\u00f6bel wiederverwenden.</p>
        <div class="hero__cta">
          <a href="#/shop" class="btn btn--filled btn--lg" onclick="navigateTo('shop');return false">Zum Produktkatalog ${ICONS.arrowRight}</a>
          <a href="#/planung" class="btn btn--outline btn--lg" onclick="navigateTo('planning');return false">Arbeitspl\u00e4tze gestalten ${ICONS.arrowRight}</a>
        </div>
      </div>
      <div class="hero__image">
        <picture>
          <source srcset="https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=800&fit=crop&auto=format&q=80" media="(min-width: 768px)">
          <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=533&fit=crop&auto=format&q=80" alt="Beispiel eines modernen B\u00fcroarbeitsplatzes" loading="eager">
        </picture>
      </div>
    </section>

    <section class="section section--bg-alt">
      <div class="tile-grid">
        <div class="card card--centered card--clickable" onclick="navigateTo('shop')" role="button" tabindex="0">
          <h3 class="card__title">Produktkatalog</h3>
          <p class="card__description">B\u00fcrom\u00f6bel, Sitzm\u00f6bel, Beleuchtung und Zubeh\u00f6r bestellen. Alle Produkte entsprechen den Standards der Bundesverwaltung.</p>
          <div class="card__arrow"><span class="card__arrow-icon">&rarr;</span></div>
        </div>
        <div class="card card--centered card--clickable" onclick="navigateTo('planning')" role="button" tabindex="0">
          <h3 class="card__title">Arbeitspl\u00e4tze gestalten</h3>
          <p class="card__description">Stilwelten, Planungsbeispiele und CAD-Daten f\u00fcr die B\u00fcroplanung. Vorlagen und Konzepte f\u00fcr die Einrichtung von Arbeitspl\u00e4tzen.</p>
          <div class="card__arrow"><span class="card__arrow-icon">&rarr;</span></div>
        </div>
        <div class="card card--centered card--clickable" onclick="navigateTo('circular')" role="button" tabindex="0">
          <h3 class="card__title">Gebrauchte M\u00f6bel</h3>
          <p class="card__description">Gebrauchtes Mobiliar wiederverwenden statt entsorgen. Objekte scannen, erfassen und im Angebot verf\u00fcgbarer M\u00f6bel suchen.</p>
          <div class="card__arrow"><span class="card__arrow-icon">&rarr;</span></div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section__title">Neuheiten</h2>
      <div class="product-grid product-grid--spaced">
        ${PRODUCTS.filter(p => p.isNew).slice(0, 6).map(p => renderProductCard(p)).join('')}
      </div>
      <div class="section-link">
        <a href="#/shop" class="section-link__a" onclick="navigateTo('shop');return false">Alle Produkte anzeigen &rarr;</a>
      </div>
    </section>
  `;
}

// ---- CATEGORY TREE ----
function renderCategoryTree(categories, countFn) {
  if (!countFn) countFn = countProductsInCategory;
  return categories.map(cat => {
    const hasChildren = cat.children && cat.children.length > 0;
    const isExpanded = state.expandedCategories.has(cat.id);
    const isActive = state.activeCategory === cat.id;
    const count = countFn(cat.id);
    return `
      <div class="cat-item">
        <div class="cat-item__row ${isActive ? 'cat-item__row--active' : ''}" data-cat-id="${cat.id}" role="treeitem" aria-expanded="${hasChildren ? isExpanded : ''}" tabindex="0">
          <div class="cat-item__radio ${isActive ? 'cat-item__radio--active' : ''}"></div>
          <span class="cat-item__label">${cat.label}</span>
          ${count > 0 && cat.id !== 'alle' ? `<span class="cat-item__count">${count}</span>` : ''}
          ${hasChildren ? `<span class="cat-item__toggle ${isExpanded ? 'cat-item__toggle--open' : ''}">\u203A</span>` : ''}
        </div>
        ${hasChildren ? `<div class="cat-item__children ${isExpanded ? 'cat-item__children--open' : ''}">${renderCategoryTree(cat.children, countFn)}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ---- SHOP ----
function renderShop() {
  const products = filterProducts();
  const catLabel = getCategoryLabel(state.activeCategory);
  const parent = getParentCategory(state.activeCategory);

  const bcItems = [['Produktkatalog', "setCategory('alle')"]];
  if (state.activeCategory !== 'alle') {
    if (parent) {
      bcItems.push([parent.label, `setCategory('${parent.id}')`]);
    }
    bcItems.push([catLabel]);
  }

  return `
    ${renderBreadcrumb(...bcItems)}
    <div class="page-hero">
      <h1 class="page-hero__title">Produktkatalog</h1>
      <p class="page-hero__subtitle">B&uuml;rom&ouml;bel, Sitzm&ouml;bel, Beleuchtung und Zubeh&ouml;r f&uuml;r die Bundesverwaltung bestellen.</p>
    </div>
    <div class="app-layout">
      <aside class="sidebar" role="navigation" aria-label="Kategorien">
        <div class="sidebar__title">Kategorien</div>
        <div class="cat-tree" role="tree">
          ${renderCategoryTree(CATEGORIES)}
        </div>
      </aside>
      <main class="main-content" id="mainContent">
        <div class="toolbar">
          <div class="search">
            <input class="search__field" type="search" placeholder="Suchen..." id="searchInput" value="${escapeHtml(state.searchQuery)}" aria-label="Produkte suchen">
            <button class="search__button" aria-label="Suchen">${ICONS.search}</button>
          </div>
          <select class="select" id="sortSelect" aria-label="Sortierung">
            <option value="name-asc" ${state.sortBy==='name-asc'?'selected':''}>Name A-Z</option>
            <option value="name-desc" ${state.sortBy==='name-desc'?'selected':''}>Name Z-A</option>
            <option value="price-asc" ${state.sortBy==='price-asc'?'selected':''}>Preis aufsteigend</option>
            <option value="price-desc" ${state.sortBy==='price-desc'?'selected':''}>Preis absteigend</option>
            <option value="new" ${state.sortBy==='new'?'selected':''}>Neuheiten zuerst</option>
          </select>
          <span class="toolbar__count">${products.length} Produkt${products.length !== 1 ? 'e' : ''}</span>
        </div>
        ${products.length ? `
          <div class="product-grid" id="productGrid">
            ${products.map(p => renderProductCard(p)).join('')}
          </div>
        ` : `
          <div class="no-results">
            <div class="no-results__icon">${ICONS.placeholder}</div>
            <p class="no-results__text">Keine Produkte gefunden.</p>
          </div>
        `}
      </main>
    </div>
  `;
}

// ---- PRODUCT CARD ----
function renderProductCard(p) {
  return `
    <div class="card card--product" onclick="navigateTo('product',${p.id})" tabindex="0" role="button" aria-label="${escapeHtml(p.name)}">
      <div class="card__image card__image--placeholder">
        ${getProductImage(p)}
        ${p.isNew ? '<span class="badge badge--new">Neu</span>' : ''}
      </div>
      <div class="card__body">
        <div class="card__title">${escapeHtml(p.name)}</div>
        <div class="card__description">${escapeHtml(p.description)}</div>
        <div class="card__price">${p.currency} ${p.price.toFixed(2)}</div>
      </div>
      <div class="card__footer">
        <span class="card__brand">${escapeHtml(p.brand)}</span>
      </div>
    </div>
  `;
}

// ---- PRODUCT DETAIL ----
function renderProductDetail(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) {
    return `
      ${renderBreadcrumb(['Produktkatalog', "navigateTo('shop')"], ['Nicht gefunden'])}
      <div class="container container--with-top-pad" id="mainContent">
        <div class="no-results">
          <div class="no-results__icon">${ICONS.placeholder}</div>
          <p class="no-results__text">Produkt nicht gefunden.</p>
        </div>
      </div>
    `;
  }

  const catLabel = getCategoryLabel(p.subcategory) || getCategoryLabel(p.category);
  const parentCat = getParentCategory(p.subcategory);

  const bcItems = [['Produktkatalog', "navigateTo('shop')"]];
  if (parentCat) {
    bcItems.push([parentCat.label, `setCategory('${parentCat.id}')`]);
  }
  if (p.subcategory && p.subcategory !== p.category) {
    bcItems.push([catLabel, `setCategory('${p.subcategory}')`]);
  } else {
    bcItems.push([getCategoryLabel(p.category), `setCategory('${p.category}')`]);
  }
  bcItems.push([escapeHtml(p.name)]);

  const articleNr = 'ART-' + String(p.id).padStart(5, '0');

  return `
    ${renderBreadcrumb(...bcItems)}
    <div class="container container--with-top-pad" id="mainContent">
      <div class="detail-toolbar">
        <button class="btn btn--outline btn--sm detail-toolbar__back" onclick="history.back()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/></svg>
          Zur\u00fcck
        </button>
        <div class="detail-toolbar__actions">
          <button class="detail-toolbar__icon" aria-label="Drucken" onclick="window.print()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          </button>
          <button class="detail-toolbar__icon" aria-label="Teilen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>
      </div>
      <div class="product-detail">
        <div class="product-detail__image">
          ${getProductImage(p)}
          ${p.isNew ? '<span class="badge badge--new">Neu</span>' : ''}
        </div>
        <div class="product-detail__info">
          <h1 class="product-detail__title">${escapeHtml(p.name)}</h1>
          <p class="product-detail__desc">${escapeHtml(p.description)}</p>
          <div class="product-detail__meta">
            <span class="product-detail__meta-label">Marke</span>
            <span class="product-detail__meta-value">${escapeHtml(p.brand)}</span>
            <span class="product-detail__meta-label">Kategorie</span>
            <span class="product-detail__meta-value">${catLabel}</span>
            <span class="product-detail__meta-label">Artikel-Nr.</span>
            <span class="product-detail__meta-value">${articleNr}</span>
          </div>
          <div class="product-detail__price">${p.currency} ${p.price.toFixed(2)}</div>
          <div class="product-detail__actions">
            <button class="btn btn--filled" id="addToCartBtn" data-product-id="${p.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              In den Warenkorb
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---- FURNITURE CARD ----
function renderFurnitureCard(f) {
  const building = BUILDINGS.find(b => b.buildingId === f.buildingId);
  const locationLabel = building ? building.name : '';
  return `
    <div class="card card--product" onclick="navigateTo('item','${f.itemId}')" tabindex="0" role="button" aria-label="${escapeHtml(f.name)}">
      <div class="card__image card__image--placeholder">
        ${f.photo ? `<img src="https://images.unsplash.com/${f.photo}?w=400&h=300&fit=crop&auto=format&q=80" alt="${escapeHtml(f.name)}" loading="lazy">` : ICONS.placeholder}
        <span class="badge badge--circular">Gebraucht</span>
      </div>
      <div class="card__body">
        <div class="card__title">${escapeHtml(f.name)}</div>
        <div class="card__description">${escapeHtml(f.description)}</div>
        <div class="card__price">${f.currency} ${f.price.toFixed(2)}</div>
      </div>
      <div class="card__footer">
        <span class="card__brand">${escapeHtml(f.brand)}</span>
        ${locationLabel ? `<span class="card__location">${escapeHtml(locationLabel)}</span>` : ''}
      </div>
    </div>
  `;
}

// ---- FURNITURE DETAIL ----
function renderFurnitureDetail(itemId) {
  const f = FURNITURE_ITEMS.find(x => x.itemId === itemId);
  if (!f) {
    return `
      ${renderBreadcrumb(['Gebrauchte M\u00f6bel', "navigateTo('circular')"], ['Nicht gefunden'])}
      <div class="container container--with-top-pad" id="mainContent">
        <div class="no-results">
          <div class="no-results__icon">${ICONS.placeholder}</div>
          <p class="no-results__text">Objekt nicht gefunden.</p>
        </div>
      </div>
    `;
  }

  const catLabel = getCategoryLabel(f.categoryId) || '';
  const parentCat = getParentCategory(f.categoryId);
  const building = BUILDINGS.find(b => b.buildingId === f.buildingId);
  const floor = FLOORS.find(fl => fl.floorId === f.floorId);
  const locationParts = [];
  if (building) locationParts.push(building.name);
  if (floor) locationParts.push(floor.name);
  const locationLabel = locationParts.join(', ');

  const bcItems = [['Gebrauchte M\u00f6bel', "navigateTo('circular')"]];
  if (parentCat) bcItems.push([parentCat.label]);
  bcItems.push([escapeHtml(f.name)]);

  return `
    ${renderBreadcrumb(...bcItems)}
    <div class="container container--with-top-pad" id="mainContent">
      <div class="detail-toolbar">
        <button class="btn btn--outline btn--sm detail-toolbar__back" onclick="history.back()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/></svg>
          Zur\u00fcck
        </button>
      </div>
      <div class="product-detail">
        <div class="product-detail__image">
          ${f.photo ? `<img src="https://images.unsplash.com/${f.photo}?w=600&h=450&fit=crop&auto=format&q=80" alt="${escapeHtml(f.name)}" loading="lazy">` : ICONS.placeholder}
          <span class="badge badge--circular">Gebraucht</span>
        </div>
        <div class="product-detail__info">
          <h1 class="product-detail__title">${escapeHtml(f.name)}</h1>
          <p class="product-detail__desc">${escapeHtml(f.description)}</p>
          <div class="product-detail__meta">
            <span class="product-detail__meta-label">Marke</span>
            <span class="product-detail__meta-value">${escapeHtml(f.brand)}</span>
            <span class="product-detail__meta-label">Kategorie</span>
            <span class="product-detail__meta-value">${catLabel}</span>
            <span class="product-detail__meta-label">Zustand</span>
            <span class="product-detail__meta-value">${escapeHtml(f.condition)}</span>
            <span class="product-detail__meta-label">Inventar-Nr.</span>
            <span class="product-detail__meta-value">${escapeHtml(f.inventoryNumber)}</span>
            ${locationLabel ? `<span class="product-detail__meta-label">Standort</span>
            <span class="product-detail__meta-value">${escapeHtml(locationLabel)}</span>` : ''}
            ${f.acquisitionDate ? `<span class="product-detail__meta-label">Beschaffung</span>
            <span class="product-detail__meta-value">${f.acquisitionDate}</span>` : ''}
          </div>
          <div class="product-detail__price">${f.currency} ${f.price.toFixed(2)}</div>
          <div class="product-detail__actions">
            <button class="btn btn--filled">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Anfragen
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---- PLANUNG ----
function renderPlanning() {
  return `
    ${renderBreadcrumb(['Arbeitspl\u00e4tze gestalten'])}
    <div class="container container--with-top-pad" id="mainContent">
      <div class="page-hero">
        <h1 class="page-hero__title">Arbeitspl\u00e4tze gestalten</h1>
        <p class="page-hero__subtitle">B\u00fcror\u00e4ume nach aktuellen Arbeitsplatzstandards des Bundes planen und einrichten.</p>
      </div>

      <div class="tile-grid">
        <div class="card card--centered card--clickable" onclick="navigateTo('style-worlds')" role="button" tabindex="0">
          <h3 class="card__title">Stilwelten</h3>
          <p class="card__description">Vordefinierte Einrichtungskonzepte und B\u00fcro-Stile als Planungsgrundlage. Von konzentriertem Einzelarbeiten bis zur offenen Kollaborationszone.</p>
          <div class="card__arrow"><span class="card__arrow-icon">&rarr;</span></div>
        </div>
        <div class="card card--centered card--clickable" onclick="navigateTo('examples')" role="button" tabindex="0">
          <h3 class="card__title">Planungsbeispiele</h3>
          <p class="card__description">Realisierte Referenzprojekte aus der Bundesverwaltung. Sehen Sie, wie andere Bundesstellen ihre R\u00e4ume gestaltet haben.</p>
          <div class="card__arrow"><span class="card__arrow-icon">&rarr;</span></div>
        </div>
        <div class="card card--centered card--clickable" onclick="navigateTo('cad')" role="button" tabindex="0">
          <h3 class="card__title">CAD-Daten</h3>
          <p class="card__description">Laden Sie CAD-Dateien und technische Zeichnungen f\u00fcr die professionelle Raumplanung herunter. F\u00fcr Planer und Architekten.</p>
          <div class="card__arrow"><span class="card__arrow-icon">&rarr;</span></div>
        </div>
      </div>

    </div>

    <section class="section section--bg-alt">
      <h2 class="section__title">Stilwelten</h2>
      <div class="tile-grid">
        ${STILWELTEN.slice(0, 3).map(s => `
        <div class="card card--clickable" onclick="navigateTo('style-worlds')" role="button" tabindex="0">
          <div class="card__image card__image--visual">
            <img src="https://images.unsplash.com/${s.photo}?w=600&h=300&fit=crop&auto=format&q=80" alt="${escapeHtml(s.title)}" loading="lazy">
          </div>
          <div class="card__body">
            <div class="card__title">${escapeHtml(s.title)}</div>
            <div class="card__description">${escapeHtml(s.description).substring(0, 100)}.</div>
          </div>
          <div class="card__arrow"><span class="card__arrow-icon">&rarr;</span></div>
        </div>
        `).join('')}
      </div>
      <div class="section-link">
        <a href="#/style-worlds" class="section-link__a" onclick="navigateTo('style-worlds');return false">Alle Stilwelten anzeigen &rarr;</a>
      </div>
    </section>
  `;
}

// ---- STILWELTEN ----
function renderStyleWorlds() {
  return `
    ${renderBreadcrumb(['Arbeitspl\u00e4tze gestalten', "navigateTo('planning')"], ['Stilwelten'])}
    <div class="container container--with-top-pad" id="mainContent">
      <div class="page-hero">
        <h1 class="page-hero__title">Stilwelten</h1>
        <p class="page-hero__subtitle">Vordefinierte Einrichtungskonzepte und B\u00fcro-Stile als Planungsgrundlage. Von konzentriertem Einzelarbeiten bis zur offenen Kollaborationszone.</p>
      </div>

      <div class="tile-grid">
        ${STILWELTEN.map(s => `
          <div class="card card--clickable">
            <div class="card__image card__image--visual">
              <img src="https://images.unsplash.com/${s.photo}?w=600&h=300&fit=crop&auto=format&q=80" alt="${escapeHtml(s.title)}" loading="lazy">
            </div>
            <div class="card__body">
              <div class="card__title">${escapeHtml(s.title)}</div>
              <div class="card__description">${escapeHtml(s.description)}</div>
            </div>
            <div class="card__arrow">
              <span class="card__arrow-icon">&rarr;</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ---- PLANUNGSBEISPIELE ----
function renderExamples() {
  return `
    ${renderBreadcrumb(['Arbeitspl\u00e4tze gestalten', "navigateTo('planning')"], ['Planungsbeispiele'])}
    <div class="container container--with-top-pad" id="mainContent">
      <div class="page-hero">
        <h1 class="page-hero__title">Planungsbeispiele</h1>
        <p class="page-hero__subtitle">Realisierte Referenzprojekte aus der Bundesverwaltung. Sehen Sie, wie andere Bundesstellen ihre R\u00e4ume gestaltet haben.</p>
      </div>

      <div class="tile-grid">
        ${PLANUNGSBEISPIELE.map(b => `
          <div class="card card--clickable">
            <div class="card__image card__image--visual">
              <img src="https://images.unsplash.com/${b.photo}?w=600&h=300&fit=crop&auto=format&q=80" alt="${escapeHtml(b.title)}" loading="lazy">
            </div>
            <div class="card__body">
              <div class="card__title">${escapeHtml(b.title)}</div>
              <div class="card__description">${escapeHtml(b.description)}</div>
            </div>
            <div class="card__arrow">
              <span class="card__arrow-icon">&rarr;</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ---- CAD-DATEN ----
function renderCad() {
  const cadSections = CAD_SECTIONS;

  const downloadIcon = `<svg class="download-item__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

  const chevronIcon = `<svg class="accordion__arrow" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,9 12,15 18,9"/></svg>`;

  return `
    ${renderBreadcrumb(['Arbeitspl\u00e4tze gestalten', "navigateTo('planning')"], ['CAD-Daten'])}
    <div class="container container--with-top-pad" id="mainContent">
      <div class="page-hero">
        <h1 class="page-hero__title">CAD-Daten</h1>
        <p class="page-hero__subtitle">CAD-Dateien und technische Zeichnungen f\u00fcr die professionelle Raumplanung. F\u00fcr Planer und Architekten.</p>
      </div>

      <ul class="accordion">
        ${cadSections.map(s => `
          <li class="accordion__item">
            <button class="accordion__button" aria-expanded="false" aria-controls="accordion-${s.id}">
              <h3 class="accordion__title">${s.title}</h3>
              ${chevronIcon}
            </button>
            <div class="accordion__drawer" id="accordion-${s.id}" aria-hidden="true">
              <div class="accordion__content">
                ${s.files.map(f => `
                  <a href="#" class="download-item" onclick="event.preventDefault()">
                    ${downloadIcon}
                    <div class="download-item__info">
                      <div class="download-item__name">${f.name}</div>
                      <div class="download-item__meta">${f.format}&ensp;|&ensp;${f.size}&ensp;|&ensp;${f.date}</div>
                    </div>
                  </a>
                `).join('')}
              </div>
            </div>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

// ---- BELEGUNGSPLANUNG (Grundriss) ----

function occRenderTreeNode(node, depth) {
  if (!depth) depth = 0;
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = state.occExpandedIds.has(node.id);
  const isSelected = state.occSelectedId === node.id;
  const icon = RP_ICONS[node.type] || '';
  const countLabel = node.count ? ` (${node.count})` : '';
  const chevron = hasChildren
    ? `<svg class="rp-tree__chevron ${isExpanded ? 'rp-tree__chevron--open' : ''}" viewBox="0 0 12 12" width="12" height="12"><polyline points="4,2 8,6 4,10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : '<span class="rp-tree__chevron-spacer"></span>';

  let label = node.label;
  if (node.type === 'building' && node.code) label = `${node.code} \u2013 ${node.label}`;

  let html = `
    <div class="rp-tree__item ${isSelected ? 'rp-tree__item--selected' : ''}" data-id="${node.id}" data-depth="${depth}" style="padding-left:${depth * 16 + 8}px">
      ${chevron}
      <span class="rp-tree__icon">${icon}</span>
      <span class="rp-tree__label">${label}${countLabel}</span>
    </div>`;

  if (hasChildren && isExpanded) {
    html += node.children.map(c => occRenderTreeNode(c, depth + 1)).join('');
  }
  return html;
}

function occGetTabs(nodeType) {
  if (nodeType === 'building' || nodeType === 'floor') return [
    { id: 'map', label: 'Karte' },
    { id: 'overview', label: '\u00dcbersicht' },
    { id: 'metrics', label: 'Bemessungen' },
    { id: 'equipment', label: 'Ausstattung' }
  ];
  // default: portfolio view (country, kanton, no selection)
  return [
    { id: 'map', label: 'Karte' },
    { id: 'gallery', label: 'Galerie' }
  ];
}

function occRenderContent(selected) {
  if (!selected) return occRenderPortfolio();
  const { node, path } = selected;
  if (node.type === 'building') return occRenderBuilding(node, path);
  if (node.type === 'floor') return occRenderFloor(node, path);
  return occRenderPortfolio();
}

function occRenderPortfolio() {
  const tab = state.occTab;
  if (tab === 'gallery') {
    // Collect all buildings
    const buildings = [];
    (function collect(n) {
      if (n.type === 'building') buildings.push(n);
      if (n.children) n.children.forEach(collect);
    })(LOCATIONS);

    return `
      <div class="rp-gallery">
        ${buildings.map(b => `
          <div class="rp-gallery__card" data-select="${b.id}">
            <div class="rp-gallery__image">
              <img src="https://images.unsplash.com/${b.photo}?w=400&h=250&fit=crop&auto=format&q=80" alt="${escapeHtml(b.label)}" loading="lazy">
            </div>
            <div class="rp-gallery__body">
              <div class="rp-gallery__title">${escapeHtml(b.label)}</div>
              <div class="rp-gallery__meta">${b.code} &middot; ${b.address}</div>
            </div>
          </div>
        `).join('')}
      </div>`;
  }

  // Karte tab (default) — real Mapbox map
  return `<div id="rp-mapbox" class="rp-mapbox"></div>`;
}

function occRenderBuilding(b, path) {
  const tab = state.occTab;

  if (tab === 'map') {
    return `<div id="rp-mapbox" class="rp-mapbox"></div>`;
  }

  if (tab === 'metrics') {
    const floors = b.children || [];
    const totalFlaeche = floors.length > 0 ? b.flaeche : '\u2013';
    const totalPlaetze = floors.reduce((s, f) => s + (f.plaetze || 0), 0);
    return `
      <div class="rp-detail">
        <h2 class="rp-detail__title">${escapeHtml(b.label)}</h2>
        <p class="rp-detail__subtitle">${b.address}</p>
        <div class="rp-detail__section-title">Fl\u00e4chen nach Stockwerk</div>
        <table class="rp-table">
          <thead><tr><th>Stockwerk</th><th>Fl\u00e4che</th><th>Arbeitspl\u00e4tze</th><th>R\u00e4ume</th></tr></thead>
          <tbody>
            ${floors.map(f => `<tr class="rp-table__row--link" data-select="${f.id}"><td>${f.label}</td><td>${f.flaeche}</td><td>${f.plaetze}</td><td>${f.raeume}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><td><strong>Gesamt</strong></td><td><strong>${totalFlaeche}</strong></td><td><strong>${totalPlaetze}</strong></td><td></td></tr></tfoot>
        </table>
      </div>`;
  }

  if (tab === 'equipment') {
    return `
      <div class="rp-detail">
        <h2 class="rp-detail__title">${escapeHtml(b.label)}</h2>
        <p class="rp-detail__subtitle">${b.address}</p>
        <div class="rp-detail__section-title">Ausstattung</div>
        <div class="rp-detail__empty">Keine Ausstattungsdaten vorhanden.</div>
      </div>`;
  }

  // \u00dcbersicht (default)
  return `
    <div class="rp-detail">
      <div class="rp-detail__header">
        <h2 class="rp-detail__title">${escapeHtml(b.label)}</h2>
      </div>
      <p class="rp-detail__subtitle">${b.address}</p>

      <div class="rp-detail__media">
        <div class="rp-detail__photo">
          <img src="https://images.unsplash.com/${b.photo}?w=600&h=400&fit=crop&auto=format&q=80" alt="${escapeHtml(b.label)}" loading="lazy">
        </div>
      </div>

      <div class="rp-detail__section-title">Objektdaten</div>
      <div class="rp-detail__grid">
        <div class="rp-detail__field">
          <div class="rp-detail__field-label">Geb\u00e4ude-ID</div>
          <div class="rp-detail__field-value">${b.code}</div>
        </div>
        <div class="rp-detail__field">
          <div class="rp-detail__field-label">Geb\u00e4udestatus</div>
          <div class="rp-detail__field-value">${b.status}</div>
        </div>
        <div class="rp-detail__field">
          <div class="rp-detail__field-label">Geb\u00e4udekategorie</div>
          <div class="rp-detail__field-value">${b.kategorie}</div>
        </div>
        <div class="rp-detail__field">
          <div class="rp-detail__field-label">Bauperiode</div>
          <div class="rp-detail__field-value">${b.baujahr}</div>
        </div>
        <div class="rp-detail__field">
          <div class="rp-detail__field-label">Gesamtfl\u00e4che</div>
          <div class="rp-detail__field-value">${b.flaeche}</div>
        </div>
        <div class="rp-detail__field">
          <div class="rp-detail__field-label">Adresse</div>
          <div class="rp-detail__field-value">${b.address}</div>
        </div>
      </div>

      ${b.children && b.children.length ? `
        <div class="rp-detail__section-title">Stockwerke</div>
        <table class="rp-table">
          <thead><tr><th>Stockwerk</th><th>Fl\u00e4che</th><th>Arbeitspl\u00e4tze</th><th>R\u00e4ume</th></tr></thead>
          <tbody>
            ${b.children.map(f => `<tr class="rp-table__row--link" data-select="${f.id}"><td>${f.label}</td><td>${f.flaeche}</td><td>${f.plaetze}</td><td>${f.raeume}</td></tr>`).join('')}
          </tbody>
        </table>
      ` : ''}
    </div>`;
}

function occRenderFloor(floor, path) {
  const building = path.find(n => n.type === 'building');
  const tab = state.occTab;
  const bLabel = building ? building.label : '';

  if (tab === 'map') {
    return `<div id="rp-mapbox" class="rp-mapbox"></div>`;
  }

  if (tab === 'metrics') {
    const rooms = floor.rooms || [];

    return `
      <div class="rp-detail">
        <h2 class="rp-detail__title">${floor.label} \u2013 ${escapeHtml(bLabel)}</h2>
        <p class="rp-detail__subtitle">${floor.flaeche} &middot; ${floor.plaetze} Arbeitspl\u00e4tze &middot; ${floor.raeume} R\u00e4ume</p>
        <div class="rp-detail__section-title">Raumliste</div>
        <table class="rp-table">
          <thead><tr><th>Raum</th><th>Typ</th><th>Fl\u00e4che</th><th>Pl\u00e4tze</th></tr></thead>
          <tbody>
            ${rooms.map(r => `<tr><td>${escapeHtml(r.nr)}</td><td>${escapeHtml(r.type)}</td><td>${r.area} m\u00b2</td><td>${r.workspaces || '\u2013'}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  if (tab === 'equipment') {
    return `
      <div class="rp-detail">
        <h2 class="rp-detail__title">${floor.label} \u2013 ${escapeHtml(bLabel)}</h2>
        <p class="rp-detail__subtitle">${floor.flaeche} &middot; ${floor.plaetze} Arbeitspl\u00e4tze &middot; ${floor.raeume} R\u00e4ume</p>
        <div class="rp-detail__section-title">Ausstattung</div>
        <div class="rp-detail__empty">Keine Ausstattungsdaten vorhanden.</div>
      </div>`;
  }

  // \u00dcbersicht (default)
  return `
    <div class="rp-detail">
      <h2 class="rp-detail__title">${floor.label} \u2013 ${escapeHtml(bLabel)}</h2>
      <p class="rp-detail__subtitle">${floor.flaeche} &middot; ${floor.plaetze} Arbeitspl\u00e4tze &middot; ${floor.raeume} R\u00e4ume</p>

      <div class="rp-detail__grid">
        <div class="rp-detail__field">
          <div class="rp-detail__field-label">Stockwerk</div>
          <div class="rp-detail__field-value">${floor.label}</div>
        </div>
        <div class="rp-detail__field">
          <div class="rp-detail__field-label">Geb\u00e4ude</div>
          <div class="rp-detail__field-value">${escapeHtml(bLabel)}</div>
        </div>
        <div class="rp-detail__field">
          <div class="rp-detail__field-label">Fl\u00e4che</div>
          <div class="rp-detail__field-value">${floor.flaeche}</div>
        </div>
        <div class="rp-detail__field">
          <div class="rp-detail__field-label">Arbeitspl\u00e4tze</div>
          <div class="rp-detail__field-value">${floor.plaetze}</div>
        </div>
        <div class="rp-detail__field">
          <div class="rp-detail__field-label">R\u00e4ume</div>
          <div class="rp-detail__field-value">${floor.raeume}</div>
        </div>
      </div>
    </div>`;
}

function renderOccupancy() {
  const selected = state.occSelectedId ? occFindNode(state.occSelectedId) : null;
  const nodeType = selected ? selected.node.type : null;
  const tabs = occGetTabs(nodeType);

  // Ensure current tab is valid for this node type
  if (!tabs.find(t => t.id === state.occTab)) {
    state.occTab = tabs[0].id;
  }

  // Build breadcrumb from selected node path (full spatial hierarchy)
  const bcItems = [['Belegungsplanung', "navigateTo('occupancy')"]];
  if (selected) {
    selected.path.forEach(n => {
      const lbl = n.type === 'building' && n.code ? n.code : n.label;
      bcItems.push([lbl, `(function(){ state.occSelectedId='${n.id}'; state.occExpandedIds.add('${n.id}'); occUpdateView(); occPushHash(); })()`]);
    });
    const selNode = selected.node;
    const selLbl = selNode.type === 'building' && selNode.code ? selNode.code : selNode.label;
    bcItems.push([selLbl]);
  } else {
    // No selection — Belegungsplanung is the current page (no link)
    bcItems.length = 0;
    bcItems.push(['Belegungsplanung']);
  }

  return `
    ${renderBreadcrumb(...bcItems)}
    <div class="page-hero">
      <h1 class="page-hero__title">Belegungsplanung</h1>
      <p class="page-hero__subtitle">Standorte, Geb&auml;ude und Geschosse der Bundesverwaltung verwalten und visualisieren.</p>
    </div>
    <div class="rp-layout" id="mainContent">
      <aside class="rp-tree" role="tree" aria-label="Standortnavigation">
        <div class="rp-tree__header">
          <span class="rp-tree__header-label">Objekte</span>
          <button class="rp-tree__filter-btn" aria-label="Filter">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="2" y1="4" x2="14" y2="4"/><line x1="4" y1="8" x2="12" y2="8"/><line x1="6" y1="12" x2="10" y2="12"/></svg>
          </button>
        </div>
        <div class="rp-tree__body">
          ${occRenderTreeNode(LOCATIONS)}
        </div>
      </aside>
      <main class="rp-content">
        <div class="rp-tabs" role="tablist">
          ${tabs.map(t => `<button class="rp-tabs__tab ${state.occTab === t.id ? 'rp-tabs__tab--active' : ''}" role="tab" data-tab="${t.id}" aria-selected="${state.occTab === t.id}">${t.label}</button>`).join('')}
        </div>
        <div class="rp-content__body">
          ${occRenderContent(selected)}
        </div>
      </main>
    </div>
  `;
}

let _occMap = null;
let _searchMarker = null;

function occInitMap() {
  const container = document.getElementById('rp-mapbox');
  if (!container) return;

  // Clean up previous map instance
  if (_searchMarker) { _searchMarker.remove(); _searchMarker = null; }
  if (_occMap) {
    _occMap.remove();
    _occMap = null;
  }

  mapboxgl.accessToken = 'pk.eyJ1IjoiZGF2aWRyYXNuZXI1IiwiYSI6ImNtMm5yamVkdjA5MDcycXMyZ2I2MHRhamgifQ.m651j7WIX7MyxNh8KIQ1Gg';

  _occMap = new mapboxgl.Map({
    container: 'rp-mapbox',
    style: MAP_STYLES[state.occMapStyle] ? MAP_STYLES[state.occMapStyle].url : MAP_STYLES['light-v11'].url,
    center: [7.9, 47.1],
    zoom: 7.2
  });

  // Navigation controls — right, vertically centered via CSS
  _occMap.addControl(new mapboxgl.NavigationControl(), 'top-right');

  // Home button — zoom to full extent
  const homeCtrl = {
    onAdd(map) {
      const div = document.createElement('div');
      div.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
      div.innerHTML = '<button class="rp-map-btn rp-map-btn--home" type="button" title="Gesamtansicht" aria-label="Gesamtansicht"><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L10 4l7 6.5"/><path d="M5 9v6.5a.5.5 0 00.5.5H8v-4h4v4h2.5a.5.5 0 00.5-.5V9"/></svg></button>';
      div.querySelector('button').addEventListener('click', () => {
        map.flyTo({ center: [7.9, 47.1], zoom: 7.2, pitch: 0, bearing: 0 });
        const btn3d = container.querySelector('.rp-map-btn--3d span');
        if (btn3d) btn3d.textContent = '3D';
      });
      return div;
    },
    onRemove() {}
  };
  _occMap.addControl(homeCtrl, 'top-right');

  // 2D / 3D toggle
  const toggle3dCtrl = {
    onAdd(map) {
      const div = document.createElement('div');
      div.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
      div.innerHTML = '<button class="rp-map-btn rp-map-btn--3d" type="button" title="3D-Ansicht umschalten" aria-label="3D-Ansicht umschalten"><span>3D</span></button>';
      const btn = div.querySelector('button');
      btn.addEventListener('click', () => {
        const is3D = map.getPitch() > 0;
        if (is3D) {
          map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
          btn.querySelector('span').textContent = '3D';
        } else {
          map.easeTo({ pitch: 60, bearing: -20, duration: 600 });
          btn.querySelector('span').textContent = '2D';
        }
      });
      return div;
    },
    onRemove() {}
  };
  _occMap.addControl(toggle3dCtrl, 'top-right');

  // Swisstopo address search overlay — click-extend pattern (like header search)
  const searchEl = document.createElement('div');
  searchEl.className = 'rp-map-search';
  searchEl.innerHTML = `
    <form class="rp-map-search__form" role="search" aria-label="Adresse suchen">
      <input class="rp-map-search__input" type="text" placeholder="Adresse suchen\u2026" autocomplete="off">
      <button class="rp-map-search__btn" type="button" aria-label="Adresse suchen">
        <span class="rp-map-search__label">Suche</span>
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="13" y1="13" x2="17" y2="17"/></svg>
      </button>
    </form>
    <div class="rp-map-search__results"></div>`;
  container.appendChild(searchEl);

  const searchBtn = searchEl.querySelector('.rp-map-search__btn');
  const searchInput = searchEl.querySelector('.rp-map-search__input');
  const searchResults = searchEl.querySelector('.rp-map-search__results');

  searchBtn.addEventListener('click', () => {
    const isOpen = searchEl.classList.contains('rp-map-search--open');
    if (isOpen) {
      searchEl.classList.remove('rp-map-search--open');
      searchInput.value = '';
      searchResults.innerHTML = '';
    } else {
      searchEl.classList.add('rp-map-search--open');
      searchInput.focus();
    }
  });

  // Close search on Escape
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchEl.classList.remove('rp-map-search--open');
      searchInput.value = '';
      searchResults.innerHTML = '';
    }
  });

  // Close search when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchEl.contains(e.target) && searchEl.classList.contains('rp-map-search--open')) {
      searchEl.classList.remove('rp-map-search--open');
      searchInput.value = '';
      searchResults.innerHTML = '';
    }
  });

  let _searchDebounce = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(_searchDebounce);
    const q = searchInput.value.trim();
    if (q.length < 2) { searchResults.innerHTML = ''; return; }
    _searchDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`https://api3.geo.admin.ch/rest/services/ech/SearchServer?searchText=${encodeURIComponent(q)}&type=locations&limit=6&sr=4326`);
        const data = await res.json();
        if (!data.results || !data.results.length) {
          searchResults.innerHTML = '<div class="rp-map-search__empty">Keine Ergebnisse</div>';
          return;
        }
        searchResults.innerHTML = data.results.map((r, i) =>
          `<button class="rp-map-search__item" data-idx="${i}" type="button">${r.attrs.label.replace(/<[^>]+>/g, '')}</button>`
        ).join('');
        searchResults.querySelectorAll('.rp-map-search__item').forEach((btn, i) => {
          btn.addEventListener('click', () => {
            const r = data.results[i];
            const lngLat = [r.attrs.lon, r.attrs.lat];
            if (_searchMarker) _searchMarker.remove();
            _searchMarker = new mapboxgl.Marker({ color: '#0066cc' }).setLngLat(lngLat).addTo(_occMap);
            _occMap.flyTo({ center: lngLat, zoom: 17, speed: 1.4 });
            searchEl.classList.remove('rp-map-search--open');
            searchInput.value = '';
            searchResults.innerHTML = '';
          });
        });
      } catch (e) {
        searchResults.innerHTML = '<div class="rp-map-search__empty">Fehler bei der Suche</div>';
      }
    }, 300);
  });

  // Scale bar — bottom-left
  _occMap.addControl(new mapboxgl.ScaleControl({ maxWidth: 200 }), 'bottom-left');

  // Background map style switcher — bottom-right
  function getStyleThumbnail(styleId, w, h) {
    return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/7.45,46.95,13,0/${w}x${h}@2x?access_token=${mapboxgl.accessToken}&attribution=false&logo=false`;
  }

  const styleSwitcher = document.createElement('div');
  styleSwitcher.className = 'rp-style-switcher';
  styleSwitcher.innerHTML = `
    <div class="rp-style-switcher__panel" id="rp-style-panel">
      ${Object.entries(MAP_STYLES).map(([id, s]) => `
        <button class="rp-style-option${id === state.occMapStyle ? ' rp-style-option--active' : ''}" data-style="${id}" title="${s.name}">
          <img src="${getStyleThumbnail(id, 70, 50)}" alt="${s.name}">
          <span>${s.name}</span>
        </button>`).join('')}
    </div>
    <button class="rp-style-switcher__btn" id="rp-style-btn" title="Hintergrund wechseln">
      <img src="${getStyleThumbnail(state.occMapStyle, 80, 60)}" alt="Aktueller Stil">
      <span>Hintergrund</span>
    </button>`;
  container.appendChild(styleSwitcher);

  const styleBtn = styleSwitcher.querySelector('#rp-style-btn');
  const stylePanel = styleSwitcher.querySelector('#rp-style-panel');

  styleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    stylePanel.classList.toggle('rp-style-switcher__panel--show');
    styleBtn.classList.toggle('rp-style-switcher__btn--active');
  });

  document.addEventListener('click', (e) => {
    if (!styleSwitcher.contains(e.target)) {
      stylePanel.classList.remove('rp-style-switcher__panel--show');
      styleBtn.classList.remove('rp-style-switcher__btn--active');
    }
  });

  styleSwitcher.querySelectorAll('.rp-style-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const styleId = opt.dataset.style;
      if (styleId === state.occMapStyle) return;
      state.occMapStyle = styleId;
      // Update active state
      styleSwitcher.querySelectorAll('.rp-style-option').forEach(o => o.classList.remove('rp-style-option--active'));
      opt.classList.add('rp-style-option--active');
      // Update main button thumbnail
      styleBtn.querySelector('img').src = getStyleThumbnail(styleId, 80, 60);
      // Change map style
      _occMap.setStyle(MAP_STYLES[styleId].url);
      // Persist in URL
      occPushHash();
      // Close panel
      stylePanel.classList.remove('rp-style-switcher__panel--show');
      styleBtn.classList.remove('rp-style-switcher__btn--active');
    });
  });

  // Re-add data layers after style change
  _occMap.on('style.load', () => {
    if (!BUILDINGS_GEO) return;
    if (_occMap.getSource('buildings')) return; // already loaded

    let filteredGeo = BUILDINGS_GEO;
    const selId = state.occSelectedId;
    if (selId && selId !== 'ch') {
      const found = occFindNode(selId);
      if (found) {
        const node = found.node;
        let buildingIds;
        if (node.type === 'kanton') buildingIds = (node.children || []).map(b => b.id);
        else if (node.type === 'building') buildingIds = [node.id];
        else if (node.type === 'floor') {
          const parentB = found.path.find(n => n.type === 'building');
          buildingIds = parentB ? [parentB.id] : [];
        }
        if (buildingIds && buildingIds.length) {
          filteredGeo = { type: 'FeatureCollection', features: BUILDINGS_GEO.features.filter(f => buildingIds.includes(f.properties.buildingId)) };
        }
      }
    }
    _occMap.addSource('buildings', { type: 'geojson', data: filteredGeo });
    _occMap.addLayer({ id: 'building-points', type: 'circle', source: 'buildings', paint: { 'circle-radius': 8, 'circle-color': '#d73027', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });
    _occMap.addLayer({ id: 'building-labels', type: 'symbol', source: 'buildings', minzoom: 14, layout: { 'text-field': ['get', 'objectCode'], 'text-size': 12, 'text-anchor': 'bottom', 'text-offset': [0, -1.2], 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-allow-overlap': true }, paint: { 'text-color': '#1a1a1a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });
  });

  _occMap.on('load', () => {
    if (!BUILDINGS_GEO) return;

    // Determine which buildings to show based on current selection
    let filteredGeo = BUILDINGS_GEO;
    const selId = state.occSelectedId;
    if (selId && selId !== 'ch') {
      const found = occFindNode(selId);
      if (found) {
        const node = found.node;
        let buildingIds;
        if (node.type === 'kanton') {
          // Show all buildings in this site/kanton
          buildingIds = (node.children || []).map(b => b.id);
        } else if (node.type === 'building') {
          buildingIds = [node.id];
        } else if (node.type === 'floor') {
          // Show parent building
          const parentB = found.path.find(n => n.type === 'building');
          buildingIds = parentB ? [parentB.id] : [];
        }
        if (buildingIds && buildingIds.length) {
          filteredGeo = {
            type: 'FeatureCollection',
            features: BUILDINGS_GEO.features.filter(f => buildingIds.includes(f.properties.buildingId))
          };
        }
      }
    }

    _occMap.addSource('buildings', {
      type: 'geojson',
      data: filteredGeo
    });

    _occMap.addLayer({
      id: 'building-points',
      type: 'circle',
      source: 'buildings',
      paint: {
        'circle-radius': 8,
        'circle-color': '#d73027',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    _occMap.addLayer({
      id: 'building-labels',
      type: 'symbol',
      source: 'buildings',
      minzoom: 14,
      layout: {
        'text-field': ['get', 'objectCode'],
        'text-size': 12,
        'text-anchor': 'bottom',
        'text-offset': [0, -1.2],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-allow-overlap': true
      },
      paint: {
        'text-color': '#1a1a1a',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5
      }
    });

    // Fit map to visible features
    if (filteredGeo.features.length > 0 && selId && selId !== 'ch') {
      if (filteredGeo.features.length === 1) {
        // Single building — fly to it at building zoom level
        const coords = filteredGeo.features[0].geometry.coordinates;
        _occMap.jumpTo({ center: coords, zoom: 17 });
      } else {
        // Multiple buildings — fit bounds
        const bounds = new mapboxgl.LngLatBounds();
        filteredGeo.features.forEach(f => bounds.extend(f.geometry.coordinates));
        _occMap.fitBounds(bounds, { padding: 80, maxZoom: 15 });
      }
    }

    // Click on building marker or label
    const handleMarkerClick = (e) => {
      const feature = e.features[0];
      const buildingId = feature.properties.buildingId;
      state.occSelectedId = buildingId;
      const found = occFindNode(buildingId);
      if (found) {
        found.path.forEach(n => state.occExpandedIds.add(n.id));
        const tabs = occGetTabs(found.node.type);
        state.occTab = tabs[0].id;
      }
      occUpdateView();
      occPushHash();
    };
    _occMap.on('click', 'building-points', handleMarkerClick);
    _occMap.on('click', 'building-labels', handleMarkerClick);

    // Pointer cursor on hover
    ['building-points', 'building-labels'].forEach(layer => {
      _occMap.on('mouseenter', layer, () => {
        _occMap.getCanvas().style.cursor = 'pointer';
      });
      _occMap.on('mouseleave', layer, () => {
        _occMap.getCanvas().style.cursor = '';
      });
    });

    // Popup on hover (show building name)
    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
    const showPopup = (e) => {
      const f = e.features[0];
      popup.setLngLat(f.geometry.coordinates)
        .setHTML(`<strong>${f.properties.name}</strong>`)
        .addTo(_occMap);
    };
    const hidePopup = () => popup.remove();
    _occMap.on('mouseenter', 'building-points', showPopup);
    _occMap.on('mouseleave', 'building-points', hidePopup);
    _occMap.on('mouseenter', 'building-labels', showPopup);
    _occMap.on('mouseleave', 'building-labels', hidePopup);
  });
}

// Incremental update for the occupancy page — avoids full render() which destroys the map
function occUpdateView() {
  const selected = state.occSelectedId ? occFindNode(state.occSelectedId) : null;
  const nodeType = selected ? selected.node.type : null;
  const tabs = occGetTabs(nodeType);
  if (!tabs.find(t => t.id === state.occTab)) {
    state.occTab = tabs[0].id;
  }

  // Update breadcrumb (full spatial hierarchy)
  const bcItems = [['Belegungsplanung', "navigateTo('occupancy')"]];
  if (selected) {
    selected.path.forEach(n => {
      const lbl = n.type === 'building' && n.code ? n.code : n.label;
      bcItems.push([lbl, `(function(){ state.occSelectedId='${n.id}'; state.occExpandedIds.add('${n.id}'); occUpdateView(); occPushHash(); })()`]);
    });
    const selNode = selected.node;
    const selLbl = selNode.type === 'building' && selNode.code ? selNode.code : selNode.label;
    bcItems.push([selLbl]);
  } else {
    bcItems.length = 0;
    bcItems.push(['Belegungsplanung']);
  }
  const bcEl = document.querySelector('.breadcrumb-bar');
  if (bcEl) bcEl.outerHTML = renderBreadcrumb(...bcItems);

  // Update tree
  const treeBody = document.querySelector('.rp-tree__body');
  if (treeBody) treeBody.innerHTML = occRenderTreeNode(LOCATIONS);

  // Update tabs
  const tablist = document.querySelector('.rp-tabs');
  if (tablist) {
    tablist.innerHTML = tabs.map(t =>
      `<button class="rp-tabs__tab ${state.occTab === t.id ? 'rp-tabs__tab--active' : ''}" role="tab" data-tab="${t.id}" aria-selected="${state.occTab === t.id}">${t.label}</button>`
    ).join('');
  }

  // Update content body — but preserve the live map if we're staying on the map tab
  const contentBody = document.querySelector('.rp-content__body');
  if (contentBody) {
    const liveMapContainer = contentBody.querySelector('#rp-mapbox');
    if (state.occTab === 'map' && liveMapContainer && _occMap && _occMap.getContainer() === liveMapContainer) {
      // Map is already live in this container — just pan/zoom, don't touch the DOM
      occUpdateMap();
    } else {
      contentBody.innerHTML = occRenderContent(selected);
      const mapContainer = document.getElementById('rp-mapbox');
      if (mapContainer) {
        if (_occMap) { _occMap.remove(); _occMap = null; }
        occInitMap();
      } else {
        if (_occMap) { _occMap.remove(); _occMap = null; }
      }
    }
  }

  // Re-attach events on updated DOM
  occAttachTreeEvents();
  occAttachContentEvents();
}

// Update existing map source/bounds without destroying the map instance
function occUpdateMap() {
  if (!_occMap) return;
  const source = _occMap.getSource('buildings');
  if (!source) return;

  let filteredGeo = BUILDINGS_GEO;
  const selId = state.occSelectedId;
  if (selId && selId !== 'ch') {
    const found = occFindNode(selId);
    if (found) {
      const node = found.node;
      let buildingIds;
      if (node.type === 'kanton') {
        buildingIds = (node.children || []).map(b => b.id);
      } else if (node.type === 'building') {
        buildingIds = [node.id];
      } else if (node.type === 'floor') {
        const parentB = found.path.find(n => n.type === 'building');
        buildingIds = parentB ? [parentB.id] : [];
      }
      if (buildingIds && buildingIds.length) {
        filteredGeo = {
          type: 'FeatureCollection',
          features: BUILDINGS_GEO.features.filter(f => buildingIds.includes(f.properties.buildingId))
        };
      }
    }
  }

  source.setData(filteredGeo);

  if (filteredGeo.features.length > 0 && selId && selId !== 'ch') {
    if (filteredGeo.features.length === 1) {
      // Single building — fly to it at building zoom level
      const coords = filteredGeo.features[0].geometry.coordinates;
      _occMap.flyTo({ center: coords, zoom: 17, speed: 1.4 });
    } else {
      // Multiple buildings in kanton — fit bounds
      const bounds = new mapboxgl.LngLatBounds();
      filteredGeo.features.forEach(f => bounds.extend(f.geometry.coordinates));
      _occMap.fitBounds(bounds, { padding: 80, maxZoom: 15 });
    }
  } else if (!selId || selId === 'ch') {
    // Reset to default Switzerland view
    _occMap.flyTo({ center: [7.9, 47.1], zoom: 7.2 });
  }
}

// Attach click handlers to tree items
function occAttachTreeEvents() {
  document.querySelectorAll('.rp-tree__item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const found = occFindNode(id);
      if (!found) return;

      const hasChildren = found.node.children && found.node.children.length > 0;

      if (state.occSelectedId === id && hasChildren) {
        if (state.occExpandedIds.has(id)) state.occExpandedIds.delete(id);
        else state.occExpandedIds.add(id);
      } else {
        state.occSelectedId = id;
        if (hasChildren) state.occExpandedIds.add(id);
        const tabs = occGetTabs(found.node.type);
        state.occTab = tabs[0].id;
      }

      occUpdateView();
      occPushHash();
    });
  });
}

// Attach click handlers to content area elements (tabs, table rows, gallery cards, etc.)
function occAttachContentEvents() {
  document.querySelectorAll('.rp-tabs__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.occTab = tab.dataset.tab;
      occUpdateView();
      occPushHash();
    });
  });

  document.querySelectorAll('.rp-table__row--link, .rp-gallery__card').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.select;
      if (!id) return;
      state.occSelectedId = id;
      const found = occFindNode(id);
      if (found) {
        found.path.forEach(n => state.occExpandedIds.add(n.id));
        const tabs = occGetTabs(found.node.type);
        state.occTab = tabs[0].id;
      }
      occUpdateView();
      occPushHash();
    });
  });

}

// Push current occupancy state to URL hash
function occPushHash() {
  let hash = '#/occupancy';
  if (state.occSelectedId && state.occSelectedId !== 'ch') {
    hash += '/' + state.occSelectedId;
    if (state.occTab && state.occTab !== 'map') {
      hash += '/' + state.occTab;
    }
  }
  // Append map style as query parameter if not default
  if (state.occMapStyle && state.occMapStyle !== 'light-v11') {
    hash += (hash.includes('?') ? '&' : '?') + 'bg=' + state.occMapStyle;
  }
  history.pushState(null, '', hash);
}

function attachOccupancyEvents() {
  // Initialize Mapbox map if container exists
  occInitMap();

  // Attach event handlers
  occAttachTreeEvents();
  occAttachContentEvents();
}

// ---- CIRCULAR (Gebrauchte Möbel) ----
function renderCircular() {
  const items = filterFurnitureItems();
  const catLabel = getCategoryLabel(state.activeCategory);
  const parent = getParentCategory(state.activeCategory);

  const bcItems = [['Gebrauchte M\u00f6bel', "navigateTo('circular')"]];
  if (state.activeCategory !== 'alle') {
    if (parent) {
      bcItems.push([parent.label, `setCategory('${parent.id}')`]);
    }
    bcItems.push([catLabel]);
  }

  return `
    ${renderBreadcrumb(...bcItems)}
    <div class="container container--with-top-pad">
      <div class="page-hero">
        <h1 class="page-hero__title">Gebrauchte M\u00f6bel</h1>
        <p class="page-hero__subtitle">Gebrauchtes Mobiliar wiederverwenden statt entsorgen. Objekte scannen, erfassen und im Angebot verf\u00fcgbarer M\u00f6bel suchen.</p>
      </div>

      <div class="tile-grid tile-grid--3col">
        <div class="card card--centered card--clickable" onclick="navigateTo('scan')" role="button" tabindex="0">
          <h3 class="card__title">Objekt scannen</h3>
          <p class="card__description">Scannen Sie den QR-Code oder geben Sie die Inventar-Nummer eines M\u00f6belst\u00fccks ein, um dessen Status und Verf\u00fcgbarkeit zu pr\u00fcfen.</p>
          <div class="card__arrow"><span class="card__arrow-icon">&rarr;</span></div>
        </div>
        <div class="card card--centered card--clickable" onclick="navigateTo('register')" role="button" tabindex="0">
          <h3 class="card__title">Neues Objekt erfassen</h3>
          <p class="card__description">Gebrauchtes Mobiliar ins System eintragen und f\u00fcr andere Bundesstellen verf\u00fcgbar machen.</p>
          <div class="card__arrow"><span class="card__arrow-icon">&rarr;</span></div>
        </div>
        <div class="card card--centered card--clickable" onclick="navigateTo('charter')" role="button" tabindex="0">
          <h3 class="card__title">Charta kreislauforientiertes Bauen</h3>
          <p class="card__description">Erfahren Sie mehr \u00fcber unsere Strategie f\u00fcr Kreislaufwirtschaft und nachhaltiges Bauen in der Bundesverwaltung.</p>
          <div class="card__arrow"><span class="card__arrow-icon">&rarr;</span></div>
        </div>
      </div>

    </div>
    <div class="app-layout">
      <aside class="sidebar" role="navigation" aria-label="Kategorien">
        <div class="sidebar__title">Kategorien</div>
        <div class="cat-tree" role="tree">
          ${renderCategoryTree(CATEGORIES, countFurnitureInCategory)}
        </div>
      </aside>
      <main class="main-content" id="mainContent">
        <div class="toolbar">
          <div class="search">
            <input class="search__field" type="search" placeholder="Gebrauchte M\u00f6bel suchen..." id="searchInput" value="${escapeHtml(state.searchQuery)}" aria-label="Gebrauchte M\u00f6bel suchen">
            <button class="search__button" aria-label="Suchen">${ICONS.search}</button>
          </div>
          <select class="select" id="sortSelect" aria-label="Sortierung">
            <option value="name-asc" ${state.sortBy==='name-asc'?'selected':''}>Name A-Z</option>
            <option value="name-desc" ${state.sortBy==='name-desc'?'selected':''}>Name Z-A</option>
            <option value="price-asc" ${state.sortBy==='price-asc'?'selected':''}>Preis aufsteigend</option>
            <option value="price-desc" ${state.sortBy==='price-desc'?'selected':''}>Preis absteigend</option>
          </select>
          <span class="toolbar__count">${items.length} Objekt${items.length !== 1 ? 'e' : ''}</span>
        </div>
        ${items.length ? `
          <div class="product-grid" id="productGrid">
            ${items.map(f => renderFurnitureCard(f)).join('')}
          </div>
        ` : `
          <div class="no-results">
            <div class="no-results__icon">${ICONS.placeholder}</div>
            <p class="no-results__text">Keine gebrauchten M\u00f6bel gefunden.</p>
          </div>
        `}
      </main>
    </div>
  `;
}

// ---- OBJEKT SCANNEN ----
function renderScan() {
  return `
    ${renderBreadcrumb(['Gebrauchte M\u00f6bel', "navigateTo('circular')"], ['Objekt scannen'])}
    <div class="container container--with-top-pad" id="mainContent">
      <div class="page-hero">
        <h1 class="page-hero__title">Objekt scannen</h1>
        <p class="page-hero__subtitle">Scannen Sie den QR-Code auf dem M\u00f6belst\u00fcck oder geben Sie die Inventar-Nummer manuell ein.</p>
      </div>

      <div class="scan-area">
        <div class="scan-area__visual">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7z"/><rect x="14" y="14" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.3"/></svg>
          <span>QR scannen</span>
        </div>
        <div class="scan-area__content">
          <h3 class="scan-area__title">Objekt identifizieren</h3>
          <p class="scan-area__text">Scannen Sie den QR-Code auf dem M\u00f6belst\u00fcck oder geben Sie die Inventar-Nummer manuell ein, um den Status und die Historie des Objekts einzusehen.</p>
          <div class="scan-area__input-row">
            <input class="scan-area__input" type="text" placeholder="z.B. INV-2024-001234">
            <button class="btn btn--filled">Suchen</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---- NEUES OBJEKT ERFASSEN ----
function renderRegister() {
  return `
    ${renderBreadcrumb(['Gebrauchte M\u00f6bel', "navigateTo('circular')"], ['Neues Objekt erfassen'])}
    <div class="container container--with-top-pad" id="mainContent">
      <div class="page-hero">
        <h1 class="page-hero__title">Neues Objekt erfassen</h1>
        <p class="page-hero__subtitle">Erfassen Sie gebrauchtes Mobiliar und machen Sie es f\u00fcr andere Bundesstellen verf\u00fcgbar.</p>
      </div>

      <div class="form-card">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Bezeichnung</label>
            <input class="form-input" type="text" placeholder="z.B. B\u00fcrostuhl Giroflex 64">
          </div>
          <div class="form-group">
            <label class="form-label">Marke</label>
            <input class="form-input" type="text" placeholder="z.B. Giroflex">
          </div>
          <div class="form-group">
            <label class="form-label">Kategorie</label>
            <select class="form-select">
              <option value="">Bitte w\u00e4hlen...</option>
              ${CATEGORIES.filter(c => c.id !== 'alle').map(c => `<option value="${c.id}">${c.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Zustand</label>
            <select class="form-select">
              <option value="">Bitte w\u00e4hlen...</option>
              <option>Sehr gut</option>
              <option>Gut</option>
              <option>Akzeptabel</option>
              <option>Reparaturbed\u00fcrftig</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Standort / Geb\u00e4ude</label>
            <input class="form-input" type="text" placeholder="z.B. Bundeshaus West, 3. OG">
          </div>
          <div class="form-group">
            <label class="form-label">Inventar-Nr.</label>
            <input class="form-input" type="text" placeholder="z.B. INV-2024-001234">
          </div>
          <div class="form-group form-group--full">
            <label class="form-label">Bemerkungen</label>
            <textarea class="form-textarea" placeholder="Zus\u00e4tzliche Informationen zum Objekt..."></textarea>
          </div>
          <div class="form-actions">
            <button class="btn btn--filled">Objekt erfassen</button>
            <button class="btn btn--outline">Abbrechen</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---- CHARTA KREISLAUFORIENTIERTES BAUEN ----
function renderCharter() {
  return `
    ${renderBreadcrumb(['Gebrauchte M\u00f6bel', "navigateTo('circular')"], ['Charta kreislauforientiertes Bauen'])}
    <div class="container container--with-top-pad" id="mainContent">
      <div class="placeholder-area">
        <div class="placeholder-area__icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M21.21 15.89A10 10 0 118 2.83"/><path d="M22 12A10 10 0 0012 2v10z"/></svg>
        </div>
        <div class="placeholder-area__title">Charta kreislauforientiertes Bauen (in Entwicklung)</div>
        <p class="placeholder-area__text">Unsere Strategie f\u00fcr Kreislaufwirtschaft und nachhaltiges Bauen.<br>Diese Seite wird in einer zuk\u00fcnftigen Version verf\u00fcgbar sein.</p>
      </div>
    </div>
  `;
}

// ---- SEARCH RESULTS ----
function filterGlobalSearch() {
  const q = state.globalSearchQuery.toLowerCase().trim();
  if (!q) return [];
  let results = PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.brand.toLowerCase().includes(q) ||
    getCategoryLabel(p.category).toLowerCase().includes(q) ||
    getCategoryLabel(p.subcategory).toLowerCase().includes(q)
  );

  if (state.searchFilterCategory) {
    const ids = getAllSubcategoryIds(state.searchFilterCategory);
    results = results.filter(p => ids.includes(p.category) || ids.includes(p.subcategory));
  }

  if (state.searchFilterBrand) {
    results = results.filter(p => p.brand === state.searchFilterBrand);
  }

  switch (state.searchSortBy) {
    case 'name-asc':  results.sort((a, b) => a.name.localeCompare(b.name, 'de')); break;
    case 'name-desc': results.sort((a, b) => b.name.localeCompare(a.name, 'de')); break;
    case 'price-asc': results.sort((a, b) => a.price - b.price); break;
    case 'price-desc':results.sort((a, b) => b.price - a.price); break;
  }

  return results;
}

function renderSearch() {
  const results = filterGlobalSearch();
  const q = escapeHtml(state.globalSearchQuery);

  // Collect unique brands and top-level categories from all products for filter options
  const allBrands = [...new Set(PRODUCTS.map(p => p.brand))].sort((a, b) => a.localeCompare(b, 'de'));
  const topCategories = CATEGORIES.filter(c => c.id !== 'alle');

  return `
    ${renderBreadcrumb(['Suchergebnisse'])}
    <div class="container container--with-top-pad" id="mainContent">
      <h1 class="search-page__title">Suchergebnisse</h1>

      <div class="search-page__input-wrapper">
        <form class="search-page__form" id="searchPageForm" role="search">
          <input class="search-page__input" id="searchPageInput" type="search" value="${q}" placeholder="Suchbegriff eingeben" aria-label="Suchbegriff eingeben">
          <button class="search-page__submit" type="submit" aria-label="Suchen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
          </button>
        </form>
      </div>

      <button class="search-page__filter-toggle" id="filterToggle" aria-expanded="true">
        <svg class="search-page__filter-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,9 12,15 18,9"/></svg>
        <span id="filterToggleLabel">Filter ausblenden</span>
      </button>

      <div class="search-page__filters" id="searchFilters">
        <div class="search-page__filter-grid">
          <div class="form-group">
            <label class="form-label">Kategorie</label>
            <select class="form-select" id="searchFilterCat">
              <option value="">Alle Kategorien</option>
              ${topCategories.map(c => `<option value="${c.id}" ${state.searchFilterCategory === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Marke</label>
            <select class="form-select" id="searchFilterBrand">
              <option value="">Alle Marken</option>
              ${allBrands.map(b => `<option value="${b}" ${state.searchFilterBrand === b ? 'selected' : ''}>${b}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Sortierung</label>
            <select class="form-select" id="searchSortSelect">
              <option value="name-asc" ${state.searchSortBy==='name-asc'?'selected':''}>Name A\u2013Z</option>
              <option value="name-desc" ${state.searchSortBy==='name-desc'?'selected':''}>Name Z\u2013A</option>
              <option value="price-asc" ${state.searchSortBy==='price-asc'?'selected':''}>Preis aufsteigend</option>
              <option value="price-desc" ${state.searchSortBy==='price-desc'?'selected':''}>Preis absteigend</option>
            </select>
          </div>
        </div>
      </div>

      <div class="search-results__header">
        <div class="search-results__count">
          <strong>${results.length}</strong> Suchergebnis${results.length !== 1 ? 'se' : ''}
        </div>
        <div class="search-results__sort-label">
          Sortieren: ${state.searchSortBy === 'name-asc' ? 'Name A\u2013Z' : state.searchSortBy === 'name-desc' ? 'Name Z\u2013A' : state.searchSortBy === 'price-asc' ? 'Preis \u2191' : 'Preis \u2193'}
        </div>
      </div>

      ${results.length ? `
        <div class="product-grid product-grid--search" id="searchResultsGrid">
          ${results.map(p => renderProductCard(p)).join('')}
        </div>
      ` : `
        <div class="no-results">
          <div class="no-results__icon">${ICONS.placeholder}</div>
          <p class="no-results__text">${q ? `Keine Ergebnisse f\u00fcr \u00ab${q}\u00bb gefunden.` : 'Bitte geben Sie einen Suchbegriff ein.'}</p>
        </div>
      `}
    </div>
  `;
}

function attachSearchEvents() {
  // Search page form submit
  const form = document.getElementById('searchPageForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('searchPageInput');
      state.globalSearchQuery = input.value;
      render();
    });
  }

  // Filter toggle
  const toggle = document.getElementById('filterToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const filters = document.getElementById('searchFilters');
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      filters.classList.toggle('search-page__filters--hidden');
      document.getElementById('filterToggleLabel').textContent = expanded ? 'Filter einblenden' : 'Filter ausblenden';
    });
  }

  // Filter selects
  const catSelect = document.getElementById('searchFilterCat');
  if (catSelect) {
    catSelect.addEventListener('change', () => {
      state.searchFilterCategory = catSelect.value;
      render();
    });
  }

  const brandSelect = document.getElementById('searchFilterBrand');
  if (brandSelect) {
    brandSelect.addEventListener('change', () => {
      state.searchFilterBrand = brandSelect.value;
      render();
    });
  }

  const sortSelect = document.getElementById('searchSortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.searchSortBy = sortSelect.value;
      render();
    });
  }
}

// ---- SHOPPING CART ----
function renderCart() {
  const cartItems = state.cart.map((item, i) => {
    const p = PRODUCTS.find(x => x.id === item.productId);
    if (!p) return '';
    const lineTotal = p.price * item.quantity;
    const photoId = PRODUCT_IMAGES[p.id];
    const imgHtml = photoId
      ? `<img src="https://images.unsplash.com/${photoId}?w=120&h=80&fit=crop&auto=format&q=80" alt="${escapeHtml(p.name)}">`
      : getProductIcon(p);
    return `
      <div class="cart-item">
        <div class="cart-item__image">${imgHtml}</div>
        <div class="cart-item__info">
          <div class="cart-item__name">${escapeHtml(p.name)}</div>
          <div class="cart-item__unit-price">Preis pro St\u00fcck: ${p.currency} ${p.price.toFixed(2)}</div>
        </div>
        <div class="cart-item__quantity">
          <label class="cart-item__qty-label" for="qty-${i}">Anzahl</label>
          <input type="number" id="qty-${i}" class="cart-item__qty-input" value="${item.quantity}" min="1" max="99" data-index="${i}">
        </div>
        <div class="cart-item__total">${p.currency} ${lineTotal.toFixed(2)}</div>
        <button class="cart-item__remove" aria-label="Entfernen" data-index="${i}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          <span>Entfernen</span>
        </button>
      </div>
    `;
  }).join('');

  const total = getCartTotal();
  const currency = state.cart.length > 0 ? (PRODUCTS.find(x => x.id === state.cart[0].productId)?.currency || 'CHF') : 'CHF';

  const step1Active = state.cartStep === 1;
  const step2Active = state.cartStep === 2;
  const step3Active = state.cartStep === 3;

  return `
    ${renderBreadcrumb(['Produktkatalog', "navigateTo('shop')"], ['Warenkorb'])}
    <div class="container container--with-top-pad" id="mainContent">
      <div class="detail-toolbar">
        <button class="btn btn--outline btn--sm detail-toolbar__back" onclick="history.back()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/></svg>
          Zur\u00fcck
        </button>
        <div class="detail-toolbar__actions">
          <button class="detail-toolbar__icon" aria-label="Drucken" onclick="window.print()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          </button>
        </div>
      </div>

      <h1 class="cart-page__title">Warenkorb</h1>

      ${state.cart.length === 0 ? `
        <div class="no-results">
          <div class="no-results__icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          </div>
          <p class="no-results__text">Ihr Warenkorb ist leer.</p>
          <div style="margin-top:var(--space-lg)">
            <a href="#/shop" class="btn btn--filled" onclick="navigateTo('shop');return false">Zum Produktkatalog</a>
          </div>
        </div>
      ` : `
        <ul class="wizard-accordion">
          <!-- Step 1: Warenkorb -->
          <li class="wizard-accordion__step ${step1Active ? 'wizard-accordion__step--active' : ''} ${state.cartStep > 1 ? 'wizard-accordion__step--done' : ''}">
            <button class="wizard-accordion__header" aria-expanded="${step1Active}" aria-controls="wizard-step-1" data-step="1">
              <span class="wizard-accordion__number">1</span>
              <span class="wizard-accordion__label">Ihr Warenkorb</span>
              <svg class="wizard-accordion__chevron" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,9 12,15 18,9"/></svg>
            </button>
            <div class="wizard-accordion__panel" id="wizard-step-1" ${step1Active ? '' : 'aria-hidden="true"'}>
              <div class="wizard-accordion__content">
                <div class="cart-items">
                  ${cartItems}
                </div>
              </div>
            </div>
          </li>

          <!-- Step 2: Adresse -->
          <li class="wizard-accordion__step ${step2Active ? 'wizard-accordion__step--active' : ''} ${state.cartStep > 2 ? 'wizard-accordion__step--done' : ''}">
            <button class="wizard-accordion__header" aria-expanded="${step2Active}" aria-controls="wizard-step-2" data-step="2">
              <span class="wizard-accordion__number">2</span>
              <span class="wizard-accordion__label">Rechnungsadresse &amp; Lieferadresse</span>
              <svg class="wizard-accordion__chevron" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,9 12,15 18,9"/></svg>
            </button>
            <div class="wizard-accordion__panel" id="wizard-step-2" ${step2Active ? '' : 'aria-hidden="true"'}>
              <div class="wizard-accordion__content">
                <div class="form-card" style="border:none;padding:0">
                  <div class="form-grid">
                    <div class="form-group form-group--full">
                      <h3 style="font-size:var(--text-h4);font-weight:var(--font-weight-bold);margin-bottom:var(--space-sm)">Rechnungsadresse</h3>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Bundesstelle / Organisation</label>
                      <input class="form-input" type="text" placeholder="z.B. Bundesamt f\u00fcr Bauten und Logistik">
                    </div>
                    <div class="form-group">
                      <label class="form-label">Kostenstelle</label>
                      <input class="form-input" type="text" placeholder="z.B. KST-4200-001">
                    </div>
                    <div class="form-group">
                      <label class="form-label">Kontaktperson</label>
                      <input class="form-input" type="text" placeholder="Vor- und Nachname">
                    </div>
                    <div class="form-group">
                      <label class="form-label">E-Mail</label>
                      <input class="form-input" type="email" placeholder="vorname.nachname@bbl.admin.ch">
                    </div>
                    <div class="form-group form-group--full">
                      <h3 style="font-size:var(--text-h4);font-weight:var(--font-weight-bold);margin:var(--space-md) 0 var(--space-sm)">Lieferadresse</h3>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Geb\u00e4ude</label>
                      <input class="form-input" type="text" placeholder="z.B. Bundeshaus West">
                    </div>
                    <div class="form-group">
                      <label class="form-label">Stockwerk / Raum</label>
                      <input class="form-input" type="text" placeholder="z.B. 3. OG, Raum 312">
                    </div>
                    <div class="form-group">
                      <label class="form-label">Strasse / Nr.</label>
                      <input class="form-input" type="text" placeholder="z.B. Fellerstrasse 21">
                    </div>
                    <div class="form-group">
                      <label class="form-label">PLZ / Ort</label>
                      <input class="form-input" type="text" placeholder="z.B. 3003 Bern">
                    </div>
                    <div class="form-group form-group--full">
                      <label class="form-label">Bemerkungen zur Lieferung</label>
                      <textarea class="form-textarea" placeholder="Besondere Hinweise zur Anlieferung..."></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </li>

          <!-- Step 3: Bestellung -->
          <li class="wizard-accordion__step ${step3Active ? 'wizard-accordion__step--active' : ''}">
            <button class="wizard-accordion__header" aria-expanded="${step3Active}" aria-controls="wizard-step-3" data-step="3">
              <span class="wizard-accordion__number">3</span>
              <span class="wizard-accordion__label">Bestellung \u00fcbermitteln</span>
              <svg class="wizard-accordion__chevron" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,9 12,15 18,9"/></svg>
            </button>
            <div class="wizard-accordion__panel" id="wizard-step-3" ${step3Active ? '' : 'aria-hidden="true"'}>
              <div class="wizard-accordion__content">
                <div class="cart-summary-review">
                  <p style="margin-bottom:var(--space-md)">Bitte pr\u00fcfen Sie Ihre Bestellung. Mit dem Absenden wird die Bestellung an das BBL \u00fcbermittelt.</p>
                  <div class="cart-summary-review__total">
                    <span>Bestellwert exkl. MwSt</span>
                    <strong>${currency} ${total.toFixed(2)}</strong>
                  </div>
                  <div style="margin-top:var(--space-lg)">
                    <button class="btn btn--filled btn--lg" onclick="alert('Bestellung \u00fcbermittelt (Demo)')">Bestellung \u00fcbermitteln</button>
                  </div>
                </div>
              </div>
            </div>
          </li>
        </ul>

        <!-- Summary + Next button -->
        <div class="cart-summary">
          <div class="cart-summary__line">
            <span>Provisorischer Bestellwert exkl. MwSt</span>
            <strong>${currency} ${total.toFixed(2)}</strong>
          </div>
          ${state.cartStep < 3 ? `
            <button class="btn btn--filled btn--lg cart-summary__next" data-next-step="${state.cartStep + 1}">
              N\u00e4chster Schritt
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>
            </button>
          ` : ''}
        </div>
      `}
    </div>
  `;
}

function attachCartEvents() {
  // Wizard step headers
  document.querySelectorAll('.wizard-accordion__header').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = Number(btn.dataset.step);
      state.cartStep = step;
      navigateTo('cart');
    });
  });

  // Next step button
  const nextBtn = document.querySelector('.cart-summary__next');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      state.cartStep = Number(nextBtn.dataset.nextStep);
      navigateTo('cart');
    });
  }

  // Quantity inputs
  document.querySelectorAll('.cart-item__qty-input').forEach(input => {
    input.addEventListener('change', () => {
      updateCartQuantity(Number(input.dataset.index), input.value);
    });
  });

  // Remove buttons
  document.querySelectorAll('.cart-item__remove').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFromCart(Number(btn.dataset.index));
    });
  });
}

// ===================================================================
// EVENTS
// ===================================================================
function attachAccordionEvents() {
  document.querySelectorAll('.accordion__button').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      const drawer = document.getElementById(btn.getAttribute('aria-controls'));
      if (expanded) {
        btn.setAttribute('aria-expanded', 'false');
        drawer.setAttribute('aria-hidden', 'true');
        drawer.style.maxHeight = null;
        btn.classList.remove('active');
      } else {
        btn.setAttribute('aria-expanded', 'true');
        drawer.setAttribute('aria-hidden', 'false');
        drawer.style.maxHeight = drawer.scrollHeight + 'px';
        btn.classList.add('active');
      }
    });
  });
}

function attachProductDetailEvents() {
  const btn = document.getElementById('addToCartBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const id = Number(btn.dataset.productId);
    addToCart(id);
    btn.textContent = 'Hinzugef\u00fcgt \u2713';
    btn.disabled = true;
    setTimeout(() => {
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> In den Warenkorb`;
      btn.disabled = false;
    }, 1500);
  });
}

function attachShopEvents() {
  // Category tree
  document.querySelectorAll('.cat-item__row').forEach(row => {
    row.addEventListener('click', () => {
      const catId = row.dataset.catId;
      const cat = findCategory(catId);
      const hasChildren = cat && cat.children && cat.children.length > 0;
      if (hasChildren) {
        if (state.expandedCategories.has(catId)) {
          state.expandedCategories.delete(catId);
        } else {
          state.expandedCategories.add(catId);
        }
      }
      state.activeCategory = catId;
      render();
    });

    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        row.click();
      }
    });
  });

  // Search with debounce
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    const debouncedSearch = debounce(() => {
      state.searchQuery = searchInput.value;
      updateProductGrid();
    }, 200);
    searchInput.addEventListener('input', debouncedSearch);
  }

  // Sort
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.sortBy = sortSelect.value;
      updateProductGrid();
    });
  }
}

function updateProductGrid() {
  const products = filterProducts();
  const gridContainer = document.querySelector('.main-content');
  if (!gridContainer) return;

  // Update product count
  const countEl = gridContainer.querySelector('.toolbar__count');
  if (countEl) countEl.textContent = `${products.length} Produkt${products.length !== 1 ? 'e' : ''}`;

  // Replace grid
  const existing = gridContainer.querySelector('.product-grid, .no-results');
  if (existing) existing.remove();

  if (products.length) {
    const div = document.createElement('div');
    div.className = 'product-grid';
    div.id = 'productGrid';
    div.innerHTML = products.map(p => renderProductCard(p)).join('');
    gridContainer.appendChild(div);
  } else {
    const div = document.createElement('div');
    div.className = 'no-results';
    div.innerHTML = `<div class="no-results__icon">${ICONS.placeholder}</div><p class="no-results__text">Keine Produkte gefunden.</p>`;
    gridContainer.appendChild(div);
  }
}

function setCategory(catId) {
  state.activeCategory = catId;
  for (const c of CATEGORIES) {
    if (c.children) {
      for (const ch of c.children) {
        if (ch.id === catId) state.expandedCategories.add(c.id);
      }
    }
  }
  state.page = 'shop';
  render();
}

// ===================================================================
// NAVIGATION
// ===================================================================
function navigateTo(page, subPage) {
  const prevPage = state.page;
  state.page = page;
  state.subPage = (page === 'product') ? null : (subPage || null);
  state.productId = (page === 'product') ? Number(subPage) : null;
  if (page !== 'search') state.searchQuery = '';
  state.mobileMenuOpen = false;
  if (page === 'cart' && prevPage !== 'cart') state.cartStep = 1;
  document.getElementById('appNav').classList.remove('main-navigation--mobile-open');
  document.getElementById('burgerBtn').setAttribute('aria-expanded', 'false');
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  let hash = '#/' + page;
  if (page === 'product') {
    hash += '/' + subPage;
  } else if (subPage) {
    hash += '/' + subPage;
  }
  history.pushState(null, '', hash);
}

// ===================================================================
// BURGER MENU
// ===================================================================
document.getElementById('burgerBtn').addEventListener('click', () => {
  const nav = document.getElementById('appNav');
  const btn = document.getElementById('burgerBtn');
  state.mobileMenuOpen = !state.mobileMenuOpen;
  nav.classList.toggle('main-navigation--mobile-open', state.mobileMenuOpen);
  btn.setAttribute('aria-expanded', String(state.mobileMenuOpen));
});

// ===================================================================
// HASH ROUTING
// ===================================================================
function handleHash() {
  const rawHash = location.hash.replace('#/', '');
  // Extract query params from hash (e.g. ?bg=satellite-v9)
  const qIdx = rawHash.indexOf('?');
  const hashPath = qIdx >= 0 ? rawHash.substring(0, qIdx) : rawHash;
  const hashParams = qIdx >= 0 ? new URLSearchParams(rawHash.substring(qIdx + 1)) : null;
  const hash = hashPath.split('/');
  const page = hash[0] || 'shop';
  const sub = hash[1] || null;

  if (page === 'product' && sub) {
    state.page = 'product';
    state.productId = Number(sub);
    state.subPage = null;
  } else if (page === 'item' && sub) {
    state.page = 'item';
    state.subPage = sub;
    state.productId = null;
  } else if (page === 'occupancy') {
    state.page = 'occupancy';
    state.subPage = sub;
    state.productId = null;
    const tabFromUrl = hash[2] || null;
    // Restore tree selection from URL
    if (sub) {
      state.occSelectedId = sub;
      const found = occFindNode(sub);
      if (found) {
        found.path.forEach(n => state.occExpandedIds.add(n.id));
        const tabs = occGetTabs(found.node.type);
        // Restore tab from URL or default to first
        if (tabFromUrl && tabs.find(t => t.id === tabFromUrl)) {
          state.occTab = tabFromUrl;
        } else if (!tabs.find(t => t.id === state.occTab)) {
          state.occTab = tabs[0].id;
        }
      }
    } else {
      state.occSelectedId = null;
      state.occTab = 'map';
    }
    // Restore map background style from URL
    const bgFromUrl = hashParams ? hashParams.get('bg') : null;
    state.occMapStyle = (bgFromUrl && MAP_STYLES[bgFromUrl]) ? bgFromUrl : state.occMapStyle;
  } else if (['home', 'shop', 'planning', 'circular', 'scan', 'register', 'charter', 'style-worlds', 'examples', 'cad', 'cart', 'search'].includes(page)) {
    state.page = page;
    state.subPage = sub;
    state.productId = null;
  } else {
    state.page = 'shop';
    state.productId = null;
  }
  render();
}

window.addEventListener('hashchange', handleHash);
window.addEventListener('popstate', handleHash);

// Card keyboard support (delegated)
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && (e.target.classList.contains('card--clickable') || e.target.classList.contains('card--product'))) {
    e.preventDefault();
    e.target.click();
  }
});

// ===================================================================
// BACK-TO-TOP
// ===================================================================
(function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('back-to-top-btn--visible', window.scrollY > 400);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// ===================================================================
// COOKIE / CONSENT BANNER
// ===================================================================
(function initCookieBanner() {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;

  if (localStorage.getItem('cookieConsent')) {
    banner.remove();
    return;
  }

  document.getElementById('cookieAccept')?.addEventListener('click', () => {
    localStorage.setItem('cookieConsent', 'accepted');
    banner.classList.add('notification-banner--hidden');
  });

  document.getElementById('cookieReject')?.addEventListener('click', () => {
    localStorage.setItem('cookieConsent', 'rejected');
    banner.classList.add('notification-banner--hidden');
  });
})();

// ===================================================================
// LANGUAGE SWITCHER
// ===================================================================
(function initLangSwitch() {
  const wrapper = document.getElementById('langSwitch');
  if (!wrapper) return;

  const toggle = wrapper.querySelector('.top-bar__lang');
  const options = wrapper.querySelectorAll('.language-switcher__option');

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = wrapper.classList.toggle('language-switcher--open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => {
        o.classList.remove('language-switcher__option--active');
        o.setAttribute('aria-selected', 'false');
      });
      opt.classList.add('language-switcher__option--active');
      opt.setAttribute('aria-selected', 'true');

      const langMap = { 'Deutsch': 'DE', 'Fran\u00e7ais': 'FR', 'Italiano': 'IT', 'Rumantsch': 'RM' };
      toggle.firstChild.textContent = langMap[opt.textContent] || opt.textContent.substring(0, 2).toUpperCase();

      wrapper.classList.remove('language-switcher--open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      wrapper.classList.remove('language-switcher--open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
})();

// ===================================================================
// HEADER SEARCH (expand on click)
// ===================================================================
(function initHeaderSearch() {
  const wrapper = document.getElementById('headerSearch');
  const input = document.getElementById('headerSearchInput');
  const btn = wrapper?.querySelector('.header-search__btn');
  const form = document.getElementById('headerSearchForm');
  if (!wrapper || !input || !btn || !form) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!wrapper.classList.contains('header-search--open')) {
      wrapper.classList.add('header-search--open');
      input.focus();
    } else if (input.value.trim()) {
      state.globalSearchQuery = input.value.trim();
      state.searchFilterCategory = '';
      state.searchFilterBrand = '';
      state.searchSortBy = 'name-asc';
      wrapper.classList.remove('header-search--open');
      input.value = '';
      navigateTo('search');
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value.trim()) {
      state.globalSearchQuery = input.value.trim();
      state.searchFilterCategory = '';
      state.searchFilterBrand = '';
      state.searchSortBy = 'name-asc';
      wrapper.classList.remove('header-search--open');
      input.value = '';
      navigateTo('search');
    }
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      wrapper.classList.remove('header-search--open');
    }
  });

  // Close on Escape
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      wrapper.classList.remove('header-search--open');
      btn.focus();
    }
  });
})();

// ===================================================================
// INIT
// ===================================================================
loadData().then(() => {
  handleHash();
});
