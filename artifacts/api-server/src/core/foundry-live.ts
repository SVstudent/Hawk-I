import { getCachedOntologyGraph, invalidateOntologyCache, ONTOLOGY_RID } from "./palantir-read";
import { logger } from "../lib/logger";

export interface VesselPosition {
  id: string;
  vesselName: string;
  lat: number;
  lon: number;
  speedKnots?: number;
  courseDeg?: number;
  vesselType?: string;
  mmsi?: string;
  imoNumber?: string;
  flagState?: string;
  destination?: string;
  timestamp?: string;
}

const DEFAULT_UPDATE_VESSEL_ACTION = "update-vessel-geolocation-main";
const DEFAULT_UPDATE_AIS_ACTION = "update-ais-track-position-main";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getFoundryAuth(): Promise<{ url: string; token: string } | null> {
  const url = process.env["PALANTIR_URL"] ?? process.env["FOUNDRY_URL"];
  const clientId = process.env["PALANTIR_CLIENT_ID"] ?? process.env["CLIENT_ID"];
  const clientSecret = process.env["PALANTIR_CLIENT_SECRET"] ?? process.env["CLIENT_SECRET"];
  const directToken = process.env["PALANTIR_TOKEN"] ?? process.env["FOUNDRY_TOKEN"];

  if (!url) return null;

  if (clientId && clientSecret) {
    const now = Date.now();
    if (cachedToken && cachedToken.expiresAt > now + 60_000) {
      return { url, token: cachedToken.value };
    }
    try {
      const res = await fetch(`${url}/multipass/api/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const data = await res.json() as { access_token: string; expires_in: number };
        cachedToken = {
          value: data.access_token,
          expiresAt: now + (data.expires_in ?? 3600) * 1000,
        };
        return { url, token: cachedToken.value };
      }
      logger.warn({ status: res.status }, "Foundry live auth failed");
    } catch (err) {
      logger.warn({ err }, "Foundry live auth exception");
    }
  }

  if (directToken) return { url, token: directToken };
  return null;
}

export async function fetchAISPositions(): Promise<VesselPosition[]> {
  const graph = await getCachedOntologyGraph();
  return graph.raw.ais
    .filter((track) => track.lat != null && track.lon != null)
    .map((track) => ({
      id: track.aisId ?? "",
      vesselName: track.vesselName ?? "Unknown",
      lat: track.lat,
      lon: track.lon,
      speedKnots: track.speedKnots ?? undefined,
      courseDeg: track.courseDeg ?? undefined,
      vesselType: track.vesselType ?? undefined,
      mmsi: track.mmsi ?? undefined,
      imoNumber: track.imoNumber ?? undefined,
      flagState: track.flagState ?? undefined,
      timestamp: track.timestamp ?? undefined,
    }));
}

export async function fetchLogisticsVessels(): Promise<VesselPosition[]> {
  const graph = await getCachedOntologyGraph();
  return graph.raw.vessels
    .filter((vessel) => vessel.lat != null && vessel.lon != null)
    .map((vessel) => ({
      id: vessel.vesselId ?? "",
      vesselName: vessel.vesselId ?? "Unknown",
      lat: vessel.lat,
      lon: vessel.lon,
      vesselType: vessel.classification ?? undefined,
      destination: vessel.destination ?? undefined,
    }));
}

async function applyOntologyAction(actionApiName: string, parameters: Record<string, unknown>) {
  const auth = await getFoundryAuth();
  if (!auth) {
    throw new Error("Foundry credentials are not configured for action execution.");
  }

  const response = await fetch(
    `${auth.url}/api/v2/ontologies/${ONTOLOGY_RID}/actions/${actionApiName}/apply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ parameters }),
      signal: AbortSignal.timeout(12_000),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Action ${actionApiName} failed (${response.status}): ${body.slice(0, 240)}`);
  }

  invalidateOntologyCache();
}

export async function updateVesselPosition(vesselId: string, newLat: number, newLon: number) {
  const actionName = process.env["UPDATE_VESSEL_ACTION"] ?? DEFAULT_UPDATE_VESSEL_ACTION;
  await applyOntologyAction(actionName, {
    vessel: vesselId,
    "new-latitude": newLat,
    "new-longitude": newLon,
  });
}

export async function updateAISTrackPosition(aisTrackId: string, newLat: number, newLon: number) {
  const actionName = process.env["UPDATE_AIS_TRACK_ACTION"] ?? DEFAULT_UPDATE_AIS_ACTION;
  await applyOntologyAction(actionName, {
    "ais-track": aisTrackId,
    "new-latitude": newLat,
    "new-longitude": newLon,
  });
}
