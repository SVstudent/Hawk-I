import { Router } from "express";
import {
  fetchAISPositions,
  fetchLogisticsVessels,
  updateAISTrackPosition,
  updateVesselPosition,
} from "../core/foundry-live";

const router = Router();

router.get("/vessels", async (_req, res) => {
  try {
    const vessels = await fetchAISPositions();
    res.json({ vessels, count: vessels.length, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/logistics-vessels", async (_req, res) => {
  try {
    const vessels = await fetchLogisticsVessels();
    res.json({ vessels, count: vessels.length, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/vessels/:id/position", async (req, res) => {
  const id = req.params["id"];
  const lat = Number(req.body?.["lat"]);
  const lon = Number(req.body?.["lon"]);

  if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ error: "Valid vessel id, lat, and lon are required." });
    return;
  }

  try {
    await updateVesselPosition(id, lat, lon);
    res.json({ success: true, vesselId: id, lat, lon });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/ais-tracks/:id/position", async (req, res) => {
  const id = req.params["id"];
  const lat = Number(req.body?.["lat"]);
  const lon = Number(req.body?.["lon"]);

  if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ error: "Valid AIS track id, lat, and lon are required." });
    return;
  }

  try {
    await updateAISTrackPosition(id, lat, lon);
    res.json({ success: true, trackId: id, lat, lon });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
