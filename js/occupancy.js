// ===================================================================
// OCCUPANCY PLANNING (Belegungsplanung)
// ===================================================================

// Room type → fill color mapping
const ROOM_COLORS = {
  'Büro': '#4A90D9',
  'Sitzungszimmer': '#F5A623',
  'Open Space': '#7ED321',
  'Empfang': '#BD10E0',
  'Teeküche': '#F8E71C',
  'WC': '#9B9B9B',
  'Korridor': '#E8E4DF',
  'Lager': '#8B572A',
  'Fokusraum': '#50E3C2',
  'Lounge': '#D0021B',
  'Technikraum': '#6B7B8D',
  'Druckerraum': '#417505',
  'Garderobe': '#C69C6D',
  'Schulungsraum': '#7B61FF',
  'Cafeteria': '#FF6B6B',
  'Archiv': '#A0856E'
};
const ROOM_COLOR_DEFAULT = '#B8B8B8';

// Build MapLibre match expression for room fill colors
const ROOM_COLOR_MATCH = ['match', ['get', 'type']];
for (const [type, color] of Object.entries(ROOM_COLORS)) {
  ROOM_COLOR_MATCH.push(type, color);
}
ROOM_COLOR_MATCH.push(ROOM_COLOR_DEFAULT);

// SVG icons per location type
const RP_ICONS = {
  country: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3v10l4-2 4 2 4-2V1l-4 2-4-2-4 2z"/></svg>',
  kanton: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M5 3V1h6v2"/><line x1="2" y1="7" x2="14" y2="7"/></svg>',
  building: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="2" width="10" height="13" rx="1"/><line x1="6" y1="5" x2="6" y2="5.01"/><line x1="8" y1="5" x2="8" y2="5.01"/><line x1="10" y1="5" x2="10" y2="5.01"/><line x1="6" y1="8" x2="6" y2="8.01"/><line x1="8" y1="8" x2="8" y2="8.01"/><line x1="10" y1="8" x2="10" y2="8.01"/><path d="M6 15v-3h4v3"/></svg>',
  floor: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="10" rx="1"/><line x1="2" y1="8" x2="9" y2="8"/><line x1="7" y1="3" x2="7" y2="10"/></svg>'
};

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
    { id: 'metrics', label: 'R\u00e4ume' },
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

  // Karte tab (default)
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

// ===================================================================
// MAP
// ===================================================================
let _occMap = null;
let _searchMarker = null;

// Derive a Point FeatureCollection from BUILDINGS_GEO centroids (for markers/labels)
function buildingPointsFromGeo(geo) {
  return {
    type: 'FeatureCollection',
    features: geo.features.map(f => ({
      type: 'Feature',
      id: f.id,
      properties: f.properties,
      geometry: {
        type: 'Point',
        coordinates: f.properties.centroid
      }
    }))
  };
}

// Get filtered room features based on current selection
function getFilteredRooms() {
  if (!ROOMS_GEO) return { type: 'FeatureCollection', features: [] };
  const selId = state.occSelectedId;
  if (!selId || selId === 'ch') return { type: 'FeatureCollection', features: [] };

  const found = occFindNode(selId);
  if (!found) return { type: 'FeatureCollection', features: [] };

  const node = found.node;
  let features;
  if (node.type === 'floor') {
    features = ROOMS_GEO.features.filter(f => f.properties.floorId === selId);
  } else if (node.type === 'building') {
    features = ROOMS_GEO.features.filter(f => f.properties.buildingId === selId);
  } else if (node.type === 'kanton') {
    const buildingIds = (node.children || []).map(b => b.id);
    features = ROOMS_GEO.features.filter(f => buildingIds.includes(f.properties.buildingId));
  } else {
    features = [];
  }
  return { type: 'FeatureCollection', features };
}

// Add all room-related sources and layers to the map
function addRoomLayers() {
  const roomData = getFilteredRooms();

  _occMap.addSource('rooms', { type: 'geojson', data: roomData });

  _occMap.addLayer({
    id: 'room-fills',
    type: 'fill',
    source: 'rooms',
    minzoom: 16,
    paint: {
      'fill-color': ROOM_COLOR_MATCH,
      'fill-opacity': 0.6
    }
  });

  _occMap.addLayer({
    id: 'room-outlines',
    type: 'line',
    source: 'rooms',
    minzoom: 16,
    paint: {
      'line-color': '#444444',
      'line-width': 1
    }
  });

  _occMap.addLayer({
    id: 'room-labels',
    type: 'symbol',
    source: 'rooms',
    minzoom: 17,
    layout: {
      'text-field': ['concat', ['get', 'nr'], '\n', ['get', 'type']],
      'text-size': 11,
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-allow-overlap': false,
      'text-anchor': 'center'
    },
    paint: {
      'text-color': '#1a1a1a',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1
    }
  });
}

// Get filtered asset features based on current selection
function getFilteredAssets() {
  if (!ASSETS_GEO) return { type: 'FeatureCollection', features: [] };
  const selId = state.occSelectedId;
  if (!selId || selId === 'ch') return { type: 'FeatureCollection', features: [] };

  const found = occFindNode(selId);
  if (!found) return { type: 'FeatureCollection', features: [] };

  const node = found.node;
  let features;
  if (node.type === 'floor') {
    features = ASSETS_GEO.features.filter(f => f.properties.floorId === selId);
  } else if (node.type === 'building') {
    features = ASSETS_GEO.features.filter(f => f.properties.buildingId === selId);
  } else if (node.type === 'kanton') {
    const buildingIds = (node.children || []).map(b => b.id);
    features = ASSETS_GEO.features.filter(f => buildingIds.includes(f.properties.buildingId));
  } else {
    features = [];
  }
  return { type: 'FeatureCollection', features };
}

// Add all asset-related sources and layers to the map
function addAssetLayers() {
  const assetData = getFilteredAssets();

  _occMap.addSource('assets', { type: 'geojson', data: assetData });

  _occMap.addLayer({
    id: 'asset-fills',
    type: 'fill',
    source: 'assets',
    minzoom: 18,
    paint: {
      'fill-color': '#6B7B8D',
      'fill-opacity': 0.6
    }
  });

  _occMap.addLayer({
    id: 'asset-outlines',
    type: 'line',
    source: 'assets',
    minzoom: 18,
    paint: {
      'line-color': '#333333',
      'line-width': 0.8
    }
  });
}

function occInitMap() {
  const container = document.getElementById('rp-mapbox');
  if (!container) return;

  // Clean up previous map instance
  if (_searchMarker) { _searchMarker.remove(); _searchMarker = null; }
  if (_occMap) {
    _occMap.remove();
    _occMap = null;
  }

  _occMap = new maplibregl.Map({
    container: 'rp-mapbox',
    style: MAP_STYLES[state.occMapStyle] ? MAP_STYLES[state.occMapStyle].url : MAP_STYLES['positron'].url,
    center: [7.9, 47.1],
    zoom: 7.2
  });

  // Fullscreen toggle
  const fullscreenCtrl = {
    onAdd(map) {
      const div = document.createElement('div');
      div.className = 'maplibregl-ctrl maplibregl-ctrl-group';
      div.innerHTML = '<button class="rp-map-btn rp-map-btn--fullscreen" type="button" title="Vollbild" aria-label="Vollbild"><svg class="rp-fs-enter" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,2 2,2 2,6"/><polyline points="14,2 18,2 18,6"/><polyline points="6,18 2,18 2,14"/><polyline points="14,18 18,18 18,14"/></svg><svg class="rp-fs-exit" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:none"><polyline points="2,6 6,6 6,2"/><polyline points="14,2 14,6 18,6"/><polyline points="2,14 6,14 6,18"/><polyline points="18,14 14,14 14,18"/></svg></button>';
      const btn = div.querySelector('button');
      const enterIcon = div.querySelector('.rp-fs-enter');
      const exitIcon = div.querySelector('.rp-fs-exit');
      btn.addEventListener('click', () => {
        const mapEl = map.getContainer();
        if (!document.fullscreenElement) {
          mapEl.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen();
        }
      });
      document.addEventListener('fullscreenchange', () => {
        const isFs = !!document.fullscreenElement;
        enterIcon.style.display = isFs ? 'none' : '';
        exitIcon.style.display = isFs ? '' : 'none';
        btn.title = isFs ? 'Vollbild beenden' : 'Vollbild';
        btn.setAttribute('aria-label', btn.title);
      });
      return div;
    },
    onRemove() {}
  };
  _occMap.addControl(fullscreenCtrl, 'top-right');

  // Navigation controls
  _occMap.addControl(new maplibregl.NavigationControl(), 'top-right');

  // Home button — zoom to full extent
  const homeCtrl = {
    onAdd(map) {
      const div = document.createElement('div');
      div.className = 'maplibregl-ctrl maplibregl-ctrl-group';
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
      div.className = 'maplibregl-ctrl maplibregl-ctrl-group';
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

  // Swisstopo address search overlay
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
            _searchMarker = new maplibregl.Marker({ color: '#0066cc' }).setLngLat(lngLat).addTo(_occMap);
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

  // Scale bar
  _occMap.addControl(new maplibregl.ScaleControl({ maxWidth: 200 }), 'bottom-left');

  // Background map style switcher
  function getStyleSwatch(styleId, w, h) {
    const s = MAP_STYLES[styleId];
    const color = s ? s.swatch : '#e8e8e8';
    return `<span class="rp-style-swatch" style="width:${w}px;height:${h}px;background:${color};display:block;border-radius:3px;"></span>`;
  }

  const styleSwitcher = document.createElement('div');
  styleSwitcher.className = 'rp-style-switcher';
  styleSwitcher.innerHTML = `
    <div class="rp-style-switcher__panel" id="rp-style-panel">
      ${Object.entries(MAP_STYLES).map(([id, s]) => `
        <button class="rp-style-option${id === state.occMapStyle ? ' rp-style-option--active' : ''}" data-style="${id}" title="${s.name}">
          ${getStyleSwatch(id, 70, 50)}
          <span>${s.name}</span>
        </button>`).join('')}
    </div>
    <button class="rp-style-switcher__btn" id="rp-style-btn" title="Hintergrund wechseln">
      ${getStyleSwatch(state.occMapStyle, 80, 60)}
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
      // Update main button swatch
      const oldSwatch = styleBtn.querySelector('.rp-style-swatch');
      if (oldSwatch) oldSwatch.style.background = MAP_STYLES[styleId].swatch;
      // Change map style
      _occMap.setStyle(MAP_STYLES[styleId].url);
      // Persist in URL
      occPushHash();
      // Close panel
      stylePanel.classList.remove('rp-style-switcher__panel--show');
      styleBtn.classList.remove('rp-style-switcher__btn--active');
    });
  });

  // Legend accordion widget
  const legendAccordion = document.createElement('div');
  legendAccordion.className = 'rp-legend expanded';
  legendAccordion.id = 'rpLegend';
  legendAccordion.innerHTML = `
    <button class="rp-legend__header" id="rpLegendHeader">
      <svg class="rp-legend__icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><circle cx="7" cy="6" r="2" fill="currentColor"/><line x1="3" y1="12" x2="21" y2="12"/><circle cx="14" cy="12" r="2" fill="currentColor"/><line x1="3" y1="18" x2="21" y2="18"/><circle cx="10" cy="18" r="2" fill="currentColor"/></svg>
      <span class="rp-legend__title">Legende</span>
      <svg class="rp-legend__chevron" viewBox="0 0 12 12" width="12" height="12"><polyline points="3,4 6,7 9,4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="rp-legend__content" id="rpLegendContent">

      <div class="rp-legend__section" data-layer="buildings">
        <div class="rp-legend__section-header">
          <span class="rp-legend__section-title">Geb\u00e4ude</span>
          <button class="rp-legend__eye active" data-layer="buildings" title="Layer ein/ausblenden">
            <svg class="rp-legend__eye-open" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="3"/></svg>
            <svg class="rp-legend__eye-closed" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><line x1="3" y1="3" x2="17" y2="17"/></svg>
          </button>
        </div>
        <div class="rp-legend__items">
          <div class="rp-legend__item"><span class="rp-legend__swatch" style="background:#d73027"></span><span>Geb\u00e4ude</span></div>
        </div>
      </div>

      <div class="rp-legend__section" data-layer="rooms">
        <div class="rp-legend__section-header">
          <span class="rp-legend__section-title">R\u00e4ume</span>
          <button class="rp-legend__eye active" data-layer="rooms" title="Layer ein/ausblenden">
            <svg class="rp-legend__eye-open" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="3"/></svg>
            <svg class="rp-legend__eye-closed" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><line x1="3" y1="3" x2="17" y2="17"/></svg>
          </button>
        </div>
        <div class="rp-legend__items">
          ${Object.entries(ROOM_COLORS)
            .filter(([type]) => type !== 'Korridor')
            .map(([type, color]) => `<div class="rp-legend__item"><span class="rp-legend__swatch" style="background:${color}"></span><span>${type}</span></div>`).join('')}
        </div>
      </div>

      <div class="rp-legend__section" data-layer="assets">
        <div class="rp-legend__section-header">
          <span class="rp-legend__section-title">Inventar</span>
          <button class="rp-legend__eye active" data-layer="assets" title="Layer ein/ausblenden">
            <svg class="rp-legend__eye-open" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="3"/></svg>
            <svg class="rp-legend__eye-closed" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><line x1="3" y1="3" x2="17" y2="17"/></svg>
          </button>
        </div>
        <div class="rp-legend__items">
          <div class="rp-legend__item"><span class="rp-legend__swatch" style="background:#6B7B8D"></span><span>Inventarobjekt</span></div>
        </div>
      </div>

    </div>
  `;
  container.appendChild(legendAccordion);

  // Accordion expand/collapse
  legendAccordion.querySelector('#rpLegendHeader').addEventListener('click', () => {
    legendAccordion.classList.toggle('expanded');
  });

  // Layer visibility map: layer name → MapLibre layer IDs
  const LAYER_MAP = {
    'buildings': ['building-points', 'building-labels', 'building-footprints-fill', 'building-footprints-outline'],
    'rooms': ['room-fills', 'room-outlines', 'room-labels'],
    'assets': ['asset-fills', 'asset-outlines']
  };

  function setLayerVisibility(layerName, visible) {
    const visibility = visible ? 'visible' : 'none';
    const layerIds = LAYER_MAP[layerName] || [];
    for (const id of layerIds) {
      if (_occMap.getLayer(id)) {
        _occMap.setLayoutProperty(id, 'visibility', visibility);
      }
    }
    const section = legendAccordion.querySelector(`.rp-legend__section[data-layer="${layerName}"]`);
    if (section) section.classList.toggle('rp-legend__section--hidden', !visible);
  }

  // Eye toggle buttons
  legendAccordion.querySelectorAll('.rp-legend__eye').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const layer = btn.dataset.layer;
      const isActive = btn.classList.toggle('active');
      setLayerVisibility(layer, isActive);
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
    _occMap.addSource('buildings', { type: 'geojson', data: buildingPointsFromGeo(filteredGeo) });
    _occMap.addSource('building-footprints', { type: 'geojson', data: filteredGeo });
    _occMap.addLayer({ id: 'building-footprints-fill', type: 'fill', source: 'building-footprints', minzoom: 15, paint: { 'fill-color': '#d73027', 'fill-opacity': 0.15 } });
    _occMap.addLayer({ id: 'building-footprints-outline', type: 'line', source: 'building-footprints', minzoom: 15, paint: { 'line-color': '#d73027', 'line-width': 2, 'line-opacity': 0.6 } });
    _occMap.addLayer({ id: 'building-points', type: 'circle', source: 'buildings', paint: { 'circle-radius': 8, 'circle-color': '#d73027', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });
    _occMap.addLayer({ id: 'building-labels', type: 'symbol', source: 'buildings', minzoom: 14, layout: { 'text-field': ['get', 'objectCode'], 'text-size': 12, 'text-anchor': 'bottom', 'text-offset': [0, -1.2], 'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'], 'text-allow-overlap': true }, paint: { 'text-color': '#1a1a1a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });

    // Room layers
    addRoomLayers();

    // Asset layers
    addAssetLayers();
  });

  _occMap.on('load', () => {
    if (!BUILDINGS_GEO) return;

    // Add sources/layers if not already added by style.load
    if (!_occMap.getSource('buildings')) {
      // Determine which buildings to show based on current selection
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

      // Point source for markers/labels (derived from centroids)
      _occMap.addSource('buildings', {
        type: 'geojson',
        data: buildingPointsFromGeo(filteredGeo)
      });

      // Polygon source for building footprints
      _occMap.addSource('building-footprints', {
        type: 'geojson',
        data: filteredGeo
      });

      // Footprint fill layer (visible at close zoom)
      _occMap.addLayer({
        id: 'building-footprints-fill',
        type: 'fill',
        source: 'building-footprints',
        minzoom: 15,
        paint: {
          'fill-color': '#d73027',
          'fill-opacity': 0.15
        }
      });

      // Footprint outline layer
      _occMap.addLayer({
        id: 'building-footprints-outline',
        type: 'line',
        source: 'building-footprints',
        minzoom: 15,
        paint: {
          'line-color': '#d73027',
          'line-width': 2,
          'line-opacity': 0.6
        }
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
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#1a1a1a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5
        }
      });

      // Room layers
      addRoomLayers();

      // Asset layers
      addAssetLayers();

      // Fit map to visible features
      if (filteredGeo.features.length > 0 && selId && selId !== 'ch') {
        if (filteredGeo.features.length === 1) {
          const coords = filteredGeo.features[0].properties.centroid;
          _occMap.jumpTo({ center: coords, zoom: 17 });
        } else {
          const bounds = new maplibregl.LngLatBounds();
          filteredGeo.features.forEach(f => bounds.extend(f.properties.centroid));
          _occMap.fitBounds(bounds, { padding: 80, maxZoom: 15 });
        }
      }
    }

    // Click popup with building info
    const clickPopup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 12, maxWidth: '280px' });
    const handleMarkerClick = (e) => {
      // If a room fill is under the click, skip the building popup
      const roomHits = _occMap.queryRenderedFeatures(e.point, { layers: ['room-fills'] });
      if (roomHits.length > 0) return;

      const feature = e.features[0];
      const p = feature.properties;
      const buildingId = p.buildingId;
      const centroid = JSON.parse(p.centroid || 'null');
      const lngLat = centroid || e.lngLat;
      const address = JSON.parse(p.address || '{}');
      const addressStr = address.street ? `${address.street}, ${address.postalCode} ${address.city}` : '';
      const areaStr = p.areaGross ? Number(p.areaGross).toLocaleString('de-CH') + ' m\u00b2' : '';

      // Hide hover popup
      hoverPopup.remove();

      clickPopup
        .setLngLat(lngLat)
        .setHTML(`
          <div class="rp-map-popup">
            <strong class="rp-map-popup__title">${p.name}</strong>
            ${p.objectCode ? `<div class="rp-map-popup__code">${p.objectCode}</div>` : ''}
            ${addressStr ? `<div class="rp-map-popup__row">${addressStr}</div>` : ''}
            ${p.category ? `<div class="rp-map-popup__row">${p.category}</div>` : ''}
            ${areaStr ? `<div class="rp-map-popup__row">${areaStr}</div>` : ''}
            ${p.status ? `<div class="rp-map-popup__row">${p.status}</div>` : ''}
            <a class="rp-map-popup__link" href="javascript:void(0)" onclick="occSelectBuilding('${buildingId}')">Details anzeigen \u2192</a>
          </div>
        `)
        .addTo(_occMap);
    };
    _occMap.on('click', 'building-points', handleMarkerClick);
    _occMap.on('click', 'building-labels', handleMarkerClick);
    _occMap.on('click', 'building-footprints-fill', handleMarkerClick);

    // Pointer cursor on hover
    ['building-points', 'building-labels', 'building-footprints-fill'].forEach(layer => {
      _occMap.on('mouseenter', layer, () => {
        _occMap.getCanvas().style.cursor = 'pointer';
      });
      _occMap.on('mouseleave', layer, () => {
        _occMap.getCanvas().style.cursor = '';
      });
    });

    // Hover tooltip (show building name)
    const hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'rp-map-hover' });
    const showHover = (e) => {
      if (clickPopup.isOpen()) return;
      const f = e.features[0];
      const centroid = JSON.parse(f.properties.centroid || 'null');
      const lngLat = centroid || e.lngLat;
      hoverPopup.setLngLat(lngLat)
        .setHTML(`<strong>${f.properties.name}</strong>`)
        .addTo(_occMap);
    };
    const hideHover = () => hoverPopup.remove();
    _occMap.on('mouseenter', 'building-points', showHover);
    _occMap.on('mouseleave', 'building-points', hideHover);
    _occMap.on('mouseenter', 'building-labels', showHover);
    _occMap.on('mouseleave', 'building-labels', hideHover);
    _occMap.on('mouseenter', 'building-footprints-fill', showHover);
    _occMap.on('mouseleave', 'building-footprints-fill', hideHover);

    // Room click popup
    _occMap.on('click', 'room-fills', (e) => {
      // Skip if an asset is under the click
      const assetHits = _occMap.queryRenderedFeatures(e.point, { layers: ['asset-fills'] });
      if (assetHits.length > 0) return;

      const f = e.features[0];
      const p = f.properties;
      hoverPopup.remove();
      clickPopup
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="rp-map-popup">
            <strong class="rp-map-popup__title">${p.nr}</strong>
            <div class="rp-map-popup__row">${p.type}</div>
            <div class="rp-map-popup__row">${p.area} m\u00b2</div>
            ${p.workspaces ? `<div class="rp-map-popup__row">${p.workspaces} Arbeitspl\u00e4tze</div>` : ''}
          </div>
        `)
        .addTo(_occMap);
    });

    // Room cursor + hover
    _occMap.on('mouseenter', 'room-fills', () => { _occMap.getCanvas().style.cursor = 'pointer'; });
    _occMap.on('mouseleave', 'room-fills', () => { _occMap.getCanvas().style.cursor = ''; });

    // Asset click popup
    _occMap.on('click', 'asset-fills', (e) => {
      const f = e.features[0];
      const p = f.properties;
      hoverPopup.remove();
      const condLabel = p.condition || '\u2013';
      const statusLabel = p.status || '\u2013';
      const costStr = p.acquisitionCost ? Number(p.acquisitionCost).toLocaleString('de-CH') + ' CHF' : '';
      clickPopup
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="rp-map-popup">
            <strong class="rp-map-popup__title">${p.name}</strong>
            ${p.brand ? `<div class="rp-map-popup__row">${p.brand}</div>` : ''}
            <div class="rp-map-popup__row">Zustand: ${condLabel}</div>
            <div class="rp-map-popup__row">Status: ${statusLabel}</div>
            ${p.acquisitionDate ? `<div class="rp-map-popup__row">Beschafft: ${p.acquisitionDate}</div>` : ''}
            ${costStr ? `<div class="rp-map-popup__row">${costStr}</div>` : ''}
          </div>
        `)
        .addTo(_occMap);
    });

    // Asset cursor + hover
    _occMap.on('mouseenter', 'asset-fills', () => { _occMap.getCanvas().style.cursor = 'pointer'; });
    _occMap.on('mouseleave', 'asset-fills', () => { _occMap.getCanvas().style.cursor = ''; });
  });
}

// ===================================================================
// OCCUPANCY VIEW UPDATES
// ===================================================================

// Incremental update — avoids full render() which destroys the map
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

// Navigate to a building from map popup
function occSelectBuilding(buildingId) {
  state.occSelectedId = buildingId;
  const found = occFindNode(buildingId);
  if (found) {
    found.path.forEach(n => state.occExpandedIds.add(n.id));
    const tabs = occGetTabs(found.node.type);
    state.occTab = tabs[0].id;
  }
  occUpdateView();
  occPushHash();
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

  // Update both point and footprint sources
  source.setData(buildingPointsFromGeo(filteredGeo));
  const fpSource = _occMap.getSource('building-footprints');
  if (fpSource) fpSource.setData(filteredGeo);

  // Update rooms source
  const roomSource = _occMap.getSource('rooms');
  if (roomSource) roomSource.setData(getFilteredRooms());

  // Update assets source
  const assetSource = _occMap.getSource('assets');
  if (assetSource) assetSource.setData(getFilteredAssets());

  // Determine zoom behavior based on selection type
  const found = selId ? occFindNode(selId) : null;
  const nodeType = found ? found.node.type : null;

  if (filteredGeo.features.length > 0 && selId && selId !== 'ch') {
    if (nodeType === 'floor') {
      // Floor selected — zoom close to show room details
      const centroid = filteredGeo.features[0].properties.centroid;
      _occMap.flyTo({ center: centroid, zoom: 18.5, speed: 1.4 });
    } else if (filteredGeo.features.length === 1) {
      // Single building — fly to it at building zoom level
      const coords = filteredGeo.features[0].properties.centroid;
      _occMap.flyTo({ center: coords, zoom: 17, speed: 1.4 });
    } else {
      // Multiple buildings in kanton — fit bounds
      const bounds = new maplibregl.LngLatBounds();
      filteredGeo.features.forEach(f => bounds.extend(f.properties.centroid));
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
  // Initialize map if container exists
  occInitMap();

  // Attach event handlers
  occAttachTreeEvents();
  occAttachContentEvents();
}
