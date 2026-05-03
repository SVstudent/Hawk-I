import { Router } from "express";
import { logger } from "../lib/logger";
import { getMissionStatus } from "../core/mission-runner";

const router = Router();

// Egypt / Suez Canal ICS infrastructure — primary theater
const FALLBACK_THREATS_EGYPT = [
  { ip: "41.65.12.88",   port: 502,   org: "Suez Canal Authority",          location: "Port Said, EG",     product: "Modbus ICS Gateway",      vulnerabilities: ["CVE-2021-32926", "CVE-2020-14511"], severity: "critical", lat: 31.2600, lng: 32.2800, timestamp: new Date().toISOString() },
  { ip: "41.65.44.21",   port: 20000, org: "Ismailia Power Grid",           location: "Ismailia, EG",      product: "DNP3 SCADA Controller",   vulnerabilities: ["CVE-2022-22965"],                   severity: "high",     lat: 30.5800, lng: 32.2700, timestamp: new Date().toISOString() },
  { ip: "197.48.18.102", port: 102,   org: "Egyptian Maritime Authority",   location: "Suez, EG",          product: "Siemens S7 PLC",          vulnerabilities: ["CVE-2019-13945"],                   severity: "high",     lat: 29.9700, lng: 32.5500, timestamp: new Date().toISOString() },
  { ip: "196.203.5.67",  port: 44818, org: "Port Said Container Terminal",  location: "Port Said, EG",     product: "EtherNet/IP PLC",         vulnerabilities: ["CVE-2020-25159", "CVE-2021-33012"], severity: "critical", lat: 31.2560, lng: 32.2710, timestamp: new Date().toISOString() },
  { ip: "41.72.198.44",  port: 4840,  org: "Suez Canal VTS System",         location: "Great Bitter Lake", product: "OPC-UA SCADA Server",     vulnerabilities: ["CVE-2021-27435"],                   severity: "high",     lat: 30.3300, lng: 32.3700, timestamp: new Date().toISOString() },
  { ip: "197.48.80.3",   port: 47808, org: "Canal Navigation Control",      location: "Ismailia, EG",      product: "BACnet Building Control", vulnerabilities: [],                                   severity: "medium",   lat: 30.5900, lng: 32.2600, timestamp: new Date().toISOString() },
  { ip: "41.65.200.115", port: 1911,  org: "Egyptian Ports Authority",      location: "Alexandria, EG",    product: "Niagara Fox Protocol",    vulnerabilities: ["CVE-2021-44228"],                   severity: "critical", lat: 31.2001, lng: 29.9187, timestamp: new Date().toISOString() },
];

// Phase 2+ additional threats revealed by APT-41 campaign
const PHASE2_THREATS = [
  { ip: "41.65.88.200",  port: 502,   org: "Ismailia Lock Control Sys",     location: "Ismailia, EG",      product: "Modbus RTU Gateway",      vulnerabilities: ["CVE-2021-32926"],                   severity: "critical", lat: 30.5820, lng: 32.2680, timestamp: new Date().toISOString() },
  { ip: "196.203.10.44", port: 20000, org: "Suez Desalination Plant",       location: "Suez, EG",          product: "DNP3 Water Treatment",    vulnerabilities: ["CVE-2022-22965", "CVE-2021-34527"], severity: "critical", lat: 29.9650, lng: 32.5490, timestamp: new Date().toISOString() },
  { ip: "197.48.99.7",   port: 9600,  org: "Canal Canal Lock Actuators",    location: "Port Said, EG",     product: "Profibus DP Gateway",     vulnerabilities: ["CVE-2020-14511"],                   severity: "high",     lat: 31.2580, lng: 32.2820, timestamp: new Date().toISOString() },
];

router.get("/shodan/threats", async (req, res) => {
  const apiKey = process.env["SHODAN_API_KEY"];
  const status = getMissionStatus();

  // In phase 2+, include additional revealed threats
  const baseThreats = status.currentPhase >= 2
    ? [...FALLBACK_THREATS_EGYPT, ...PHASE2_THREATS]
    : FALLBACK_THREATS_EGYPT;

  const defaultQuery = "port:502 country:EG";
  const query = typeof req.query["query"] === "string" ? req.query["query"] : defaultQuery;
  const limit = typeof req.query["limit"] === "string" ? parseInt(req.query["limit"]) : 15;

  if (!apiKey) {
    return res.json({ total: baseThreats.length, results: baseThreats, query });
  }

  try {
    const encoded  = encodeURIComponent(query);
    const url      = `https://api.shodan.io/shodan/host/search?key=${apiKey}&query=${encoded}&limit=${limit}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });

    if (!response.ok) {
      req.log.warn({ status: response.status }, "Shodan API error, falling back");
      return res.json({ total: baseThreats.length, results: baseThreats, query });
    }

    const data = await response.json() as { total: number; matches: Array<Record<string, unknown>> };

    const results = (data.matches || []).slice(0, limit).map((m: Record<string, unknown>) => {
      const loc   = m["location"] as Record<string, unknown> | undefined;
      const vulns = m["vulns"] ? Object.keys(m["vulns"] as object) : [];
      const portNum = typeof m["port"] === "number" ? m["port"] : 0;
      let severity: "critical" | "high" | "medium" | "low" = "low";
      if (vulns.length >= 3) severity = "critical";
      else if (vulns.length === 2) severity = "high";
      else if (vulns.length === 1) severity = "medium";
      return {
        ip:              String(m["ip_str"] ?? ""),
        port:            portNum,
        org:             String(m["org"] ?? m["isp"] ?? "Unknown"),
        location:        loc ? `${loc["city"] ?? ""}, ${loc["country_name"] ?? ""}` : "Unknown",
        product:         String(m["product"] ?? m["devicetype"] ?? "Unknown Device"),
        vulnerabilities: vulns,
        severity,
        lat:             typeof loc?.["latitude"]  === "number" ? loc["latitude"]  : null,
        lng:             typeof loc?.["longitude"] === "number" ? loc["longitude"] : null,
        timestamp:       new Date().toISOString(),
      };
    });

    res.json({ total: data.total ?? results.length, results, query });
  } catch (err) {
    logger.warn({ err }, "Shodan fetch failed, using fallback data");
    res.json({ total: baseThreats.length, results: baseThreats, query });
  }
});

export default router;
