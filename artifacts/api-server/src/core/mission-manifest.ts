// ---------------------------------------------------------------------------
// Project Hawk-I — "Epic Fury" Mission Manifest
// 12 ticks × 5 seconds = 60-second orchestrated demo timeline
// ---------------------------------------------------------------------------

export type MissionEventType = "intel" | "threat" | "track_update" | "kinetic" | "coa";

export interface MissionEvent {
  tick:  number;                // 0–11
  phase: 1 | 2 | 3 | 4;
  type:  MissionEventType;
  data:  Record<string, unknown>;
}

export interface MissionPhase {
  id:          1 | 2 | 3 | 4;
  label:       string;
  startTick:   number;
  endTick:     number;
  description: string;
  color:       string;
}

export const MISSION_PHASES: MissionPhase[] = [
  {
    id: 1, label: "OSINT_COLLECTION",
    startTick: 0, endTick: 2,
    description: "Exa OSINT signals: Suez Canal congestion + Red Sea MARSEC Level 3",
    color: "#00bcd4",
  },
  {
    id: 2, label: "CYBER_ESCALATION",
    startTick: 3, endTick: 5,
    description: "APT-41 detected on Egyptian ICS/SCADA — canal lock control at risk",
    color: "#ff6400",
  },
  {
    id: 3, label: "KINETIC_ESCALATION",
    startTick: 6, endTick: 8,
    description: "ASBM launch + mine detonation — CONVOY-BRAVO under active threat",
    color: "#ff1e3c",
  },
  {
    id: 4, label: "COA_GENERATION",
    startTick: 9, endTick: 11,
    description: "HAWK-I Courses of Action activated — commander decision required",
    color: "#00ff88",
  },
];

// Geographic anchors
const RED_SEA  = { lat: 12.80, lng: 43.60 };
const BAB_MANDEB = { lat: 12.70, lng: 43.50 };
const PORT_SAID  = { lat: 31.26, lng: 32.28 };
const ISMAILIA   = { lat: 30.58, lng: 32.27 };

export const MISSION_MANIFEST: MissionEvent[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE 1 — OSINT COLLECTION  (ticks 0-2)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    tick: 0, phase: 1, type: "intel",
    data: {
      id: "EF-I-001",
      title: "Suez Canal Northbound Queue Hits 47 Vessels — Military Logistics CRITICAL",
      url: "https://www.maritime-executive.com",
      source: "MARITIME_EXEC",
      summary: "Operation Epic Fury AOR: 47 vessels queued northbound including allied logistics ships CONVOY-BRAVO, VSL-004, VSL-008. Estimated 72-hour delay impacts UNIT-DELTA and UNIT-CHARLIE resupply windows critically. Egyptian Canal Authority citing 'increased traffic management protocols.'",
      publishedDate: new Date(Date.now() - 600000).toISOString(),
      score: 0.99, category: "threat",
    },
  },
  {
    tick: 0, phase: 1, type: "intel",
    data: {
      id: "EF-I-002",
      title: "Red Sea MARSEC Level 3 Declared — Houthi Drone Swarm Near Bab-el-Mandeb",
      url: "https://www.centcom.mil",
      source: "CENTCOM_INTEL",
      summary: "MARSEC Level 3 declared for Red Sea transit corridor. Houthi drone swarm (~14 UAVs) tracked at 12.6°N 43.4°E moving toward active shipping lanes. CONVOY-BRAVO is in threat window. USS Carney intercept posture active but asset repositioning required.",
      publishedDate: new Date(Date.now() - 480000).toISOString(),
      score: 0.97, category: "kinetic",
    },
  },
  {
    tick: 1, phase: 1, type: "intel",
    data: {
      id: "EF-I-003",
      title: "Operation Epic Fury: CENTCOM Activates Emergency Logistics Routing Protocols",
      url: "https://www.defense.gov",
      source: "DoD_PRESS",
      summary: "CENTCOM activated Epic Fury emergency logistics routing in response to simultaneous Suez congestion and Red Sea threat escalation. Cape of Good Hope alternative adds 14-day delay. HAWK-I analysis: UNIT-FOXTROT reaches critical supply threshold in 58 hours on current timeline.",
      publishedDate: new Date(Date.now() - 360000).toISOString(),
      score: 0.96, category: "geopolitical",
    },
  },
  {
    tick: 1, phase: 1, type: "track_update",
    data: { id: "TRK-SEA-001", status: "DELAYED", cargo: "Petroleum, oils, lubricants — CRITICAL SHORTAGE" },
  },
  {
    tick: 2, phase: 1, type: "intel",
    data: {
      id: "EF-I-004",
      title: "Red Sea Maritime Security May 2026 — Systematic Campaign Targeting Allied Logistics",
      url: "https://www.nato.int",
      source: "NATO_IFC",
      summary: "NATO Intelligence Fusion Centre: systematic threat pattern targeting allied logistics vessels in Red Sea and Gulf of Aden. Pattern analysis indicates coordinated campaign against Epic Fury supply chain. Three vessels with military cargo are designated highest-risk.",
      publishedDate: new Date(Date.now() - 240000).toISOString(),
      score: 0.95, category: "threat",
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE 2 — CYBER ESCALATION  (ticks 3-5)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    tick: 3, phase: 2, type: "threat",
    data: {
      id: "EF-C-001",
      label: "APT-41 ICS Intrusion — Suez Canal Authority SCADA",
      category: "cyber", severity: "critical",
      source: "APT-41 (CN)",
      target: "Suez Canal Authority Modbus Gateway 41.65.12.88:502",
      confidence: 0.97,
      description: "APT-41 exploitation of Modbus TCP gateway controlling canal lock actuators at Port Said. CVE-2021-32926 (RCE) confirmed active. Lateral movement into vessel traffic management systems detected.",
      cves: ["CVE-2021-32926", "CVE-2020-14511"],
      lat: PORT_SAID.lat, lng: PORT_SAID.lng,
    },
  },
  {
    tick: 3, phase: 2, type: "threat",
    data: {
      id: "EF-C-002",
      label: "DNP3 Anomaly — Ismailia Regional Power Grid",
      category: "cyber", severity: "high",
      source: "UNKNOWN_APT",
      target: "Ismailia Power Grid DNP3 Controller 41.65.44.21:20000",
      confidence: 0.84,
      description: "Anomalous DNP3 polling on Ismailia power grid SCADA. Successful exploitation would cause canal navigation light outage and traffic control system failure — forcing total canal closure.",
      cves: ["CVE-2022-22965"],
      lat: ISMAILIA.lat, lng: ISMAILIA.lng,
    },
  },
  {
    tick: 4, phase: 2, type: "intel",
    data: {
      id: "EF-I-005",
      title: "HAWK-I Passive Scan: 14 Exposed ICS Devices on Egyptian Maritime Infrastructure",
      url: "https://www.shodan.io",
      source: "SHODAN_INTEL",
      summary: "Cross-referenced Shodan data: 14 exposed ICS/SCADA devices on Egyptian maritime IP ranges (AS8452, AS24863). Includes Modbus, DNP3, and Siemens S7 devices with no authentication enforcement. Direct attack surface for canal disruption campaign.",
      publishedDate: new Date(Date.now() - 180000).toISOString(),
      score: 0.93, category: "vulnerability",
    },
  },
  {
    tick: 4, phase: 2, type: "track_update",
    data: { id: "TRK-SEA-001", status: "COMMS_DEGRADED" },
  },
  {
    tick: 5, phase: 2, type: "threat",
    data: {
      id: "EF-C-003",
      label: "GPS Spoofing — Red Sea Shipping Corridor",
      category: "electronic", severity: "high",
      source: "IRGC_EW",
      target: "CONVOY-BRAVO Navigation Systems",
      confidence: 0.79,
      description: "GPS spoofing signal at 12.9°N 43.7°E consistent with IRGC electronic warfare signature. CONVOY-BRAVO navigation deviation of 4.2nm detected — vessel may be guided toward coastal threat zone.",
      lat: 12.9, lng: 43.7,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE 3 — KINETIC ESCALATION  (ticks 6-8)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    tick: 6, phase: 3, type: "track_update",
    data: { id: "TRK-SEA-003", type: "hostile", status: "THREAT_VECTOR_LOCKED", heading: 280, speed: 180 },
  },
  {
    tick: 6, phase: 3, type: "track_update",
    data: { id: "TRK-SEA-001", type: "friendly", status: "UNDER_THREAT" },
  },
  {
    tick: 7, phase: 3, type: "kinetic",
    data: {
      id: "KE-EF-001",
      type: "kinetic_strike",
      location: "Red Sea — Bab-el-Mandeb Strait (12.7°N, 43.5°E)",
      lat: BAB_MANDEB.lat, lng: BAB_MANDEB.lng,
      description: "ASBM launch confirmed from Houthi-controlled territory. Missile vector toward CONVOY-BRAVO confirmed. USS Carney SM-2 intercept initiated. Impact window: T+4 minutes.",
      reportedBy: "USS_CARNEY_CIC",
    },
  },
  {
    tick: 8, phase: 3, type: "kinetic",
    data: {
      id: "KE-EF-002",
      type: "explosion",
      location: "Port Said Harbor Approach (31.3°N, 32.3°E)",
      lat: 31.30, lng: 32.30,
      description: "Underwater detonation near Port Said harbor approach channel. Naval mine suspected. Canal Authority halted all traffic. VSL-004 and VSL-008 in immediate danger zone.",
      reportedBy: "CANAL_AUTHORITY_LIAISON",
    },
  },
  {
    tick: 8, phase: 3, type: "track_update",
    data: { id: "TRK-SEA-001", status: "CRITICAL_EMERGENCY" },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE 4 — COA GENERATION  (ticks 9-11)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    tick: 9, phase: 4, type: "intel",
    data: {
      id: "EF-I-006",
      title: "HAWK-I Assessment: Supply Chain Cascade Failure Imminent — 3 COAs Generated",
      url: "https://nshackathon.palantirfoundry.com",
      source: "HAWK-I_AI",
      summary: "HAWK-I ontology traversal complete. Chain confirmed: APT-41 SCADA → Canal disruption → CONVOY-BRAVO delayed → UNIT-FOXTROT critical shortage in 58hrs. Three Courses of Action generated. Immediate action on COA-1 (USS Carney repositioning) required to prevent mission degradation.",
      publishedDate: new Date().toISOString(),
      score: 0.99, category: "threat",
    },
  },
  {
    tick: 10, phase: 4, type: "coa",
    data: {
      id: "EF-COA-001",
      priority: 1,
      title: "IMMEDIATE: USS CARNEY INTERCEPT — CONVOY-BRAVO PROTECTION",
      action: "Reposition USS Carney (DDG-64) to 12.5°N, 43.4°E. Activate full SM-2/SM-6 intercept posture. Establish 25nm maritime exclusion zone around CONVOY-BRAVO. Coordinate with EAGLE-1 for air coverage.",
      rationale: "Ontology chain confirmed: THR-003 (Houthi ASBM) ENDANGERS VSL-002 (CONVOY-BRAVO) SUPPLIED_BY UNIT-FOXTROT. UNIT-FOXTROT reaches critical supply threshold in 58hrs. USS Carney is closest intercept-capable asset at 34nm from current CONVOY-BRAVO position.",
      confidence: 0.96,
      urgency: "immediate",
      relatedEntities: ["TRK-SEA-001", "TRK-SEA-002", "EF-C-001"],
    },
  },
  {
    tick: 11, phase: 4, type: "coa",
    data: {
      id: "EF-COA-002",
      priority: 2,
      title: "HIGH: SUEZ ICS CYBER COUNTERMEASURES — APT-41 EVICTION",
      action: "Deploy NSA CNO team: sever APT-41 C2 channel on 41.65.12.88:502. Coordinate with Egyptian CCA for emergency firewall on Canal Authority SCADA. Parallel: activate backup GPS constellation for CONVOY-BRAVO navigation.",
      rationale: "APT-41 canal lock access creates secondary blockage independent of ASBM threat. Canal closure strands VSL-004 and VSL-008, degrading UNIT-DELTA and UNIT-CHARLIE readiness simultaneously. Cyber eviction window: 12 minutes before lateral movement completes.",
      confidence: 0.91,
      urgency: "high",
      relatedEntities: ["EF-C-001", "EF-C-002", "TRK-SUEZ-001"],
    },
  },
  {
    tick: 11, phase: 4, type: "coa",
    data: {
      id: "EF-COA-003",
      priority: 3,
      title: "NEAR-TERM: REROUTE VSL-004, VSL-008 VIA CAPE OF GOOD HOPE",
      action: "Issue immediate course change: reverse through Mediterranean → Strait of Gibraltar → Cape of Good Hope → Indian Ocean. Assign EAGLE-1 air escort through Red Sea departure phase. ETA delay: +14 days.",
      rationale: "14-day delay preferable to vessel loss. UNIT-DELTA (78%) and UNIT-CHARLIE (82%) readiness sustains 14-day delay on current stockpiles. Cape route eliminates both Suez kinetic and Egyptian cyber threat vectors entirely.",
      confidence: 0.88,
      urgency: "near-term",
      relatedEntities: ["TRK-SUEZ-001", "TRK-SUEZ-002"],
    },
  },
];
