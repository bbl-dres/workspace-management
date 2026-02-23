/* ==========================================================================
   renderer.js – Canvas Floor Plan Renderer

   Follows Archilogic's engine/container architecture pattern:
   - Owns the canvas and rendering context
   - Manages coordinate projection (WGS84 → local meters → screen pixels)
   - Provides spatial queries (hitTest, getResourcesFromPosition)
   - Emits events for selection changes
   - Supports declarative theming (room colors by type)
   ========================================================================== */

class FloorPlanRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        /* ── View State ────────────────────────────────────────────────── */
        this.panX = 0;
        this.panY = 0;
        this.zoom = 1;
        this.displayWidth = 0;
        this.displayHeight = 0;

        /* ── Scene Graph ───────────────────────────────────────────────── */
        this.rooms = [];       // GeoJSON features
        this.assets = [];      // GeoJSON features
        this.floorOutline = null;

        /* ── Projection ────────────────────────────────────────────────── */
        this.projection = null;

        /* ── Selection / Hover State ───────────────────────────────────── */
        this.hoveredRoom = null;
        this.selectedRoom = null;
        this.hoveredAsset = null;
        this.selectedAsset = null;

        /* ── Measurement State (multi-point polyline / polygon) ─────── */
        this.measurePoints = [];        // Array of { x, y } in local coords
        this.measureCursorPoint = null; // live rubber-band endpoint
        this.measureClosed = false;     // true when polygon is closed

        /* ── Edit Mode ────────────────────────────────────────────────── */
        this.editMode = false;

        /* ── Color Schemes (Archilogic declarative theming pattern) ──── */
        this.neutralColor = { fill: '#FFFFFF', stroke: '#CBD5E1' };
        this.activeSchemeId = 'none';

        this.colorSchemes = {
            none: {
                id: 'none', label: 'Keine',
                description: 'Keine Farbcodierung',
                categories: {},
                mapRoom: () => null,
            },
            function: {
                id: 'function', label: 'Funktion',
                description: 'Raumfunktion / Nutzungstyp',
                categories: {
                    'Büro':           { fill: '#DBEAFE', stroke: '#93C5FD', label: 'Büro' },
                    'Sitzungszimmer': { fill: '#FEF3C7', stroke: '#FCD34D', label: 'Sitzungszimmer' },
                    'Open Space':     { fill: '#D1FAE5', stroke: '#6EE7B7', label: 'Open Space' },
                    'Empfang':        { fill: '#EDE9FE', stroke: '#C4B5FD', label: 'Empfang' },
                    'Teeküche':       { fill: '#FFEDD5', stroke: '#FDBA74', label: 'Teeküche' },
                    'WC':             { fill: '#F3F4F6', stroke: '#D1D5DB', label: 'WC' },
                    'Korridor':       { fill: '#F9FAFB', stroke: '#E5E7EB', label: 'Korridor' },
                    'Lager':          { fill: '#FEF2F2', stroke: '#FCA5A5', label: 'Lager' },
                    'Technik':        { fill: '#F1F5F9', stroke: '#94A3B8', label: 'Technik' },
                    'Garderobe':      { fill: '#FCE7F3', stroke: '#F9A8D4', label: 'Garderobe' },
                    'Archiv':         { fill: '#FFF7ED', stroke: '#FDBA74', label: 'Archiv' },
                    'Druckraum':      { fill: '#F0FDF4', stroke: '#86EFAC', label: 'Druckraum' },
                },
                mapRoom: (room) => room.properties.type,
            },
            sia416: {
                id: 'sia416', label: 'SIA 416',
                description: 'Schweizer Norm (SIA 416:2003)',
                categories: {
                    'HNF': { fill: '#BFDBFE', stroke: '#3B82F6', label: 'HNF – Hauptnutzfläche' },
                    'NNF': { fill: '#FDE68A', stroke: '#F59E0B', label: 'NNF – Nebennutzfläche' },
                    'VF':  { fill: '#C7D2FE', stroke: '#6366F1', label: 'VF – Verkehrsfläche' },
                    'FF':  { fill: '#E2E8F0', stroke: '#64748B', label: 'FF – Funktionsfläche' },
                },
                mapRoom: (room) => {
                    const t = room.properties.type;
                    if (['Büro', 'Sitzungszimmer', 'Open Space', 'Empfang'].includes(t)) return 'HNF';
                    if (['Teeküche', 'WC', 'Garderobe', 'Lager', 'Archiv', 'Druckraum'].includes(t)) return 'NNF';
                    if (['Korridor'].includes(t)) return 'VF';
                    if (['Technik'].includes(t)) return 'FF';
                    return 'NNF';
                },
            },
            din277: {
                id: 'din277', label: 'DIN 277',
                description: 'Deutsche Norm (DIN 277:2024)',
                categories: {
                    'NUF': { fill: '#BBF7D0', stroke: '#22C55E', label: 'NUF – Nutzungsfläche' },
                    'TF':  { fill: '#E2E8F0', stroke: '#64748B', label: 'TF – Techn. Funktionsfläche' },
                    'VF':  { fill: '#DDD6FE', stroke: '#8B5CF6', label: 'VF – Verkehrsfläche' },
                },
                mapRoom: (room) => {
                    const t = room.properties.type;
                    if (['Korridor'].includes(t)) return 'VF';
                    if (['Technik'].includes(t)) return 'TF';
                    return 'NUF';
                },
            },
            boma: {
                id: 'boma', label: 'BOMA',
                description: 'Internationaler BOMA-Standard',
                categories: {
                    'OFFICE':   { fill: '#BFDBFE', stroke: '#3B82F6', label: 'Bürofläche' },
                    'FLOOR':    { fill: '#C4B5FD', stroke: '#7C3AED', label: 'Geschoss-Gemeinschaftsfläche' },
                    'BUILDING': { fill: '#FED7AA', stroke: '#F97316', label: 'Gebäude-Gemeinschaftsfläche' },
                },
                mapRoom: (room) => {
                    const t = room.properties.type;
                    if (['Büro', 'Open Space', 'Sitzungszimmer'].includes(t)) return 'OFFICE';
                    if (['Empfang'].includes(t)) return 'FLOOR';
                    return 'BUILDING';
                },
            },
            rics: {
                id: 'rics', label: 'RICS',
                description: 'RICS-Flächenmessung (IPMS)',
                categories: {
                    'NIA':   { fill: '#BFDBFE', stroke: '#3B82F6', label: 'NIA – Nettoinnenfläche' },
                    'AMEN':  { fill: '#FDE68A', stroke: '#F59E0B', label: 'Gemeinschaftsfläche' },
                    'ANC':   { fill: '#FDBA74', stroke: '#EA580C', label: 'Nebenfläche' },
                    'CIRC':  { fill: '#C7D2FE', stroke: '#6366F1', label: 'Verkehrsfläche' },
                    'FACIL': { fill: '#E2E8F0', stroke: '#64748B', label: 'Technikfläche' },
                },
                mapRoom: (room) => {
                    const t = room.properties.type;
                    if (['Büro', 'Open Space', 'Sitzungszimmer', 'Empfang'].includes(t)) return 'NIA';
                    if (['Teeküche', 'Garderobe'].includes(t)) return 'AMEN';
                    if (['Lager', 'Archiv', 'Druckraum'].includes(t)) return 'ANC';
                    if (['Korridor'].includes(t)) return 'CIRC';
                    if (['Technik', 'WC'].includes(t)) return 'FACIL';
                    return 'NIA';
                },
            },
        };

        /* ── Asset Category Shape Mapping ──────────────────────────────── */
        this.assetShapes = {
            'buerostuehle':       'circle',
            'konferenzstuehle':   'circle',
            'besucherstuehle':    'circle',
            'schreibtische':      'rect',
            'besprechungstische': 'rect',
            'stehpulte':          'rect',
            'regale':             'rect',
            'sideboards':         'rect',
            'stehleuchten':       'diamond',
            'empfangsmoebel':     'rect',
        };

        /* ── Draw Batching ─────────────────────────────────────────────── */
        this._drawScheduled = false;

        /* ── Resize Observer ───────────────────────────────────────────── */
        this._resizeObserver = new ResizeObserver(() => this._handleResize());
    }

    /* ── Lifecycle ─────────────────────────────────────────────────────── */

    init() {
        this._resizeObserver.observe(this.canvas.parentElement);
        this._handleResize();
    }

    destroy() {
        this._resizeObserver.disconnect();
    }

    /** Batched draw — coalesces multiple draw requests into one per frame */
    requestDraw() {
        if (!this._drawScheduled) {
            this._drawScheduled = true;
            requestAnimationFrame(() => {
                this._drawScheduled = false;
                this.draw();
            });
        }
    }

    /* ── Data Loading (Scene Graph) ────────────────────────────────────── */

    setData(rooms, assets, floorFeature) {
        this.rooms = rooms;
        this.assets = assets;
        this.floorOutline = floorFeature;

        // Clear selection
        this.hoveredRoom = null;
        this.selectedRoom = null;
        this.hoveredAsset = null;
        this.selectedAsset = null;
        this.measurePoints = [];
        this.measureCursorPoint = null;
        this.measureClosed = false;

        this._calculateProjection();
        this.fitView();
    }

    addAsset(feature) {
        this.assets.push(feature);
        this.draw();
    }

    /* ── Projection ────────────────────────────────────────────────────── */

    _calculateProjection() {
        if (!this.rooms.length && !this.floorOutline) return;

        let minLon = Infinity, maxLon = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;

        const source = this.floorOutline ? [this.floorOutline] : this.rooms;
        for (const feature of source) {
            for (const [lon, lat] of feature.geometry.coordinates[0]) {
                if (lon < minLon) minLon = lon;
                if (lon > maxLon) maxLon = lon;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
            }
        }

        const centerLon = (minLon + maxLon) / 2;
        const centerLat = (minLat + maxLat) / 2;
        const metersPerDegreeLon = Math.cos(centerLat * Math.PI / 180) * 111320;
        const metersPerDegreeLat = 111320;

        this.projection = {
            centerLon,
            centerLat,
            metersPerDegreeLon,
            metersPerDegreeLat,
            widthMeters: (maxLon - minLon) * metersPerDegreeLon,
            heightMeters: (maxLat - minLat) * metersPerDegreeLat,
        };
    }

    /* ── Coordinate Transforms ─────────────────────────────────────────── */

    geoToLocal(lon, lat) {
        const p = this.projection;
        if (!p) return { x: 0, y: 0 };
        return {
            x: (lon - p.centerLon) * p.metersPerDegreeLon,
            y: -(lat - p.centerLat) * p.metersPerDegreeLat, // flip Y
        };
    }

    localToScreen(lx, ly) {
        return {
            x: lx * this.zoom + this.displayWidth / 2 + this.panX,
            y: ly * this.zoom + this.displayHeight / 2 + this.panY,
        };
    }

    screenToLocal(sx, sy) {
        return {
            x: (sx - this.displayWidth / 2 - this.panX) / this.zoom,
            y: (sy - this.displayHeight / 2 - this.panY) / this.zoom,
        };
    }

    /* ── View Controls ─────────────────────────────────────────────────── */

    fitView() {
        if (!this.projection) return;
        const padding = 60;
        const scaleX = (this.displayWidth - padding * 2) / Math.max(this.projection.widthMeters, 0.1);
        const scaleY = (this.displayHeight - padding * 2) / Math.max(this.projection.heightMeters, 0.1);
        this.zoom = Math.min(scaleX, scaleY);
        this.panX = 0;
        this.panY = 0;
        this.draw();
    }

    zoomToFeature(feature) {
        const coords = feature.geometry.coordinates[0];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const [lon, lat] of coords) {
            const local = this.geoToLocal(lon, lat);
            if (local.x < minX) minX = local.x;
            if (local.x > maxX) maxX = local.x;
            if (local.y < minY) minY = local.y;
            if (local.y > maxY) maxY = local.y;
        }
        const padding = 80;
        const scaleX = (this.displayWidth - padding * 2) / Math.max(maxX - minX, 0.1);
        const scaleY = (this.displayHeight - padding * 2) / Math.max(maxY - minY, 0.1);
        this.zoom = Math.min(Math.min(scaleX, scaleY) * 0.85, 150);
        this.panX = -(minX + maxX) / 2 * this.zoom;
        this.panY = -(minY + maxY) / 2 * this.zoom;
        this.draw();
    }

    /* ── Color Scheme API ──────────────────────────────────────────────── */

    setColorScheme(schemeId) {
        if (this.colorSchemes[schemeId]) {
            this.activeSchemeId = schemeId;
            this.requestDraw();
        }
    }

    getActiveScheme() {
        return this.colorSchemes[this.activeSchemeId];
    }

    getColorForRoom(room) {
        const scheme = this.colorSchemes[this.activeSchemeId];
        if (!scheme || !Object.keys(scheme.categories).length) return this.neutralColor;
        const key = scheme.mapRoom(room);
        if (!key) return this.neutralColor;
        return scheme.categories[key] || this.neutralColor;
    }

    getCategoryKeyForRoom(room) {
        const scheme = this.colorSchemes[this.activeSchemeId];
        if (!scheme) return null;
        return scheme.mapRoom(room);
    }

    /* ── Resize ────────────────────────────────────────────────────────── */

    _handleResize() {
        const parent = this.canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        const w = parent.clientWidth;
        const h = parent.clientHeight;

        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.displayWidth = w;
        this.displayHeight = h;
        this.draw();
    }

    /* ── MAIN DRAW ─────────────────────────────────────────────────────── */

    draw() {
        const ctx = this.ctx;
        const w = this.displayWidth;
        const h = this.displayHeight;
        if (!w || !h) return;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#ECEEF1';
        ctx.fillRect(0, 0, w, h);

        if (!this.projection) return;

        // Layer 1: Grid
        this._drawGrid();

        // Layer 2: Floor outline
        if (this.floorOutline) {
            this._drawFloorOutline();
        }

        // Layer 3: Rooms
        for (const room of this.rooms) {
            this._drawRoom(room, room === this.hoveredRoom, room === this.selectedRoom);
        }

        // Layer 4: Room Labels
        for (const room of this.rooms) {
            this._drawRoomLabel(room);
        }

        // Layer 5: Assets (furniture)
        for (const asset of this.assets) {
            this._drawAsset(asset, asset === this.hoveredAsset, asset === this.selectedAsset);
        }

        // Layer 6: Measurement polyline / polygon
        if (this.measurePoints.length > 0) {
            this._drawMeasure();
        }

        // Layer 7: Edit mode gizmo
        if (this.editMode && this.selectedAsset) {
            this._drawGizmo(this.selectedAsset);
        }

        // HUD: Scale bar
        this._updateScaleBar();
    }

    /* ── Layer: Grid ───────────────────────────────────────────────────── */

    _drawGrid() {
        const ctx = this.ctx;
        const spacing = this._gridSpacing();
        if (spacing <= 0) return;

        const topLeft = this.screenToLocal(0, 0);
        const botRight = this.screenToLocal(this.displayWidth, this.displayHeight);

        const startX = Math.floor(topLeft.x / spacing) * spacing;
        const startY = Math.floor(topLeft.y / spacing) * spacing;

        ctx.beginPath();
        ctx.strokeStyle = '#DDDFE3';
        ctx.lineWidth = 0.5;

        for (let x = startX; x <= botRight.x; x += spacing) {
            const s = this.localToScreen(x, 0);
            ctx.moveTo(s.x, 0);
            ctx.lineTo(s.x, this.displayHeight);
        }
        for (let y = startY; y <= botRight.y; y += spacing) {
            const s = this.localToScreen(0, y);
            ctx.moveTo(0, s.y);
            ctx.lineTo(this.displayWidth, s.y);
        }
        ctx.stroke();
    }

    _gridSpacing() {
        const ppm = this.zoom; // pixels per meter
        if (ppm > 20) return 1;
        if (ppm > 5)  return 5;
        if (ppm > 2)  return 10;
        return 25;
    }

    /* ── Layer: Floor Outline ──────────────────────────────────────────── */

    _drawFloorOutline() {
        const ctx = this.ctx;
        const coords = this.floorOutline.geometry.coordinates[0];

        ctx.beginPath();
        for (let i = 0; i < coords.length; i++) {
            const local = this.geoToLocal(coords[i][0], coords[i][1]);
            const s = this.localToScreen(local.x, local.y);
            if (i === 0) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
        }
        ctx.closePath();

        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    /* ── Layer: Room ───────────────────────────────────────────────────── */

    _drawRoom(room, isHovered, isSelected) {
        const ctx = this.ctx;
        const colors = this.getColorForRoom(room);
        const coords = room.geometry.coordinates[0];

        // Build path
        ctx.beginPath();
        for (let i = 0; i < coords.length; i++) {
            const local = this.geoToLocal(coords[i][0], coords[i][1]);
            const s = this.localToScreen(local.x, local.y);
            if (i === 0) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
        }
        ctx.closePath();

        // Fill
        if (isSelected) {
            ctx.fillStyle = colors.stroke + '30';
        } else if (isHovered) {
            ctx.fillStyle = colors.fill;
            ctx.globalAlpha = 0.75;
        } else {
            ctx.fillStyle = colors.fill;
        }
        ctx.fill();
        ctx.globalAlpha = 1;

        // Walls / Stroke
        if (isSelected) {
            ctx.strokeStyle = '#2563EB';
            ctx.lineWidth = 2.5;
        } else if (isHovered) {
            ctx.strokeStyle = colors.stroke;
            ctx.lineWidth = 2;
        } else {
            ctx.strokeStyle = '#94A3B8';
            ctx.lineWidth = 1;
        }
        ctx.stroke();
    }

    /* ── Layer: Room Label ─────────────────────────────────────────────── */

    _drawRoomLabel(room) {
        const ctx = this.ctx;
        const ppm = this.zoom;
        if (ppm < 3) return; // too zoomed out

        const coords = room.geometry.coordinates[0];
        const n = coords.length - 1;
        let cx = 0, cy = 0;
        for (let i = 0; i < n; i++) {
            const local = this.geoToLocal(coords[i][0], coords[i][1]);
            cx += local.x;
            cy += local.y;
        }
        cx /= n;
        cy /= n;
        const s = this.localToScreen(cx, cy);

        const nr = room.properties.nr;
        const area = room.properties.area;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (ppm > 6) {
            // Show room number + area
            ctx.font = '600 11px "Noto Sans", sans-serif';
            ctx.fillStyle = '#374151';
            ctx.fillText(nr, s.x, s.y - 8);

            ctx.font = '400 10px "Noto Sans", sans-serif';
            ctx.fillStyle = '#6B7280';
            ctx.fillText(area + ' m²', s.x, s.y + 7);
        } else {
            // Just room number
            ctx.font = '500 9px "Noto Sans", sans-serif';
            ctx.fillStyle = '#374151';
            ctx.fillText(nr, s.x, s.y);
        }
    }

    /* ── Layer: Asset (Furniture) ──────────────────────────────────────── */

    _drawAsset(asset, isHovered, isSelected) {
        const ctx = this.ctx;
        const coords = asset.geometry.coordinates[0];

        // Convert to screen coords and get bounds
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const screenCoords = [];
        for (const [lon, lat] of coords) {
            const local = this.geoToLocal(lon, lat);
            const s = this.localToScreen(local.x, local.y);
            screenCoords.push(s);
            if (s.x < minX) minX = s.x;
            if (s.x > maxX) maxX = s.x;
            if (s.y < minY) minY = s.y;
            if (s.y > maxY) maxY = s.y;
        }

        const w = maxX - minX;
        const h = maxY - minY;
        if (w < 1.5 && h < 1.5) return; // too small

        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const shape = asset.properties._shape2d || this.assetShapes[asset.properties.categoryId] || 'rect';

        // Colors
        const fill = isSelected ? '#2563EB' : (isHovered ? '#475569' : '#64748B');
        const stroke = isSelected ? '#1D4ED8' : (isHovered ? '#334155' : '#475569');

        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = isSelected ? 1.5 : 0.75;

        if (shape === 'circle') {
            const r = Math.max(w, h) / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(r, 2), 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else if (shape === 'diamond') {
            ctx.beginPath();
            ctx.moveTo(cx, minY);
            ctx.lineTo(maxX, cy);
            ctx.lineTo(cx, maxY);
            ctx.lineTo(minX, cy);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else {
            // Rectangle / polygon
            ctx.beginPath();
            for (let i = 0; i < screenCoords.length; i++) {
                if (i === 0) ctx.moveTo(screenCoords[i].x, screenCoords[i].y);
                else ctx.lineTo(screenCoords[i].x, screenCoords[i].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        // Selection handles (view mode only — edit mode uses gizmo instead)
        if (isSelected && !this.editMode) {
            const hs = 4;
            ctx.fillStyle = '#2563EB';
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            for (const [hx, hy] of [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]) {
                ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
                ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
            }
        }

        // Asset label when zoomed in
        if (isSelected && this.zoom > 8) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.font = '500 9px "Noto Sans", sans-serif';
            ctx.fillStyle = '#1E40AF';
            ctx.fillText(asset.properties._name || asset.properties.name, cx, minY - 6);
        }
    }

    /* ── Layer: Measurement (multi-point polyline / polygon) ──────────── */

    _drawMeasure() {
        const ctx = this.ctx;
        const pts = this.measurePoints;
        if (pts.length === 0) return;

        // Convert all placed points to screen
        const screenPts = pts.map(p => this.localToScreen(p.x, p.y));

        // Add rubber-band cursor point if not closed
        const allScreen = [...screenPts];
        if (this.measureCursorPoint && !this.measureClosed) {
            allScreen.push(this.localToScreen(this.measureCursorPoint.x, this.measureCursorPoint.y));
        }

        // Filled polygon if closed
        if (this.measureClosed && screenPts.length >= 3) {
            ctx.beginPath();
            screenPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.closePath();
            ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
            ctx.fill();
        }

        // Dashed line segments
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        allScreen.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        if (this.measureClosed) ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        // Closing segment (from last real point back to first) if polygon
        if (this.measureClosed && screenPts.length >= 3) {
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(screenPts[screenPts.length - 1].x, screenPts[screenPts.length - 1].y);
            ctx.lineTo(screenPts[0].x, screenPts[0].y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Dots at placed points
        for (let i = 0; i < pts.length; i++) {
            const sp = screenPts[i];
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, i === 0 ? 5 : 4, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? '#1D4ED8' : '#2563EB';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Distance labels on each segment
        const allLocal = [...pts];
        if (this.measureCursorPoint && !this.measureClosed) allLocal.push(this.measureCursorPoint);

        for (let i = 0; i < allScreen.length - 1; i++) {
            const p1 = allLocal[i];
            const p2 = allLocal[i + 1];
            if (!p1 || !p2) continue;

            const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
            if (dist < 0.01) continue;
            const label = dist >= 1 ? dist.toFixed(2) + ' m' : (dist * 100).toFixed(0) + ' cm';
            const mx = (allScreen[i].x + allScreen[i + 1].x) / 2;
            const my = (allScreen[i].y + allScreen[i + 1].y) / 2;
            this._drawMeasureLabel(label, mx, my - 10);
        }

        // Closing segment label
        if (this.measureClosed && pts.length >= 3) {
            const pLast = pts[pts.length - 1], pFirst = pts[0];
            const dist = Math.sqrt((pFirst.x - pLast.x) ** 2 + (pFirst.y - pLast.y) ** 2);
            if (dist >= 0.01) {
                const label = dist >= 1 ? dist.toFixed(2) + ' m' : (dist * 100).toFixed(0) + ' cm';
                const sLast = screenPts[screenPts.length - 1], sFirst = screenPts[0];
                this._drawMeasureLabel(label, (sLast.x + sFirst.x) / 2, (sLast.y + sFirst.y) / 2 - 10);
            }
        }

        // Area label if closed polygon
        if (this.measureClosed && pts.length >= 3) {
            const area = this._computePolygonArea(pts);
            const label = area >= 1 ? area.toFixed(1) + ' m²' : (area * 10000).toFixed(0) + ' cm²';
            const centroid = this._computeCentroid(pts);
            const sc = this.localToScreen(centroid.x, centroid.y);
            this._drawMeasureLabel(label, sc.x, sc.y, true);
        }

        // Total polyline length label (when not closed and 2+ segments)
        if (!this.measureClosed && pts.length >= 3) {
            let total = 0;
            for (let i = 0; i < pts.length - 1; i++) {
                total += Math.sqrt((pts[i + 1].x - pts[i].x) ** 2 + (pts[i + 1].y - pts[i].y) ** 2);
            }
            const label = 'Gesamt: ' + (total >= 1 ? total.toFixed(2) + ' m' : (total * 100).toFixed(0) + ' cm');
            const lastSP = screenPts[screenPts.length - 1];
            this._drawMeasureLabel(label, lastSP.x, lastSP.y + 18);
        }
    }

    _drawMeasureLabel(text, x, y, isArea) {
        const ctx = this.ctx;
        ctx.font = (isArea ? '700' : '600') + ' 12px "Noto Sans", sans-serif';
        const metrics = ctx.measureText(text);
        const padX = 6, lw = metrics.width + padX * 2, lh = 18;

        ctx.fillStyle = isArea ? 'rgba(30, 64, 175, 0.92)' : 'rgba(37, 99, 235, 0.9)';
        ctx.beginPath();
        ctx.roundRect(x - lw / 2, y - lh / 2, lw, lh, 4);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
    }

    _computePolygonArea(points) {
        // Shoelace formula in local meters
        let area = 0;
        const n = points.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area) / 2;
    }

    _computeCentroid(points) {
        let cx = 0, cy = 0;
        for (const p of points) { cx += p.x; cy += p.y; }
        return { x: cx / points.length, y: cy / points.length };
    }

    /* ── Layer: Edit Mode Gizmo (move / rotate widget) ─────────────────── */

    _getAssetScreenCenter(asset) {
        const coords = asset.geometry.coordinates[0];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const [lon, lat] of coords) {
            const local = this.geoToLocal(lon, lat);
            const s = this.localToScreen(local.x, local.y);
            if (s.x < minX) minX = s.x;
            if (s.x > maxX) maxX = s.x;
            if (s.y < minY) minY = s.y;
            if (s.y > maxY) maxY = s.y;
        }
        return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, minX, maxX, minY, maxY };
    }

    _drawGizmo(asset) {
        const ctx = this.ctx;
        const { cx, cy } = this._getAssetScreenCenter(asset);

        const R = 55;          // outer circle radius (screen px)
        const ARROW = 42;      // arrow length from center
        const HEAD = 9;        // arrowhead size

        // Outer circle
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Blue arrow → right (X-axis)
        ctx.beginPath();
        ctx.moveTo(cx + 8, cy);
        ctx.lineTo(cx + ARROW, cy);
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // arrowhead
        ctx.beginPath();
        ctx.moveTo(cx + ARROW + HEAD, cy);
        ctx.lineTo(cx + ARROW, cy - HEAD * 0.55);
        ctx.lineTo(cx + ARROW, cy + HEAD * 0.55);
        ctx.closePath();
        ctx.fillStyle = '#3B82F6';
        ctx.fill();

        // Orange arrow ↑ up (Y-axis, negative screen Y)
        ctx.beginPath();
        ctx.moveTo(cx, cy - 8);
        ctx.lineTo(cx, cy - ARROW);
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // arrowhead
        ctx.beginPath();
        ctx.moveTo(cx, cy - ARROW - HEAD);
        ctx.lineTo(cx - HEAD * 0.55, cy - ARROW);
        ctx.lineTo(cx + HEAD * 0.55, cy - ARROW);
        ctx.closePath();
        ctx.fillStyle = '#F59E0B';
        ctx.fill();

        // Rotate handle – small circle with dot at top of ring
        ctx.beginPath();
        ctx.arc(cx, cy - R, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy - R, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = '#374151';
        ctx.fill();

        // Center move handle – circle with smaller circle inside
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    gizmoHitTest(sx, sy) {
        if (!this.editMode || !this.selectedAsset) return null;
        const { cx, cy } = this._getAssetScreenCenter(this.selectedAsset);
        const dist = Math.hypot(sx - cx, sy - cy);

        // Rotate handle at top of ring (generous 12px radius)
        if (Math.hypot(sx - cx, sy - (cy - 55)) < 12) return 'rotate';

        // Center handle (generous 14px radius)
        if (dist < 14) return 'center';

        // X-axis arrow (blue, right) — 14px wide hit band
        if (Math.abs(sy - cy) < 14 && sx > cx + 6 && sx < cx + 60) return 'x-axis';

        // Y-axis arrow (orange, up) — 14px wide hit band
        if (Math.abs(sx - cx) < 14 && sy < cy - 6 && sy > cy - 60) return 'y-axis';

        // Rotation ring (within 16px of circle edge at radius 55)
        if (Math.abs(dist - 55) < 16) return 'rotate';

        return null;
    }

    /* ── HUD: Scale Bar ────────────────────────────────────────────────── */

    _updateScaleBar() {
        const ppm = this.zoom;
        const targetPx = 100;
        const metersAtTarget = targetPx / ppm;
        const niceMeters = this._niceNumber(metersAtTarget);
        const barPx = niceMeters * ppm;

        const barEl = document.getElementById('scaleBarLine');
        const labelEl = document.getElementById('scaleBarLabel');
        if (barEl) barEl.style.width = barPx + 'px';
        if (labelEl) {
            labelEl.textContent = niceMeters >= 1
                ? niceMeters + ' m'
                : (niceMeters * 100).toFixed(0) + ' cm';
        }
    }

    _niceNumber(value) {
        if (value <= 0) return 1;
        const exp = Math.floor(Math.log10(value));
        const frac = value / Math.pow(10, exp);
        let nice;
        if (frac < 1.5) nice = 1;
        else if (frac < 3.5) nice = 2;
        else if (frac < 7.5) nice = 5;
        else nice = 10;
        return nice * Math.pow(10, exp);
    }

    /* ── Spatial Queries ─────────────────────────────────────────────────── */

    hitTest(screenX, screenY) {
        // Assets first (on top layer)
        for (let i = this.assets.length - 1; i >= 0; i--) {
            if (this._isPointInFeature(screenX, screenY, this.assets[i])) {
                return { type: 'asset', feature: this.assets[i] };
            }
        }
        // Then rooms
        for (let i = this.rooms.length - 1; i >= 0; i--) {
            if (this._isPointInFeature(screenX, screenY, this.rooms[i])) {
                return { type: 'room', feature: this.rooms[i] };
            }
        }
        return null;
    }

    _isPointInFeature(sx, sy, feature) {
        const coords = feature.geometry.coordinates[0];
        const pts = [];
        for (const [lon, lat] of coords) {
            const local = this.geoToLocal(lon, lat);
            pts.push(this.localToScreen(local.x, local.y));
        }
        return this._pointInPolygon(sx, sy, pts);
    }

    _pointInPolygon(px, py, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > py) !== (yj > py)) &&
                (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
}
