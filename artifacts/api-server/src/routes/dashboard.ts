import { Router } from "express";

const router = Router();

router.get("/dashboard/summary", (_req, res) => {
  res.json({
    activeTracksCount: 8,
    friendlyCount: 3,
    hostileCount: 2,
    unknownCount: 2,
    threatCount: 7,
    criticalThreatsCount: 3,
    intelItemsCount: 6,
    systemStatus: "nominal",
    lastUpdated: new Date().toISOString(),
  });
});

export default router;
