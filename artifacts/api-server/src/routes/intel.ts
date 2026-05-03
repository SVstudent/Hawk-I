import { Router } from "express";
import { logger } from "../lib/logger";
import { getMissionIntelItems, getMissionStatus } from "../core/mission-runner";

const router = Router();

// Primary Exa query — Middle East / Red Sea focus for Epic Fury
const INTEL_QUERIES = [
  "Red Sea maritime security alerts May 2026 Houthi shipping attacks",
  "Suez Canal logistics military bottleneck 2026 Operation Epic Fury",
];

const FALLBACK_INTEL = [
  {
    id: "i1", title: "Suez Canal Northbound Traffic Backed Up 47 Vessels — Military Logistics Impact",
    url: "https://www.maritime-executive.com",
    source: "MARITIME_EXEC",
    summary: "Suez Canal northbound transit queue has reached 47 vessels including allied logistics ships. Egyptian Canal Authority citing mechanical issues at lock controls. CENTCOM logistics planners flagging 72-hour delay risk to active operational resupply chains.",
    publishedDate: new Date(Date.now() - 1800000).toISOString(),
    score: 0.98, category: "threat",
  },
  {
    id: "i2", title: "Red Sea MARSEC Level 3: Houthi Drone Swarm Intercepts at Bab-el-Mandeb",
    url: "https://www.centcom.mil",
    source: "CENTCOM",
    summary: "MARSEC Level 3 declared for Red Sea transit corridor. USS Carney (DDG-64) intercepted 3 of 14 Houthi UAVs in most recent engagement. Maritime insurance premiums surging 340%. Commercial vessels requesting naval escort.",
    publishedDate: new Date(Date.now() - 3600000).toISOString(),
    score: 0.97, category: "kinetic",
  },
  {
    id: "i3", title: "APT-41 Infrastructure Campaign Targets Egyptian ICS/SCADA Systems",
    url: "https://www.cisa.gov",
    source: "CISA",
    summary: "Confirmed APT-41 (CN) campaign exploiting CVE-2021-32926 on Modbus ICS gateways across Egyptian maritime infrastructure. Suez Canal Authority SCADA systems are within the assessed target set. RCE capability confirmed on at least 3 gateway devices.",
    publishedDate: new Date(Date.now() - 5400000).toISOString(),
    score: 0.96, category: "cyber",
  },
  {
    id: "i4", title: "CENTCOM Activates Emergency Logistics Routing — Cape of Good Hope Alternative",
    url: "https://www.defense.gov",
    source: "DoD_PRESS",
    summary: "CENTCOM activated emergency logistics routing protocols in response to simultaneous Suez Canal congestion and Red Sea threat escalation. Cape of Good Hope alternative route adds 14-day delay. USAF strategic airlift being assessed as bridge solution.",
    publishedDate: new Date(Date.now() - 7200000).toISOString(),
    score: 0.95, category: "geopolitical",
  },
  {
    id: "i5", title: "GPS Spoofing Incidents Increasing in Red Sea — IRGC Signature Detected",
    url: "https://www.marinetraffic.com",
    source: "MARINETRAFFIC",
    summary: "Multiple GPS spoofing incidents in Red Sea attributed to IRGC electronic warfare assets. Three commercial vessels reported 4-10nm navigation deviations. One vessel grounded near Yemeni coast. Allied naval vessels have shifted to INS/dead-reckoning backup.",
    publishedDate: new Date(Date.now() - 9000000).toISOString(),
    score: 0.93, category: "cyber",
  },
  {
    id: "i6", title: "NATO IFC: Coordinated Campaign Against Epic Fury Supply Chain Confirmed",
    url: "https://www.nato.int",
    source: "NATO_IFC",
    summary: "NATO Intelligence Fusion Centre confirms coordinated multi-vector campaign targeting Operation Epic Fury supply chain. Assessed actors: APT-41 (cyber), Houthi Movement (kinetic), IRGC (electronic warfare). Simultaneous timing is assessed as deliberate synchronization.",
    publishedDate: new Date(Date.now() - 10800000).toISOString(),
    score: 0.92, category: "threat",
  },
  {
    id: "i7", title: "Shodan: 14 Egyptian Maritime ICS Devices with No Authentication Exposed",
    url: "https://www.shodan.io",
    source: "SHODAN_INTEL",
    summary: "Passive scan of Egyptian maritime IP ranges (AS8452, AS24863): 14 ICS devices with no authentication. Products include Modbus TCP gateways, DNP3 controllers, and Siemens S7 PLCs. Direct attack surface for canal disruption. Devices located at Port Said, Ismailia, and Suez City.",
    publishedDate: new Date(Date.now() - 12600000).toISOString(),
    score: 0.90, category: "vulnerability",
  },
  {
    id: "i8", title: "HAWK-I Ontology Analysis: UNIT-FOXTROT Reaches Critical Supply Threshold in 58hrs",
    url: "https://nshackathon.palantirfoundry.com",
    source: "HAWK-I_AI",
    summary: "HAWK-I ontology traversal: CONVOY-BRAVO (VSL-002) SUPPLIED_BY UNIT-FOXTROT. Current delay projection + threat assessment puts UNIT-FOXTROT below critical supply threshold in 58 hours. Three Courses of Action generated. Commander decision required immediately.",
    publishedDate: new Date().toISOString(),
    score: 0.99, category: "threat",
  },
];

router.get("/intel/feed", async (req, res) => {
  const apiKey = process.env["EXA_API_KEY"];
  const limit  = typeof req.query["limit"] === "string" ? parseInt(req.query["limit"]) : 12;
  const status = getMissionStatus();

  // Merge mission events into the feed
  const missionItems = getMissionIntelItems().map(item => ({
    id:            String(item["id"] ?? `m-${Date.now()}`),
    title:         String(item["title"] ?? ""),
    url:           String(item["url"] ?? "#"),
    source:        String(item["source"] ?? "HAWK-I"),
    summary:       String(item["summary"] ?? ""),
    publishedDate: String(item["publishedDate"] ?? new Date().toISOString()),
    score:         typeof item["score"] === "number" ? item["score"] : 0.9,
    category:      String(item["category"] ?? "threat"),
    missionPhase:  status.currentPhase,
  }));

  if (!apiKey) {
    const merged = [...missionItems, ...FALLBACK_INTEL].slice(0, limit);
    return res.json({ total: merged.length, items: merged, query: INTEL_QUERIES[0], source: "fallback+mission" });
  }

  // Try two Red Sea / Middle East queries in parallel and merge results
  try {
    const [res1, res2] = await Promise.allSettled(
      INTEL_QUERIES.map(query =>
        fetch("https://api.exa.ai/search", {
          method:  "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({
            query,
            numResults: 6,
            useAutoprompt: true,
            startPublishedDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            contents: { text: { maxCharacters: 450 } },
          }),
          signal: AbortSignal.timeout(10_000),
        }).then(r => r.ok ? r.json() as Promise<{ results: Array<Record<string, unknown>> }> : Promise.reject(r.status))
      )
    );

    const classifyCategory = (title: string, url: string): string => {
      const text = (title + " " + url).toLowerCase();
      if (/airstrike|bomb|missile|strike|kinetic|attack|explosion|launch/.test(text)) return "kinetic";
      if (/ransomware|malware|hack|breach|cyber|apt|intrusion|scada|ics/.test(text))   return "cyber";
      if (/supply.?chain|logistics|depot|shipment|cargo|port|canal|suez/.test(text))   return "threat";
      if (/cve|vulnerabilit|exploit|patch|zero.?day|insecur/.test(text))                return "vulnerability";
      if (/china|russia|iran|houthi|geopolit|sanction|navy|marsec/.test(text))          return "geopolitical";
      return "threat";
    };

    const allResults: Record<string, unknown>[] = [];
    for (const r of [res1, res2]) {
      if (r.status === "fulfilled") allResults.push(...(r.value.results ?? []));
    }

    const seen = new Set<string>();
    const exaItems = allResults
      .filter(r => { const u = String(r["url"] ?? ""); if (seen.has(u)) return false; seen.add(u); return true; })
      .slice(0, limit - missionItems.length)
      .map((r, idx) => {
        const rawText = r["text"] as Record<string, unknown> | string | undefined;
        const summary = typeof (rawText as Record<string, unknown>)?.["text"] === "string"
          ? ((rawText as Record<string, unknown>)["text"] as string).slice(0, 450)
          : typeof rawText === "string" ? rawText.slice(0, 450) : "No summary available.";
        const urlStr = String(r["url"] ?? "https://unknown.com");
        let hostname = "UNKNOWN";
        try { hostname = new URL(urlStr).hostname.replace(/^www\./, "").toUpperCase(); } catch { /* noop */ }
        return {
          id:            String(r["id"] ?? `exa-${idx}`),
          title:         String(r["title"] ?? "Untitled"),
          url:           urlStr,
          source:        typeof r["author"] === "string" && r["author"] ? r["author"] : hostname,
          summary,
          publishedDate: String(r["publishedDate"] ?? new Date().toISOString()),
          score:         typeof r["score"] === "number" ? r["score"] : 0.8 - idx * 0.02,
          category:      classifyCategory(String(r["title"] ?? ""), urlStr),
        };
      });

    const merged = [...missionItems, ...exaItems].slice(0, limit);
    res.json({ total: merged.length, items: merged, query: INTEL_QUERIES.join(" | "), source: "exa+mission" });
  } catch (err) {
    logger.warn({ err }, "Exa fetch failed, using fallback + mission data");
    const merged = [...missionItems, ...FALLBACK_INTEL].slice(0, limit);
    res.json({ total: merged.length, items: merged, query: INTEL_QUERIES[0], source: "fallback+mission" });
  }
});

export default router;
