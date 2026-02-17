// ===================================================================
// SECONDARY PAGES
// ===================================================================

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
            <input class="scan-area__input" id="scanInput" type="text" placeholder="z.B. INV-2024-001234">
            <button class="btn btn--filled" id="scanSearchBtn">Suchen</button>
          </div>
          <div class="scan-area__feedback" id="scanFeedback"></div>
        </div>
      </div>
    </div>
  `;
}

function attachScanEvents() {
  const input = document.getElementById('scanInput');
  const btn = document.getElementById('scanSearchBtn');
  const feedback = document.getElementById('scanFeedback');

  function doScanSearch() {
    let val = input.value.trim();
    if (!val) {
      feedback.textContent = 'Bitte geben Sie eine Inventar-Nummer ein.';
      feedback.className = 'scan-area__feedback scan-area__feedback--error';
      return;
    }

    // Extract inventory number from QR code URL
    if (val.startsWith('http')) {
      const match = val.match(/\/inv\/(INV-\d{4}-\d+)/i);
      if (match) val = match[1];
    }

    val = val.toUpperCase();

    // Search circular economy items
    const circular = FURNITURE_ITEMS.find(
      x => x.itemId.toUpperCase() === val || x.inventoryNumber.toUpperCase() === val
    );
    if (circular) {
      navigateTo('item', circular.itemId);
      return;
    }

    // Search all inventory (GeoJSON assets)
    if (ASSETS_GEO && ASSETS_GEO.features) {
      const asset = ASSETS_GEO.features.find(
        f => f.properties.assetId.toUpperCase() === val || f.properties.inventoryNumber.toUpperCase() === val
      );
      if (asset) {
        navigateTo('item', asset.properties.assetId);
        return;
      }
    }

    // Not found
    feedback.textContent = 'Kein Objekt mit der Nummer \u00ab' + escapeHtml(val) + '\u00bb gefunden.';
    feedback.className = 'scan-area__feedback scan-area__feedback--error';
  }

  btn.addEventListener('click', doScanSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doScanSearch();
  });
  input.addEventListener('input', () => {
    feedback.textContent = '';
    feedback.className = 'scan-area__feedback';
  });
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
