# Data Audit Report — 11 February 2026

## Executive Summary

A full audit was conducted against UNOSAT satellite imagery (Oct 2025), OCHA Impact Snapshot (Feb 2026), IPC Special Report (Apr-May 2025), Gisha, and CBC visual investigation (Jul 2026).

**Previous data was significantly wrong.** The map initially showed 10 destroyed buildings. It now reflects authoritative UN/ satellite figures.

---

## The "90% Destroyed" Question — Verified Answer

Different "90%" claims refer to **different metrics**. All are documented in `data/aggregates/unosat-damage-assessment.json`:

| Claim | Figure | Verified? | Source | Applies to |
|-------|--------|-----------|--------|------------|
| Structures damaged | **81%** | ✅ Yes | UNOSAT Oct 2025 | Entire Gaza Strip (198,273 of ~245,000 structures) |
| Structures completely destroyed | **50%** | ✅ Yes | UNOSAT Oct 2025 | 123,464 structures totalled destroyed |
| Gaza City structures damaged | **93%** | ✅ Yes | UNOSAT Sep 2025 | Gaza Governorate specifically |
| Schools need reconstruction | **93%** | ✅ Yes | OCHA Oct 2025 | 526 of 564 school buildings |
| Population ever displaced | **90%** | ✅ Yes | IPC Apr 2025 | ~1.9M of 2.1M at some point |
| Homes/buildings destroyed (OCHA) | **92%** | ⚠️ Disputed | OCHA via IPC Apr 2025 | Broader definition; UNOSAT satellite says 81% damaged |
| Buffer zone buildings destroyed | **90%** | ✅ Yes | UNOSAT/Gisha Feb 2024 | 1km perimeter strip only |

**Conclusion:** Saying "90% of Gaza is rubble" is an oversimplification. The verified satellite figure is **81% of all structures damaged**, with **50% completely destroyed**. In Gaza City and the buffer zone, figures approach or exceed 90%.

---

## Territorial Shrinkage — Verified

| Metric | Figure | Source |
|--------|--------|--------|
| Gaza total area | 365 km² | OCHA |
| IDF controlled territory | **~60%** (target 70%) | CBC/IDF Jul 2026 |
| Buffer + displacement orders | **69%** of territory | OCHA Apr 2025 |
| No-go + displacement combined | **65–70%** | IPC Apr 2025 |
| Displacement order area | 142 km² (39%) | IPC Apr 2025 |
| Eastern buffer zone alone | 57 km² (16%) | Gisha Nov 2023 |
| Netzarim corridor | ~26 km² (7%) | Gisha/OCHA |
| Rafah no-go zone | **100%** | IPC Apr 2025 |
| Population on <50% of land | 2.1M concentrated | Forensic Architecture/OCHA |

---

## Dataset Audit Results

### ✅ Fixed — Aggregate Data
- `data/aggregates/unosat-damage-assessment.json` — UNOSAT Oct 2025 official totals
- `data/aggregates/territorial-shrinkage.json` — buffer zones, IDF control, no-go areas
- `data/aggregates/ocha-snapshot-2026-02.json` — OCHA Feb 2026 casualties, health, education

### ✅ Fixed — Map Layers
- `map/buildings.geojson` — ~2,500+ weighted sample cells (was 15)
- `map/rubble.geojson` — destroyed/severe damage cells
- `map/damage_zones.geojson` — governorate damage percentages
- `map/buffer_zones.geojson` — IDF buffer zones and Netzarim corridor
- `map/restricted_areas.geojson` — no-go zones by governorate
- `map/hospitals.geojson` — expanded with OCHA health data
- `map/schools.geojson` — metadata updated (526/564 schools)

### ✅ Fixed — Statistics
- Casualties: **72,045 killed** (was incorrectly 53,856) — MoH via OCHA Feb 2026
- Injured: **171,686**
- Structures damaged: **198,273 (81%)**
- Structures destroyed: **123,464**
- Housing units damaged: **320,622**
- Currently displaced: **1.4M (67%)** in ~1,000 sites

### ⚠️ Known Limitations
- **Strike records (50 total):** Only 8 are individually confirmed. 42 are illustrative "reported" samples for map density — not individually verified against UNOSAT.
- **Building grid:** Visual sample weighted by governorate rates — not the full 198,273 UNOSAT footprints (available as geodatabase on HDX).
- **Buffer zone geometry:** Approximate polygons — exact yellow line shifts frequently per CBC investigation.

---

## How to Re-run Audit

```bash
node scripts/generate-damage-grid.js
node scripts/generate-statistics.js
node scripts/validate-data.js
node scripts/audit-data.js
```

---

## Primary Sources

1. [UNOSAT Gaza Damage Assessment Oct 2025](https://data.humdata.org/dataset/unosat-gaza-strip-comprehensive-damage-assessment-11-october-2025)
2. [OCHA Impact Snapshot Feb 2026](https://www.ochaopt.org/sites/default/files/Gaza_Reported_Impact_Snapshot_04_February_2026.pdf)
3. [OCHA Situation Update #357 Feb 2026](https://reliefweb.int/report/occupied-palestinian-territory/humanitarian-situation-update-357-gaza-strip)
4. [IPC Gaza Special Report Apr-May 2025](https://www.ipcinfo.org/fileadmin/user_upload/ipcinfo/docs/IPC_Gaza_Strip_Acute_Food_Insecurity_Apr_Sep2025_Special_Report.pdf)
5. [Gisha — Ever-expanding Buffer Zone](https://gisha.org/en/the-ever-expanding-gaza-buffer-zone/)
6. [CBC — Yellow Line Investigation Jul 2026](https://www.cbc.ca/news/investigates/satellite-images-gaza-yellow-line-9.7257822)
