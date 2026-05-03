import { Router } from "express";

const router = Router();

router.get("/config", (req, res) => {
  const palantirUrl = process.env["PALANTIR_URL"] ?? "https://nshackathon.palantirfoundry.com";
  const ontologyRid = process.env["PALANTIR_ONTOLOGY_RID"] ?? "runtime-configured";
  res.json({
    palantirUrl,
    foundryBase: `${palantirUrl}/workspace/ontology/objects`,
    ontologyRid,
  });
});

export default router;
