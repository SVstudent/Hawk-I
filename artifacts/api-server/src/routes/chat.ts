import { Router } from "express";
import { addKineticEvent } from "../core/battlespace-cache";
import {
  queryBattlespace, generateTacticalLeads,
  listMemories, deleteMemory, searchMemories,
  type TacticalLead, type ChatMessage,
} from "../core/rag-engine";
import {
  fetchAISPositions,
  fetchLogisticsVessels,
  updateAISTrackPosition,
  updateVesselPosition,
  type VesselPosition,
} from "../core/foundry-live";
import { enqueue } from "../core/palantir-flush";
import { invalidateOntologyCache } from "../core/palantir-read";
import { logger } from "../lib/logger";

const router = Router();

// In-memory conversation history per session (keyed by sessionId)
const sessions = new Map<string, ChatMessage[]>();

let latestTacticalLeads: TacticalLead[] = [];
let lastEmergencyAt: string | null = null;
let emergencyCount = 0;

interface ParsedMoveIntent {
  targetKind: "logistics" | "ais" | "either";
  targetLabel: string;
  lat: number;
  lon: number;
}

function isWaypointActionQuery(query: string): boolean {
  return /\b(move|reposition|relocate|shift|set|update|change)\b/i.test(query)
    && /\b(vessel|ship|ais|track|waypoint|route|course)\b/i.test(query);
}

function parseMoveIntent(query: string): ParsedMoveIntent | null {
  const normalized = query.trim().replace(/\s+/g, " ");
  if (!isWaypointActionQuery(normalized)) return null;

  const coordMatch = normalized.match(/(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!coordMatch) return null;

  const lat = Number(coordMatch[1]);
  const lon = Number(coordMatch[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const targetMatch = normalized.match(
    /\b(?:move|reposition|relocate|shift|set|update|change)\s+(?:(logistics vessel|vessel|ship|ais track|track)\s+)?(.+?)\s+(?:to|at|toward|onto)\s+-?\d{1,2}(?:\.\d+)?\s*[, ]\s*-?\d{1,3}(?:\.\d+)?/i,
  );
  if (!targetMatch) return null;

  const targetType = (targetMatch[1] ?? "").toLowerCase();
  const targetLabel = targetMatch[2]?.trim().replace(/^["']|["']$/g, "");
  if (!targetLabel) return null;

  const targetKind =
    targetType.includes("logistics") ? "logistics" :
    targetType.includes("ais") ? "ais" :
    "either";

  return { targetKind, targetLabel, lat, lon };
}

function scoreVesselMatch(vessel: VesselPosition, query: string): number {
  const q = query.toLowerCase();
  const id = vessel.id.toLowerCase();
  const name = vessel.vesselName.toLowerCase();
  if (id === q || name === q) return 100;
  if (name.includes(q) || q.includes(name)) return 80;
  if (id.includes(q) || q.includes(id)) return 70;
  return 0;
}

async function resolveMoveTarget(intent: ParsedMoveIntent): Promise<{
  match: VesselPosition | null;
  kind: "logistics" | "ais" | null;
  ambiguous: VesselPosition[];
}> {
  const [ais, logistics] = await Promise.all([fetchAISPositions(), fetchLogisticsVessels()]);
  const pools = intent.targetKind === "logistics"
    ? [{ kind: "logistics" as const, items: logistics }]
    : intent.targetKind === "ais"
      ? [{ kind: "ais" as const, items: ais }]
      : [{ kind: "logistics" as const, items: logistics }, { kind: "ais" as const, items: ais }];

  const scored = pools.flatMap(({ kind, items }) =>
    items
      .map((item) => ({ item, kind, score: scoreVesselMatch(item, intent.targetLabel) }))
      .filter((entry) => entry.score > 0),
  ).sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { match: null, kind: null, ambiguous: [] };
  const top = scored[0];
  const ambiguous = scored.filter((entry) => entry.score === top.score).map((entry) => entry.item);
  if (ambiguous.length > 1) return { match: null, kind: null, ambiguous };
  return { match: top.item, kind: top.kind, ambiguous: [] };
}

// ---------------------------------------------------------------------------
// POST /chat — MAVEN-ALPHA RAG with long-term Palantir memory
// ---------------------------------------------------------------------------
router.post("/chat", async (req, res) => {
  const { query, sessionId = "default" } = req.body as { query?: string; sessionId?: string };

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  const history = sessions.get(sessionId) ?? [];

  try {
    if (isWaypointActionQuery(query.trim()) && !parseMoveIntent(query.trim())) {
      res.json({
        answer:
          `## Action Ready\n` +
          `I do have access to update **Foundry vessel and AIS object positions in this app**.\n\n` +
          `## What I Need\n` +
          `Provide the exact asset and destination coordinates.\n\n` +
          `Examples:\n` +
          `- \`move vessel QATAR KING to 26.35, 56.40\`\n` +
          `- \`reposition AIS track VSL-004 to 25.90, 56.80\`\n` +
          `- \`update logistics vessel CONVOY-BRAVO to 12.78, 43.82\`\n\n` +
          `## Note\n` +
          `This changes the **Foundry object state used by the dashboard**, not a real-world helm/autopilot system.`,
        contextUsed: false,
        ontologyUsed: true,
        memoriesUsed: false,
        memoryCount: 0,
        modelVersion: "HAWK-I / ACTION-GUIDANCE",
        generatedAt: new Date().toISOString(),
        datasetsQueried: ["LiveAisSnapshot", "LiveLogisticsSnapshot"],
      });
      return;
    }

    const moveIntent = parseMoveIntent(query.trim());
    if (moveIntent) {
      const { match, kind, ambiguous } = await resolveMoveTarget(moveIntent);

      if (ambiguous.length > 0) {
        res.json({
          answer: `I found multiple vessel matches for "${moveIntent.targetLabel}": ${ambiguous.slice(0, 5).map((v) => `${v.vesselName || v.id} [${v.id}]`).join(", ")}. Please specify the exact vessel id or exact vessel name, then I can move it.`,
          contextUsed: false,
          ontologyUsed: true,
          memoriesUsed: false,
          memoryCount: 0,
          modelVersion: "HAWK-I / ACTION-RESOLUTION",
          generatedAt: new Date().toISOString(),
          datasetsQueried: ["LiveAisSnapshot", "LiveLogisticsSnapshot"],
        });
        return;
      }

      if (!match || !kind) {
        res.json({
          answer: `I couldn't find a vessel matching "${moveIntent.targetLabel}". Try the exact vessel id or exact vessel name, then include the destination coordinates like "move vessel QATAR KING to 26.35, 56.40".`,
          contextUsed: false,
          ontologyUsed: true,
          memoriesUsed: false,
          memoryCount: 0,
          modelVersion: "HAWK-I / ACTION-RESOLUTION",
          generatedAt: new Date().toISOString(),
          datasetsQueried: ["LiveAisSnapshot", "LiveLogisticsSnapshot"],
        });
        return;
      }

      if (kind === "logistics") {
        await updateVesselPosition(match.id, moveIntent.lat, moveIntent.lon);
      } else {
        await updateAISTrackPosition(match.id, moveIntent.lat, moveIntent.lon);
      }

      const answer =
        `## Action Complete\n` +
        `${kind === "logistics" ? "Logistics vessel" : "AIS track"} **${match.vesselName || match.id}** was moved to ` +
        `**${moveIntent.lat.toFixed(4)}, ${moveIntent.lon.toFixed(4)}**.\n\n` +
        `## Updated Object\n` +
        `- ID: \`${match.id}\`\n` +
        `- Previous position: ${match.lat.toFixed(4)}, ${match.lon.toFixed(4)}\n` +
        `- New position: ${moveIntent.lat.toFixed(4)}, ${moveIntent.lon.toFixed(4)}\n` +
        `- Route type: ${kind === "logistics" ? "LogisticsVessel action" : "MaritimeAisTrack action"}`;

      const updatedHistory: ChatMessage[] = [
        ...history,
        { role: "user", content: query.trim() },
        { role: "assistant", content: answer },
      ];
      sessions.set(sessionId, updatedHistory.slice(-20));

      res.json({
        answer,
        contextUsed: true,
        ontologyUsed: true,
        memoriesUsed: false,
        memoryCount: 0,
        modelVersion: "HAWK-I / ACTION-EXECUTION",
        generatedAt: new Date().toISOString(),
        datasetsQueried: [kind === "logistics" ? "LogisticsVessel" : "MaritimeAisTrack"],
      });
      return;
    }

    const result = await queryBattlespace(query.trim(), history, sessionId);

    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: "user",      content: query.trim()    },
      { role: "assistant", content: result.answer    },
    ];
    sessions.set(sessionId, updatedHistory.slice(-20));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "MAVEN-ALPHA RAG query failed");
    res.status(500).json({ error: "RAG engine error" });
  }
});

// ---------------------------------------------------------------------------
// GET /memory — List all stored conversation memories from Palantir
// ---------------------------------------------------------------------------
router.get("/memory", async (req, res) => {
  try {
    const pageSize = Math.min(parseInt(String(req.query["limit"] ?? "50")), 200);
    const memories = await listMemories(pageSize);
    res.json({ data: memories, count: memories.length, source: "ExampleRv17memory" });
  } catch (err) {
    req.log.error({ err }, "Memory list failed");
    res.status(500).json({ error: "Memory retrieval failed" });
  }
});

// ---------------------------------------------------------------------------
// GET /memory/search?q=... — Semantic keyword search over memories
// ---------------------------------------------------------------------------
router.get("/memory/search", async (req, res) => {
  const q = req.query["q"] as string | undefined;
  if (!q) { res.status(400).json({ error: "Missing ?q= parameter" }); return; }
  try {
    const results = await searchMemories(q, 20);
    res.json({ data: results, count: results.length, query: q });
  } catch (err) {
    req.log.error({ err }, "Memory search failed");
    res.status(500).json({ error: "Memory search failed" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /memory/:primaryKey — Delete a specific memory
// ---------------------------------------------------------------------------
router.delete("/memory/:primaryKey", async (req, res) => {
  try {
    await deleteMemory(req.params["primaryKey"] ?? "");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Memory delete failed");
    res.status(500).json({ error: "Memory delete failed" });
  }
});

// ---------------------------------------------------------------------------
// POST /memory/clear — Bulk delete all memories
// ---------------------------------------------------------------------------
router.post("/memory/clear", async (req, res) => {
  try {
    const memories = await listMemories(200);
    await Promise.all(memories.map(m => deleteMemory(m.primaryKey)));
    res.json({ deleted: memories.length });
  } catch (err) {
    req.log.error({ err }, "Memory clear failed");
    res.status(500).json({ error: "Memory clear failed" });
  }
});

// ---------------------------------------------------------------------------
// POST /trigger_emergency — Kinetic Strike Event + Generate Tactical Leads
// ---------------------------------------------------------------------------
router.post("/trigger_emergency", async (req, res) => {
  const { description, location, lat, lng } = req.body as {
    description?: string; location?: string; lat?: number; lng?: number;
  };

  emergencyCount += 1;
  const eventId = `KE-${Date.now()}`;
  const now = new Date().toISOString();
  const eventDescription = description ?? "Kinetic strike detected. Hostile engagement in progress. All units stand by for tactical leads.";
  const eventLocation    = location ?? "Unknown AOR";

  const kineticEvent = {
    id: eventId, type: "kinetic_strike" as const,
    location: eventLocation, lat, lng,
    description: eventDescription, timestamp: now, reportedBy: "NORAD-ALPHA AUTO-DETECT",
  };
  addKineticEvent(kineticEvent);
  enqueue("kineticEvents", {
    incidentId: eventId, targetId: location ?? "", description: eventDescription,
    timestamp: now, _syncedAt: now,
  });

  logger.info({ eventId, location: eventLocation }, "Emergency triggered — generating tactical leads");

  try {
    const leads = await generateTacticalLeads(eventDescription);
    latestTacticalLeads = leads;
    lastEmergencyAt = now;

    for (const lead of leads) {
      enqueue("tacticalLeads", {
        leadId: lead.id, incidentId: eventId,
        coaText: `${lead.title} | ${lead.action} | RATIONALE: ${lead.rationale}`,
        timestamp: lead.generatedAt, _syncedAt: now,
      });
    }
    invalidateOntologyCache();

    res.json({ eventId, status: "EMERGENCY_ACTIVE", incidentDescription: eventDescription, location: eventLocation, tacticalLeads: leads, triggeredAt: now, emergencyCount });
  } catch (err) {
    req.log.error({ err }, "Tactical lead generation failed");
    res.status(500).json({ eventId, status: "EMERGENCY_ACTIVE_AI_DEGRADED", incidentDescription: eventDescription, tacticalLeads: [], error: "AI lead generation failed — manual COA required" });
  }
});

// ---------------------------------------------------------------------------
// GET /tactical_leads
// ---------------------------------------------------------------------------
router.get("/tactical_leads", (_req, res) => {
  res.json({ leads: latestTacticalLeads, lastEmergencyAt, emergencyCount, hasActiveEmergency: emergencyCount > 0 && latestTacticalLeads.length > 0 });
});

// ---------------------------------------------------------------------------
// DELETE /chat/history — Clear session history
// ---------------------------------------------------------------------------
router.delete("/chat/history", (req, res) => {
  const { sessionId = "default" } = req.body as { sessionId?: string };
  sessions.delete(sessionId);
  res.json({ cleared: true, sessionId });
});

export default router;
