import { Router } from "express";
import { logger } from "../lib/logger";
import {
  getTotalQueueDepth,
  getDatasetStatus,
  isPalantirFullyConnected,
  isPalantirPartiallyConfigured,
  getLastFlushAt,
  getLastAuthError,
  isPipelineRunning,
  startPipeline,
  stopPipeline,
  enqueue,
} from "../core/palantir-flush";
import {
  getCachedOntologyGraph,
  searchObjects,
  vesselFullPicture,
  threatActorProfile,
  traceLeadToThreat,
  OntologyNode,
  OntologyEdge,
} from "../core/palantir-read";
import {
  startMission,
  stopMission,
  getMissionCoaItems,
  getMissionStatus,
} from "../core/mission-runner";

const router = Router();

// Legacy batchQueue export
export const batchQueue: Array<Record<string, unknown>> = [];

// ---------------------------------------------------------------------------
// Stub ontology graph — fallback when Palantir reads are unavailable
// ---------------------------------------------------------------------------
const STUB_NODES: OntologyNode[] = [
  { id: "n1",  label: "APT-41 ACTOR",       type: "actor",          severity: "critical", properties: { country: "CN", confidence: 0.91 }, source: "stub" },
  { id: "n2",  label: "MODBUS GATEWAY",      type: "infrastructure", severity: "critical", properties: { ip: "104.21.14.82", port: 502 },    source: "stub" },
  { id: "n3",  label: "PG&E GRID SECTOR",    type: "infrastructure", severity: "high",     properties: { location: "San Francisco, CA" },     source: "stub" },
  { id: "n4",  label: "SUPPLY CONVOY-7",     type: "vessel",         severity: "high",     properties: { route: "I-80 East", cargo: "munitions" }, source: "stub" },
  { id: "n5",  label: "ROMEO-7 [HOSTILE]",   type: "threat",         severity: "critical", properties: { speed: 580, heading: 45 },           source: "stub" },
  { id: "n6",  label: "EAGLE-1 [UNIT]",      type: "unit",           severity: "info",     properties: { type: "friendly", alt: 28000 },      source: "stub" },
  { id: "n7",  label: "LAZARUS GROUP",        type: "actor",          severity: "high",     properties: { country: "KP", confidence: 0.85 },   source: "stub" },
  { id: "n8",  label: "PORT LOGISTICS SYS",  type: "infrastructure", severity: "high",     properties: { cve: "CVE-2025-1184" },              source: "stub" },
  { id: "n9",  label: "RED SEA CORRIDOR",    type: "event",          severity: "high",     properties: { threat: "Houthi ASBM" },             source: "stub" },
  { id: "n10", label: "CONVOY-BRAVO",        type: "vessel",         severity: "medium",   properties: { route: "Bab-el-Mandeb" },            source: "stub" },
];

const STUB_EDGES: OntologyEdge[] = [
  { id: "e1", source: "n1", target: "n2",  relation: "EXPLOITS",       weight: 0.91 },
  { id: "e2", source: "n2", target: "n3",  relation: "ENDANGERS",      weight: 0.85 },
  { id: "e3", source: "n5", target: "n4",  relation: "INTERCEPTS",     weight: 0.78 },
  { id: "e4", source: "n6", target: "n5",  relation: "TRACKS",         weight: 0.95 },
  { id: "e5", source: "n7", target: "n8",  relation: "EXPLOITS",       weight: 0.82 },
  { id: "e6", source: "n9", target: "n10", relation: "THREATENS",      weight: 0.88 },
  { id: "e7", source: "n1", target: "n4",  relation: "TARGETS_SUPPLY", weight: 0.72 },
];

const STUB_COA = [
  { id: "coa1", priority: 1, title: "IMMEDIATE: Isolate ICS Gateway 104.21.14.82", action: "Deploy network segmentation on Modbus gateway. Block ingress on port 502 from external ranges. Coordinate with PG&E SOC.", rationale: "APT-41 exploitation path leads directly to SF power grid sector. CVE-2021-32926 allows remote code execution. Lateral movement risk is critical.", relatedEntities: ["n1", "n2", "n3"], confidence: 0.94, urgency: "immediate", generatedAt: new Date().toISOString() },
  { id: "coa2", priority: 2, title: "HIGH: Divert SUPPLY CONVOY-7 via alternate route", action: "Redirect convoy via I-580 South. Assign EAGLE-1 escort. Increase ISR coverage over original I-80 corridor.", rationale: "ROMEO-7 track vector at current heading intercepts convoy position in ~22 minutes. No friendly air support on I-80 corridor.", relatedEntities: ["n4", "n5", "n6"], confidence: 0.87, urgency: "high", generatedAt: new Date().toISOString() },
  { id: "coa3", priority: 3, title: "HIGH: Patch Port Logistics CVE-2025-1184", action: "Emergency patch deployment to port management systems at Oakland, LA. Coordinate with TSA cyber team. Activate CISA ICS advisory protocol.", rationale: "Lazarus Group activity detected against port OT systems. Patch window is critical — ransomware pre-positioning likely underway.", relatedEntities: ["n7", "n8"], confidence: 0.83, urgency: "high", generatedAt: new Date().toISOString() },
  { id: "coa4", priority: 4, title: "MONITOR: Red Sea corridor — CONVOY-BRAVO exposure", action: "Maintain USS Carney intercept posture. Issue NOTAM for Bab-el-Mandeb transit. Coordinate with coalition assets.", rationale: "4th Houthi ASBM attack this week. CONVOY-BRAVO in transit window. Threat level elevated but interceptable.", relatedEntities: ["n9", "n10"], confidence: 0.79, urgency: "monitor", generatedAt: new Date().toISOString() },
];

// ---------------------------------------------------------------------------
// GET /ontology/graph — live Palantir data, falls back to stubs
// ---------------------------------------------------------------------------
router.get("/ontology/graph", async (_req, res) => {
  try {
    const graph = await getCachedOntologyGraph();
    if (graph.fromPalantir && graph.nodes.length > 0) {
      logger.info({ nodes: graph.nodes.length, edges: graph.edges.length }, "Serving live Palantir ontology graph");
      res.json({ nodes: graph.nodes, edges: graph.edges, palantirConnected: true, dataSource: "palantir-live", datasetsRead: graph.datasetsRead, lastSyncedAt: graph.readAt });
      return;
    }
    logger.info("Palantir read returned no data — serving stub ontology graph");
    res.json({ nodes: STUB_NODES, edges: STUB_EDGES, palantirConnected: isPalantirFullyConnected(), dataSource: "stub", datasetsRead: [], lastSyncedAt: new Date().toISOString() });
  } catch (err) {
    logger.warn({ err }, "Ontology graph read failed — serving stub");
    res.json({ nodes: STUB_NODES, edges: STUB_EDGES, palantirConnected: false, dataSource: "stub", datasetsRead: [], lastSyncedAt: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// GET /ontology/coa — COA items from mission runner + stubs
// ---------------------------------------------------------------------------
router.get("/ontology/coa", (_req, res) => {
  const palantirConnected = isPalantirFullyConnected();
  const missionCoa        = getMissionCoaItems();
  const missionStatus     = getMissionStatus();
  const palantirBase      = process.env["PALANTIR_URL"]?.replace(/https?:\/\//, "") ?? "nshackathon.palantirfoundry.com";

  const missionItems = missionCoa.map(c => ({
    id:              String(c["id"] ?? `mission-coa-${Date.now()}`),
    priority:        typeof c["priority"] === "number" ? c["priority"] : 99,
    title:           String(c["title"] ?? ""),
    action:          String(c["action"] ?? ""),
    rationale:       String(c["rationale"] ?? ""),
    relatedEntities: Array.isArray(c["relatedEntities"]) ? c["relatedEntities"] : [],
    confidence:      typeof c["confidence"] === "number" ? c["confidence"] : 0.9,
    urgency:         String(c["urgency"] ?? "high"),
    missionPhase:    missionStatus.currentPhase,
    generatedAt:     new Date().toISOString(),
    palantirLink:    `https://${palantirBase}/workspace/ontology/objects/GeneratedTacticalLead/${c["id"]}`,
  }));

  const stubItems = STUB_COA.map(c => ({
    ...c,
    generatedAt:  new Date().toISOString(),
    palantirLink: `https://nshackathon.palantirfoundry.com/workspace/ontology/objects/GeneratedTacticalLead/${c.id}`,
  }));

  const items = missionItems.length > 0
    ? [...missionItems, ...stubItems].sort((a, b) => a.priority - b.priority)
    : stubItems;

  res.json({ items, modelVersion: missionItems.length > 0 ? "HAWK-I-v2.0 / MISSION-LIVE" : "HAWK-I-STUB-v1.0", palantirConnected, missionPhase: missionStatus.currentPhase, missionRunning: missionStatus.running, generatedAt: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// POST /ontology/search — OSDK v2 direct search
// ---------------------------------------------------------------------------
router.post("/ontology/search", async (req, res) => {
  const { objectType, field, operator, value } = req.body as {
    objectType: string; field: string; operator: "lt" | "gt" | "eq" | "gte" | "lte" | "ne"; value: unknown;
  };
  if (!objectType || !field || !operator || value === undefined) {
    res.status(400).json({ error: "Required: objectType, field, operator, value" });
    return;
  }
  logger.info({ objectType, field, operator, value }, "OSDK direct search query");
  const results = await searchObjects(objectType, { type: operator, field, value });
  res.json({ objectType, field, operator, value, count: results.length, results, queriedAt: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// GET /ontology/status
// ---------------------------------------------------------------------------
router.get("/ontology/status", async (_req, res) => {
  const palantirUrl         = process.env["PALANTIR_URL"];
  const fullyConnected      = isPalantirFullyConnected();
  const partiallyConfigured = isPalantirPartiallyConfigured();
  const datasetStatus       = getDatasetStatus();
  const authError           = getLastAuthError();
  const hasClientCreds      = !!(process.env["PALANTIR_CLIENT_ID"] && process.env["PALANTIR_CLIENT_SECRET"]);
  const running             = isPipelineRunning();

  const graph = await getCachedOntologyGraph().catch(() => null);
  const ontologyLive = (graph?.fromPalantir && (graph?.nodes.length ?? 0) > 0) ?? false;

  let pipelineStatus: "awaiting_config" | "connecting" | "auth_error" | "live" | "idle" | "error" | "disconnected";
  if      (running && fullyConnected && !authError) pipelineStatus = "live";
  else if (authError)                               pipelineStatus = "auth_error";
  else if (!running && partiallyConfigured)         pipelineStatus = "idle";
  else if (partiallyConfigured)                     pipelineStatus = "connecting";
  else                                              pipelineStatus = "awaiting_config";

  res.json({
    palantirConnected:    fullyConnected && !authError,
    palantirPartial:      partiallyConfigured,
    palantirUrl:          palantirUrl ? palantirUrl.replace(/https?:\/\//, "").slice(0, 32) + "..." : null,
    datasets:             datasetStatus,
    shodanConnected:      !!process.env["SHODAN_API_KEY"],
    exaConnected:         !!process.env["EXA_API_KEY"],
    batchQueueDepth:      getTotalQueueDepth(),
    lastFlushAt:          getLastFlushAt() ?? null,
    authError,
    hasClientCreds,
    pipelineStatus,
    pipelineRunning:      running,
    ontologyLive,
    ontologyNodeCount:    graph?.nodes.length ?? 0,
    ontologyDatasetsRead: graph?.datasetsRead ?? [],
  });
});

// ---------------------------------------------------------------------------
// Intel type endpoints — live Palantir data from cache
// Served under /ontology/* (full path) AND short /sigint etc. aliases
// ---------------------------------------------------------------------------

// SIGINT Intercepts — SigintIntercept objects
router.get("/ontology/sigint", async (_req, res) => {
  try {
    const graph = await getCachedOntologyGraph();
    res.json({ count: graph.raw.sigint.length, items: graph.raw.sigint, queriedAt: graph.readAt, fromPalantir: graph.fromPalantir });
  } catch (err) { logger.warn({ err }, "SIGINT route error"); res.status(500).json({ error: "Failed to fetch SIGINT intercepts" }); }
});
router.get("/sigint", async (_req, res) => {
  try {
    const graph = await getCachedOntologyGraph();
    res.json({ data: graph.raw.sigint, count: graph.raw.sigint.length, fromPalantir: graph.fromPalantir });
  } catch (err) { logger.warn({ err }, "SIGINT alias error"); res.status(500).json({ error: "Failed to fetch SIGINT intercepts" }); }
});

// ISR Imagery — IsrImagery objects
router.get("/ontology/isr", async (_req, res) => {
  try {
    const graph = await getCachedOntologyGraph();
    res.json({ count: graph.raw.isr.length, items: graph.raw.isr, queriedAt: graph.readAt, fromPalantir: graph.fromPalantir });
  } catch (err) { logger.warn({ err }, "ISR route error"); res.status(500).json({ error: "Failed to fetch ISR imagery" }); }
});
router.get("/isr", async (_req, res) => {
  try {
    const graph = await getCachedOntologyGraph();
    res.json({ data: graph.raw.isr, count: graph.raw.isr.length, fromPalantir: graph.fromPalantir });
  } catch (err) { logger.warn({ err }, "ISR alias error"); res.status(500).json({ error: "Failed to fetch ISR imagery" }); }
});

// HUMINT Reports — HumintReport objects
router.get("/ontology/humint", async (_req, res) => {
  try {
    const graph = await getCachedOntologyGraph();
    res.json({ count: graph.raw.humint.length, items: graph.raw.humint, queriedAt: graph.readAt, fromPalantir: graph.fromPalantir });
  } catch (err) { logger.warn({ err }, "HUMINT route error"); res.status(500).json({ error: "Failed to fetch HUMINT reports" }); }
});
router.get("/humint", async (_req, res) => {
  try {
    const graph = await getCachedOntologyGraph();
    res.json({ data: graph.raw.humint, count: graph.raw.humint.length, fromPalantir: graph.fromPalantir });
  } catch (err) { logger.warn({ err }, "HUMINT alias error"); res.status(500).json({ error: "Failed to fetch HUMINT reports" }); }
});

// Maritime AIS Tracks — MaritimeAisTrack objects
router.get("/ontology/ais", async (_req, res) => {
  try {
    const graph = await getCachedOntologyGraph();
    res.json({ count: graph.raw.ais.length, items: graph.raw.ais, queriedAt: graph.readAt, fromPalantir: graph.fromPalantir });
  } catch (err) { logger.warn({ err }, "AIS route error"); res.status(500).json({ error: "Failed to fetch AIS tracks" }); }
});
router.get("/ais", async (_req, res) => {
  try {
    const graph = await getCachedOntologyGraph();
    res.json({ data: graph.raw.ais, count: graph.raw.ais.length, fromPalantir: graph.fromPalantir });
  } catch (err) { logger.warn({ err }, "AIS alias error"); res.status(500).json({ error: "Failed to fetch AIS tracks" }); }
});

// Cyber IOCs — CyberIoc objects
router.get("/ontology/iocs", async (_req, res) => {
  try {
    const graph = await getCachedOntologyGraph();
    res.json({ count: graph.raw.iocs.length, items: graph.raw.iocs, queriedAt: graph.readAt, fromPalantir: graph.fromPalantir });
  } catch (err) { logger.warn({ err }, "IOC route error"); res.status(500).json({ error: "Failed to fetch Cyber IOCs" }); }
});
router.get("/ioc", async (_req, res) => {
  try {
    const graph = await getCachedOntologyGraph();
    res.json({ data: graph.raw.iocs, count: graph.raw.iocs.length, fromPalantir: graph.fromPalantir });
  } catch (err) { logger.warn({ err }, "IOC alias error"); res.status(500).json({ error: "Failed to fetch Cyber IOCs" }); }
});

// ---------------------------------------------------------------------------
// GET /ontology/intel-summary — aggregated counts across all 10 object types
// ---------------------------------------------------------------------------
router.get("/ontology/intel-summary", async (_req, res) => {
  try {
    const graph = await getCachedOntologyGraph();
    const { raw } = graph;
    res.json({
      fromPalantir: graph.fromPalantir,
      datasetsRead: graph.datasetsRead,
      queriedAt:    graph.readAt,
      counts: {
        vessels:   raw.vessels.length,
        threats:   raw.threats.length,
        units:     raw.units.length,
        incidents: raw.incidents.length,
        leads:     raw.leads.length,
        sigint:    raw.sigint.length,
        isr:       raw.isr.length,
        humint:    raw.humint.length,
        ais:       raw.ais.length,
        iocs:      raw.iocs.length,
      },
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
    });
  } catch (err) {
    logger.warn({ err }, "Intel summary route error");
    res.status(500).json({ error: "Failed to fetch intel summary" });
  }
});

// ---------------------------------------------------------------------------
// Multi-Int Fusion Routes — 3-hop link traversals for high-value queries
// ---------------------------------------------------------------------------

// GET /vessel/:id/fusion — 360° vessel picture
// Returns vessel + all threats, incidents, ISR imagery, AIS tracks,
// plus supporting SIGINT/HUMINT/IOC for each threat, and COAs for each incident
router.get("/vessel/:id/fusion", async (req, res) => {
  const vesselId = req.params["id"];
  if (!vesselId) { res.status(400).json({ error: "vesselId required" }); return; }
  try {
    logger.info({ vesselId }, "Vessel 360 fusion requested");
    const fusion = await vesselFullPicture(vesselId);
    res.json({ vesselId, ...fusion, queriedAt: new Date().toISOString() });
  } catch (err) {
    logger.warn({ err, vesselId }, "Vessel fusion error");
    res.status(500).json({ error: `Failed to fetch fusion for vessel ${vesselId}` });
  }
});

// GET /threat/:id/profile — threat actor deep dive
// Returns threat + SIGINT/HUMINT/IOC corroboration + targeted vessel
router.get("/threat/:id/profile", async (req, res) => {
  const threatId = req.params["id"];
  if (!threatId) { res.status(400).json({ error: "threatId required" }); return; }
  try {
    logger.info({ threatId }, "Threat actor profile requested");
    const profile = await threatActorProfile(threatId);
    res.json({ threatId, ...profile, queriedAt: new Date().toISOString() });
  } catch (err) {
    logger.warn({ err, threatId }, "Threat profile error");
    res.status(500).json({ error: `Failed to fetch profile for threat ${threatId}` });
  }
});

// GET /lead/:id/trace — trace tactical lead back to originating threat
// Full chain: GeneratedTacticalLead → ConfirmedKineticIncident → LogisticsVessel → HostileThreat[]
router.get("/lead/:id/trace", async (req, res) => {
  const leadId = req.params["id"];
  if (!leadId) { res.status(400).json({ error: "leadId required" }); return; }
  try {
    logger.info({ leadId }, "Lead-to-threat trace requested");
    const trace = await traceLeadToThreat(leadId);
    if (!trace) { res.status(404).json({ error: `Lead ${leadId} not found` }); return; }
    res.json({ leadId, ...trace, queriedAt: new Date().toISOString() });
  } catch (err) {
    logger.warn({ err, leadId }, "Lead trace error");
    res.status(500).json({ error: `Failed to trace lead ${leadId}` });
  }
});

// ---------------------------------------------------------------------------
// Pipeline start / stop
// ---------------------------------------------------------------------------
router.post("/pipeline/start", (_req, res) => {
  startPipeline();
  startMission();
  logger.info("Pipeline + mission start requested via API");
  res.json({ ok: true, pipelineRunning: true, missionRunning: true });
});

router.post("/pipeline/stop", (_req, res) => {
  stopPipeline();
  stopMission();
  logger.info("Pipeline + mission stop requested via API");
  res.json({ ok: true, pipelineRunning: false, missionRunning: false });
});

export { enqueue };
export default router;
