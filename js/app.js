// ===================================================================
// DATA LOADING
// ===================================================================
let CATEGORIES = [];
let PRODUCTS = [];

async function loadData() {
  const [catRes, prodRes] = await Promise.all([
    fetch('data/categories.json'),
    fetch('data/products.json')
  ]);
  CATEGORIES = await catRes.json();
  PRODUCTS = await prodRes.json();
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
  mobileMenuOpen: false
};

// ===================================================================
// ICONS
// ===================================================================
const CHEVRON_RIGHT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,6 15,12 9,18"/></svg>`;

const ICONS = {
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
  if (catId === 'alle') return PRODUCTS.filter(p => !p.isCircular).length;
  const ids = getAllSubcategoryIds(catId);
  return PRODUCTS.filter(p => !p.isCircular && (ids.includes(p.category) || ids.includes(p.subcategory))).length;
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
  let filtered = PRODUCTS.filter(p => !p.isCircular);

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

function filterCircularProducts() {
  return PRODUCTS.filter(p => p.isCircular);
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
  document.querySelectorAll('.app-nav__btn').forEach(btn => {
    const nav = btn.dataset.nav;
    if (nav === state.page) {
      btn.classList.add('app-nav__btn--active');
    } else {
      btn.classList.remove('app-nav__btn--active');
    }
  });

  // Trigger page transition
  app.style.animation = 'none';
  app.offsetHeight; // force reflow
  app.style.animation = '';

  switch (state.page) {
    case 'home': app.innerHTML = renderHome(); break;
    case 'shop': app.innerHTML = renderShop(); attachShopEvents(); break;
    case 'product': app.innerHTML = renderProductDetail(state.productId); break;
    case 'planung': app.innerHTML = renderPlanung(); break;
    case 'circular': app.innerHTML = renderCircular(); break;
    default: app.innerHTML = renderShop(); attachShopEvents();
  }
}

// ---- HOME ----
function renderHome() {
  const totalProducts = PRODUCTS.filter(p => !p.isCircular).length;
  const circularCount = PRODUCTS.filter(p => p.isCircular).length;
  const brands = [...new Set(PRODUCTS.map(p => p.brand))].length;

  return `
    <div class="page-container" style="padding-top:16px;padding-bottom:40px;">
      <div class="page-hero">
        <h1 class="page-hero__title">Workspace Management</h1>
        <p class="page-hero__subtitle">Willkommen beim Bundesamt f\u00fcr Bauten und Logistik. Planen, bestellen und verwalten Sie Ihre B\u00fcroausstattung.</p>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-card__value">${totalProducts}</div>
          <div class="stat-card__label">Produkte</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${brands}</div>
          <div class="stat-card__label">Marken</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${CATEGORIES.length - 1}</div>
          <div class="stat-card__label">Kategorien</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value stat-card__value--green">${circularCount}</div>
          <div class="stat-card__label">Circular Objekte</div>
        </div>
      </div>

      <div class="tile-grid">
        <div class="tile" onclick="navigateTo('shop')" role="button" tabindex="0">
          <div class="tile__icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </div>
          <h3 class="tile__title">Produktkatalog</h3>
          <p class="tile__desc">B\u00fcrom\u00f6bel und Ausstattung aus dem Sortiment bestellen</p>
        </div>
        <div class="tile" onclick="navigateTo('planung')" role="button" tabindex="0">
          <div class="tile__icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          </div>
          <h3 class="tile__title">B\u00fcroplanung</h3>
          <p class="tile__desc">Workspaces gestalten und R\u00e4ume planen</p>
        </div>
        <div class="tile tile--green" onclick="navigateTo('circular')" role="button" tabindex="0">
          <div class="tile__icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M2.5 16A10 10 0 0118 3.5"/><path d="M21.5 8A10 10 0 016 20.5"/></svg>
          </div>
          <h3 class="tile__title">Circular-Hub</h3>
          <p class="tile__desc">Gebrauchte M\u00f6bel wiederverwenden statt entsorgen</p>
        </div>
      </div>

      <h2 class="section-heading">Neuheiten <span class="section-heading__line"></span></h2>
      <div class="product-grid" style="margin-bottom:24px;">
        ${PRODUCTS.filter(p => p.isNew && !p.isCircular).slice(0, 6).map(p => renderProductCard(p)).join('')}
      </div>
    </div>
  `;
}

// ---- CATEGORY TREE ----
function renderCategoryTree(categories) {
  return categories.map(cat => {
    const hasChildren = cat.children && cat.children.length > 0;
    const isExpanded = state.expandedCategories.has(cat.id);
    const isActive = state.activeCategory === cat.id;
    const count = countProductsInCategory(cat.id);
    return `
      <div class="cat-item">
        <div class="cat-item__row" data-cat-id="${cat.id}" role="treeitem" aria-expanded="${hasChildren ? isExpanded : ''}" tabindex="0">
          <div class="cat-item__radio ${isActive ? 'cat-item__radio--active' : ''}"></div>
          <span class="cat-item__label">${cat.label}</span>
          ${count > 0 && cat.id !== 'alle' ? `<span class="cat-item__count">${count}</span>` : ''}
          ${hasChildren ? `<span class="cat-item__toggle ${isExpanded ? 'cat-item__toggle--open' : ''}">\u203A</span>` : ''}
        </div>
        ${hasChildren ? `<div class="cat-item__children ${isExpanded ? 'cat-item__children--open' : ''}">${renderCategoryTree(cat.children)}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ---- SHOP ----
function renderShop() {
  const products = filterProducts();
  const catLabel = getCategoryLabel(state.activeCategory);
  const parent = getParentCategory(state.activeCategory);

  let breadcrumb = `<a href="#" onclick="setCategory('alle');return false">Produkte</a>`;
  if (state.activeCategory !== 'alle') {
    if (parent) {
      breadcrumb += ` <span class="breadcrumb__sep">${CHEVRON_RIGHT}</span> <a href="#" onclick="setCategory('${parent.id}');return false">${parent.label}</a>`;
    }
    breadcrumb += ` <span class="breadcrumb__sep">${CHEVRON_RIGHT}</span> <span class="breadcrumb__current">${catLabel}</span>`;
  }

  return `
    <div class="app-layout">
      <aside class="sidebar" role="navigation" aria-label="Kategorien">
        <div class="sidebar__title">Kategorien</div>
        <div class="cat-tree" role="tree">
          ${renderCategoryTree(CATEGORIES)}
        </div>
      </aside>
      <main class="main-content" id="mainContent">
        <nav class="breadcrumb" aria-label="Breadcrumb">${breadcrumb}</nav>
        <div class="toolbar">
          <div class="search-bar">
            <input class="search-bar__input" type="search" placeholder="Suchen..." id="searchInput" value="${escapeHtml(state.searchQuery)}" aria-label="Produkte suchen">
            <button class="search-bar__btn" aria-label="Suchen">${ICONS.search}</button>
          </div>
          <select class="sort-select" id="sortSelect" aria-label="Sortierung">
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
    <div class="product-card" onclick="navigateTo('product',${p.id})" tabindex="0" role="button" aria-label="${escapeHtml(p.name)}">
      <div class="product-card__image">
        ${getProductIcon(p)}
        ${p.isNew ? '<span class="product-card__badge product-card__badge--new">Neu</span>' : ''}
        ${p.isCircular ? '<span class="product-card__badge product-card__badge--circular">Gebraucht</span>' : ''}
      </div>
      <div class="product-card__body">
        <div class="product-card__name">${escapeHtml(p.name)}</div>
        <div class="product-card__desc">${escapeHtml(p.description)}</div>
        <div class="product-card__price">${p.currency} ${p.price.toFixed(2)}</div>
      </div>
      <div class="product-card__footer">
        <span class="product-card__brand">${escapeHtml(p.brand)}</span>
        <button class="btn btn--primary btn--sm" onclick="event.stopPropagation();navigateTo('product',${p.id})">Bestellen</button>
      </div>
    </div>
  `;
}

// ---- PRODUCT DETAIL ----
function renderProductDetail(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) {
    return `
      <div class="page-container" id="mainContent" style="padding-top:16px;padding-bottom:40px;">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="#" onclick="navigateTo('shop');return false">Produkte</a>
        </nav>
        <div class="no-results">
          <div class="no-results__icon">${ICONS.placeholder}</div>
          <p class="no-results__text">Produkt nicht gefunden.</p>
        </div>
      </div>
    `;
  }

  const catLabel = getCategoryLabel(p.subcategory) || getCategoryLabel(p.category);
  const parentCat = getParentCategory(p.subcategory);

  let breadcrumb = `<a href="#" onclick="navigateTo('shop');return false">Produkte</a>`;
  if (parentCat) {
    breadcrumb += ` <span class="breadcrumb__sep">${CHEVRON_RIGHT}</span> <a href="#" onclick="setCategory('${parentCat.id}');return false">${parentCat.label}</a>`;
  }
  if (p.subcategory && p.subcategory !== p.category) {
    breadcrumb += ` <span class="breadcrumb__sep">${CHEVRON_RIGHT}</span> <a href="#" onclick="setCategory('${p.subcategory}');return false">${catLabel}</a>`;
  } else {
    breadcrumb += ` <span class="breadcrumb__sep">${CHEVRON_RIGHT}</span> <a href="#" onclick="setCategory('${p.category}');return false">${getCategoryLabel(p.category)}</a>`;
  }
  breadcrumb += ` <span class="breadcrumb__sep">${CHEVRON_RIGHT}</span> <span class="breadcrumb__current">${escapeHtml(p.name)}</span>`;

  const condition = p.isCircular ? 'Gebraucht \u2013 guter Zustand' : 'Neu';
  const articleNr = 'ART-' + String(p.id).padStart(5, '0');

  return `
    <div class="page-container" id="mainContent" style="padding-top:16px;padding-bottom:40px;">
      <nav class="breadcrumb" aria-label="Breadcrumb">${breadcrumb}</nav>
      <div class="product-detail">
        <div class="product-detail__image">
          ${getProductIcon(p).replace(/width="\d+"/, 'width="96"').replace(/height="\d+"/, 'height="96"')}
          ${p.isNew ? '<span class="product-card__badge product-card__badge--new">Neu</span>' : ''}
          ${p.isCircular ? '<span class="product-card__badge product-card__badge--circular">Gebraucht</span>' : ''}
        </div>
        <div class="product-detail__info">
          <h1 class="product-detail__title">${escapeHtml(p.name)}</h1>
          <p class="product-detail__desc">${escapeHtml(p.description)}</p>
          <div class="product-detail__meta">
            <span class="product-detail__meta-label">Marke</span>
            <span class="product-detail__meta-value">${escapeHtml(p.brand)}</span>
            <span class="product-detail__meta-label">Kategorie</span>
            <span class="product-detail__meta-value">${catLabel}</span>
            <span class="product-detail__meta-label">Zustand</span>
            <span class="product-detail__meta-value">${condition}</span>
            <span class="product-detail__meta-label">Artikel-Nr.</span>
            <span class="product-detail__meta-value">${articleNr}</span>
          </div>
          <div class="product-detail__price">${p.currency} ${p.price.toFixed(2)}</div>
          <div class="product-detail__actions">
            <button class="btn btn--primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              Bestellen
            </button>
            <button class="btn btn--outline" onclick="history.back()">Zur\u00fcck</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---- PLANUNG ----
function renderPlanung() {
  const stilwelten = [
    { title: "Fokus-Arbeitsplatz", desc: "Konzentriertes Arbeiten mit Akustik-Elementen", color: "linear-gradient(135deg, #004B6E, #006699)", icon: "\u25CE" },
    { title: "Kollaborationszone", desc: "Offene Bereiche f\u00fcr Teamarbeit und Workshops", color: "linear-gradient(135deg, #3E8A27, #6DBF55)", icon: "\u25A3" },
    { title: "Lounge & Empfang", desc: "Repr\u00e4sentative R\u00e4ume mit Wohncharakter", color: "linear-gradient(135deg, #6B4C8A, #9B7BBD)", icon: "\u25C7" },
    { title: "Konferenz & Meeting", desc: "Professionelle Besprechungsr\u00e4ume", color: "linear-gradient(135deg, #C46B00, #E89F00)", icon: "\u25A1" },
    { title: "Flex-Desk", desc: "Shared Desks mit Buchungssystem", color: "linear-gradient(135deg, #1B7A8A, #2AAFBF)", icon: "\u25CB" },
    { title: "Bibliothek & Archiv", desc: "Ruhezonen mit Regal-Systemen", color: "linear-gradient(135deg, #8B4513, #A0522D)", icon: "\u25A4" }
  ];

  return `
    <div class="page-container" id="mainContent" style="padding-bottom:40px;">
      <div class="page-hero">
        <h1 class="page-hero__title">Workspaces gestalten</h1>
        <p class="page-hero__subtitle">Planen Sie Ihre B\u00fcror\u00e4ume effizient und nach aktuellen Arbeitsplatzstandards des Bundes.</p>
      </div>

      <div class="tile-grid">
        <div class="tile">
          <div class="tile__icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M2 8h20M8 2v20"/></svg>
          </div>
          <h3 class="tile__title">Stilwelten</h3>
          <p class="tile__desc">Vordefinierte B\u00fcro-Stile entdecken</p>
        </div>
        <div class="tile">
          <div class="tile__icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <h3 class="tile__title">Planungsbeispiele</h3>
          <p class="tile__desc">Referenzprojekte und Inspirationen</p>
        </div>
        <div class="tile">
          <div class="tile__icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <h3 class="tile__title">CAD-Daten</h3>
          <p class="tile__desc">Downloads f\u00fcr Planer und Architekten</p>
        </div>
      </div>

      <h2 class="section-heading">Stilwelten <span class="section-heading__line"></span></h2>
      <div class="stilwelt-grid">
        ${stilwelten.map(s => `
          <div class="stilwelt-card">
            <div class="stilwelt-card__image" style="background:${s.color}">
              <span>${s.icon}</span>
            </div>
            <div class="stilwelt-card__body">
              <div class="stilwelt-card__title">${s.title}</div>
              <div class="stilwelt-card__desc">${s.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <h2 class="section-heading">Grundriss-App <span class="section-heading__line"></span></h2>
      <div class="placeholder-area">
        <div class="placeholder-area__icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="14" y2="9"/><line x1="9" y1="3" x2="9" y2="14"/><line x1="14" y1="9" x2="14" y2="21"/><line x1="9" y1="14" x2="21" y2="14"/></svg>
        </div>
        <div class="placeholder-area__title">Grundriss-App (in Entwicklung)</div>
        <p class="placeholder-area__text">Hier k\u00f6nnen Sie direkt im Browser Grundrisse erstellen und mit Ihren<br>Kunden R\u00e4ume gestalten. Diese Funktion wird in einer zuk\u00fcnftigen Version verf\u00fcgbar sein.</p>
      </div>
    </div>
  `;
}

// ---- CIRCULAR HUB ----
function renderCircular() {
  const circularProducts = filterCircularProducts();

  return `
    <div class="page-container" id="mainContent" style="padding-bottom:40px;">
      <div class="page-hero page-hero--green">
        <h1 class="page-hero__title">Kreislaufwirtschaft im Bundesgeb\u00e4ude</h1>
        <p class="page-hero__subtitle">Gebrauchte M\u00f6bel wiederverwenden statt entsorgen. Nachhaltig und kosteneffizient f\u00fcr die Bundesverwaltung.</p>
      </div>

      <div class="tile-grid">
        <div class="tile tile--green">
          <div class="tile__icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </div>
          <h3 class="tile__title">Aktuell im Lager</h3>
          <p class="tile__desc">Verf\u00fcgbare gebrauchte M\u00f6bel</p>
          <div class="tile__count">${circularProducts.length} Objekte</div>
        </div>
        <div class="tile tile--green">
          <div class="tile__icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7z"/></svg>
          </div>
          <h3 class="tile__title">Objekt Scannen</h3>
          <p class="tile__desc">QR-Code oder ID eines Objekts scannen</p>
        </div>
        <div class="tile tile--green">
          <div class="tile__icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <h3 class="tile__title">Neues Objekt erfassen</h3>
          <p class="tile__desc">M\u00f6bel ins System eintragen</p>
        </div>
      </div>

      <h2 class="section-heading">Objekt Scannen <span class="section-heading__line"></span></h2>
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
            <button class="btn btn--green">Suchen</button>
          </div>
        </div>
      </div>

      <h2 class="section-heading">Neues Objekt erfassen <span class="section-heading__line"></span></h2>
      <div class="form-card">
        <div class="form-card__title">M\u00f6belst\u00fcck dem Kreislauf hinzuf\u00fcgen</div>
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
            <button class="btn btn--green">Objekt erfassen</button>
            <button class="btn btn--outline">Abbrechen</button>
          </div>
        </div>
      </div>

      <h2 class="section-heading">Verf\u00fcgbare gebrauchte M\u00f6bel <span class="section-heading__line"></span></h2>
      <div class="product-grid">
        ${circularProducts.map(p => renderProductCard(p)).join('')}
      </div>
    </div>
  `;
}

// ===================================================================
// EVENTS
// ===================================================================
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
  state.page = page;
  state.subPage = (page === 'product') ? null : (subPage || null);
  state.productId = (page === 'product') ? Number(subPage) : null;
  state.searchQuery = '';
  state.mobileMenuOpen = false;
  document.getElementById('appNav').classList.remove('app-nav--mobile-open');
  document.getElementById('hamburgerBtn').setAttribute('aria-expanded', 'false');
  closeAllDropdowns();
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
// DROPDOWNS
// ===================================================================
document.querySelectorAll('[data-dropdown]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const ddId = btn.dataset.dropdown;
    const dd = document.getElementById(ddId);

    if (dd.classList.contains('mega-dropdown--open')) {
      closeAllDropdowns();
    } else {
      closeAllDropdowns();
      dd.classList.add('mega-dropdown--open');
      btn.classList.add('app-nav__btn--open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});

function closeAllDropdowns() {
  document.querySelectorAll('.mega-dropdown').forEach(dd => dd.classList.remove('mega-dropdown--open'));
  document.querySelectorAll('[data-dropdown]').forEach(btn => {
    btn.classList.remove('app-nav__btn--open');
    btn.setAttribute('aria-expanded', 'false');
  });
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.mega-dropdown') && !e.target.closest('[data-dropdown]')) {
    closeAllDropdowns();
  }
});

// ===================================================================
// HAMBURGER MENU
// ===================================================================
document.getElementById('hamburgerBtn').addEventListener('click', () => {
  const nav = document.getElementById('appNav');
  const btn = document.getElementById('hamburgerBtn');
  state.mobileMenuOpen = !state.mobileMenuOpen;
  nav.classList.toggle('app-nav--mobile-open', state.mobileMenuOpen);
  btn.setAttribute('aria-expanded', String(state.mobileMenuOpen));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllDropdowns();
  }
});

// ===================================================================
// HASH ROUTING
// ===================================================================
function handleHash() {
  const hash = location.hash.replace('#/', '').split('/');
  const page = hash[0] || 'shop';
  const sub = hash[1] || null;

  if (page === 'product' && sub) {
    state.page = 'product';
    state.productId = Number(sub);
    state.subPage = null;
  } else if (['home', 'shop', 'planung', 'circular'].includes(page)) {
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

// Tile keyboard support (delegated)
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('tile')) {
    e.preventDefault();
    e.target.click();
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('product-card')) {
    e.preventDefault();
    e.target.click();
  }
});

// ===================================================================
// INIT
// ===================================================================
loadData().then(() => {
  handleHash();
});
