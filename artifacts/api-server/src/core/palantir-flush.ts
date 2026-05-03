import { logger } from "../lib/logger";
import { getBattlespaceState } from "./battlespace-cache";

// ---------------------------------------------------------------------------
// Per-dataset flush queues
// Column names are snake_case to match Foundry dataset schemas exactly.
//
// IMPORTANT: OSDK property names (camelCase) ≠ dataset column names (snake_case)
// When READING via ontology API: camelCase (vesselId, threatId)
// When WRITING via dataset API:  snake_case (vessel_id, threat_id)
// ---------------------------------------------------------------------------
interface DatasetQueue {
  rid:  string;              // env var name that holds the RID value
  name: string;              // human-readable dataset name
  rows: Record<string, unknown>[];
}

const queues: Record<string, DatasetQueue> = {
  // Original 5 datasets
  logistics:    { rid: "PALANTIR_RID_LOGISTICS_TRACKS",             name: "Raw_Logistics_Tracks",           rows: [] },
  combatUnits:  { rid: "PALANTIR_RID_COMBAT_UNITS",                 name: "Raw_Combat_Units",               rows: [] },
  cyberThreats: { rid: "PALANTIR_RID_CYBER_THREATS",                name: "Raw_Cyber_Physical_Threats",     rows: [] },
  kineticEvents:{ rid: "PALANTIR_RID_KINETIC_INCIDENTS",            name: "Confirmed_Kinetic_Incidents",    rows: [] },
  tacticalLeads:{ rid: "PALANTIR_RID_TACTICAL_LEADS",               name: "Generated_Tactical_Leads",       rows: [] },
  // New 7 datasets
  confirmedKinetic: { rid: "PALANTIR_RID_CONFIRMED_KINETIC_INCIDENTS", name: "Confirmed_Kinetic_Incidents_v2",  rows: [] },
  generatedLeads:   { rid: "PALANTIR_RID_GENERATED_TACTICAL_LEADS",   name: "Generated_Tactical_Leads_v2",     rows: [] },
  sigintIntercepts: { rid: "PALANTIR_RID_SIGINT_INTERCEPTS",           name: "SIGINT_Intercepts",               rows: [] },
  isrImagery:       { rid: "PALANTIR_RID_ISR_IMAGERY",                 name: "ISR_Imagery",                     rows: [] },
  humintReports:    { rid: "PALANTIR_RID_HUMINT_REPORTS",              name: "HUMINT_Reports",                  rows: [] },
  maritimeAis:      { rid: "PALANTIR_RID_MARITIME_AIS_TRACKS",         name: "Maritime_AIS_Tracks",             rows: [] },
  cyberIocs:        { rid: "PALANTIR_RID_CYBER_IOCS",                  name: "Cyber_IOCs",                      rows: [] },
};

export type DatasetKey = keyof typeof queues;

export function enqueue(dataset: DatasetKey, row: Record<string, unknown>) {
  queues[dataset].rows.push({ ...row, _enqueuedAt: new Date().toISOString() });
}

export function getTotalQueueDepth(): number {
  return Object.values(queues).reduce((sum, q) => sum + q.rows.length, 0);
}

export function getQueueDepths(): Record<string, number> {
  return Object.fromEntries(Object.entries(queues).map(([k, q]) => [k, q.rows.length]));
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
let cachedOAuthToken: { value: string; expiresAt: number } | null = null;

async function getEffectiveToken(url: string): Promise<string | null> {
  const directToken  = process.env["PALANTIR_TOKEN"];
  const clientId     = process.env["PALANTIR_CLIENT_ID"];
  const clientSecret = process.env["PALANTIR_CLIENT_SECRET"];

  if (clientId && clientSecret) {
    const now = Date.now();
    if (cachedOAuthToken && cachedOAuthToken.expiresAt > now + 60_000) return cachedOAuthToken.value;
    try {
      const res = await fetch(`${url}/multipass/api/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json() as { access_token: string; expires_in: number };
        cachedOAuthToken = { value: data.access_token, expiresAt: now + data.expires_in * 1000 };
        logger.info("Palantir OAuth2 token refreshed");
        return cachedOAuthToken.value;
      }
      const body = await res.text();
      logger.warn({ status: res.status, body }, "Palantir OAuth2 token fetch failed");
      lastAuthError = `OAuth2 token error ${res.status}: ${body.slice(0, 120)}`;
      return null;
    } catch (err) {
      logger.warn({ err }, "Palantir OAuth2 token fetch exception");
      lastAuthError = String(err);
      return null;
    }
  }
  return directToken ?? null;
}

// ---------------------------------------------------------------------------
// Config & status
// ---------------------------------------------------------------------------
let lastAuthError: string | null = null;
let lastFlushAt:   string | null = null;

function getBaseConfig() {
  const url            = process.env["PALANTIR_URL"];
  const token          = process.env["PALANTIR_TOKEN"];
  const hasClientCreds = !!(process.env["PALANTIR_CLIENT_ID"] && process.env["PALANTIR_CLIENT_SECRET"]);
  return { url, token, hasClientCreds, ready: !!(url && (token || hasClientCreds)) };
}

export function getDatasetStatus(): Record<string, { name: string; ridConfigured: boolean; canFlush: boolean }> {
  const { ready } = getBaseConfig();
  return Object.fromEntries(
    Object.entries(queues).map(([key, q]) => {
      const ridConfigured = !!process.env[q.rid];
      return [key, { name: q.name, ridConfigured, canFlush: ready && ridConfigured }];
    })
  );
}

export function isPalantirFullyConnected(): boolean {
  const { ready } = getBaseConfig();
  if (!ready) return false;
  return Object.values(queues).some(q => !!process.env[q.rid]);
}

export function isPalantirPartiallyConfigured(): boolean {
  return Object.values(queues).some(q => !!process.env[q.rid]);
}

export function getLastFlushAt()   { return lastFlushAt; }
export function getLastAuthError() { return lastAuthError; }

// ---------------------------------------------------------------------------
// CSV builder — snake_case column names to match Foundry dataset schemas
// ---------------------------------------------------------------------------
function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map(r => keys.map(k => escape(r[k])).join(","))].join("\n");
}

async function flushDataset(queue: DatasetQueue, url: string, token: string) {
  const rid = process.env[queue.rid];
  if (!rid || queue.rows.length === 0) return;

  const rows = [...queue.rows];
  queue.rows.length = 0;
  try {
    const csv = rowsToCsv(rows);
    const uploadRes = await fetch(
      `${url}/api/v1/datasets/${rid}/files:upload?filePath=norad_${queue.name}.csv&branchId=master`,
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" }, body: csv, signal: AbortSignal.timeout(20_000) }
    );
    if (!uploadRes.ok) {
      const body = await uploadRes.text();
      if (uploadRes.status === 401 || uploadRes.status === 403) lastAuthError = `Permission denied (${uploadRes.status}): ${body.slice(0, 160)}`;
      logger.warn({ dataset: queue.name, status: uploadRes.status, body: body.slice(0, 200) }, "Palantir upload failed");
      queue.rows.unshift(...rows);
      return;
    }
    const result = await uploadRes.json() as { transactionRid?: string; sizeBytes?: string };
    lastAuthError = null;
    logger.info({ dataset: queue.name, rows: rows.length, txRid: result.transactionRid }, "Flushed to Palantir");
  } catch (err) {
    logger.warn({ err, dataset: queue.name }, "Palantir flush exception");
    queue.rows.unshift(...rows);
  }
}

// ---------------------------------------------------------------------------
// Sync battlespace state → queues (snake_case column names match dataset schemas)
// ---------------------------------------------------------------------------
const SEVERITY_SCORE: Record<string, number> = { critical: 10, high: 8, medium: 6, low: 4 };

const UNIT_COORDS: Record<string, { lat: number; lon: number }> = {
  "NAS Alameda":   { lat: 37.7735, lon: -122.3019 },
  "Pacific Ocean": { lat: 38.1,    lon: 135.6 },
  "Red Sea":       { lat: 12.86,   lon: 43.63 },
};

function unitLatLon(location: string): { lat: number; lon: number } {
  for (const [key, coords] of Object.entries(UNIT_COORDS)) {
    if (location.includes(key)) return coords;
  }
  return { lat: 0, lon: 0 };
}

const KNOWN_VESSEL_IDS = ["SUPPLY CONVOY-7", "CONVOY-BRAVO", "ROMEO-7", "ROMEO-9"];
function extractTargetVesselId(text: string): string {
  return KNOWN_VESSEL_IDS.find(id => text.includes(id)) ?? "";
}

function syncBattlespaceToQueues() {
  const state = getBattlespaceState();
  const now   = new Date().toISOString();

  // logistics — columns: vessel_id, classification, lat, lon, fuel_status, destination
  if (process.env[queues.logistics.rid]) {
    for (const track of state.logisticsTracks) {
      queues.logistics.rows.push({
        vessel_id:       track.callSign,
        classification:  track.type,
        lat:             track.lat,
        lon:             track.lng,
        fuel_status:     track.status,
        destination:     track.cargo ?? (track.type === "hostile" ? "INTERCEPT" : "UNKNOWN"),
        _synced_at:      now,
      });
    }
  }

  // combatUnits — columns: unit_id, unit_name, lat, lon, combat_readiness, critical_supply_threshold_hrs
  if (process.env[queues.combatUnits.rid]) {
    for (const unit of state.combatUnits) {
      const coords = unitLatLon(unit.location);
      queues.combatUnits.rows.push({
        unit_id:                        unit.designation,
        unit_name:                      unit.designation,
        lat:                            coords.lat,
        lon:                            coords.lon,
        combat_readiness:               unit.strength / 100,
        critical_supply_threshold_hrs:  72,
        _synced_at:                     now,
      });
    }
  }

  // cyberThreats — columns: threat_id, domain, description, lat, lon, severity_score, target_vessel_id
  if (process.env[queues.cyberThreats.rid]) {
    for (const threat of state.activeThreats) {
      queues.cyberThreats.rows.push({
        threat_id:        threat.id,
        domain:           threat.category,
        description:      threat.description,
        lat:              threat.lat ?? 0,
        lon:              threat.lng ?? 0,
        severity_score:   SEVERITY_SCORE[threat.severity] ?? 6,
        target_vessel_id: extractTargetVesselId(threat.target),
        _synced_at:       now,
      });
    }
  }

  // kineticEvents (old RID) — columns: incident_id, target_id, description, timestamp
  if (process.env[queues.kineticEvents.rid]) {
    for (const evt of state.kineticEvents) {
      queues.kineticEvents.rows.push({
        incident_id:  evt.id,
        target_id:    extractTargetVesselId(evt.description + " " + evt.location),
        description:  evt.description,
        timestamp:    evt.timestamp,
        _synced_at:   now,
      });
    }
  }

  // confirmedKinetic (new RID) — columns: incident_id, target_id, description, timestamp
  if (process.env[queues.confirmedKinetic.rid]) {
    for (const evt of state.kineticEvents) {
      queues.confirmedKinetic.rows.push({
        incident_id:  evt.id,
        target_id:    extractTargetVesselId(evt.description + " " + evt.location),
        description:  evt.description,
        timestamp:    evt.timestamp,
        _synced_at:   now,
      });
    }
  }

  // generatedLeads (new RID) — columns: lead_id, incident_id, coa_text, timestamp
  if (process.env[queues.generatedLeads.rid]) {
    for (const evt of state.kineticEvents) {
      queues.generatedLeads.rows.push({
        lead_id:     `LEAD-${evt.id}`,
        incident_id: evt.id,
        coa_text:    `COA: Tactical response to ${evt.description}`,
        timestamp:   now,
        _synced_at:  now,
      });
    }
  }

  // sigintIntercepts — columns: intercept_id, source_type, frequency_mhz, bearing_deg, lat, lon, timestamp, transcript_text, classification, associated_threat_id
  if (process.env[queues.sigintIntercepts.rid]) {
    for (const threat of state.activeThreats.filter(t => t.category === "sigint" || t.category === "electronic")) {
      queues.sigintIntercepts.rows.push({
        intercept_id:         `SIG-${threat.id}`,
        source_type:          "ELINT",
        frequency_mhz:        156.8,
        bearing_deg:          0,
        lat:                  threat.lat ?? 0,
        lon:                  threat.lng ?? 0,
        timestamp:            now,
        transcript_text:      threat.description,
        classification:       "SECRET",
        associated_threat_id: threat.id,
        _synced_at:           now,
      });
    }
  }

  // isrImagery — columns: image_id, sensor_type, resolution_m, lat, lon, capture_timestamp, analyst_notes, target_vessel_id, image_url
  if (process.env[queues.isrImagery.rid]) {
    for (const threat of state.activeThreats.filter(t => t.category === "kinetic" || t.category === "air")) {
      queues.isrImagery.rows.push({
        image_id:         `ISR-${threat.id}`,
        sensor_type:      "EO",
        resolution_m:     0.5,
        lat:              threat.lat ?? 0,
        lon:              threat.lng ?? 0,
        capture_timestamp:now,
        analyst_notes:    threat.description,
        target_vessel_id: extractTargetVesselId(threat.target),
        image_url:        "",
        _synced_at:       now,
      });
    }
  }

  // humintReports — columns: report_id, source_reliability, info_credibility, report_text, location_name, lat, lon, timestamp, related_threat_id
  if (process.env[queues.humintReports.rid]) {
    for (const threat of state.activeThreats.filter(t => t.category === "intel" || t.category === "human")) {
      queues.humintReports.rows.push({
        report_id:          `HUM-${threat.id}`,
        source_reliability: "B",
        info_credibility:   "2",
        report_text:        threat.description,
        location_name:      threat.target,
        lat:                threat.lat ?? 0,
        lon:                threat.lng ?? 0,
        timestamp:          now,
        related_threat_id:  threat.id,
        _synced_at:         now,
      });
    }
  }

  // maritimeAis — columns: ais_id, mmsi, vessel_name, imo_number, vessel_type, lat, lon, speed_knots, course_deg, timestamp, linked_vessel_id, flag_state
  if (process.env[queues.maritimeAis.rid]) {
    for (const track of state.logisticsTracks.filter(t => t.type === "vessel" || t.type === "cargo" || t.type === "tanker")) {
      queues.maritimeAis.rows.push({
        ais_id:          `AIS-${track.callSign}`,
        mmsi:            track.callSign,
        vessel_name:     track.callSign,
        imo_number:      "",
        vessel_type:     track.type,
        lat:             track.lat,
        lon:             track.lng,
        speed_knots:     (track as Record<string, unknown>).speed ?? 0,
        course_deg:      (track as Record<string, unknown>).heading ?? 0,
        timestamp:       now,
        linked_vessel_id:track.callSign,
        flag_state:      "US",
        _synced_at:      now,
      });
    }
  }

  // cyberIocs — columns: ioc_id, ioc_type, ioc_value, first_seen, last_seen, confidence_score, associated_threat_id, ttp_reference
  if (process.env[queues.cyberIocs.rid]) {
    for (const threat of state.activeThreats.filter(t => t.category === "cyber" || t.category === "ics")) {
      queues.cyberIocs.rows.push({
        ioc_id:               `IOC-${threat.id}`,
        ioc_type:             "IP",
        ioc_value:            threat.id,
        first_seen:           now,
        last_seen:            now,
        confidence_score:     (SEVERITY_SCORE[threat.severity] ?? 6) / 10,
        associated_threat_id: threat.id,
        ttp_reference:        "T1190",
        _synced_at:           now,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Master flush loop
// ---------------------------------------------------------------------------
let pipelineRunning = false;
let flushTimer: ReturnType<typeof setInterval> | null = null;

async function flushAll() {
  if (!pipelineRunning) return;
  const { url, ready } = getBaseConfig();
  syncBattlespaceToQueues();
  if (!ready || !url) return;
  if (!pipelineRunning) return;
  const token = await getEffectiveToken(url);
  if (!token) { logger.warn("No effective Palantir token — skipping flush"); return; }
  if (!pipelineRunning) return;
  await Promise.allSettled(Object.values(queues).map(queue => flushDataset(queue, url, token)));
  if (pipelineRunning) lastFlushAt = new Date().toISOString();
}

function drainQueues() { for (const q of Object.values(queues)) q.rows.length = 0; }

export function startPipeline() {
  if (pipelineRunning) return;
  pipelineRunning = true;
  logger.info("Palantir pipeline STARTED — flushing every 5s");
  flushAll().catch(err => logger.warn({ err }, "flushAll error"));
  flushTimer = setInterval(() => { flushAll().catch(err => logger.warn({ err }, "flushAll error")); }, 5000);
}

export function stopPipeline() {
  if (!pipelineRunning) return;
  pipelineRunning = false;
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  drainQueues();
  logger.info("Palantir pipeline STOPPED — queues drained");
}

export function isPipelineRunning() { return pipelineRunning; }

// Legacy compat
export const batchQueue: Record<string, unknown>[] = [];
