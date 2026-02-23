/* ==========================================================================
   app.js – Floor Plan Editor Application

   Data loading, state management, UI rendering.
   Loads GeoJSON data from the parent project's data/ folder and wires
   up the renderer + editor with the DOM panels.
   ========================================================================== */

/* ── Global State ──────────────────────────────────────────────────────── */

const state = {
    buildings: [],       // Array of building property objects
    floors: [],          // Array of floor property objects
    buildingsGeo: null,  // Full GeoJSON FeatureCollection
    floorsGeo: null,
    roomsGeo: null,
    assetsGeo: null,
    products: [],        // Product catalog loaded from products.json

    selectedBuildingId: 'b-001',
    selectedFloorId: 'b-001-eg',

    editMode: false,
    libraryCategory: 'all',  // Active category filter in library
    viewMode: '2d',          // '2d' | '3d' | 'walk'
};

let renderer = null;
let editor = null;
let renderer3d = null;

/* ── Utility ───────────────────────────────────────────────────────────── */

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/* ── Data Loading ──────────────────────────────────────────────────────── */

async function loadData() {
    const base = '../data/';
    const [buildingsGeo, floorsGeo, roomsGeo, assetsGeo, products] = await Promise.all([
        fetch(base + 'buildings.geojson').then(r => r.json()),
        fetch(base + 'floors.geojson').then(r => r.json()),
        fetch(base + 'rooms.geojson').then(r => r.json()),
        fetch(base + 'assets.geojson').then(r => r.json()),
        fetch(base + 'products.json').then(r => r.json()),
    ]);

    state.buildingsGeo = buildingsGeo;
    state.floorsGeo = floorsGeo;
    state.roomsGeo = roomsGeo;
    state.assetsGeo = assetsGeo;
    state.products = products;

    state.buildings = buildingsGeo.features.map(f => f.properties);
    state.floors = floorsGeo.features.map(f => f.properties);
}

/* ── URL Hash Parsing ──────────────────────────────────────────────────── */

function parseHash() {
    const raw = location.hash.replace('#/', '');
    if (!raw) return;
    const parts = raw.split('/');
    if (parts[0]) state.selectedBuildingId = parts[0];
    if (parts[1]) state.selectedFloorId = parts[1];
}

function validateSelection() {
    // Validate building ID exists in loaded data
    const buildingExists = state.buildings.some(b => b.buildingId === state.selectedBuildingId);
    if (!buildingExists && state.buildings.length > 0) {
        state.selectedBuildingId = state.buildings[0].buildingId;
    }

    // Validate floor ID belongs to selected building
    const buildingFloors = state.floors
        .filter(f => f.buildingId === state.selectedBuildingId)
        .sort((a, b) => a.verticalOrder - b.verticalOrder);

    const floorExists = buildingFloors.some(f => f.floorId === state.selectedFloorId);
    if (!floorExists && buildingFloors.length > 0) {
        state.selectedFloorId = buildingFloors[0].floorId;
    }
}

function pushHash() {
    const hash = `#/${state.selectedBuildingId}/${state.selectedFloorId}`;
    history.replaceState(null, '', hash);
}

function updateBackLink() {
    const backLink = document.getElementById('backLink');
    if (!backLink) return;
    backLink.href = `../index.html#/occupancy/${state.selectedFloorId}`;
}

/* ── Initialization ────────────────────────────────────────────────────── */

async function init() {
    try {
        await loadData();
    } catch (err) {
        console.error('Failed to load floor plan data:', err);
        document.getElementById('resourceList').innerHTML =
            '<div class="fp-empty">Fehler beim Laden der Daten. Stellen Sie sicher, dass die Seite über einen lokalen Server bereitgestellt wird.</div>';
        return;
    }

    // Parse URL hash for building/floor context
    parseHash();
    validateSelection();

    // Init renderer
    const canvas = document.getElementById('floorplan');
    renderer = new FloorPlanRenderer(canvas);
    renderer.init();

    // Init editor
    editor = new FloorPlanEditor(renderer);

    // Populate selectors
    populateBuildingSelector();
    populateFloorSelector();

    // Load initial floor
    loadFloor(state.selectedFloorId);

    // Bind all UI events
    bindUIEvents();

    // Listen for selection changes from editor
    window.addEventListener('fp-selection-change', onSelectionChange);

    // Listen for asset moves (live property update)
    window.addEventListener('fp-asset-moved', onAssetMoved);

    // Listen for browser back/forward
    window.addEventListener('hashchange', () => {
        parseHash();
        validateSelection();
        populateBuildingSelector();
        populateFloorSelector();
        loadFloor(state.selectedFloorId);
    });

    // Deferred 3D renderer init (renderer3d.js is an ES module, loads async)
    (function init3DWhenReady() {
        if (window.FloorPlan3DRenderer) {
            renderer3d = new FloorPlan3DRenderer(document.getElementById('canvasWrap'));
            renderer3d.init();
            renderer3d.setColorSchemes(renderer.colorSchemes);
            // Sync initial data
            if (renderer.rooms.length || renderer.floorOutline) {
                renderer3d.setData(renderer.rooms, renderer.assets, renderer.floorOutline);
            }
        } else {
            setTimeout(init3DWhenReady, 50);
        }
    })();
}

/* ── View Mode Switching ──────────────────────────────────────────────── */

function switchViewMode(mode) {
    const prevMode = state.viewMode;
    if (prevMode === mode) return;
    state.viewMode = mode;

    const canvas2d = document.getElementById('floorplan');
    const canvas3d = renderer3d ? renderer3d.rendererGL.domElement : null;
    const toolbar = document.getElementById('toolbar');
    const scaleBar = document.getElementById('scaleBar');
    const walkCrosshair = document.getElementById('walkCrosshair');
    const walkInstructions = document.getElementById('walkInstructions');

    // Update toggle buttons
    document.querySelectorAll('.fp-view-toggle__btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === mode);
    });

    if (mode === '2d') {
        canvas2d.style.display = 'block';
        if (canvas3d) canvas3d.style.display = 'none';
        if (renderer3d) renderer3d.stopAnimationLoop();
        renderer.draw();
        toolbar.style.display = '';
        scaleBar.style.display = '';
        walkCrosshair.style.display = 'none';
        walkInstructions.style.display = 'none';
        renderToolbar();
        // Restore left panel visibility in 2D
        document.getElementById('leftPanel').style.display = '';
    } else {
        // 3D or Walk
        if (!renderer3d) return; // not yet loaded

        canvas2d.style.display = 'none';
        canvas3d.style.display = 'block';

        // Sync color scheme
        renderer3d.setColorScheme(renderer.activeSchemeId);

        // Set camera mode
        renderer3d.setMode(mode === 'walk' ? 'walk' : 'orbit');
        renderer3d.startAnimationLoop();

        scaleBar.style.display = 'none';

        if (mode === '3d') {
            toolbar.style.display = '';
            renderToolbar();
            walkCrosshair.style.display = 'none';
            walkInstructions.style.display = 'none';
            // In edit mode, hide left panel by default in 3D
            if (state.editMode) {
                document.getElementById('leftPanel').style.display = 'none';
            }
            renderer3d.setTool('select');
        } else {
            // Walk mode
            toolbar.style.display = 'none';
            walkCrosshair.style.display = 'block';
            walkInstructions.style.display = 'block';
        }
    }
}

/* ── Building / Floor Selectors ────────────────────────────────────────── */

function populateBuildingSelector() {
    const sel = document.getElementById('buildingSelect');
    sel.innerHTML = state.buildings.map(b =>
        `<option value="${escapeHtml(b.buildingId)}" ${b.buildingId === state.selectedBuildingId ? 'selected' : ''}>${escapeHtml(b.name)}</option>`
    ).join('');
}

function populateFloorSelector() {
    const sel = document.getElementById('floorSelect');
    const floors = state.floors
        .filter(f => f.buildingId === state.selectedBuildingId)
        .sort((a, b) => a.verticalOrder - b.verticalOrder);

    sel.innerHTML = floors.map(f =>
        `<option value="${escapeHtml(f.floorId)}" ${f.floorId === state.selectedFloorId ? 'selected' : ''}>${escapeHtml(f.name)}</option>`
    ).join('');
}

/* ── Load Floor ────────────────────────────────────────────────────────── */

function loadFloor(floorId) {
    state.selectedFloorId = floorId;

    const floorFeature = state.floorsGeo.features.find(f => f.properties.floorId === floorId);
    const rooms = state.roomsGeo.features.filter(f => f.properties.floorId === floorId);
    const assets = state.assetsGeo.features.filter(f => f.properties.floorId === floorId);

    // Feed renderer
    renderer.setData(rooms, assets, floorFeature);

    // Sync 3D renderer
    if (renderer3d) {
        renderer3d.setData(rooms, assets, floorFeature);
    }

    // Update UI panels
    renderLeftPanel();
    renderFloorProperties(floorFeature, rooms, assets);

    // Update header label
    const building = state.buildings.find(b => b.buildingId === state.selectedBuildingId);
    const floor = state.floors.find(f => f.floorId === floorId);
    document.getElementById('floorLabel').textContent =
        `${building.name} – ${floor.name}`;

    // Update URL and back link
    pushHash();
    updateBackLink();
}

/* ── Edit Mode Toggle ──────────────────────────────────────────────────── */

function enterEditMode() {
    state.editMode = true;
    document.body.classList.add('fp-edit-mode');

    // Header buttons
    document.getElementById('btnEditor').style.display = 'none';
    document.getElementById('btnPublish').style.display = '';
    document.getElementById('btnExitEditor').style.display = '';

    // Switch toolbar
    renderToolbar();

    // Switch left panel
    renderLeftPanel();

    // Tell editor
    editor.setEditMode(true);

    if (state.viewMode === '3d') {
        // In 3D edit mode, hide left panel by default (shown when Hinzufügen clicked)
        document.getElementById('leftPanel').style.display = 'none';
        if (renderer3d) renderer3d.setTool('select');
    } else {
        editor.setTool('select');
    }
}

function exitEditMode() {
    state.editMode = false;
    document.body.classList.remove('fp-edit-mode');

    // Header buttons
    document.getElementById('btnEditor').style.display = '';
    document.getElementById('btnPublish').style.display = 'none';
    document.getElementById('btnExitEditor').style.display = 'none';

    // Clear edit state
    renderer.selectedAsset = null;
    renderer.selectedRoom = null;

    // Switch toolbar
    renderToolbar();

    // Switch left panel
    renderLeftPanel();

    // Always show left panel in view mode
    document.getElementById('leftPanel').style.display = '';

    // Tell editor
    editor.setEditMode(false);
    editor.setTool('select');

    // Clear 3D edit state
    if (renderer3d) {
        renderer3d.clearMockups();
        renderer3d.setTool('select');
    }

    // Reset properties
    const floorFeature = state.floorsGeo.features.find(f => f.properties.floorId === state.selectedFloorId);
    const rooms = state.roomsGeo.features.filter(f => f.properties.floorId === state.selectedFloorId);
    const assets = state.assetsGeo.features.filter(f => f.properties.floorId === state.selectedFloorId);
    renderFloorProperties(floorFeature, rooms, assets);
}

/* ── Toolbar Rendering ─────────────────────────────────────────────────── */

/* SVG icon constants */
const ICON = {
    cursor: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2l9.5 5.5-4.2.7-.7 4.2L3 2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    pan: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 1.5v7.5M8.5 3v7M11 4.5v5.5M3.5 5v5.5a3.5 3.5 0 003.5 3.5h2.5a3.5 3.5 0 003.5-3.5V4.5M3.5 5c0-1 .5-2 1.5-2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    measure: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13L13 3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M5.5 10.5l-1 1M7.5 8.5l-1 1M9.5 6.5l-1.5 1.5M11.5 4.5l-1 1" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>',
    zoomIn: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.2"/><path d="M7 5v4M5 7h4M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    zoomOut: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.2"/><path d="M5 7h4M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    fit: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    add: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    text: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M8 4v9M6 13h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    draw: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12.5 2.5l1 1-8 8-2.5.5.5-2.5 8-8z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    furniture: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="6" width="10" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M5 6V4.5a3 3 0 016 0V6M4 11v2M12 11v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    undo: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6h6a3 3 0 010 6H8M4 6l2-2M4 6l2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    redo: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 6H6a3 3 0 000 6h2M12 6l-2-2M12 6l-2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function renderToolbar() {
    const toolbar = document.getElementById('toolbar');
    const is3D = state.viewMode === '3d';

    if (is3D && state.editMode) {
        // ── 3D Edit mode toolbar ──
        toolbar.innerHTML = `
            <button class="fp-toolbar__btn fp-toolbar__btn--label" data-tool="add" title="Element hinzufügen">
                ${ICON.add} Hinzufügen
            </button>
            <button class="fp-toolbar__btn active" data-tool="select" title="Auswählen (V)">
                ${ICON.cursor}
            </button>
            <div class="fp-toolbar__sep"></div>
            <button data-tool="measure" class="fp-toolbar__btn" title="Messen (M)">
                ${ICON.measure}
            </button>
            <div class="fp-toolbar__sep"></div>
            <button id="zoomIn" class="fp-toolbar__btn" title="Vergrössern (+)">
                ${ICON.zoomIn}
            </button>
            <button id="zoomOut" class="fp-toolbar__btn" title="Verkleinern (-)">
                ${ICON.zoomOut}
            </button>
            <button id="fitView" class="fp-toolbar__btn" title="Ansicht anpassen (F)">
                ${ICON.fit}
            </button>
        `;
    } else if (is3D) {
        // ── 3D View mode toolbar ──
        toolbar.innerHTML = `
            <button data-tool="select" class="fp-toolbar__btn active" title="Auswählen (V)">
                ${ICON.cursor}
            </button>
            <div class="fp-toolbar__sep"></div>
            <button data-tool="measure" class="fp-toolbar__btn" title="Messen (M)">
                ${ICON.measure}
            </button>
            <div class="fp-toolbar__sep"></div>
            <button id="zoomIn" class="fp-toolbar__btn" title="Vergrössern (+)">
                ${ICON.zoomIn}
            </button>
            <button id="zoomOut" class="fp-toolbar__btn" title="Verkleinern (-)">
                ${ICON.zoomOut}
            </button>
            <button id="fitView" class="fp-toolbar__btn" title="Ansicht anpassen (F)">
                ${ICON.fit}
            </button>
        `;
    } else if (state.editMode) {
        // ── 2D Edit mode toolbar ──
        toolbar.innerHTML = `
            <button class="fp-toolbar__btn fp-toolbar__btn--label" data-tool="add" title="Element hinzufügen" disabled>
                ${ICON.add} Hinzufügen
            </button>
            <button class="fp-toolbar__btn" data-tool="text" title="Text (T)" disabled>
                ${ICON.text}
            </button>
            <button class="fp-toolbar__btn" data-tool="draw" title="Zeichnen (D)" disabled>
                ${ICON.draw}
            </button>
            <button class="fp-toolbar__btn active" data-tool="select" title="Auswählen (V)">
                ${ICON.cursor}
            </button>
            <button class="fp-toolbar__btn" data-tool="furniture" title="Mobiliar" disabled>
                ${ICON.furniture}
            </button>
            <div class="fp-toolbar__sep"></div>
            <button class="fp-toolbar__btn fp-toolbar__btn--disabled" id="undoBtn" title="Rückgängig (Ctrl+Z)" disabled>
                ${ICON.undo}
            </button>
            <button class="fp-toolbar__btn fp-toolbar__btn--disabled" id="redoBtn" title="Wiederholen (Ctrl+Y)" disabled>
                ${ICON.redo}
            </button>
            <button data-tool="measure" class="fp-toolbar__btn" title="Messen (M)">
                ${ICON.measure}
            </button>
            <div class="fp-toolbar__sep"></div>
            <button id="zoomIn" class="fp-toolbar__btn" title="Vergrössern (+)">
                ${ICON.zoomIn}
            </button>
            <button id="zoomOut" class="fp-toolbar__btn" title="Verkleinern (-)">
                ${ICON.zoomOut}
            </button>
            <button id="fitView" class="fp-toolbar__btn" title="Ansicht anpassen (F)">
                ${ICON.fit}
            </button>
        `;
    } else {
        // ── 2D View mode toolbar ──
        toolbar.innerHTML = `
            <button data-tool="select" class="fp-toolbar__btn active" title="Auswählen (V)">
                ${ICON.cursor}
            </button>
            <button data-tool="pan" class="fp-toolbar__btn" title="Verschieben (H)">
                ${ICON.pan}
            </button>
            <div class="fp-toolbar__sep"></div>
            <button data-tool="measure" class="fp-toolbar__btn" title="Messen (M)">
                ${ICON.measure}
            </button>
            <div class="fp-toolbar__sep"></div>
            <button id="zoomIn" class="fp-toolbar__btn" title="Vergrössern (+)">
                ${ICON.zoomIn}
            </button>
            <button id="zoomOut" class="fp-toolbar__btn" title="Verkleinern (-)">
                ${ICON.zoomOut}
            </button>
            <button id="fitView" class="fp-toolbar__btn" title="Ansicht anpassen (F)">
                ${ICON.fit}
            </button>
        `;
    }
}

/* ── Resource List (Left Panel) ────────────────────────────────────────── */

function getAssetsByRoom() {
    const floorAssets = state.assetsGeo.features.filter(
        a => a.properties.floorId === state.selectedFloorId
    );
    const map = {};
    for (const asset of floorAssets) {
        const rid = asset.properties.roomId;
        if (!map[rid]) map[rid] = [];
        map[rid].push(asset);
    }
    return map;
}

function renderRoomItem(room, assetsByRoom, opts) {
    const p = room.properties;
    const assets = assetsByRoom[p.roomId] || [];
    const hasAssets = assets.length > 0;
    const nested = opts.nested || false;
    const showDot = opts.showDot || false;
    const dotColor = opts.dotColor || null;

    return `
        <div class="fp-resource-room ${hasAssets ? 'fp-resource-room--expandable' : ''}" data-room-id="${escapeHtml(p.roomId)}">
            <div class="fp-resource-room__header ${nested ? 'fp-resource-room__header--nested' : ''}">
                ${hasAssets
                    ? `<svg class="fp-resource-room__chevron" width="${nested ? 12 : 14}" height="${nested ? 12 : 14}" viewBox="0 0 14 14">
                           <path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                       </svg>`
                    : `<span class="fp-resource-room__spacer${nested ? '--sm' : ''}"></span>`
                }
                ${showDot && dotColor
                    ? `<span class="fp-resource-room__dot" style="background:${dotColor.fill};border-color:${dotColor.stroke}"></span>`
                    : ''
                }
                <span class="fp-resource-room__label">${escapeHtml(p.type)}${nested ? ' ' + escapeHtml(p.nr) : ''}</span>
                <span class="fp-resource-room__area">${p.area} m²</span>
            </div>
            ${hasAssets ? `
                <div class="fp-resource-room__assets">
                    ${assets.map(a => `
                        <div class="fp-resource-asset ${nested ? 'fp-resource-asset--nested' : ''}" data-asset-id="${escapeHtml(a.properties.assetId)}">
                            <span class="fp-resource-asset__icon">◆</span>
                            <span class="fp-resource-asset__name">${escapeHtml(a.properties.name)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function renderResourceListFlat(rooms) {
    const assetsByRoom = getAssetsByRoom();
    const sorted = [...rooms].sort((a, b) => {
        const cmp = a.properties.type.localeCompare(b.properties.type);
        return cmp !== 0 ? cmp : a.properties.nr.localeCompare(b.properties.nr);
    });

    return sorted.map(room => renderRoomItem(room, assetsByRoom, {
        nested: false, showDot: false,
    })).join('');
}

function renderResourceListGrouped(rooms) {
    const scheme = renderer.getActiveScheme();
    const assetsByRoom = getAssetsByRoom();

    // Group rooms by category
    const groups = {};
    for (const room of rooms) {
        const key = scheme.mapRoom(room) || '_other';
        if (!groups[key]) groups[key] = [];
        groups[key].push(room);
    }

    let html = '';
    for (const [key, cat] of Object.entries(scheme.categories)) {
        const items = groups[key] || [];
        if (items.length === 0) continue;
        const totalArea = items.reduce((s, r) => s + r.properties.area, 0);

        html += `
            <div class="fp-resource-group" data-category="${escapeHtml(key)}">
                <div class="fp-resource-group__header">
                    <svg class="fp-resource-group__chevron" width="14" height="14" viewBox="0 0 14 14">
                        <path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span class="fp-resource-group__color" style="background:${cat.fill};border-color:${cat.stroke}"></span>
                    <span class="fp-resource-group__label">${escapeHtml(cat.label)}</span>
                    <span class="fp-resource-group__count">${items.length}</span>
                    <span class="fp-resource-group__area">${totalArea} m²</span>
                </div>
                <div class="fp-resource-group__items">
                    ${items.map(room => renderRoomItem(room, assetsByRoom, {
                        nested: true, showDot: false,
                    })).join('')}
                </div>
            </div>
        `;
    }
    return html;
}

function renderResourceList(rooms) {
    const schemeId = renderer.activeSchemeId;
    const html = schemeId === 'none'
        ? renderResourceListFlat(rooms)
        : renderResourceListGrouped(rooms);
    document.getElementById('resourceList').innerHTML = html;
}

/* ── Left Panel: View (Resources) vs Edit (Library) ────────────────────── */

function renderLeftPanel() {
    const titleEl = document.querySelector('#leftPanel .fp-panel__title');
    const searchWrap = document.querySelector('#leftPanel .fp-panel__search');
    const listEl = document.getElementById('resourceList');

    if (state.editMode) {
        titleEl.textContent = 'Bibliothek';
        // Hide color-by button and search in edit mode
        document.getElementById('colorByBtn').style.display = 'none';
        document.getElementById('resourceSearch').placeholder = 'Produkte suchen...';
        listEl.innerHTML = renderLibraryContent();
    } else {
        titleEl.textContent = 'Ressourcen';
        document.getElementById('colorByBtn').style.display = '';
        document.getElementById('resourceSearch').placeholder = 'Schnellsuche';
        const rooms = state.roomsGeo.features.filter(f => f.properties.floorId === state.selectedFloorId);
        renderResourceList(rooms);
    }
}

/* Category label map for the library filter */
const CATEGORY_LABELS = {
    stuehle: 'Stühle',
    tische: 'Tische',
    usm: 'USM',
    lampen: 'Lampen',
    schraenke: 'Schränke',
    regale: 'Regale',
    korpus: 'Korpus',
    garderobe: 'Garderobe',
    flipcharts: 'Flipcharts',
    'clubsessel-sofa': 'Clubsessel & Sofa',
    sichtschutz: 'Sichtschutz',
};

function getProductImageUrl(photoId) {
    return `https://images.unsplash.com/${photoId}?w=120&h=120&fit=crop&auto=format`;
}

function renderLibraryContent() {
    const products = state.products;
    const activeCat = state.libraryCategory || 'all';

    // Build unique category list from data
    const categorySet = new Set();
    for (const p of products) {
        if (p.category) categorySet.add(p.category);
    }
    const categories = [...categorySet].sort((a, b) =>
        (CATEGORY_LABELS[a] || a).localeCompare(CATEGORY_LABELS[b] || b, 'de')
    );

    // Category filter dropdown
    let html = `
        <div class="fp-library-tabs">
            <button class="fp-library-tab active">Products</button>
            <button class="fp-library-tab">Components</button>
        </div>
        <div class="fp-library-filter">
            <label class="fp-library-filter__label">Category</label>
            <select class="fp-library-filter__select fp-header__select" id="libraryCategoryFilter">
                <option value="all" ${activeCat === 'all' ? 'selected' : ''}>Alle Kategorien (${products.length})</option>
                ${categories.map(cat => {
                    const count = products.filter(p => p.category === cat).length;
                    const label = CATEGORY_LABELS[cat] || cat;
                    return `<option value="${escapeHtml(cat)}" ${activeCat === cat ? 'selected' : ''}>${escapeHtml(label)} (${count})</option>`;
                }).join('')}
            </select>
        </div>
        <div class="fp-library-grid">
    `;

    // Filter products
    const filtered = activeCat === 'all' ? products : products.filter(p => p.category === activeCat);

    for (const product of filtered) {
        const imgUrl = getProductImageUrl(product.photo);
        html += `
            <div class="fp-library-item" data-category="${escapeHtml(product.category)}" data-product-id="${product.id}" draggable="true">
                <div class="fp-library-item__preview">
                    <img src="${imgUrl}" alt="${escapeHtml(product.name)}" loading="lazy">
                </div>
                ${product.isNew ? '<span class="fp-library-item__badge">New</span>' : ''}
                <span class="fp-library-item__name">${escapeHtml(product.name)}</span>
                <span class="fp-library-item__price">${product.currency} ${product.price.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</span>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

/* ── Color-by Popover ──────────────────────────────────────────────────── */

function renderColorPopover() {
    const schemes = renderer.colorSchemes;
    const active = renderer.activeSchemeId;

    let optionsHtml = '';
    for (const [id, scheme] of Object.entries(schemes)) {
        optionsHtml += `
            <button class="fp-color-option ${id === active ? 'active' : ''}" data-scheme="${id}">
                <span class="fp-color-option__radio"></span>
                <span class="fp-color-option__text">
                    <span class="fp-color-option__label">${escapeHtml(scheme.label)}</span>
                    ${scheme.description ? `<span class="fp-color-option__desc">${escapeHtml(scheme.description)}</span>` : ''}
                </span>
            </button>
        `;
        if (id === 'none') optionsHtml += '<div class="fp-color-popover__divider"></div>';
    }
    document.getElementById('colorOptions').innerHTML = optionsHtml;

    // Legend
    const scheme = schemes[active];
    const cats = scheme.categories;
    if (active !== 'none' && Object.keys(cats).length > 0) {
        let legendHtml = '<div class="fp-color-legend">';
        for (const [, cat] of Object.entries(cats)) {
            legendHtml += `
                <div class="fp-color-legend__item">
                    <span class="fp-color-legend__swatch" style="background:${cat.fill};border-color:${cat.stroke}"></span>
                    <span class="fp-color-legend__label">${escapeHtml(cat.label)}</span>
                </div>
            `;
        }
        legendHtml += '</div>';
        document.getElementById('colorLegend').innerHTML = legendHtml;
    } else {
        document.getElementById('colorLegend').innerHTML = '';
    }
}

/* ── Properties Panel (Right Panel) ────────────────────────────────────── */

function renderFloorProperties(floorFeature, rooms, assets) {
    const floor = floorFeature.properties;
    const building = state.buildings.find(b => b.buildingId === state.selectedBuildingId);
    const totalArea = rooms.reduce((sum, r) => sum + r.properties.area, 0);
    const totalWorkspaces = rooms.reduce((sum, r) => sum + r.properties.workspaces, 0);

    const html = `
        <div class="fp-props-section">
            <div class="fp-props-section__header">
                <h3>Geschoss-Kennzahlen</h3>
            </div>
            <div class="fp-metrics-grid">
                <div class="fp-metric">
                    <span class="fp-metric__label">Fläche</span>
                    <span class="fp-metric__value">${floor.areaGross} <span class="fp-metric__unit">m²</span></span>
                </div>
                <div class="fp-metric">
                    <span class="fp-metric__label">Arbeitsplätze</span>
                    <span class="fp-metric__value">${totalWorkspaces}</span>
                </div>
                <div class="fp-metric">
                    <span class="fp-metric__label">Räume</span>
                    <span class="fp-metric__value">${rooms.length}</span>
                </div>
                <div class="fp-metric">
                    <span class="fp-metric__label">Objekte</span>
                    <span class="fp-metric__value">${assets.length}</span>
                </div>
            </div>
        </div>

        <div class="fp-props-section">
            <div class="fp-props-section__header">
                <h3>Attribute</h3>
            </div>
            <div class="fp-attrs">
                <div class="fp-attr">
                    <span class="fp-attr__label">Geschoss-ID</span>
                    <span class="fp-attr__value">${escapeHtml(floor.floorId)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Geschossname</span>
                    <span class="fp-attr__value">${escapeHtml(floor.name)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Gebäude</span>
                    <span class="fp-attr__value">${escapeHtml(building.name)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Adresse</span>
                    <span class="fp-attr__value">${escapeHtml(building.address.street)}, ${escapeHtml(building.address.postalCode)} ${escapeHtml(building.address.city)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Ebene</span>
                    <span class="fp-attr__value">${floor.levelNumber}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Sichtbarkeit</span>
                    <span class="fp-attr__badge fp-attr__badge--green">Öffentlich</span>
                </div>
            </div>
        </div>
    `;

    document.getElementById('propertiesContent').innerHTML = html;
}

function renderRoomProperties(room) {
    const p = room.properties;
    const roomAssets = state.assetsGeo.features.filter(a => a.properties.roomId === p.roomId);
    const colors = renderer.getColorForRoom(room);

    let html = `
        <div class="fp-props-section">
            <span class="fp-props-back" id="propsBack">← Geschoss</span>
            <div class="fp-props-section__header" style="margin-top:8px">
                <h3 style="display:flex;align-items:center;gap:6px">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${colors.fill};border:1px solid ${colors.stroke}"></span>
                    ${escapeHtml(p.type)} ${escapeHtml(p.nr)}
                </h3>
            </div>
            <div class="fp-metrics-grid">
                <div class="fp-metric">
                    <span class="fp-metric__label">Fläche</span>
                    <span class="fp-metric__value">${p.area} <span class="fp-metric__unit">m²</span></span>
                </div>
                <div class="fp-metric">
                    <span class="fp-metric__label">Arbeitsplätze</span>
                    <span class="fp-metric__value">${p.workspaces}</span>
                </div>
                <div class="fp-metric">
                    <span class="fp-metric__label">Objekte</span>
                    <span class="fp-metric__value">${roomAssets.length}</span>
                </div>
            </div>
        </div>

        <div class="fp-props-section">
            <div class="fp-props-section__header">
                <h3>Attribute</h3>
            </div>
            <div class="fp-attrs">
                <div class="fp-attr">
                    <span class="fp-attr__label">Raum-ID</span>
                    <span class="fp-attr__value">${escapeHtml(p.roomId)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Typ</span>
                    <span class="fp-attr__value">${escapeHtml(p.type)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Raum-Nr</span>
                    <span class="fp-attr__value">${escapeHtml(p.nr)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Fläche</span>
                    <span class="fp-attr__value">${p.area} m²</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Arbeitsplätze</span>
                    <span class="fp-attr__value">${p.workspaces}</span>
                </div>
            </div>
        </div>
    `;

    if (roomAssets.length > 0) {
        html += `
            <div class="fp-props-section">
                <div class="fp-props-section__header">
                    <h3>Mobiliar (${roomAssets.length})</h3>
                </div>
                <div class="fp-asset-list">
                    ${roomAssets.map(a => `
                        <div class="fp-asset-item" data-asset-id="${escapeHtml(a.properties.assetId)}">
                            <span class="fp-asset-item__name">${escapeHtml(a.properties.name)}</span>
                            <span class="fp-asset-item__status fp-asset-item__status--${a.properties.condition.toLowerCase()}">${escapeHtml(a.properties.condition)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    document.getElementById('propertiesContent').innerHTML = html;
}

function renderAssetProperties(asset) {
    const p = asset.properties;

    // Edit mode: show editable properties
    if (state.editMode) {
        renderEditableAssetProperties(asset);
        return;
    }

    const html = `
        <div class="fp-props-section">
            <span class="fp-props-back" id="propsBack">← Geschoss</span>
            <div class="fp-props-section__header" style="margin-top:8px">
                <h3>${escapeHtml(p.name)}</h3>
            </div>
        </div>

        <div class="fp-props-section">
            <div class="fp-props-section__header">
                <h3>Attribute</h3>
            </div>
            <div class="fp-attrs">
                <div class="fp-attr">
                    <span class="fp-attr__label">Objekt-ID</span>
                    <span class="fp-attr__value">${escapeHtml(p.assetId)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Inventar-Nr</span>
                    <span class="fp-attr__value">${escapeHtml(p.inventoryNumber)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Marke</span>
                    <span class="fp-attr__value">${escapeHtml(p.brand)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Kategorie</span>
                    <span class="fp-attr__value">${escapeHtml(p.categoryId)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Status</span>
                    <span class="fp-attr__badge fp-attr__badge--green">${escapeHtml(p.status)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Zustand</span>
                    <span class="fp-attr__value">${escapeHtml(p.condition)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Beschafft</span>
                    <span class="fp-attr__value">${escapeHtml(p.acquisitionDate)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Kosten</span>
                    <span class="fp-attr__value">CHF ${p.acquisitionCost.toLocaleString('de-CH')}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Raum</span>
                    <span class="fp-attr__value">${escapeHtml(p.roomId)}</span>
                </div>
            </div>
        </div>
    `;

    document.getElementById('propertiesContent').innerHTML = html;
}

function renderEditableAssetProperties(asset) {
    const p = asset.properties;

    // Compute local position from centroid or polygon center
    let posLocal = { x: 0, y: 0 };
    if (p.centroid) {
        posLocal = renderer.geoToLocal(p.centroid[0], p.centroid[1]);
    } else {
        const coords = asset.geometry.coordinates[0];
        const n = coords.length - 1;
        let cx = 0, cy = 0;
        for (let i = 0; i < n; i++) { cx += coords[i][0]; cy += coords[i][1]; }
        posLocal = renderer.geoToLocal(cx / n, cy / n);
    }

    const html = `
        <div class="fp-props-section">
            <span class="fp-props-back" id="propsBack">← Geschoss</span>
            <div class="fp-props-section__header" style="margin-top:8px">
                <h3>${escapeHtml(p.name)}</h3>
            </div>
        </div>

        <div class="fp-props-section">
            <div class="fp-props-section__header">
                <h3>Position</h3>
            </div>
            <div class="fp-edit-fields">
                <div class="fp-edit-field">
                    <label class="fp-edit-field__label">X</label>
                    <input type="text" class="fp-edit-field__input" id="editPosX" value="${posLocal.x.toFixed(2)} m" readonly>
                </div>
                <div class="fp-edit-field">
                    <label class="fp-edit-field__label">Z</label>
                    <input type="text" class="fp-edit-field__input" id="editPosZ" value="${posLocal.y.toFixed(2)} m" readonly>
                </div>
                <div class="fp-edit-field">
                    <label class="fp-edit-field__label">Basishöhe</label>
                    <input type="text" class="fp-edit-field__input" value="0 m" readonly>
                </div>
                <div class="fp-edit-field">
                    <label class="fp-edit-field__label">Rotation</label>
                    <input type="text" class="fp-edit-field__input" id="editRotation" value="0°" readonly>
                </div>
            </div>
        </div>

        <div class="fp-props-section">
            <div class="fp-props-section__header">
                <h3>Attribute</h3>
            </div>
            <div class="fp-edit-fields">
                <div class="fp-edit-field fp-edit-field--full">
                    <label class="fp-edit-field__label">Eigene ID</label>
                    <input type="text" class="fp-edit-field__input" value="${escapeHtml(p.assetId)}">
                </div>
                <div class="fp-edit-field fp-edit-field--full">
                    <label class="fp-edit-field__label">Name</label>
                    <input type="text" class="fp-edit-field__input" value="${escapeHtml(p.name)}">
                </div>
            </div>
        </div>

        <div class="fp-props-section">
            <div class="fp-props-section__header">
                <h3>Info</h3>
            </div>
            <div class="fp-attrs">
                <div class="fp-attr">
                    <span class="fp-attr__label">Marke</span>
                    <span class="fp-attr__value">${escapeHtml(p.brand)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Kategorie</span>
                    <span class="fp-attr__value">${escapeHtml(p.categoryId)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Status</span>
                    <span class="fp-attr__badge fp-attr__badge--green">${escapeHtml(p.status)}</span>
                </div>
                <div class="fp-attr">
                    <span class="fp-attr__label">Raum</span>
                    <span class="fp-attr__value">${escapeHtml(p.roomId)}</span>
                </div>
            </div>
        </div>
    `;

    document.getElementById('propertiesContent').innerHTML = html;
}

/* ── Selection Change Handler ──────────────────────────────────────────── */

function onSelectionChange(e) {
    const hit = e.detail;

    // Update resource list highlights (only in view mode)
    if (!state.editMode) {
        document.querySelectorAll('.fp-resource-room.selected').forEach(el => el.classList.remove('selected'));
        document.querySelectorAll('.fp-resource-asset.selected').forEach(el => el.classList.remove('selected'));
    }

    if (!hit) {
        // Deselected → show floor properties
        const floorFeature = state.floorsGeo.features.find(f => f.properties.floorId === state.selectedFloorId);
        const rooms = state.roomsGeo.features.filter(f => f.properties.floorId === state.selectedFloorId);
        const assets = state.assetsGeo.features.filter(f => f.properties.floorId === state.selectedFloorId);
        renderFloorProperties(floorFeature, rooms, assets);
        return;
    }

    if (hit.type === 'room') {
        renderRoomProperties(hit.feature);

        if (!state.editMode) {
            // Highlight in resource list
            const roomId = hit.feature.properties.roomId;
            const roomEl = document.querySelector(`.fp-resource-room[data-room-id="${roomId}"]`);
            if (roomEl) {
                roomEl.classList.add('selected');
                const group = roomEl.closest('.fp-resource-group');
                if (group) group.classList.add('expanded');
                roomEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    } else if (hit.type === 'asset') {
        renderAssetProperties(hit.feature);
    }
}

/* ── Asset Moved Handler (live property updates during gizmo drag) ──── */

function onAssetMoved(e) {
    if (!state.editMode || !e.detail) return;
    const asset = e.detail;
    const posXInput = document.getElementById('editPosX');
    const posZInput = document.getElementById('editPosZ');
    if (posXInput && posZInput) {
        let posLocal;
        if (asset.properties.centroid) {
            posLocal = renderer.geoToLocal(asset.properties.centroid[0], asset.properties.centroid[1]);
        } else {
            const coords = asset.geometry.coordinates[0];
            const n = coords.length - 1;
            let cx = 0, cy = 0;
            for (let i = 0; i < n; i++) { cx += coords[i][0]; cy += coords[i][1]; }
            posLocal = renderer.geoToLocal(cx / n, cy / n);
        }
        posXInput.value = posLocal.x.toFixed(2) + ' m';
        posZInput.value = posLocal.y.toFixed(2) + ' m';
    }
}

/* ── UI Event Binding ──────────────────────────────────────────────────── */

function bindUIEvents() {

    // ── Building selector ──
    document.getElementById('buildingSelect').addEventListener('change', (e) => {
        state.selectedBuildingId = e.target.value;
        populateFloorSelector();
        const firstFloor = state.floors
            .filter(f => f.buildingId === state.selectedBuildingId)
            .sort((a, b) => a.verticalOrder - b.verticalOrder)[0];
        if (firstFloor) {
            state.selectedFloorId = firstFloor.floorId;
            document.getElementById('floorSelect').value = firstFloor.floorId;
            loadFloor(firstFloor.floorId);
        }
    });

    // ── Floor selector ──
    document.getElementById('floorSelect').addEventListener('change', (e) => {
        loadFloor(e.target.value);
    });

    // ── Toolbar (event delegation — survives innerHTML replacement) ──
    document.getElementById('toolbar').addEventListener('click', (e) => {
        const toolBtn = e.target.closest('.fp-toolbar__btn[data-tool]');
        if (toolBtn && !toolBtn.disabled) {
            document.querySelectorAll('.fp-toolbar__btn[data-tool]').forEach(b => b.classList.remove('active'));
            toolBtn.classList.add('active');

            const tool = toolBtn.dataset.tool;

            if (state.viewMode === '3d' && renderer3d) {
                renderer3d.setTool(tool);
                // Toggle left panel for 'add' tool in edit mode
                if (state.editMode) {
                    document.getElementById('leftPanel').style.display = (tool === 'add') ? '' : 'none';
                }
            } else {
                editor.setTool(tool);
            }
            return;
        }

        const zoomInBtn = e.target.closest('#zoomIn');
        if (zoomInBtn) {
            if (state.viewMode === '3d' && renderer3d) renderer3d.zoomIn();
            else editor.zoomIn();
            return;
        }

        const zoomOutBtn = e.target.closest('#zoomOut');
        if (zoomOutBtn) {
            if (state.viewMode === '3d' && renderer3d) renderer3d.zoomOut();
            else editor.zoomOut();
            return;
        }

        const fitBtn = e.target.closest('#fitView');
        if (fitBtn) {
            if (state.viewMode === '3d' && renderer3d) renderer3d.fitViewOrbit();
            else renderer.fitView();
            return;
        }
    });

    // ── Edit mode buttons ──
    document.getElementById('btnEditor').addEventListener('click', () => enterEditMode());
    document.getElementById('btnExitEditor').addEventListener('click', () => exitEditMode());

    // ── View toggle (2D/3D/Walk) ──
    document.querySelectorAll('.fp-view-toggle__btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchViewMode(btn.dataset.view);
        });
    });

    // ── Color-by popover toggle ──
    document.getElementById('colorByBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const popover = document.getElementById('colorPopover');
        const wasHidden = popover.hidden;
        popover.hidden = !wasHidden;
        document.getElementById('colorByBtn').classList.toggle('active', wasHidden);
        if (wasHidden) renderColorPopover();
    });

    // Close popover on outside click
    document.addEventListener('click', (e) => {
        const popover = document.getElementById('colorPopover');
        if (!popover.hidden && !e.target.closest('#colorPopover') && !e.target.closest('#colorByBtn')) {
            popover.hidden = true;
            document.getElementById('colorByBtn').classList.toggle('active', renderer.activeSchemeId !== 'none');
        }
    });

    // Color scheme selection
    document.getElementById('colorOptions').addEventListener('click', (e) => {
        const btn = e.target.closest('.fp-color-option');
        if (!btn) return;
        const schemeId = btn.dataset.scheme;
        renderer.setColorScheme(schemeId);
        if (renderer3d) renderer3d.setColorScheme(schemeId);
        document.getElementById('colorByBtn').classList.toggle('active', schemeId !== 'none');
        renderColorPopover();
        const rooms = state.roomsGeo.features.filter(f => f.properties.floorId === state.selectedFloorId);
        renderResourceList(rooms);
    });

    // ── Resource list: group/room expand + selection ──
    document.getElementById('resourceList').addEventListener('click', (e) => {
        // Library tabs (edit mode)
        const tab = e.target.closest('.fp-library-tab');
        if (tab) {
            document.querySelectorAll('.fp-library-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            return;
        }

        // Group header toggle (grouped mode)
        const groupHeader = e.target.closest('.fp-resource-group__header');
        if (groupHeader) {
            groupHeader.parentElement.classList.toggle('expanded');
            return;
        }

        // Room header click → toggle expand + select on canvas
        const roomHeader = e.target.closest('.fp-resource-room__header');
        if (roomHeader) {
            const roomEl = roomHeader.closest('.fp-resource-room');
            const roomId = roomEl.dataset.roomId;

            if (roomEl.classList.contains('fp-resource-room--expandable')) {
                roomEl.classList.toggle('expanded');
            }

            const room = renderer.rooms.find(r => r.properties.roomId === roomId);
            if (room) {
                renderer.selectedRoom = room;
                renderer.selectedAsset = null;
                renderer.zoomToFeature(room);
                if (renderer3d && state.viewMode !== '2d') {
                    renderer3d.selectRoom(room);
                    renderer3d.zoomToFeature(room);
                }
                window.dispatchEvent(new CustomEvent('fp-selection-change', {
                    detail: { type: 'room', feature: room }
                }));
            }
            return;
        }

        // Asset click → select on canvas
        const assetEl = e.target.closest('.fp-resource-asset');
        if (assetEl) {
            const assetId = assetEl.dataset.assetId;
            const asset = renderer.assets.find(a => a.properties.assetId === assetId);
            if (asset) {
                renderer.selectedAsset = asset;
                renderer.selectedRoom = null;
                renderer.zoomToFeature(asset);
                if (renderer3d && state.viewMode !== '2d') {
                    renderer3d.selectAsset(asset);
                    renderer3d.zoomToFeature(asset);
                }
                window.dispatchEvent(new CustomEvent('fp-selection-change', {
                    detail: { type: 'asset', feature: asset }
                }));
            }
        }
    });

    // ── Properties panel: back button + asset click (delegated) ──
    document.getElementById('propertiesContent').addEventListener('click', (e) => {
        if (e.target.id === 'propsBack' || e.target.closest('#propsBack')) {
            renderer.selectedRoom = null;
            renderer.selectedAsset = null;
            renderer.draw();
            if (renderer3d && state.viewMode !== '2d') renderer3d.clearSelection();
            window.dispatchEvent(new CustomEvent('fp-selection-change', { detail: null }));
            return;
        }

        const assetItem = e.target.closest('.fp-asset-item');
        if (assetItem) {
            const assetId = assetItem.dataset.assetId;
            const asset = renderer.assets.find(a => a.properties.assetId === assetId);
            if (asset) {
                renderer.selectedAsset = asset;
                renderer.selectedRoom = null;
                renderer.zoomToFeature(asset);
                if (renderer3d && state.viewMode !== '2d') {
                    renderer3d.selectAsset(asset);
                    renderer3d.zoomToFeature(asset);
                }
                window.dispatchEvent(new CustomEvent('fp-selection-change', {
                    detail: { type: 'asset', feature: asset }
                }));
            }
        }
    });

    // ── Library category filter (delegated since element is rebuilt) ──
    document.getElementById('resourceList').addEventListener('change', (e) => {
        if (e.target.id === 'libraryCategoryFilter') {
            state.libraryCategory = e.target.value;
            document.getElementById('resourceList').innerHTML = renderLibraryContent();
        }
    });

    // ── Resource search ──
    document.getElementById('resourceSearch').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();

        if (state.editMode) {
            // Filter library items by name, price, or category
            document.querySelectorAll('.fp-library-item').forEach(item => {
                const name = item.querySelector('.fp-library-item__name');
                const price = item.querySelector('.fp-library-item__price');
                const text = (name ? name.textContent.toLowerCase() : '')
                    + ' ' + (price ? price.textContent.toLowerCase() : '')
                    + ' ' + (item.dataset.category || '');
                item.style.display = (!query || text.includes(query)) ? '' : 'none';
            });
            return;
        }

        // Search across both flat rooms and grouped rooms
        document.querySelectorAll('.fp-resource-room').forEach(roomEl => {
            const label = roomEl.querySelector('.fp-resource-room__label');
            const text = label ? label.textContent.toLowerCase() : '';
            let assetMatch = false;
            roomEl.querySelectorAll('.fp-resource-asset__name').forEach(n => {
                if (n.textContent.toLowerCase().includes(query)) assetMatch = true;
            });
            const match = !query || text.includes(query) || assetMatch;
            roomEl.style.display = match ? '' : 'none';
            if (query && match && assetMatch) roomEl.classList.add('expanded');
        });

        document.querySelectorAll('.fp-resource-group').forEach(group => {
            const label = group.querySelector('.fp-resource-group__label');
            const groupText = label ? label.textContent.toLowerCase() : '';
            const visibleRooms = group.querySelectorAll('.fp-resource-room:not([style*="display: none"])');
            const groupMatch = !query || groupText.includes(query);
            group.style.display = (groupMatch || visibleRooms.length > 0) ? '' : 'none';
            if (query && visibleRooms.length > 0) group.classList.add('expanded');
        });
    });
}

/* ── Start ─────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', init);
