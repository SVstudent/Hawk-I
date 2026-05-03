# Project Hawk-I — C2 Dashboard

## Overview

Full-stack military Command & Control (C2) dashboard — Red Sea / Suez supply chain security theater. pnpm monorepo, TypeScript throughout.

**Key differentiator**: Supply chain impact analysis grounded in Palantir Foundry ontological data across 10 live object types (146 nodes, 136 edges). Full moving-object theater picture: 10 aircraft, 6 naval vessels, 8 ground convoys, 14 supply chain nodes, 8 logistics routes, 5 air corridors, 35 military bases across Egypt→Syria→Somalia theater.

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **API framework**: Express 5
- **Frontend**: React + Vite + Tailwind CSS + Deck.gl v9.3 + react-map-gl
- **Map**: Mapbox satellite-streets v12 (WebGL), SVG fallback
- **Markdown rendering**: react-markdown v10 (HAWK-I chat responses)
- **Validation**: Zod (via OpenAPI codegen)
- **API codegen**: Orval (OpenAPI → React Query hooks + Zod schemas)
- **AI**: GPT-5.4 via Replit AI Integrations proxy (no key required)
- **Long-term memory**: Palantir AIP `ExampleRv17memory` object + actions

## Architecture

### Layout — Maven-Class Grid

```
[TopBar — NORAD-ALPHA header, stats, Zulu clock]
[LeftPanel (28%) | Center Map (flex) | RightPanel (28%)]
[BottomBar — API status, F2T2EA kill-chain, telemetry]
[HAWK-I FAB — floating bottom-right chat overlay]
```

### Center Map (Geospatial Truth)

Deck.gl layers (bottom → top):

| Layer | Type | Description |
|---|---|---|
| `shipping-lanes` | PathLayer | 6 shipping corridors: Red Sea, Gulf of Aden, Indian Ocean, Mediterranean, Cape of Good Hope, Persian Gulf |
| `air-corridors` | PathLayer | 5 dashed air corridors: ALPHA (AUAB→CLJ), BRAVO (Dhafra→Thumrait), CHARLIE (Akrotiri→Red Sea), DELTA (DG→AUAB), MED |
| `logistics-routes` | PathLayer | 8 ground MSRs/rail: Kuwait-Riyadh, Jordan MSR, Saudi Land Bridge Rail, Cairo-Suez Rail, Djibouti-Ethiopia, Iraq MSR, Turkey Rail, Oman |
| `sc-impact-arcs` | ArcLayer | Demo-only supply chain disruption arcs (per scene 1-10) |
| `disruption-zones` | ScatterplotLayer | Animated pulsing disruption rings (per scene) |
| `ambient-vessels` | ScatterplotLayer | 35 commercial vessels (tankers, containers, bulk) with AIS hover tooltips |
| `chokepoints-fill` | ScatterplotLayer | 12 strategic chokepoints + ports (Bab-el-Mandeb, Suez, Hormuz, Gibraltar…) |
| `chokepoint-labels` | TextLayer | Labels for strategic chokepoints |
| `mil-base-fill` | ScatterplotLayer | 35 military bases (nation-color coded): US/UK/FR/IT/JO/OM/SA/TR/IL/IQ/ET/RU/AU |
| `supply-nodes-fill` | ScatterplotLayer | 14 supply chain nodes: ports/airports/depots, status-colored (OPERATIONAL/DEGRADED/DISRUPTED/HOSTILE) |
| `supply-nodes-labels` | TextLayer | Supply node short labels |
| `mil-vessels-fill` | ScatterplotLayer | 6 animated military vessels (USS Bainbridge DDG-96, USS Bataan LHD-5, HMS Diamond D34, HMAS Anzac FFH-150, FNS Provence D652, CNS Nanchang 101) |
| `mil-vessels-labels` | TextLayer | Vessel name labels |
| `convoys-fill` | ScatterplotLayer | 8 animated ground convoys (road+rail), status-colored (MOVING/DELAYED/HALTED/DIVERTED) |
| `convoys-labels` | TextLayer | Convoy callsign labels |
| `demo-tracks-layer` | ScatterplotLayer | Demo military tracks (friendly/hostile/unknown) with ontology provenance |
| `cyber-threats-layer` | ScatterplotLayer | Shodan / demo cyber threats with severity coloring |
| `aircraft-fill` | ScatterplotLayer | 10 animated aircraft: EAGLE-01/02 C-17/C-130, RAPTOR-01 P-8, SHADOW-01 MQ-9, GUARDIAN-01 E-3 AWACS, FURY-01 KC-135, ATLAS-01 C-17, FALCON-01 F-35, GHOST-01 RQ-4, CALYPSO-01 P-8 |
| `aircraft-labels` | TextLayer | Aircraft callsign labels |

Fixed overlays: coordinates HUD, map legend (expanded), supply chain impact panel (demo only), narration banner.
Hover tooltips: ambient vessel, chokepoint, military base, aircraft, military vessel, convoy, supply chain node.

### Left Panel (Raw Ingestion) — Tabbed
- **CYBER_FEED**: Live Shodan ICS/SCADA threats, severity-sorted
- **OSINT_FEED**: Exa intelligence feed (START/STOP, 2-min auto-refresh)
- **KINETIC_TRACKS**: Radar tracks (hostile → unknown → neutral → friendly)

### Right Panel (Ontology & AI) — 2-column
- **Top 44%**: AI_RECOMMENDATIONS — COA items with evidence chains, confidence bars, Palantir Foundry links
- **Bottom 56%**: ONTOLOGY_GRAPH — Palantir entity graph edges (live via OSDK v2)

### HAWK-I Chat (floating overlay, bottom-right FAB)
- 460×580px chat window, round crosshair FAB
- **react-markdown** rendering: headers, bullets, bold, code blocks, all styled to military terminal aesthetic
- Palantir AIP Long-Term Memory (ExampleRv17memory object)
- RAG engine: 10 Palantir datasets + battlespace context + session history
- BLACKBOX drawer: shows full provenance (memory count, ontology RID, datasets queried)
- Pulse animation on FAB when demo scenes advance
- Scene context strip shows active intel counts

### Bottom Bar
- API status: SHODAN / EXA / PALANTIR LIVE
- F2T2EA kill-chain tracker
- Demo session progress bar + START/SESSION COMPLETE button

## Demo Scenes (7 scenes, ~63 seconds)

| # | Label | Location | Key Data |
|---|---|---|---|
| 1 | THEATER OVERVIEW | Red Sea AOR | Initial tracks |
| 2 | HOUTHI UAV SWARM | Gulf of Aden | SIGINT, ISR, HUMINT |
| 3 | ASBM STRIKE | Red Sea | Kinetic incident, AIS, HUMINT |
| 4 | APT-41 SUEZ SCADA | Port Said | IOCs, SIGINT, cyber threats |
| 5 | DNP3 POWER GRID | Ismailia | ICS SCADA, HUMINT, IOCs |
| 6 | IRGC GPS SPOOFING | Gulf of Aden | ELINT, COMINT, AIS deviation |
| 7 | COA GENERATION | Full Theater | All 10 datasets, 3 COAs |

Supply chain impact data (`SC_IMPACTS` dict in `c2-map.tsx`) activates for scenes 2–7, showing disruption arcs + pulsing zones with cargo-at-risk and delay data.

## Palantir OSDK v2 (Live)

10 object types, polled every 30s:
- LogisticsVessel, HostileThreat, CombatUnit, ConfirmedKineticIncident
- GeneratedTacticalLead, SigintIntercept, IsrImagery, HumintReport
- MaritimeAisTrack, CyberIoc

AIP Memory: `ExampleRv17memory` — actions: `example-rv17-create-memory` / `example-rv17-delete-memory`

**CRITICAL**: Foundry API returns FLAT objects in `page.data` — do NOT do `.map(obj => obj.properties)`.

## Key Files

```
artifacts/c2-dashboard/src/
  components/
    map/c2-map.tsx                  — All DeckGL layers + supply chain map data
    panels/hawk-i-chat.tsx          — HAWK-I chat overlay with react-markdown
    panels/right-panel.tsx          — COA + Ontology panels
    panels/bottom-bar.tsx           — Session control + status
  demo/
    demo-scenes.ts                  — 7 scenes, all intel types, ontology edges
    demo-context.tsx                — Demo state machine + reducer
  pages/dashboard.tsx               — Layout composition

artifacts/api-server/src/
  core/rag-engine.ts                — GPT-5.4 RAG + AIP memory
  routes/chat.ts                    — POST /chat (streaming-ready)
```

## API Routes

| Route | Method | Description |
|---|---|---|
| /api/chat | POST | HAWK-I RAG query (GPT-5.4 + AIP memory + 10 datasets) |
| /api/memory | GET | AIP memory count |
| /api/memory/clear | POST | Clear all long-term memories |
| /api/tracks | GET | Radar tracks |
| /api/shodan/threats | GET | ICS/SCADA vulnerabilities |
| /api/intel/feed | GET | Exa OSINT feed |
| /api/dashboard/summary | GET | Aggregate stats |
| /api/ontology/status | GET | Palantir pipeline status |

## Active Secrets

- `MAPBOX_TOKEN` — exposed as `VITE_MAPBOX_TOKEN` via vite.config.ts define
- `SHODAN_API_KEY` — ICS/SCADA (403 on free tier → curated fallback)
- `EXA_API_KEY` — Live intelligence search
- `PALANTIR_TOKEN`, `PALANTIR_URL`, `PALANTIR_CLIENT_ID/SECRET` — Foundry auth
- `PALANTIR_RID_*` — 10 dataset RIDs
- `SESSION_SECRET` — Express session

## Known Patterns

- DeckGL viewState controlled mode: add 800ms guard on `onViewStateChange` to prevent Mapbox default-center overwrite on mount
- `DemoSigintItem` uses `.pk`, `.frequency`, `.signalType` (NOT `.interceptId`, `.frequencyMhz`, `.sourceType`)
- Chatbot is branded **HAWK-I** (not MAVEN-ALPHA)
- React-markdown renders in `<MdResponse>` component inside `hawk-i-chat.tsx`
- Supply chain impact arcs and zones are defined in `SC_IMPACTS` dict in `c2-map.tsx`, keyed by scene number

## Key Commands

- `pnpm run typecheck` — full typecheck
- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks from OpenAPI spec
