/* ==========================================================================
   editor.js – Floor Plan Editor Interaction & Tools

   Follows Archilogic's event-driven interaction pattern:
   - Mouse/touch event handling on canvas
   - Tool state management (select, pan, measure)
   - Pan & zoom (scroll wheel + drag)
   - Selection with click (not drag) semantics
   - Multi-point measurement tool (Google Earth style)
   - Move / rotate gizmo for edit mode
   - Keyboard shortcuts
   ========================================================================== */

class FloorPlanEditor {
    constructor(renderer) {
        this.renderer = renderer;
        this.canvas = renderer.canvas;

        /* ── Tool State ────────────────────────────────────────────────── */
        this.activeTool = 'select'; // 'select' | 'pan' | 'measure'

        /* ── Edit Mode ─────────────────────────────────────────────────── */
        this.editMode = false;

        /* ── Gizmo State ───────────────────────────────────────────────── */
        this.gizmoAction = null;       // 'x-axis' | 'y-axis' | 'center' | 'rotate' | null
        this.gizmoStartAngle = null;   // radians, for rotation

        /* ── Mouse State ───────────────────────────────────────────────── */
        this.isDragging = false;
        this.hasDragged = false;
        this.isPanning = false;
        this.dragStart = null;
        this.lastMouse = null;

        /* ── Drag Threshold ────────────────────────────────────────────── */
        this.DRAG_THRESHOLD = 4; // px

        this._bindEvents();
    }

    /* ── Edit Mode ──────────────────────────────────────────────────────── */

    setEditMode(editMode) {
        this.editMode = editMode;
        this.renderer.editMode = editMode;
        this.gizmoAction = null;
        this.renderer.draw();
    }

    /* ── Tool Switching ────────────────────────────────────────────────── */

    setTool(tool) {
        this.activeTool = tool;
        this.renderer.measurePoints = [];
        this.renderer.measureCursorPoint = null;
        this.renderer.measureClosed = false;
        this.renderer.draw();
        this._updateCursor();
    }

    _updateCursor(forceDefault) {
        if (forceDefault) {
            this.canvas.style.cursor = 'default';
            return;
        }
        switch (this.activeTool) {
            case 'pan':     this.canvas.style.cursor = 'grab'; break;
            case 'measure': this.canvas.style.cursor = 'crosshair'; break;
            case 'add':     this.canvas.style.cursor = 'copy'; break;
            default:        this.canvas.style.cursor = 'default';
        }
    }

    /* ── Event Binding ─────────────────────────────────────────────────── */

    _bindEvents() {
        this.canvas.addEventListener('mousedown',  this._onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove',  this._onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup',    this._onMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this._onMouseLeave.bind(this));
        this.canvas.addEventListener('wheel',      this._onWheel.bind(this), { passive: false });
        this.canvas.addEventListener('dblclick',   this._onDblClick.bind(this));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        this._boundKeyDown = this._onKeyDown.bind(this);
        document.addEventListener('keydown', this._boundKeyDown);
    }

    /* ── Mouse Helpers ─────────────────────────────────────────────────── */

    _getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    /* ── Gizmo Helpers ─────────────────────────────────────────────────── */

    _moveAssetByScreenDelta(dxScreen, dyScreen) {
        const asset = this.renderer.selectedAsset;
        if (!asset) return;
        const p = this.renderer.projection;

        // Screen delta → local meters
        const dxMeters = dxScreen / this.renderer.zoom;
        const dyMeters = dyScreen / this.renderer.zoom;

        // Local meters → lon/lat delta
        const dLon = dxMeters / p.metersPerDegreeLon;
        const dLat = -dyMeters / p.metersPerDegreeLat; // flip Y back

        // Update all polygon coordinates
        const coords = asset.geometry.coordinates[0];
        for (const coord of coords) {
            coord[0] += dLon;
            coord[1] += dLat;
        }

        // Update centroid if present
        if (asset.properties.centroid) {
            asset.properties.centroid[0] += dLon;
            asset.properties.centroid[1] += dLat;
        }
    }

    _rotateAsset(deltaRadians) {
        const asset = this.renderer.selectedAsset;
        if (!asset) return;
        const p = this.renderer.projection;

        // Compute centroid from polygon coords
        const coords = asset.geometry.coordinates[0];
        const n = coords.length - 1; // skip closing duplicate
        let cLon = 0, cLat = 0;
        for (let i = 0; i < n; i++) {
            cLon += coords[i][0];
            cLat += coords[i][1];
        }
        cLon /= n;
        cLat /= n;

        const cos = Math.cos(deltaRadians);
        const sin = Math.sin(deltaRadians);

        for (const coord of coords) {
            // Convert to meters, rotate, convert back (avoids skew from non-uniform lon/lat scale)
            const mx = (coord[0] - cLon) * p.metersPerDegreeLon;
            const my = (coord[1] - cLat) * p.metersPerDegreeLat;
            const rx = mx * cos - my * sin;
            const ry = mx * sin + my * cos;
            coord[0] = cLon + rx / p.metersPerDegreeLon;
            coord[1] = cLat + ry / p.metersPerDegreeLat;
        }

        // Update centroid property if present
        if (asset.properties.centroid) {
            asset.properties.centroid[0] = cLon;
            asset.properties.centroid[1] = cLat;
        }
    }

    /* ── Mouse Down ────────────────────────────────────────────────────── */

    _onMouseDown(e) {
        if (e.button !== 0 && e.button !== 1) return; // left or middle only

        const pos = this._getCanvasPos(e);

        // Gizmo interaction takes priority in edit mode
        if (e.button === 0 && this.editMode && this.activeTool === 'select' && this.renderer.selectedAsset) {
            const gizmoHit = this.renderer.gizmoHitTest(pos.x, pos.y);
            if (gizmoHit) {
                this.gizmoAction = gizmoHit;
                this.isDragging = true;
                this.hasDragged = false;
                this.dragStart = pos;
                this.lastMouse = pos;
                if (gizmoHit === 'rotate') {
                    const center = this.renderer._getAssetScreenCenter(this.renderer.selectedAsset);
                    this.gizmoStartAngle = Math.atan2(pos.y - center.cy, pos.x - center.cx);
                }
                return; // consume event
            }
        }

        this.isDragging = true;
        this.hasDragged = false;
        this.isPanning = false;
        this.dragStart = pos;
        this.lastMouse = pos;

        // Middle mouse always pans
        if (e.button === 1) {
            this.isPanning = true;
            this.canvas.style.cursor = 'grabbing';
            e.preventDefault();
            return;
        }

        if (this.activeTool === 'pan') {
            this.isPanning = true;
            this.canvas.style.cursor = 'grabbing';
        }
        // Measure tool: no mousedown action (click-based in mouseUp)
    }

    /* ── Mouse Move ────────────────────────────────────────────────────── */

    _onMouseMove(e) {
        const pos = this._getCanvasPos(e);

        // Gizmo dragging
        if (this.gizmoAction && this.isDragging) {
            const dx = pos.x - this.lastMouse.x;
            const dy = pos.y - this.lastMouse.y;
            this.hasDragged = true;

            if (this.gizmoAction === 'x-axis') {
                this._moveAssetByScreenDelta(dx, 0);
            } else if (this.gizmoAction === 'y-axis') {
                this._moveAssetByScreenDelta(0, dy);
            } else if (this.gizmoAction === 'center') {
                this._moveAssetByScreenDelta(dx, dy);
            } else if (this.gizmoAction === 'rotate') {
                const center = this.renderer._getAssetScreenCenter(this.renderer.selectedAsset);
                const angle = Math.atan2(pos.y - center.cy, pos.x - center.cx);
                // Negate delta: screen Y is flipped vs lat, so clockwise drag
                // on screen must produce clockwise visual rotation
                this._rotateAsset(-(angle - this.gizmoStartAngle));
                this.gizmoStartAngle = angle;
            }

            this.renderer.draw();
            this.lastMouse = pos;

            // Fire event for live property updates
            window.dispatchEvent(new CustomEvent('fp-asset-moved', {
                detail: this.renderer.selectedAsset
            }));
            return;
        }

        if (this.isDragging) {
            const dx = pos.x - this.lastMouse.x;
            const dy = pos.y - this.lastMouse.y;

            // Check if we've exceeded drag threshold
            if (!this.hasDragged) {
                const dist = Math.hypot(pos.x - this.dragStart.x, pos.y - this.dragStart.y);
                if (dist > this.DRAG_THRESHOLD) {
                    this.hasDragged = true;

                    // In select mode, drag always pans (click-without-drag = select)
                    if (this.activeTool === 'select' && !this.isPanning) {
                        this.isPanning = true;
                        this.canvas.style.cursor = 'grabbing';
                    }
                    // In measure mode, drag on empty space = pan
                    if (this.activeTool === 'measure' && !this.isPanning) {
                        this.isPanning = true;
                        this.canvas.style.cursor = 'grabbing';
                    }
                    // In add mode, drag on empty space = pan
                    if (this.activeTool === 'add' && !this.isPanning) {
                        this.isPanning = true;
                        this.canvas.style.cursor = 'grabbing';
                    }
                }
            }

            if (this.hasDragged) {
                if (this.isPanning) {
                    this.renderer.panX += dx;
                    this.renderer.panY += dy;
                    this.renderer.draw();
                }
            }
        } else {
            // Measure tool: rubber-band cursor line
            if (this.activeTool === 'measure' && this.renderer.measurePoints.length > 0 && !this.renderer.measureClosed) {
                const local = this.renderer.screenToLocal(pos.x, pos.y);
                this.renderer.measureCursorPoint = local;
                this.renderer.draw();
            }

            // Hover detection
            const hit = this.renderer.hitTest(pos.x, pos.y);
            const prevRoom = this.renderer.hoveredRoom;
            const prevAsset = this.renderer.hoveredAsset;

            this.renderer.hoveredRoom = (hit && hit.type === 'room') ? hit.feature : null;
            this.renderer.hoveredAsset = (hit && hit.type === 'asset') ? hit.feature : null;

            if (this.renderer.hoveredRoom !== prevRoom || this.renderer.hoveredAsset !== prevAsset) {
                this.renderer.draw();
            }

            // Cursor logic
            if (this.editMode && this.renderer.selectedAsset) {
                const gizmoHit = this.renderer.gizmoHitTest(pos.x, pos.y);
                if (gizmoHit === 'x-axis')  { this.canvas.style.cursor = 'ew-resize'; }
                else if (gizmoHit === 'y-axis')  { this.canvas.style.cursor = 'ns-resize'; }
                else if (gizmoHit === 'center')  { this.canvas.style.cursor = 'move'; }
                else if (gizmoHit === 'rotate')  { this.canvas.style.cursor = 'grab'; }
                else if (this.activeTool === 'select') {
                    this.canvas.style.cursor = hit ? 'pointer' : 'default';
                }
            } else if (this.activeTool === 'select') {
                this.canvas.style.cursor = hit ? 'pointer' : 'default';
            }
        }

        this.lastMouse = pos;
    }

    /* ── Mouse Up ──────────────────────────────────────────────────────── */

    _onMouseUp(e) {
        const pos = this._getCanvasPos(e);

        // Gizmo drag end
        if (this.gizmoAction) {
            this.gizmoAction = null;
            this.gizmoStartAngle = null;
            this.isDragging = false;
            this.hasDragged = false;
            return;
        }

        if (this.isDragging && !this.hasDragged) {
            // This was a click (not a drag)
            if (this.activeTool === 'select') {
                const hit = this.renderer.hitTest(pos.x, pos.y);
                if (hit) {
                    if (hit.type === 'room') {
                        this.renderer.selectedRoom = hit.feature;
                        this.renderer.selectedAsset = null;
                    } else if (hit.type === 'asset') {
                        this.renderer.selectedAsset = hit.feature;
                        this.renderer.selectedRoom = null;
                    }
                } else {
                    this.renderer.selectedRoom = null;
                    this.renderer.selectedAsset = null;
                }
                this.renderer.draw();

                // Fire selection event
                window.dispatchEvent(new CustomEvent('fp-selection-change', {
                    detail: hit
                }));
            } else if (this.activeTool === 'add') {
                // Place furniture at click position
                const p = this.renderer.projection;
                if (p) {
                    const local = this.renderer.screenToLocal(pos.x, pos.y);
                    const lon = local.x / p.metersPerDegreeLon + p.centerLon;
                    const lat = -local.y / p.metersPerDegreeLat + p.centerLat;
                    window.dispatchEvent(new CustomEvent('fp-asset-placed', {
                        detail: { lon, lat }
                    }));
                }
            } else if (this.activeTool === 'measure') {
                // Multi-point measure: click adds a point
                if (this.renderer.measureClosed) {
                    // Already closed — start fresh
                    this.renderer.measurePoints = [];
                    this.renderer.measureClosed = false;
                }

                const local = this.renderer.screenToLocal(pos.x, pos.y);
                const pts = this.renderer.measurePoints;

                // Check close polygon (click near first point, 3+ points)
                if (pts.length >= 3) {
                    const firstScreen = this.renderer.localToScreen(pts[0].x, pts[0].y);
                    const dist = Math.hypot(pos.x - firstScreen.x, pos.y - firstScreen.y);
                    if (dist < 14) {
                        this.renderer.measureClosed = true;
                        this.renderer.measureCursorPoint = null;
                        this.renderer.draw();
                        this.isDragging = false;
                        this.hasDragged = false;
                        this.isPanning = false;
                        return;
                    }
                }

                // Add new point
                pts.push(local);
                this.renderer.draw();
            }
        }

        this.isDragging = false;
        this.hasDragged = false;
        this.isPanning = false;
        this._updateCursor();
    }

    /* ── Mouse Leave ───────────────────────────────────────────────────── */

    _onMouseLeave() {
        if (this.renderer.hoveredRoom || this.renderer.hoveredAsset) {
            this.renderer.hoveredRoom = null;
            this.renderer.hoveredAsset = null;
            this.renderer.draw();
        }
        this.isDragging = false;
        this.hasDragged = false;
        this.isPanning = false;
        this.gizmoAction = null;
    }

    destroy() {
        document.removeEventListener('keydown', this._boundKeyDown);
    }

    /* ── Mouse Wheel (Zoom) ────────────────────────────────────────────── */

    _onWheel(e) {
        e.preventDefault();

        const pos = this._getCanvasPos(e);
        const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        let newZoom = Math.max(0.3, Math.min(150, this.renderer.zoom * zoomFactor));

        // No change after clamping
        if (Math.abs(newZoom - this.renderer.zoom) < 1e-9) return;

        // Zoom towards cursor
        const ratio = newZoom / this.renderer.zoom;
        const cx = this.renderer.displayWidth / 2;
        const cy = this.renderer.displayHeight / 2;

        this.renderer.panX = (1 - ratio) * (pos.x - cx) + ratio * this.renderer.panX;
        this.renderer.panY = (1 - ratio) * (pos.y - cy) + ratio * this.renderer.panY;
        this.renderer.zoom = newZoom;

        this.renderer.draw();
    }

    /* ── Double Click ──────────────────────────────────────────────────── */

    _onDblClick(e) {
        const pos = this._getCanvasPos(e);

        // In measure mode, double-click finalizes the polyline
        if (this.activeTool === 'measure' && this.renderer.measurePoints.length >= 2) {
            // Remove the point that was just added by the second click of dblclick
            if (this.renderer.measurePoints.length > 2) {
                this.renderer.measurePoints.pop();
            }
            this.renderer.measureCursorPoint = null;
            this.renderer.draw();
            return;
        }

        const hit = this.renderer.hitTest(pos.x, pos.y);

        if (hit && hit.type === 'room') {
            this.renderer.selectedRoom = hit.feature;
            this.renderer.selectedAsset = null;
            this.renderer.zoomToFeature(hit.feature);

            window.dispatchEvent(new CustomEvent('fp-selection-change', {
                detail: hit
            }));
        }
    }

    /* ── Keyboard Shortcuts ────────────────────────────────────────────── */

    _onKeyDown(e) {
        // Don't capture if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        // Don't capture when in 3D/walk view mode (avoids conflicts with walk WASD)
        if (typeof state !== 'undefined' && state.viewMode && state.viewMode !== '2d') return;

        switch (e.key) {
            case 'Escape':
                // Clear measure first if active
                if (this.renderer.measurePoints.length > 0) {
                    this.renderer.measurePoints = [];
                    this.renderer.measureCursorPoint = null;
                    this.renderer.measureClosed = false;
                    this.renderer.draw();
                    return;
                }
                this.renderer.selectedRoom = null;
                this.renderer.selectedAsset = null;
                this.renderer.draw();
                window.dispatchEvent(new CustomEvent('fp-selection-change', { detail: null }));
                break;

            case 'Backspace': case 'Delete':
                // Remove last measure point
                if (this.activeTool === 'measure' && this.renderer.measurePoints.length > 0 && !this.renderer.measureClosed) {
                    this.renderer.measurePoints.pop();
                    this.renderer.draw();
                }
                break;

            case 'v': case 'V':
                if (!e.ctrlKey && !e.metaKey) {
                    this._switchToolButton('select');
                }
                break;

            case 'h': case 'H':
                if (!e.ctrlKey && !e.metaKey) {
                    this._switchToolButton('pan');
                }
                break;

            case 'm': case 'M':
                if (!e.ctrlKey && !e.metaKey) {
                    this._switchToolButton('measure');
                }
                break;

            case 'f': case 'F':
                if (!e.ctrlKey && !e.metaKey) {
                    this.renderer.fitView();
                }
                break;

            case '+': case '=':
                this.zoomIn();
                break;

            case '-':
                if (!e.ctrlKey && !e.metaKey) {
                    this.zoomOut();
                }
                break;
        }
    }

    /* ── Programmatic Zoom ─────────────────────────────────────────────── */

    zoomIn() {
        const newZoom = this.renderer.zoom * 1.3;
        if (newZoom > 150) return;
        this.renderer.zoom = newZoom;
        this.renderer.draw();
    }

    zoomOut() {
        const newZoom = this.renderer.zoom / 1.3;
        if (newZoom < 0.3) return;
        this.renderer.zoom = newZoom;
        this.renderer.draw();
    }

    /* ── Helper: Sync toolbar UI ───────────────────────────────────────── */

    _switchToolButton(tool) {
        this.setTool(tool);
        document.querySelectorAll('.fp-toolbar__btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
    }
}
