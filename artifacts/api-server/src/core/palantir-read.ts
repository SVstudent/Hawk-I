import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Palantir OSDK v2 — Ontology Read Layer
// Ontology RID is supplied at runtime via PALANTIR_ONTOLOGY_RID.
//
// 10 Object types:
//   LogisticsVessel, HostileThreat, CombatUnit,
//   ConfirmedKineticIncident, GeneratedTacticalLead,
//   SigintIntercept, IsrImagery, HumintReport,
//   MaritimeAisTrack, CyberIoc
//
// 9 Link types (forward / reverse):
//   endangers / targetedBy
//   suppliedBy / supplies
//   targets / incidents
//   derivedFrom / tacticalLeads
//   corroboratesThreat / sigintIntercepts
//   observesVessel / isrImagery
//   reportsOnThreat / humintReports
//   tracksVessel / aisTracks
//   attributedToThreat / cyberIocs
// ---------------------------------------------------------------------------

export const ONTOLOGY_RID = process.env["PALANTIR_ONTOLOGY_RID"] ?? process.env["ONTOLOGY_RID"] ?? "runtime-configured";

// OSDK v2 object type API names — exact camelCase as returned by Foundry
export const OT = {
  VESSEL:   "LogisticsVessel",
  THREAT:   "HostileThreat",
  UNIT:     "CombatUnit",
  INCIDENT: "ConfirmedKineticIncident",
  LEAD:     "GeneratedTacticalLead",
  SIGINT:   "SigintIntercept",
  ISR:      "IsrImagery",
  HUMINT:   "HumintReport",
  AIS:      "MaritimeAisTrack",
  IOC:      "CyberIoc",
} as const;

// Link API names — exact strings used in Foundry traversal URLs
export const LINKS = {
  // Forward (many → one)
  ENDANGERS:          "endangers",
  SUPPLIED_BY:        "suppliedBy",
  TARGETS:            "targets",
  DERIVED_FROM:       "derivedFrom",
  CORROBORATES_THREAT:"corroboratesThreat",
  OBSERVES_VESSEL:    "observesVessel",
  REPORTS_ON_THREAT:  "reportsOnThreat",
  TRACKS_VESSEL:      "tracksVessel",
  ATTRIBUTED_TO_THREAT:"attributedToThreat",
  // Reverse (one → many)
  TARGETED_BY:        "targetedBy",
  SUPPLIES:           "supplies",
  INCIDENTS:          "incidents",
  TACTICAL_LEADS:     "tacticalLeads",
  SIGINT_INTERCEPTS:  "sigintIntercepts",
  ISR_IMAGERY:        "isrImagery",
  HUMINT_REPORTS:     "humintReports",
  AIS_TRACKS:         "aisTracks",
  CYBER_IOCS:         "cyberIocs",
} as const;

// ---------------------------------------------------------------------------
// Auth — OAuth2 client_credentials + direct token fallback
// ---------------------------------------------------------------------------
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<{ url: string; token: string } | null> {
  const url          = process.env["PALANTIR_URL"] ?? process.env["FOUNDRY_URL"];
  const clientId     = process.env["PALANTIR_CLIENT_ID"] ?? process.env["CLIENT_ID"];
  const clientSecret = process.env["PALANTIR_CLIENT_SECRET"] ?? process.env["CLIENT_SECRET"];
  const directToken  = process.env["PALANTIR_TOKEN"] ?? process.env["FOUNDRY_TOKEN"];
  if (!url) return null;

  if (clientId && clientSecret) {
    const now = Date.now();
    if (cachedToken && cachedToken.expiresAt > now + 60_000) return { url, token: cachedToken.value };
    try {
      const res = await fetch(`${url}/multipass/api/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) { logger.warn({ status: res.status }, "OSDK auth failed"); return null; }
      const data = await res.json() as { access_token: string; expires_in: number };
      cachedToken = { value: data.access_token, expiresAt: now + (data.expires_in ?? 3600) * 1000 };
      return { url, token: cachedToken.value };
    } catch (err) { logger.warn({ err }, "OSDK auth exception"); return null; }
  }
  if (directToken) return { url, token: directToken };
  return null;
}

// ---------------------------------------------------------------------------
// OSDK v2 REST helpers
// ---------------------------------------------------------------------------
interface OsdkPage<T> { data: T[]; nextPageToken?: string | null; }

async function listObjects<T>(objectType: string): Promise<T[]> {
  const auth = await getToken();
  if (!auth) return [];
  const { url, token } = auth;
  const endpoint = `${url}/api/v2/ontologies/${ONTOLOGY_RID}/objects/${objectType}?pageSize=200`;
  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.warn({ objectType, status: res.status, body: body.slice(0, 200) }, "OSDK listObjects failed");
      return [];
    }
    const page = await res.json() as OsdkPage<T>;
    logger.info({ objectType, count: page.data?.length ?? 0 }, "OSDK listObjects success");
    return page.data ?? [];
  } catch (err) {
    logger.warn({ err, objectType }, "OSDK listObjects exception");
    return [];
  }
}

export async function getObject<T>(objectType: string, primaryKey: string): Promise<T | null> {
  const auth = await getToken();
  if (!auth) return null;
  const { url, token } = auth;
  const endpoint = `${url}/api/v2/ontologies/${ONTOLOGY_RID}/objects/${objectType}/${encodeURIComponent(primaryKey)}`;
  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logger.warn({ objectType, primaryKey, status: res.status }, "OSDK getObject failed");
      return null;
    }
    return await res.json() as T;
  } catch (err) {
    logger.warn({ err, objectType, primaryKey }, "OSDK getObject exception");
    return null;
  }
}

async function traverseLink<T>(objectType: string, primaryKey: string, linkName: string): Promise<T[]> {
  const auth = await getToken();
  if (!auth) return [];
  const { url, token } = auth;
  const encodedKey = encodeURIComponent(primaryKey);
  const endpoint = `${url}/api/v2/ontologies/${ONTOLOGY_RID}/objects/${objectType}/${encodedKey}/links/${linkName}?pageSize=50`;
  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logger.warn({ objectType, primaryKey, linkName, status: res.status }, "OSDK traverseLink failed");
      return [];
    }
    const page = await res.json() as OsdkPage<T>;
    return page.data ?? [];
  } catch (err) {
    logger.warn({ err, objectType, primaryKey, linkName }, "OSDK traverseLink exception");
    return [];
  }
}

export async function searchObjects<T>(objectType: string, where: Record<string, unknown>): Promise<T[]> {
  const auth = await getToken();
  if (!auth) return [];
  const { url, token } = auth;
  const endpoint = `${url}/api/v2/ontologies/${ONTOLOGY_RID}/objects/${objectType}/search`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ where, pageSize: 200 }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      logger.warn({ objectType, status: res.status }, "OSDK searchObjects failed");
      return [];
    }
    const page = await res.json() as OsdkPage<T>;
    return page.data ?? [];
  } catch (err) {
    logger.warn({ err, objectType }, "OSDK searchObjects exception");
    return [];
  }
}

// ---------------------------------------------------------------------------
// Typed object interfaces — property names match Foundry OSDK camelCase exactly
// ---------------------------------------------------------------------------

// Original 5
export interface VesselObject {
  vesselId:       string;
  classification: string;   // "Military Sealift", "Fuel Tanker", "Ammunition Supply"
  lat:            number;
  lon:            number;
  fuelStatus:     string;   // "Full", "Half", "Three-Quarter", "Critical"
  destination:    string;   // FK → CombatUnit.unitId
}

export interface ThreatObject {
  threatId:       string;
  domain:         string;   // "Cyber", "Physical", "Hybrid"
  description:    string;
  lat:            number;
  lon:            number;
  severityScore:  number;   // 1-10
  targetVesselId: string;   // FK → LogisticsVessel.vesselId
}

export interface UnitObject {
  unitId:                     string;
  unitName:                   string;
  lat:                        number;
  lon:                        number;
  combatReadiness:            number;  // 0.0-1.0
  criticalSupplyThresholdHrs: number;  // hours
}

export interface IncidentObject {
  incidentId:  string;
  targetId:    string;   // FK → LogisticsVessel.vesselId
  description: string;
  timestamp:   string;   // ISO8601
}

export interface LeadObject {
  leadId:     string;
  incidentId: string;   // FK → ConfirmedKineticIncident.incidentId
  coaText:    string;
  timestamp:  string;
}

// New 5 — exact camelCase property names from Foundry
export interface SigintObject {
  interceptId:       string;   // PK — "SIG-001" through "SIG-015"
  sourceType:        string;   // "COMINT" | "ELINT" | "FISINT"
  frequencyMhz:      number;
  bearingDeg:        number;
  lat:               number;
  lon:               number;
  timestamp:         string;
  transcriptText:    string;
  classification:    string;   // "SECRET" | "TOP SECRET"
  associatedThreatId:string;   // FK → HostileThreat.threatId
}

export interface IsrObject {
  imageId:          string;   // PK — "ISR-001" through "ISR-015"
  sensorType:       string;   // "SAR" | "EO" | "IR" | "MSI"
  resolutionM:      number;
  lat:              number;
  lon:              number;
  captureTimestamp: string;
  analystNotes:     string;
  targetVesselId:   string;   // FK → LogisticsVessel.vesselId
  imageUrl:         string;
}

export interface HumintObject {
  reportId:          string;   // PK — "HUM-001" through "HUM-012"
  sourceReliability: string;   // NATO: "A"–"F"
  infoCredibility:   string;   // NATO: "1"–"6"
  reportText:        string;
  locationName:      string;
  lat:               number;
  lon:               number;
  timestamp:         string;
  relatedThreatId:   string;   // FK → HostileThreat.threatId
}

export interface AisObject {
  aisId:         string;   // PK — "AIS-001" through "AIS-015"
  mmsi:          string;
  vesselName:    string;
  imoNumber:     string;
  vesselType:    string;
  lat:           number;
  lon:           number;
  speedKnots:    number;
  courseDeg:     number;
  timestamp:     string;
  linkedVesselId:string;   // FK → LogisticsVessel.vesselId
  flagState:     string;
}

export interface IocObject {
  iocId:              string;   // PK — "IOC-001" through "IOC-015"
  iocType:            string;   // "IP" | "DOMAIN" | "HASH" | "CVE"
  iocValue:           string;
  firstSeen:          string;
  lastSeen:           string;
  confidenceScore:    number;   // 0.0-1.0
  associatedThreatId: string;   // FK → HostileThreat.threatId
  ttpReference:       string;   // MITRE ATT&CK ID
}

// ---------------------------------------------------------------------------
// Convenience typed readers
// ---------------------------------------------------------------------------
export const listSigintIntercepts = () => listObjects<SigintObject>(OT.SIGINT);
export const listIsrImagery       = () => listObjects<IsrObject>(OT.ISR);
export const listHumintReports    = () => listObjects<HumintObject>(OT.HUMINT);
export const listAisTracks        = () => listObjects<AisObject>(OT.AIS);
export const listCyberIocs        = () => listObjects<IocObject>(OT.IOC);

// Multi-Int fusion helpers (used by fusion API routes)
export async function vesselFullPicture(vesselId: string) {
  const [vessel, threats, incidents, imagery, aisTracks] = await Promise.all([
    getObject<VesselObject>(OT.VESSEL, vesselId),
    traverseLink<ThreatObject>(OT.VESSEL, vesselId, LINKS.TARGETED_BY),
    traverseLink<IncidentObject>(OT.VESSEL, vesselId, LINKS.INCIDENTS),
    traverseLink<IsrObject>(OT.VESSEL, vesselId, LINKS.ISR_IMAGERY),
    traverseLink<AisObject>(OT.VESSEL, vesselId, LINKS.AIS_TRACKS),
  ]);
  const threatIntel = await Promise.all(threats.map(async t => ({
    threat: t,
    sigint: await traverseLink<SigintObject>(OT.THREAT, t.threatId, LINKS.SIGINT_INTERCEPTS),
    humint: await traverseLink<HumintObject>(OT.THREAT, t.threatId, LINKS.HUMINT_REPORTS),
    iocs:   await traverseLink<IocObject>(OT.THREAT, t.threatId, LINKS.CYBER_IOCS),
  })));
  const incidentCoas = await Promise.all(incidents.map(async i => ({
    incident: i,
    leads: await traverseLink<LeadObject>(OT.INCIDENT, i.incidentId, LINKS.TACTICAL_LEADS),
  })));
  return { vessel, threatIntel, incidentCoas, imagery, aisTracks };
}

export async function threatActorProfile(threatId: string) {
  const [threat, sigint, humint, iocs] = await Promise.all([
    getObject<ThreatObject>(OT.THREAT, threatId),
    traverseLink<SigintObject>(OT.THREAT, threatId, LINKS.SIGINT_INTERCEPTS),
    traverseLink<HumintObject>(OT.THREAT, threatId, LINKS.HUMINT_REPORTS),
    traverseLink<IocObject>(OT.THREAT, threatId, LINKS.CYBER_IOCS),
  ]);
  const targetedVessel = threat?.targetVesselId
    ? await getObject<VesselObject>(OT.VESSEL, threat.targetVesselId)
    : null;
  return { threat, sigint, humint, iocs, targetedVessel };
}

export async function traceLeadToThreat(leadId: string) {
  const lead = await getObject<LeadObject>(OT.LEAD, leadId);
  if (!lead) return null;
  const incident = await getObject<IncidentObject>(OT.INCIDENT, lead.incidentId);
  if (!incident) return { lead, incident: null, vessel: null, threats: [] };
  const vessel = incident.targetId
    ? await getObject<VesselObject>(OT.VESSEL, incident.targetId)
    : null;
  const threats = vessel
    ? await traverseLink<ThreatObject>(OT.VESSEL, vessel.vesselId, LINKS.TARGETED_BY)
    : [];
  return { lead, incident, vessel, threats };
}

// ---------------------------------------------------------------------------
// Ontology graph types
// ---------------------------------------------------------------------------
export interface OntologyNode {
  id:         string;
  label:      string;
  type:       "actor" | "infrastructure" | "vessel" | "unit" | "threat" | "event" | "lead" | "sigint" | "isr" | "humint" | "ais" | "ioc";
  severity:   "critical" | "high" | "medium" | "low" | "info";
  properties: Record<string, unknown>;
  source:     "palantir" | "stub";
}

export interface OntologyEdge {
  id:             string;
  source:         string;
  target:         string;
  relation:       string;
  weight:         number;
  source_dataset?: string;
}

export interface OntologyGraph {
  nodes:        OntologyNode[];
  edges:        OntologyEdge[];
  fromPalantir: boolean;
  datasetsRead: string[];
  readAt:       string;
  raw: {
    vessels:   VesselObject[];
    threats:   ThreatObject[];
    units:     UnitObject[];
    incidents: IncidentObject[];
    leads:     LeadObject[];
    sigint:    SigintObject[];
    isr:       IsrObject[];
    humint:    HumintObject[];
    ais:       AisObject[];
    iocs:      IocObject[];
  };
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------
function scoreToSeverity(score?: number): OntologyNode["severity"] {
  if (!score) return "medium";
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 5) return "medium";
  return "low";
}

function confidenceToSeverity(c?: number): OntologyNode["severity"] {
  if (!c) return "medium";
  if (c >= 0.9) return "high";
  if (c >= 0.7) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Build full ontology graph
// Phase 1: Parallel fetch all 10 object types
// Phase 2: Build edges from FK fields directly (fastest — no link traversal)
// ---------------------------------------------------------------------------
export async function readOntologyFromPalantir(): Promise<OntologyGraph> {
  // Phase 1 — all 10 types in parallel
  const [vessels, threats, units, incidents, leads, sigint, isr, humint, ais, iocs] = await Promise.all([
    listObjects<VesselObject>(OT.VESSEL),
    listObjects<ThreatObject>(OT.THREAT),
    listObjects<UnitObject>(OT.UNIT),
    listObjects<IncidentObject>(OT.INCIDENT),
    listObjects<LeadObject>(OT.LEAD),
    listObjects<SigintObject>(OT.SIGINT),
    listObjects<IsrObject>(OT.ISR),
    listObjects<HumintObject>(OT.HUMINT),
    listObjects<AisObject>(OT.AIS),
    listObjects<IocObject>(OT.IOC),
  ]);

  const nodes: OntologyNode[] = [];
  const edges: OntologyEdge[] = [];
  const datasetsRead: string[] = [];

  // --- LogisticsVessel nodes ---
  if (vessels.length > 0) datasetsRead.push(OT.VESSEL);
  for (const v of vessels) {
    nodes.push({ id: `ves-${v.vesselId}`, label: v.vesselId, type: "vessel", severity: "info", source: "palantir",
      properties: { classification: v.classification, lat: v.lat, lon: v.lon, fuelStatus: v.fuelStatus, destination: v.destination } });
  }

  // --- HostileThreat nodes ---
  if (threats.length > 0) datasetsRead.push(OT.THREAT);
  for (const t of threats) {
    nodes.push({ id: `thr-${t.threatId}`, label: t.threatId, type: "threat", severity: scoreToSeverity(t.severityScore), source: "palantir",
      properties: { domain: t.domain, description: t.description, lat: t.lat, lon: t.lon, severityScore: t.severityScore, targetVesselId: t.targetVesselId } });
  }

  // --- CombatUnit nodes ---
  if (units.length > 0) datasetsRead.push(OT.UNIT);
  for (const u of units) {
    nodes.push({ id: `unit-${u.unitId}`, label: u.unitName ?? u.unitId, type: "unit", severity: "info", source: "palantir",
      properties: { unitId: u.unitId, lat: u.lat, lon: u.lon, combatReadiness: u.combatReadiness, criticalSupplyThresholdHrs: u.criticalSupplyThresholdHrs } });
  }

  // --- ConfirmedKineticIncident nodes ---
  if (incidents.length > 0) datasetsRead.push(OT.INCIDENT);
  for (const inc of incidents) {
    nodes.push({ id: `inc-${inc.incidentId}`, label: inc.incidentId, type: "event", severity: "critical", source: "palantir",
      properties: { targetId: inc.targetId, description: inc.description, timestamp: inc.timestamp } });
  }

  // --- GeneratedTacticalLead nodes ---
  if (leads.length > 0) datasetsRead.push(OT.LEAD);
  for (const lead of leads) {
    nodes.push({ id: `lead-${lead.leadId}`, label: lead.leadId, type: "lead", severity: "high", source: "palantir",
      properties: { coaText: lead.coaText, incidentId: lead.incidentId, timestamp: lead.timestamp } });
  }

  // --- SigintIntercept nodes ---
  if (sigint.length > 0) datasetsRead.push(OT.SIGINT);
  for (const s of sigint) {
    nodes.push({ id: `sig-${s.interceptId}`, label: s.interceptId, type: "sigint", severity: confidenceToSeverity(0.8), source: "palantir",
      properties: { sourceType: s.sourceType, frequencyMhz: s.frequencyMhz, bearingDeg: s.bearingDeg, lat: s.lat, lon: s.lon, classification: s.classification, transcriptText: s.transcriptText, associatedThreatId: s.associatedThreatId } });
  }

  // --- IsrImagery nodes ---
  if (isr.length > 0) datasetsRead.push(OT.ISR);
  for (const img of isr) {
    nodes.push({ id: `isr-${img.imageId}`, label: img.imageId, type: "isr", severity: "high", source: "palantir",
      properties: { sensorType: img.sensorType, resolutionM: img.resolutionM, lat: img.lat, lon: img.lon, analystNotes: img.analystNotes, targetVesselId: img.targetVesselId, imageUrl: img.imageUrl } });
  }

  // --- HumintReport nodes ---
  if (humint.length > 0) datasetsRead.push(OT.HUMINT);
  for (const h of humint) {
    nodes.push({ id: `hum-${h.reportId}`, label: h.reportId, type: "humint", severity: "medium", source: "palantir",
      properties: { sourceReliability: h.sourceReliability, infoCredibility: h.infoCredibility, locationName: h.locationName, lat: h.lat, lon: h.lon, reportText: h.reportText, relatedThreatId: h.relatedThreatId } });
  }

  // --- MaritimeAisTrack nodes ---
  if (ais.length > 0) datasetsRead.push(OT.AIS);
  for (const a of ais) {
    nodes.push({ id: `ais-${a.aisId}`, label: a.vesselName ?? a.aisId, type: "ais", severity: "info", source: "palantir",
      properties: { mmsi: a.mmsi, imoNumber: a.imoNumber, vesselType: a.vesselType, lat: a.lat, lon: a.lon, speedKnots: a.speedKnots, courseDeg: a.courseDeg, linkedVesselId: a.linkedVesselId, flagState: a.flagState } });
  }

  // --- CyberIoc nodes ---
  if (iocs.length > 0) datasetsRead.push(OT.IOC);
  for (const ioc of iocs) {
    nodes.push({ id: `ioc-${ioc.iocId}`, label: ioc.iocValue ?? ioc.iocId, type: "ioc", severity: confidenceToSeverity(ioc.confidenceScore), source: "palantir",
      properties: { iocType: ioc.iocType, iocValue: ioc.iocValue, confidenceScore: ioc.confidenceScore, ttpReference: ioc.ttpReference, associatedThreatId: ioc.associatedThreatId, firstSeen: ioc.firstSeen, lastSeen: ioc.lastSeen } });
  }

  // ---------------------------------------------------------------------------
  // Phase 2 — Build edges from FK fields directly (faster than link traversal)
  // ---------------------------------------------------------------------------

  // Threat —[ENDANGERS]→ Vessel (FK: targetVesselId)
  for (const t of threats) {
    if (t.targetVesselId) {
      edges.push({ id: `e-endanger-${t.threatId}`, source: `thr-${t.threatId}`, target: `ves-${t.targetVesselId}`, relation: "ENDANGERS", weight: (t.severityScore ?? 5) / 10, source_dataset: "HostileThreat.targetVesselId" });
    }
  }

  // Vessel —[SUPPLIED_BY]→ Unit (FK: destination = unitId)
  for (const v of vessels) {
    if (v.destination) {
      edges.push({ id: `e-supply-${v.vesselId}`, source: `ves-${v.vesselId}`, target: `unit-${v.destination}`, relation: "SUPPLIED_BY", weight: 0.85, source_dataset: "LogisticsVessel.destination" });
    }
  }

  // Incident —[TARGETS]→ Vessel (FK: targetId)
  for (const inc of incidents) {
    if (inc.targetId) {
      edges.push({ id: `e-targets-${inc.incidentId}`, source: `inc-${inc.incidentId}`, target: `ves-${inc.targetId}`, relation: "TARGETS", weight: 0.95, source_dataset: "ConfirmedKineticIncident.targetId" });
    }
  }

  // Lead —[DERIVED_FROM]→ Incident (FK: incidentId)
  for (const lead of leads) {
    if (lead.incidentId) {
      edges.push({ id: `e-derived-${lead.leadId}`, source: `lead-${lead.leadId}`, target: `inc-${lead.incidentId}`, relation: "DERIVED_FROM", weight: 1.0, source_dataset: "GeneratedTacticalLead.incidentId" });
    }
  }

  // SIGINT —[CORROBORATES]→ Threat (FK: associatedThreatId)
  for (const s of sigint) {
    if (s.associatedThreatId) {
      edges.push({ id: `e-sigint-${s.interceptId}`, source: `sig-${s.interceptId}`, target: `thr-${s.associatedThreatId}`, relation: "CORROBORATES", weight: 0.9, source_dataset: "SigintIntercept.associatedThreatId" });
    }
  }

  // ISR —[OBSERVES]→ Vessel (FK: targetVesselId)
  for (const img of isr) {
    if (img.targetVesselId) {
      edges.push({ id: `e-isr-${img.imageId}`, source: `isr-${img.imageId}`, target: `ves-${img.targetVesselId}`, relation: "OBSERVES", weight: 0.9, source_dataset: "IsrImagery.targetVesselId" });
    }
  }

  // HUMINT —[REPORTS_ON]→ Threat (FK: relatedThreatId)
  for (const h of humint) {
    if (h.relatedThreatId) {
      edges.push({ id: `e-humint-${h.reportId}`, source: `hum-${h.reportId}`, target: `thr-${h.relatedThreatId}`, relation: "REPORTS_ON", weight: 0.8, source_dataset: "HumintReport.relatedThreatId" });
    }
  }

  // AIS —[TRACKS]→ Vessel (FK: linkedVesselId)
  for (const a of ais) {
    if (a.linkedVesselId) {
      edges.push({ id: `e-ais-${a.aisId}`, source: `ais-${a.aisId}`, target: `ves-${a.linkedVesselId}`, relation: "TRACKS", weight: 0.95, source_dataset: "MaritimeAisTrack.linkedVesselId" });
    }
  }

  // IOC —[ATTRIBUTED_TO]→ Threat (FK: associatedThreatId)
  for (const ioc of iocs) {
    if (ioc.associatedThreatId) {
      edges.push({ id: `e-ioc-${ioc.iocId}`, source: `ioc-${ioc.iocId}`, target: `thr-${ioc.associatedThreatId}`, relation: "ATTRIBUTED_TO", weight: ioc.confidenceScore ?? 0.8, source_dataset: "CyberIoc.associatedThreatId" });
    }
  }

  const fromPalantir = datasetsRead.length > 0;

  logger.info(
    { nodes: nodes.length, edges: edges.length, datasetsRead, fromPalantir,
      vessels: vessels.length, threats: threats.length, units: units.length,
      incidents: incidents.length, leads: leads.length,
      sigint: sigint.length, isr: isr.length, humint: humint.length,
      ais: ais.length, iocs: iocs.length },
    "OSDK v2 ontology read complete"
  );

  return {
    nodes, edges, fromPalantir, datasetsRead,
    readAt: new Date().toISOString(),
    raw: { vessels, threats, units, incidents, leads, sigint, isr, humint, ais, iocs },
  };
}

// ---------------------------------------------------------------------------
// RAG serialization — full ontology as plain text for GPT context window
// ---------------------------------------------------------------------------
export function serializeOntologyForRag(graph: OntologyGraph): string {
  if (!graph.fromPalantir || graph.nodes.length === 0) return "";
  const { raw } = graph;
  const lines: string[] = [
    "=== PALANTIR ONTOLOGY: PROJECT HAWK-I (MIDDLE EAST THEATER) ===",
    `Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`,
    `Fetched: ${graph.readAt}`,
    `Types: ${graph.datasetsRead.join(", ")}`,
    "",
  ];

  if (raw.vessels.length > 0) {
    lines.push(`── LOGISTICS VESSELS (${raw.vessels.length}) ──`);
    for (const v of raw.vessels) lines.push(`  ${v.vesselId}: ${v.classification} | Pos:${v.lat?.toFixed(3)},${v.lon?.toFixed(3)} | Fuel:${v.fuelStatus} | Dest:${v.destination}`);
    lines.push("");
  }
  if (raw.threats.length > 0) {
    lines.push(`── HOSTILE THREATS (${raw.threats.length}) ──`);
    for (const t of raw.threats) lines.push(`  ${t.threatId}: [${t.domain}] Sev:${t.severityScore}/10 → ${t.targetVesselId} | ${t.description}`);
    lines.push("");
  }
  if (raw.units.length > 0) {
    lines.push(`── COMBAT UNITS (${raw.units.length}) ──`);
    for (const u of raw.units) lines.push(`  ${u.unitId}: ${u.unitName} | Readiness:${((u.combatReadiness ?? 0) * 100).toFixed(0)}% | Supply:${u.criticalSupplyThresholdHrs}hrs`);
    lines.push("");
  }
  if (raw.incidents.length > 0) {
    lines.push(`── KINETIC INCIDENTS (${raw.incidents.length}) ──`);
    for (const i of raw.incidents) lines.push(`  ${i.incidentId}: Target:${i.targetId} @ ${i.timestamp} | ${i.description}`);
    lines.push("");
  }
  if (raw.leads.length > 0) {
    lines.push(`── TACTICAL LEADS (${raw.leads.length}) ──`);
    for (const l of raw.leads) lines.push(`  ${l.leadId}: From:${l.incidentId} | ${l.coaText}`);
    lines.push("");
  }
  if (raw.sigint.length > 0) {
    lines.push(`── SIGINT INTERCEPTS (${raw.sigint.length}) ──`);
    for (const s of raw.sigint) lines.push(`  ${s.interceptId}: [${s.sourceType}] ${s.frequencyMhz}MHz Brg:${s.bearingDeg}° → ${s.associatedThreatId} | [${s.classification}] ${(s.transcriptText ?? "").slice(0, 120)}`);
    lines.push("");
  }
  if (raw.isr.length > 0) {
    lines.push(`── ISR IMAGERY (${raw.isr.length}) ──`);
    for (const i of raw.isr) lines.push(`  ${i.imageId}: [${i.sensorType}] ${i.resolutionM}m GSD → ${i.targetVesselId} | ${(i.analystNotes ?? "").slice(0, 100)}`);
    lines.push("");
  }
  if (raw.humint.length > 0) {
    lines.push(`── HUMINT REPORTS (${raw.humint.length}) ──`);
    for (const h of raw.humint) lines.push(`  ${h.reportId}: [Rel:${h.sourceReliability}/Cred:${h.infoCredibility}] ${h.locationName} → ${h.relatedThreatId} | ${(h.reportText ?? "").slice(0, 100)}`);
    lines.push("");
  }
  if (raw.ais.length > 0) {
    lines.push(`── AIS TRACKS (${raw.ais.length}) ──`);
    for (const a of raw.ais) lines.push(`  ${a.aisId}: ${a.vesselName} MMSI:${a.mmsi} | ${a.speedKnots}kts/${a.courseDeg}° | Pos:${a.lat?.toFixed(3)},${a.lon?.toFixed(3)} → ${a.linkedVesselId} [${a.flagState}]`);
    lines.push("");
  }
  if (raw.iocs.length > 0) {
    lines.push(`── CYBER IOCs (${raw.iocs.length}) ──`);
    for (const c of raw.iocs) lines.push(`  ${c.iocId}: [${c.iocType}] ${c.iocValue} | Conf:${((c.confidenceScore ?? 0) * 100).toFixed(0)}% | ${c.ttpReference} → ${c.associatedThreatId}`);
    lines.push("");
  }
  if (graph.edges.length > 0) {
    lines.push(`── RELATIONSHIP EDGES (${graph.edges.length}) ──`);
    const edgeCounts = new Map<string, number>();
    for (const e of graph.edges) edgeCounts.set(e.relation, (edgeCounts.get(e.relation) ?? 0) + 1);
    for (const [rel, count] of edgeCounts) lines.push(`  ${rel}: ${count} edges`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 30-second TTL cache
// ---------------------------------------------------------------------------
let cachedGraph: OntologyGraph | null = null;
let lastFetchAt = 0;
const TTL_MS = 30_000;

export async function getCachedOntologyGraph(): Promise<OntologyGraph> {
  const now = Date.now();
  if (cachedGraph && now - lastFetchAt < TTL_MS) return cachedGraph;
  try {
    cachedGraph = await readOntologyFromPalantir();
    lastFetchAt = now;
  } catch (err) {
    logger.warn({ err }, "Palantir OSDK read failed — returning cached/empty graph");
    if (!cachedGraph) {
      cachedGraph = {
        nodes: [], edges: [], fromPalantir: false, datasetsRead: [],
        readAt: new Date().toISOString(),
        raw: { vessels: [], threats: [], units: [], incidents: [], leads: [], sigint: [], isr: [], humint: [], ais: [], iocs: [] },
      };
    }
  }
  return cachedGraph;
}

export function invalidateOntologyCache() { lastFetchAt = 0; }
