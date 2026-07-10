#!/usr/bin/env node
/**
 * Validates all data records against schemas and coordinate bounds.
 * Run: node scripts/validate-data.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const GAZA_BOUNDS = {
  lat: { min: 31.2, max: 31.6 },
  lng: { min: 34.2, max: 34.6 }
};

const STRIKE_ID_PATTERN = /^GAZA-[0-9]{4}-[0-9]{6}$/;
const CASUALTY_ID_PATTERN = /^CAS-[0-9]{4}-[0-9]{6}$/;
const VALID_VERIFICATION = ['confirmed', 'probable', 'reported', 'disputed'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

let errors = 0;
let warnings = 0;
const seenIds = new Set();

function error(file, msg) {
  console.error(`  ERROR [${file}]: ${msg}`);
  errors++;
}

function warn(file, msg) {
  console.warn(`  WARN  [${file}]: ${msg}`);
  warnings++;
}

function validateCoords(file, lat, lng) {
  if (lat < GAZA_BOUNDS.lat.min || lat > GAZA_BOUNDS.lat.max) {
    error(file, `Latitude ${lat} out of Gaza bounds`);
  }
  if (lng < GAZA_BOUNDS.lng.min || lng > GAZA_BOUNDS.lng.max) {
    error(file, `Longitude ${lng} out of Gaza bounds`);
  }
}

function validateStrike(file, data) {
  const name = path.basename(file);

  if (!data.strike_id || !STRIKE_ID_PATTERN.test(data.strike_id)) {
    error(name, 'Invalid or missing strike_id');
  }
  if (seenIds.has(data.strike_id)) {
    error(name, `Duplicate strike_id: ${data.strike_id}`);
  }
  seenIds.add(data.strike_id);

  if (!data.date || !DATE_PATTERN.test(data.date)) error(name, 'Invalid date');
  if (data.latitude === undefined) error(name, 'Missing latitude');
  if (data.longitude === undefined) error(name, 'Missing longitude');
  else validateCoords(name, data.latitude, data.longitude);

  if (!VALID_VERIFICATION.includes(data.verification)) {
    error(name, `Invalid verification: ${data.verification}`);
  }
  if (data.confidence === undefined || data.confidence < 0 || data.confidence > 1) {
    error(name, 'Confidence must be 0-1');
  }
  if (!Array.isArray(data.sources) || data.sources.length === 0) {
    error(name, 'At least one source required');
  }

  if (data.verification === 'confirmed' && data.confidence < 0.8) {
    warn(name, 'Confirmed strike with low confidence score');
  }
}

function validateCasualty(file, data) {
  const name = path.basename(file);

  if (!data.casualty_id || !CASUALTY_ID_PATTERN.test(data.casualty_id)) {
    error(name, 'Invalid or missing casualty_id');
  }
  if (seenIds.has(data.casualty_id)) {
    error(name, `Duplicate casualty_id: ${data.casualty_id}`);
  }
  seenIds.add(data.casualty_id);

  if (!data.date || !DATE_PATTERN.test(data.date)) error(name, 'Invalid date');
  validateCoords(name, data.latitude, data.longitude);

  if (!VALID_VERIFICATION.includes(data.verification)) {
    error(name, `Invalid verification: ${data.verification}`);
  }
  if (!['killed', 'injured', 'missing'].includes(data.status)) {
    error(name, `Invalid status: ${data.status}`);
  }
  if (!Array.isArray(data.sources) || data.sources.length === 0) {
    error(name, 'At least one source required');
  }
}

function validateDirectory(dir, validator) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  console.log(`\nValidating ${files.length} files in ${path.relative(ROOT, dir)}/`);
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      validator(filePath, data);
    } catch (e) {
      error(file, `JSON parse error: ${e.message}`);
    }
  }
}

function checkDuplicatesAcrossStrikes() {
  const dir = path.join(ROOT, 'data', 'strikes');
  const strikes = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));

  for (let i = 0; i < strikes.length; i++) {
    for (let j = i + 1; j < strikes.length; j++) {
      const a = strikes[i], b = strikes[j];
      const dist = Math.sqrt(
        Math.pow(a.latitude - b.latitude, 2) + Math.pow(a.longitude - b.longitude, 2)
      );
      if (dist < 0.0001 && a.date === b.date) {
        warn('duplicate-check', `Possible duplicate: ${a.strike_id} and ${b.strike_id} on ${a.date}`);
      }
    }
  }
}

console.log('=== Gaza Live Map Data Validation ===');
seenIds.clear();
validateDirectory(path.join(ROOT, 'data', 'strikes'), validateStrike);
seenIds.clear();
validateDirectory(path.join(ROOT, 'data', 'casualties'), validateCasualty);
checkDuplicatesAcrossStrikes();

console.log(`\n=== Results: ${errors} errors, ${warnings} warnings ===`);
process.exit(errors > 0 ? 1 : 0);
