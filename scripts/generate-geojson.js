#!/usr/bin/env node
/**
 * Generate GeoJSON files with realistic corridor-based floor plans.
 * Reads from existing buildings.geojson + floors.geojson + rooms.geojson,
 * then regenerates floors.geojson (inset polygons) and rooms.geojson
 * (corridor layout). Fetches ground elevation from Swisstopo API and
 * computes 3D stacking heights for floors, rooms, and assets.
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

// ── READ EXISTING GEOJSON ────────────────────────────────────────────
const buildingsGeo = JSON.parse(fs.readFileSync(path.join(dataDir, 'buildings.geojson'), 'utf8'));
const floorsGeoIn = JSON.parse(fs.readFileSync(path.join(dataDir, 'floors.geojson'), 'utf8'));
const roomsGeoIn = JSON.parse(fs.readFileSync(path.join(dataDir, 'rooms.geojson'), 'utf8'));

// ── COORDINATE CONSTANTS ─────────────────────────────────────────────
// At ~47°N latitude:
const M_PER_DEG_LAT = 111200;
// Computed at ~47°N: 111200 * cos(47°) ≈ 75823
const REF_LAT = 47.0;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos(REF_LAT * Math.PI / 180);

// ── LAYOUT CONSTANTS (meters) ────────────────────────────────────────
const ROOM_DEPTH = 5.5;
const CORRIDOR_WIDTH = 2.5;
const WALL_MARGIN = 0.5;
const ROOM_GAP = 0.3;

function round6(n) { return Math.round(n * 1e6) / 1e6; }

// Convert meters to degrees
const wallMarginLat = WALL_MARGIN / M_PER_DEG_LAT;
const wallMarginLng = WALL_MARGIN / M_PER_DEG_LNG;
const roomDepthLat = ROOM_DEPTH / M_PER_DEG_LAT;
const corridorWidthLat = CORRIDOR_WIDTH / M_PER_DEG_LAT;
const roomGapLng = ROOM_GAP / M_PER_DEG_LNG;

// ── HEIGHT CONSTANTS ─────────────────────────────────────────────────
const FLOOR_HEIGHT = 3.5; // meters floor-to-floor

// Asset 3D heights by category (meters)
const ASSET_HEIGHTS = {
  'buerostuehle':       0.45,
  'konferenzstuehle':   0.45,
  'besucherstuhl':      0.45,
  'schreibtische':      0.75,
  'usm-haller':         1.50,
  'rollkorpus':         0.60,
  'it-equipment':       0.30,
  'medientechnik':      0.40,
  'kueche':             0.90,
  'schreibtischlampen': 0.50,
  'buerogeraete':       0.40,
  'raumklima':          0.30
};
const DEFAULT_ASSET_HEIGHT = 0.50;

// ── WGS84 → LV95 COORDINATE CONVERSION ──────────────────────────────
// Swisstopo approximate formulas (accuracy ~1m, sufficient for elevation lookup)
function wgs84ToLV95(lat, lon) {
  const phi = (lat * 3600 - 169028.66) / 10000;
  const lam = (lon * 3600 - 26782.5) / 10000;
  const E = 2600072.37 + 211455.93 * lam - 10938.51 * lam * phi
            - 0.36 * lam * phi * phi - 44.54 * lam * lam * lam;
  const N = 1200147.07 + 308807.95 * phi + 3745.25 * lam * lam
            + 76.63 * phi * phi - 194.56 * lam * lam * phi + 119.79 * phi * phi * phi;
  return { E, N };
}

// Fetch ground elevation from Swisstopo height API
async function fetchElevation(lat, lon) {
  const { E, N } = wgs84ToLV95(lat, lon);
  const url = `https://api3.geo.admin.ch/rest/services/height?easting=${E.toFixed(2)}&northing=${N.toFixed(2)}&sr=2056`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from Swisstopo height API`);
  const data = await res.json();
  return parseFloat(data.height) || 0;
}

// ── MAIN (async for API calls) ──────────────────────────────────────
async function main() {

// ── INDEX BUILDING FOOTPRINTS ────────────────────────────────────────
const buildingBounds = {};
for (const bf of buildingsGeo.features) {
  const ring = bf.geometry.coordinates[0];
  const lngs = ring.map(c => c[0]);
  const lats = ring.map(c => c[1]);
  buildingBounds[bf.properties.buildingId] = {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats)
  };
}

// ── FETCH GROUND ELEVATIONS FROM SWISSTOPO ──────────────────────────
console.log('Fetching ground elevations from Swisstopo API...');
const buildingElevations = {};
for (const bf of buildingsGeo.features) {
  const bid = bf.properties.buildingId;
  const [lon, lat] = bf.properties.centroid;
  try {
    const elev = await fetchElevation(lat, lon);
    buildingElevations[bid] = elev;
    console.log(`  ${bid}: ${elev} m`);
  } catch (err) {
    buildingElevations[bid] = 0;
    console.warn(`  ⚠ ${bid}: API error, using 0m — ${err.message}`);
  }
}

// Per-building minimum levelNumber (for stacking: lowest floor starts at base 0)
const buildingMinLevel = {};
for (const f of floorsGeoIn.features) {
  const bid = f.properties.buildingId;
  const lv = f.properties.levelNumber;
  if (buildingMinLevel[bid] === undefined || lv < buildingMinLevel[bid]) {
    buildingMinLevel[bid] = lv;
  }
}

// ── GROUP ROOMS BY FLOOR ─────────────────────────────────────────────
const roomsByFloor = {};
for (const rf of roomsGeoIn.features) {
  const fid = rf.properties.floorId;
  if (!roomsByFloor[fid]) roomsByFloor[fid] = [];
  roomsByFloor[fid].push({
    nr: rf.properties.nr,
    type: rf.properties.type,
    area: rf.properties.area,
    workspaces: rf.properties.workspaces
  });
}

// ── ROOM TYPE SORT ORDER (for layout placement) ──────────────────────
const TYPE_ORDER = {
  'Open Space': 0,
  'Empfang': 1,
  'Büro': 2,
  'Sitzungszimmer': 3,
  'Fokusraum': 4,
  'Lounge': 5,
  'Schulungsraum': 6,
  'Cafeteria': 7,
  'Druckerraum': 8,
  'Teeküche': 9,
  'WC': 10,
  'Lager': 11,
  'Technikraum': 12,
  'Garderobe': 13,
  'Archiv': 14,
  'Korridor': 99
};

function typeOrder(type) {
  return TYPE_ORDER[type] !== undefined ? TYPE_ORDER[type] : 50;
}

// ── GENERATE FLOORS (inset polygons + height properties) ─────────────
const floorFeatures = floorsGeoIn.features.map(f => {
  const bid = f.properties.buildingId;
  const bb = buildingBounds[bid];
  if (!bb) return f; // fallback: keep original

  const groundElev = buildingElevations[bid] || 0;
  const minLevel = buildingMinLevel[bid] || 0;
  const baseHeight = (f.properties.levelNumber - minLevel) * FLOOR_HEIGHT;

  // Inset by wall margin
  return {
    type: 'Feature',
    id: f.id,
    properties: {
      ...f.properties,
      groundElevation: groundElev,
      baseHeight,
      topHeight: baseHeight + FLOOR_HEIGHT
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [round6(bb.minLng + wallMarginLng), round6(bb.minLat + wallMarginLat)],
        [round6(bb.maxLng - wallMarginLng), round6(bb.minLat + wallMarginLat)],
        [round6(bb.maxLng - wallMarginLng), round6(bb.maxLat - wallMarginLat)],
        [round6(bb.minLng + wallMarginLng), round6(bb.maxLat - wallMarginLat)],
        [round6(bb.minLng + wallMarginLng), round6(bb.minLat + wallMarginLat)]
      ]]
    }
  };
});

const floorsGeo = { type: 'FeatureCollection', features: floorFeatures };

// Floor height lookup for rooms and assets
const floorHeightMap = {};
for (const ff of floorFeatures) {
  floorHeightMap[ff.properties.floorId] = {
    groundElevation: ff.properties.groundElevation,
    baseHeight: ff.properties.baseHeight,
    topHeight: ff.properties.topHeight
  };
}

// ── GENERATE ROOMS (corridor layout + height properties) ─────────────
const roomFeatures = [];

for (const floorF of floorsGeoIn.features) {
  const floorId = floorF.properties.floorId;
  const buildingId = floorF.properties.buildingId;
  const rooms = roomsByFloor[floorId];
  if (!rooms || rooms.length === 0) continue;

  const bb = buildingBounds[buildingId];
  if (!bb) continue;

  const fh = floorHeightMap[floorId] || { groundElevation: 0, baseHeight: 0, topHeight: FLOOR_HEIGHT };

  const centerLat = (bb.minLat + bb.maxLat) / 2;

  // Corridor zone
  const corrMinLat = centerLat - corridorWidthLat / 2;
  const corrMaxLat = centerLat + corridorWidthLat / 2;

  // Wing zones (rooms go from corridor edge outward by ROOM_DEPTH)
  const northWingMinLat = corrMaxLat;
  const northWingMaxLat = round6(corrMaxLat + roomDepthLat);
  const southWingMinLat = round6(corrMinLat - roomDepthLat);
  const southWingMaxLat = corrMinLat;

  // Usable E-W width (inside wall margins)
  const usableMinLng = bb.minLng + wallMarginLng;
  const usableMaxLng = bb.maxLng - wallMarginLng;
  const usableWidth = usableMaxLng - usableMinLng;

  // Separate corridor rooms from regular rooms
  const corridorRooms = [];
  const regularRooms = [];
  for (const r of rooms) {
    if (r.type === 'Korridor') corridorRooms.push(r);
    else regularRooms.push(r);
  }

  // Sort regular rooms: large types first, then by area descending
  regularRooms.sort((a, b) => {
    const orderDiff = typeOrder(a.type) - typeOrder(b.type);
    if (orderDiff !== 0) return orderDiff;
    return b.area - a.area;
  });

  // Split rooms into north and south wings (balance by total area)
  const northRooms = [];
  const southRooms = [];
  let northArea = 0;
  let southArea = 0;

  for (const r of regularRooms) {
    if (northArea <= southArea) {
      northRooms.push(r);
      northArea += r.area;
    } else {
      southRooms.push(r);
      southArea += r.area;
    }
  }

  // Place rooms in a wing
  function placeWing(wingRooms, wingMinLat, wingMaxLat) {
    if (wingRooms.length === 0) return;

    // Calculate ideal widths based on area / room_depth
    const idealWidths = wingRooms.map(r => (r.area / ROOM_DEPTH) / M_PER_DEG_LNG);
    const totalGaps = (wingRooms.length - 1) * roomGapLng;
    const totalIdealWidth = idealWidths.reduce((s, w) => s + w, 0);
    const availableForRooms = usableWidth - totalGaps;

    // Scale factor if rooms don't fit
    const scale = totalIdealWidth > 0 && totalIdealWidth > availableForRooms
      ? availableForRooms / totalIdealWidth
      : 1;

    let cursorLng = usableMinLng;

    for (let i = 0; i < wingRooms.length; i++) {
      const room = wingRooms[i];
      const roomWidth = idealWidths[i] * scale;

      const roomMinLng = round6(cursorLng);
      const roomMaxLng = round6(cursorLng + roomWidth);

      const roomId = `${floorId}-${room.nr}`;

      roomFeatures.push({
        type: 'Feature',
        id: roomId,
        properties: {
          roomId,
          floorId,
          buildingId,
          nr: room.nr,
          type: room.type,
          area: room.area,
          workspaces: room.workspaces,
          groundElevation: fh.groundElevation,
          baseHeight: fh.baseHeight,
          topHeight: fh.topHeight
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [roomMinLng, round6(wingMinLat)],
            [roomMaxLng, round6(wingMinLat)],
            [roomMaxLng, round6(wingMaxLat)],
            [roomMinLng, round6(wingMaxLat)],
            [roomMinLng, round6(wingMinLat)]
          ]]
        }
      });

      cursorLng += roomWidth + roomGapLng;
    }
  }

  // Place north and south wing rooms
  placeWing(northRooms, northWingMinLat, northWingMaxLat);
  placeWing(southRooms, southWingMinLat, southWingMaxLat);

  // Place corridor rooms as thin rectangles spanning the corridor
  if (corridorRooms.length > 0) {
    const corrIdealWidths = corridorRooms.map(r => (r.area / CORRIDOR_WIDTH) / M_PER_DEG_LNG);
    const corrTotalGaps = (corridorRooms.length - 1) * roomGapLng;
    const corrTotalWidth = corrIdealWidths.reduce((s, w) => s + w, 0);
    const corrAvailable = usableWidth - corrTotalGaps;
    const corrScale = corrTotalWidth > corrAvailable
      ? corrAvailable / corrTotalWidth
      : 1;

    let corrCursorLng = usableMinLng;

    for (let i = 0; i < corridorRooms.length; i++) {
      const room = corridorRooms[i];
      const roomWidth = corrIdealWidths[i] * corrScale;

      const roomMinLng = round6(corrCursorLng);
      const roomMaxLng = round6(corrCursorLng + roomWidth);

      const roomId = `${floorId}-${room.nr}`;

      roomFeatures.push({
        type: 'Feature',
        id: roomId,
        properties: {
          roomId,
          floorId,
          buildingId,
          nr: room.nr,
          type: room.type,
          area: room.area,
          workspaces: room.workspaces,
          groundElevation: fh.groundElevation,
          baseHeight: fh.baseHeight,
          topHeight: fh.topHeight
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [roomMinLng, round6(corrMinLat)],
            [roomMaxLng, round6(corrMinLat)],
            [roomMaxLng, round6(corrMaxLat)],
            [roomMinLng, round6(corrMaxLat)],
            [roomMinLng, round6(corrMinLat)]
          ]]
        }
      });

      corrCursorLng += roomWidth + roomGapLng;
    }
  }
}

const roomsGeo = { type: 'FeatureCollection', features: roomFeatures };

// ── GENERATE ASSETS (positioned inside rooms) ───────────────────────
// Read asset data from existing assets.geojson (source of truth for item properties).
// Geometry is regenerated below based on current room polygons.
const existingAssets = JSON.parse(fs.readFileSync(path.join(dataDir, 'assets.geojson'), 'utf8'));
const allItems = existingAssets.features.map(f => ({ ...f.properties, itemId: f.properties.assetId }));

// Index room bounds from generated room features
const roomBoundsMap = {};
for (const rf of roomFeatures) {
  const ring = rf.geometry.coordinates[0];
  const lngs = ring.map(c => c[0]);
  const lats = ring.map(c => c[1]);
  roomBoundsMap[rf.properties.roomId] = {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats)
  };
}

// Asset sizes by category (width × depth in meters)
const ASSET_SIZES = {
  'buerostuehle':       { w: 0.6, d: 0.6 },
  'konferenzstuehle':   { w: 0.5, d: 0.5 },
  'besucherstuhl':      { w: 0.5, d: 0.5 },
  'schreibtische':      { w: 1.6, d: 0.8 },
  'usm-haller':         { w: 1.5, d: 0.4 },
  'rollkorpus':         { w: 0.4, d: 0.6 },
  'it-equipment':       { w: 0.5, d: 0.3 },
  'medientechnik':      { w: 0.8, d: 0.4 },
  'kueche':             { w: 0.6, d: 0.5 },
  'schreibtischlampen': { w: 0.2, d: 0.2 },
  'buerogeraete':       { w: 0.4, d: 0.4 },
  'raumklima':          { w: 0.3, d: 0.3 }
};
const DEFAULT_SIZE = { w: 0.6, d: 0.6 };
const ASSET_MARGIN = 0.3; // margin inside room + gap between assets (meters)

// Group items by roomId
const itemsByRoom = {};
for (const item of allItems) {
  const rid = item.roomId;
  if (!rid) continue;
  if (!itemsByRoom[rid]) itemsByRoom[rid] = [];
  itemsByRoom[rid].push(item);
}

const assetFeatures = [];

for (const [roomId, items] of Object.entries(itemsByRoom)) {
  const rb = roomBoundsMap[roomId];
  if (!rb) {
    console.warn(`  ⚠ Room ${roomId} not found in rooms.geojson — skipping ${items.length} asset(s)`);
    continue;
  }

  const marginLng = ASSET_MARGIN / M_PER_DEG_LNG;
  const marginLat = ASSET_MARGIN / M_PER_DEG_LAT;
  const gapLng = ASSET_MARGIN / M_PER_DEG_LNG;
  const gapLat = ASSET_MARGIN / M_PER_DEG_LAT;

  // Usable interior of the room
  const intMinLng = rb.minLng + marginLng;
  const intMaxLng = rb.maxLng - marginLng;
  const intMinLat = rb.minLat + marginLat;
  const intMaxLat = rb.maxLat - marginLat;
  const intWidth = intMaxLng - intMinLng;
  const intHeight = intMaxLat - intMinLat;

  if (intWidth <= 0 || intHeight <= 0) continue;

  // Place assets row-major (top-left to bottom-right)
  let cursorLng = intMinLng;
  let cursorLat = intMaxLat; // start from top
  let rowMaxDepth = 0;

  for (const item of items) {
    const size = ASSET_SIZES[item.categoryId] || DEFAULT_SIZE;
    let assetW = size.w / M_PER_DEG_LNG;
    let assetD = size.d / M_PER_DEG_LAT;

    // Scale down if asset is wider than room interior
    if (assetW > intWidth) assetW = intWidth;
    if (assetD > intHeight) assetD = intHeight;

    // Check if asset fits in current row
    if (cursorLng + assetW > intMaxLng + 0.0000001) {
      // Wrap to next row
      cursorLng = intMinLng;
      cursorLat -= (rowMaxDepth + gapLat);
      rowMaxDepth = 0;
    }

    // Check if we've run out of vertical space
    if (cursorLat - assetD < intMinLat - 0.0000001) {
      // Scale down: just place at current position anyway
      assetD = Math.max(cursorLat - intMinLat, assetD * 0.3);
    }

    const aMinLng = round6(cursorLng);
    const aMaxLng = round6(cursorLng + assetW);
    const aMinLat = round6(cursorLat - assetD);
    const aMaxLat = round6(cursorLat);
    const centroidLng = round6((aMinLng + aMaxLng) / 2);
    const centroidLat = round6((aMinLat + aMaxLat) / 2);

    // Height properties: asset sits on the floor surface
    const fh = floorHeightMap[item.floorId] || { groundElevation: 0, baseHeight: 0, topHeight: FLOOR_HEIGHT };
    const assetH = ASSET_HEIGHTS[item.categoryId] || DEFAULT_ASSET_HEIGHT;

    // Build properties — merge all fields from both source types
    const props = {
      assetId: item.itemId,
      name: item.name,
      inventoryNumber: item.inventoryNumber,
      brand: item.brand,
      categoryId: item.categoryId,
      buildingId: item.buildingId,
      floorId: item.floorId,
      roomId: item.roomId,
      status: item.status,
      condition: item.condition,
      acquisitionDate: item.acquisitionDate,
      acquisitionCost: item.acquisitionCost,
      centroid: [centroidLng, centroidLat],
      groundElevation: fh.groundElevation,
      baseHeight: fh.baseHeight,
      topHeight: fh.baseHeight + assetH
    };
    // Circular-specific fields
    if (item.price !== undefined) props.price = item.price;
    if (item.currency) props.currency = item.currency;
    if (item.description) props.description = item.description;
    if (item.organizationId) props.organizationId = item.organizationId;
    if (item.qrCode) props.qrCode = item.qrCode;
    if (item.photo) props.photo = item.photo;
    if (item.photos) props.photos = item.photos;
    if (item.listedAt) props.listedAt = item.listedAt;
    if (item.quantity) props.quantity = item.quantity;
    if (item.productId !== undefined) props.productId = item.productId;

    assetFeatures.push({
      type: 'Feature',
      id: item.itemId,
      properties: props,
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [aMinLng, aMinLat],
          [aMaxLng, aMinLat],
          [aMaxLng, aMaxLat],
          [aMinLng, aMaxLat],
          [aMinLng, aMinLat]
        ]]
      }
    });

    cursorLng += assetW + gapLng;
    if (assetD > rowMaxDepth) rowMaxDepth = assetD;
  }
}

const assetsGeo = { type: 'FeatureCollection', features: assetFeatures };

// ── WRITE FILES ──────────────────────────────────────────────────────
// Enrich buildings.geojson with groundElevation
const enrichedBuildings = {
  type: 'FeatureCollection',
  features: buildingsGeo.features.map(f => ({
    ...f,
    properties: {
      ...f.properties,
      groundElevation: buildingElevations[f.properties.buildingId] || 0
    }
  }))
};

// Atomic writes: write to .tmp then rename to prevent partial reads
function writeJsonAtomic(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}
writeJsonAtomic(path.join(dataDir, 'buildings.geojson'), enrichedBuildings);
writeJsonAtomic(path.join(dataDir, 'floors.geojson'), floorsGeo);
writeJsonAtomic(path.join(dataDir, 'rooms.geojson'), roomsGeo);
writeJsonAtomic(path.join(dataDir, 'assets.geojson'), assetsGeo);

console.log(`✓ buildings.geojson: ${enrichedBuildings.features.length} features (+ groundElevation)`);
console.log(`✓ floors.geojson:  ${floorFeatures.length} features (inset polygons + height)`);
console.log(`✓ rooms.geojson:   ${roomFeatures.length} features (corridor layout + height)`);
console.log(`✓ assets.geojson:  ${assetFeatures.length} features (positioned in rooms + height)`);

} // end main

main().catch(err => { console.error(err); process.exit(1); });
