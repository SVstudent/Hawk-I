import { Router } from "express";
import { addKineticEvent } from "../core/battlespace-cache";
import {
  queryBattlespace, generateTacticalLeads,
  listMemories, deleteMemory, searchMemories,
  type TacticalLead, type ChatMessage,
} from "../core/rag-engine";
import { enqueue } from "../core/palantir-flush";
import { invalidateOntologyCache } from "../core/palantir-read";
import { logger } from "../lib/logger";

const router = Router();

// In-memory conversation history per session (keyed by sessionId)
const sessions = new Map<string, ChatMessage[]>();

let latestTacticalLeads: TacticalLead[] = [];
let lastEmergencyAt: string | null = null;
let emergencyCount = 0;

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
