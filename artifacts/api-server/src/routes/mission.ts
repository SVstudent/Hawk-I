import { Router } from "express";
import {
  startMission,
  stopMission,
  resetMission,
  getMissionStatus,
  getMissionKineticEvents,
} from "../core/mission-runner";

const router = Router();

router.get("/mission/status", (_req, res) => {
  res.json(getMissionStatus());
});

router.post("/mission/start", (_req, res) => {
  const status = startMission();
  res.json({ ok: true, ...status });
});

router.post("/mission/stop", (_req, res) => {
  const status = stopMission();
  res.json({ ok: true, ...status });
});

router.post("/mission/reset", (_req, res) => {
  resetMission();
  res.json({ ok: true, message: "Mission reset to standby" });
});

router.get("/mission/kinetic_events", (_req, res) => {
  res.json(getMissionKineticEvents());
});

export default router;
