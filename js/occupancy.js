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
    const assets = ASSETS_GEO ? ASSETS_GEO.features.filter(f => f.properties.buildingId === b.id).map(f => f.properties) : [];
    const totalValue = assets.reduce((s, a) => s + (a.acquisitionCost || 0), 0);
    return `
      <div class="rp-detail">
        <h2 class="rp-detail__title">${escapeHtml(b.label)}</h2>
        <p class="rp-detail__subtitle">${b.address}</p>
        <div class="rp-detail__section-title">Inventar (${assets.length} Objekte${totalValue ? ' \u00b7 ' + totalValue.toLocaleString('de-CH') + ' CHF' : ''})</div>
        ${assets.length ? `
        <table class="rp-table">
          <thead><tr><th>Name</th><th>Marke</th><th>Zustand</th><th>Status</th><th>Wert</th></tr></thead>
          <tbody>
            ${assets.map(a => `<tr><td>${escapeHtml(a.name || '')}</td><td>${escapeHtml(a.brand || '\u2013')}</td><td>${escapeHtml(a.condition || '\u2013')}</td><td>${escapeHtml(a.status || '\u2013')}</td><td>${a.acquisitionCost ? a.acquisitionCost.toLocaleString('de-CH') + ' CHF' : '\u2013'}</td></tr>`).join('')}
          </tbody>
        </table>` : '<div class="rp-detail__empty">Keine Ausstattungsdaten vorhanden.</div>'}
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
    const assets = ASSETS_GEO ? ASSETS_GEO.features.filter(f => f.properties.floorId === floor.id).map(f => f.properties) : [];
    const totalValue = assets.reduce((s, a) => s + (a.acquisitionCost || 0), 0);
    return `
      <div class="rp-detail">
        <h2 class="rp-detail__title">${floor.label} \u2013 ${escapeHtml(bLabel)}</h2>
        <p class="rp-detail__subtitle">${floor.flaeche} &middot; ${floor.plaetze} Arbeitspl\u00e4tze &middot; ${floor.raeume} R\u00e4ume</p>
        <div class="rp-detail__section-title">Inventar (${assets.length} Objekte${totalValue ? ' \u00b7 ' + totalValue.toLocaleString('de-CH') + ' CHF' : ''})</div>
        ${assets.length ? `
        <table class="rp-table">
          <thead><tr><th>Name</th><th>Raum</th><th>Marke</th><th>Zustand</th><th>Status</th><th>Wert</th></tr></thead>
          <tbody>
            ${assets.map(a => {
              const room = (floor.rooms || []).find(r => r.id === a.roomId);
              const roomLabel = room ? room.nr : '\u2013';
              return `<tr><td>${escapeHtml(a.name || '')}</td><td>${escapeHtml(roomLabel)}</td><td>${escapeHtml(a.brand || '\u2013')}</td><td>${escapeHtml(a.condition || '\u2013')}</td><td>${escapeHtml(a.status || '\u2013')}</td><td>${a.acquisitionCost ? a.acquisitionCost.toLocaleString('de-CH') + ' CHF' : '\u2013'}</td></tr>`;
            }).join('')}
          </tbody>
        </table>` : '<div class="rp-detail__empty">Keine Ausstattungsdaten vorhanden.</div>'}
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
let _is3D = false;
let _3dTransitioning = false;
let _editMode = false;
let _activeEditTool = null;
let _editSelectedInfo = null; // { source, featureIndex, feature, geo }
let _editDragging = false;

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

// Get filtered floor features based on current selection
function getFilteredFloors() {
  if (!FLOORS_GEO) return { type: 'FeatureCollection', features: [] };
  const selId = state.occSelectedId;
  if (!selId || selId === 'ch') return { type: 'FeatureCollection', features: [] };

  const found = occFindNode(selId);
  if (!found) return { type: 'FeatureCollection', features: [] };

  const node = found.node;
  let features;
  if (node.type === 'floor') {
    features = FLOORS_GEO.features.filter(f => f.properties.floorId === selId);
  } else {
    features = [];
  }
  return { type: 'FeatureCollection', features };
}

// Add floor polygon sources and layers to the map
function addFloorLayers() {
  const floorData = getFilteredFloors();

  _occMap.addSource('floors', { type: 'geojson', data: floorData });

  _occMap.addLayer(_is3D ? {
    id: 'floor-fills',
    type: 'fill-extrusion',
    source: 'floors',
    minzoom: 15,
    paint: {
      'fill-extrusion-color': '#e8e4df',
      'fill-extrusion-opacity': 0.4,
      'fill-extrusion-base': ['get', 'baseHeight'],
      'fill-extrusion-height': ['+', ['get', 'baseHeight'], 0.1]
    }
  } : {
    id: 'floor-fills',
    type: 'fill',
    source: 'floors',
    minzoom: 15,
    paint: {
      'fill-color': '#e8e4df',
      'fill-opacity': 0.4
    }
  });

  _occMap.addLayer({
    id: 'floor-outlines',
    type: 'line',
    source: 'floors',
    minzoom: 15,
    layout: { visibility: _is3D ? 'none' : 'visible' },
    paint: {
      'line-color': '#999999',
      'line-width': 1.5
    }
  });

  _occMap.addLayer({
    id: 'floor-labels',
    type: 'symbol',
    source: 'floors',
    minzoom: 16,
    layout: {
      'text-field': ['get', 'nameShort'],
      'text-size': 12,
      'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
      'text-allow-overlap': true,
      'text-anchor': 'center',
      ...(_is3D ? { 'symbol-z-offset': ['get', 'baseHeight'] } : {})
    },
    paint: {
      'text-color': '#666666',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1
    }
  });
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
  } else {
    features = [];
  }
  return { type: 'FeatureCollection', features };
}

// Add all room-related sources and layers to the map
function addRoomLayers() {
  const roomData = getFilteredRooms();

  _occMap.addSource('rooms', { type: 'geojson', data: roomData });

  _occMap.addLayer(_is3D ? {
    id: 'room-fills',
    type: 'fill-extrusion',
    source: 'rooms',
    minzoom: 16,
    paint: {
      'fill-extrusion-color': ROOM_COLOR_MATCH,
      'fill-extrusion-opacity': 0.6,
      'fill-extrusion-base': ['get', 'baseHeight'],
      'fill-extrusion-height': ['+', ['get', 'baseHeight'], 0.1]
    }
  } : {
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
    layout: { visibility: _is3D ? 'none' : 'visible' },
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
      'text-anchor': 'center',
      ...(_is3D ? { 'symbol-z-offset': ['get', 'baseHeight'] } : {})
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
  } else {
    features = [];
  }
  return { type: 'FeatureCollection', features };
}

// Add all asset-related sources and layers to the map
function addAssetLayers() {
  const assetData = getFilteredAssets();

  _occMap.addSource('assets', { type: 'geojson', data: assetData });

  _occMap.addLayer(_is3D ? {
    id: 'asset-fills',
    type: 'fill-extrusion',
    source: 'assets',
    minzoom: 18,
    paint: {
      'fill-extrusion-color': '#6B7B8D',
      'fill-extrusion-opacity': 0.6,
      'fill-extrusion-base': ['get', 'baseHeight'],
      'fill-extrusion-height': ['+', ['get', 'baseHeight'], 0.1]
    }
  } : {
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
    layout: { visibility: _is3D ? 'none' : 'visible' },
    paint: {
      'line-color': '#333333',
      'line-width': 0.8
    }
  });
}

// Swap fill ↔ fill-extrusion layers at runtime (sources remain unchanged)
function swapFillLayers(to3D) {
  const configs = [
    { id: 'floor-fills', source: 'floors', minzoom: 15,
      paint2D: { 'fill-color': '#e8e4df', 'fill-opacity': 0.4 },
      paint3D: { 'fill-extrusion-color': '#e8e4df', 'fill-extrusion-opacity': 0.4, 'fill-extrusion-base': ['get', 'baseHeight'], 'fill-extrusion-height': ['+', ['get', 'baseHeight'], 0.1] } },
    { id: 'room-fills', source: 'rooms', minzoom: 16,
      paint2D: { 'fill-color': ROOM_COLOR_MATCH, 'fill-opacity': 0.6 },
      paint3D: { 'fill-extrusion-color': ROOM_COLOR_MATCH, 'fill-extrusion-opacity': 0.6, 'fill-extrusion-base': ['get', 'baseHeight'], 'fill-extrusion-height': ['+', ['get', 'baseHeight'], 0.1] } },
    { id: 'asset-fills', source: 'assets', minzoom: 18,
      paint2D: { 'fill-color': '#6B7B8D', 'fill-opacity': 0.6 },
      paint3D: { 'fill-extrusion-color': '#6B7B8D', 'fill-extrusion-opacity': 0.6, 'fill-extrusion-base': ['get', 'baseHeight'], 'fill-extrusion-height': ['+', ['get', 'baseHeight'], 0.1] } }
  ];
  for (const cfg of configs) {
    if (!_occMap.getSource(cfg.source)) continue;
    if (_occMap.getLayer(cfg.id)) _occMap.removeLayer(cfg.id);
    _occMap.addLayer({
      id: cfg.id,
      type: to3D ? 'fill-extrusion' : 'fill',
      source: cfg.source,
      minzoom: cfg.minzoom,
      paint: to3D ? cfg.paint3D : cfg.paint2D
    });
  }

  // Toggle outline layers (line layers can't render at height, so hide in 3D)
  const outlineVisibility = to3D ? 'none' : 'visible';
  ['floor-outlines', 'room-outlines', 'asset-outlines'].forEach(id => {
    if (_occMap.getLayer(id)) _occMap.setLayoutProperty(id, 'visibility', outlineVisibility);
  });

  // Swap label layers to add/remove symbol-z-offset (layout props can't be updated dynamically)
  const labelConfigs = [
    { id: 'floor-labels', source: 'floors', minzoom: 16,
      layout: { 'text-field': ['get', 'nameShort'], 'text-size': 12, 'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'], 'text-allow-overlap': true, 'text-anchor': 'center' },
      paint: { 'text-color': '#666666', 'text-halo-color': '#ffffff', 'text-halo-width': 1 } },
    { id: 'room-labels', source: 'rooms', minzoom: 17,
      layout: { 'text-field': ['concat', ['get', 'nr'], '\n', ['get', 'type']], 'text-size': 11, 'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'], 'text-allow-overlap': false, 'text-anchor': 'center' },
      paint: { 'text-color': '#1a1a1a', 'text-halo-color': '#ffffff', 'text-halo-width': 1 } }
  ];
  for (const cfg of labelConfigs) {
    if (!_occMap.getSource(cfg.source)) continue;
    if (_occMap.getLayer(cfg.id)) _occMap.removeLayer(cfg.id);
    const layout = { ...cfg.layout };
    if (to3D) layout['symbol-z-offset'] = ['get', 'baseHeight'];
    _occMap.addLayer({ id: cfg.id, type: 'symbol', source: cfg.source, minzoom: cfg.minzoom, layout, paint: cfg.paint });
  }

  ensureLayerOrder();
}

// Animated 3D transition (1000ms, ease-out cubic, synchronized terrain + pitch)
function animate3DTransition(entering) {
  if (_3dTransitioning || !_occMap) return;
  _3dTransitioning = true;

  const container = _occMap.getContainer();
  const btn = container.querySelector('.rp-map-btn--3d');
  if (btn) btn.disabled = true;

  const duration = 1000;
  const startTime = performance.now();
  const startPitch = _occMap.getPitch();
  const startBearing = _occMap.getBearing();
  const targetPitch = entering ? 60 : 0;
  const targetBearing = entering ? -20 : 0;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  if (entering) {
    _is3D = true;
    swapFillLayers(true);
    if (_occMap.getSource('terrain-dem')) {
      _occMap.setTerrain({ source: 'terrain-dem', exaggeration: 0 });
    }
  }

  function tick(now) {
    if (!_occMap) { _3dTransitioning = false; return; }

    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(t);

    // Terrain exaggeration
    const exagg = entering ? eased : 1.0 - eased;
    if (_occMap.getSource('terrain-dem')) {
      _occMap.setTerrain({ source: 'terrain-dem', exaggeration: Math.max(0, exagg) });
    }

    // Camera pitch & bearing
    _occMap.jumpTo({
      pitch: startPitch + (targetPitch - startPitch) * eased,
      bearing: startBearing + (targetBearing - startBearing) * eased
    });

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      if (!entering) {
        _is3D = false;
        _occMap.setTerrain(null);
        swapFillLayers(false);
      }
      if (btn) {
        btn.disabled = false;
        btn.querySelector('span').textContent = entering ? '2D' : '3D';
      }
      _3dTransitioning = false;
    }
  }

  requestAnimationFrame(tick);
}

// --- Print preview helpers ---
let _printOverlay = null;

function getPrintDimensions(key) {
  const dims = {
    'landscape-a4': { w: 297, h: 210 },
    'portrait-a4':  { w: 210, h: 297 },
    'landscape-a3': { w: 420, h: 297 },
    'portrait-a3':  { w: 297, h: 420 }
  };
  return dims[key] || dims['landscape-a4'];
}

function getMapScale() {
  if (!_occMap) return 25000;
  const center = _occMap.getCenter();
  const zoom = _occMap.getZoom();
  const metersPerPixel = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
  const pixelsPerMeter = 96 / 0.0254;
  return Math.round(metersPerPixel * pixelsPerMeter);
}

function showPrintPreview() {
  if (_printOverlay) {
    _printOverlay.classList.add('active');
    updatePrintPreview();
  }
}

function hidePrintPreview() {
  if (_printOverlay) _printOverlay.classList.remove('active');
}

function updatePrintPreview() {
  if (!_printOverlay || !_occMap) return;
  const select = document.getElementById('rpPrintOrientation');
  if (!select) return;

  const orientation = select.value;
  const printDims = getPrintDimensions(orientation);
  const aspectRatio = printDims.w / printDims.h;

  const viewRect = _occMap.getContainer().getBoundingClientRect();
  const viewWidth = viewRect.width;
  const viewHeight = viewRect.height;

  const padding = 60;
  const maxWidth = viewWidth - padding * 2;
  const maxHeight = viewHeight - padding * 2;

  let cropWidth, cropHeight;
  if (maxWidth / aspectRatio <= maxHeight) {
    cropWidth = maxWidth;
    cropHeight = maxWidth / aspectRatio;
  } else {
    cropHeight = maxHeight;
    cropWidth = maxHeight * aspectRatio;
  }

  const cropX = (viewWidth - cropWidth) / 2;
  const cropY = (viewHeight - cropHeight) / 2;

  // Update SVG mask rectangle
  const maskRect = _printOverlay.querySelector('#rp-print-crop-mask');
  if (maskRect) {
    maskRect.setAttribute('x', cropX);
    maskRect.setAttribute('y', cropY);
    maskRect.setAttribute('width', cropWidth);
    maskRect.setAttribute('height', cropHeight);
  }

  // Update crop border
  const cropBorder = _printOverlay.querySelector('.rp-print-crop');
  if (cropBorder) {
    cropBorder.style.left = cropX + 'px';
    cropBorder.style.top = cropY + 'px';
    cropBorder.style.width = cropWidth + 'px';
    cropBorder.style.height = cropHeight + 'px';
  }

  // Update label
  const label = _printOverlay.querySelector('.rp-print-crop-label');
  if (label) {
    const formatLabel = orientation.includes('a3') ? 'A3' : 'A4';
    const orientLabel = orientation.includes('landscape') ? 'Querformat' : 'Hochformat';
    label.textContent = formatLabel + ' ' + orientLabel;
  }
}

// --- Measure helpers ---
let _measureState = {
  active: false,
  points: [],       // [[lng, lat], ...]
  markers: [],      // maplibregl.Marker[]
  labelMarkers: [], // maplibregl.Marker[] for distance labels
  isClosed: false,
  lineSourceId: 'measure-line-source',
  lineLayerId: 'measure-line'
};
let _measureDisplay = null;

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculatePolygonArea(points) {
  if (points.length < 3) return 0;
  const n = points.length;
  const avgLat = points.reduce((s, p) => s + p[1], 0) / n;
  const latScale = 111320;
  const lonScale = 111320 * Math.cos(avgLat * Math.PI / 180);
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i][0] * lonScale * points[j][1] * latScale;
    area -= points[j][0] * lonScale * points[i][1] * latScale;
  }
  return Math.abs(area / 2);
}

function formatDistance(meters) {
  return meters >= 1000 ? (meters / 1000).toFixed(2) + ' km' : Math.round(meters) + ' m';
}

function formatArea(sqm) {
  if (sqm >= 1000000) return (sqm / 1000000).toFixed(2) + ' km\u00b2';
  if (sqm >= 10000) return (sqm / 10000).toFixed(2) + ' ha';
  return Math.round(sqm) + ' m\u00b2';
}

function updateMeasureLine() {
  if (!_occMap) return;
  const coords = _measureState.points.slice();
  if (_measureState.isClosed && coords.length >= 3) coords.push(coords[0]);
  const data = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };
  if (_occMap.getSource(_measureState.lineSourceId)) {
    _occMap.getSource(_measureState.lineSourceId).setData(data);
  } else {
    _occMap.addSource(_measureState.lineSourceId, { type: 'geojson', data });
    _occMap.addLayer({
      id: _measureState.lineLayerId,
      type: 'line',
      source: _measureState.lineSourceId,
      paint: { 'line-color': '#000', 'line-width': 2, 'line-dasharray': [4, 3] }
    });
  }
}

function updateMeasureLabels() {
  _measureState.labelMarkers.forEach(m => m.remove());
  _measureState.labelMarkers = [];
  const pts = _measureState.points;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = haversineDistance(pts[i][1], pts[i][0], pts[i + 1][1], pts[i + 1][0]);
    const mid = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
    const el = document.createElement('div');
    el.className = 'rp-measure-label';
    el.textContent = formatDistance(d);
    const m = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(mid).addTo(_occMap);
    _measureState.labelMarkers.push(m);
  }
  if (_measureState.isClosed && pts.length >= 3) {
    const last = pts[pts.length - 1], first = pts[0];
    const d = haversineDistance(last[1], last[0], first[1], first[0]);
    const mid = [(last[0] + first[0]) / 2, (last[1] + first[1]) / 2];
    const el = document.createElement('div');
    el.className = 'rp-measure-label';
    el.textContent = formatDistance(d);
    const m = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(mid).addTo(_occMap);
    _measureState.labelMarkers.push(m);
  }
}

function updateMeasureDisplay() {
  if (!_measureDisplay) return;
  const pts = _measureState.points;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += haversineDistance(pts[i][1], pts[i][0], pts[i + 1][1], pts[i + 1][0]);
  }
  if (_measureState.isClosed && pts.length >= 3) {
    total += haversineDistance(pts[pts.length - 1][1], pts[pts.length - 1][0], pts[0][1], pts[0][0]);
  }
  _measureDisplay.querySelector('#rpMeasureTotalDistance').textContent = formatDistance(total);
  const areaRow = _measureDisplay.querySelector('#rpMeasureAreaRow');
  if (_measureState.isClosed && pts.length >= 3) {
    const area = calculatePolygonArea(pts);
    areaRow.style.display = 'flex';
    _measureDisplay.querySelector('#rpMeasureTotalArea').textContent = formatArea(area);
  } else {
    areaRow.style.display = 'none';
  }
}

function addMeasurePoint(lngLat) {
  const pt = [lngLat.lng, lngLat.lat];
  const idx = _measureState.points.length;
  _measureState.points.push(pt);

  const el = document.createElement('div');
  el.className = 'rp-measure-marker';
  const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' })
    .setLngLat(pt).addTo(_occMap);
  marker._measureIndex = idx;

  marker.on('drag', () => {
    const pos = marker.getLngLat();
    _measureState.points[marker._measureIndex] = [pos.lng, pos.lat];
    updateMeasureLine();
    updateMeasureLabels();
    updateMeasureDisplay();
  });

  el.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const ci = marker._measureIndex;
    if (ci === 0 && _measureState.points.length >= 3 && !_measureState.isClosed) {
      _measureState.isClosed = true;
      updateMeasureLine();
      updateMeasureLabels();
      updateMeasureDisplay();
      return;
    }
    removeMeasurePoint(ci);
  });

  _measureState.markers.push(marker);
  updateMeasureLine();
  updateMeasureLabels();
  updateMeasureDisplay();
}

function removeMeasurePoint(idx) {
  if (idx < 0 || idx >= _measureState.points.length) return;
  _measureState.points.splice(idx, 1);
  _measureState.markers[idx].remove();
  _measureState.markers.splice(idx, 1);
  _measureState.markers.forEach((m, i) => { m._measureIndex = i; });
  if (_measureState.points.length < 3) _measureState.isClosed = false;
  updateMeasureLine();
  updateMeasureLabels();
  updateMeasureDisplay();
}

function isNearFirstPoint(lngLat) {
  if (_measureState.points.length < 3) return false;
  const first = _measureState.points[0];
  const p1 = _occMap.project(lngLat);
  const p2 = _occMap.project({ lng: first[0], lat: first[1] });
  return Math.hypot(p1.x - p2.x, p1.y - p2.y) < 15;
}

function startMeasurement() {
  _measureState.active = true;
  _measureState.points = [];
  _measureState.markers = [];
  _measureState.labelMarkers = [];
  _measureState.isClosed = false;
  if (_measureDisplay) {
    _measureDisplay.classList.add('show');
    _measureDisplay.querySelector('#rpMeasureTotalDistance').textContent = '0 m';
    _measureDisplay.querySelector('#rpMeasureAreaRow').style.display = 'none';
  }
  if (_occMap) _occMap.getCanvas().style.cursor = 'crosshair';
}

function clearMeasurement() {
  _measureState.active = false;
  _measureState.isClosed = false;
  _measureState.markers.forEach(m => m.remove());
  _measureState.labelMarkers.forEach(m => m.remove());
  _measureState.points = [];
  _measureState.markers = [];
  _measureState.labelMarkers = [];
  if (_occMap) {
    if (_occMap.getLayer(_measureState.lineLayerId)) _occMap.removeLayer(_measureState.lineLayerId);
    if (_occMap.getSource(_measureState.lineSourceId)) _occMap.removeSource(_measureState.lineSourceId);
    _occMap.getCanvas().style.cursor = '';
  }
  if (_measureDisplay) _measureDisplay.classList.remove('show');
}

// --- Edit mode geometry helpers ---
function editGetCentroid(coordinates) {
  const ring = Array.isArray(coordinates[0][0]) ? coordinates[0] : coordinates;
  let sumLng = 0, sumLat = 0, n = 0;
  for (const pt of ring) {
    sumLng += pt[0]; sumLat += pt[1]; n++;
  }
  return n ? [sumLng / n, sumLat / n] : [0, 0];
}

function editTranslateCoords(geometry, dLng, dLat) {
  const g = JSON.parse(JSON.stringify(geometry));
  function walk(coords) {
    if (typeof coords[0] === 'number') { coords[0] += dLng; coords[1] += dLat; }
    else coords.forEach(walk);
  }
  walk(g.coordinates);
  return g;
}

function editRotateCoords(geometry, cx, cy, angleDeg) {
  const g = JSON.parse(JSON.stringify(geometry));
  const rad = angleDeg * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  function walk(coords) {
    if (typeof coords[0] === 'number') {
      const dx = coords[0] - cx, dy = coords[1] - cy;
      coords[0] = cx + dx * cos - dy * sin;
      coords[1] = cy + dx * sin + dy * cos;
    } else coords.forEach(walk);
  }
  walk(g.coordinates);
  return g;
}

function editSetHighlight(feature) {
  if (!_occMap) return;
  const src = _occMap.getSource('edit-selection');
  if (!src) return;
  src.setData({ type: 'FeatureCollection', features: feature ? [feature] : [] });
}

function editClearSelection() {
  _editSelectedInfo = null;
  editSetHighlight(null);
}

function editFindFeature(point) {
  const layers = ['asset-fills', 'room-fills', 'floor-fills'];
  const sourceMap = { 'asset-fills': 'assets', 'room-fills': 'rooms', 'floor-fills': 'floors' };
  const geoMap = { 'assets': typeof ASSETS_GEO !== 'undefined' ? ASSETS_GEO : null, 'rooms': typeof ROOMS_GEO !== 'undefined' ? ROOMS_GEO : null, 'floors': typeof FLOORS_GEO !== 'undefined' ? FLOORS_GEO : null };

  for (const layerId of layers) {
    if (!_occMap.getLayer(layerId)) continue;
    const features = _occMap.queryRenderedFeatures(point, { layers: [layerId] });
    if (features.length === 0) continue;
    const f = features[0];
    const sourceName = sourceMap[layerId];
    const geo = geoMap[sourceName];
    if (!geo) continue;
    const props = f.properties;
    let featureIndex = -1;
    for (let i = 0; i < geo.features.length; i++) {
      const gf = geo.features[i];
      if (sourceName === 'rooms' && gf.properties.nr === props.nr && gf.properties.floorId === props.floorId) { featureIndex = i; break; }
      if (sourceName === 'assets' && gf.properties.assetId === props.assetId) { featureIndex = i; break; }
      if (sourceName === 'floors' && gf.properties.floorId === props.floorId) { featureIndex = i; break; }
    }
    if (featureIndex >= 0) {
      return { source: sourceName, featureIndex, feature: geo.features[featureIndex], geo };
    }
  }
  return null;
}

// Ensure correct layer z-order: fills/outlines at bottom, labels above, markers on top
function ensureLayerOrder() {
  if (!_occMap) return;
  // Move layers to top in bottom→top order (last moveLayer call ends up on top)
  const orderedTop = [
    'floor-labels', 'room-labels',
    'building-points', 'building-labels',
    'edit-selection-outline'
  ];
  for (const id of orderedTop) {
    if (_occMap.getLayer(id)) _occMap.moveLayer(id);
  }
}

function editRefreshSource(sourceName) {
  const src = _occMap.getSource(sourceName);
  if (!src) return;
  const filterMap = { 'rooms': getFilteredRooms, 'floors': getFilteredFloors, 'assets': getFilteredAssets };
  const filterFn = filterMap[sourceName];
  if (filterFn) src.setData(filterFn());
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
  _is3D = false;
  _3dTransitioning = false;
  _editMode = false;
  _activeEditTool = null;
  _printOverlay = null;
  clearMeasurement();
  _measureDisplay = null;

  _occMap = new maplibregl.Map({
    container: 'rp-mapbox',
    style: MAP_STYLES[state.occMapStyle] ? MAP_STYLES[state.occMapStyle].url : MAP_STYLES['positron'].url,
    center: [7.9, 47.1],
    zoom: 7.2,
    preserveDrawingBuffer: true
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
        if (_3dTransitioning) return;
        // Reset 3D state immediately
        if (_is3D) {
          _is3D = false;
          map.setTerrain(null);
          swapFillLayers(false);
          const btn3d = container.querySelector('.rp-map-btn--3d span');
          if (btn3d) btn3d.textContent = '3D';
        }
        map.flyTo({ center: [7.9, 47.1], zoom: 7.2, pitch: 0, bearing: 0 });
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
        animate3DTransition(!_is3D);
      });
      return div;
    },
    onRemove() {}
  };
  _occMap.addControl(toggle3dCtrl, 'top-right');

  // ---- Accordion toolbar panel (top-left) ----
  const accordionWrap = document.createElement('div');
  accordionWrap.className = 'rp-accordion-wrap';
  const accordion = document.createElement('div');
  accordion.className = 'rp-accordion';
  accordion.id = 'rpAccordion';
  accordion.innerHTML = `
    <!-- Suche -->
    <div class="rp-accordion__section" data-section="suche">
      <button class="rp-accordion__toggle" type="button">
        <span>Suche</span>
        <svg class="rp-accordion__chevron" viewBox="0 0 12 12" width="12" height="12"><polyline points="4,2 8,6 4,10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="rp-accordion__body">
        <div class="rp-accordion__search">
          <input class="rp-accordion__search-input" type="text" placeholder="Adresse suchen\u2026" autocomplete="off">
          <div class="rp-accordion__search-results"></div>
        </div>
      </div>
    </div>

    <!-- Drucken -->
    <div class="rp-accordion__section" data-section="drucken">
      <button class="rp-accordion__toggle" type="button">
        <span>Drucken</span>
        <svg class="rp-accordion__chevron" viewBox="0 0 12 12" width="12" height="12"><polyline points="4,2 8,6 4,10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="rp-accordion__body">
        <div class="rp-accordion__form-row">
          <label>Titel</label>
          <input class="rp-accordion__input" type="text" placeholder="Kartentitel\u2026" id="rpPrintTitle">
        </div>
        <div class="rp-accordion__form-row">
          <label>Orientierung</label>
          <select class="rp-accordion__select" id="rpPrintOrientation">
            <option value="landscape-a4">A4 Querformat</option>
            <option value="portrait-a4">A4 Hochformat</option>
            <option value="landscape-a3">A3 Querformat</option>
            <option value="portrait-a3">A3 Hochformat</option>
          </select>
        </div>
        <div class="rp-accordion__form-row">
          <label>Massstab</label>
          <select class="rp-accordion__select" id="rpPrintScale">
            <option value="auto">Automatisch</option>
            <option value="500">1:500</option>
            <option value="1000">1:1'000</option>
            <option value="2500">1:2'500</option>
            <option value="5000">1:5'000</option>
            <option value="10000">1:10'000</option>
            <option value="25000">1:25'000</option>
            <option value="50000">1:50'000</option>
            <option value="100000">1:100'000</option>
          </select>
        </div>
        <button class="rp-accordion__action-btn" id="rpPrintBtn" type="button">Drucken</button>
      </div>
    </div>

    <!-- Messen -->
    <div class="rp-accordion__section" data-section="messen">
      <button class="rp-accordion__toggle" type="button">
        <span>Messen</span>
        <svg class="rp-accordion__chevron" viewBox="0 0 12 12" width="12" height="12"><polyline points="4,2 8,6 4,10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="rp-accordion__body">
        <p class="rp-accordion__hint">Klicken Sie auf die Karte, um einen Messpfad zu zeichnen. Klicken Sie auf den ersten Punkt, um die Fl\u00e4che zu schliessen.</p>
        <button class="rp-accordion__action-btn" id="rpMeasureStartBtn" type="button">Messung starten</button>
        <button class="rp-accordion__action-btn rp-accordion__action-btn--secondary" id="rpMeasureClearBtn" type="button" style="display:none">Messung l\u00f6schen</button>
      </div>
    </div>

    <!-- Teilen -->
    <div class="rp-accordion__section" data-section="teilen">
      <button class="rp-accordion__toggle" type="button">
        <span>Teilen</span>
        <svg class="rp-accordion__chevron" viewBox="0 0 12 12" width="12" height="12"><polyline points="4,2 8,6 4,10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="rp-accordion__body">
        <div class="rp-accordion__form-row">
          <label>Link zur aktuellen Ansicht</label>
          <div class="rp-accordion__link-row">
            <input class="rp-accordion__input rp-accordion__share-url" type="text" readonly id="rpShareUrl">
            <button class="rp-accordion__copy-btn" id="rpCopyLink" type="button" title="Kopieren">Kopieren</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Ebenen -->
    <div class="rp-accordion__section" data-section="ebenen">
      <button class="rp-accordion__toggle" type="button">
        <span>Ebenen</span>
        <svg class="rp-accordion__chevron" viewBox="0 0 12 12" width="12" height="12"><polyline points="4,2 8,6 4,10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="rp-accordion__body">
        <div class="rp-accordion__layer-section" data-layer="assets">
          <div class="rp-accordion__layer-header">
            <span class="rp-accordion__layer-title">Inventar</span>
            <button class="rp-accordion__eye active" data-layer="assets" title="Layer ein/ausblenden">
              <svg class="rp-accordion__eye-open" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="3"/></svg>
              <svg class="rp-accordion__eye-closed" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><line x1="3" y1="3" x2="17" y2="17"/></svg>
            </button>
          </div>
          <div class="rp-accordion__layer-items">
            <div class="rp-accordion__layer-item"><span class="rp-accordion__swatch" style="background:#6B7B8D"></span><span>Inventarobjekt</span></div>
          </div>
        </div>
        <div class="rp-accordion__layer-section" data-layer="rooms">
          <div class="rp-accordion__layer-header">
            <span class="rp-accordion__layer-title">R\u00e4ume</span>
            <button class="rp-accordion__eye active" data-layer="rooms" title="Layer ein/ausblenden">
              <svg class="rp-accordion__eye-open" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="3"/></svg>
              <svg class="rp-accordion__eye-closed" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><line x1="3" y1="3" x2="17" y2="17"/></svg>
            </button>
          </div>
          <div class="rp-accordion__layer-items">
            ${Object.entries(ROOM_COLORS)
              .filter(([type]) => type !== 'Korridor')
              .map(([type, color]) => `<div class="rp-accordion__layer-item"><span class="rp-accordion__swatch" style="background:${color}"></span><span>${type}</span></div>`).join('')}
          </div>
        </div>
        <div class="rp-accordion__layer-section" data-layer="floors">
          <div class="rp-accordion__layer-header">
            <span class="rp-accordion__layer-title">Geschosse</span>
            <button class="rp-accordion__eye active" data-layer="floors" title="Layer ein/ausblenden">
              <svg class="rp-accordion__eye-open" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="3"/></svg>
              <svg class="rp-accordion__eye-closed" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><line x1="3" y1="3" x2="17" y2="17"/></svg>
            </button>
          </div>
          <div class="rp-accordion__layer-items">
            <div class="rp-accordion__layer-item"><span class="rp-accordion__swatch" style="background:#e8e4df"></span><span>Geschoss</span></div>
          </div>
        </div>
        <div class="rp-accordion__layer-section" data-layer="buildings">
          <div class="rp-accordion__layer-header">
            <span class="rp-accordion__layer-title">Geb\u00e4ude</span>
            <button class="rp-accordion__eye active" data-layer="buildings" title="Layer ein/ausblenden">
              <svg class="rp-accordion__eye-open" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="3"/></svg>
              <svg class="rp-accordion__eye-closed" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><line x1="3" y1="3" x2="17" y2="17"/></svg>
            </button>
          </div>
          <div class="rp-accordion__layer-items">
            <div class="rp-accordion__layer-item"><span class="rp-accordion__swatch" style="background:#d73027"></span><span>Geb\u00e4ude</span></div>
          </div>
        </div>
      </div>
    </div>
  `;
  accordionWrap.appendChild(accordion);

  // Accordion toggle button (collapse/expand the panel)
  const accordionToggle = document.createElement('button');
  accordionToggle.className = 'rp-accordion__panel-toggle';
  accordionToggle.type = 'button';
  accordionToggle.title = 'Menu ausblenden';
  accordionToggle.innerHTML = '<svg viewBox="0 0 12 12" width="12" height="12"><polyline points="2,4 6,8 10,4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Menu ausblenden</span>';
  accordionWrap.appendChild(accordionToggle);
  container.appendChild(accordionWrap);

  // ---- Print preview overlay ----
  _printOverlay = document.createElement('div');
  _printOverlay.className = 'rp-print-overlay';
  _printOverlay.innerHTML = `
    <svg><defs><mask id="rp-print-mask">
      <rect width="100%" height="100%" fill="white"/>
      <rect id="rp-print-crop-mask" fill="black"/>
    </mask></defs>
    <rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask="url(#rp-print-mask)"/>
    </svg>
    <div class="rp-print-crop">
      <div class="rp-print-crop-label"></div>
    </div>`;
  container.appendChild(_printOverlay);

  // ---- Measure distance display panel ----
  _measureDisplay = document.createElement('div');
  _measureDisplay.className = 'rp-measure-display';
  _measureDisplay.innerHTML = `
    <div class="rp-measure-display__header">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="18" x2="18" y2="2"/><line x1="2" y1="18" x2="2" y2="14"/><line x1="2" y1="18" x2="6" y2="18"/><line x1="18" y1="2" x2="18" y2="6"/><line x1="18" y1="2" x2="14" y2="2"/></svg>
      <span>Distanz messen</span>
      <button class="rp-measure-display__close" id="rpMeasureDisplayClose" type="button" title="Schliessen">&times;</button>
    </div>
    <div class="rp-measure-display__info">Klicken Sie auf die Karte, um einen Pfad zu zeichnen.</div>
    <div class="rp-measure-display__result">
      <div class="rp-measure-display__row">
        <span class="rp-measure-display__label">Gesamtdistanz:</span>
        <span class="rp-measure-display__value" id="rpMeasureTotalDistance">0 m</span>
      </div>
      <div class="rp-measure-display__row" id="rpMeasureAreaRow" style="display:none">
        <span class="rp-measure-display__label">Fl\u00e4che:</span>
        <span class="rp-measure-display__value" id="rpMeasureTotalArea">0 m\u00b2</span>
      </div>
    </div>`;
  container.appendChild(_measureDisplay);

  _measureDisplay.querySelector('#rpMeasureDisplayClose').addEventListener('click', () => {
    clearMeasurement();
    const clearBtn = accordion.querySelector('#rpMeasureClearBtn');
    const startBtn = accordion.querySelector('#rpMeasureStartBtn');
    if (clearBtn) clearBtn.style.display = 'none';
    if (startBtn) startBtn.textContent = 'Messung starten';
  });

  // ---- Right-click context menu ----
  const ctxMenu = document.createElement('div');
  ctxMenu.className = 'rp-context-menu';
  ctxMenu.innerHTML = `
    <div class="rp-context-menu__item rp-context-menu__coords" id="rpCtxCoords" title="Klicken zum Kopieren">
      <span id="rpCtxCoordsText">47.00000, 7.00000</span>
    </div>
    <div class="rp-context-menu__item" id="rpCtxMeasure">
      <span id="rpCtxMeasureText">Distanz messen</span>
    </div>
    <div class="rp-context-menu__item" id="rpCtxPrint">
      <span>Drucken</span>
    </div>
    <div class="rp-context-menu__item" id="rpCtxShare">
      <span>Teilen</span>
    </div>`;
  container.appendChild(ctxMenu);

  let _ctxLngLat = null;

  function hideContextMenu() {
    ctxMenu.classList.remove('show');
  }

  _occMap.on('contextmenu', (e) => {
    e.preventDefault();
    _ctxLngLat = e.lngLat;
    ctxMenu.querySelector('#rpCtxCoordsText').textContent =
      e.lngLat.lat.toFixed(5) + ', ' + e.lngLat.lng.toFixed(5);
    ctxMenu.querySelector('#rpCtxCoords').classList.remove('copied');

    const measureText = ctxMenu.querySelector('#rpCtxMeasureText');
    measureText.textContent = _measureState.active ? 'Messung l\u00f6schen' : 'Distanz messen';

    const mapRect = container.getBoundingClientRect();
    const menuW = 200, menuH = 160;
    const flipH = (e.point.x + menuW) > mapRect.width;
    const flipV = (e.point.y + menuH) > mapRect.height;

    ctxMenu.style.left = e.point.x + 'px';
    ctxMenu.style.top = e.point.y + 'px';
    ctxMenu.classList.toggle('flip-horizontal', flipH);
    ctxMenu.classList.toggle('flip-vertical', flipV);
    ctxMenu.classList.add('show');
  });

  // Hide context menu on any map click or Escape
  _occMap.on('click', () => hideContextMenu());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideContextMenu();
      if (_measureState.active) {
        clearMeasurement();
        const clearBtn = accordion.querySelector('#rpMeasureClearBtn');
        const startBtn = accordion.querySelector('#rpMeasureStartBtn');
        if (clearBtn) clearBtn.style.display = 'none';
        if (startBtn) startBtn.textContent = 'Messung starten';
      }
    }
  });

  // Context menu: copy coordinates
  ctxMenu.querySelector('#rpCtxCoords').addEventListener('click', () => {
    const text = ctxMenu.querySelector('#rpCtxCoordsText').textContent;
    navigator.clipboard.writeText(text).then(() => {
      ctxMenu.querySelector('#rpCtxCoords').classList.add('copied');
      setTimeout(hideContextMenu, 300);
    });
  });

  // Context menu: measure
  ctxMenu.querySelector('#rpCtxMeasure').addEventListener('click', () => {
    hideContextMenu();
    const startBtn = accordion.querySelector('#rpMeasureStartBtn');
    const clearBtn = accordion.querySelector('#rpMeasureClearBtn');
    if (_measureState.active) {
      clearMeasurement();
      if (startBtn) startBtn.textContent = 'Messung starten';
      if (clearBtn) clearBtn.style.display = 'none';
    } else {
      startMeasurement();
      if (startBtn) startBtn.textContent = 'Messung beenden';
      if (clearBtn) clearBtn.style.display = '';
      // Open the Messen accordion section
      accordion.querySelectorAll('.rp-accordion__section').forEach(s => s.classList.remove('rp-accordion__section--open'));
      const messenSection = accordion.querySelector('[data-section="messen"]');
      if (messenSection) messenSection.classList.add('rp-accordion__section--open');
      hidePrintPreview();
    }
  });

  // Context menu: print (open Drucken accordion)
  ctxMenu.querySelector('#rpCtxPrint').addEventListener('click', () => {
    hideContextMenu();
    accordion.querySelectorAll('.rp-accordion__section').forEach(s => s.classList.remove('rp-accordion__section--open'));
    const druckenSection = accordion.querySelector('[data-section="drucken"]');
    if (druckenSection) druckenSection.classList.add('rp-accordion__section--open');
    showPrintPreview();
    if (_measureState.active) {
      clearMeasurement();
      const startBtn = accordion.querySelector('#rpMeasureStartBtn');
      const clearBtn = accordion.querySelector('#rpMeasureClearBtn');
      if (startBtn) startBtn.textContent = 'Messung starten';
      if (clearBtn) clearBtn.style.display = 'none';
    }
  });

  // Context menu: share (open Teilen accordion)
  ctxMenu.querySelector('#rpCtxShare').addEventListener('click', () => {
    hideContextMenu();
    accordion.querySelectorAll('.rp-accordion__section').forEach(s => s.classList.remove('rp-accordion__section--open'));
    const teilenSection = accordion.querySelector('[data-section="teilen"]');
    if (teilenSection) teilenSection.classList.add('rp-accordion__section--open');
    hidePrintPreview();
  });

  accordionToggle.addEventListener('click', () => {
    const isCollapsing = !accordion.classList.contains('rp-accordion--collapsed');
    accordion.classList.toggle('rp-accordion--collapsed');
    accordionToggle.classList.toggle('rp-accordion__panel-toggle--collapsed');
    const label = isCollapsing ? 'Menu einblenden' : 'Menu ausblenden';
    accordionToggle.querySelector('span').textContent = label;
    accordionToggle.title = label;
    // Hide print preview when collapsing accordion
    if (isCollapsing) hidePrintPreview();
  });

  // Single-open accordion behavior + print preview toggle
  accordion.querySelectorAll('.rp-accordion__toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.rp-accordion__section');
      const wasOpen = section.classList.contains('rp-accordion__section--open');
      // Close all sections
      accordion.querySelectorAll('.rp-accordion__section').forEach(s => s.classList.remove('rp-accordion__section--open'));
      // Open clicked section (unless it was already open)
      if (!wasOpen) section.classList.add('rp-accordion__section--open');

      // Show/hide print preview based on whether Drucken section is now open
      const druckenOpen = !wasOpen && section.dataset.section === 'drucken';
      if (druckenOpen) showPrintPreview();
      else hidePrintPreview();

      // Clear measurement when leaving Messen section
      const messenOpen = !wasOpen && section.dataset.section === 'messen';
      if (!messenOpen && _measureState.active) {
        clearMeasurement();
        const clearBtn = accordion.querySelector('#rpMeasureClearBtn');
        const startBtn = accordion.querySelector('#rpMeasureStartBtn');
        if (clearBtn) clearBtn.style.display = 'none';
        if (startBtn) startBtn.textContent = 'Messung starten';
      }
    });
  });

  // ---- Suche (address search) ----
  const searchInput = accordion.querySelector('.rp-accordion__search-input');
  const searchResults = accordion.querySelector('.rp-accordion__search-results');
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
          searchResults.innerHTML = '<div class="rp-accordion__search-empty">Keine Ergebnisse</div>';
          return;
        }
        searchResults.innerHTML = data.results.map((r, i) =>
          `<button class="rp-accordion__search-item" data-idx="${i}" type="button">${r.attrs.label.replace(/<[^>]+>/g, '')}</button>`
        ).join('');
        searchResults.querySelectorAll('.rp-accordion__search-item').forEach((btn, i) => {
          btn.addEventListener('click', () => {
            const r = data.results[i];
            const lngLat = [r.attrs.lon, r.attrs.lat];
            if (_searchMarker) _searchMarker.remove();
            _searchMarker = new maplibregl.Marker({ color: '#0066cc' }).setLngLat(lngLat).addTo(_occMap);
            _occMap.flyTo({ center: lngLat, zoom: 17, speed: 1.4 });
            searchInput.value = '';
            searchResults.innerHTML = '';
          });
        });
      } catch (e) {
        searchResults.innerHTML = '<div class="rp-accordion__search-empty">Fehler bei der Suche</div>';
      }
    }, 300);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { searchInput.value = ''; searchResults.innerHTML = ''; }
  });

  // ---- Drucken ----
  // Update preview when orientation changes
  const printOrientSelect = accordion.querySelector('#rpPrintOrientation');
  if (printOrientSelect) {
    printOrientSelect.addEventListener('change', updatePrintPreview);
  }
  // Update preview on window resize
  window.addEventListener('resize', () => {
    if (_printOverlay && _printOverlay.classList.contains('active')) updatePrintPreview();
  });

  accordion.querySelector('#rpPrintBtn').addEventListener('click', () => {
    const title = accordion.querySelector('#rpPrintTitle').value || 'Karte';
    const orientation = accordion.querySelector('#rpPrintOrientation').value;
    const printDims = getPrintDimensions(orientation);
    const btn = accordion.querySelector('#rpPrintBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Wird erstellt\u2026';
    btn.disabled = true;

    // Create off-screen print container
    const printContainer = document.createElement('div');
    printContainer.id = 'rp-print-container';
    printContainer.style.cssText = `position:fixed;top:0;left:0;width:${printDims.w}mm;height:${printDims.h}mm;background:white;z-index:10000;padding:10mm;box-sizing:border-box;`;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:5mm;padding-bottom:3mm;border-bottom:1px solid #ccc;';
    header.innerHTML = `<div style="font-size:14pt;font-weight:bold;">${title}</div><div style="font-size:10pt;color:#666;">${new Date().toLocaleDateString('de-CH')}</div>`;
    printContainer.appendChild(header);

    // Map canvas clone
    const mapContainer = document.createElement('div');
    mapContainer.style.cssText = `width:100%;height:calc(100% - 20mm);border:1px solid #ccc;position:relative;overflow:hidden;`;
    if (_occMap) {
      const mapCanvas = _occMap.getCanvas();
      const cloned = document.createElement('canvas');
      cloned.width = mapCanvas.width;
      cloned.height = mapCanvas.height;
      cloned.getContext('2d').drawImage(mapCanvas, 0, 0);
      cloned.style.cssText = 'width:100%;height:100%;object-fit:contain;';
      mapContainer.appendChild(cloned);

      // Scale bar text
      const scaleBar = document.createElement('div');
      scaleBar.style.cssText = 'position:absolute;bottom:5mm;left:5mm;background:rgba(255,255,255,0.9);padding:2mm 3mm;border-radius:2px;font-size:8pt;';
      const scaleVal = accordion.querySelector('#rpPrintScale').value;
      const currentScale = scaleVal === 'auto' ? Math.round(getMapScale()) : parseInt(scaleVal);
      scaleBar.textContent = 'Massstab 1:' + currentScale.toLocaleString('de-CH');
      mapContainer.appendChild(scaleBar);

      // North arrow
      const northArrow = document.createElement('div');
      northArrow.style.cssText = 'position:absolute;top:5mm;right:5mm;background:rgba(255,255,255,0.9);padding:2mm;border-radius:2px;text-align:center;';
      northArrow.innerHTML = '<div style="font-size:16pt;">\u2191</div><div style="font-size:8pt;">N</div>';
      mapContainer.appendChild(northArrow);
    }
    printContainer.appendChild(mapContainer);

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top:3mm;padding-top:3mm;border-top:1px solid #ccc;font-size:8pt;color:#666;display:flex;justify-content:space-between;';
    footer.innerHTML = `<span>Quelle: Belegungsplanung</span><span>\u00a9 ${new Date().getFullYear()} BBL</span>`;
    printContainer.appendChild(footer);

    document.body.appendChild(printContainer);

    // Inject print-specific styles
    const printStyles = document.createElement('style');
    printStyles.id = 'rp-print-styles';
    const pageSize = orientation.includes('landscape') ? 'landscape' : 'portrait';
    printStyles.textContent = `@media print { body > *:not(#rp-print-container) { display: none !important; } #rp-print-container { position: static !important; } @page { size: ${pageSize}; margin: 0; } }`;
    document.head.appendChild(printStyles);

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.removeChild(printContainer);
        document.head.removeChild(printStyles);
        btn.textContent = originalText;
        btn.disabled = false;
      }, 500);
    }, 100);
  });

  // ---- Teilen ----
  function updateShareUrl() {
    const urlInput = accordion.querySelector('#rpShareUrl');
    if (urlInput) urlInput.value = window.location.href;
  }
  accordion.querySelector('#rpCopyLink').addEventListener('click', () => {
    updateShareUrl();
    const urlInput = accordion.querySelector('#rpShareUrl');
    navigator.clipboard.writeText(urlInput.value).then(() => {
      const btn = accordion.querySelector('#rpCopyLink');
      btn.textContent = 'Kopiert!';
      setTimeout(() => { btn.textContent = 'Kopieren'; }, 2000);
    });
  });
  // Update share URL when section opens
  accordion.querySelector('[data-section="teilen"] .rp-accordion__toggle').addEventListener('click', () => {
    setTimeout(updateShareUrl, 50);
  });

  // ---- Messen (measure) buttons ----
  const measureStartBtn = accordion.querySelector('#rpMeasureStartBtn');
  const measureClearBtn = accordion.querySelector('#rpMeasureClearBtn');

  measureStartBtn.addEventListener('click', () => {
    if (_measureState.active) {
      clearMeasurement();
      measureStartBtn.textContent = 'Messung starten';
      measureClearBtn.style.display = 'none';
    } else {
      startMeasurement();
      measureStartBtn.textContent = 'Messung beenden';
      measureClearBtn.style.display = '';
    }
  });

  measureClearBtn.addEventListener('click', () => {
    clearMeasurement();
    measureStartBtn.textContent = 'Messung starten';
    measureClearBtn.style.display = 'none';
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

  // Layer visibility map: layer name → MapLibre layer IDs
  const LAYER_MAP = {
    'buildings': ['building-points', 'building-labels', 'building-footprints-fill', 'building-footprints-outline'],
    'floors': ['floor-fills', 'floor-outlines', 'floor-labels'],
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
    const section = accordion.querySelector(`.rp-accordion__layer-section[data-layer="${layerName}"]`);
    if (section) section.classList.toggle('rp-accordion__layer-section--hidden', !visible);
  }

  // Eye toggle buttons (Ebenen section)
  accordion.querySelectorAll('.rp-accordion__eye').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const layer = btn.dataset.layer;
      const isActive = btn.classList.toggle('active');
      setLayerVisibility(layer, isActive);
    });
  });

  // ---- Edit mode: toggle button, banner, toolbar ----
  _editMode = false;
  _activeEditTool = null;

  // Edit toggle button (top-center, shown in normal mode)
  const editToggle = document.createElement('button');
  editToggle.className = 'rp-edit-toggle';
  editToggle.type = 'button';
  editToggle.innerHTML = '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 3.5l5 5L7 18H2v-5L11.5 3.5z"/><path d="M10 5l5 5"/></svg><span>Inhalt Bearbeiten</span>';
  container.appendChild(editToggle);

  // Edit banner (top-center, shown in edit mode)
  const editBanner = document.createElement('div');
  editBanner.className = 'rp-edit-banner';
  editBanner.innerHTML = `
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 3.5l5 5L7 18H2v-5L11.5 3.5z"/><path d="M10 5l5 5"/></svg>
    <span class="rp-edit-banner__label">Grundriss bearbeiten</span>
    <div class="rp-edit-banner__actions">
      <button class="rp-edit-banner__btn rp-edit-banner__btn--cancel" type="button">Abbrechen</button>
      <button class="rp-edit-banner__btn rp-edit-banner__btn--save" type="button">Speichern</button>
    </div>`;
  container.appendChild(editBanner);

  // Edit toolbar (bottom-center, shown in edit mode)
  const editToolbar = document.createElement('div');
  editToolbar.className = 'rp-edit-toolbar';
  editToolbar.innerHTML = `
    <div class="rp-edit-toolbar__tools">
      <div class="rp-edit-toolbar__group">
        <button class="rp-edit-tool" data-tool="move" type="button" title="Verschieben">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v16M2 10h16M10 2l-3 3M10 2l3 3M10 18l-3-3M10 18l3-3M2 10l3-3M2 10l3 3M18 10l-3-3M18 10l-3 3"/></svg>
          <span class="rp-edit-tool__label">Verschieben</span>
        </button>
        <button class="rp-edit-tool" data-tool="rotate" type="button" title="Drehen">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 10a7 7 0 11-2-5"/><path d="M17 2v5h-5"/></svg>
          <span class="rp-edit-tool__label">Drehen</span>
        </button>
      </div>
      <div class="rp-edit-toolbar__divider"></div>
      <div class="rp-edit-toolbar__group">
        <button class="rp-edit-tool" data-tool="furniture" type="button" title="M\u00f6bel platzieren">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="12" height="6" rx="1"/><path d="M6 8V6a4 4 0 018 0v2"/><path d="M4 14v2M16 14v2"/></svg>
          <span class="rp-edit-tool__label">M\u00f6bel</span>
        </button>
        <button class="rp-edit-tool" data-tool="import" type="button" title="Grundriss importieren">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H5a1 1 0 00-1 1v14a1 1 0 001 1h10a1 1 0 001-1V6l-4-4z"/><path d="M12 2v4h4"/><path d="M10 10v4M8 12h4"/></svg>
          <span class="rp-edit-tool__label">Importieren</span>
        </button>
        <button class="rp-edit-tool" data-tool="delete" type="button" title="L\u00f6schen">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h14M7 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/><path d="M5 6v10a2 2 0 002 2h6a2 2 0 002-2V6"/><line x1="9" y1="9" x2="9" y2="15"/><line x1="11" y1="9" x2="11" y2="15"/></svg>
          <span class="rp-edit-tool__label">L\u00f6schen</span>
        </button>
      </div>
    </div>`;
  container.appendChild(editToolbar);

  // Edit mode: open
  function openEditMode() {
    _editMode = true;
    _activeEditTool = null;
    editToggle.classList.add('rp-edit-toggle--hidden');
    editBanner.classList.add('rp-edit-banner--visible');
    editToolbar.classList.add('rp-edit-toolbar--visible');
    editToolbar.querySelectorAll('.rp-edit-tool').forEach(t => t.classList.remove('rp-edit-tool--active'));
    container.classList.add('rp-mapbox--editing');
    editClearSelection();
  }

  // Edit mode: close
  function closeEditMode() {
    _editMode = false;
    _activeEditTool = null;
    editToggle.classList.remove('rp-edit-toggle--hidden');
    editBanner.classList.remove('rp-edit-banner--visible');
    editToolbar.classList.remove('rp-edit-toolbar--visible');
    editToolbar.querySelectorAll('.rp-edit-tool').forEach(t => t.classList.remove('rp-edit-tool--active'));
    container.classList.remove('rp-mapbox--editing');
    editClearSelection();
  }

  editToggle.addEventListener('click', openEditMode);
  editBanner.querySelector('.rp-edit-banner__btn--cancel').addEventListener('click', closeEditMode);
  editBanner.querySelector('.rp-edit-banner__btn--save').addEventListener('click', () => {
    // TODO: persist edits
    closeEditMode();
  });

  // Tool selection (toggle active)
  editToolbar.querySelectorAll('.rp-edit-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (_activeEditTool === tool) {
        btn.classList.remove('rp-edit-tool--active');
        _activeEditTool = null;
      } else {
        editToolbar.querySelectorAll('.rp-edit-tool').forEach(t => t.classList.remove('rp-edit-tool--active'));
        btn.classList.add('rp-edit-tool--active');
        _activeEditTool = tool;
      }
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

    // Layer order: building footprints → floors → rooms → assets → building markers/labels
    addFloorLayers();
    addRoomLayers();
    addAssetLayers();

    _occMap.addLayer({ id: 'building-points', type: 'circle', source: 'buildings', paint: { 'circle-radius': 8, 'circle-color': '#d73027', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });
    _occMap.addLayer({ id: 'building-labels', type: 'symbol', source: 'buildings', minzoom: 14, layout: { 'text-field': ['get', 'objectCode'], 'text-size': 12, 'text-anchor': 'bottom', 'text-offset': [0, -1.2], 'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'], 'text-allow-overlap': true }, paint: { 'text-color': '#1a1a1a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });

    // Terrain DEM source for 3D elevation
    if (!_occMap.getSource('terrain-dem')) {
      _occMap.addSource('terrain-dem', {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15
      });
    }
    if (_is3D) _occMap.setTerrain({ source: 'terrain-dem', exaggeration: 1.0 });

    // Edit selection highlight
    if (!_occMap.getSource('edit-selection')) {
      _occMap.addSource('edit-selection', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      _occMap.addLayer({ id: 'edit-selection-outline', type: 'line', source: 'edit-selection', paint: { 'line-color': '#00bfff', 'line-width': 3, 'line-dasharray': [2, 1] } });
    }

    // Ensure correct z-order: fills/outlines → labels → markers → selection
    ensureLayerOrder();
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

      // Layer order: building footprints → floors → rooms → assets → building markers/labels
      _occMap.addLayer({
        id: 'building-footprints-fill',
        type: 'fill',
        source: 'building-footprints',
        minzoom: 15,
        paint: { 'fill-color': '#d73027', 'fill-opacity': 0.15 }
      });
      _occMap.addLayer({
        id: 'building-footprints-outline',
        type: 'line',
        source: 'building-footprints',
        minzoom: 15,
        paint: { 'line-color': '#d73027', 'line-width': 2, 'line-opacity': 0.6 }
      });

      // Floor layers
      addFloorLayers();

      // Room layers
      addRoomLayers();

      // Asset layers
      addAssetLayers();

      // Building markers/labels on top of all fills
      _occMap.addLayer({
        id: 'building-points',
        type: 'circle',
        source: 'buildings',
        paint: { 'circle-radius': 8, 'circle-color': '#d73027', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' }
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
        paint: { 'text-color': '#1a1a1a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }
      });

      // Terrain DEM source for 3D elevation
      if (!_occMap.getSource('terrain-dem')) {
        _occMap.addSource('terrain-dem', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 15
        });
      }
      if (_is3D) _occMap.setTerrain({ source: 'terrain-dem', exaggeration: 1.0 });

      // Edit selection highlight
      if (!_occMap.getSource('edit-selection')) {
        _occMap.addSource('edit-selection', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        _occMap.addLayer({ id: 'edit-selection-outline', type: 'line', source: 'edit-selection', paint: { 'line-color': '#00bfff', 'line-width': 3, 'line-dasharray': [2, 1] } });
      }

      // Ensure correct z-order: fills/outlines → labels → markers → selection
      ensureLayerOrder();

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
    const clickPopup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, offset: 12, maxWidth: '280px' });
    const handleMarkerClick = (e) => {
      if (_editMode || _measureState.active) return;
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
      if (_editMode || _measureState.active) return;
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
      if (_editMode || _measureState.active) return;
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

    // --- Edit mode: selection, move, rotate, delete ---
    let _editDragStartLngLat = null;
    let _editDragStartAngle = null;

    _occMap.on('click', (e) => {
      // Measurement mode: add points
      if (_measureState.active) {
        if (_measureState.isClosed) return;
        if (isNearFirstPoint(e.lngLat)) {
          _measureState.isClosed = true;
          updateMeasureLine();
          updateMeasureLabels();
          updateMeasureDisplay();
          return;
        }
        addMeasurePoint(e.lngLat);
        return;
      }

      if (!_editMode) {
        // Close popup when clicking empty space (since closeOnClick is false)
        const interactiveLayers = ['building-points', 'building-labels', 'building-footprints-fill', 'room-fills', 'asset-fills'];
        const hits = _occMap.queryRenderedFeatures(e.point, { layers: interactiveLayers.filter(l => _occMap.getLayer(l)) });
        if (hits.length === 0) clickPopup.remove();
        return;
      }

      // Delete tool: remove feature on click
      if (_activeEditTool === 'delete') {
        const info = editFindFeature(e.point);
        if (info) {
          info.geo.features.splice(info.featureIndex, 1);
          editRefreshSource(info.source);
          editClearSelection();
        }
        return;
      }

      // Select feature
      const info = editFindFeature(e.point);
      if (info) {
        _editSelectedInfo = info;
        editSetHighlight(info.feature);
      } else {
        editClearSelection();
      }
    });

    // Move / rotate drag handling
    _occMap.on('mousedown', (e) => {
      if (!_editMode || !_editSelectedInfo) return;
      if (_activeEditTool !== 'move' && _activeEditTool !== 'rotate') return;

      const info = editFindFeature(e.point);
      if (!info || info.source !== _editSelectedInfo.source || info.featureIndex !== _editSelectedInfo.featureIndex) return;

      e.preventDefault();
      _editDragging = true;
      _editDragStartLngLat = e.lngLat;
      _occMap.getCanvas().style.cursor = _activeEditTool === 'move' ? 'grabbing' : 'alias';
      _occMap.dragPan.disable();

      if (_activeEditTool === 'rotate') {
        const centroid = editGetCentroid(_editSelectedInfo.feature.geometry.coordinates);
        _editDragStartAngle = Math.atan2(e.lngLat.lat - centroid[1], e.lngLat.lng - centroid[0]);
      }
    });

    _occMap.on('mousemove', (e) => {
      if (!_editDragging || !_editSelectedInfo) return;

      const feature = _editSelectedInfo.feature;
      if (_activeEditTool === 'move') {
        const dLng = e.lngLat.lng - _editDragStartLngLat.lng;
        const dLat = e.lngLat.lat - _editDragStartLngLat.lat;
        feature.geometry = editTranslateCoords(feature.geometry, dLng, dLat);
        _editDragStartLngLat = e.lngLat;
        editRefreshSource(_editSelectedInfo.source);
        editSetHighlight(feature);
      } else if (_activeEditTool === 'rotate') {
        const centroid = editGetCentroid(feature.geometry.coordinates);
        const currentAngle = Math.atan2(e.lngLat.lat - centroid[1], e.lngLat.lng - centroid[0]);
        const deltaAngle = (currentAngle - _editDragStartAngle) * 180 / Math.PI;
        feature.geometry = editRotateCoords(feature.geometry, centroid[0], centroid[1], deltaAngle);
        _editDragStartAngle = currentAngle;
        editRefreshSource(_editSelectedInfo.source);
        editSetHighlight(feature);
      }
    });

    _occMap.on('mouseup', () => {
      if (!_editDragging) return;
      _editDragging = false;
      _editDragStartLngLat = null;
      _editDragStartAngle = null;
      _occMap.dragPan.enable();
      _occMap.getCanvas().style.cursor = '';
    });
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

  // Update floors source
  const floorSource = _occMap.getSource('floors');
  if (floorSource) floorSource.setData(getFilteredFloors());

  // Update rooms source
  const roomSource = _occMap.getSource('rooms');
  if (roomSource) roomSource.setData(getFilteredRooms());

  // Update assets source
  const assetSource = _occMap.getSource('assets');
  if (assetSource) assetSource.setData(getFilteredAssets());

  // Determine zoom behavior based on selection type
  const found = selId ? occFindNode(selId) : null;
  const nodeType = found ? found.node.type : null;

  // Hide building layers when a floor is selected (rooms are the focus)
  const bldgVisibility = nodeType === 'floor' ? 'none' : 'visible';
  ['building-points', 'building-labels', 'building-footprints-fill', 'building-footprints-outline'].forEach(id => {
    if (_occMap.getLayer(id)) _occMap.setLayoutProperty(id, 'visibility', bldgVisibility);
  });

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
        // Preserve current tab if valid for the new node type
        const tabs = occGetTabs(found.node.type);
        if (!tabs.find(t => t.id === state.occTab)) state.occTab = tabs[0].id;
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
        // Preserve current tab if valid for the new node type
        const tabs = occGetTabs(found.node.type);
        if (!tabs.find(t => t.id === state.occTab)) state.occTab = tabs[0].id;
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
