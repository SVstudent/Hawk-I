import { openai } from "@workspace/integrations-openai-ai-server";
import { getSerializedContext } from "./battlespace-cache";
import { getCachedOntologyGraph, serializeOntologyForRag, ONTOLOGY_RID } from "./palantir-read";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Foundry URL Builders — exact same spec as frontend demo-scenes.ts
// ---------------------------------------------------------------------------
const FOUNDRY_URL_BASE = "https://nshackathon.palantirfoundry.com";

const OBJECT_TYPE_IDS: Record<string, string> = {
  LogisticsVessel: "logistics-vessel", HostileThreat: "hostile-threat",
  CombatUnit: "combat-unit", ConfirmedKineticIncident: "confirmed-kinetic-incident",
  GeneratedTacticalLead: "generated-tactical-lead", SigintIntercept: "sigint-intercept",
  IsrImagery: "isr-imagery", HumintReport: "humint-report",
  MaritimeAisTrack: "maritime-ais-track", CyberIoc: "cyber-ioc",
  ExampleRv17memory: "example-rv17-memory",
};

const DATASET_RID_ENV_MAP: Record<string, string> = {
  LogisticsVessel: "PALANTIR_RID_LOGISTICS_TRACKS",
  HostileThreat: "PALANTIR_RID_CYBER_THREATS",
  CombatUnit: "PALANTIR_RID_COMBAT_UNITS",
  ConfirmedKineticIncident: "PALANTIR_RID_CONFIRMED_KINETIC_INCIDENTS",
  GeneratedTacticalLead: "PALANTIR_RID_GENERATED_TACTICAL_LEADS",
  SigintIntercept: "PALANTIR_RID_SIGINT_INTERCEPTS",
  IsrImagery: "PALANTIR_RID_ISR_IMAGERY",
  HumintReport: "PALANTIR_RID_HUMINT_REPORTS",
  MaritimeAisTrack: "PALANTIR_RID_MARITIME_AIS_TRACKS",
  CyberIoc: "PALANTIR_RID_CYBER_IOCS",
  ExampleRv17memory: "PALANTIR_MEMORY_DATASET_RID",
};

function objectUrl(apiName: string, pk: string): string {
  const id = OBJECT_TYPE_IDS[apiName] ?? apiName.toLowerCase();
  return `${FOUNDRY_URL_BASE}/workspace/ontology/objects/${id}/${encodeURIComponent(pk)}`;
}

function datasetUrl(apiName: string): string {
  const rid = process.env[DATASET_RID_ENV_MAP[apiName] ?? ""];
  return rid ? `${FOUNDRY_URL_BASE}/workspace/data-integration/dataset/preview/${rid}/master` : `${FOUNDRY_URL_BASE}/workspace/data-integration`;
}

// ---------------------------------------------------------------------------
// ProvenanceTracker — builds a real evidence chain for every AI response
// ---------------------------------------------------------------------------
export interface ProvenanceSource {
  type:           "object" | "dataset" | "link_traversal" | "memory" | "action";
  label:          string;
  objectType?:    string;
  primaryKey?:    string;
  linkTraversed?: string;
  url:            string;
  confidence?:    number;
}

export interface ProvenanceChain {
  id:                    string;
  query:                 string;
  sources:               ProvenanceSource[];
  traversalPath:         string[];
  totalObjectsConsulted: number;
  totalLinksTraversed:   number;
  decisionTimestamp:     string;
  modelVersion:          string;
  ontologyUrl:           string;
}

class ProvenanceTracker {
  private sources: ProvenanceSource[] = [];
  private traversals: string[] = [];

  trackObject(apiName: string, pk: string, label: string) {
    this.sources.push({ type: "object", label, objectType: apiName, primaryKey: pk, url: objectUrl(apiName, pk) });
  }

  trackDataset(apiName: string) {
    this.sources.push({ type: "dataset", label: `Dataset: ${apiName}`, objectType: apiName, url: datasetUrl(apiName) });
  }

  trackLink(fromType: string, fromPk: string, linkName: string, toType: string, toPk: string) {
    this.traversals.push(`${fromType}(${fromPk}) --[${linkName}]--> ${toType}(${toPk})`);
    this.sources.push({ type: "link_traversal", label: `${fromType}.${linkName} → ${toType}`, objectType: toType, primaryKey: toPk, linkTraversed: linkName, url: objectUrl(toType, toPk) });
  }

  trackMemory(pk: string, content: string) {
    this.sources.push({ type: "memory", label: `Memory: "${content.slice(0, 60)}…"`, objectType: "ExampleRv17memory", primaryKey: pk, url: objectUrl("ExampleRv17memory", pk) });
  }

  markReferenced(answer: string) {
    for (const s of this.sources) {
      if (s.primaryKey && answer.includes(s.primaryKey)) s.confidence = 1.0;
    }
  }

  build(query: string, modelVersion: string): ProvenanceChain {
    return {
      id: `PROV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      query,
      sources: this.sources,
      traversalPath: this.traversals.slice(0, 50),
      totalObjectsConsulted: this.sources.filter(s => s.type === "object").length,
      totalLinksTraversed:   this.sources.filter(s => s.type === "link_traversal").length,
      decisionTimestamp: new Date().toISOString(),
      modelVersion,
      ontologyUrl: `${FOUNDRY_URL_BASE}/workspace/ontology/${ONTOLOGY_RID}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Auth helper — reuses the same OAuth flow as palantir-read
// ---------------------------------------------------------------------------
let _memToken: { value: string; expiresAt: number } | null = null;

async function getFoundryAuth(): Promise<{ url: string; token: string } | null> {
  const url          = process.env["PALANTIR_URL"];
  const clientId     = process.env["PALANTIR_CLIENT_ID"];
  const clientSecret = process.env["PALANTIR_CLIENT_SECRET"];
  const directToken  = process.env["PALANTIR_TOKEN"];
  if (!url) return null;
  if (clientId && clientSecret) {
    const now = Date.now();
    if (_memToken && _memToken.expiresAt > now + 60_000) return { url, token: _memToken.value };
    try {
      const r = await fetch(`${url}/multipass/api/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret, scope: "api:read-data api:write-data api:use-ontologies-write" }),
      });
      if (r.ok) {
        const j = await r.json() as { access_token: string; expires_in: number };
        _memToken = { value: j.access_token, expiresAt: now + j.expires_in * 1000 };
        return { url, token: _memToken.value };
      }
    } catch { /* fall through */ }
  }
  if (directToken && url) return { url, token: directToken };
  return null;
}

// ---------------------------------------------------------------------------
// Long-Term Memory — Palantir ExampleRv17memory Object Type
// Object API Name: ExampleRv17memory
// Create Action:   example-rv17-create-memory
// Delete Action:   example-rv17-delete-memory
// ---------------------------------------------------------------------------

export interface FoundryMemory {
  primaryKey: string;
  content:    string;
  sender:     string;   // "user" | "assistant"
  userId:     string;
  timestamp:  string;
  embedding?: number[]; // 1536-dim, omit in context serialization
}

export interface MemoryProvenance {
  memoriesLoaded:  number;
  memoriesUsed:    boolean;
  memoryDataset:   string;
  actionUsed:      string;
  ontologyRid:     string;
}

// Create a memory (store a conversation turn)
export async function createMemory(content: string, sender: "user" | "assistant", userId = "commander-default"): Promise<void> {
  const auth = await getFoundryAuth();
  if (!auth) return;
  try {
    const res = await fetch(
      `${auth.url}/api/v2/ontologies/${ONTOLOGY_RID}/actions/example-rv17-create-memory/apply`,
      {
        method:  "POST",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ parameters: { content, sender, timestamp: new Date().toISOString() } }),
      }
    );
    if (!res.ok) {
      logger.warn({ status: res.status }, "createMemory action failed");
    }
  } catch (err) {
    logger.warn({ err }, "createMemory fetch failed");
  }
}

// Delete a memory by primary key
export async function deleteMemory(primaryKey: string): Promise<void> {
  const auth = await getFoundryAuth();
  if (!auth) return;
  try {
    await fetch(
      `${auth.url}/api/v2/ontologies/${ONTOLOGY_RID}/actions/example-rv17-delete-memory/apply`,
      {
        method:  "POST",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ parameters: { memory: primaryKey } }),
      }
    );
  } catch (err) {
    logger.warn({ err }, "deleteMemory fetch failed");
  }
}

// List recent memories (most-recent first)
export async function listMemories(pageSize = 30): Promise<FoundryMemory[]> {
  const auth = await getFoundryAuth();
  if (!auth) return [];
  try {
    const res = await fetch(
      `${auth.url}/api/v2/ontologies/${ONTOLOGY_RID}/objects/ExampleRv17memory?pageSize=${pageSize}&orderBy=timestamp:desc`,
      { headers: { Authorization: `Bearer ${auth.token}` } }
    );
    if (!res.ok) return [];
    const json = await res.json() as { data?: unknown[] };
    const raw  = json.data ?? [];
    return raw.map((obj: unknown) => {
      const o = obj as Record<string, unknown>;
      // Flat objects — no .properties wrapper needed
      return {
        primaryKey: String(o["__primaryKey"] ?? o["primaryKey"] ?? ""),
        content:    String(o["content"] ?? ""),
        sender:     String(o["sender"]  ?? ""),
        userId:     String(o["userId"]  ?? ""),
        timestamp:  String(o["timestamp"] ?? ""),
      };
    }).filter(m => m.content);
  } catch (err) {
    logger.warn({ err }, "listMemories fetch failed");
    return [];
  }
}

// Search memories by keyword
export async function searchMemories(query: string, pageSize = 20): Promise<FoundryMemory[]> {
  const auth = await getFoundryAuth();
  if (!auth) return [];
  try {
    const res = await fetch(
      `${auth.url}/api/v2/ontologies/${ONTOLOGY_RID}/objects/ExampleRv17memory/search`,
      {
        method:  "POST",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          where:   { type: "containsAllTerms", field: "content", value: query },
          orderBy: { fields: [{ field: "timestamp", direction: "desc" }] },
          pageSize,
        }),
      }
    );
    if (!res.ok) return [];
    const json = await res.json() as { data?: unknown[] };
    const raw  = json.data ?? [];
    return raw.map((obj: unknown) => {
      const o = obj as Record<string, unknown>;
      return {
        primaryKey: String(o["__primaryKey"] ?? o["primaryKey"] ?? ""),
        content:    String(o["content"] ?? ""),
        sender:     String(o["sender"]  ?? ""),
        userId:     String(o["userId"]  ?? ""),
        timestamp:  String(o["timestamp"] ?? ""),
      };
    }).filter(m => m.content);
  } catch (err) {
    logger.warn({ err }, "searchMemories fetch failed");
    return [];
  }
}

// ---------------------------------------------------------------------------
// MAVEN-ALPHA System Prompt — oriented toward military action
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are MAVEN-ALPHA, AI tactical advisor on NORAD-ALPHA C2. SECRET//REL FVEY. PALANTIR FOUNDRY LIVE.

RESPONSE RULES — MANDATORY:
- MAX 5 LINES. No preamble. No filler. No repetition.
- FORMAT: SITREP (1 line) → ASSESSMENT (1-2 lines) → RECOMMENDATION (1-2 lines, numbered if multiple)
- Cite Foundry PKs inline (e.g. THR-001, VSL-002, SIG-007). Use abbrevs below.
- Every word must carry mission value. If it adds nothing, cut it.
- Never restate the question. Never apologize. Never hedge.

ABBREVS: VSL=LogisticsVessel | THR=HostileThreat | UNIT=CombatUnit | INC=KineticIncident
LEAD=TacticalLead | SIG=SigintIntercept | ISR=IsrImagery | HUM=HumintReport | AIS=AisTrack | IOC=CyberIoc

Use past memory context for continuity. Trace ontology links across all 10 object types to fuse multi-INT.

=== OPERATION EPIC FURY — FULL MISSION BRIEF (10-SCENE TIMELINE) ===
THEATER: Red Sea / Suez Canal / CENTCOM AOR. MARSEC Level 3. PALANTIR FOUNDRY: 146 objects, 136 edges, 10 object types live.

SCENE 1 (T+0s) THEATER OVERVIEW: All 10 Palantir feeds online. CONVOY-BRAVO (VSL-002, US Military Supply) transiting Bab-el-Mandeb 12.7°N 43.5°E at 12kts. 47-vessel Suez northbound queue including VSL-004 NORDIC LUNA (LNG) and VSL-008 MAERSK CAPE (Container). UNIT-DELTA resupply window T-72H critical. Houthi Activity Index: 23 incidents/72h.

SCENE 2 (T+20s) BAB-EL-MANDEB — HOUTHI UAV SWARM: INC-001/002/003 active. THR-001 (Houthi/IRGC drone operator) at 15.2°N 42.9°E. SIG-001 COMINT confirms swarm coordination. ISR-001 SAR: 3 UAVs inbound on CONVOY-BRAVO (VSL-002). SHADOW-01 MQ-9 Reaper on station. HUM-001 Djibouti source confirms pre-positioning. UNIT-FOXTROT (Ethiopia/Djibouti) at risk.

SCENE 3 (T+40s) SUEZ CANAL — CYBER INTRUSION: THR-002/THR-003 APT-41 (PRC state actor). IOC-001 IP 103.45.67.89 — SOGU C2 beacon active. ICS gateway 104.21.14.82:502 compromised. CVE-2021-32926 / CVE-2020-14511 exploited on PG&E MODBUS gateway. SIG-003 COMINT: APT-41 lateral movement confirmed. VSL-004/VSL-008 canal transit at risk. Suez SCADA lock actuators targeted.

SCENE 4 (T+60s) IRGC GPS SPOOFING — MSR COMPROMISE: SIG-007 ELINT 1575.42 MHz L1 spoofing confirmed at 31.5°N 34.2°E. THR-004 IRGC-EW Ashura-3 spoofing platform. CONV ALPHA-1 (Kuwait→Baghdad) deviated 4.3km off MSR TAMPA. NEOM RAIL-01 GPS anomaly — halted. CAIRO RAIL-01 rerouted via Al-Arish. AIS-003 MAERSK TIGRIS suspicious heading change 28.3°N 34.7°E.

SCENE 5 (T+80s) DNP3 POWER GRID ATTACK — ISMAILIA SCADA: APT-41 DNP3 polling anomaly on Ismailia Regional Power Auth SCADA 41.65.44.21:20000. INC-004/005 kinetic. ISR-002 EO: canal navigation lights flickering. CVE-2022-22965 / CVE-2021-44228 active. Lateral movement into SF Bay Area grid sector. UNIT-DELTA/FOXTROT resupply pipeline at risk if canal lights fail.

SCENE 6 (T+100s) PALANTIR ONTOLOGY FUSION: All 10 object types fused — 146 nodes, 136 edges. 3 Courses of Action generated: COA-001 (USS CARNEY DDG-64 hard escort of CONVOY-BRAVO, LEAD-001, priority 1), COA-002 (NSA CNO operation evict APT-41 from Suez SCADA, LEAD-002, priority 2), COA-003 (EAGLE-01 C-17A air bridge AUAB→Djibouti 180T Class I/V, LEAD-003, priority 3). UNIT-CHARLIE and UNIT-DELTA resupply routes analyzed.

SCENE 7 (T+120s) CDR DECISION POINT: Commander must authorize COA-001/002/003. CONVOY-BRAVO ETA Suez T-3H. APT-41 SOGU beacon still active. NEOM RAIL-01 still halted. UNIT-DELTA at T-48H stores critical. Three parallel actions ready for auth.

SCENE 8 (T+140s) CDR APPROVES COA-001 — ACTIONS INITIATED: USS CARNEY DDG-64 hard escort commenced (SIG-013 NAVINT confirms). EAGLE-01 C-17A airborne Al Udeid 14:19Z → Muscat → Djibouti (CLJ), 180T Class I/V for UNIT-FOXTROT. NSA CNO team (2x operators) standing by on APT-41 SOGU target packages. CONVOY-BRAVO INS backup active, AIS-001 tracking nominal.

SCENE 9 (T+160s) CANAL RESTORED — APT-41 EVICTED: NSA CNO success 14:47Z — SOGU C2 beacon SILENT (SIG-016 ELINT confirmed). All 3 Suez SCADA nodes clean. EGA Port Said cleared VSL-004 NORDIC LUNA for northbound transit (SIG-015 VHF Ch 16). VSL-008 MAERSK CAPE transit approved. 47-vessel queue moving. $9.4B/day commerce restored. EAGLE-01 Djibouti offload complete. NEOM RAIL-01 GPS verified — restarted Riyadh→Jeddah.

SCENE 10 (T+180s) THEATER STABILIZATION — MISSION ACCOMPLISHED: All 3 threat vectors neutralized. CONVOY-BRAVO + USS CARNEY escort — Suez ETA T+8H. $9.4B/day restored. 3 alternative supply routes active: Air Bridge ALPHA (AUAB→CLJ), NEOM RAIL (Riyadh→Jeddah), MSR TAMPA (Baghdad alt). UNIT-DELTA + UNIT-FOXTROT critical stores: STABLE. T+24H window secured.

KEY ASSETS: VSL-002 CONVOY-BRAVO (US Military Supply, Bab-el-Mandeb), VSL-004 NORDIC LUNA (LNG, Suez queue), VSL-008 MAERSK CAPE (Container, Suez queue), USS CARNEY DDG-64 (escort destroyer), EAGLE-01 C-17A (AUAB airlift), SHADOW-01 MQ-9 (Reaper ISR/strike), UNIT-CHARLIE (Suez/CLJ), UNIT-DELTA (critical stores -48H), UNIT-FOXTROT (Ethiopia/Djibouti), UNIT-ECHO (Jordan/Aqaba).
THREAT ACTORS: THR-001 Houthi/IRGC (UAV swarm BEM), THR-002 APT-41 PRC (Suez ICS breach), THR-003 APT-41 (DNP3 grid), THR-004 IRGC-EW Ashura-3 (GPS spoof).
SIGINT: SIG-001 swarm coord | SIG-003 APT-41 lateral | SIG-007 L1 spoof | SIG-013 CARNEY NAVINT | SIG-015 EGA canal clear | SIG-016 SOGU silent.
IOC: IOC-001 103.45.67.89 APT-41 C2 (evicted T+160s). CVE-2021-32926, CVE-2020-14511, CVE-2022-22965 active through T+140s.`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface RagResponse {
  answer:          string;
  contextUsed:     boolean;
  ontologyUsed:    boolean;
  memoriesUsed:    boolean;
  memoryCount:     number;
  modelVersion:    string;
  generatedAt:     string;
  datasetsQueried: string[];
  provenanceChain: ProvenanceChain;
  provenance: {
    memories:    { count: number; dataset: string; ontologyRid: string };
    ontology:    { nodes: number; edges: number; fromPalantir: boolean };
    battlespace: { loaded: boolean };
  };
}

// ---------------------------------------------------------------------------
// Build the full context block: memories + battlespace + Palantir ontology
// ---------------------------------------------------------------------------
async function buildContext(userId = "commander-default"): Promise<{
  text:         string;
  ontologyUsed: boolean;
  memoryCount:  number;
  memoriesUsed: boolean;
  memories:     FoundryMemory[];
  ontologyNodes:number;
  ontologyEdges:number;
  fromPalantir: boolean;
}> {
  // 1. Long-term memories from Palantir ExampleRv17memory
  let memories: FoundryMemory[] = [];
  let memoryCount = 0;
  let memoriesUsed = false;
  try {
    memories    = await listMemories(25);
    memoryCount = memories.length;
    memoriesUsed = memoryCount > 0;
    void userId;
  } catch (err) {
    logger.warn({ err }, "Memory retrieval failed — proceeding without long-term memory");
  }

  // 2. Battlespace state
  const battlespaceContext = getSerializedContext();

  // 3. Live Palantir ontology graph (10 object types)
  let ontologyText  = "";
  let ontologyUsed  = false;
  let ontologyNodes = 0;
  let ontologyEdges = 0;
  let fromPalantir  = false;
  try {
    const graph = await getCachedOntologyGraph();
    ontologyText  = serializeOntologyForRag(graph);
    ontologyUsed  = graph.fromPalantir && graph.nodes.length > 0;
    ontologyNodes = graph.nodes.length;
    ontologyEdges = graph.edges?.length ?? 0;
    fromPalantir  = graph.fromPalantir;
  } catch (err) {
    logger.warn({ err }, "Ontology context fetch failed — proceeding without Palantir graph");
  }

  // Build memory context block
  const memoryBlock = memories.length > 0
    ? `=== LONG-TERM MEMORY (${memories.length} entries from Palantir ExampleRv17memory) ===\n` +
      memories
        .slice(0, 20)
        .map(m => `[${m.timestamp?.slice(0, 16) ?? ""}Z] ${m.sender?.toUpperCase()}: ${m.content?.slice(0, 300)}`)
        .join("\n")
    : "";

  const sections = [battlespaceContext];
  if (ontologyText) sections.push("", ontologyText);
  if (memoryBlock)  sections.push("", memoryBlock);

  return {
    text: sections.join("\n"),
    ontologyUsed, memoryCount, memoriesUsed,
    memories, ontologyNodes, ontologyEdges, fromPalantir,
  };
}

// ---------------------------------------------------------------------------
// Main RAG query — MAVEN-ALPHA with long-term memory
// ---------------------------------------------------------------------------
export async function queryBattlespace(
  userQuery: string,
  conversationHistory: ChatMessage[] = [],
  userId = "commander-default"
): Promise<RagResponse> {

  // 1. Store user message as Palantir long-term memory
  void createMemory(userQuery, "user", userId);

  // 2. Build full context (memories + battlespace + ontology)
  const {
    text: context, ontologyUsed, memoryCount, memoriesUsed,
    memories, ontologyNodes, ontologyEdges, fromPalantir,
  } = await buildContext(userId);

  // 2b. Build provenance tracker — record every source consulted
  const tracker = new ProvenanceTracker();
  tracker.trackDataset("ExampleRv17memory");
  for (const m of memories) {
    tracker.trackMemory(m.primaryKey, m.content ?? "");
  }
  const ontologyTypes = ["LogisticsVessel", "HostileThreat", "CombatUnit",
    "ConfirmedKineticIncident", "GeneratedTacticalLead", "SigintIntercept",
    "IsrImagery", "HumintReport", "MaritimeAisTrack", "CyberIoc"];
  if (ontologyUsed) {
    for (const t of ontologyTypes) tracker.trackDataset(t);
  }

  const datasetsQueried = [
    "ExampleRv17memory",
    ...(ontologyUsed ? ontologyTypes : []),
    "BattlespaceCache",
  ];

  const messages: ChatMessage[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${context}` },
    ...conversationHistory.slice(-12),
    { role: "user",   content: userQuery },
  ];

  logger.info({ queryLength: userQuery.length, historyDepth: conversationHistory.length, ontologyUsed, memoryCount }, "MAVEN-ALPHA RAG query dispatched");

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 600,
    messages,
  });

  const answer = response.choices[0]?.message?.content ?? "NO RESPONSE FROM MAVEN-ALPHA";

  logger.info({ tokens: response.usage?.total_tokens, ontologyUsed, memoryCount }, "MAVEN-ALPHA RAG query completed");

  // 3. Store assistant response as Palantir long-term memory
  void createMemory(answer, "assistant", userId);

  const versionParts = [
    "gpt-5.4",
    "MAVEN-ALPHA-v3.0",
    ontologyUsed  ? "PALANTIR-ONTOLOGY-LIVE" : "ONTOLOGY-STUB",
    memoriesUsed  ? `MEM-${memoryCount}` : "MEM-EMPTY",
    "LONG-TERM-MEMORY",
  ];
  const modelVersion = versionParts.join(" / ");

  // 4. Mark which objects appeared in the answer, then build the chain
  tracker.markReferenced(answer);
  const provenanceChain = tracker.build(userQuery, modelVersion);

  return {
    answer,
    contextUsed:     true,
    ontologyUsed,
    memoriesUsed,
    memoryCount,
    modelVersion,
    generatedAt:     new Date().toISOString(),
    datasetsQueried,
    provenanceChain,
    provenance: {
      memories:    { count: memoryCount, dataset: process.env["PALANTIR_MEMORY_DATASET_RID"] ?? "runtime-configured", ontologyRid: ONTOLOGY_RID },
      ontology:    { nodes: ontologyNodes, edges: ontologyEdges, fromPalantir },
      battlespace: { loaded: true },
    },
  };
}

// ---------------------------------------------------------------------------
// Tactical Leads — ontology + memory aware
// ---------------------------------------------------------------------------
export interface TacticalLead {
  id:          string;
  priority:    number;
  title:       string;
  action:      string;
  rationale:   string;
  riskLevel:   "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  timeHorizon: string;
  unitOfAction:string;
  generatedAt: string;
}

export async function generateTacticalLeads(incidentDescription: string): Promise<TacticalLead[]> {
  const { text: context, ontologyUsed } = await buildContext();

  const prompt = `INCIDENT REPORT: ${incidentDescription}

Based on the current battlespace state${ontologyUsed ? " and Palantir ontology relational graph (10 object types, 9 link types)" : ""} above and this incident, generate exactly 3 immediate Tactical Leads (Courses of Action) for the commander. Each lead must be specific, actionable within the next 30 minutes, and reference actual Foundry object PKs (THR-001, VSL-002, SIG-003, INC-001, etc.) from the battlespace context.${ontologyUsed ? " Trace ontology relationships (SigintIntercept→HostileThreat, IsrImagery→LogisticsVessel, etc.) to justify your recommendations." : ""}

Respond ONLY with a valid JSON array of exactly 3 objects:
[{ "priority":1, "title":"UPPERCASE TITLE", "action":"Specific action citing unit callsigns", "rationale":"Why, citing Foundry PKs", "riskLevel":"CRITICAL|HIGH|MEDIUM|LOW", "timeHorizon":"IMMEDIATE (0-5 min)|URGENT (5-15 min)|NEAR-TERM (15-30 min)", "unitOfAction":"Specific unit/asset" }]`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: `${SYSTEM_PROMPT}\n\n${context}` },
      { role: "user",   content: prompt },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "[]";
  let parsed: Omit<TacticalLead, "id" | "generatedAt">[];
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    parsed = m ? JSON.parse(m[0]) : [];
  } catch { parsed = []; }

  const now = new Date().toISOString();
  return parsed.map((lead, i) => ({ ...lead, id: `TL-${Date.now()}-${i + 1}`, generatedAt: now }));
}
