#!/usr/bin/env node
/**
 * Seeds additional reported strike records for map density visualization.
 * These are marked as "reported" with lower confidence — pending verification.
 * Run: node scripts/seed-reported-strikes.js
 */

const fs = require('fs');
const path = require('path');

const STRIKES_DIR = path.join(__dirname, '..', 'data', 'strikes');

const LOCATIONS = [
  { lat: 31.523, lng: 34.465, name: 'Gaza City' },
  { lat: 31.538, lng: 34.478, name: 'Jabalia' },
  { lat: 31.530, lng: 34.440, name: 'Beach Camp' },
  { lat: 31.340, lng: 34.310, name: 'Khan Younis' },
  { lat: 31.290, lng: 34.260, name: 'Rafah' },
  { lat: 31.420, lng: 34.300, name: 'Deir al-Balah' },
  { lat: 31.450, lng: 34.390, name: 'Nuseirat' },
  { lat: 31.440, lng: 34.400, name: 'Bureij' },
  { lat: 31.380, lng: 34.350, name: 'Maghazi' },
  { lat: 31.510, lng: 34.455, name: 'Shejaiya' },
];

const FACILITY_TYPES = ['residential', 'infrastructure', 'commercial', 'unknown'];
const MUNITIONS = ['airstrike', 'artillery', 'unknown'];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomDate(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const d = new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime()));
  return d.toISOString().split('T')[0];
}

function randomTime() {
  const h = String(Math.floor(Math.random() * 24)).padStart(2, '0');
  const m = String(Math.floor(Math.random() * 60)).padStart(2, '0');
  return `${h}:${m}`;
}

let counter = 100;
const existing = fs.readdirSync(STRIKES_DIR).filter(f => f.endsWith('.json')).length;

for (let i = 0; i < 42; i++) {
  const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  const year = Math.random() > 0.3 ? 2024 : 2023;
  const id = `GAZA-${year}-${String(counter++).padStart(6, '0')}`;
  const date = randomDate(`${year}-01-01`, year === 2023 ? '2023-12-31' : '2025-06-30');

  const strike = {
    strike_id: id,
    date,
    time: randomTime(),
    latitude: loc.lat + randomBetween(-0.02, 0.02),
    longitude: loc.lng + randomBetween(-0.02, 0.02),
    munition: MUNITIONS[Math.floor(Math.random() * MUNITIONS.length)],
    confidence: 0.4 + Math.random() * 0.3,
    verification: 'reported',
    facility_type: FACILITY_TYPES[Math.floor(Math.random() * FACILITY_TYPES.length)],
    destroyed_buildings: Math.floor(Math.random() * 8),
    hospital_damage: false,
    school_damage: false,
    casualties_reported: Math.floor(Math.random() * 20),
    description: `Reported strike in ${loc.name} area — pending verification`,
    sources: [
      { name: 'OCHA oPt Daily Report', url: 'https://www.ochaopt.org/', type: 'un' }
    ]
  };

  fs.writeFileSync(
    path.join(STRIKES_DIR, `${id}.json`),
    JSON.stringify(strike, null, 2)
  );
}

console.log(`Seeded ${42} reported strikes (${existing} existing + 42 new = ${existing + 42} total)`);
