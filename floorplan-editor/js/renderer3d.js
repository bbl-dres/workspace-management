/* ==========================================================================
   renderer3d.js – Three.js 3D Floor Plan Renderer

   Provides 3D orbit and first-person walk views of floor plan data.
   Consumes the same GeoJSON data as the 2D FloorPlanRenderer.
   ========================================================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class FloorPlan3DRenderer {

    constructor(containerEl) {
        this.container = containerEl;

        /* ── Three.js core ─────────────────────────────────────────────── */
        this.scene = null;
        this.rendererGL = null;
        this.camera = null;
        this.orbitCamera = null;
        this.walkCamera = null;

        /* ── Controls ──────────────────────────────────────────────────── */
        this.orbitControls = null;
        this.walkKeys = { forward: false, backward: false, left: false, right: false };
        this._walkLookActive = false;
        this._walkEuler = { yaw: 0, pitch: 0 };
        this._walkLastMouse = { x: 0, y: 0 };

        /* ── Mode ──────────────────────────────────────────────────────── */
        this.mode = 'orbit'; // 'orbit' | 'walk'

        /* ── Data ──────────────────────────────────────────────────────── */
        this.rooms = [];
        this.assets = [];
        this.floorOutline = null;
        this.projection = null;

        /* ── Color Schemes (reference to 2D renderer's schemes) ──────── */
        this.colorSchemes = null;
        this.activeSchemeId = 'none';
        this.neutralColor = { fill: '#FFFFFF', stroke: '#000000' };

        /* ── Scene object tracking ─────────────────────────────────────── */
        this.roomMeshes = [];   // { mesh, feature }
        this.wallMeshes = [];   // { mesh (LineLoop), feature }
        this.assetMeshes = [];  // { mesh, feature }
        this.floorMesh = null;

        /* ── Selection ─────────────────────────────────────────────────── */
        this.selectedRoom = null;
        this.selectedAsset = null;

        /* ── Edit Mode & Gizmo ────────────────────────────────────────── */
        this.editMode = false;
        this._gizmoGroup = null;
        this._gizmoAction = null;      // 'x-axis' | 'z-axis' | 'center' | 'rotate' | null
        this._gizmoStartAngle = null;
        this._gizmoDragPlane = null;    // Invisible horizontal plane for raycasting
        this._gizmoDragStart = null;    // THREE.Vector3
        this._gizmoJustReleased = false;

        /* ── Tools ────────────────────────────────────────────────────── */
        this.activeTool = 'select'; // 'select' | 'measure' | 'add'

        /* ── Measure ──────────────────────────────────────────────────── */
        this.measurePoints = [];       // Array of THREE.Vector3
        this._measureGroup = null;
        this._measureRubberLine = null;
        this._measureLabelEls = [];
        this._measureClosed = false;

        /* ── Furniture Placement (mockup) ─────────────────────────────── */
        this._placedMockups = [];      // Array of THREE.Mesh
        this._ghostMesh = null;

        /* ── Raycaster ─────────────────────────────────────────────────── */
        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();
        this._mouseDownPos = null;

        /* ── Animation ─────────────────────────────────────────────────── */
        this._animationId = null;
        this._clock = new THREE.Clock(false);

        /* ── Resize ────────────────────────────────────────────────────── */
        this._resizeObserver = null;

        /* ── Bound handlers (for cleanup) ──────────────────────────────── */
        this._boundOnClick = this._onMouseClick.bind(this);
        this._boundKeyDown = this._onKeyDown.bind(this);
        this._boundKeyUp = this._onKeyUp.bind(this);
        this._boundMouseDown = this._onMouseDown.bind(this);
        this._boundMouseMove = this._onMouseMove.bind(this);
        this._boundMouseUp = this._onMouseUp.bind(this);
    }

    /* ==================================================================
       Lifecycle
       ================================================================== */

    init() {
        // WebGL renderer
        this.rendererGL = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.rendererGL.setPixelRatio(window.devicePixelRatio);
        this.rendererGL.setClearColor(0xECEEF1);
        this.rendererGL.shadowMap.enabled = true;
        this.rendererGL.shadowMap.type = THREE.PCFSoftShadowMap;

        const rect = this.container.getBoundingClientRect();
        this.rendererGL.setSize(rect.width, rect.height);

        // Style + attach canvas
        const canvas = this.rendererGL.domElement;
        canvas.id = 'floorplan3d';
        canvas.style.display = 'none';
        canvas.style.position = 'absolute';
        canvas.style.inset = '0';
        this.container.appendChild(canvas);

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xECEEF1);

        // Measure overlay group
        this._measureGroup = new THREE.Group();
        this.scene.add(this._measureGroup);

        // Cameras
        const w = rect.width || 1;
        const h = rect.height || 1;
        this._initOrbitCamera(w, h);
        this._initWalkCamera(w, h);
        this.camera = this.orbitCamera;

        // Lighting
        this._buildLighting();

        // Events
        canvas.addEventListener('click', this._boundOnClick);
        canvas.addEventListener('mousedown', this._boundMouseDown);
        document.addEventListener('mousemove', this._boundMouseMove);
        document.addEventListener('mouseup', this._boundMouseUp);
        document.addEventListener('keydown', this._boundKeyDown);
        document.addEventListener('keyup', this._boundKeyUp);

        // Resize
        this._resizeObserver = new ResizeObserver(() => this._handleResize());
        this._resizeObserver.observe(this.container);
    }

    destroy() {
        this.stopAnimationLoop();
        this._clearMeasure();
        this.clearMockups();
        this._removeGhost();
        this._removeGizmo();
        if (this._resizeObserver) this._resizeObserver.disconnect();
        if (this.orbitControls) this.orbitControls.dispose();
        const canvas = this.rendererGL.domElement;
        canvas.removeEventListener('click', this._boundOnClick);
        canvas.removeEventListener('mousedown', this._boundMouseDown);
        document.removeEventListener('mousemove', this._boundMouseMove);
        document.removeEventListener('mouseup', this._boundMouseUp);
        document.removeEventListener('keydown', this._boundKeyDown);
        document.removeEventListener('keyup', this._boundKeyUp);
        this.rendererGL.dispose();
        if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    }

    /* ==================================================================
       Data
       ================================================================== */

    setData(rooms, assets, floorFeature) {
        this.rooms = rooms || [];
        this.assets = assets || [];
        this.floorOutline = floorFeature || null;
        this._calculateProjection();
        this._clearScene();
        this._buildScene();
    }

    setColorSchemes(schemes) {
        this.colorSchemes = schemes;
    }

    setColorScheme(schemeId) {
        this.activeSchemeId = schemeId;
        this._updateRoomColors();
    }

    /* ==================================================================
       Projection (mirrors 2D renderer formula)
       ================================================================== */

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
            centerLon, centerLat,
            metersPerDegreeLon, metersPerDegreeLat,
            widthMeters: (maxLon - minLon) * metersPerDegreeLon,
            heightMeters: (maxLat - minLat) * metersPerDegreeLat,
        };
    }

    /** Convert WGS84 lon/lat to Three.js world coords (X right, Z north, Y up) */
    _geoTo3D(lon, lat) {
        const p = this.projection;
        return {
            x: (lon - p.centerLon) * p.metersPerDegreeLon,
            z: (lat - p.centerLat) * p.metersPerDegreeLat,
        };
    }

    /** Convert a GeoJSON coordinate ring to a THREE.Shape (in XZ plane) */
    _coordsToShape(geoCoords) {
        const shape = new THREE.Shape();
        for (let i = 0; i < geoCoords.length; i++) {
            const p = this._geoTo3D(geoCoords[i][0], geoCoords[i][1]);
            if (i === 0) shape.moveTo(p.x, p.z);
            else shape.lineTo(p.x, p.z);
        }
        return shape;
    }

    /* ==================================================================
       Color Helpers
       ================================================================== */

    _getColorForRoom(room) {
        if (!this.colorSchemes) return this.neutralColor;
        const scheme = this.colorSchemes[this.activeSchemeId];
        if (!scheme || !Object.keys(scheme.categories).length) return this.neutralColor;
        const key = scheme.mapRoom(room);
        if (!key) return this.neutralColor;
        return scheme.categories[key] || this.neutralColor;
    }

    _updateRoomColors() {
        for (const { mesh, feature } of this.roomMeshes) {
            const colors = this._getColorForRoom(feature);
            mesh.material.color.set(colors.fill);
        }
        for (const { mesh, feature } of this.wallMeshes) {
            const colors = this._getColorForRoom(feature);
            mesh.material.color.set(colors.stroke);
        }
    }

    /* ==================================================================
       Scene Construction
       ================================================================== */

    _clearScene() {
        const dispose = (arr) => {
            for (const { mesh } of arr) {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
                else mesh.material.dispose();
            }
        };
        dispose(this.roomMeshes);
        dispose(this.wallMeshes);
        dispose(this.assetMeshes);
        if (this.floorMesh) {
            this.scene.remove(this.floorMesh);
            this.floorMesh.geometry.dispose();
            this.floorMesh.material.dispose();
            this.floorMesh = null;
        }
        this.roomMeshes = [];
        this.wallMeshes = [];
        this.assetMeshes = [];
        this._clearMeasure();
        this.clearMockups();
        this._removeGhost();
        this._removeGizmo();
    }

    _buildScene() {
        if (!this.projection) return;
        this._buildFloorPlane();
        this._buildRoomFloors();
        this._buildRoomOutlines();
        this._buildFurniture();
        this.fitViewOrbit();
    }

    _buildFloorPlane() {
        if (!this.floorOutline) return;
        const coords = this.floorOutline.geometry.coordinates[0];
        const shape = this._coordsToShape(coords);
        const geometry = new THREE.ShapeGeometry(shape);
        geometry.rotateX(-Math.PI / 2);

        const material = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            side: THREE.DoubleSide,
            roughness: 0.9,
            metalness: 0.0,
        });

        this.floorMesh = new THREE.Mesh(geometry, material);
        this.floorMesh.receiveShadow = true;
        this.floorMesh.position.y = 0.001;
        this.scene.add(this.floorMesh);
    }

    _buildRoomFloors() {
        for (const room of this.rooms) {
            const coords = room.geometry.coordinates[0];
            const shape = this._coordsToShape(coords);
            const geometry = new THREE.ShapeGeometry(shape);
            geometry.rotateX(-Math.PI / 2);

            const colors = this._getColorForRoom(room);
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(colors.fill),
                side: THREE.DoubleSide,
                roughness: 0.8,
                metalness: 0.0,
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 0.002;
            mesh.receiveShadow = true;
            mesh.userData = { type: 'room', feature: room };
            this.scene.add(mesh);
            this.roomMeshes.push({ mesh, feature: room });
        }
    }

    _buildRoomOutlines() {
        for (const room of this.rooms) {
            const coords = room.geometry.coordinates[0];
            const colors = this._getColorForRoom(room);

            // Build a line loop for the room outline on the floor
            const points = [];
            for (let i = 0; i < coords.length; i++) {
                const p = this._geoTo3D(coords[i][0], coords[i][1]);
                points.push(new THREE.Vector3(p.x, 0.005, -p.z));
            }

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: new THREE.Color(colors.stroke),
                linewidth: 1,
            });

            const line = new THREE.LineLoop(geometry, material);
            line.userData = { type: 'wall', feature: room };
            this.scene.add(line);
            this.wallMeshes.push({ mesh: line, feature: room });
        }
    }

    _buildSingleAsset(asset) {
        const coords = asset.geometry.coordinates[0];
        const shape = this._coordsToShape(coords);

        const furnitureHeight = Math.max(
            (asset.properties.topHeight || 0) - (asset.properties.baseHeight || 0),
            0.1
        );

        const geometry = new THREE.ExtrudeGeometry(shape, {
            steps: 1,
            depth: furnitureHeight,
            bevelEnabled: false,
        });
        geometry.rotateX(-Math.PI / 2);

        const cat = asset.properties.categoryId;
        const isChair = ['buerostuehle', 'konferenzstuehle', 'besucherstuehle'].includes(cat);
        const isLamp = cat === 'stehleuchten';

        const material = new THREE.MeshStandardMaterial({
            color: isLamp ? 0x94A3B8 : (isChair ? 0x64748B : 0x475569),
            roughness: 0.7,
            metalness: 0.2,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = 0;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { type: 'asset', feature: asset };
        return { mesh, feature: asset };
    }

    _buildFurniture() {
        for (const asset of this.assets) {
            const entry = this._buildSingleAsset(asset);
            this.scene.add(entry.mesh);
            this.assetMeshes.push(entry);
        }
    }

    /* ==================================================================
       Lighting
       ================================================================== */

    _buildLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(20, 30, 10);
        directional.castShadow = true;
        directional.shadow.mapSize.width = 2048;
        directional.shadow.mapSize.height = 2048;
        directional.shadow.camera.near = 0.5;
        directional.shadow.camera.far = 200;
        directional.shadow.camera.left = -60;
        directional.shadow.camera.right = 60;
        directional.shadow.camera.top = 60;
        directional.shadow.camera.bottom = -60;
        this.scene.add(directional);

        const hemisphere = new THREE.HemisphereLight(0xddeeff, 0xf5f0e0, 0.3);
        this.scene.add(hemisphere);
    }

    /* ==================================================================
       Cameras
       ================================================================== */

    _initOrbitCamera(w, h) {
        this.orbitCamera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500);
        this.orbitCamera.position.set(30, 25, 30);
        this.orbitCamera.lookAt(0, 0, 0);

        this.orbitControls = new OrbitControls(this.orbitCamera, this.rendererGL.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.08;
        this.orbitControls.minDistance = 3;
        this.orbitControls.maxDistance = 200;
        this.orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
        this.orbitControls.target.set(0, 0, 0);
    }

    _initWalkCamera(w, h) {
        this.walkCamera = new THREE.PerspectiveCamera(65, w / h, 0.1, 500);
        this.walkCamera.position.set(0, 1.6, 0);
        this.walkCamera.rotation.order = 'YXZ';
    }

    fitViewOrbit() {
        if (!this.projection) return;
        const w = this.projection.widthMeters;
        const h = this.projection.heightMeters;
        const maxDim = Math.max(w, h);
        const distance = maxDim * 1.0;

        this.orbitCamera.position.set(distance * 0.6, distance * 0.5, distance * 0.6);
        this.orbitControls.target.set(0, 0, 0);
        this.orbitControls.update();
    }

    /** Smoothly zoom orbit camera to focus on a GeoJSON feature */
    zoomToFeature(feature) {
        if (!this.projection || !feature) return;
        const coords = feature.geometry.coordinates[0];

        // Calculate bounding box in 3D world coords
        // Note: _coordsToShape + rotateX(-PI/2) negates Z, so use -p.z here
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const [lon, lat] of coords) {
            const p = this._geoTo3D(lon, lat);
            const z = -p.z;
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
        }

        const cx = (minX + maxX) / 2;
        const cz = (minZ + maxZ) / 2;
        const sizeX = maxX - minX;
        const sizeZ = maxZ - minZ;
        const maxSize = Math.max(sizeX, sizeZ, 1);

        // Distance that keeps the feature nicely framed
        const distance = maxSize * 2.5;

        // Animate camera to look at feature center from above-right
        this.orbitControls.target.set(cx, 0, cz);
        this.orbitCamera.position.set(cx + distance * 0.5, distance * 0.6, cz + distance * 0.5);
        this.orbitControls.update();
    }

    /* ==================================================================
       Mode Switching
       ================================================================== */

    setMode(mode) {
        this.mode = mode;

        if (mode === 'orbit') {
            this.camera = this.orbitCamera;
            this.orbitControls.enabled = true;
            this._walkLookActive = false;
        } else if (mode === 'walk') {
            // Place walk camera at center of floor, eye height
            this.walkCamera.position.set(0, 1.6, 0);
            this._walkEuler.yaw = 0;
            this._walkEuler.pitch = 0;
            this.walkCamera.rotation.set(0, 0, 0);
            this.camera = this.walkCamera;
            this.orbitControls.enabled = false;
            this.walkKeys = { forward: false, backward: false, left: false, right: false };
            this._walkLookActive = false;
        }
    }

    /* ==================================================================
       Selection / Raycasting
       ================================================================== */

    _onMouseClick(event) {
        if (this.mode === 'walk') return;
        if (this._gizmoJustReleased) return;

        // Ignore clicks that were actually drags (orbit rotation)
        if (this._mouseDownPos) {
            const d = Math.hypot(event.clientX - this._mouseDownPos.x, event.clientY - this._mouseDownPos.y);
            if (d > 5) return;
        }

        // Route to active tool handler
        if (this.activeTool === 'measure') { this._onMeasureClick(event); return; }
        if (this.activeTool === 'add')     { this._onAddClick(event); return; }

        // ── Select tool ──
        const rect = this.rendererGL.domElement.getBoundingClientRect();
        this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this._raycaster.setFromCamera(this._mouse, this.camera);

        // Skip selection if click was on gizmo
        if (this._gizmoGroup) {
            const gizmoChildren = [];
            this._gizmoGroup.traverse(child => { if (child.isMesh) gizmoChildren.push(child); });
            if (this._raycaster.intersectObjects(gizmoChildren).length > 0) return;
        }

        const assetObjs = this.assetMeshes.map(m => m.mesh);
        const roomObjs = this.roomMeshes.map(m => m.mesh);
        const wallObjs = this.wallMeshes.map(m => m.mesh);

        let hit = null;
        const assetHits = this._raycaster.intersectObjects(assetObjs);
        if (assetHits.length > 0) {
            const feature = assetHits[0].object.userData.feature;
            hit = { type: 'asset', feature };
            this.selectedAsset = feature;
            this.selectedRoom = null;
        } else {
            const roomHits = this._raycaster.intersectObjects([...roomObjs, ...wallObjs]);
            if (roomHits.length > 0) {
                const feature = roomHits[0].object.userData.feature;
                hit = { type: 'room', feature };
                this.selectedRoom = feature;
                this.selectedAsset = null;
            } else {
                this.selectedRoom = null;
                this.selectedAsset = null;
            }
        }

        this._applySelectionHighlight();
        window.dispatchEvent(new CustomEvent('fp-selection-change', { detail: hit }));
    }

    selectRoom(roomFeature) {
        this.selectedRoom = roomFeature;
        this.selectedAsset = null;
        this._applySelectionHighlight();
    }

    selectAsset(assetFeature) {
        this.selectedAsset = assetFeature;
        this.selectedRoom = null;
        this._applySelectionHighlight();
    }

    clearSelection() {
        this.selectedRoom = null;
        this.selectedAsset = null;
        this._applySelectionHighlight();
    }

    _applySelectionHighlight() {
        // Reset rooms
        for (const { mesh, feature } of this.roomMeshes) {
            const colors = this._getColorForRoom(feature);
            mesh.material.color.set(colors.fill);
            mesh.material.emissive.setHex(0x000000);
        }
        // Reset wall outlines (LineBasicMaterial — no emissive)
        for (const { mesh, feature } of this.wallMeshes) {
            const colors = this._getColorForRoom(feature);
            mesh.material.color.set(colors.stroke);
        }
        // Reset assets
        for (const { mesh } of this.assetMeshes) {
            mesh.material.emissive.setHex(0x000000);
        }

        if (this.selectedRoom) {
            for (const { mesh, feature } of this.roomMeshes) {
                if (feature === this.selectedRoom) {
                    mesh.material.emissive.set(0x2563EB);
                    mesh.material.emissiveIntensity = 0.3;
                }
            }
            for (const { mesh, feature } of this.wallMeshes) {
                if (feature === this.selectedRoom) {
                    mesh.material.color.set(0x2563EB);
                }
            }
        }

        if (this.selectedAsset) {
            for (const { mesh, feature } of this.assetMeshes) {
                if (feature === this.selectedAsset) {
                    mesh.material.emissive.set(0x2563EB);
                    mesh.material.emissiveIntensity = 0.5;
                }
            }
        }

        // Show/hide gizmo based on edit mode + selection
        if (this.editMode && this.selectedAsset && this.activeTool === 'select') {
            this._buildGizmo();
        } else {
            this._removeGizmo();
        }
    }

    /* ==================================================================
       Edit Mode
       ================================================================== */

    setEditMode(editMode) {
        this.editMode = editMode;
        if (!editMode) {
            this._removeGizmo();
        } else if (this.selectedAsset && this.activeTool === 'select') {
            this._buildGizmo();
        }
    }

    /* ==================================================================
       3D Gizmo (Move / Rotate)
       ================================================================== */

    _getAssetCentroid3D(asset) {
        const coords = asset.geometry.coordinates[0];
        const n = coords.length - 1; // skip closing duplicate
        let cLon = 0, cLat = 0;
        for (let i = 0; i < n; i++) {
            cLon += coords[i][0];
            cLat += coords[i][1];
        }
        cLon /= n;
        cLat /= n;
        const p = this._geoTo3D(cLon, cLat);
        // Note: _coordsToShape uses (p.x, p.z), then rotateX(-PI/2) maps to (x, 0, -z)
        return new THREE.Vector3(p.x, 0.005, -p.z);
    }

    _buildGizmo() {
        this._removeGizmo();
        if (!this.selectedAsset) return;

        const center = this._getAssetCentroid3D(this.selectedAsset);
        const group = new THREE.Group();
        group.position.copy(center);

        const RING_R = 0.5;
        const ARROW_LEN = 0.35;
        const CONE_R = 0.03;
        const CONE_H = 0.08;
        const CENTER_R = 0.06;

        // Shared materials (unlit, always-on-top)
        const makeMat = (color) => new THREE.MeshBasicMaterial({
            color, depthTest: false, transparent: true, opacity: 0.9,
        });
        const xColor = 0x3B82F6;  // blue
        const zColor = 0xF59E0B;  // orange
        const ringColor = 0x374151; // dark gray
        const whiteColor = 0xFFFFFF;

        // ── Outer ring (rotation handle) ──
        const ringGeo = new THREE.RingGeometry(RING_R - 0.025, RING_R + 0.025, 48);
        const ringMat = makeMat(ringColor);
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2; // lay flat
        ring.renderOrder = 999;
        ring.userData.gizmoAction = 'rotate';
        group.add(ring);

        // ── X-axis arrow (blue, pointing +X) ──
        // Shaft
        const xShaftGeo = new THREE.CylinderGeometry(0.015, 0.015, ARROW_LEN, 8);
        const xShaftMat = makeMat(xColor);
        const xShaft = new THREE.Mesh(xShaftGeo, xShaftMat);
        xShaft.rotation.z = -Math.PI / 2; // rotate cylinder to point along X
        xShaft.position.set(ARROW_LEN / 2 + 0.06, 0, 0);
        xShaft.renderOrder = 999;
        xShaft.userData.gizmoAction = 'x-axis';
        group.add(xShaft);
        // Cone (arrowhead)
        const xConeGeo = new THREE.ConeGeometry(CONE_R, CONE_H, 8);
        const xConeMat = makeMat(xColor);
        const xCone = new THREE.Mesh(xConeGeo, xConeMat);
        xCone.rotation.z = -Math.PI / 2;
        xCone.position.set(ARROW_LEN + 0.06 + CONE_H / 2, 0, 0);
        xCone.renderOrder = 999;
        xCone.userData.gizmoAction = 'x-axis';
        group.add(xCone);

        // ── Z-axis arrow (orange, pointing +Z) ──
        const zShaftGeo = new THREE.CylinderGeometry(0.015, 0.015, ARROW_LEN, 8);
        const zShaftMat = makeMat(zColor);
        const zShaft = new THREE.Mesh(zShaftGeo, zShaftMat);
        zShaft.rotation.x = Math.PI / 2; // rotate cylinder to point along Z
        zShaft.position.set(0, 0, ARROW_LEN / 2 + 0.06);
        zShaft.renderOrder = 999;
        zShaft.userData.gizmoAction = 'z-axis';
        group.add(zShaft);
        const zConeGeo = new THREE.ConeGeometry(CONE_R, CONE_H, 8);
        const zConeMat = makeMat(zColor);
        const zCone = new THREE.Mesh(zConeGeo, zConeMat);
        zCone.rotation.x = Math.PI / 2;
        zCone.position.set(0, 0, ARROW_LEN + 0.06 + CONE_H / 2);
        zCone.renderOrder = 999;
        zCone.userData.gizmoAction = 'z-axis';
        group.add(zCone);

        // ── Center handle (white sphere) ──
        const centerGeo = new THREE.SphereGeometry(CENTER_R, 16, 16);
        const centerMat = makeMat(whiteColor);
        centerMat.opacity = 1;
        const centerHandle = new THREE.Mesh(centerGeo, centerMat);
        centerHandle.renderOrder = 999;
        centerHandle.userData.gizmoAction = 'center';
        group.add(centerHandle);

        // ── Rotate handle (small white sphere at +Z edge of ring) ──
        const rotHandleGeo = new THREE.SphereGeometry(0.04, 12, 12);
        const rotHandleMat = makeMat(whiteColor);
        rotHandleMat.opacity = 1;
        const rotHandle = new THREE.Mesh(rotHandleGeo, rotHandleMat);
        rotHandle.position.set(0, 0, RING_R);
        rotHandle.renderOrder = 999;
        rotHandle.userData.gizmoAction = 'rotate';
        group.add(rotHandle);

        this._gizmoGroup = group;
        this.scene.add(group);
    }

    _removeGizmo() {
        if (!this._gizmoGroup) return;
        this._gizmoGroup.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        this.scene.remove(this._gizmoGroup);
        this._gizmoGroup = null;
    }

    _updateGizmoPosition() {
        if (!this._gizmoGroup || !this.selectedAsset) return;
        const center = this._getAssetCentroid3D(this.selectedAsset);
        this._gizmoGroup.position.copy(center);
    }

    _rebuildAssetMesh(asset) {
        // Find and remove old mesh
        const idx = this.assetMeshes.findIndex(e => e.feature === asset);
        if (idx !== -1) {
            const old = this.assetMeshes[idx];
            this.scene.remove(old.mesh);
            old.mesh.geometry.dispose();
            old.mesh.material.dispose();
            this.assetMeshes.splice(idx, 1);
        }
        // Build new mesh
        const entry = this._buildSingleAsset(asset);
        this.scene.add(entry.mesh);
        this.assetMeshes.push(entry);
        // Re-apply highlight
        entry.mesh.material.emissive.set(0x2563EB);
        entry.mesh.material.emissiveIntensity = 0.5;
    }

    _moveAsset3D(dx, dz) {
        const asset = this.selectedAsset;
        if (!asset) return;
        const p = this.projection;

        // 3D world delta → GeoJSON delta
        const dLon = dx / p.metersPerDegreeLon;
        const dLat = -dz / p.metersPerDegreeLat; // negate: +Z in 3D = -lat due to Z flip

        const coords = asset.geometry.coordinates[0];
        for (const coord of coords) {
            coord[0] += dLon;
            coord[1] += dLat;
        }
        if (asset.properties.centroid) {
            asset.properties.centroid[0] += dLon;
            asset.properties.centroid[1] += dLat;
        }

        this._rebuildAssetMesh(asset);
        this._updateGizmoPosition();
    }

    _rotateAsset3D(deltaRadians) {
        const asset = this.selectedAsset;
        if (!asset) return;

        const coords = asset.geometry.coordinates[0];
        const n = coords.length - 1;
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
            const dx = coord[0] - cLon;
            const dy = coord[1] - cLat;
            coord[0] = cLon + dx * cos - dy * sin;
            coord[1] = cLat + dx * sin + dy * cos;
        }
        if (asset.properties.centroid) {
            asset.properties.centroid[0] = cLon;
            asset.properties.centroid[1] = cLat;
        }

        this._rebuildAssetMesh(asset);
        this._updateGizmoPosition();
    }

    /* ==================================================================
       Tool Switching
       ================================================================== */

    setTool(tool) {
        this.activeTool = tool;
        if (tool !== 'measure') this._clearMeasure();
        if (tool === 'add') this._createGhost();
        else this._removeGhost();
        // Show gizmo only in select tool + edit mode
        if (tool === 'select' && this.editMode && this.selectedAsset) {
            this._buildGizmo();
        } else {
            this._removeGizmo();
        }
        this._updateCursor();
    }

    _updateCursor() {
        const canvas = this.rendererGL.domElement;
        if (this.activeTool === 'measure') canvas.style.cursor = 'crosshair';
        else if (this.activeTool === 'add') canvas.style.cursor = 'copy';
        else canvas.style.cursor = '';
    }

    /* ==================================================================
       Raycast Helper
       ================================================================== */

    /** Raycast mouse event against floor + room surfaces; returns world point or null */
    _raycastFloor(event) {
        const rect = this.rendererGL.domElement.getBoundingClientRect();
        this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this._raycaster.setFromCamera(this._mouse, this.camera);

        const targets = [];
        if (this.floorMesh) targets.push(this.floorMesh);
        for (const { mesh } of this.roomMeshes) targets.push(mesh);

        const hits = this._raycaster.intersectObjects(targets);
        return hits.length > 0 ? hits[0].point : null;
    }

    /* ==================================================================
       Measure Tool
       ================================================================== */

    _onMeasureClick(event) {
        const point = this._raycastFloor(event);
        if (!point) return;

        // If previous measure is closed, start fresh
        if (this._measureClosed) this._clearMeasure();

        const stored = point.clone();
        stored.y = 0.01;

        // Close polygon if clicking near first point (3+ points)
        if (this.measurePoints.length >= 3) {
            const first = this.measurePoints[0];
            const projected = first.clone().project(this.camera);
            const rect = this.rendererGL.domElement.getBoundingClientRect();
            const sx = (projected.x + 1) / 2 * rect.width;
            const sy = (-projected.y + 1) / 2 * rect.height;
            const dist = Math.hypot(event.clientX - rect.left - sx, event.clientY - rect.top - sy);
            if (dist < 14) {
                this._measureClosed = true;
                this._rebuildMeasureVisuals();
                return;
            }
        }

        this.measurePoints.push(stored);
        this._rebuildMeasureVisuals();
    }

    _clearMeasure() {
        this.measurePoints = [];
        this._measureClosed = false;
        this._measureRubberLine = null;
        // Clear 3D visuals
        while (this._measureGroup && this._measureGroup.children.length > 0) {
            const child = this._measureGroup.children[0];
            this._measureGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }
        // Clear labels
        for (const el of this._measureLabelEls) el.remove();
        this._measureLabelEls = [];
    }

    _rebuildMeasureVisuals() {
        // Clear current visuals
        this._measureRubberLine = null;
        while (this._measureGroup.children.length > 0) {
            const child = this._measureGroup.children[0];
            this._measureGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }
        for (const el of this._measureLabelEls) el.remove();
        this._measureLabelEls = [];

        const pts = this.measurePoints;
        if (pts.length === 0) return;

        // ── Lines between placed points ──
        const linePts = [...pts];
        if (this._measureClosed && pts.length >= 3) linePts.push(pts[0]);

        if (linePts.length >= 2) {
            const geo = new THREE.BufferGeometry().setFromPoints(linePts);
            const mat = new THREE.LineBasicMaterial({ color: 0x2563EB });
            this._measureGroup.add(new THREE.Line(geo, mat));
        }

        // ── Point markers ──
        const sphereGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0x2563EB });
        for (const p of pts) {
            const sphere = new THREE.Mesh(sphereGeo.clone(), sphereMat.clone());
            sphere.position.copy(p);
            this._measureGroup.add(sphere);
        }

        // ── Rubber-band line (from last point to cursor) ──
        if (!this._measureClosed && pts.length > 0) {
            const last = pts[pts.length - 1];
            const geo = new THREE.BufferGeometry().setFromPoints([last.clone(), last.clone()]);
            const mat = new THREE.LineBasicMaterial({ color: 0x2563EB, transparent: true, opacity: 0.5 });
            this._measureRubberLine = new THREE.Line(geo, mat);
            this._measureGroup.add(this._measureRubberLine);
        }

        // ── Segment distance labels ──
        const segments = [];
        for (let i = 0; i < pts.length - 1; i++) segments.push([pts[i], pts[i + 1]]);
        if (this._measureClosed && pts.length >= 3) segments.push([pts[pts.length - 1], pts[0]]);

        for (const [a, b] of segments) {
            const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
            const dist = a.distanceTo(b);
            const label = document.createElement('div');
            label.className = 'fp-measure-3d-label';
            label.textContent = dist.toFixed(2) + ' m';
            this.container.appendChild(label);
            this._measureLabelEls.push(label);
            label._worldPos = mid;
        }

        // ── Area label (if closed) ──
        if (this._measureClosed && pts.length >= 3) {
            let area = 0;
            for (let i = 0; i < pts.length; i++) {
                const j = (i + 1) % pts.length;
                area += pts[i].x * pts[j].z;
                area -= pts[j].x * pts[i].z;
            }
            area = Math.abs(area) / 2;
            const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
            const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
            const label = document.createElement('div');
            label.className = 'fp-measure-3d-label fp-measure-3d-label--area';
            label.textContent = area.toFixed(1) + ' m\u00B2';
            this.container.appendChild(label);
            this._measureLabelEls.push(label);
            label._worldPos = new THREE.Vector3(cx, 0.01, cz);
        }
    }

    _updateMeasureLabels() {
        if (this._measureLabelEls.length === 0) return;
        const rect = this.rendererGL.domElement.getBoundingClientRect();
        for (const label of this._measureLabelEls) {
            const projected = label._worldPos.clone().project(this.camera);
            if (projected.z > 1) { label.style.display = 'none'; continue; }
            label.style.display = '';
            label.style.left = ((projected.x + 1) / 2 * rect.width) + 'px';
            label.style.top = ((-projected.y + 1) / 2 * rect.height) + 'px';
        }
    }

    /* ==================================================================
       Furniture Placement (mockup — no data persistence)
       ================================================================== */

    _onAddClick(event) {
        const point = this._raycastFloor(event);
        if (!point) return;

        const w = 0.6, h = 0.75, d = 0.6;
        const geometry = new THREE.BoxGeometry(w, h, d);
        const material = new THREE.MeshStandardMaterial({
            color: 0x93C5FD, roughness: 0.6, metalness: 0.1,
            transparent: true, opacity: 0.85,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(point.x, h / 2, point.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this._placedMockups.push(mesh);
    }

    _createGhost() {
        if (this._ghostMesh) return;
        const geometry = new THREE.BoxGeometry(0.6, 0.75, 0.6);
        const material = new THREE.MeshStandardMaterial({
            color: 0x3B82F6, transparent: true, opacity: 0.35, roughness: 0.6,
        });
        this._ghostMesh = new THREE.Mesh(geometry, material);
        this._ghostMesh.position.y = 0.375;
        this._ghostMesh.visible = false;
        this.scene.add(this._ghostMesh);
    }

    _removeGhost() {
        if (!this._ghostMesh) return;
        this.scene.remove(this._ghostMesh);
        this._ghostMesh.geometry.dispose();
        this._ghostMesh.material.dispose();
        this._ghostMesh = null;
    }

    clearMockups() {
        for (const mesh of this._placedMockups) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        }
        this._placedMockups = [];
    }

    /* ==================================================================
       Zoom helpers (for toolbar buttons)
       ================================================================== */

    zoomIn() {
        const dir = new THREE.Vector3().subVectors(this.orbitControls.target, this.orbitCamera.position);
        this.orbitCamera.position.addScaledVector(dir, 0.2);
        this.orbitControls.update();
    }

    zoomOut() {
        const dir = new THREE.Vector3().subVectors(this.orbitControls.target, this.orbitCamera.position);
        this.orbitCamera.position.addScaledVector(dir, -0.2);
        this.orbitControls.update();
    }

    /* ==================================================================
       Walk Mode Controls (hold left mouse to look, WASD to move)
       ================================================================== */

    _onMouseDown(e) {
        if (e.button !== 0) return;
        this._mouseDownPos = { x: e.clientX, y: e.clientY };

        if (this.mode === 'walk') {
            this._walkLookActive = true;
            this._walkLastMouse.x = e.clientX;
            this._walkLastMouse.y = e.clientY;
            e.preventDefault();
            return;
        }

        // ── Gizmo hit test ──
        if (this.mode === 'orbit' && this.editMode && this.activeTool === 'select'
            && this.selectedAsset && this._gizmoGroup) {
            const rect = this.rendererGL.domElement.getBoundingClientRect();
            this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            this._raycaster.setFromCamera(this._mouse, this.camera);

            const gizmoChildren = [];
            this._gizmoGroup.traverse(child => {
                if (child.isMesh) gizmoChildren.push(child);
            });
            const hits = this._raycaster.intersectObjects(gizmoChildren);
            if (hits.length > 0 && hits[0].object.userData.gizmoAction) {
                this._gizmoAction = hits[0].object.userData.gizmoAction;
                this.orbitControls.enabled = false;

                // Create invisible horizontal drag plane at gizmo Y position
                const planeGeo = new THREE.PlaneGeometry(1000, 1000);
                const planeMat = new THREE.MeshBasicMaterial({ visible: false });
                this._gizmoDragPlane = new THREE.Mesh(planeGeo, planeMat);
                this._gizmoDragPlane.rotation.x = -Math.PI / 2;
                this._gizmoDragPlane.position.y = this._gizmoGroup.position.y;
                this.scene.add(this._gizmoDragPlane);

                // Record initial intersection point on the drag plane
                const planeHits = this._raycaster.intersectObject(this._gizmoDragPlane);
                if (planeHits.length > 0) {
                    this._gizmoDragStart = planeHits[0].point.clone();
                }

                if (this._gizmoAction === 'rotate') {
                    const center = this._gizmoGroup.position;
                    const pt = this._gizmoDragStart || new THREE.Vector3();
                    this._gizmoStartAngle = Math.atan2(pt.z - center.z, pt.x - center.x);
                }

                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }
    }

    _onMouseMove(e) {
        // Walk mode: drag to look
        if (this._walkLookActive) {
            const dx = e.clientX - this._walkLastMouse.x;
            const dy = e.clientY - this._walkLastMouse.y;
            this._walkLastMouse.x = e.clientX;
            this._walkLastMouse.y = e.clientY;

            const sensitivity = 0.003;
            this._walkEuler.yaw -= dx * sensitivity;
            this._walkEuler.pitch -= dy * sensitivity;
            this._walkEuler.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this._walkEuler.pitch));

            this.walkCamera.rotation.y = this._walkEuler.yaw;
            this.walkCamera.rotation.x = this._walkEuler.pitch;
            return;
        }

        if (this.mode !== 'orbit') return;

        // ── Gizmo dragging ──
        if (this._gizmoAction && this._gizmoDragPlane && this._gizmoDragStart) {
            const rect = this.rendererGL.domElement.getBoundingClientRect();
            this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            this._raycaster.setFromCamera(this._mouse, this.camera);

            const hits = this._raycaster.intersectObject(this._gizmoDragPlane);
            if (hits.length === 0) return;
            const pt = hits[0].point;

            if (this._gizmoAction === 'rotate') {
                const center = this._gizmoGroup.position;
                const angle = Math.atan2(pt.z - center.z, pt.x - center.x);
                const delta = angle - this._gizmoStartAngle;
                this._gizmoStartAngle = angle;
                this._rotateAsset3D(-delta);
                window.dispatchEvent(new CustomEvent('fp-asset-moved', { detail: this.selectedAsset }));
            } else {
                const dx = pt.x - this._gizmoDragStart.x;
                const dz = pt.z - this._gizmoDragStart.z;
                this._gizmoDragStart.copy(pt);

                if (this._gizmoAction === 'x-axis') {
                    this._moveAsset3D(dx, 0);
                } else if (this._gizmoAction === 'z-axis') {
                    this._moveAsset3D(0, dz);
                } else if (this._gizmoAction === 'center') {
                    this._moveAsset3D(dx, dz);
                }
                window.dispatchEvent(new CustomEvent('fp-asset-moved', { detail: this.selectedAsset }));
            }
            return;
        }

        // Check if mouse is over the 3D canvas
        const rect = this.rendererGL.domElement.getBoundingClientRect();
        const isOver = e.clientX >= rect.left && e.clientX <= rect.right &&
                       e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (!isOver) {
            if (this._ghostMesh) this._ghostMesh.visible = false;
            return;
        }

        // ── Gizmo hover cursor ──
        if (this.editMode && this.activeTool === 'select' && this._gizmoGroup) {
            this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            this._raycaster.setFromCamera(this._mouse, this.camera);

            const gizmoChildren = [];
            this._gizmoGroup.traverse(child => { if (child.isMesh) gizmoChildren.push(child); });
            const gizmoHits = this._raycaster.intersectObjects(gizmoChildren);
            if (gizmoHits.length > 0 && gizmoHits[0].object.userData.gizmoAction) {
                const action = gizmoHits[0].object.userData.gizmoAction;
                const canvas = this.rendererGL.domElement;
                if (action === 'x-axis') canvas.style.cursor = 'ew-resize';
                else if (action === 'z-axis') canvas.style.cursor = 'ns-resize';
                else if (action === 'center') canvas.style.cursor = 'move';
                else if (action === 'rotate') canvas.style.cursor = 'grab';
                return;
            } else {
                this.rendererGL.domElement.style.cursor = '';
            }
        }

        // Measure rubber-band line
        if (this.activeTool === 'measure' && this.measurePoints.length > 0
            && !this._measureClosed && this._measureRubberLine) {
            const point = this._raycastFloor(e);
            if (point) {
                const pos = this._measureRubberLine.geometry.attributes.position.array;
                pos[3] = point.x;
                pos[4] = 0.01;
                pos[5] = point.z;
                this._measureRubberLine.geometry.attributes.position.needsUpdate = true;
            }
        }

        // Ghost preview for add tool
        if (this.activeTool === 'add' && this._ghostMesh) {
            const point = this._raycastFloor(e);
            if (point) {
                this._ghostMesh.position.set(point.x, 0.375, point.z);
                this._ghostMesh.visible = true;
            } else {
                this._ghostMesh.visible = false;
            }
        }
    }

    _onMouseUp(e) {
        if (e.button === 0) {
            // Release gizmo drag
            if (this._gizmoAction) {
                this._gizmoAction = null;
                this._gizmoStartAngle = null;
                this._gizmoDragStart = null;
                if (this._gizmoDragPlane) {
                    this.scene.remove(this._gizmoDragPlane);
                    this._gizmoDragPlane.geometry.dispose();
                    this._gizmoDragPlane.material.dispose();
                    this._gizmoDragPlane = null;
                }
                this.orbitControls.enabled = true;
                this.rendererGL.domElement.style.cursor = '';
                // Prevent the subsequent click event from deselecting
                this._gizmoJustReleased = true;
                requestAnimationFrame(() => { this._gizmoJustReleased = false; });
            }
            this._walkLookActive = false;
            this._mouseDownPos = null;
        }
    }

    _onKeyDown(e) {
        if (this.mode !== 'walk') return;
        switch (e.code) {
            case 'KeyW': case 'ArrowUp':    this.walkKeys.forward = true; break;
            case 'KeyS': case 'ArrowDown':  this.walkKeys.backward = true; break;
            case 'KeyA': case 'ArrowLeft':  this.walkKeys.left = true; break;
            case 'KeyD': case 'ArrowRight': this.walkKeys.right = true; break;
        }
    }

    _onKeyUp(e) {
        if (this.mode !== 'walk') return;
        switch (e.code) {
            case 'KeyW': case 'ArrowUp':    this.walkKeys.forward = false; break;
            case 'KeyS': case 'ArrowDown':  this.walkKeys.backward = false; break;
            case 'KeyA': case 'ArrowLeft':  this.walkKeys.left = false; break;
            case 'KeyD': case 'ArrowRight': this.walkKeys.right = false; break;
        }
    }

    _updateWalkControls(delta) {
        if (this.mode !== 'walk') return;

        const forward = Number(this.walkKeys.forward) - Number(this.walkKeys.backward);
        const right = Number(this.walkKeys.right) - Number(this.walkKeys.left);
        if (forward === 0 && right === 0) return;

        const speed = 5.0; // m/s

        // Forward direction from camera (projected onto XZ plane)
        const dir = new THREE.Vector3();
        this.walkCamera.getWorldDirection(dir);
        dir.y = 0;
        dir.normalize();

        // Right vector
        const rightDir = new THREE.Vector3();
        rightDir.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();

        this.walkCamera.position.addScaledVector(dir, forward * speed * delta);
        this.walkCamera.position.addScaledVector(rightDir, right * speed * delta);

        // Lock Y to eye height
        this.walkCamera.position.y = 1.6;
    }

    /* ==================================================================
       Animation Loop
       ================================================================== */

    _animate() {
        this._animationId = requestAnimationFrame(() => this._animate());
        const delta = this._clock.getDelta();

        if (this.mode === 'orbit') {
            this.orbitControls.update();
        } else if (this.mode === 'walk') {
            this._updateWalkControls(delta);
        }

        this.rendererGL.render(this.scene, this.camera);
        this._updateMeasureLabels();
    }

    startAnimationLoop() {
        if (this._animationId) return;
        this._clock.start();
        this._animate();
    }

    stopAnimationLoop() {
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }
        this._clock.stop();
    }

    /* ==================================================================
       Resize
       ================================================================== */

    _handleResize() {
        const rect = this.container.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        if (w === 0 || h === 0) return;

        this.rendererGL.setSize(w, h);

        this.orbitCamera.aspect = w / h;
        this.orbitCamera.updateProjectionMatrix();

        this.walkCamera.aspect = w / h;
        this.walkCamera.updateProjectionMatrix();
    }
}

// Export to global scope for non-module app.js
window.FloorPlan3DRenderer = FloorPlan3DRenderer;
