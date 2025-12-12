# NYC Building Safety Risk Score Map - Implementation Plan

## 1. Project Overview
**Goal**: Build a high-performance, interactive web application that visualizes safety risk scores for NYC buildings.
**Core Value**: Empower residents and stakeholders with transparency regarding building safety (violations, complaints, age, etc.).
**Output**: A Next.js application with a Mapbox GL JS interactive map, data processing scripts, and a "premium" UI.

## 2. Technology Stack
- **Framework**: Next.js (React) - for robust routing, API capabilities, and performance.
- **Language**: TypeScript - for type safety, especially with complex data structures.
- **Styling**: Vanilla CSS (CSS Modules) - focusing on HSL variables, glassmorphism, and smooth animations.
- **Map Engine**: MapLibre GL JS (via `react-map-gl/maplibre` or direct wrapper) - open-source fork of Mapbox GL JS, ensuring free usage without API keys for the rendering engine.
- **Data Processing**: Node.js scripts - to fetch from NYC Open Data (Socrata API), merge, and score.
- **State Management**: React Context / Hooks - for filters and map state.

## 3. Data Pipeline & Risk Scoring
The backend logic will be a set of extraction and processing scripts to generate a generic `buildings.json` or GeoJSON file for the frontend (or serve via API).

### Data Sources (NYC Open Data)
1.  **DOB Violations**: Active/Open violations.
2.  **HPD Violations**: Housing maintenance issues.
3.  **311 Service Requests**: Complaints (Heat, Hot Water, etc.) - filtered for last 12-24 months.
4.  **PLUTO**: Base building data (Age, Units, BBL, Geometry).

### Scoring Algorithm (0-100)
*Lower is better? Or Higher is better?*
*User specified: "assignments a Safety Risk Score... Green -> Red". Usually High Score = High Risk.*

**Formula**:
`Risk = (DOB_Norm * 0.3) + (HPD_Norm * 0.25) + (311_Norm * 0.2) + (Age_Norm * 0.1) + (Permits_Norm * 0.1) + (Landlord_Norm * 0.05)`

*Normalization*: We will percentile-rank or min-max normalize counts per unit to avoid penalizing large buildings unfairly.

## 4. Frontend Architecture

### Core Components
- **`RiskMap`**: The main MapLibre map component.
- **`OverlayPanel`**: Glassmorphic sidebar showing details for selected building.
- **`FilterBar`**: Floating controls for toggling datasets and risk thresholds.
- **`SearchBar`**: Custom search implementation (using NYC Planning Labs Geosearch API or OSM Nominatim) to jump to address.
- **`ScoreCard`**: A visual gauge/circle visualizing the score.

### Design Aesthetic "Premium & Dynamic"
- **Theme**: Dark mode default with neon accents (Safety Green to Danger Red).
- **Effects**:
    - Translucent panels (backdrop-filter: blur).
    - Smooth usage of transitions for hover states.
    - Animated score counters.
- **Typography**: `Inter` or `Outfit` for a clean, modern look.

## 5. Implementation Steps

### Phase 1: Setup & Foundation
1.  Initialize Next.js project.
2.  Configure Global CSS (Variables, Reset, Fonts).
3.  Set up basic layout shell.

### Phase 2: Data Engineering (The Hard Part)
1.  [x] Write script `scripts/fetch_data.ts` to pull sample data (Manhattan, Bronx, Brooklyn).
2.  [x] Implement `calculateScore.ts` logic.
3.  [x] Generate `public/data/buildings_subset.geojson`.

### Phase 3: Map Integration
1.  [x] Install `maplibre-gl`.
2.  [x] Render the Map using a free vector tile source (e.g., Carto or Protomaps) or maintain just the GeoJSON overlay on a blank/minimal style.
3.  [x] Load the GeoJSON source.
4.  [x] Style buildings based on `properties.risk_score`.

### Phase 4: UI & Interactivity
1.  [x] Build the `Sidebar` for viewing details.
2.  [x] Implement click interactions (zoom to building, show details).
3.  [x] Add Search and Filter logic.
4.  [x] **Features Added**:
    - [x] Full Address Display (with Borough/Zip).
    - [x] Owner Information Integration (MapPLUTO).
    - [x] Tooltip Explanations for data points.
    - [x] "Recent Activity" feed (DOB/HPD/311 Timeline) with full text and deduplication.

### Phase 5: Polish & UX
1.  Add Loading states and Animations.
2.  Refine color palettes.
3.  [ ] **New Feature**: "Report Card" Export (Download PDF/Image).
4.  [ ] SEO Meta tags.

## 6. Questions/Prerequisites
- **Mapbox Token**: Do you have a Mapbox public key? (I can use a free placeholder or fallback to Leaflet if strictly necessary, but Mapbox is better for this).
- **Data Scope**: Fetching *all* NYC buildings is heavy (1M+ rows). We will start with a specific borough or neighborhood (e.g., Lower Manhattan) for the prototype.

