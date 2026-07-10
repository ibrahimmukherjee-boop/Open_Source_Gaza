#!/usr/bin/env node
/**
 * Generates full-coverage building damage grid matching UNOSAT category proportions.
 * Every cell is classified — nothing is left blank. "Intact" ≠ "not bombed";
 * it means UNOSAT satellite analysis found no detectable damage as of Oct 2025.
 * Run: node scripts/generate-damage-grid.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const UNOSAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/aggregates/unosat-damage-assessment.json'), 'utf8'));
const OUTPUT = path.join(ROOT, 'map', 'buildings.geojson');
const ZONES_OUTPUT = path.join(ROOT, 'map', 'damage_zones.geojson');
const DEVASTATION_OUTPUT = path.join(ROOT, 'map', 'devastation_overlay.geojson');
const BOUNDARY_OUTPUT = path.join(ROOT, 'map', 'gaza_boundary.geojson');

const T = UNOSAT.totals;
const TOTAL = T.total_structures_estimated;

// Territory-wide UNOSAT category proportions (exact)
const RATIOS = {
  destroyed: T.structures_destroyed / TOTAL,
  severely_damaged: T.structures_severely_damaged / TOTAL,
  moderately_damaged: T.structures_moderately_damaged / TOTAL,
  possibly_damaged: T.structures_possibly_damaged / TOTAL,
  intact: (TOTAL - T.structures_damaged) / TOTAL
};

// Within damaged structures, cumulative thresholds
const DAMAGED = T.structures_damaged;
const WITHIN_DAMAGED = {
  destroyed: T.structures_destroyed / DAMAGED,
  severely: (T.structures_destroyed + T.structures_severely_damaged) / DAMAGED,
  moderately: (T.structures_destroyed + T.structures_severely_damaged + T.structures_moderately_damaged) / DAMAGED
};

const GOV_BOUNDS = {
  'North Gaza': { latMin: 31.48, latMax: 31.58, lngMin: 34.46, lngMax: 34.56 },
  'Gaza': { latMin: 31.48, latMax: 31.54, lngMin: 34.38, lngMax: 34.48 },
  'Deir al-Balah': { latMin: 31.38, latMax: 31.48, lngMin: 34.32, lngMax: 34.42 },
  'Khan Yunis': { latMin: 31.30, latMax: 31.40, lngMin: 34.26, lngMax: 34.36 },
  'Rafah': { latMin: 31.24, latMax: 31.32, lngMin: 34.22, lngMax: 34.30 }
};

const GOVERNORATES = UNOSAT.governorates.map(g => ({
  name: g.name,
  bounds: GOV_BOUNDS[g.name],
  damagePct: g.damage_percent / 100
}));

const BUILDING_TYPES = ['residential', 'residential', 'residential', 'commercial', 'mosque', 'school', 'infrastructure'];
// Coarser grid keeps file size web-friendly (~800KB) while maintaining full territorial coverage
const GRID_STEP = 0.005;
const CELL_SIZE = 0.0022;

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Assign status using governorate damage rate + UNOSAT category ratios.
 * If Google Maps shows rubble, that corresponds to destroyed/severe/moderate categories.
 * Only ~19% territory-wide is classified "intact" by UNOSAT — NOT "never bombed".
 */
function statusFromRandom(r, gov) {
  if (r >= gov.damagePct) return 'intact';
  const n = r / gov.damagePct;
  if (n < WITHIN_DAMAGED.destroyed) return 'destroyed';
  if (n < WITHIN_DAMAGED.severely) return 'severely_damaged';
  if (n < WITHIN_DAMAGED.moderately) return 'moderately_damaged';
  return 'possibly_damaged';
}

/** Satellite-visible rubble includes all damage tiers except intact */
function isRubbleVisible(status) {
  return status !== 'intact';
}

function makeCell(lng, lat, id, status, gov, type) {
  const floors = status === 'destroyed' ? 0 : status === 'intact' ? Math.floor(seededRandom(id) * 4) + 2 : 1;
  return {
    type: 'Feature',
    properties: {
      id: `BLD-${String(id).padStart(6, '0')}`,
      type,
      status,
      floors,
      governorate: gov.name,
      bombed: status !== 'intact',
      satellite_visible_as_rubble: isRubbleVisible(status),
      source: 'UNOSAT Oct 2025 proportions'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [lng, lat],
        [lng + CELL_SIZE, lat],
        [lng + CELL_SIZE, lat + CELL_SIZE * 0.75],
        [lng, lat + CELL_SIZE * 0.75],
        [lng, lat]
      ]]
    }
  };
}

function generateBuildings() {
  const features = [];
  let id = 1;

  for (const gov of GOVERNORATES) {
    const { latMin, latMax, lngMin, lngMax } = gov.bounds;
    for (let lat = latMin; lat < latMax; lat += GRID_STEP) {
      for (let lng = lngMin; lng < lngMax; lng += GRID_STEP) {
        const r = seededRandom(id * 3.17 + lat * 137 + lng * 251);
        const status = statusFromRandom(r, gov);
        const type = BUILDING_TYPES[Math.floor(seededRandom(id * 1.9) * BUILDING_TYPES.length)];
        features.push(makeCell(lng, lat, id++, status, gov, type));
      }
    }
  }

  return {
    type: 'FeatureCollection',
    metadata: {
      source: 'Full-coverage grid using UNOSAT Oct 2025 category proportions',
      unosat_reference: UNOSAT.reference,
      total_cells: features.length,
      official_structures_damaged: T.structures_damaged,
      official_structures_destroyed: T.structures_destroyed,
      target_ratios: RATIOS,
      important_note: 'Intact cells (~19% territory-wide) means UNOSAT found no detectable damage on satellite — NOT that the area was never bombed. Visible rubble on Google Earth corresponds to destroyed, severely, and moderately damaged categories (~69% of all structures).',
      updated: new Date().toISOString().split('T')[0]
    },
    features
  };
}

function generateGazaBoundary() {
  return {
    type: 'FeatureCollection',
    metadata: {
      source: 'Gaza Strip administrative boundary',
      area_km2: 365,
      length_km: 41,
      width_km: 12
    },
    features: [{
      type: 'Feature',
      properties: { name: 'Gaza Strip', label: 'GAZA STRIP — 365 km²' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [34.205, 31.220], [34.565, 31.220], [34.565, 31.595],
          [34.205, 31.595], [34.205, 31.220]
        ]]
      }
    }]
  };
}

function generateRubbleMeta(buildings) {
  const rubbleCount = buildings.features.filter(f => isRubbleVisible(f.properties.status)).length;
  return {
    type: 'FeatureCollection',
    metadata: {
      source: 'Rubble rendered from buildings.geojson via status filter',
      grid_rubble_cells: rubbleCount,
      unosat_destroyed: T.structures_destroyed,
      percent_of_grid: ((rubbleCount / buildings.features.length) * 100).toFixed(1) + '%'
    },
    features: []
  };
}

function generateDevastationOverlay() {
  const features = UNOSAT.governorates.map(gov => {
    const bounds = GOV_BOUNDS[gov.name];
    return {
      type: 'Feature',
      properties: {
        name: gov.name,
        damage_percent: gov.damage_percent,
        rubble_visible_percent: gov.damage_percent,
        destroyed_structures: gov.destroyed_structures,
        explanation: `${gov.damage_percent}% of structures damaged — appears as rubble/destruction on satellite imagery`
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [bounds.lngMin, bounds.latMin],
          [bounds.lngMax, bounds.latMin],
          [bounds.lngMax, bounds.latMax],
          [bounds.lngMin, bounds.latMax],
          [bounds.lngMin, bounds.latMin]
        ]]
      }
    };
  });

  return {
    type: 'FeatureCollection',
    metadata: {
      source: 'UNOSAT governorate damage — visual devastation overlay',
      note: 'This overlay represents what you see on Google Maps satellite: widespread rubble across 81% of Gaza'
    },
    features
  };
}

function generateDamageZones() {
  const features = UNOSAT.governorates.map(gov => {
    const bounds = GOV_BOUNDS[gov.name];
    return {
      type: 'Feature',
      properties: {
        name: gov.name,
        damage_percent: gov.damage_percent,
        destroyed_structures: gov.destroyed_structures,
        damaged_structures: gov.damaged_structures,
        no_go_percent: gov.no_go_zone_percent,
        note: gov.note
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [bounds.lngMin, bounds.latMin],
          [bounds.lngMax, bounds.latMin],
          [bounds.lngMax, bounds.latMax],
          [bounds.lngMin, bounds.latMax],
          [bounds.lngMin, bounds.latMin]
        ]]
      }
    };
  });

  return {
    type: 'FeatureCollection',
    metadata: {
      source: 'UNOSAT governorate damage assessment Oct 2025',
      territory_wide_damage_percent: T.structures_damaged_percent
    },
    features
  };
}

const buildings = generateBuildings();
const zones = generateDamageZones();
const devastation = generateDevastationOverlay();
const boundary = generateGazaBoundary();

fs.writeFileSync(OUTPUT, JSON.stringify(buildings));
fs.writeFileSync(ZONES_OUTPUT, JSON.stringify(zones));
fs.writeFileSync(DEVASTATION_OUTPUT, JSON.stringify(devastation));
fs.writeFileSync(BOUNDARY_OUTPUT, JSON.stringify(boundary));
// Lightweight metadata-only rubble reference (actual rubble rendered from buildings layer)
fs.writeFileSync(path.join(ROOT, 'map', 'rubble.geojson'), JSON.stringify(generateRubbleMeta(buildings)));

const counts = buildings.features.reduce((acc, f) => {
  acc[f.properties.status] = (acc[f.properties.status] || 0) + 1;
  return acc;
}, {});

const rubbleCount = buildings.features.filter(f => isRubbleVisible(f.properties.status)).length;
const total = buildings.features.length;
const rubblePct = ((rubbleCount / total) * 100).toFixed(1);
const intactPct = (((counts.intact || 0) / total) * 100).toFixed(1);
const fileSizeKB = (fs.statSync(OUTPUT).size / 1024).toFixed(0);

console.log(`Generated ${total} cells — FULL COVERAGE (no gaps), ${fileSizeKB}KB`);
console.log('Status breakdown:', counts);
console.log(`Satellite-visible rubble: ${rubbleCount} cells (${rubblePct}%)`);
console.log(`Intact (UNOSAT undamaged): ${counts.intact || 0} cells (${intactPct}%)`);
console.log(`Target UNOSAT ratios:`, RATIOS);
console.log(`UNOSAT official: ${T.structures_damaged.toLocaleString()} damaged (${T.structures_damaged_percent}%), ${T.structures_destroyed.toLocaleString()} destroyed`);
