# Methodology

## Verification Pipeline

No single source is trusted alone. Every record requires:

1. **Primary source** — hospital record, witness account, or official report
2. **Corroboration** — video, satellite imagery, news report, or NGO documentation
3. **Geolocation** — GPS coordinates within Gaza Strip bounds (31.2–31.6°N, 34.2–34.6°E)
4. **Confidence score** — assigned based on source quality and corroboration count

## Verification Status

| Status | Definition |
|--------|------------|
| `confirmed` | Multiple independent sources agree |
| `probable` | Two sources, or one highly credible source with imagery |
| `reported` | Single source, pending corroboration |
| `disputed` | Conflicting reports exist |

## Revision History

Records are **never overwritten**. When information changes:

1. Update the record with new fields
2. Preserve `revision_history` array with timestamp, author, and change description
3. Git commit history provides full audit trail

## Aggregate Statistics

Totals displayed on the live map are computed from:

```sql
-- Conceptual query (implemented in scripts/generate-statistics.js)
SELECT COUNT(*) FROM casualties WHERE verification IN ('confirmed', 'probable');
SELECT COUNT(*) FROM strikes WHERE verification = 'confirmed';
```

Statistics are labeled with:
- **Verified count** — confirmed + probable records only
- **Reported count** — includes unverified reports
- **Source attribution** — which organizations contributed data
- **Last updated** — timestamp of last data merge

## 3D Reconstruction

Future integration with [LingBot-Map](https://github.com/) streaming 3D reconstruction will attach point clouds and meshes to verified strike locations from drone footage and ground video.

## Ethical Considerations

- Victim names are included only when publicly reported by families or official sources
- Child casualties are aggregated unless individually documented in public records
- Uncertain information is never presented as definitive
- All records include source URLs for independent verification
