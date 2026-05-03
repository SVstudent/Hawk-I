import { Router } from "express";
import { getMissionTrackUpdates } from "../core/mission-runner";

const router = Router();

interface Track {
  id:        string;
  label:     string;
  type:      "friendly" | "hostile" | "unknown" | "neutral";
  lat:       number;
  lng:       number;
  altitude:  number;
  speed:     number;
  heading:   number;
  status:    string;
  cargo?:    string;
  timestamp: string;
}

// SF Bay Area air/ground tracks (original theater)
const BASE_TRACKS: Track[] = [
  { id: "TRK-001", label: "EAGLE-1",   type: "friendly", lat: 37.7749, lng: -122.4194, altitude: 28000, speed: 420, heading: 135, status: "active" },
  { id: "TRK-002", label: "EAGLE-2",   type: "friendly", lat: 37.8044, lng: -122.2712, altitude: 15000, speed: 310, heading: 270, status: "active" },
  { id: "TRK-003", label: "ROMEO-7",   type: "hostile",  lat: 37.6879, lng: -122.4702, altitude: 32000, speed: 580, heading: 45,  status: "tracking" },
  { id: "TRK-004", label: "UNK-14",    type: "unknown",  lat: 37.7577, lng: -122.5076, altitude:  8000, speed: 180, heading: 200, status: "monitoring" },
  { id: "TRK-005", label: "HAWK-3",    type: "friendly", lat: 37.8716, lng: -122.2727, altitude: 22000, speed: 390, heading: 180, status: "active" },
  { id: "TRK-006", label: "ROMEO-9",   type: "hostile",  lat: 37.7200, lng: -122.3800, altitude: 41000, speed: 620, heading: 90,  status: "tracking" },
  { id: "TRK-007", label: "DELTA-2",   type: "neutral",  lat: 37.9101, lng: -122.3100, altitude: 35000, speed: 450, heading: 315, status: "active" },
  { id: "TRK-008", label: "UNK-22",    type: "unknown",  lat: 37.6400, lng: -122.1200, altitude:  5000, speed: 120, heading: 60,  status: "monitoring" },

  // Red Sea / Bab-el-Mandeb theater
  { id: "TRK-SEA-001", label: "CONVOY-BRAVO", type: "friendly", lat: 12.80, lng: 43.60, altitude: 0,   speed: 12,  heading: 320, status: "transit",  cargo: "Petroleum, oils, lubricants" },
  { id: "TRK-SEA-002", label: "USS-CARNEY",   type: "friendly", lat: 12.30, lng: 43.30, altitude: 0,   speed: 28,  heading: 45,  status: "intercept" },
  { id: "TRK-SEA-003", label: "HOUTHI-UAV",   type: "hostile",  lat: 13.20, lng: 44.10, altitude: 500, speed: 150, heading: 280, status: "tracking" },

  // Suez Canal theater
  { id: "TRK-SUEZ-001", label: "VSL-004", type: "friendly", lat: 31.20, lng: 32.30, altitude: 0, speed: 8, heading: 0, status: "transit" },
  { id: "TRK-SUEZ-002", label: "VSL-008", type: "friendly", lat: 30.90, lng: 32.28, altitude: 0, speed: 0, heading: 0, status: "halted" },
];

router.get("/tracks", (_req, res) => {
  const now     = new Date().toISOString();
  const updates = getMissionTrackUpdates();

  const tracks = BASE_TRACKS.map(t => {
    const drift   = t.altitude > 0 ? 0.002 : 0.0005; // slower drift for naval
    const baseTrack = {
      ...t,
      lat:       t.lat + (Math.random() - 0.5) * drift,
      lng:       t.lng + (Math.random() - 0.5) * drift,
      timestamp: now,
    };
    const override = updates.get(t.id);
    if (!override) return baseTrack;
    return { ...baseTrack, ...override, lat: baseTrack.lat, lng: baseTrack.lng, timestamp: now };
  });

  res.json(tracks);
});

export default router;
