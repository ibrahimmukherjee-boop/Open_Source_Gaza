# Live Map of Humanitarian Conflict — Gaza

An open-source, version-controlled digital twin documenting verified strikes, casualties, and infrastructure damage in Gaza since October 7, 2023.

**Live site:** [https://ibrahimmukherjee.github.io/Open_Source_Gaza/](https://ibrahimmukherjee.github.io/Open_Source_Gaza/)

## Purpose

This project combines GIS, human rights documentation, 3D visualization, and transparent data versioning to make every reported event traceable — from strike location to casualty records, building damage, and source attribution.

> **Important:** This is an active conflict documentation project. All figures distinguish between *reported*, *verified*, and *estimated* information. Nothing is presented as definitive without source attribution and confidence scoring.

## Architecture

```
Satellite imagery · Drone footage · Witness reports · UN datasets · OSM
                              ↓
                    Verification Pipeline
                              ↓
              Strike Database · Casualty Database
                              ↓
                   Spatial Database (GeoJSON)
                              ↓
                    GitHub Repository (version control)
                              ↓
              Live Statistics · Interactive 3D Map · Public API
```

## Repository Layout

```
├── data/
│   ├── strikes/          # Individual strike records (JSON)
│   ├── casualties/       # Individual casualty records (JSON)
│   ├── buildings/        # Damaged/destroyed building records
│   ├── hospitals/        # Hospital status records
│   └── schemas/          # JSON Schema validation
├── map/
│   ├── roads.geojson
│   ├── buildings.geojson
│   ├── hospitals.geojson
│   ├── schools.geojson
│   └── refugee_camps.geojson
├── frontend/             # 3D interactive map application
├── api/                  # Static JSON API endpoints
├── scripts/              # Validation & statistics generators
├── verification/         # Verification pipeline rules
├── statistics/           # Generated aggregate statistics
└── docs/                 # Methodology & contribution guides
```

## Data Model

Every strike is a traceable record:

```json
{
  "strike_id": "GAZA-2025-000123",
  "date": "2025-02-18",
  "time": "14:31",
  "latitude": 31.523,
  "longitude": 34.452,
  "munition": "unknown",
  "confidence": 0.92,
  "sources": ["..."],
  "verification": "confirmed",
  "destroyed_buildings": 5,
  "hospital_damage": false
}
```

Every casualty links back to a strike, hospital record, witness, and news source.

## Verification Levels

| Confidence | Meaning |
|------------|---------|
| 0.95+ | Multiple independent sources (hospital + video + satellite + news) |
| 0.80 | Two corroborating sources |
| 0.60 | Single credible source |
| 0.40 | Unverified report |

## Live Statistics

Statistics are **computed**, not hard-coded:

```bash
node scripts/generate-statistics.js
```

This produces `statistics/latest.json` and `api/statistics.json` from verified records in `data/`.

## Running Locally

```bash
# Generate statistics from data files
node scripts/generate-statistics.js

# Validate all data records
node scripts/validate-data.js

# Serve locally
npx serve .
# Open http://localhost:3000
```

## Contributing

All updates go through Pull Requests with review. See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

1. Add a strike or casualty JSON file in the appropriate directory
2. Include sources and confidence score
3. Run validation: `node scripts/validate-data.js`
4. Open a PR — every merge creates permanent, auditable history

## Data Sources

- [OpenStreetMap](https://www.openstreetmap.org/) — building footprints, roads, POIs
- [OCHA oPt](https://www.ochaopt.org/) — humanitarian updates
- [UNRWA](https://www.unrwa.org/) — displacement figures
- [WHO](https://www.who.int/) — health facility status
- Media reports, NGO documentation, satellite imagery (where licensing permits)

## License

Data: [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/) where applicable  
Code: [MIT License](LICENSE)

## Disclaimer

This project documents reported humanitarian impact for transparency, research, journalism, and accountability. Aggregate totals reflect the methodology and verification status of underlying records. Figures may change as new evidence emerges.
