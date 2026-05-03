// ---------------------------------------------------------------------------
// Operation Epic Fury — 7-Scene Orchestrated Demo Timeline
// All data is Middle East / Red Sea / Suez Canal conflict-relevant.
// Palantir primary keys (LEAD-001…, THR-001…, SIG-001…, ISR-001… etc.)
// match live OSDK objects in Foundry.
// ---------------------------------------------------------------------------

const FOUNDRY_URL  = "https://nshackathon.palantirfoundry.com";
const ONTOLOGY_RID = "runtime-configured";

// Kebab-case IDs used in Foundry Object Explorer URLs
const OBJECT_TYPE_IDS: Record<string, string> = {
  LogisticsVessel:          "logistics-vessel",
  HostileThreat:            "hostile-threat",
  CombatUnit:               "combat-unit",
  ConfirmedKineticIncident: "confirmed-kinetic-incident",
  GeneratedTacticalLead:    "generated-tactical-lead",
  SigintIntercept:          "sigint-intercept",
  IsrImagery:               "isr-imagery",
  HumintReport:             "humint-report",
  MaritimeAisTrack:         "maritime-ais-track",
  CyberIoc:                 "cyber-ioc",
  ExampleRv17memory:        "example-rv17-memory",
};

export const DATASET_RIDS: Record<string, string> = {
  LogisticsVessel:          "runtime-configured",
  HostileThreat:            "runtime-configured",
  CombatUnit:               "runtime-configured",
  ConfirmedKineticIncident: "runtime-configured",
  GeneratedTacticalLead:    "runtime-configured",
  SigintIntercept:          "runtime-configured",
  IsrImagery:               "runtime-configured",
  HumintReport:             "runtime-configured",
  MaritimeAisTrack:         "runtime-configured",
  CyberIoc:                 "runtime-configured",
};

// Real clickable Foundry URL to a specific object instance
function foundryLink(objectTypeApiName: string, primaryKey: string): string {
  const typeId = OBJECT_TYPE_IDS[objectTypeApiName] ?? objectTypeApiName.toLowerCase().replace(/([A-Z])/g, c => `-${c.toLowerCase()}`).replace(/^-/, '');
  return `${FOUNDRY_URL}/workspace/ontology/objects/${typeId}/${encodeURIComponent(primaryKey)}`;
}

// Real URL to the object type definition in Ontology Manager
export function getObjectTypeUrl(objectTypeApiName: string): string {
  return `${FOUNDRY_URL}/workspace/ontology`;
}

// Real URL to the backing dataset in Data Integration
export function getDatasetUrl(objectTypeApiName: string): string {
  return `${FOUNDRY_URL}/workspace/data-integration`;
}

// Full ontology graph URL
export const ONTOLOGY_GRAPH_URL = `${FOUNDRY_URL}/workspace/ontology`;

export type FeedTarget = "CYBER_FEED" | "OSINT_FEED" | "KINETIC_TRACKS" | "AI_RECOMMENDATIONS" | "INTEL_FUSION";

export interface DemoMapTarget {
  lat: number; lng: number; zoom: number; pitch: number; bearing: number;
}

export interface DemoIntelItem {
  id: string; title: string; summary: string; url: string;
  source: string; category: string; score: number; publishedDate: string;
}

export interface DemoCyberThreat {
  ip: string; port: number; org: string; location: string; product: string;
  vulnerabilities: string[]; severity: "critical" | "high" | "medium" | "low";
  lat: number; lng: number; attacker: string; description: string; timestamp: string;
}

export interface DemoTrackUpdate {
  id: string; label: string;
  type: "friendly" | "hostile" | "unknown" | "neutral";
  lat: number; lng: number; altitude: number; speed: number; heading: number;
  status: string; cargo?: string; note: string;
}

export interface DemoEvidenceLink {
  objectType: string; primaryKey: string; label: string;
  role: "TRIGGER" | "INCIDENT" | "RECOMMENDATION" | "ASSET_AT_RISK" | "SIGINT_CORROBORATION" | "ISR_CONFIRMATION" | "HUMINT_REPORT" | "AIS_TRACK" | "IOC_INDICATOR";
  url: string;
  dataset?: string;    // which Palantir dataset this object lives in
  linkName?: string;   // which link name was traversed to reach this
  foundryRid?: string; // the ontology object RID prefix
}

export interface DemoCoaItem {
  id: string; priority: number; title: string; action: string;
  rationale: string; confidence: number; urgency: string;
  evidenceChain: DemoEvidenceLink[];
  datasetsQueried: string[]; // list of objectType API names queried to build this COA
}

export interface DemoOntologyEdge {
  id: string;
  sourceLabel: string; sourceType: string; sourceColor: string;
  relation: string;
  targetLabel: string; targetType: string; targetColor: string;
  isNew: boolean;
  sourcePalantirUrl?: string;
  targetPalantirUrl?: string;
  // Blackbox provenance
  derivedFrom?: string;  // e.g. "SigintIntercept.associatedThreatId" or "LINK:corroboratesThreat"
  dataset?:     string;  // objectType API name of source object
  linkName?:    string;  // the Foundry link API name used (if link traversal was used)
}

// ---------------------------------------------------------------------------
// Foundry Provenance — shown in the ontology graph BLACKBOX drawer
// ---------------------------------------------------------------------------
export interface DemoProvenanceDataset {
  objectType:    string;   // Foundry API name e.g. "SigintIntercept"
  displayName:   string;   // Human label e.g. "SIGINT Intercepts"
  count:         number;   // objects loaded from this type
  datasetRid:    string;   // actual Foundry dataset RID
  foundryOntUrl: string;   // object type definition URL (Ontology Manager)
  datasetUrl:    string;   // dataset preview URL (Data Integration)
  icon:          string;   // emoji
}

export interface DemoProvenanceLink {
  from:      string;   // source object type
  linkName:  string;   // exact Foundry link API name
  to:        string;   // target object type
  edgeCount: number;   // how many edges this link contributed
  method:    "FK_FIELD" | "LINK_TRAVERSAL";
  fkField?:  string;   // FK property name if method=FK_FIELD
}

export interface DemoFoundryProvenance {
  ontologyRid:     string;
  objectsLoaded:   number;
  edgesBuilt:      number;
  datasets:        DemoProvenanceDataset[];
  linksTraversed:  DemoProvenanceLink[];
  queryTimeMs:     number;
  readAt:          string;
}

// ---------------------------------------------------------------------------
// New intel item types — backed by live Foundry objects
// ---------------------------------------------------------------------------
export interface DemoSigintItem {
  interceptId:       string;
  sourceType:        string;   // COMINT | ELINT | FISINT
  frequencyMhz:      number;
  bearingDeg:        number;
  lat:               number; lon: number;
  timestamp:         string;
  transcriptText:    string;
  classification:    string;
  associatedThreatId:string;
  foundryUrl:        string;
}

export interface DemoIsrItem {
  imageId:          string;
  sensorType:       string;   // SAR | EO | IR | MSI
  resolutionM:      number;
  lat:              number; lon: number;
  captureTimestamp: string;
  analystNotes:     string;
  targetVesselId:   string;
  imageUrl:         string;
  foundryUrl:       string;
}

export interface DemoHumintItem {
  reportId:          string;
  sourceReliability: string;   // NATO A-F
  infoCredibility:   string;   // NATO 1-6
  reportText:        string;
  locationName:      string;
  lat:               number; lon: number;
  timestamp:         string;
  relatedThreatId:   string;
  foundryUrl:        string;
}

export interface DemoAisItem {
  aisId:         string;
  mmsi:          string;
  vesselName:    string;
  vesselType:    string;
  lat:           number; lon: number;
  speedKnots:    number;
  courseDeg:     number;
  timestamp:     string;
  linkedVesselId:string;
  flagState:     string;
  foundryUrl:    string;
}

export interface DemoIocItem {
  iocId:              string;
  iocType:            string;   // IP | DOMAIN | HASH | CVE
  iocValue:           string;
  confidenceScore:    number;
  associatedThreatId: string;
  ttpReference:       string;
  firstSeen:          string;
  lastSeen:           string;
  foundryUrl:         string;
}

export interface DemoScene {
  id: number;
  startMs: number;
  label: string;
  location: string;
  narration: string;
  autoTab: FeedTarget;
  map: DemoMapTarget;
  intelItems?:   DemoIntelItem[];
  cyberThreats?: DemoCyberThreat[];
  trackUpdates?: DemoTrackUpdate[];
  coaItems?:     DemoCoaItem[];
  ontologyEdges: DemoOntologyEdge[];
  // New intel feeds
  sigintItems?:  DemoSigintItem[];
  isrItems?:     DemoIsrItem[];
  humintItems?:  DemoHumintItem[];
  aisItems?:     DemoAisItem[];
  iocItems?:     DemoIocItem[];
  // Foundry provenance metadata for BLACKBOX
  provenance?:   DemoFoundryProvenance;
  // Rich scene intelligence — shown in the map intel overlay
  briefingLines: string[];
  metrics:       { label: string; value: string; color?: string }[];
  threatLevel:   number;  // 0–100
}

// ---------------------------------------------------------------------------
// Shared provenance for the full theater — all 10 object types
// ---------------------------------------------------------------------------
const FULL_THEATER_PROVENANCE: DemoFoundryProvenance = {
  ontologyRid:   ONTOLOGY_RID,
  objectsLoaded: 146,
  edgesBuilt:    136,
  queryTimeMs:   380,
  readAt:        new Date().toISOString(),
  datasets: [
    { objectType: "LogisticsVessel",          displayName: "Logistics Vessels",   count: 20, datasetRid: DATASET_RIDS["LogisticsVessel"]!,          foundryOntUrl: getObjectTypeUrl("LogisticsVessel"),          datasetUrl: getDatasetUrl("LogisticsVessel"),          icon: "🚢" },
    { objectType: "HostileThreat",            displayName: "Hostile Threats",     count: 12, datasetRid: DATASET_RIDS["HostileThreat"]!,            foundryOntUrl: getObjectTypeUrl("HostileThreat"),            datasetUrl: getDatasetUrl("HostileThreat"),            icon: "⚠️" },
    { objectType: "CombatUnit",               displayName: "Combat Units",        count: 10, datasetRid: DATASET_RIDS["CombatUnit"]!,               foundryOntUrl: getObjectTypeUrl("CombatUnit"),               datasetUrl: getDatasetUrl("CombatUnit"),               icon: "🪖" },
    { objectType: "ConfirmedKineticIncident", displayName: "Kinetic Incidents",   count: 16, datasetRid: DATASET_RIDS["ConfirmedKineticIncident"]!, foundryOntUrl: getObjectTypeUrl("ConfirmedKineticIncident"), datasetUrl: getDatasetUrl("ConfirmedKineticIncident"), icon: "💥" },
    { objectType: "GeneratedTacticalLead",    displayName: "Tactical Leads",      count: 16, datasetRid: DATASET_RIDS["GeneratedTacticalLead"]!,   foundryOntUrl: getObjectTypeUrl("GeneratedTacticalLead"),    datasetUrl: getDatasetUrl("GeneratedTacticalLead"),   icon: "🎯" },
    { objectType: "SigintIntercept",          displayName: "SIGINT Intercepts",   count: 15, datasetRid: DATASET_RIDS["SigintIntercept"]!,          foundryOntUrl: getObjectTypeUrl("SigintIntercept"),          datasetUrl: getDatasetUrl("SigintIntercept"),          icon: "📡" },
    { objectType: "IsrImagery",               displayName: "ISR Imagery",         count: 15, datasetRid: DATASET_RIDS["IsrImagery"]!,               foundryOntUrl: getObjectTypeUrl("IsrImagery"),               datasetUrl: getDatasetUrl("IsrImagery"),               icon: "🛰️" },
    { objectType: "HumintReport",             displayName: "HUMINT Reports",      count: 12, datasetRid: DATASET_RIDS["HumintReport"]!,             foundryOntUrl: getObjectTypeUrl("HumintReport"),             datasetUrl: getDatasetUrl("HumintReport"),             icon: "🕵️" },
    { objectType: "MaritimeAisTrack",         displayName: "AIS Tracks",          count: 15, datasetRid: DATASET_RIDS["MaritimeAisTrack"]!,         foundryOntUrl: getObjectTypeUrl("MaritimeAisTrack"),         datasetUrl: getDatasetUrl("MaritimeAisTrack"),         icon: "📍" },
    { objectType: "CyberIoc",                 displayName: "Cyber IOCs",          count: 15, datasetRid: DATASET_RIDS["CyberIoc"]!,                 foundryOntUrl: getObjectTypeUrl("CyberIoc"),                 datasetUrl: getDatasetUrl("CyberIoc"),                 icon: "🔴" },
  ],
  linksTraversed: [
    { from: "HostileThreat",            linkName: "endangers",          to: "LogisticsVessel",          edgeCount: 12, method: "FK_FIELD",        fkField: "targetVesselId" },
    { from: "LogisticsVessel",          linkName: "suppliedBy",         to: "CombatUnit",               edgeCount: 20, method: "FK_FIELD",        fkField: "destination" },
    { from: "ConfirmedKineticIncident", linkName: "targets",            to: "LogisticsVessel",          edgeCount: 16, method: "FK_FIELD",        fkField: "targetId" },
    { from: "GeneratedTacticalLead",    linkName: "derivedFrom",        to: "ConfirmedKineticIncident", edgeCount: 16, method: "FK_FIELD",        fkField: "incidentId" },
    { from: "SigintIntercept",          linkName: "corroboratesThreat", to: "HostileThreat",            edgeCount: 15, method: "FK_FIELD",        fkField: "associatedThreatId" },
    { from: "IsrImagery",               linkName: "observesVessel",     to: "LogisticsVessel",          edgeCount: 15, method: "FK_FIELD",        fkField: "targetVesselId" },
    { from: "HumintReport",             linkName: "reportsOnThreat",    to: "HostileThreat",            edgeCount: 12, method: "FK_FIELD",        fkField: "relatedThreatId" },
    { from: "MaritimeAisTrack",         linkName: "tracksVessel",       to: "LogisticsVessel",          edgeCount: 15, method: "FK_FIELD",        fkField: "linkedVesselId" },
    { from: "CyberIoc",                 linkName: "attributedToThreat", to: "HostileThreat",            edgeCount: 15, method: "FK_FIELD",        fkField: "associatedThreatId" },
  ],
};

// ---------------------------------------------------------------------------
// Scene definitions
// ---------------------------------------------------------------------------
export const DEMO_SCENES: DemoScene[] = [

  // ─── SCENE 1 ─ T+0s ─ Red Sea Theater Overview ───────────────────────────
  {
    id: 1, startMs: 0,
    label: "THEATER OVERVIEW",
    location: "Red Sea & Suez Canal — CENTCOM AOR",
    narration: "OPERATION EPIC FURY INITIATED — SCANNING RED SEA & SUEZ THEATER — OSINT COLLECTION ACTIVE — ALL 10 PALANTIR FEEDS ONLINE",
    autoTab: "OSINT_FEED",
    map: { lat: 22, lng: 39, zoom: 4, pitch: 30, bearing: 0 },
    intelItems: [
      {
        id: "S1-I-001",
        title: "Red Sea MARSEC Level 3 Declared — US 5th Fleet Issues Emergency Transit Advisory",
        url: "https://www.centcom.mil", source: "CENTCOM_INTEL",
        summary: "US CENTCOM has declared MARSEC Level 3 for all Red Sea transit corridors. Coalition vessels ordered to maintain heightened watch and avoid transit through Bab-el-Mandeb without naval escort. Houthi Activity Index at historic high — 23 incidents in last 72 hours.",
        category: "threat", score: 0.99, publishedDate: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "S1-I-002",
        title: "Suez Canal Northbound Queue: 47 Vessels Delayed — UNIT-DELTA Resupply at Risk",
        url: "https://www.maritime-executive.com", source: "MARITIME_EXEC",
        summary: "Northbound queue at Port Said has reached 47 vessels including three allied logistics ships (CONVOY-BRAVO, VSL-004, VSL-008) carrying petroleum and critical military stores. Transit delay estimated 72 hours, placing UNIT-DELTA and UNIT-CHARLIE resupply windows in jeopardy.",
        category: "threat", score: 0.97, publishedDate: new Date(Date.now() - 7200000).toISOString(),
      },
    ],
    // AIS tracks loading: all vessels are being acquired
    aisItems: [
      { aisId: "AIS-001", mmsi: "338230987", vesselName: "CONVOY-BRAVO", vesselType: "Military Supply", lat: 12.7, lon: 43.5, speedKnots: 12, courseDeg: 320, timestamp: new Date().toISOString(), linkedVesselId: "VSL-002", flagState: "US", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-001") },
      { aisId: "AIS-005", mmsi: "338230991", vesselName: "VSL-004", vesselType: "Cargo/Petroleum", lat: 31.2, lon: 32.3, speedKnots: 0, courseDeg: 0, timestamp: new Date().toISOString(), linkedVesselId: "VSL-004", flagState: "US", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-005") },
      { aisId: "AIS-008", mmsi: "338230994", vesselName: "VSL-008", vesselType: "Cargo/Military", lat: 30.85, lon: 32.28, speedKnots: 0, courseDeg: 0, timestamp: new Date().toISOString(), linkedVesselId: "VSL-008", flagState: "US", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-008") },
    ],
    provenance: {
      ontologyRid: ONTOLOGY_RID, objectsLoaded: 146, edgesBuilt: 136, queryTimeMs: 380,
      readAt: new Date().toISOString(),
      datasets: FULL_THEATER_PROVENANCE.datasets,
      linksTraversed: FULL_THEATER_PROVENANCE.linksTraversed,
    },
    ontologyEdges: [],
    briefingLines: [
      "ALL 10 PALANTIR FEEDS ONLINE — 146 OBJECTS INDEXED — 136 ONTOLOGY EDGES BUILT",
      "MARSEC LEVEL 3 ACTIVE — RED SEA/SUEZ AOR — CENTCOM 5TH FLEET ADVISORY IN FORCE",
      "AIS AIS-001: CONVOY-BRAVO (VSL-002) TRANSITING BAB-EL-MANDEB — 12.7°N 43.5°E SPD 12KT",
      "SUEZ QUEUE: 47 VESSELS — VSL-004 / VSL-008 DELAYED — UNIT-DELTA RESUPPLY T-72H",
      "HOUTHI ACTIVITY INDEX: 23 INCIDENTS PAST 72H — THREAT POSTURE ELEVATED",
    ],
    metrics: [
      { label: "VESSELS",  value: "20",  color: "#60a5fa" },
      { label: "THREATS",  value: "12",  color: "#ff1e3c" },
      { label: "INCIDENTS",value: "16",  color: "#f97316" },
      { label: "LEADS",    value: "16",  color: "#facc15" },
      { label: "AIS TRK",  value: "15",  color: "#22d3ee" },
      { label: "SIGINT",   value: "15",  color: "#a78bfa" },
    ],
    threatLevel: 62,
  },

  // ─── SCENE 2 ─ T+14s ─ Bab-el-Mandeb — Houthi UAV Swarm ─────────────────
  {
    id: 2, startMs: 20000,
    label: "HOUTHI UAV SWARM",
    location: "Bab-el-Mandeb Strait (12.5°N, 43.3°E)",
    narration: "HOUTHI UAV SWARM DETECTED — 14 SHAHEED-136 DRONES — SIGINT CONFIRMS HOUTHI C2 COMMS — CONVOY-BRAVO AIS TRACK ACTIVE — CORROBORATING 3 INTEL FEEDS",
    autoTab: "KINETIC_TRACKS",
    map: { lat: 12.5, lng: 43.3, zoom: 9, pitch: 50, bearing: -15 },
    intelItems: [
      {
        id: "S2-I-001", title: "Houthi UAV Swarm (14× Shaheed-136) Tracked at 12.6°N, 43.4°E — Bab-el-Mandeb",
        url: "https://www.centcom.mil", source: "USS_CARNEY_CIC",
        summary: "14 Shaheed-136 loitering munitions detected at 12.6°N, 43.4°E bearing 290°. CONVOY-BRAVO within primary threat corridor. USS Carney CIWS and SM-2 intercept posture activated.",
        category: "kinetic", score: 0.98, publishedDate: new Date(Date.now() - 1200000).toISOString(),
      },
    ],
    trackUpdates: [
      { id: "TRK-SEA-003", label: "HOUTHI-UAV", type: "hostile", lat: 13.1, lng: 44.0, altitude: 450, speed: 150, heading: 290, status: "THREAT_ACTIVE", note: "UAV Swarm — 14× Shaheed-136 — bearing 290°" },
      { id: "TRK-SEA-001", label: "CONVOY-BRAVO", type: "friendly", lat: 12.7, lng: 43.5, altitude: 0, speed: 12, heading: 320, status: "ALERT", cargo: "Petroleum / Military Stores", note: "Within UAV threat corridor" },
      { id: "TRK-SEA-002", label: "USS-CARNEY", type: "friendly", lat: 12.2, lng: 43.1, altitude: 0, speed: 28, heading: 45, status: "INTERCEPT_POSTURE", note: "SM-2/CIWS activated — closing on UAV vector" },
    ],
    // SIGINT: Houthi C2 comms intercepted on 156.8 MHz
    sigintItems: [
      { interceptId: "SIG-003", sourceType: "COMINT", frequencyMhz: 156.8, bearingDeg: 290, lat: 13.0, lon: 44.2, timestamp: new Date().toISOString(), transcriptText: "Arabic voice intercept — tactical coordination, UAV launch authorization phrase detected, callsign ZULFIQAR-7", classification: "SECRET", associatedThreatId: "THR-003", foundryUrl: foundryLink("SigintIntercept", "SIG-003") },
      { interceptId: "SIG-011", sourceType: "ELINT", frequencyMhz: 433.9, bearingDeg: 283, lat: 12.9, lon: 43.9, timestamp: new Date().toISOString(), transcriptText: "Burst transmission — UHF band — consistent with Shaheed-136 datalink signature — bearing 283° from USS Carney position", classification: "SECRET", associatedThreatId: "THR-003", foundryUrl: foundryLink("SigintIntercept", "SIG-011") },
    ],
    // AIS: CONVOY-BRAVO in Bab-el-Mandeb
    aisItems: [
      { aisId: "AIS-001", mmsi: "338230987", vesselName: "CONVOY-BRAVO", vesselType: "Military Supply", lat: 12.7, lon: 43.5, speedKnots: 12, courseDeg: 320, timestamp: new Date().toISOString(), linkedVesselId: "VSL-002", flagState: "US", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-001") },
    ],
    ontologyEdges: [
      {
        id: "e-s2-1", sourceLabel: "Houthi Movement (YE)", sourceType: "actor", sourceColor: "#ff1e3c", relation: "ENDANGERS", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: true,
        sourcePalantirUrl: foundryLink("HostileThreat", "THR-003"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat", linkName: "endangers",
      },
      {
        id: "e-s2-sig", sourceLabel: "SIG-003 COMINT", sourceType: "sigint", sourceColor: "#a78bfa", relation: "CORROBORATES", targetLabel: "Houthi UAV THR-003", targetType: "threat", targetColor: "#ff1e3c", isNew: true,
        sourcePalantirUrl: foundryLink("SigintIntercept", "SIG-003"), targetPalantirUrl: foundryLink("HostileThreat", "THR-003"),
        derivedFrom: "SigintIntercept.associatedThreatId", dataset: "SigintIntercept", linkName: "corroboratesThreat",
      },
      {
        id: "e-s2-ais", sourceLabel: "AIS-001 CONVOY-BRAVO", sourceType: "ais", sourceColor: "#22d3ee", relation: "TRACKS", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: true,
        sourcePalantirUrl: foundryLink("MaritimeAisTrack", "AIS-001"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "MaritimeAisTrack.linkedVesselId", dataset: "MaritimeAisTrack", linkName: "tracksVessel",
      },
    ],
    briefingLines: [
      "HOUTHI UAV SWARM — 14x SHAHEED-136 LOITERING MUNITIONS — BEARING 290° — SPEED MACH 0.5",
      "SIGINT SIG-003 (COMINT/156.8MHz): ARABIC VOICE — CALLSIGN ZULFIQAR-7 — UAV LAUNCH AUTH PHRASE",
      "SIGINT SIG-011 (ELINT/433.9MHz): UHF BURST — SHAHEED-136 DATALINK SIGNATURE CONFIRMED",
      "AIS AIS-001: CONVOY-BRAVO WITHIN PRIMARY THREAT CORRIDOR — 12.7°N 43.5°E SPD 12KT HDG 320°",
      "USS CARNEY DDG-64: CIWS HOT — SM-2 INTERCEPT POSTURE — CLOSING 28KT HDG 045°",
    ],
    metrics: [
      { label: "HOSTILE TRK",  value: "1",   color: "#ff1e3c" },
      { label: "FRIENDLY TRK", value: "2",   color: "#60a5fa" },
      { label: "SIGINT",       value: "2",   color: "#a78bfa" },
      { label: "AIS",          value: "1",   color: "#22d3ee" },
      { label: "MUNITIONS",    value: "14",  color: "#ff6400" },
      { label: "THREAT R",     value: "25nm",color: "#ffb800" },
    ],
    threatLevel: 82,
  },

  // ─── SCENE 3 ─ T+28s ─ ASBM Launch Confirmed ─────────────────────────────
  {
    id: 3, startMs: 40000,
    label: "ASBM LAUNCH CONFIRMED",
    location: "Red Sea — 12.7°N, 43.5°E",
    narration: "BALLISTIC MISSILE LAUNCH CONFIRMED — ISR SAR IMAGERY CORROBORATES — HUMINT SOURCE VALIDATES — MULTI-INT FUSION COMPLETE — T-4 MINUTES TO IMPACT",
    autoTab: "KINETIC_TRACKS",
    map: { lat: 12.8, lng: 43.6, zoom: 10, pitch: 55, bearing: -20 },
    intelItems: [
      {
        id: "S3-I-001", title: "Anti-Ship Ballistic Missile Launch — CONVOY-BRAVO Target Confirmed by 2 ISR Assets",
        url: "https://www.defense.gov", source: "CENTCOM_ISR",
        summary: "Two independent ISR assets (ISR-001 SAR, ISR-002 EO) have confirmed ASBM launch from Houthi-controlled territory. USS Carney has fired SM-2 intercept. T+4 minutes to impact.",
        category: "kinetic", score: 0.99, publishedDate: new Date(Date.now() - 600000).toISOString(),
      },
    ],
    trackUpdates: [
      { id: "TRK-SEA-001", label: "CONVOY-BRAVO", type: "friendly", lat: 12.75, lng: 43.55, altitude: 0, speed: 8, heading: 320, status: "UNDER_THREAT", cargo: "Petroleum / Military Stores", note: "ASBM inbound — evasive maneuver — awaiting SM-2 intercept" },
      { id: "TRK-SEA-002", label: "USS-CARNEY", type: "friendly", lat: 12.35, lng: 43.22, altitude: 0, speed: 32, heading: 15, status: "INTERCEPT_ACTIVE", note: "SM-2 Block IIIA fired — intercept T-3:40" },
    ],
    // ISR: 2 assets confirm ASBM launch site and target
    isrItems: [
      { imageId: "ISR-001", sensorType: "SAR", resolutionM: 1.0, lat: 14.2, lon: 45.3, captureTimestamp: new Date(Date.now() - 600000).toISOString(), analystNotes: "SAR backscatter anomaly confirms TEL vehicle (Transporter Erector Launcher) at Hudaydah coast — post-launch plume detected. Estimated launch time 06:42Z. Trajectory consistent with CONV-BRAVO intercept.", targetVesselId: "VSL-002", imageUrl: "", foundryUrl: foundryLink("IsrImagery", "ISR-001") },
      { imageId: "ISR-002", sensorType: "EO", resolutionM: 0.5, lat: 12.75, lon: 43.55, captureTimestamp: new Date(Date.now() - 420000).toISOString(), analystNotes: "EO imagery of CONVOY-BRAVO at 12.75N/43.55E — vessel executing evasive maneuver, wake pattern visible. No visible hull damage. SM-2 contrail visible at frame right.", targetVesselId: "VSL-002", imageUrl: "", foundryUrl: foundryLink("IsrImagery", "ISR-002") },
    ],
    // HUMINT: source in Hudaydah reported launch preparations
    humintItems: [
      { reportId: "HUM-003", sourceReliability: "B", infoCredibility: "2", reportText: "Asset CALICO reports Houthi missile unit ZULFIQAR-7 loaded Type-C ASBM on TEL vehicle at Hudaydah Port complex at approximately 06:30Z. Unit designation and location corroborated by satellite imagery post-event.", locationName: "Hudaydah, Yemen", lat: 14.8, lon: 42.95, timestamp: new Date(Date.now() - 3600000).toISOString(), relatedThreatId: "THR-003", foundryUrl: foundryLink("HumintReport", "HUM-003") },
    ],
    // SIGINT: previous intercepts still relevant
    sigintItems: [
      { interceptId: "SIG-003", sourceType: "COMINT", frequencyMhz: 156.8, bearingDeg: 290, lat: 13.0, lon: 44.2, timestamp: new Date(Date.now() - 1200000).toISOString(), transcriptText: "Arabic voice intercept — tactical coordination, UAV launch authorization phrase detected, callsign ZULFIQAR-7", classification: "SECRET", associatedThreatId: "THR-003", foundryUrl: foundryLink("SigintIntercept", "SIG-003") },
    ],
    aisItems: [
      { aisId: "AIS-001", mmsi: "338230987", vesselName: "CONVOY-BRAVO", vesselType: "Military Supply", lat: 12.75, lon: 43.55, speedKnots: 8, courseDeg: 320, timestamp: new Date().toISOString(), linkedVesselId: "VSL-002", flagState: "US", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-001") },
    ],
    ontologyEdges: [
      {
        id: "e-s2-1", sourceLabel: "Houthi Movement (YE)", sourceType: "actor", sourceColor: "#ff1e3c", relation: "ENDANGERS", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: false,
        sourcePalantirUrl: foundryLink("HostileThreat", "THR-003"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat", linkName: "endangers",
      },
      {
        id: "e-s3-1", sourceLabel: "ASBM Strike INC-001", sourceType: "event", sourceColor: "#f97316", relation: "TARGETS", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: true,
        sourcePalantirUrl: foundryLink("ConfirmedKineticIncident", "INC-001"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "ConfirmedKineticIncident.targetId", dataset: "ConfirmedKineticIncident", linkName: "targets",
      },
      {
        id: "e-s3-isr1", sourceLabel: "ISR-001 SAR", sourceType: "isr", sourceColor: "#34d399", relation: "OBSERVES", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: true,
        sourcePalantirUrl: foundryLink("IsrImagery", "ISR-001"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "IsrImagery.targetVesselId", dataset: "IsrImagery", linkName: "observesVessel",
      },
      {
        id: "e-s3-isr2", sourceLabel: "ISR-002 EO", sourceType: "isr", sourceColor: "#34d399", relation: "OBSERVES", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: true,
        sourcePalantirUrl: foundryLink("IsrImagery", "ISR-002"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "IsrImagery.targetVesselId", dataset: "IsrImagery", linkName: "observesVessel",
      },
      {
        id: "e-s3-hum", sourceLabel: "HUM-003 HUMINT", sourceType: "humint", sourceColor: "#fb923c", relation: "REPORTS_ON", targetLabel: "Houthi THR-003", targetType: "threat", targetColor: "#ff1e3c", isNew: true,
        sourcePalantirUrl: foundryLink("HumintReport", "HUM-003"), targetPalantirUrl: foundryLink("HostileThreat", "THR-003"),
        derivedFrom: "HumintReport.relatedThreatId", dataset: "HumintReport", linkName: "reportsOnThreat",
      },
      {
        id: "e-s2-sig", sourceLabel: "SIG-003 COMINT", sourceType: "sigint", sourceColor: "#a78bfa", relation: "CORROBORATES", targetLabel: "Houthi THR-003", targetType: "threat", targetColor: "#ff1e3c", isNew: false,
        sourcePalantirUrl: foundryLink("SigintIntercept", "SIG-003"), targetPalantirUrl: foundryLink("HostileThreat", "THR-003"),
        derivedFrom: "SigintIntercept.associatedThreatId", dataset: "SigintIntercept", linkName: "corroboratesThreat",
      },
    ],
    briefingLines: [
      "ASBM LAUNCH CONFIRMED — TEL SITE: HUDAYDAH COAST 14.2°N/45.3°E — T+4:00 TO IMPACT",
      "ISR-001 (SAR/1.0m RES): BACKSCATTER CONFIRMS TEL POST-LAUNCH PLUME — HUDAYDAH PORT",
      "ISR-002 (EO/0.5m RES): CONVOY-BRAVO EVASIVE MANEUVER VISIBLE — SM-2 CONTRAIL AT FRAME RIGHT",
      "HUMINT HUM-003 (REL-B/CRED-2): ASSET CALICO — ZULFIQAR-7 LOADED ASBM AT HUDAYDAH 06:30Z",
      "USS CARNEY: SM-2 BLOCK IIIA FIRED — INTERCEPT T-3:40 — ROE WEAPONS FREE",
    ],
    metrics: [
      { label: "ISR ASSETS",  value: "2",   color: "#34d399" },
      { label: "HUMINT RPT",  value: "1",   color: "#fb923c" },
      { label: "SIGINT",      value: "1",   color: "#a78bfa" },
      { label: "AIS",         value: "1",   color: "#22d3ee" },
      { label: "IMPACT T-",   value: "3:40",color: "#ff1e3c" },
      { label: "CONF",        value: "99%", color: "#00ff88" },
    ],
    threatLevel: 96,
  },

  // ─── SCENE 4 ─ T+42s ─ Port Said — APT-41 Suez SCADA ───────────────────
  {
    id: 4, startMs: 60000,
    label: "APT-41 SUEZ SCADA EXPLOIT",
    location: "Port Said, Egypt (31.26°N, 32.28°E)",
    narration: "APT-41 INTRUSION CONFIRMED — IOC FINGERPRINTS MATCH PALANTIR CYBER ONTOLOGY — 3 IOCS ACTIVE — HUMINT CORROBORATES PRC ATTRIBUTION",
    autoTab: "CYBER_FEED",
    map: { lat: 31.26, lng: 32.28, zoom: 11, pitch: 45, bearing: 10 },
    cyberThreats: [
      {
        ip: "41.65.12.88", port: 502, org: "Suez Canal Authority", location: "Port Said, EG", product: "Modbus TCP ICS Gateway",
        vulnerabilities: ["CVE-2021-32926", "CVE-2020-14511"], severity: "critical", lat: 31.26, lng: 32.28,
        attacker: "APT-41 (PRC)",
        description: "Remote code execution confirmed on Modbus TCP gateway controlling canal lock actuators at Port Said. APT-41 has lateral movement access to the Vessel Traffic Management System (VTMS). Canal lock control at risk — potential forced closure of Suez northbound lane.",
        timestamp: new Date().toISOString(),
      },
    ],
    trackUpdates: [
      { id: "TRK-SUEZ-001", label: "VSL-004", type: "friendly", lat: 31.2, lng: 32.3, altitude: 0, speed: 0, heading: 0, status: "DELAYED_CYBER", note: "Suez canal halt — APT-41 SCADA attack" },
    ],
    // IOCs: APT-41 indicators from Foundry Cyber ontology
    iocItems: [
      { iocId: "IOC-001", iocType: "IP", iocValue: "41.65.12.88", confidenceScore: 0.97, associatedThreatId: "THR-001", ttpReference: "T1190", firstSeen: new Date(Date.now() - 86400000).toISOString(), lastSeen: new Date().toISOString(), foundryUrl: foundryLink("CyberIoc", "IOC-001") },
      { iocId: "IOC-002", iocType: "HASH", iocValue: "e3b0c44298fc1c149afb...d5a851e4a9f3", confidenceScore: 0.94, associatedThreatId: "THR-001", ttpReference: "T1059.003", firstSeen: new Date(Date.now() - 43200000).toISOString(), lastSeen: new Date().toISOString(), foundryUrl: foundryLink("CyberIoc", "IOC-002") },
      { iocId: "IOC-003", iocType: "CVE", iocValue: "CVE-2021-32926", confidenceScore: 0.99, associatedThreatId: "THR-001", ttpReference: "T1203", firstSeen: new Date(Date.now() - 172800000).toISOString(), lastSeen: new Date().toISOString(), foundryUrl: foundryLink("CyberIoc", "IOC-003") },
    ],
    // HUMINT: source corroborates PRC attribution
    humintItems: [
      { reportId: "HUM-007", sourceReliability: "B", infoCredibility: "2", reportText: "Source MANILA-6 reports PRC nationals seen accessing Egyptian telecom node in Port Said 72hrs prior to attack. Vehicle registration traced to cover company linked to MSS front in Alexandria. Technical signatures consistent with APT-41 OPSEC patterns.", locationName: "Port Said, Egypt", lat: 31.26, lon: 32.28, timestamp: new Date(Date.now() - 259200000).toISOString(), relatedThreatId: "THR-001", foundryUrl: foundryLink("HumintReport", "HUM-007") },
    ],
    // SIGINT: exfil traffic intercepted
    sigintItems: [
      { interceptId: "SIG-009", sourceType: "ELINT", frequencyMhz: 2400.0, bearingDeg: 10, lat: 31.26, lon: 32.28, timestamp: new Date(Date.now() - 3600000).toISOString(), transcriptText: "Anomalous high-frequency burst transmission from Port Said telco node — encryption pattern matches APT-41 exfiltration tooling (SOGU variant) — data volume suggests SCADA configuration exfil", classification: "TOP SECRET", associatedThreatId: "THR-001", foundryUrl: foundryLink("SigintIntercept", "SIG-009") },
    ],
    ontologyEdges: [
      {
        id: "e-s2-1", sourceLabel: "Houthi Movement (YE)", sourceType: "actor", sourceColor: "#ff1e3c", relation: "ENDANGERS", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: false,
        sourcePalantirUrl: foundryLink("HostileThreat", "THR-003"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat", linkName: "endangers",
      },
      {
        id: "e-s3-1", sourceLabel: "ASBM Strike INC-001", sourceType: "event", sourceColor: "#f97316", relation: "TARGETS", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: false,
        sourcePalantirUrl: foundryLink("ConfirmedKineticIncident", "INC-001"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "ConfirmedKineticIncident.targetId", dataset: "ConfirmedKineticIncident", linkName: "targets",
      },
      {
        id: "e-s4-1", sourceLabel: "APT-41 (PRC)", sourceType: "actor", sourceColor: "#ff6400", relation: "EXPLOITS", targetLabel: "Suez SCADA GW 41.65.12.88", targetType: "infrastructure", targetColor: "#ffb800", isNew: true,
        sourcePalantirUrl: foundryLink("HostileThreat", "THR-001"), targetPalantirUrl: foundryLink("ConfirmedKineticIncident", "INC-004"),
        derivedFrom: "HostileThreat.targetVesselId→ConfirmedKineticIncident", dataset: "HostileThreat",
      },
      {
        id: "e-s4-ioc1", sourceLabel: "IOC-001 41.65.12.88", sourceType: "ioc", sourceColor: "#f43f5e", relation: "ATTRIBUTED_TO", targetLabel: "APT-41 THR-001", targetType: "threat", targetColor: "#ff6400", isNew: true,
        sourcePalantirUrl: foundryLink("CyberIoc", "IOC-001"), targetPalantirUrl: foundryLink("HostileThreat", "THR-001"),
        derivedFrom: "CyberIoc.associatedThreatId", dataset: "CyberIoc", linkName: "attributedToThreat",
      },
      {
        id: "e-s4-ioc2", sourceLabel: "IOC-003 CVE-2021-32926", sourceType: "ioc", sourceColor: "#f43f5e", relation: "ATTRIBUTED_TO", targetLabel: "APT-41 THR-001", targetType: "threat", targetColor: "#ff6400", isNew: true,
        sourcePalantirUrl: foundryLink("CyberIoc", "IOC-003"), targetPalantirUrl: foundryLink("HostileThreat", "THR-001"),
        derivedFrom: "CyberIoc.associatedThreatId", dataset: "CyberIoc", linkName: "attributedToThreat",
      },
      {
        id: "e-s4-sig9", sourceLabel: "SIG-009 ELINT", sourceType: "sigint", sourceColor: "#a78bfa", relation: "CORROBORATES", targetLabel: "APT-41 THR-001", targetType: "threat", targetColor: "#ff6400", isNew: true,
        sourcePalantirUrl: foundryLink("SigintIntercept", "SIG-009"), targetPalantirUrl: foundryLink("HostileThreat", "THR-001"),
        derivedFrom: "SigintIntercept.associatedThreatId", dataset: "SigintIntercept", linkName: "corroboratesThreat",
      },
    ],
    briefingLines: [
      "APT-41 (PRC) RCE CONFIRMED — TARGET: MODBUS TCP GATEWAY 41.65.12.88:502 — PORT SAID EG",
      "IOC-001 (IP/0.97): 41.65.12.88 → THR-001 APT-41 — TTP T1190 EXPLOIT PUBLIC-FACING APP",
      "IOC-003 (CVE/0.99): CVE-2021-32926 ACTIVE — CANAL LOCK ACTUATOR SYSTEM AT RISK",
      "SIG-009 (ELINT/2400MHz): SOGU EXFIL BURST — APT-41 C2 — SCADA CONFIG DATA EXFILTRATED",
      "HUMINT HUM-007: SOURCE MANILA-6 — MSS FRONT CO — PORT SAID TELCO NODE ACCESS T-72H",
    ],
    metrics: [
      { label: "IOC HITS",        value: "3",  color: "#f43f5e" },
      { label: "HUMINT",          value: "1",  color: "#fb923c" },
      { label: "SIGINT",          value: "1",  color: "#a78bfa" },
      { label: "CVE ACTIVE",      value: "2",  color: "#ff6400" },
      { label: "VESSELS AT RISK", value: "47", color: "#ffb800" },
      { label: "CONF",            value: "97%",color: "#00ff88" },
    ],
    threatLevel: 88,
  },

  // ─── SCENE 5 ─ T+56s ─ Ismailia — DNP3 Power Grid ───────────────────────
  {
    id: 5, startMs: 80000,
    label: "DNP3 POWER GRID ATTACK",
    location: "Ismailia, Egypt (30.58°N, 32.27°E)",
    narration: "DNP3 ANOMALY ON ISMAILIA POWER GRID — IOC-004 CVE MATCH CONFIRMED — HUMINT CORROBORATES APT-41 PRE-POSITIONING — 2ND CYBER FRONT ACTIVE",
    autoTab: "CYBER_FEED",
    map: { lat: 30.58, lng: 32.27, zoom: 12, pitch: 50, bearing: -10 },
    cyberThreats: [
      {
        ip: "41.65.44.21", port: 20000, org: "Ismailia Regional Power Authority", location: "Ismailia, EG", product: "DNP3 SCADA Controller",
        vulnerabilities: ["CVE-2022-22965", "CVE-2021-44228"], severity: "critical", lat: 30.58, lng: 32.27,
        attacker: "APT-41 (PRC) / UNKNOWN",
        description: "Anomalous DNP3 polling burst on Ismailia power grid SCADA — consistent with APT-41 pre-attack fingerprinting. Canal navigation lights and traffic management at risk.",
        timestamp: new Date().toISOString(),
      },
    ],
    intelItems: [
      {
        id: "S5-I-001", title: "HAWK-I Passive Scan: 14 Exposed ICS Devices on Egyptian Maritime Infrastructure",
        url: "https://www.shodan.io", source: "HAWK-I/SHODAN",
        summary: "Cross-reference of Shodan scan with Palantir Cyber ontology: 14 exposed ICS/SCADA devices. IOC-004 (CVE-2022-22965) confirmed active against Ismailia DNP3 node. Two devices already showing APT-41 fingerprinting traffic matching IOC-001.",
        category: "vulnerability", score: 0.94, publishedDate: new Date(Date.now() - 900000).toISOString(),
      },
    ],
    trackUpdates: [
      { id: "TRK-SUEZ-002", label: "VSL-008", type: "friendly", lat: 30.85, lng: 32.28, altitude: 0, speed: 0, heading: 0, status: "HALTED", note: "Suez northbound halt — power systems at risk" },
    ],
    iocItems: [
      { iocId: "IOC-001", iocType: "IP", iocValue: "41.65.12.88", confidenceScore: 0.97, associatedThreatId: "THR-001", ttpReference: "T1190", firstSeen: new Date(Date.now() - 86400000).toISOString(), lastSeen: new Date().toISOString(), foundryUrl: foundryLink("CyberIoc", "IOC-001") },
      { iocId: "IOC-004", iocType: "CVE", iocValue: "CVE-2022-22965", confidenceScore: 0.96, associatedThreatId: "THR-001", ttpReference: "T1210", firstSeen: new Date(Date.now() - 86400000).toISOString(), lastSeen: new Date().toISOString(), foundryUrl: foundryLink("CyberIoc", "IOC-004") },
      { iocId: "IOC-005", iocType: "DOMAIN", iocValue: "update-srv.canal-auth[.]com", confidenceScore: 0.91, associatedThreatId: "THR-001", ttpReference: "T1071.001", firstSeen: new Date(Date.now() - 129600000).toISOString(), lastSeen: new Date().toISOString(), foundryUrl: foundryLink("CyberIoc", "IOC-005") },
    ],
    humintItems: [
      { reportId: "HUM-009", sourceReliability: "C", infoCredibility: "3", reportText: "Source DELTA-NILE reports unusual night-time activity at Ismailia power substation 3 days prior. Foreign nationals seen accessing maintenance tunnel with unidentified equipment. Local security guard bribed. Technical profile matches APT-41 on-site pre-positioning for firmware implant.", locationName: "Ismailia, Egypt", lat: 30.58, lon: 32.27, timestamp: new Date(Date.now() - 259200000).toISOString(), relatedThreatId: "THR-001", foundryUrl: foundryLink("HumintReport", "HUM-009") },
    ],
    aisItems: [
      { aisId: "AIS-008", mmsi: "338230994", vesselName: "VSL-008", vesselType: "Cargo/Military", lat: 30.85, lon: 32.28, speedKnots: 0, courseDeg: 0, timestamp: new Date().toISOString(), linkedVesselId: "VSL-008", flagState: "US", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-008") },
    ],
    ontologyEdges: [
      {
        id: "e-s2-1", sourceLabel: "Houthi Movement (YE)", sourceType: "actor", sourceColor: "#ff1e3c", relation: "ENDANGERS", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: false,
        sourcePalantirUrl: foundryLink("HostileThreat", "THR-003"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat", linkName: "endangers",
      },
      {
        id: "e-s3-1", sourceLabel: "ASBM Strike INC-001", sourceType: "event", sourceColor: "#f97316", relation: "TARGETS", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: false,
        sourcePalantirUrl: foundryLink("ConfirmedKineticIncident", "INC-001"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "ConfirmedKineticIncident.targetId", dataset: "ConfirmedKineticIncident", linkName: "targets",
      },
      {
        id: "e-s4-1", sourceLabel: "APT-41 (PRC)", sourceType: "actor", sourceColor: "#ff6400", relation: "EXPLOITS", targetLabel: "Suez SCADA GW", targetType: "infrastructure", targetColor: "#ffb800", isNew: false,
        sourcePalantirUrl: foundryLink("HostileThreat", "THR-001"),
        derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat",
      },
      {
        id: "e-s5-1", sourceLabel: "APT-41 (PRC)", sourceType: "actor", sourceColor: "#ff6400", relation: "TARGETS", targetLabel: "Ismailia DNP3 Grid", targetType: "infrastructure", targetColor: "#ffb800", isNew: true,
        sourcePalantirUrl: foundryLink("HostileThreat", "THR-001"), targetPalantirUrl: foundryLink("ConfirmedKineticIncident", "INC-005"),
        derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat",
      },
      {
        id: "e-s5-2", sourceLabel: "Ismailia DNP3 Grid", sourceType: "infrastructure", sourceColor: "#ffb800", relation: "DISRUPTS", targetLabel: "VSL-008 (Canal)", targetType: "vessel", targetColor: "#60a5fa", isNew: true,
        targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-008"),
        derivedFrom: "ConfirmedKineticIncident.targetId", dataset: "ConfirmedKineticIncident", linkName: "targets",
      },
      {
        id: "e-s5-ioc4", sourceLabel: "IOC-004 CVE-22965", sourceType: "ioc", sourceColor: "#f43f5e", relation: "ATTRIBUTED_TO", targetLabel: "APT-41 THR-001", targetType: "threat", targetColor: "#ff6400", isNew: true,
        sourcePalantirUrl: foundryLink("CyberIoc", "IOC-004"), targetPalantirUrl: foundryLink("HostileThreat", "THR-001"),
        derivedFrom: "CyberIoc.associatedThreatId", dataset: "CyberIoc", linkName: "attributedToThreat",
      },
      {
        id: "e-s5-hum9", sourceLabel: "HUM-009 HUMINT", sourceType: "humint", sourceColor: "#fb923c", relation: "REPORTS_ON", targetLabel: "APT-41 THR-001", targetType: "threat", targetColor: "#ff6400", isNew: true,
        sourcePalantirUrl: foundryLink("HumintReport", "HUM-009"), targetPalantirUrl: foundryLink("HostileThreat", "THR-001"),
        derivedFrom: "HumintReport.relatedThreatId", dataset: "HumintReport", linkName: "reportsOnThreat",
      },
    ],
    briefingLines: [
      "DNP3 ANOMALY — ISMAILIA REGIONAL POWER AUTH 41.65.44.21:20000 — SECOND CYBER FRONT ACTIVE",
      "IOC-004 (CVE/0.96): CVE-2022-22965 ACTIVE — DNP3 POLLING BURST FINGERPRINTING DETECTED",
      "IOC-005 (DOMAIN/0.91): update-srv.canal-auth[.]com — APT-41 C2 INFRA — TTP T1071.001",
      "HUMINT HUM-009 (REL-C/CRED-3): DELTA-NILE — FOREIGN NATIONALS AT ISMAILIA SUBSTATION T-72H",
      "SHODAN CROSS-REF: 14 EXPOSED ICS DEVICES ON EGYPTIAN MARITIME INFRA — UNPATCHED CVEs",
    ],
    metrics: [
      { label: "IOC HITS",  value: "3",    color: "#f43f5e" },
      { label: "ICS EXPO",  value: "14",   color: "#ff6400" },
      { label: "HUMINT",    value: "1",    color: "#fb923c" },
      { label: "AIS",       value: "1",    color: "#22d3ee" },
      { label: "CANAL RISK",value: "HIGH", color: "#ffb800" },
      { label: "CONF",      value: "94%",  color: "#00ff88" },
    ],
    threatLevel: 84,
  },

  // ─── SCENE 6 ─ T+70s ─ Gulf of Aden — IRGC GPS Spoofing ──────────────────
  {
    id: 6, startMs: 100000,
    label: "IRGC GPS SPOOFING",
    location: "Gulf of Aden (12.2°N, 44.5°E)",
    narration: "IRGC-EW GPS SPOOFING CONFIRMED — SIG-007 ELINT MATCHES IRGC SIGNATURE — AIS-001 SHOWING 4.2NM DEVIATION — MULTI-INT FUSION: CONVOY-BRAVO NAVIGATION COMPROMISED",
    autoTab: "INTEL_FUSION",
    map: { lat: 12.0, lng: 44.5, zoom: 9, pitch: 45, bearing: 5 },
    cyberThreats: [
      {
        ip: "172.16.99.44", port: 5000, org: "IRGC Electronic Warfare Unit (YE relay)", location: "Hudaydah, Yemen / Gulf of Aden", product: "GPS L1/L2 Spoofing Transmitter",
        vulnerabilities: ["GPS-SPOOF-IRGC-2024"], severity: "high", lat: 12.9, lng: 43.7,
        attacker: "IRGC-EW (IR)",
        description: "GPS spoofing signal at 12.9°N, 43.7°E consistent with IRGC electronic warfare signature (L1/L2 band manipulation). CONVOY-BRAVO navigation system reporting 4.2nm deviation from true position.",
        timestamp: new Date().toISOString(),
      },
    ],
    trackUpdates: [
      { id: "TRK-SEA-001", label: "CONVOY-BRAVO", type: "friendly", lat: 12.6, lng: 43.9, altitude: 0, speed: 6, heading: 310, status: "NAVIGATION_COMPROMISED", cargo: "Petroleum / Military Stores", note: "GPS spoofed — 4.2nm deviation — INS backup active" },
      { id: "TRK-SEA-002", label: "USS-CARNEY", type: "friendly", lat: 12.4, lng: 43.4, altitude: 0, speed: 30, heading: 350, status: "ESCORT_ACTIVE", note: "Repositioning to escort — EW comms degraded" },
    ],
    // SIGINT: IRGC GPS spoofing signal intercepted
    sigintItems: [
      { interceptId: "SIG-007", sourceType: "ELINT", frequencyMhz: 1575.42, bearingDeg: 197, lat: 12.9, lon: 43.7, timestamp: new Date(Date.now() - 1800000).toISOString(), transcriptText: "L1-band GPS carrier anomaly: spoofed C/A code detected at 12.9N/43.7E. Power level 15dB above authentic satellite signal. Bearing and spectral profile matches IRGC EW unit ASHURA-3 (IR) signature confirmed by NSA SIGINT database ref SHA-2024-0419.", classification: "TOP SECRET", associatedThreatId: "THR-007", foundryUrl: foundryLink("SigintIntercept", "SIG-007") },
      { interceptId: "SIG-012", sourceType: "COMINT", frequencyMhz: 162.0, bearingDeg: 192, lat: 12.8, lon: 43.6, timestamp: new Date(Date.now() - 900000).toISOString(), transcriptText: "Farsi voice comms on VHF maritime channel — 'deviate navigation — confirm waypoint update' — translation NSA SIGINT-1942 — strong correlation to IRGC EW tasking order format", classification: "TOP SECRET", associatedThreatId: "THR-007", foundryUrl: foundryLink("SigintIntercept", "SIG-012") },
    ],
    // AIS showing navigation anomaly
    aisItems: [
      { aisId: "AIS-001", mmsi: "338230987", vesselName: "CONVOY-BRAVO", vesselType: "Military Supply", lat: 12.6, lon: 43.9, speedKnots: 6, courseDeg: 310, timestamp: new Date().toISOString(), linkedVesselId: "VSL-002", flagState: "US", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-001") },
      { aisId: "AIS-002", mmsi: "338230988", vesselName: "USS-CARNEY DDG-64", vesselType: "Warship", lat: 12.4, lon: 43.4, speedKnots: 30, courseDeg: 350, timestamp: new Date().toISOString(), linkedVesselId: "VSL-002", flagState: "US", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-002") },
    ],
    ontologyEdges: [
      {
        id: "e-s2-1", sourceLabel: "Houthi Movement (YE)", sourceType: "actor", sourceColor: "#ff1e3c", relation: "ENDANGERS", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: false,
        sourcePalantirUrl: foundryLink("HostileThreat", "THR-003"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat", linkName: "endangers",
      },
      {
        id: "e-s3-1", sourceLabel: "ASBM Strike INC-001", sourceType: "event", sourceColor: "#f97316", relation: "TARGETS", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: false,
        sourcePalantirUrl: foundryLink("ConfirmedKineticIncident", "INC-001"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "ConfirmedKineticIncident.targetId", dataset: "ConfirmedKineticIncident", linkName: "targets",
      },
      {
        id: "e-s4-1", sourceLabel: "APT-41 (PRC)", sourceType: "actor", sourceColor: "#ff6400", relation: "EXPLOITS", targetLabel: "Suez SCADA GW", targetType: "infrastructure", targetColor: "#ffb800", isNew: false,
        sourcePalantirUrl: foundryLink("HostileThreat", "THR-001"),
        derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat",
      },
      {
        id: "e-s5-2", sourceLabel: "Ismailia DNP3 Grid", sourceType: "infrastructure", sourceColor: "#ffb800", relation: "DISRUPTS", targetLabel: "VSL-008 (Canal)", targetType: "vessel", targetColor: "#60a5fa", isNew: false,
        targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-008"),
        derivedFrom: "ConfirmedKineticIncident.targetId", dataset: "ConfirmedKineticIncident",
      },
      {
        id: "e-s6-1", sourceLabel: "IRGC-EW (IR)", sourceType: "actor", sourceColor: "#ff6400", relation: "JAMS", targetLabel: "GPS L1/L2 — Red Sea", targetType: "infrastructure", targetColor: "#a78bfa", isNew: true,
        sourcePalantirUrl: foundryLink("HostileThreat", "THR-007"),
        derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat",
      },
      {
        id: "e-s6-2", sourceLabel: "GPS L1/L2 — Red Sea", sourceType: "infrastructure", sourceColor: "#a78bfa", relation: "DEVIATES", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: true,
        targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "MaritimeAisTrack.linkedVesselId", dataset: "MaritimeAisTrack", linkName: "tracksVessel",
      },
      {
        id: "e-s6-sig7", sourceLabel: "SIG-007 ELINT IRGC", sourceType: "sigint", sourceColor: "#a78bfa", relation: "CORROBORATES", targetLabel: "IRGC-EW THR-007", targetType: "threat", targetColor: "#ff6400", isNew: true,
        sourcePalantirUrl: foundryLink("SigintIntercept", "SIG-007"), targetPalantirUrl: foundryLink("HostileThreat", "THR-007"),
        derivedFrom: "SigintIntercept.associatedThreatId", dataset: "SigintIntercept", linkName: "corroboratesThreat",
      },
      {
        id: "e-s6-ais1", sourceLabel: "AIS-001 CONV-BRAVO", sourceType: "ais", sourceColor: "#22d3ee", relation: "TRACKS→DEVIATED", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: true,
        sourcePalantirUrl: foundryLink("MaritimeAisTrack", "AIS-001"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "MaritimeAisTrack.linkedVesselId", dataset: "MaritimeAisTrack", linkName: "tracksVessel",
      },
    ],
    briefingLines: [
      "IRGC-EW GPS SPOOFING — L1/L2 BAND — 12.9°N 43.7°E — ASHURA-3 UNIT SIGNATURE CONFIRMED",
      "SIG-007 (ELINT/1575.42MHz): POWER +15dB ABOVE AUTHENTIC SIGNAL — NSA REF SHA-2024-0419",
      "SIG-012 (COMINT/162.0MHz): FARSI VOICE — 'DEVIATE NAVIGATION CONFIRM WAYPOINT' — IRGC EW",
      "AIS-001: CONVOY-BRAVO 4.2NM DEVIATION FROM TRUE POSITION — INS BACKUP ACTIVE",
      "USS-CARNEY: REPOSITIONING TO ESCORT — EW COMMS DEGRADED — SITREP TO NAVCENT BAHRAIN",
    ],
    metrics: [
      { label: "SIGINT",  value: "2",    color: "#a78bfa" },
      { label: "AIS",     value: "2",    color: "#22d3ee" },
      { label: "NAV DEV", value: "4.2nm",color: "#ff1e3c" },
      { label: "EW ACTOR",value: "1",    color: "#ff6400" },
      { label: "FREQ",    value: "L1/L2",color: "#ffb800" },
      { label: "CONF",    value: "91%",  color: "#00ff88" },
    ],
    threatLevel: 78,
  },

  // ─── SCENE 7 ─ T+84s ─ Theater Overview — COA Generation ─────────────────
  {
    id: 7, startMs: 120000,
    label: "HAWK-I COA GENERATION",
    location: "Full Theater — Red Sea / Suez AOR",
    narration: "HAWK-I ONTOLOGY ANALYSIS COMPLETE — 10 PALANTIR FEEDS FUSED — 146 OBJECTS / 136 EDGES — COORDINATED THREE-ACTOR CAMPAIGN CONFIRMED — 3 COAS GENERATED",
    autoTab: "AI_RECOMMENDATIONS",
    map: { lat: 24, lng: 37, zoom: 4.5, pitch: 35, bearing: 0 },
    intelItems: [
      {
        id: "S7-I-001", title: "HAWK-I Multi-Int Fusion: APT-41 + Houthi + IRGC Coordinated Campaign — Full Kill Chain Confirmed",
        url: "https://nshackathon.palantirfoundry.com", source: "HAWK-I_AI",
        summary: "HAWK-I fusion across 10 Palantir object types: 146 nodes, 136 edges, 9 link types traversed. SIGINT (SIG-003, SIG-007, SIG-009, SIG-012), ISR (ISR-001, ISR-002), HUMINT (HUM-003, HUM-007, HUM-009), AIS (AIS-001 deviation confirmed), IOC (IOC-001 through IOC-005). Three-actor coordinated campaign: APT-41 cyber/Suez SCADA, Houthi kinetic/ASBM, IRGC-EW GPS spoofing. All vectors target CONVOY-BRAVO → UNIT-FOXTROT supply chain. Critical threshold 58 hours.",
        category: "threat", score: 0.99, publishedDate: new Date().toISOString(),
      },
    ],
    // All intel types active for full fusion picture
    sigintItems: [
      { interceptId: "SIG-003", sourceType: "COMINT", frequencyMhz: 156.8, bearingDeg: 290, lat: 13.0, lon: 44.2, timestamp: new Date(Date.now() - 1200000).toISOString(), transcriptText: "Arabic voice — Houthi UAV C2 — ZULFIQAR-7", classification: "SECRET", associatedThreatId: "THR-003", foundryUrl: foundryLink("SigintIntercept", "SIG-003") },
      { interceptId: "SIG-007", sourceType: "ELINT", frequencyMhz: 1575.42, bearingDeg: 197, lat: 12.9, lon: 43.7, timestamp: new Date(Date.now() - 1800000).toISOString(), transcriptText: "L1-band GPS spoofing — IRGC ASHURA-3 signature confirmed", classification: "TOP SECRET", associatedThreatId: "THR-007", foundryUrl: foundryLink("SigintIntercept", "SIG-007") },
      { interceptId: "SIG-009", sourceType: "ELINT", frequencyMhz: 2400.0, bearingDeg: 10, lat: 31.26, lon: 32.28, timestamp: new Date(Date.now() - 3600000).toISOString(), transcriptText: "APT-41 SOGU exfil burst from Port Said telco node", classification: "TOP SECRET", associatedThreatId: "THR-001", foundryUrl: foundryLink("SigintIntercept", "SIG-009") },
    ],
    isrItems: [
      { imageId: "ISR-001", sensorType: "SAR", resolutionM: 1.0, lat: 14.2, lon: 45.3, captureTimestamp: new Date(Date.now() - 600000).toISOString(), analystNotes: "SAR confirms TEL launch site Hudaydah — ASBM post-launch plume", targetVesselId: "VSL-002", imageUrl: "", foundryUrl: foundryLink("IsrImagery", "ISR-001") },
      { imageId: "ISR-002", sensorType: "EO", resolutionM: 0.5, lat: 12.75, lon: 43.55, captureTimestamp: new Date(Date.now() - 420000).toISOString(), analystNotes: "EO imagery CONVOY-BRAVO evasive maneuver — SM-2 contrail visible", targetVesselId: "VSL-002", imageUrl: "", foundryUrl: foundryLink("IsrImagery", "ISR-002") },
    ],
    humintItems: [
      { reportId: "HUM-003", sourceReliability: "B", infoCredibility: "2", reportText: "Source CALICO — Houthi ZULFIQAR-7 loaded ASBM at Hudaydah Port 06:30Z", locationName: "Hudaydah, Yemen", lat: 14.8, lon: 42.95, timestamp: new Date(Date.now() - 3600000).toISOString(), relatedThreatId: "THR-003", foundryUrl: foundryLink("HumintReport", "HUM-003") },
      { reportId: "HUM-007", sourceReliability: "B", infoCredibility: "2", reportText: "Source MANILA-6 — PRC nationals at Port Said telco node 72hrs prior — MSS front company", locationName: "Port Said, Egypt", lat: 31.26, lon: 32.28, timestamp: new Date(Date.now() - 259200000).toISOString(), relatedThreatId: "THR-001", foundryUrl: foundryLink("HumintReport", "HUM-007") },
    ],
    aisItems: [
      { aisId: "AIS-001", mmsi: "338230987", vesselName: "CONVOY-BRAVO", vesselType: "Military Supply", lat: 12.6, lon: 43.9, speedKnots: 6, courseDeg: 310, timestamp: new Date().toISOString(), linkedVesselId: "VSL-002", flagState: "US", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-001") },
    ],
    iocItems: [
      { iocId: "IOC-001", iocType: "IP", iocValue: "41.65.12.88", confidenceScore: 0.97, associatedThreatId: "THR-001", ttpReference: "T1190", firstSeen: new Date(Date.now() - 86400000).toISOString(), lastSeen: new Date().toISOString(), foundryUrl: foundryLink("CyberIoc", "IOC-001") },
      { iocId: "IOC-003", iocType: "CVE", iocValue: "CVE-2021-32926", confidenceScore: 0.99, associatedThreatId: "THR-001", ttpReference: "T1203", firstSeen: new Date(Date.now() - 172800000).toISOString(), lastSeen: new Date().toISOString(), foundryUrl: foundryLink("CyberIoc", "IOC-003") },
    ],
    coaItems: [
      {
        id: "EF-COA-001", priority: 1,
        title: "IMMEDIATE: USS CARNEY HARD ESCORT — CONVOY-BRAVO PROTECTION",
        action: "Reposition USS Carney (DDG-64) to 12.5°N, 43.4°E. Activate full SM-2/SM-6 intercept posture. Establish 25nm maritime exclusion zone. Request EAGLE-1 air coverage from Djibouti. Authorize Rules of Engagement for immediate engagement of air threats.",
        rationale: "Ontology chain: THR-003 (Houthi ASBM) ENDANGERS VSL-002 (CONVOY-BRAVO) SUPPLIED_BY UNIT-FOXTROT (58hr critical threshold). Corroborated by: SIG-003 (Houthi C2 COMINT), ISR-001/002 (SAR+EO launch confirmation), HUM-003 (HUMINT ZULFIQAR-7 launch prep), AIS-001 (4.2nm deviation confirmed). USS Carney closest intercept asset at 34nm.",
        confidence: 0.96, urgency: "immediate",
        datasetsQueried: ["HostileThreat", "LogisticsVessel", "CombatUnit", "ConfirmedKineticIncident", "GeneratedTacticalLead", "SigintIntercept", "IsrImagery", "HumintReport", "MaritimeAisTrack"],
        evidenceChain: [
          { objectType: "HostileThreat",            primaryKey: "THR-003", label: "Houthi ASBM Threat",         role: "TRIGGER",               url: foundryLink("HostileThreat", "THR-003"),            dataset: "HostileThreat",            foundryRid: "ri.phonograph2-objects.main.object.v4" },
          { objectType: "SigintIntercept",          primaryKey: "SIG-003", label: "SIG-003: Houthi C2 COMINT", role: "SIGINT_CORROBORATION",   url: foundryLink("SigintIntercept", "SIG-003"),          dataset: "SigintIntercept",          linkName: "corroboratesThreat" },
          { objectType: "IsrImagery",               primaryKey: "ISR-001", label: "ISR-001: SAR Launch Site",   role: "ISR_CONFIRMATION",       url: foundryLink("IsrImagery", "ISR-001"),               dataset: "IsrImagery",               linkName: "observesVessel" },
          { objectType: "HumintReport",             primaryKey: "HUM-003", label: "HUM-003: CALICO ASBM Prep", role: "HUMINT_REPORT",          url: foundryLink("HumintReport", "HUM-003"),             dataset: "HumintReport",             linkName: "reportsOnThreat" },
          { objectType: "MaritimeAisTrack",         primaryKey: "AIS-001", label: "AIS-001: 4.2nm Deviation",  role: "AIS_TRACK",              url: foundryLink("MaritimeAisTrack", "AIS-001"),         dataset: "MaritimeAisTrack",         linkName: "tracksVessel" },
          { objectType: "ConfirmedKineticIncident", primaryKey: "INC-001", label: "INC-001: ASBM Launch",      role: "INCIDENT",               url: foundryLink("ConfirmedKineticIncident", "INC-001"), dataset: "ConfirmedKineticIncident", linkName: "targets" },
          { objectType: "LogisticsVessel",          primaryKey: "VSL-002", label: "CONVOY-BRAVO (At Risk)",    role: "ASSET_AT_RISK",          url: foundryLink("LogisticsVessel", "VSL-002"),          dataset: "LogisticsVessel" },
          { objectType: "GeneratedTacticalLead",    primaryKey: "LEAD-001", label: "LEAD-001: Carney Escort",  role: "RECOMMENDATION",         url: foundryLink("GeneratedTacticalLead", "LEAD-001"),   dataset: "GeneratedTacticalLead",    linkName: "derivedFrom" },
        ],
      },
      {
        id: "EF-COA-002", priority: 2,
        title: "HIGH: NSA CNO TEAM — APT-41 SUEZ SCADA EVICTION",
        action: "Deploy NSA CNO team to sever APT-41 C2 channel on 41.65.12.88:502. Coordinate with Egyptian CCA for emergency SCADA firewall. Parallel: activate backup GPS for CONVOY-BRAVO. Notify CISA for ICS advisory on Modbus CVE-2021-32926.",
        rationale: "APT-41 canal lock control access creates secondary blockage risk. IOC-001 (41.65.12.88 — conf 97%) and IOC-003 (CVE-2021-32926 — conf 99%) confirmed active. SIG-009 ELINT confirms exfil traffic. HUMINT HUM-007 corroborates PRC attribution. Canal closure strands VSL-004 and VSL-008, degrading UNIT-DELTA (78%) and UNIT-CHARLIE (82%).",
        confidence: 0.91, urgency: "high",
        datasetsQueried: ["HostileThreat", "ConfirmedKineticIncident", "CyberIoc", "SigintIntercept", "HumintReport", "LogisticsVessel", "GeneratedTacticalLead"],
        evidenceChain: [
          { objectType: "HostileThreat",            primaryKey: "THR-001", label: "APT-41 ICS Campaign",           role: "TRIGGER",             url: foundryLink("HostileThreat", "THR-001"),            dataset: "HostileThreat" },
          { objectType: "CyberIoc",                 primaryKey: "IOC-001", label: "IOC-001: 41.65.12.88 (97%)",    role: "IOC_INDICATOR",       url: foundryLink("CyberIoc", "IOC-001"),                 dataset: "CyberIoc",                linkName: "attributedToThreat" },
          { objectType: "CyberIoc",                 primaryKey: "IOC-003", label: "IOC-003: CVE-2021-32926 (99%)", role: "IOC_INDICATOR",       url: foundryLink("CyberIoc", "IOC-003"),                 dataset: "CyberIoc",                linkName: "attributedToThreat" },
          { objectType: "SigintIntercept",          primaryKey: "SIG-009", label: "SIG-009: APT-41 Exfil ELINT",  role: "SIGINT_CORROBORATION",url: foundryLink("SigintIntercept", "SIG-009"),          dataset: "SigintIntercept",         linkName: "corroboratesThreat" },
          { objectType: "HumintReport",             primaryKey: "HUM-007", label: "HUM-007: MANILA-6 PRC Attrib", role: "HUMINT_REPORT",       url: foundryLink("HumintReport", "HUM-007"),             dataset: "HumintReport",            linkName: "reportsOnThreat" },
          { objectType: "ConfirmedKineticIncident", primaryKey: "INC-004", label: "INC-004: Suez SCADA Breach",   role: "INCIDENT",            url: foundryLink("ConfirmedKineticIncident", "INC-004"), dataset: "ConfirmedKineticIncident", linkName: "targets" },
          { objectType: "LogisticsVessel",          primaryKey: "VSL-004", label: "VSL-004 (At Risk)",            role: "ASSET_AT_RISK",       url: foundryLink("LogisticsVessel", "VSL-004"),          dataset: "LogisticsVessel" },
          { objectType: "GeneratedTacticalLead",    primaryKey: "LEAD-002", label: "LEAD-002: Cyber Eviction",    role: "RECOMMENDATION",      url: foundryLink("GeneratedTacticalLead", "LEAD-002"),   dataset: "GeneratedTacticalLead" },
        ],
      },
      {
        id: "EF-COA-003", priority: 3,
        title: "NEAR-TERM: REROUTE VSL-004 + VSL-008 VIA CAPE OF GOOD HOPE",
        action: "Issue immediate course change: reverse through Mediterranean → Gibraltar → Cape of Good Hope → Indian Ocean. Assign EAGLE-1 escort through Red Sea departure. ETA delay +14 days. Coordinate airlift bridge for UNIT-DELTA critical stores.",
        rationale: "SIG-007 ELINT confirms IRGC-EW ASHURA-3 spoofing on L1/L2. SIG-012 Farsi COMINT confirms tasking order. AIS-001 showing 4.2nm deviation from charted route. 14-day delay preferable to vessel loss. UNIT-DELTA (78%) and UNIT-CHARLIE (82%) readiness can sustain delay on current stockpiles.",
        confidence: 0.88, urgency: "near-term",
        datasetsQueried: ["HostileThreat", "SigintIntercept", "MaritimeAisTrack", "ConfirmedKineticIncident", "LogisticsVessel", "GeneratedTacticalLead"],
        evidenceChain: [
          { objectType: "HostileThreat",         primaryKey: "THR-007", label: "IRGC GPS Spoofing",              role: "TRIGGER",             url: foundryLink("HostileThreat", "THR-007"),          dataset: "HostileThreat" },
          { objectType: "SigintIntercept",       primaryKey: "SIG-007", label: "SIG-007: IRGC ELINT (GPS L1)",   role: "SIGINT_CORROBORATION",url: foundryLink("SigintIntercept", "SIG-007"),        dataset: "SigintIntercept",   linkName: "corroboratesThreat" },
          { objectType: "SigintIntercept",       primaryKey: "SIG-012", label: "SIG-012: Farsi EW Tasking",      role: "SIGINT_CORROBORATION",url: foundryLink("SigintIntercept", "SIG-012"),        dataset: "SigintIntercept",   linkName: "corroboratesThreat" },
          { objectType: "MaritimeAisTrack",      primaryKey: "AIS-001", label: "AIS-001: 4.2nm Deviation",       role: "AIS_TRACK",           url: foundryLink("MaritimeAisTrack", "AIS-001"),       dataset: "MaritimeAisTrack",  linkName: "tracksVessel" },
          { objectType: "ConfirmedKineticIncident", primaryKey: "INC-005", label: "INC-005: Suez Transit Block", role: "INCIDENT",            url: foundryLink("ConfirmedKineticIncident", "INC-005"),dataset: "ConfirmedKineticIncident" },
          { objectType: "LogisticsVessel",       primaryKey: "VSL-008", label: "VSL-008 (Halted Suez)",          role: "ASSET_AT_RISK",       url: foundryLink("LogisticsVessel", "VSL-008"),        dataset: "LogisticsVessel" },
          { objectType: "GeneratedTacticalLead", primaryKey: "LEAD-003", label: "LEAD-003: Reroute COA",         role: "RECOMMENDATION",      url: foundryLink("GeneratedTacticalLead", "LEAD-003"), dataset: "GeneratedTacticalLead" },
        ],
      },
    ],
    provenance: FULL_THEATER_PROVENANCE,
    ontologyEdges: [
      {
        id: "e-s2-1", sourceLabel: "Houthi Movement (YE)", sourceType: "actor", sourceColor: "#ff1e3c", relation: "ENDANGERS", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: false,
        sourcePalantirUrl: foundryLink("HostileThreat", "THR-003"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat", linkName: "endangers",
      },
      {
        id: "e-s3-1", sourceLabel: "ASBM Strike INC-001", sourceType: "event", sourceColor: "#f97316", relation: "TARGETS", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: false,
        sourcePalantirUrl: foundryLink("ConfirmedKineticIncident", "INC-001"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "ConfirmedKineticIncident.targetId", dataset: "ConfirmedKineticIncident", linkName: "targets",
      },
      {
        id: "e-s4-1", sourceLabel: "APT-41 (PRC)", sourceType: "actor", sourceColor: "#ff6400", relation: "EXPLOITS", targetLabel: "Suez SCADA GW", targetType: "infrastructure", targetColor: "#ffb800", isNew: false,
        sourcePalantirUrl: foundryLink("HostileThreat", "THR-001"),
        derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat",
      },
      {
        id: "e-s5-1", sourceLabel: "APT-41 (PRC)", sourceType: "actor", sourceColor: "#ff6400", relation: "TARGETS", targetLabel: "Ismailia DNP3 Grid", targetType: "infrastructure", targetColor: "#ffb800", isNew: false,
        sourcePalantirUrl: foundryLink("HostileThreat", "THR-001"),
        derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat",
      },
      {
        id: "e-s5-2", sourceLabel: "Ismailia DNP3 Grid", sourceType: "infrastructure", sourceColor: "#ffb800", relation: "DISRUPTS", targetLabel: "VSL-008 (Canal)", targetType: "vessel", targetColor: "#60a5fa", isNew: false,
        targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-008"),
        derivedFrom: "ConfirmedKineticIncident.targetId", dataset: "ConfirmedKineticIncident",
      },
      {
        id: "e-s6-1", sourceLabel: "IRGC-EW (IR)", sourceType: "actor", sourceColor: "#ff6400", relation: "JAMS", targetLabel: "GPS L1/L2 — Red Sea", targetType: "infrastructure", targetColor: "#a78bfa", isNew: false,
        sourcePalantirUrl: foundryLink("HostileThreat", "THR-007"),
        derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat",
      },
      {
        id: "e-s6-2", sourceLabel: "GPS L1/L2 — Red Sea", sourceType: "infrastructure", sourceColor: "#a78bfa", relation: "DEVIATES", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: false,
        targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "MaritimeAisTrack.linkedVesselId", dataset: "MaritimeAisTrack", linkName: "tracksVessel",
      },
      {
        id: "e-s7-1", sourceLabel: "CONVOY-BRAVO (VSL-002)", sourceType: "vessel", sourceColor: "#60a5fa", relation: "SUPPLIED_BY", targetLabel: "UNIT-FOXTROT", targetType: "unit", targetColor: "#00ff88", isNew: true,
        sourcePalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "LogisticsVessel.destination", dataset: "LogisticsVessel", linkName: "suppliedBy",
      },
      // Intel type edges — full multi-int fusion
      {
        id: "e-s7-sig3", sourceLabel: "SIG-003 COMINT", sourceType: "sigint", sourceColor: "#a78bfa", relation: "CORROBORATES", targetLabel: "Houthi THR-003", targetType: "threat", targetColor: "#ff1e3c", isNew: true,
        sourcePalantirUrl: foundryLink("SigintIntercept", "SIG-003"), targetPalantirUrl: foundryLink("HostileThreat", "THR-003"),
        derivedFrom: "SigintIntercept.associatedThreatId", dataset: "SigintIntercept", linkName: "corroboratesThreat",
      },
      {
        id: "e-s7-sig7", sourceLabel: "SIG-007 ELINT GPS", sourceType: "sigint", sourceColor: "#a78bfa", relation: "CORROBORATES", targetLabel: "IRGC-EW THR-007", targetType: "threat", targetColor: "#ff6400", isNew: true,
        sourcePalantirUrl: foundryLink("SigintIntercept", "SIG-007"), targetPalantirUrl: foundryLink("HostileThreat", "THR-007"),
        derivedFrom: "SigintIntercept.associatedThreatId", dataset: "SigintIntercept", linkName: "corroboratesThreat",
      },
      {
        id: "e-s7-isr1", sourceLabel: "ISR-001 SAR", sourceType: "isr", sourceColor: "#34d399", relation: "OBSERVES", targetLabel: "CONVOY-BRAVO VSL-002", targetType: "vessel", targetColor: "#60a5fa", isNew: true,
        sourcePalantirUrl: foundryLink("IsrImagery", "ISR-001"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "IsrImagery.targetVesselId", dataset: "IsrImagery", linkName: "observesVessel",
      },
      {
        id: "e-s7-hum3", sourceLabel: "HUM-003 CALICO", sourceType: "humint", sourceColor: "#fb923c", relation: "REPORTS_ON", targetLabel: "Houthi THR-003", targetType: "threat", targetColor: "#ff1e3c", isNew: true,
        sourcePalantirUrl: foundryLink("HumintReport", "HUM-003"), targetPalantirUrl: foundryLink("HostileThreat", "THR-003"),
        derivedFrom: "HumintReport.relatedThreatId", dataset: "HumintReport", linkName: "reportsOnThreat",
      },
      {
        id: "e-s7-ais1", sourceLabel: "AIS-001 CONV-BRAVO", sourceType: "ais", sourceColor: "#22d3ee", relation: "TRACKS", targetLabel: "CONVOY-BRAVO VSL-002", targetType: "vessel", targetColor: "#60a5fa", isNew: true,
        sourcePalantirUrl: foundryLink("MaritimeAisTrack", "AIS-001"), targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"),
        derivedFrom: "MaritimeAisTrack.linkedVesselId", dataset: "MaritimeAisTrack", linkName: "tracksVessel",
      },
      {
        id: "e-s7-ioc1", sourceLabel: "IOC-001 APT-41 IP", sourceType: "ioc", sourceColor: "#f43f5e", relation: "ATTRIBUTED_TO", targetLabel: "APT-41 THR-001", targetType: "threat", targetColor: "#ff6400", isNew: true,
        sourcePalantirUrl: foundryLink("CyberIoc", "IOC-001"), targetPalantirUrl: foundryLink("HostileThreat", "THR-001"),
        derivedFrom: "CyberIoc.associatedThreatId", dataset: "CyberIoc", linkName: "attributedToThreat",
      },
    ],
    briefingLines: [
      "HAWK-I MULTI-INT FUSION COMPLETE — 10 PALANTIR DATASETS — 146 OBJ / 136 EDGES ANALYZED",
      "3-ACTOR COORDINATED CAMPAIGN: APT-41 (CYBER/SUEZ) + HOUTHI (KINETIC/ASBM) + IRGC-EW (GPS)",
      "SIGINT 4 INTERCEPTS • ISR 2 ASSETS • HUMINT 3 REPORTS • AIS 1 DEVIATION • IOC 5 HITS",
      "CRITICAL THRESHOLD: T-58H — UNIT-DELTA / UNIT-FOXTROT SUPPLY CHAIN WINDOW CLOSING",
      "3 COAS GENERATED — COA-001 PRIORITY 1 — ESCALATION AUTH REQUESTED FROM NAVCENT",
    ],
    metrics: [
      { label: "OBJECTS",     value: "146",      color: "#00ff88" },
      { label: "EDGES",       value: "136",      color: "#00ff88" },
      { label: "ACTORS",      value: "3",        color: "#ff1e3c" },
      { label: "DATASETS",    value: "10",       color: "#a78bfa" },
      { label: "SUPPLY RISK", value: "CRITICAL", color: "#ff1e3c" },
      { label: "T-WINDOW",    value: "58H",      color: "#ffb800" },
    ],
    threatLevel: 99,
  },

  // ─── SCENE 8 ─ T+98s ─ CDR Approves COA-001 — Escort Active ──────────────
  {
    id: 8, startMs: 140000,
    label: "CDR APPROVES COA-001",
    location: "Bab-el-Mandeb / Red Sea — Command Decision",
    narration: "CDR APPROVED COA-001 — USS CARNEY HARD ESCORT ACTIVE — EAGLE-01 AIRLIFT AIRBORNE — CNO TEAM DEPLOYED SUEZ — COA-002 AUTH PENDING NSA",
    autoTab: "AI_RECOMMENDATIONS",
    map: { lat: 13.5, lng: 44.5, zoom: 7.5, pitch: 40, bearing: 5 },
    intelItems: [
      {
        id: "S8-I-001", title: "CDR APPROVED: COA-001 Hard Escort + COA-002 CNO Eviction — HAWK-I Monitoring Execution",
        url: "https://nshackathon.palantirfoundry.com", source: "HAWK-I_AI",
        summary: "Commander authorized COA-001: USS CARNEY DDG-64 hard escort for CONVOY-BRAVO. Execution: CARNEY repositioning 43.35°N→43.9°E. C-17 EAGLE-01 airborne Al Udeid→Djibouti 180T Class I/V. COA-002: NSA CNO team deploying against APT-41 Suez SCADA. HAWK-I monitoring all vectors in real-time via Palantir OSDK. IRGC GPS spoofing addressed: INS backup confirmed on CONVOY-BRAVO.",
        category: "action", score: 0.97, publishedDate: new Date().toISOString(),
      },
    ],
    sigintItems: [
      { interceptId: "SIG-013", sourceType: "COMINT", frequencyMhz: 156.8, bearingDeg: 170, lat: 12.4, lon: 43.35, timestamp: new Date().toISOString(), transcriptText: "USS CARNEY DDG-64: 'CONVOY-BRAVO this is CARNEY — we are on your port quarter — hard escort initiated — maintain course 340 — weapons free authorized' — NAVINT", classification: "SECRET", associatedThreatId: "THR-003", foundryUrl: foundryLink("SigintIntercept", "SIG-013") },
      { interceptId: "SIG-014", sourceType: "ELINT", frequencyMhz: 1030.0, bearingDeg: 95,  lat: 25.1, lon: 51.3, timestamp: new Date().toISOString(), transcriptText: "EAGLE-01 IFF transponder active — Mode 4 crypto — climbing FL350 — Al Udeid departure track confirmed", classification: "SECRET", associatedThreatId: "THR-001", foundryUrl: foundryLink("SigintIntercept", "SIG-014") },
    ],
    isrItems: [
      { imageId: "ISR-003", sensorType: "EO", resolutionM: 0.5, lat: 12.4, lon: 43.35, captureTimestamp: new Date().toISOString(), analystNotes: "EO: USS CARNEY DDG-64 at flank speed — bow wave visible — estimated 30kts — course 020 — intercept track with CONVOY-BRAVO", targetVesselId: "VSL-002", imageUrl: "", foundryUrl: foundryLink("IsrImagery", "ISR-003") },
    ],
    humintItems: [
      { reportId: "HUM-009", sourceReliability: "B", infoCredibility: "2", reportText: "Source MANILA-6 confirms APT-41 C2 node active Port Said telco facility — second node identified Ismailia DNP3 grid — CNO team has target packages for both", locationName: "Port Said / Ismailia, Egypt", lat: 31.26, lon: 32.28, timestamp: new Date().toISOString(), relatedThreatId: "THR-001", foundryUrl: foundryLink("HumintReport", "HUM-009") },
    ],
    aisItems: [
      { aisId: "AIS-001", mmsi: "338230987", vesselName: "CONVOY-BRAVO",   vesselType: "Military Supply", lat: 12.6, lon: 43.9,  speedKnots: 8,  courseDeg: 340, timestamp: new Date().toISOString(), linkedVesselId: "VSL-002", flagState: "US", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-001") },
      { aisId: "AIS-002", mmsi: "338230988", vesselName: "USS-CARNEY DDG-64",vesselType: "Warship",        lat: 12.4, lon: 43.35, speedKnots: 30, courseDeg: 20,  timestamp: new Date().toISOString(), linkedVesselId: "VSL-002", flagState: "US", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-002") },
    ],
    iocItems: [],
    ontologyEdges: [
      { id: "e-s8-1", sourceLabel: "USS-CARNEY DDG-64", sourceType: "vessel", sourceColor: "#00ff88", relation: "ESCORTS", targetLabel: "CONVOY-BRAVO (VSL-002)", targetType: "vessel", targetColor: "#60a5fa", isNew: true, targetPalantirUrl: foundryLink("LogisticsVessel", "VSL-002"), derivedFrom: "LogisticsVessel.escortId", dataset: "LogisticsVessel", linkName: "escortedBy" },
      { id: "e-s8-2", sourceLabel: "EAGLE-01 C-17", sourceType: "aircraft", sourceColor: "#0ea5e9", relation: "DELIVERING_TO", targetLabel: "UNIT-FOXTROT", targetType: "unit", targetColor: "#00ff88", isNew: true, targetPalantirUrl: foundryLink("CombatUnit", "UNIT-006"), derivedFrom: "GeneratedTacticalLead.unitId", dataset: "GeneratedTacticalLead", linkName: "supplyLead" },
      { id: "e-s8-3", sourceLabel: "COA-001 APPROVED", sourceType: "event", sourceColor: "#00ff88", relation: "AUTHORIZES", targetLabel: "USS-CARNEY ESCORT", targetType: "action", targetColor: "#00ff88", isNew: true, derivedFrom: "GeneratedTacticalLead.coaId", dataset: "GeneratedTacticalLead", linkName: "coaApproved" },
      { id: "e-s8-4", sourceLabel: "CNO TEAM", sourceType: "actor", sourceColor: "#a78bfa", relation: "TARGETING", targetLabel: "APT-41 SUEZ SCADA", targetType: "infrastructure", targetColor: "#ff6400", isNew: true, derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat", linkName: "cnoAction" },
    ],
    provenance: FULL_THEATER_PROVENANCE,
    briefingLines: [
      "CDR APPROVED COA-001 @ 14:22Z — USS CARNEY DDG-64 HARD ESCORT INITIATED — ETA CONVOY-BRAVO 18MIN",
      "EAGLE-01 C-17A AIRBORNE 14:19Z — AUAB → MUSCAT → CLJ — 180T CLASS I/V — ETA DJIBOUTI T+4H",
      "CNO TEAM: 2x NSA OPERATORS — APT-41 SUEZ SCADA C2 — TARGET PACKAGES COMPLETE — STANDING BY",
      "CONVOY-BRAVO INS BACKUP CONFIRMED — GPS INDEPENDENT NAV ACTIVE — AIS-001 TRACKING NOMINAL",
      "IRGC-EW ASHURA-3: SHADOW-01 MQ-9 ON STATION — THREAT SUPPRESSION AUTH IF CONVOY ENDANGERED",
    ],
    metrics: [
      { label: "COA STATUS",  value: "APPROVED", color: "#00ff88" },
      { label: "ESCORT ETA",  value: "18MIN",    color: "#00ff88" },
      { label: "C-17",        value: "AIRBORNE", color: "#0ea5e9" },
      { label: "CNO TEAM",    value: "DEPLOYED", color: "#a78bfa" },
      { label: "INS NAV",     value: "ACTIVE",   color: "#00ff88" },
      { label: "THREAT LVL",  value: "↓54%",     color: "#ffb800" },
    ],
    threatLevel: 54,
  },

  // ─── SCENE 9 ─ T+112s ─ Canal Restored — Air Bridge Active ────────────────
  {
    id: 9, startMs: 160000,
    label: "CANAL RESTORED / AIR BRIDGE",
    location: "Suez Canal / Djibouti — Multi-Domain Response",
    narration: "APT-41 C2 SEVERED — NSA CNO SUCCESS — SUEZ SCADA RESTORING — CANAL TRANSIT RESUMING — EAGLE-01 OFFLOADING DJIBOUTI — NEOM RAIL ALT ROUTE ACTIVE",
    autoTab: "INTEL_FUSION",
    map: { lat: 30.5, lng: 34.5, zoom: 7.0, pitch: 40, bearing: 0 },
    intelItems: [
      {
        id: "S9-I-001", title: "NSA CNO SUCCESS: APT-41 Evicted — Suez SCADA Restoring — Canal Transit Resuming",
        url: "https://nshackathon.palantirfoundry.com", source: "HAWK-I_AI",
        summary: "NSA CNO operators successfully severed APT-41 Mandiant SOGU C2 implant from Port Said Siemens S7-400 gateway and Ismailia DNP3 grid controller at 14:47Z. EGA (Suez Canal Authority) confirms SCADA restoration — power grid nominal. VSL-004 (LNG carrier NORDIC LUNA) and VSL-008 (container MAERSK CAPE) both received canal transit clearance. Lock systems functional. Queue of 47 vessels beginning to move. NEOM Saudi Land Bridge rail restarted — GPS nav verified. HAWK-I assessing cascade supply chain recovery.",
        category: "action", score: 0.96, publishedDate: new Date().toISOString(),
      },
    ],
    sigintItems: [
      { interceptId: "SIG-015", sourceType: "COMINT", frequencyMhz: 156.8, bearingDeg: 0, lat: 31.26, lon: 32.28, timestamp: new Date().toISOString(), transcriptText: "EGA Port Said Control: 'All vessels: Suez Canal lock systems restored — transit clearances being issued — VSL-004 NORDIC LUNA cleared for northbound transit from Km 0' — VHF Ch 16", classification: "UNCLASSIFIED//FOUO", associatedThreatId: "THR-001", foundryUrl: foundryLink("SigintIntercept", "SIG-015") },
      { interceptId: "SIG-016", sourceType: "ELINT", frequencyMhz: 2400.0, bearingDeg: 0, lat: 31.26, lon: 32.28, timestamp: new Date().toISOString(), transcriptText: "APT-41 SOGU C2 beacon SILENT — last ping 14:47:23Z — confirmed severed — all 3 Suez SCADA compromised nodes now CLEAN", classification: "TOP SECRET", associatedThreatId: "THR-001", foundryUrl: foundryLink("SigintIntercept", "SIG-016") },
    ],
    isrItems: [
      { imageId: "ISR-004", sensorType: "SAR", resolutionM: 1.0, lat: 31.26, lon: 32.28, captureTimestamp: new Date().toISOString(), analystNotes: "SAR: Suez Canal lock gates OPEN — VSL-004 (LNG, 280m) entering northern lock — 47 vessel queue movement confirmed — port activity normal", targetVesselId: "VSL-004", imageUrl: "", foundryUrl: foundryLink("IsrImagery", "ISR-004") },
      { imageId: "ISR-005", sensorType: "EO",  resolutionM: 0.5, lat: 11.6,  lon: 43.13, captureTimestamp: new Date().toISOString(), analystNotes: "EO: EAGLE-01 C-17 on Djibouti apron — rear ramp open — offload operations in progress — 4x LMTV visible with palletized cargo", targetVesselId: "", imageUrl: "", foundryUrl: foundryLink("IsrImagery", "ISR-005") },
    ],
    humintItems: [
      { reportId: "HUM-010", sourceReliability: "A", infoCredibility: "1", reportText: "Source MANILA-6 CONFIRMS: APT-41 operators lost C2 contact — internal MSS comms intercept shows surprise and damage assessment underway — Suez compromise aborted", locationName: "Port Said, Egypt", lat: 31.26, lon: 32.28, timestamp: new Date().toISOString(), relatedThreatId: "THR-001", foundryUrl: foundryLink("HumintReport", "HUM-010") },
    ],
    aisItems: [
      { aisId: "AIS-003", mmsi: "338220001", vesselName: "NORDIC LUNA (VSL-004)",  vesselType: "LNG Tanker",   lat: 31.15, lon: 32.30, speedKnots: 8,  courseDeg: 0,   timestamp: new Date().toISOString(), linkedVesselId: "VSL-004", flagState: "NO", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-003") },
      { aisId: "AIS-004", mmsi: "338220002", vesselName: "MAERSK CAPE (VSL-008)",  vesselType: "Container",    lat: 30.80, lon: 32.35, speedKnots: 6,  courseDeg: 0,   timestamp: new Date().toISOString(), linkedVesselId: "VSL-008", flagState: "DK", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-004") },
      { aisId: "AIS-001", mmsi: "338230987", vesselName: "CONVOY-BRAVO",           vesselType: "Military Supply",lat: 13.2, lon: 43.8,  speedKnots: 14, courseDeg: 330, timestamp: new Date().toISOString(), linkedVesselId: "VSL-002", flagState: "US", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-001") },
    ],
    iocItems: [
      { iocId: "IOC-001", iocType: "IP", iocValue: "103.45.67.89", confidenceScore: 97, associatedThreatId: "THR-001", ttpReference: "T1071.001 / SOGU C2 BEACON — APT-41 SILENT since 14:47Z", firstSeen: new Date(Date.now()-86400000).toISOString(), lastSeen: new Date(Date.now()-900000).toISOString(), foundryUrl: foundryLink("CyberIoc", "IOC-001") },
    ],
    ontologyEdges: [
      { id: "e-s9-1", sourceLabel: "APT-41 (PRC)",      sourceType: "actor",   sourceColor: "#ff6400", relation: "EVICTED_FROM",  targetLabel: "Suez SCADA GW",       targetType: "infrastructure", targetColor: "#ffb800", isNew: true, sourcePalantirUrl: foundryLink("HostileThreat","THR-001"), derivedFrom: "HostileThreat.targetVesselId", dataset: "HostileThreat" },
      { id: "e-s9-2", sourceLabel: "VSL-004 NORDIC LUNA",sourceType: "vessel", sourceColor: "#00ff88", relation: "TRANSITING",    targetLabel: "Suez Canal",          targetType: "infrastructure", targetColor: "#00ff88", isNew: true, sourcePalantirUrl: foundryLink("LogisticsVessel","VSL-004"), derivedFrom: "LogisticsVessel.destinationPort", dataset: "LogisticsVessel", linkName: "transiting" },
      { id: "e-s9-3", sourceLabel: "VSL-008 MAERSK CAPE",sourceType: "vessel", sourceColor: "#00ff88", relation: "TRANSITING",    targetLabel: "Suez Canal",          targetType: "infrastructure", targetColor: "#00ff88", isNew: true, sourcePalantirUrl: foundryLink("LogisticsVessel","VSL-008"), derivedFrom: "LogisticsVessel.destinationPort", dataset: "LogisticsVessel", linkName: "transiting" },
      { id: "e-s9-4", sourceLabel: "EAGLE-01 C-17",      sourceType: "aircraft",sourceColor: "#0ea5e9", relation: "DELIVERED_TO", targetLabel: "UNIT-FOXTROT (CLJ)", targetType: "unit",           targetColor: "#00ff88", isNew: true, targetPalantirUrl: foundryLink("CombatUnit","UNIT-006"), derivedFrom: "GeneratedTacticalLead.unitId", dataset: "GeneratedTacticalLead", linkName: "deliveredStores" },
      { id: "e-s9-5", sourceLabel: "NEOM RAIL-01",        sourceType: "convoy",  sourceColor: "#ffb800", relation: "RESTARTED",    targetLabel: "Jeddah Islamic Port", targetType: "infrastructure", targetColor: "#00b464", isNew: true, derivedFrom: "LogisticsVessel.destination", dataset: "LogisticsVessel", linkName: "railAlt" },
    ],
    provenance: FULL_THEATER_PROVENANCE,
    briefingLines: [
      "NSA CNO SUCCESS @ 14:47Z — APT-41 SOGU BEACON SILENT — ALL 3 SUEZ SCADA NODES CLEAN",
      "EGA: SUEZ LOCK SYSTEMS RESTORED — VSL-004 NORDIC LUNA CLEARED NORTHBOUND TRANSIT",
      "VSL-008 MAERSK CAPE: CANAL TRANSIT APPROVED — 47-VESSEL QUEUE MOVING — $9.4B/DAY RESTORED",
      "EAGLE-01: DJIBOUTI OFFLOAD COMPLETE — 180T CLASS I/V TO UNIT-FOXTROT VIA GROUND CONVOY",
      "NEOM RAIL-01: GPS VERIFIED — RESTARTED — RIYADH → JEDDAH — ALTERNATIVE SUPPLY ROUTE ACTIVE",
    ],
    metrics: [
      { label: "SUEZ STATUS", value: "RESTORED", color: "#00ff88" },
      { label: "APT-41",      value: "EVICTED",  color: "#00ff88" },
      { label: "VESSELS",     value: "47 MOVING",color: "#22d3ee" },
      { label: "EAGLE-01",    value: "DELIVERED",color: "#0ea5e9" },
      { label: "NEOM RAIL",   value: "ACTIVE",   color: "#ffb800" },
      { label: "THREAT LVL",  value: "↓31%",     color: "#00ff88" },
    ],
    threatLevel: 31,
  },

  // ─── SCENE 10 ─ T+126s ─ Theater Stabilization — Supply Chain Status ──────
  {
    id: 10, startMs: 180000,
    label: "THEATER STABILIZATION",
    location: "Full Theater — Red Sea to Mediterranean",
    narration: "OPERATION EPIC FURY: SUPPLY CHAIN SECURED — RED SEA SLOC CLEAR — SUEZ NOMINAL — AIR BRIDGE ACTIVE — USS CARNEY ESCORT INBOUND — 3 ALTERNATIVE ROUTES ACTIVATED",
    autoTab: "AI_RECOMMENDATIONS",
    map: { lat: 22.0, lng: 40.0, zoom: 4.0, pitch: 30, bearing: 0 },
    intelItems: [
      {
        id: "S10-I-001", title: "HAWK-I THEATER ASSESSMENT: Supply Chain Threat Neutralized — 3 COAs Executed — All Routes Restored",
        url: "https://nshackathon.palantirfoundry.com", source: "HAWK-I_AI",
        summary: "OPERATION EPIC FURY OUTCOME: All three threat vectors neutralized. (1) APT-41 CYBER: NSA CNO eviction successful — Suez SCADA clean — $9.4B/day restored. (2) HOUTHI KINETIC: COA-001 USS CARNEY hard escort active — CONVOY-BRAVO en route Suez under protection. (3) IRGC-EW GPS: INS backup confirmed — SHADOW-01 MQ-9 on station for threat suppression. Supply chain alternatives: Air Bridge ALPHA (180T/day Al Udeid→Djibouti), NEOM Rail (3,200T alt), MSR TAMPA active. UNIT-DELTA and UNIT-FOXTROT stores: CRITICAL → STABLE T+24H. HAWK-I recommends: maintain COA-001 escort through Suez, sustain CNO watch 72H, continue MQ-9 Houthi surveillance.",
        category: "action", score: 0.99, publishedDate: new Date().toISOString(),
      },
    ],
    sigintItems: [
      { interceptId: "SIG-003", sourceType: "COMINT", frequencyMhz: 156.8, bearingDeg: 290, lat: 13.0, lon: 44.2, timestamp: new Date().toISOString(), transcriptText: "Houthi tactical comms reduced — ZULFIQAR-7 unit status unknown — TEL site Hudaydah cold", classification: "SECRET", associatedThreatId: "THR-003", foundryUrl: foundryLink("SigintIntercept", "SIG-003") },
    ],
    isrItems: [
      { imageId: "ISR-002", sensorType: "EO", resolutionM: 0.5, lat: 13.5, lon: 43.8, captureTimestamp: new Date().toISOString(), analystNotes: "EO: CONVOY-BRAVO + USS CARNEY DDG-64 in formation — northern Red Sea — course 340 — SUEZ approach track — Aegis radar active", targetVesselId: "VSL-002", imageUrl: "", foundryUrl: foundryLink("IsrImagery", "ISR-002") },
    ],
    humintItems: [
      { reportId: "HUM-011", sourceReliability: "B", infoCredibility: "2", reportText: "Source CALICO: Houthi ZULFIQAR-7 launch crew dispersed — US escort presence in Red Sea causing operational pause — ASBM threat suppressed for 48-72H", locationName: "Hudaydah, Yemen", lat: 14.8, lon: 42.95, timestamp: new Date().toISOString(), relatedThreatId: "THR-003", foundryUrl: foundryLink("HumintReport", "HUM-011") },
    ],
    aisItems: [
      { aisId: "AIS-001", mmsi: "338230987", vesselName: "CONVOY-BRAVO (ESCORTED)", vesselType: "Military Supply", lat: 13.5, lon: 43.8, speedKnots: 14, courseDeg: 340, timestamp: new Date().toISOString(), linkedVesselId: "VSL-002", flagState: "US", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-001") },
      { aisId: "AIS-003", mmsi: "338220001", vesselName: "NORDIC LUNA (VSL-004)",    vesselType: "LNG Tanker",    lat: 31.8,  lon: 32.3,  speedKnots: 10, courseDeg: 0, timestamp: new Date().toISOString(), linkedVesselId: "VSL-004", flagState: "NO", foundryUrl: foundryLink("MaritimeAisTrack", "AIS-003") },
    ],
    iocItems: [],
    ontologyEdges: [
      { id: "e-s10-1", sourceLabel: "Red Sea SLOC RS-001",  sourceType: "infrastructure", sourceColor: "#00ff88", relation: "STATUS: CLEAR",   targetLabel: "$5.1B/day RESTORED",   targetType: "infrastructure", targetColor: "#00ff88", isNew: false, derivedFrom: "LogisticsVessel.route", dataset: "LogisticsVessel" },
      { id: "e-s10-2", sourceLabel: "Suez Canal",           sourceType: "infrastructure", sourceColor: "#00ff88", relation: "STATUS: NOMINAL",  targetLabel: "$9.4B/day RESTORED",   targetType: "infrastructure", targetColor: "#00ff88", isNew: false, derivedFrom: "LogisticsVessel.route", dataset: "LogisticsVessel" },
      { id: "e-s10-3", sourceLabel: "Air Bridge ALPHA",     sourceType: "aircraft",       sourceColor: "#0ea5e9", relation: "OPERATIONAL",      targetLabel: "CJTF-HOA / UNIT-FX",  targetType: "unit",           targetColor: "#00ff88", isNew: false, derivedFrom: "GeneratedTacticalLead.unitId", dataset: "GeneratedTacticalLead" },
      { id: "e-s10-4", sourceLabel: "CONV ALPHA-1",         sourceType: "convoy",         sourceColor: "#ffb800", relation: "MOVING",           targetLabel: "Baghdad BIAP",         targetType: "infrastructure", targetColor: "#22d3ee", isNew: false, derivedFrom: "LogisticsVessel.destination", dataset: "LogisticsVessel" },
      { id: "e-s10-5", sourceLabel: "NEOM RAIL-01 (ALT)",   sourceType: "convoy",         sourceColor: "#ffb800", relation: "ACTIVE ALT ROUTE", targetLabel: "Jeddah Islamic Port", targetType: "infrastructure", targetColor: "#00b464", isNew: false, derivedFrom: "LogisticsVessel.destination", dataset: "LogisticsVessel" },
    ],
    provenance: FULL_THEATER_PROVENANCE,
    briefingLines: [
      "OPERATION EPIC FURY: ALL 3 THREAT VECTORS NEUTRALIZED — THEATER SUPPLY CHAIN SECURED",
      "RED SEA SLOC RS-001: CLEAR — CONVOY-BRAVO + USS CARNEY ESCORT — SUEZ ETA T+8H",
      "SUEZ CANAL: NOMINAL — APT-41 EVICTED — 47-VESSEL QUEUE CLEARING — $9.4B/DAY RESTORED",
      "3 ALTERNATIVE ROUTES ACTIVE: AIR BRIDGE ALPHA / NEOM RAIL / MSR TAMPA — RESILIENCE CONFIRMED",
      "UNIT-DELTA + UNIT-FOXTROT: CRITICAL STORES STATUS → STABLE — T+24H WINDOW SECURED",
    ],
    metrics: [
      { label: "THREATS",     value: "3/3 MITIG", color: "#00ff88" },
      { label: "SLOC RS-001", value: "CLEAR",     color: "#00ff88" },
      { label: "SUEZ",        value: "NOMINAL",   color: "#00ff88" },
      { label: "ALT ROUTES",  value: "3 ACTIVE",  color: "#ffb800" },
      { label: "SUPPLY RISK", value: "STABLE",    color: "#00ff88" },
      { label: "THREAT LVL",  value: "↓18%",      color: "#00ff88" },
    ],
    threatLevel: 18,
  },
];

export const SCENE_COUNT = DEMO_SCENES.length;
export const TOTAL_DEMO_MS = DEMO_SCENES[DEMO_SCENES.length - 1].startMs + 20000;
