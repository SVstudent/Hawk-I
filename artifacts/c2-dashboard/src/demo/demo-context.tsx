// DemoProvider only — keeps Fast Refresh happy (only exports a React component)
import {
  useReducer, useCallback, useRef, useEffect,
  type ReactNode,
} from "react";
import { DemoContext } from "./demo-context-obj";
import {
  DEMO_SCENES, TOTAL_DEMO_MS,
  type DemoScene, type DemoIntelItem, type DemoCyberThreat,
  type DemoTrackUpdate, type DemoCoaItem, type DemoOntologyEdge,
  type DemoSigintItem, type DemoIsrItem, type DemoHumintItem,
  type DemoAisItem, type DemoIocItem, type DemoFoundryProvenance,
  type FeedTarget,
} from "./demo-scenes";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------
export interface DemoState {
  running:       boolean;
  paused:        boolean;
  complete:      boolean;
  startedAt:     number | null;
  elapsedMs:     number;
  currentScene:  number;
  autoTab:       FeedTarget | null;
  mapTarget:     DemoScene["map"] | null;
  narration:     string;
  sceneLabel:    string;
  location:      string;
  progress:      number;
  intelItems:    DemoIntelItem[];
  cyberThreats:  DemoCyberThreat[];
  trackUpdates:  DemoTrackUpdate[];
  coaItems:      DemoCoaItem[];
  ontologyEdges: DemoOntologyEdge[];
  newEdgeIds:    Set<string>;
  // New intel feeds
  sigintItems:   DemoSigintItem[];
  isrItems:      DemoIsrItem[];
  humintItems:   DemoHumintItem[];
  aisItems:      DemoAisItem[];
  iocItems:      DemoIocItem[];
  // Foundry provenance for BLACKBOX
  provenance:    DemoFoundryProvenance | null;
}

export interface DemoContextValue {
  demoState:  DemoState;
  startDemo:  () => void;
  stopDemo:   () => void;
  resetDemo:  () => void;
  pauseDemo:  () => void;
  resumeDemo: () => void;
}

const INITIAL_STATE: DemoState = {
  running: false, paused: false, complete: false, startedAt: null,
  elapsedMs: 0, currentScene: 0, autoTab: null, mapTarget: null,
  narration: "", sceneLabel: "", location: "", progress: 0,
  intelItems: [], cyberThreats: [], trackUpdates: [],
  coaItems: [], ontologyEdges: [], newEdgeIds: new Set(),
  sigintItems: [], isrItems: [], humintItems: [], aisItems: [], iocItems: [],
  provenance: null,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
type Action =
  | { type: "START" }
  | { type: "STOP" }
  | { type: "RESET" }
  | { type: "PAUSE" }
  | { type: "RESUME"; now: number }
  | { type: "TICK"; now: number };

function mergeTrackUpdates(incoming: DemoTrackUpdate[]): DemoTrackUpdate[] {
  const map = new Map<string, DemoTrackUpdate>();
  for (const t of incoming) map.set(t.id, { ...map.get(t.id), ...t });
  return Array.from(map.values());
}

function mergeById<T, K extends keyof T>(items: T[], idKey: K): T[] {
  const map = new Map<string, T>();
  for (const item of items) map.set(String(item[idKey] ?? ''), item);
  return Array.from(map.values());
}

function newEdgeSet(edges: DemoOntologyEdge[]): Set<string> {
  return new Set(edges.filter(e => e.isNew).map(e => e.id));
}

function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case "START":
      return { ...INITIAL_STATE, running: true, startedAt: Date.now() };
    case "STOP":
      return { ...state, running: false, paused: false };
    case "RESET":
      return { ...INITIAL_STATE };
    case "PAUSE":
      if (!state.running) return state;
      return { ...state, running: false, paused: true };
    case "RESUME":
      if (!state.paused) return state;
      // Shift startedAt forward so elapsed continues from where we paused
      return { ...state, running: true, paused: false, startedAt: action.now - state.elapsedMs };
    case "TICK": {
      if (!state.running || state.paused || !state.startedAt) return state;
      const elapsed = action.now - state.startedAt;
      if (elapsed > TOTAL_DEMO_MS + 2000) {
        return { ...state, running: false, complete: true, elapsedMs: TOTAL_DEMO_MS, progress: 1 };
      }
      let currentSceneId = 0;
      for (const scene of DEMO_SCENES) {
        if (elapsed >= scene.startMs) currentSceneId = scene.id;
      }
      if (currentSceneId === state.currentScene) {
        return { ...state, elapsedMs: elapsed, progress: Math.min(1, elapsed / TOTAL_DEMO_MS) };
      }
      const activated = DEMO_SCENES.filter(s => s.id <= currentSceneId);
      const latest    = DEMO_SCENES.find(s => s.id === currentSceneId)!;
      return {
        ...state,
        running:       true,
        elapsedMs:     elapsed,
        progress:      Math.min(1, elapsed / TOTAL_DEMO_MS),
        currentScene:  currentSceneId,
        autoTab:       latest.autoTab,
        mapTarget:     latest.map,
        narration:     latest.narration,
        sceneLabel:    latest.label,
        location:      latest.location,
        intelItems:    activated.flatMap(s => s.intelItems   ?? []),
        cyberThreats:  activated.flatMap(s => s.cyberThreats ?? []),
        trackUpdates:  mergeTrackUpdates(activated.flatMap(s => s.trackUpdates ?? [])),
        coaItems:      activated.flatMap(s => s.coaItems     ?? []),
        ontologyEdges: latest.ontologyEdges,
        newEdgeIds:    newEdgeSet(latest.ontologyEdges),
        // Accumulate intel feeds (dedupe by PK)
        sigintItems:   mergeById(activated.flatMap(s => s.sigintItems ?? []), "interceptId"),
        isrItems:      mergeById(activated.flatMap(s => s.isrItems    ?? []), "imageId"),
        humintItems:   mergeById(activated.flatMap(s => s.humintItems ?? []), "reportId"),
        aisItems:      mergeById(activated.flatMap(s => s.aisItems    ?? []), "aisId"),
        iocItems:      mergeById(activated.flatMap(s => s.iocItems    ?? []), "iocId"),
        // Use the latest scene's provenance (or previous if latest has none)
        provenance:    latest.provenance ?? state.provenance,
      };
    }
    default: return state;
  }
}

// ---------------------------------------------------------------------------
// Provider component
// ---------------------------------------------------------------------------
export function DemoProvider({ children }: { children: ReactNode }) {
  const [demoState, dispatch] = useReducer(reducer, INITIAL_STATE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startDemo = useCallback(() => {
    dispatch({ type: "START" });
    intervalRef.current = setInterval(() => dispatch({ type: "TICK", now: Date.now() }), 250);
    fetch("/api/mission/start",  { method: "POST" }).catch(() => {});
    fetch("/api/pipeline/start", { method: "POST" }).catch(() => {});
  }, []);

  const stopDemo = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    dispatch({ type: "STOP" });
    fetch("/api/mission/stop", { method: "POST" }).catch(() => {});
  }, []);

  const resetDemo = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    dispatch({ type: "RESET" });
    fetch("/api/mission/reset", { method: "POST" }).catch(() => {});
  }, []);

  const pauseDemo = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    dispatch({ type: "PAUSE" });
  }, []);

  const resumeDemo = useCallback(() => {
    const now = Date.now();
    dispatch({ type: "RESUME", now });
    intervalRef.current = setInterval(() => dispatch({ type: "TICK", now: Date.now() }), 250);
  }, []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <DemoContext.Provider value={{ demoState, startDemo, stopDemo, resetDemo, pauseDemo, resumeDemo }}>
      {children}
    </DemoContext.Provider>
  );
}
