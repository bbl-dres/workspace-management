// ===================================================================
// DATA LOADING
// ===================================================================
let CATEGORIES = [];
let PRODUCTS = [];
let SITES = [];
let BUILDINGS = [];
let FLOORS = [];
let BUILDINGS_GEO = null;
let FLOORS_GEO = null;
let ROOMS_GEO = null;
let ASSETS_GEO = null;
let FURNITURE_ITEMS = [];
let STILWELTEN = [];
let PLANUNGSBEISPIELE = [];
let CAD_SECTIONS = [];
let LOCATIONS = { id: 'ch', label: 'Schweiz', type: 'country', count: 0, children: [] };

async function loadData() {
  const [catRes, prodRes, siteRes, bldRes, flrRes, roomRes, assetsRes, furnRes, stilRes, planRes, cadRes] = await Promise.all([
    fetch('data/categories.json'),
    fetch('data/products.json'),
    fetch('data/sites.json'),
    fetch('data/buildings.geojson'),
    fetch('data/floors.geojson'),
    fetch('data/rooms.geojson'),
    fetch('data/assets.geojson'),
    fetch('data/assets-circular.json'),
    fetch('data/style-worlds.json'),
    fetch('data/planning-examples.json'),
    fetch('data/cad-files.json')
  ]);
  CATEGORIES = await catRes.json();
  PRODUCTS = await prodRes.json();
  SITES = await siteRes.json();
  BUILDINGS_GEO = await bldRes.json();
  FLOORS_GEO = await flrRes.json();
  ROOMS_GEO = await roomRes.json();
  ASSETS_GEO = await assetsRes.json();
  FURNITURE_ITEMS = await furnRes.json();
  STILWELTEN = await stilRes.json();
  PLANUNGSBEISPIELE = await planRes.json();
  CAD_SECTIONS = await cadRes.json();

  // Extract BUILDINGS array from GeoJSON for backward compat (detail pages, tree, etc.)
  BUILDINGS = BUILDINGS_GEO.features.map(f => ({
    ...f.properties,
    coords: f.properties.centroid ? [f.properties.centroid[1], f.properties.centroid[0]] : null
  }));

  // Reconstruct rooms arrays per floor from ROOMS_GEO
  const roomsByFloor = {};
  for (const rf of ROOMS_GEO.features) {
    const fid = rf.properties.floorId;
    if (!roomsByFloor[fid]) roomsByFloor[fid] = [];
    roomsByFloor[fid].push({
      nr: rf.properties.nr,
      type: rf.properties.type,
      area: rf.properties.area,
      workspaces: rf.properties.workspaces
    });
  }

  FLOORS = FLOORS_GEO.features.map(f => ({
    ...f.properties,
    rooms: roomsByFloor[f.properties.floorId] || []
  }));

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
  occMapStyle: 'positron'
};

const MAP_STYLES = {
  'positron': { name: 'Light', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', swatch: '#e8e8e8' },
  'voyager': { name: 'Standard', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json', swatch: '#d4c4a8' },
  'dark-matter': { name: 'Dunkel', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', swatch: '#2b2b2b' }
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
// HELPERS
// ===================================================================
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
    case 'product': app.innerHTML = renderProductDetail(state.productId); attachProductDetailEvents(); attachCarouselEvents(); break;
    case 'item': app.innerHTML = renderFurnitureDetail(state.subPage); attachCarouselEvents(); break;
    case 'planning': app.innerHTML = renderPlanning(); break;
    case 'occupancy': app.innerHTML = renderOccupancy(); attachOccupancyEvents(); break;
    case 'circular': app.innerHTML = renderCircular(); attachShopEvents(); break;
    case 'scan': app.innerHTML = renderScan(); attachScanEvents(); break;
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
