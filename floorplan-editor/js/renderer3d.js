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

        /* ── Raycaster ─────────────────────────────────────────────────── */
        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();

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
        this._stopAnimationLoop();
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

    _buildFurniture() {
        for (const asset of this.assets) {
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
            // ExtrudeGeometry extrudes along Z; rotate so extrusion goes along Y (up)
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
            this.scene.add(mesh);
            this.assetMeshes.push({ mesh, feature: asset });
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
        // In walk mode, clicks are handled by mousedown/mousemove
        if (this.mode === 'walk') return;

        const rect = this.rendererGL.domElement.getBoundingClientRect();
        this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this._raycaster.setFromCamera(this._mouse, this.camera);

        // Check assets first (priority), then rooms + walls
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

        // Dispatch event compatible with 2D editor
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
    }

    /* ==================================================================
       Walk Mode Controls (hold left mouse to look, WASD to move)
       ================================================================== */

    _onMouseDown(e) {
        if (this.mode !== 'walk' || e.button !== 0) return;
        this._walkLookActive = true;
        this._walkLastMouse.x = e.clientX;
        this._walkLastMouse.y = e.clientY;
        e.preventDefault();
    }

    _onMouseMove(e) {
        if (!this._walkLookActive) return;
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
    }

    _onMouseUp(e) {
        if (e.button === 0) this._walkLookActive = false;
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
