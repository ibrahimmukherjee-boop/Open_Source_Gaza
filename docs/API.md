# API Documentation

Static JSON endpoints served from GitHub Pages.

## Endpoints

### GET `/api/statistics.json`
Aggregate statistics computed from verified records.

```json
{
  "strikes": { "total": 50, "verified": 8 },
  "casualties": { "verified_records": 3 },
  "infrastructure": { "buildings_destroyed": 10 },
  "displacement": { "ocha_estimate": 1900000 }
}
```

### GET `/api/strikes.json`
Array of all strike records with coordinates and metadata.

### GET `/api/casualties.json`
Array of all casualty records.

### GET `/data/strikes/{strike_id}.json`
Individual strike record with full source attribution.

### GET `/map/{layer}.geojson`
Geographic layers: `buildings`, `hospitals`, `schools`, `refugee_camps`, `roads`.

## Usage

```bash
curl https://ibrahimmukherjee.github.io/Open_Source_Gaza/api/statistics.json
curl https://ibrahimmukherjee.github.io/Open_Source_Gaza/api/strikes.json
```

All data is version-controlled. Check git history for record revisions.
