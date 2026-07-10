#!/usr/bin/env node
/**
 * Generates aggregate statistics from verified data records.
 * Run: node scripts/generate-statistics.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STRIKES_DIR = path.join(ROOT, 'data', 'strikes');
const CASUALTIES_DIR = path.join(ROOT, 'data', 'casualties');
const BUILDINGS_FILE = path.join(ROOT, 'map', 'buildings.geojson');
const HOSPITALS_FILE = path.join(ROOT, 'map', 'hospitals.geojson');
const SCHOOLS_FILE = path.join(ROOT, 'map', 'schools.geojson');
const CAMPS_FILE = path.join(ROOT, 'map', 'refugee_camps.geojson');

function readJsonDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

function readGeoJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function countByField(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function strikesPerDay(strikes) {
  return strikes.reduce((acc, s) => {
    acc[s.date] = (acc[s.date] || 0) + 1;
    return acc;
  }, {});
}

function main() {
  const strikes = readJsonDir(STRIKES_DIR);
  const casualties = readJsonDir(CASUALTIES_DIR);
  const buildings = readGeoJson(BUILDINGS_FILE);
  const hospitals = readGeoJson(HOSPITALS_FILE);
  const schools = readGeoJson(SCHOOLS_FILE);
  const camps = readGeoJson(CAMPS_FILE);

  const verifiedStrikes = strikes.filter(s => ['confirmed', 'probable'].includes(s.verification));
  const reportedStrikes = strikes.filter(s => s.verification === 'reported');
  const verifiedCasualties = casualties.filter(c => ['confirmed', 'probable'].includes(c.verification));

  const totalReportedCasualties = strikes.reduce((sum, s) => sum + (s.casualties_reported || 0), 0);
  const totalDisplaced = camps.features.reduce((sum, f) => sum + (f.properties.displaced || 0), 0);
  const destroyedBuildings = buildings.features.filter(f => f.properties.status === 'destroyed').length;
  const damagedBuildings = buildings.features.filter(f => f.properties.status === 'damaged').length;
  const destroyedHospitals = hospitals.features.filter(f => f.properties.status === 'destroyed').length;
  const destroyedSchools = schools.features.filter(f => f.properties.status === 'destroyed').length;

  const ochaEstimates = {
    note: "OCHA/UN reported aggregate figures — see sources. Individual records in this repo are verified separately.",
    reported_killed: 53856,
    reported_injured: 124000,
    displaced: 1900000,
    source: "https://www.ochaopt.org/"
  };

  const stats = {
    generated_at: new Date().toISOString(),
    methodology: "Statistics computed from verified records in data/ directory. OCHA aggregates shown separately.",
    strikes: {
      total: strikes.length,
      verified: verifiedStrikes.length,
      reported_unverified: reportedStrikes.length,
      by_verification: countByField(strikes, 'verification'),
      by_facility_type: countByField(strikes, 'facility_type'),
      hospital_strikes: strikes.filter(s => s.hospital_damage).length,
      school_strikes: strikes.filter(s => s.school_damage).length,
      total_destroyed_buildings: strikes.reduce((s, x) => s + (x.destroyed_buildings || 0), 0),
      per_day: strikesPerDay(strikes),
      start_date: "2023-10-07",
      latest_date: strikes.sort((a, b) => b.date.localeCompare(a.date))[0]?.date
    },
    casualties: {
      verified_records: verifiedCasualties.length,
      killed: verifiedCasualties.filter(c => c.status === 'killed').length,
      injured: verifiedCasualties.filter(c => c.status === 'injured').length,
      missing: verifiedCasualties.filter(c => c.status === 'missing').length,
      reported_from_strikes: totalReportedCasualties,
      by_verification: countByField(casualties, 'verification')
    },
    infrastructure: {
      buildings_destroyed: destroyedBuildings,
      buildings_damaged: damagedBuildings,
      buildings_total: buildings.features.length,
      hospitals_destroyed: destroyedHospitals,
      hospitals_total: hospitals.features.length,
      schools_destroyed: destroyedSchools,
      schools_total: schools.features.length
    },
    displacement: {
      from_camps_data: totalDisplaced,
      ocha_estimate: ochaEstimates.displaced
    },
    ocha_aggregates: ochaEstimates
  };

  const statsDir = path.join(ROOT, 'statistics');
  const apiDir = path.join(ROOT, 'api');
  fs.mkdirSync(statsDir, { recursive: true });
  fs.mkdirSync(apiDir, { recursive: true });

  fs.writeFileSync(path.join(statsDir, 'latest.json'), JSON.stringify(stats, null, 2));
  fs.writeFileSync(path.join(apiDir, 'statistics.json'), JSON.stringify(stats, null, 2));

  const strikesIndex = strikes.map(s => ({
    id: s.strike_id,
    date: s.date,
    time: s.time,
    lat: s.latitude,
    lng: s.longitude,
    verification: s.verification,
    confidence: s.confidence,
    facility_type: s.facility_type,
    casualties: s.casualties_reported || 0,
    destroyed_buildings: s.destroyed_buildings || 0,
    description: s.description
  }));

  fs.writeFileSync(path.join(apiDir, 'strikes.json'), JSON.stringify(strikesIndex, null, 2));
  fs.writeFileSync(path.join(apiDir, 'casualties.json'), JSON.stringify(casualties, null, 2));

  console.log('Statistics generated:');
  console.log(`  Strikes: ${stats.strikes.total} (${stats.strikes.verified} verified)`);
  console.log(`  Buildings destroyed: ${stats.infrastructure.buildings_destroyed}`);
  console.log(`  Hospitals destroyed: ${stats.infrastructure.hospitals_destroyed}`);
  console.log(`  Output: statistics/latest.json, api/statistics.json`);
}

main();
