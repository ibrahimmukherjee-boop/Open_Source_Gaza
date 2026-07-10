# Verification Pipeline Rules

## Source Requirements

### Confirmed (confidence >= 0.85)
Requires at least 2 of:
- Hospital or medical record
- Video evidence
- Satellite imagery analysis
- UN/OCHA official report
- Major news outlet with on-ground correspondent

### Probable (confidence 0.65–0.84)
Requires at least 1 of:
- Credible NGO report (MSF, Amnesty, HRW)
- UN agency report
- Multiple witness accounts

### Reported (confidence 0.40–0.64)
- Single news source
- OCHA daily report mention
- Social media with geolocation

### Disputed
- Conflicting reports from credible sources
- Cannot determine strike vs other cause

## Coordinate Validation
- Must fall within Gaza Strip: 31.2°–31.6°N, 34.2°–34.6°E
- Precision: minimum 4 decimal places preferred

## Duplicate Detection
- Same date + location within 100m = flag for review
- Same strike_id = reject

## Automated Checks (CI)
1. JSON schema validation
2. Coordinate bounds check
3. Duplicate ID detection
4. Required source fields
5. Confidence/verification consistency
