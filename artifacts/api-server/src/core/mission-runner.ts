// ---------------------------------------------------------------------------
// Project Hawk-I — Epic Fury Mission Runner
// Singleton state machine that plays through the mission manifest tick by tick.
// Other routes call the getter functions to merge mission data into responses.
// ---------------------------------------------------------------------------
import { logger } from "../lib/logger";
import { MISSION_MANIFEST, MISSION_PHASES, type MissionEvent, type MissionPhase } from "./mission-manifest";

const TICK_INTERVAL_MS = 5_000;
const MAX_TICK = 11;

interface RunnerState {
  running:         boolean;
  startedAt:       Date | null;
  currentTick:     number;
  timer:           ReturnType<typeof setInterval> | null;
  processed:       MissionEvent[];
}

const state: RunnerState = {
  running:     false,
  startedAt:   null,
  currentTick: -1,
  timer:       null,
  processed:   [],
};

function getPhaseForTick(tick: number): MissionPhase {
  for (const p of MISSION_PHASES) {
    if (tick >= p.startTick && tick <= p.endTick) return p;
  }
  return MISSION_PHASES[MISSION_PHASES.length - 1];
}

function advanceTick() {
  if (state.currentTick >= MAX_TICK) {
    stopMission();
    return;
  }
  state.currentTick++;
  const events = MISSION_MANIFEST.filter(e => e.tick === state.currentTick);
  state.processed.push(...events);
  if (events.length > 0) {
    logger.info({ tick: state.currentTick, events: events.length }, "Mission tick fired");
  }
}

// ---------------------------------------------------------------------------
// Control
// ---------------------------------------------------------------------------

export function startMission() {
  if (state.running) return getMissionStatus();
  state.running     = true;
  state.startedAt   = new Date();
  state.currentTick = -1;
  state.processed   = [];
  advanceTick(); // fire tick 0 immediately
  state.timer = setInterval(advanceTick, TICK_INTERVAL_MS);
  logger.info("Mission Epic Fury started");
  return getMissionStatus();
}

export function stopMission() {
  if (state.timer) { clearInterval(state.timer); state.timer = null; }
  state.running = false;
  logger.info({ tick: state.currentTick }, "Mission stopped");
  return getMissionStatus();
}

export function resetMission() {
  stopMission();
  state.currentTick = -1;
  state.processed   = [];
  state.startedAt   = null;
  logger.info("Mission reset");
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function getMissionStatus() {
  const tick  = Math.max(0, state.currentTick);
  const phase = getPhaseForTick(tick);
  const elapsed = state.startedAt
    ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000)
    : 0;
  const progress = Math.min(1, (state.currentTick + 1) / (MAX_TICK + 1));

  return {
    running:          state.running,
    startedAt:        state.startedAt?.toISOString() ?? null,
    currentTick:      state.currentTick,
    maxTick:          MAX_TICK,
    currentPhase:     phase.id,
    currentPhaseLabel:phase.label,
    phaseDescription: phase.description,
    phaseColor:       phase.color,
    elapsedSeconds:   elapsed,
    progress,
    complete:         state.currentTick >= MAX_TICK && !state.running,
    phases:           MISSION_PHASES,
  };
}

// ---------------------------------------------------------------------------
// Accessors for other routes
// ---------------------------------------------------------------------------

export function getMissionIntelItems(): Record<string, unknown>[] {
  return state.processed.filter(e => e.type === "intel").map(e => e.data);
}

export function getMissionThreats(): Record<string, unknown>[] {
  return state.processed.filter(e => e.type === "threat").map(e => e.data);
}

export function getMissionKineticEvents(): Record<string, unknown>[] {
  return state.processed.filter(e => e.type === "kinetic").map(e => e.data);
}

export function getMissionCoaItems(): Record<string, unknown>[] {
  return state.processed.filter(e => e.type === "coa").map(e => e.data);
}

export function getMissionTrackUpdates(): Map<string, Record<string, unknown>> {
  const updates = new Map<string, Record<string, unknown>>();
  for (const e of state.processed) {
    if (e.type === "track_update" && typeof e.data["id"] === "string") {
      const existing = updates.get(e.data["id"] as string) ?? {};
      updates.set(e.data["id"] as string, { ...existing, ...e.data });
    }
  }
  return updates;
}

export function isMissionRunning(): boolean {
  return state.running;
}
