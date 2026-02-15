// ===================================================================
// SHOP, CATALOG & CART
// ===================================================================

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
      <div class="container container--detail" id="mainContent">
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

  const photos = getItemPhotos(p);
  const badgeHtml = p.isNew ? '<span class="badge badge--new carousel__badge">Neu</span>' : '';

  return `
    ${renderBreadcrumb(...bcItems)}
    <div class="container container--detail" id="mainContent">
      ${renderDetailToolbar()}
      <div class="product-detail">
        <div class="product-detail__image">
          ${renderCarousel(photos, p.name, badgeHtml)}
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
      <div class="container container--detail" id="mainContent">
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

  const photos = getItemPhotos(f);
  const badgeHtml = '<span class="badge badge--circular carousel__badge">Gebraucht</span>';

  return `
    ${renderBreadcrumb(...bcItems)}
    <div class="container container--detail" id="mainContent">
      ${renderDetailToolbar()}
      <div class="product-detail">
        <div class="product-detail__image">
          ${renderCarousel(photos, f.name, badgeHtml)}
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

// ---- CIRCULAR (Gebrauchte M\u00f6bel) ----
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

// ---- SHOPPING CART ----
function renderCart() {
  const cartItems = state.cart.map((item, i) => {
    const p = PRODUCTS.find(x => x.id === item.productId);
    if (!p) return '';
    const lineTotal = p.price * item.quantity;
    const imgHtml = p.photo
      ? `<img src="https://images.unsplash.com/${p.photo}?w=120&h=80&fit=crop&auto=format&q=80" alt="${escapeHtml(p.name)}">`
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

// ===================================================================
// SHOP EVENTS
// ===================================================================
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
