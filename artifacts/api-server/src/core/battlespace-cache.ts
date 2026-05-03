import { logger } from "../lib/logger";

export interface LogisticsTrack {
  id: string;
  callSign: string;
  type: "friendly" | "hostile" | "unknown" | "neutral";
  lat: number;
  lng: number;
  altitude: number;
  speed: number;
  heading: number;
  status: string;
  cargo?: string;
  updatedAt: string;
}

export interface CombatUnit {
  id: string;
  designation: string;
  type: "air" | "ground" | "naval" | "cyber";
  affiliation: "friendly" | "hostile" | "unknown";
  location: string;
  strength: number;
  readiness: string;
  assets: string[];
  updatedAt: string;
}

export interface ActiveThreat {
  id: string;
  label: string;
  category: "cyber" | "kinetic" | "electronic" | "cbrn";
  severity: "critical" | "high" | "medium" | "low";
  source: string;
  target: string;
  confidence: number;
  description: string;
  cves?: string[];
  lat?: number;
  lng?: number;
  updatedAt: string;
}

export interface KineticEvent {
  id: string;
  type: "kinetic_strike" | "explosion" | "engagement" | "detonation";
  location: string;
  lat?: number;
  lng?: number;
  description: string;
  timestamp: string;
  reportedBy: string;
}

export interface BattlespaceState {
  logisticsTracks: LogisticsTrack[];
  combatUnits: CombatUnit[];
  activeThreats: ActiveThreat[];
  kineticEvents: KineticEvent[];
  lastUpdated: string;
  updateCount: number;
}

// ---------------------------------------------------------------------------
// In-memory battlespace cache
// ---------------------------------------------------------------------------
const state: BattlespaceState = {
  logisticsTracks: [
    {
      id: "LOG-001",
      callSign: "SUPPLY CONVOY-7",
      type: "friendly",
      lat: 37.7200,
      lng: -122.3800,
      altitude: 0,
      speed: 65,
      heading: 90,
      status: "ACTIVE",
      cargo: "Class V Munitions — 240t",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "LOG-002",
      callSign: "CONVOY-BRAVO",
      type: "friendly",
      lat: 12.8628,
      lng: 43.6290,
      altitude: 0,
      speed: 12,
      heading: 180,
      status: "TRANSIT",
      cargo: "Petroleum, oils, lubricants",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "LOG-003",
      callSign: "ROMEO-7",
      type: "hostile",
      lat: 37.6879,
      lng: -122.4702,
      altitude: 32000,
      speed: 580,
      heading: 45,
      status: "TRACKING",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "LOG-004",
      callSign: "ROMEO-9",
      type: "hostile",
      lat: 37.7200,
      lng: -122.3800,
      altitude: 41000,
      speed: 620,
      heading: 90,
      status: "TRACKING",
      updatedAt: new Date().toISOString(),
    },
  ],
  combatUnits: [
    {
      id: "UNIT-001",
      designation: "EAGLE-1",
      type: "air",
      affiliation: "friendly",
      location: "NAS Alameda, CA",
      strength: 95,
      readiness: "MISSION_CAPABLE",
      assets: ["F/A-18E x4", "EA-18G x2"],
      updatedAt: new Date().toISOString(),
    },
    {
      id: "UNIT-002",
      designation: "CARRIER STRIKE GROUP 5",
      type: "naval",
      affiliation: "friendly",
      location: "Pacific Ocean — 38.1°N, 135.6°E",
      strength: 100,
      readiness: "FULLY_OPERATIONAL",
      assets: ["CVN-76 x1", "CG-73 x1", "DDG-108 x2", "SSN-777 x1"],
      updatedAt: new Date().toISOString(),
    },
    {
      id: "UNIT-003",
      designation: "USS CARNEY (DDG-64)",
      type: "naval",
      affiliation: "friendly",
      location: "Red Sea — Bab-el-Mandeb Strait",
      strength: 100,
      readiness: "FULLY_OPERATIONAL",
      assets: ["SM-2 Block IIIB x90", "SM-6 x24", "Phalanx x2"],
      updatedAt: new Date().toISOString(),
    },
  ],
  activeThreats: [
    {
      id: "THR-001",
      label: "APT-41 ICS Gateway Intrusion",
      category: "cyber",
      severity: "critical",
      source: "APT-41 (CN)",
      target: "PG&E MODBUS Gateway 104.21.14.82:502",
      confidence: 0.94,
      description: "Active exploitation of CVE-2021-32926 on industrial control gateway. Lateral movement into SF Bay Area power grid sector detected. RCE capability confirmed.",
      cves: ["CVE-2021-32926", "CVE-2020-14511"],
      lat: 37.7749,
      lng: -122.4194,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "THR-002",
      label: "Lazarus Group Port OT Intrusion",
      category: "cyber",
      severity: "high",
      source: "LAZARUS GROUP (KP)",
      target: "Port of Oakland Logistics OT System",
      confidence: 0.85,
      description: "Ransomware pre-positioning detected in port OT systems. CVE-2025-1184 exploitation path confirmed. Targeting shipping manifest systems.",
      cves: ["CVE-2025-1184", "CVE-2019-13945"],
      lat: 37.7958,
      lng: -122.2784,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "THR-003",
      label: "Houthi ASBM Threat — Red Sea",
      category: "kinetic",
      severity: "high",
      source: "Houthi Movement (YE)",
      target: "CONVOY-BRAVO — Bab-el-Mandeb Transit",
      confidence: 0.88,
      description: "4th ASBM attack vector this week. CONVOY-BRAVO in active threat window. Drone swarm coordination possible. USS Carney intercept posture active.",
      lat: 12.8628,
      lng: 43.6290,
      updatedAt: new Date().toISOString(),
    },
  ],
  kineticEvents: [],
  lastUpdated: new Date().toISOString(),
  updateCount: 0,
};

// ---------------------------------------------------------------------------
// Simulate Palantir sync — update positions + timestamps every 5 seconds
// ---------------------------------------------------------------------------
function runBattlespaceUpdate() {
  const now = new Date().toISOString();
  state.updateCount += 1;

  state.logisticsTracks = state.logisticsTracks.map(track => ({
    ...track,
    lat: track.lat + (Math.random() - 0.5) * 0.002,
    lng: track.lng + (Math.random() - 0.5) * 0.002,
    updatedAt: now,
  }));

  state.combatUnits = state.combatUnits.map(unit => ({
    ...unit,
    updatedAt: now,
  }));

  state.activeThreats = state.activeThreats.map(threat => ({
    ...threat,
    updatedAt: now,
  }));

  state.lastUpdated = now;

  if (state.updateCount % 60 === 0) {
    logger.info({ updateCount: state.updateCount }, "Battlespace cache sync checkpoint");
  }
}

setInterval(runBattlespaceUpdate, 5000);

// ---------------------------------------------------------------------------
// Public accessors
// ---------------------------------------------------------------------------
export function getBattlespaceState(): BattlespaceState {
  return { ...state, logisticsTracks: [...state.logisticsTracks], combatUnits: [...state.combatUnits], activeThreats: [...state.activeThreats], kineticEvents: [...state.kineticEvents] };
}

export function addKineticEvent(event: KineticEvent) {
  state.kineticEvents.push(event);
  logger.info({ eventId: event.id, type: event.type }, "Kinetic event injected into battlespace cache");
}

export function getSerializedContext(): string {
  const s = getBattlespaceState();
  return [
    `=== BATTLESPACE STATE REPORT ===`,
    `Generated: ${s.lastUpdated} | Sync Count: ${s.updateCount}`,
    ``,
    `--- LOGISTICS TRACKS (${s.logisticsTracks.length}) ---`,
    s.logisticsTracks.map(t =>
      `[${t.type.toUpperCase()}] ${t.callSign} | LAT:${t.lat.toFixed(4)} LNG:${t.lng.toFixed(4)} | ALT:${t.altitude}ft SPD:${t.speed}kts HDG:${t.heading}° | STATUS:${t.status}${t.cargo ? ` | CARGO:${t.cargo}` : ""}`
    ).join("\n"),
    ``,
    `--- COMBAT UNITS (${s.combatUnits.length}) ---`,
    s.combatUnits.map(u =>
      `[${u.affiliation.toUpperCase()}] ${u.designation} (${u.type.toUpperCase()}) | LOC:${u.location} | STR:${u.strength}% | READINESS:${u.readiness} | ASSETS:${u.assets.join(", ")}`
    ).join("\n"),
    ``,
    `--- ACTIVE THREATS (${s.activeThreats.length}) ---`,
    s.activeThreats.map(t =>
      `[${t.severity.toUpperCase()}][${t.category.toUpperCase()}] ${t.label} | SRC:${t.source} → TGT:${t.target} | CONF:${(t.confidence * 100).toFixed(0)}% | ${t.description}${t.cves?.length ? ` | CVEs:${t.cves.join(",")}` : ""}`
    ).join("\n"),
    s.kineticEvents.length > 0 ? [
      ``,
      `--- KINETIC EVENTS (${s.kineticEvents.length}) ---`,
      s.kineticEvents.map(e =>
        `[${e.type.toUpperCase()}] ${e.description} | LOC:${e.location} | TIME:${e.timestamp} | RPT:${e.reportedBy}`
      ).join("\n"),
    ].join("\n") : "",
  ].filter(Boolean).join("\n");
}
