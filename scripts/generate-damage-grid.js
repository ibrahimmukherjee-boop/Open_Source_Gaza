#!/usr/bin/env node
/**
 * Generates a representative building damage grid across Gaza Strip
 * weighted by UNOSAT governorate damage percentages.
 * Run: node scripts/generate-damage-grid.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const UNOSAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/aggregates/unosat-damage-assessment.json'), 'utf8'));
const OUTPUT = path.join(ROOT, 'map', 'buildings.geojson');
const RUBBLE_OUTPUT = path.join(ROOT, 'map', 'rubble.geojson');
const ZONES_OUTPUT = path.join(ROOT, 'map', 'damage_zones.geojson');

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
  damagePct: g.damage_percent / 100,
  destroyedPct: g.destroyed_structures / g.damaged_structures,
  noGoPct: (g.no_go_zone_percent || 0) / 100
}));

const BUILDING_TYPES = ['residential', 'residential', 'residential', 'commercial', 'mosque', 'school', 'infrastructure'];
const GRID_STEP = 0.003;
const CELL_SIZE = 0.0015;

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function statusFromRandom(r, gov) {
  const destroyedThreshold = gov.damagePct * gov.destroyedPct;
  if (r < destroyedThreshold) return 'destroyed';
  if (r < gov.damagePct * 0.88) return 'severely_damaged';
  if (r < gov.damagePct) return 'moderately_damaged';
  if (r < gov.damagePct + 0.04) return 'damaged';
  return 'intact';
}

function makeCell(lng, lat, id, status, gov, type) {
  const floors = status === 'destroyed' ? 0 : Math.floor(seededRandom(id) * 5) + 1;
  return {
    type: 'Feature',
    properties: {
      id: `BLD-${String(id).padStart(6, '0')}`,
      type,
      status,
      floors,
      governorate: gov.name,
      source: 'UNOSAT-weighted model grid'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [lng, lat],
        [lng + CELL_SIZE, lat],
        [lng + CELL_SIZE, lat + CELL_SIZE * 0.8],
        [lng, lat + CELL_SIZE * 0.8],
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
        const r = seededRandom(id * 7.31 + lat * 100 + lng * 100);
        if (r > 0.78) continue;
        const status = statusFromRandom(seededRandom(id * 3.17), gov);
        const type = BUILDING_TYPES[Math.floor(seededRandom(id * 1.9) * BUILDING_TYPES.length)];
        features.push(makeCell(lng, lat, id++, status, gov, type));
      }
    }
  }

  return {
    type: 'FeatureCollection',
    metadata: {
      source: 'Generated grid weighted by UNOSAT Oct 2025 governorate damage rates',
      unosat_reference: UNOSAT.reference,
      total_features: features.length,
      official_structures_damaged: UNOSAT.totals.structures_damaged,
      official_structures_destroyed: UNOSAT.totals.structures_destroyed,
      note: 'Representative visual sample — official totals in data/aggregates/unosat-damage-assessment.json',
      updated: new Date().toISOString().split('T')[0]
    },
    features
  };
}

function generateRubbleZones(buildings) {
  const rubbleFeatures = buildings.features
    .filter(f => ['destroyed', 'severely_damaged'].includes(f.properties.status))
    .map(f => ({
      type: 'Feature',
      properties: {
        status: 'rubble',
        governorate: f.properties.governorate,
        source: 'UNOSAT-weighted'
      },
      geometry: f.geometry
    }));

  return {
    type: 'FeatureCollection',
    metadata: {
      source: 'Derived from destroyed/severe damage grid cells',
      grid_rubble_cells: rubbleFeatures.length,
      unosat_destroyed_total: UNOSAT.totals.structures_destroyed,
      unosat_severely_damaged: UNOSAT.totals.structures_severely_damaged
    },
    features: rubbleFeatures
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
      territory_wide_damage_percent: UNOSAT.totals.structures_damaged_percent,
      total_damaged: UNOSAT.totals.structures_damaged
    },
    features
  };
}

const buildings = generateBuildings();
const rubble = generateRubbleZones(buildings);
const zones = generateDamageZones();

fs.writeFileSync(OUTPUT, JSON.stringify(buildings));
fs.writeFileSync(RUBBLE_OUTPUT, JSON.stringify(rubble));
fs.writeFileSync(ZONES_OUTPUT, JSON.stringify(zones));

const counts = buildings.features.reduce((acc, f) => {
  acc[f.properties.status] = (acc[f.properties.status] || 0) + 1;
  return acc;
}, {});

console.log(`Generated ${buildings.features.length} building cells`);
console.log('Status breakdown:', counts);
console.log(`Rubble cells: ${rubble.features.length}`);
console.log(`UNOSAT official: ${UNOSAT.totals.structures_damaged.toLocaleString()} damaged, ${UNOSAT.totals.structures_destroyed.toLocaleString()} destroyed`);
