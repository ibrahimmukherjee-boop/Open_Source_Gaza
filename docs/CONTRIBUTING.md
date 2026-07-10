# Contributing Guide

## Adding a Strike Record

1. Create a file: `data/strikes/GAZA-YYYY-NNNNNN.json`
2. Follow the schema in `data/schemas/strike.schema.json`
3. Required fields: `strike_id`, `date`, `latitude`, `longitude`, `verification`, `confidence`, `sources`
4. Run validation before submitting

## Adding a Casualty Record

1. Create a file: `data/casualties/CAS-YYYY-NNNNNN.json`
2. Link to associated strike via `associated_strike` field
3. Include at least one source URL
4. Set `verification` status honestly — use `reported` if unconfirmed

## Pull Request Process

1. Fork the repository
2. Create a branch: `data/add-strike-GAZA-2025-000456`
3. Add your JSON record(s)
4. Run `node scripts/validate-data.js`
5. Run `node scripts/generate-statistics.js`
6. Open PR with:
   - Description of what you're adding
   - Source links
   - Verification rationale

## Confidence Scoring Guide

| Score | Criteria |
|-------|----------|
| 0.95 | Hospital + video + satellite + news |
| 0.85 | Two of: hospital, video, satellite, UN report |
| 0.70 | Credible news + witness or NGO report |
| 0.50 | Single credible news source |
| 0.40 | Unverified social media or single witness |

## Coordinate Validation

All coordinates must fall within Gaza Strip bounds:
- Latitude: 31.200 – 31.600
- Longitude: 34.200 – 34.600

Invalid coordinates will fail CI validation.
