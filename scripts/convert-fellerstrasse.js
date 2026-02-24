/**
 * Convert "2011-DM Fellerstrasse15 OG4.json" into buildings/floors/rooms GeoJSON entries.
 *
 * Usage:  node scripts/convert-fellerstrasse.js
 *
 * Building: 2011/DM  –  Fellerstrasse 21, 3027 Bern
 * Floor:    OG4 (4th floor)
 */

const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────
const BUILDING_ID = 'b-2011';
const FLOOR_LEVEL = 4;           // OG4
const FLOOR_ID = `${BUILDING_ID}-${FLOOR_LEVEL}`;
const FLOOR_HEIGHT = 3.5;        // meters per storey (matches existing data)
const BASE_HEIGHT = FLOOR_LEVEL * FLOOR_HEIGHT;   // 14
const TOP_HEIGHT = BASE_HEIGHT + FLOOR_HEIGHT;     // 17.5
const GROUND_ELEVATION = 560;    // approx for Bern-Bethlehem area

// Paths
const srcPath = path.join(__dirname, '2011-DM Fellerstrasse15 OG4.json');
const buildingsPath = path.join(__dirname, '..', 'data', 'buildings.geojson');
const floorsPath    = path.join(__dirname, '..', 'data', 'floors.geojson');
const roomsPath     = path.join(__dirname, '..', 'data', 'rooms.geojson');

// ── Read source ─────────────────────────────────────────────────────────
const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const features = src.features;
console.log(`Source features: ${features.length}`);

// ── Compute bounding box (lon/lat) ─────────────────────────────────────
let minLon = Infinity, maxLon = -Infinity;
let minLat = Infinity, maxLat = -Infinity;

for (const f of features) {
    for (const ring of f.geometry.coordinates) {
        for (const [lon, lat] of ring) {
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        }
    }
}

const centerLon = (minLon + maxLon) / 2;
const centerLat = (minLat + maxLat) / 2;
console.log(`BBox: lon ${minLon.toFixed(6)}..${maxLon.toFixed(6)}, lat ${minLat.toFixed(6)}..${maxLat.toFixed(6)}`);
console.log(`Center: ${centerLon.toFixed(6)}, ${centerLat.toFixed(6)}`);

// ── Helpers ─────────────────────────────────────────────────────────────

/** Compute polygon area in m² using the Shoelace formula on projected coords */
function polygonAreaM2(ring) {
    const metersPerDegreeLon = Math.cos(centerLat * Math.PI / 180) * 111320;
    const metersPerDegreeLat = 111320;
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        const x1 = (ring[i][0] - centerLon) * metersPerDegreeLon;
        const y1 = (ring[i][1] - centerLat) * metersPerDegreeLat;
        const x2 = (ring[i + 1][0] - centerLon) * metersPerDegreeLon;
        const y2 = (ring[i + 1][1] - centerLat) * metersPerDegreeLat;
        area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area) / 2;
}

/** Make a bounding-box polygon (closed ring) */
function bboxPolygon(minLon, minLat, maxLon, maxLat) {
    return [[
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
    ]];
}

// Small margin around the rooms for the floor/building outline
const margin = 0.00002;
const floorCoords = bboxPolygon(
    minLon - margin, minLat - margin,
    maxLon + margin, maxLat + margin
);
const buildingCoords = bboxPolygon(
    minLon - margin * 2, minLat - margin * 2,
    maxLon + margin * 2, maxLat + margin * 2
);

// ── Compute room areas & total ──────────────────────────────────────────
let totalArea = 0;
const roomAreas = features.map(f => {
    const a = Math.round(polygonAreaM2(f.geometry.coordinates[0]));
    totalArea += a;
    return a;
});
console.log(`Total area: ${totalArea} m²`);

// ── Build room features ─────────────────────────────────────────────────
const roomFeatures = features.map((f, i) => {
    const nr = `${FLOOR_LEVEL}${String(i + 1).padStart(2, '0')}`;
    const roomId = `${FLOOR_ID}-${nr}`;
    const area = roomAreas[i];

    // Heuristic room type based on area
    let type = 'Raum';
    if (area <= 4)  type = 'Schacht';
    else if (area <= 8)  type = 'WC';
    else if (area <= 15) type = 'Nebenraum';
    else if (area <= 30) type = 'Büro';
    else if (area <= 60) type = 'Grossraumbüro';
    else type = 'Saal';

    return {
        type: 'Feature',
        id: roomId,
        properties: {
            roomId,
            floorId: FLOOR_ID,
            buildingId: BUILDING_ID,
            nr,
            type,
            area,
            workspaces: type === 'Büro' ? Math.max(1, Math.floor(area / 8)) : (type === 'Grossraumbüro' ? Math.floor(area / 6) : 0),
            groundElevation: GROUND_ELEVATION,
            baseHeight: BASE_HEIGHT,
            topHeight: TOP_HEIGHT,
        },
        geometry: f.geometry,
    };
});

const workspaceCount = roomFeatures.reduce((s, r) => s + r.properties.workspaces, 0);
console.log(`Rooms: ${roomFeatures.length}, workspaces: ${workspaceCount}`);

// ── 1) Update buildings.geojson ─────────────────────────────────────────
const buildings = JSON.parse(fs.readFileSync(buildingsPath, 'utf8'));

// Remove existing entry if present
buildings.features = buildings.features.filter(f => f.id !== BUILDING_ID);

buildings.features.push({
    type: 'Feature',
    id: BUILDING_ID,
    properties: {
        buildingId: BUILDING_ID,
        siteId: 'be',
        name: 'Fellerstrasse 21',
        objectCode: '2011.DM',
        address: {
            street: 'Fellerstrasse 21',
            postalCode: '3027',
            city: 'Bern',
            canton: 'BE',
            country: 'CH',
        },
        centroid: [7.387941, 46.946539],
        yearBuilt: '',
        status: 'Gebäude bestehend',
        category: 'Verwaltungsgebäude',
        areaGross: totalArea,
        photo: 'photo-1486406146926-c627a92ad1ab',
        groundElevation: GROUND_ELEVATION,
    },
    geometry: {
        type: 'Polygon',
        coordinates: buildingCoords,
    },
});

fs.writeFileSync(buildingsPath, JSON.stringify(buildings, null, 2) + '\n');
console.log('✓ buildings.geojson updated');

// ── 2) Update floors.geojson ────────────────────────────────────────────
const floors = JSON.parse(fs.readFileSync(floorsPath, 'utf8'));

// Remove existing entry if present
floors.features = floors.features.filter(f => f.id !== FLOOR_ID);

floors.features.push({
    type: 'Feature',
    id: FLOOR_ID,
    properties: {
        floorId: FLOOR_ID,
        buildingId: BUILDING_ID,
        name: '4. OG',
        nameShort: '4',
        levelNumber: FLOOR_LEVEL,
        verticalOrder: FLOOR_LEVEL,
        areaGross: totalArea,
        workspaceCount,
        roomCount: roomFeatures.length,
        groundElevation: GROUND_ELEVATION,
        baseHeight: BASE_HEIGHT,
        topHeight: TOP_HEIGHT,
    },
    geometry: {
        type: 'Polygon',
        coordinates: floorCoords,
    },
});

fs.writeFileSync(floorsPath, JSON.stringify(floors, null, 2) + '\n');
console.log('✓ floors.geojson updated');

// ── 3) Update rooms.geojson ─────────────────────────────────────────────
const rooms = JSON.parse(fs.readFileSync(roomsPath, 'utf8'));

// Remove existing rooms for this floor
rooms.features = rooms.features.filter(f => f.properties.floorId !== FLOOR_ID);

// Append new rooms
rooms.features.push(...roomFeatures);

fs.writeFileSync(roomsPath, JSON.stringify(rooms, null, 2) + '\n');
console.log(`✓ rooms.geojson updated (${roomFeatures.length} rooms added)`);

console.log('\nDone! Building:', BUILDING_ID, '/ Floor:', FLOOR_ID);
