import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { FlyToInterpolator } from '@deck.gl/core';
import { ScatterplotLayer, PathLayer, ArcLayer, TextLayer } from '@deck.gl/layers';
import { useListShodanThreats, type ShodanThreat } from '@workspace/api-client-react';
import { useDemo } from '@/demo/use-demo';
import type {
  DemoTrackUpdate, DemoCyberThreat,
  DemoSigintItem, DemoIsrItem, DemoHumintItem, DemoAisItem, DemoIocItem,
} from '@/demo/demo-scenes';
import { DEMO_SCENES } from '@/demo/demo-scenes';
import { MapErrorBoundary } from './map-error-boundary';
import { MapFallback } from './map-fallback';

const FOUNDRY_URL = "https://nshackathon.palantirfoundry.com";

const OBJECT_TYPE_IDS: Record<string, string> = {
  LogisticsVessel: "logistics-vessel", HostileThreat: "hostile-threat",
  CombatUnit: "combat-unit", ConfirmedKineticIncident: "confirmed-kinetic-incident",
  GeneratedTacticalLead: "generated-tactical-lead", SigintIntercept: "sigint-intercept",
  IsrImagery: "isr-imagery", HumintReport: "humint-report",
  MaritimeAisTrack: "maritime-ais-track", CyberIoc: "cyber-ioc",
  ExampleRv17memory: "example-rv17-memory",
};

function foundryLink(objectType: string, pk: string) {
  const id = OBJECT_TYPE_IDS[objectType] ?? objectType.toLowerCase();
  return `${FOUNDRY_URL}/workspace/ontology/objects/${id}/${encodeURIComponent(pk)}`;
}

const INITIAL_VIEW_STATE = {
  longitude: 40, latitude: 22, zoom: 4, pitch: 30, bearing: 0,
};

const TRACK_COLORS: Record<string, [number, number, number, number]> = {
  friendly: [0,   120, 255, 220],
  hostile:  [255, 30,  30,  220],
  unknown:  [255, 180, 0,   220],
  neutral:  [140, 140, 140, 200],
};

const TRACK_COLORS_CSS: Record<string, string> = {
  friendly: '#0078ff', hostile: '#ff1e1e', unknown: '#ffb400', neutral: '#888888',
};

const THREAT_COLORS: Record<string, [number, number, number, number]> = {
  critical: [255, 30,  60,  200],
  high:     [255, 100, 0,   180],
  medium:   [255, 200, 0,   160],
  low:      [0,   200, 100, 140],
};

const THREAT_COLORS_CSS: Record<string, string> = {
  critical: '#ff003c', high: '#ff6400', medium: '#ffc800', low: '#00c864',
};

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// STATIC MAP DATA — Shipping lanes, chokepoints, ports, ambient traffic
// ---------------------------------------------------------------------------

interface ShippingLane {
  id:      string;
  name:    string;
  routeId: string;    // official route designation e.g. "SLOC RS-001"
  path:    number[][];
  color:   [number, number, number, number];
  width:   number;
  isDashed?: boolean;
  labelLng:  number;  // midpoint for label placement
  labelLat:  number;
}

const SHIPPING_LANES: ShippingLane[] = [
  // Red Sea Main Corridor (northbound/southbound)
  {
    id: 'lane-red-sea', name: 'Red Sea Main Corridor',
    routeId: 'SLOC RS-001 / MSR DELTA',
    labelLng: 38.0, labelLat: 24.0,
    path: [
      [43.2, 12.3],  // Bab-el-Mandeb
      [42.5, 15.0],
      [41.5, 18.0],
      [40.5, 21.0],
      [38.5, 23.5],  // Yanbu
      [37.5, 25.5],
      [36.5, 27.5],
      [34.5, 29.0],
      [32.9, 29.8],  // Port Suez
      [32.5, 30.2],  // Suez Canal
      [32.3, 31.2],  // Port Said
    ],
    color: [0, 160, 255, 60], width: 4,
  },
  // Gulf of Aden
  {
    id: 'lane-gulf-aden', name: 'Gulf of Aden',
    routeId: 'SLOC GOA-002 / MSR FALCON-W',
    labelLng: 50.5, labelLat: 11.5,
    path: [
      [43.1, 11.6],  // Djibouti
      [43.2, 12.3],  // Bab-el-Mandeb
      [45.0, 12.0],
      [47.0, 11.8],
      [50.0, 11.5],
      [52.0, 12.0],
      [54.0, 12.5],  // Aden Gulf east
      [56.3, 26.6],  // Strait of Hormuz (Persian Gulf entry)
    ],
    color: [0, 180, 220, 55], width: 3,
  },
  // Indian Ocean approach to Red Sea
  {
    id: 'lane-indian-ocean', name: 'Indian Ocean Approach',
    routeId: 'SLOC IO-003 / MSR GUARDIAN',
    labelLng: 62.0, labelLat: 14.0,
    path: [
      [72.8, 18.9],  // Mumbai
      [65.0, 15.0],
      [58.0, 12.0],
      [54.0, 12.5],
      [50.0, 11.5],
      [43.1, 11.6],  // Djibouti
    ],
    color: [0, 140, 200, 45], width: 3,
  },
  // Cape of Good Hope alternative (rerouting around Africa)
  {
    id: 'lane-cape', name: 'Cape of Good Hope Route',
    routeId: 'ALT-SLOC CGH-004',
    labelLng: 28.0, labelLat: -12.0,
    path: [
      [43.2, 12.3],
      [38.0, 5.0],
      [32.0, -5.0],
      [25.0, -15.0],
      [20.0, -25.0],
      [18.5, -34.0],  // Cape Town
    ],
    color: [255, 160, 0, 40], width: 2, isDashed: true,
  },
  // Mediterranean (Suez → Med)
  {
    id: 'lane-med', name: 'Mediterranean',
    routeId: 'SLOC MED-005 / MSR ATLAS',
    labelLng: 15.0, labelLat: 36.8,
    path: [
      [32.3, 31.2],  // Port Said
      [28.0, 33.5],
      [22.0, 35.0],
      [15.0, 36.5],
      [10.0, 37.5],
      [5.0, 38.5],
      [-0.5, 38.0],
      [-5.5, 35.9],  // Gibraltar
    ],
    color: [0, 160, 255, 50], width: 3,
  },
  // Persian Gulf
  {
    id: 'lane-persian-gulf', name: 'Persian Gulf',
    routeId: 'SLOC PG-006 / MSR FALCON-E',
    labelLng: 52.5, labelLat: 25.2,
    path: [
      [56.3, 26.6],  // Strait of Hormuz
      [55.0, 25.0],  // Dubai
      [53.0, 24.5],
      [51.5, 24.5],
      [50.0, 26.0],  // Kuwait
    ],
    color: [0, 200, 180, 45], width: 2,
  },
];

interface Chokepoint {
  id:         string;
  name:       string;
  short:      string;
  lng:        number;
  lat:        number;
  type:       'strategic' | 'port' | 'waypoint';
  isHostile?: boolean;
  cargoValue: string;  // daily cargo value transiting
}

const CHOKEPOINTS: Chokepoint[] = [
  { id: 'bab-mandeb',    name: 'Bab-el-Mandeb',        short: 'BaB-EL-MANDEB',   lng: 43.15, lat: 12.35, type: 'strategic', cargoValue: '$5.1B/day' },
  { id: 'suez',          name: 'Suez Canal / Port Said', short: 'SUEZ CANAL',      lng: 32.28, lat: 31.10, type: 'strategic', cargoValue: '$9.4B/day' },
  { id: 'hormuz',        name: 'Strait of Hormuz',      short: 'HORMUZ',          lng: 56.30, lat: 26.60, type: 'strategic', cargoValue: '$3.2B/day' },
  { id: 'gibraltar',     name: 'Strait of Gibraltar',   short: 'GIBRALTAR',       lng: -5.50, lat: 35.90, type: 'strategic', cargoValue: '$1.8B/day' },
  { id: 'djibouti',      name: 'Djibouti',              short: 'DJIBOUTI',        lng: 43.10, lat: 11.60, type: 'port',      cargoValue: 'HUB' },
  { id: 'jeddah',        name: 'Jeddah',                short: 'JEDDAH',          lng: 39.20, lat: 21.50, type: 'port',      cargoValue: 'LOGISTICS' },
  { id: 'dubai',         name: 'Dubai / Jebel Ali',     short: 'DUBAI',           lng: 55.00, lat: 25.00, type: 'port',      cargoValue: 'LOGISTICS' },
  { id: 'aden',          name: 'Aden',                  short: 'ADEN',            lng: 44.90, lat: 12.80, type: 'port',      cargoValue: 'HOSTILE AOR' },
  { id: 'hudaydah',      name: 'Hudaydah (Houthi)',     short: 'HUDAYDAH',        lng: 42.95, lat: 14.80, type: 'port',      isHostile: true, cargoValue: 'HOSTILE CONTROLLED' },
  { id: 'port-said-ext', name: 'Port Said',             short: 'PORT SAID',       lng: 32.30, lat: 31.26, type: 'port',      cargoValue: 'CANAL ENTRY' },
  { id: 'muscat',        name: 'Muscat',                short: 'MUSCAT',          lng: 58.60, lat: 23.60, type: 'port',      cargoValue: 'LOGISTICS' },
  { id: 'cape-town',     name: 'Cape Town',             short: 'CAPE TOWN',       lng: 18.50, lat: -34.0, type: 'waypoint',  cargoValue: 'DIVERT HUB' },
];

// ---------------------------------------------------------------------------
// US / Allied military bases — Red Sea to Strait of Hormuz theater
// ---------------------------------------------------------------------------

interface MilitaryBase {
  id:      string;
  name:    string;
  short:   string;      // NATO-style short designation
  baseId:  string;      // official designator e.g. "NSA BAHRAIN"
  lng:     number;
  lat:     number;
  nation:  'US' | 'UK' | 'FR' | 'IT' | 'JO' | 'OM' | 'SA' | 'TR' | 'IL' | 'IQ' | 'ET' | 'RU' | 'AU';
  type:    'air' | 'naval' | 'army' | 'joint';
  role:    string;
  personnel: string;
}

const MILITARY_BASES: MilitaryBase[] = [
  // ── US Installations ──────────────────────────────────────────────────────
  {
    id: 'camp-lemonnier', name: 'Camp Lemonnier', short: 'CLJ', baseId: 'CJTF-HOA / NSA DJIBOUTI',
    lng: 43.158, lat: 11.548, nation: 'US', type: 'joint',
    role: 'CJTF-HOA HQ · Drone ops · Horn of Africa logistics hub',
    personnel: '~4,000 US + coalition',
  },
  {
    id: 'nsa-bahrain', name: 'NSA Bahrain', short: 'NSA BHR', baseId: 'NAVCENT / US 5TH FLEET',
    lng: 50.522, lat: 26.212, nation: 'US', type: 'naval',
    role: 'US Navy 5th Fleet HQ · Gulf maritime patrol · NAVCENT command',
    personnel: '~7,000 USN/USMC',
  },
  {
    id: 'al-udeid', name: 'Al Udeid Air Base', short: 'AUAB', baseId: 'AFCENT / 379 AEW',
    lng: 51.312, lat: 25.118, nation: 'US', type: 'air',
    role: 'USAF AFCENT primary · CAOC · Strategic airlift/tanker hub',
    personnel: '~10,000 US + NATO',
  },
  {
    id: 'al-dhafra', name: 'Al Dhafra Air Base', short: 'AL DHAFRA', baseId: 'USAF 380 AEW',
    lng: 54.548, lat: 24.248, nation: 'US', type: 'air',
    role: 'F-35/F-22 fwd deploy · ISR/RPA · Tanker refueling',
    personnel: '~3,500 USAF',
  },
  {
    id: 'prince-sultan', name: 'Prince Sultan Air Base', short: 'PSAB', baseId: 'USAF 378 AEW',
    lng: 47.583, lat: 24.073, nation: 'US', type: 'air',
    role: 'USAF fwd ops · F-15/Patriot · Gulf air defense',
    personnel: '~3,000 USAF',
  },
  {
    id: 'camp-arifjan', name: 'Camp Arifjan', short: 'ARIFJAN', baseId: 'US ARMY ARCENT',
    lng: 47.934, lat: 29.098, nation: 'US', type: 'army',
    role: 'US Army ARCENT HQ · Logistics/pre-positioned stocks',
    personnel: '~13,500 USA',
  },
  {
    id: 'ali-al-salem', name: 'Ali Al Salem Air Base', short: 'ALI AL SALEM', baseId: 'USAF 386 AEW',
    lng: 47.682, lat: 29.342, nation: 'US', type: 'air',
    role: 'Airlift hub · C-17/C-130 ops · Theater air mobility',
    personnel: '~1,500 USAF',
  },
  {
    id: 'eskan-village', name: 'Eskan Village Air Base', short: 'ESKAN', baseId: 'USAF / AFSOC',
    lng: 46.880, lat: 24.420, nation: 'US', type: 'air',
    role: 'AFSOC special ops · Logistics support · Personnel staging',
    personnel: '~1,200 USAF/SOCOM',
  },
  {
    id: 'diego-garcia', name: 'Diego Garcia', short: 'DIEGO GARCIA', baseId: 'NAVFAC / NSF DIEGO GARCIA',
    lng: 72.436, lat: -7.320, nation: 'US', type: 'joint',
    role: 'Strategic bomber base · B-2/B-52 · Prepos fleet · IO hub',
    personnel: '~3,000 US/UK',
  },
  // ── UK Installations ──────────────────────────────────────────────────────
  {
    id: 'hms-juffair', name: 'HMS Juffair', short: 'JUFFAIR', baseId: 'RN GULF / UKMCC',
    lng: 50.556, lat: 26.200, nation: 'UK', type: 'naval',
    role: 'Royal Navy Gulf HQ · UKMCC · Type 45/23 fwd ops',
    personnel: '~600 RN',
  },
  {
    id: 'raf-akrotiri', name: 'RAF Akrotiri', short: 'AKROTIRI', baseId: 'RAF / NEAF CYPRUS',
    lng: 32.988, lat: 34.590, nation: 'UK', type: 'air',
    role: 'UK air power projection · Typhoon/Tornado · ISTAR hub',
    personnel: '~2,500 RAF/Army',
  },
  {
    id: 'thumrait', name: 'Thumrait Air Base', short: 'THUMRAIT', baseId: 'RAFO / UK DET',
    lng: 54.023, lat: 17.668, nation: 'OM', type: 'air',
    role: 'UK/US fwd det · Oman RAFO · Indian Ocean air cover',
    personnel: '~800 RAFO + UK det',
  },
  // ── French Installations ──────────────────────────────────────────────────
  {
    id: 'ffd-djibouti', name: 'French Forces Djibouti', short: 'FFD', baseId: 'FFDj / BASE AÉRONAVALE',
    lng: 43.175, lat: 11.525, nation: 'FR', type: 'joint',
    role: 'French forces Djibouti · LHD · Legión Étrangère · HOA patrol',
    personnel: '~1,450 FA',
  },
  // ── Italian Installations ─────────────────────────────────────────────────
  {
    id: 'bmis-djibouti', name: 'BMIS Djibouti (Italian Base)', short: 'BMIS', baseId: 'MARINA MILITARE / EUTM',
    lng: 43.140, lat: 11.570, nation: 'IT', type: 'naval',
    role: 'Italian Navy · EU NAVFOR Atalanta · Counter-piracy ops',
    personnel: '~300 MM',
  },
  // ── Jordanian / Coalition ─────────────────────────────────────────────────
  {
    id: 'muwaffaq-salti', name: 'Muwaffaq Salti Air Base', short: 'MUWAFFAQ', baseId: 'RJAF / US DET',
    lng: 36.789, lat: 32.360, nation: 'JO', type: 'air',
    role: 'Jordan RJAF · USAF det · F-16 · Northern theater air cover',
    personnel: '~2,000 RJAF + US det',
  },
  // ── Turkey (NATO) ─────────────────────────────────────────────────────────
  {
    id: 'incirlik', name: 'Incirlik Air Base', short: 'INCIRLIK', baseId: 'USAF 39 ABW / NATO',
    lng: 35.426, lat: 37.002, nation: 'TR', type: 'joint',
    role: 'NATO nuclear storage (B61) · USAF F-16 det · Tanker hub · N.theater air power',
    personnel: '~5,000 NATO/USAF',
  },
  // ── Syria: US/Coalition ────────────────────────────────────────────────────
  {
    id: 'al-tanf', name: 'Al-Tanf Garrison', short: 'AL-TANF', baseId: 'CJTF-OIR / US SOF',
    lng: 38.620, lat: 33.551, nation: 'US', type: 'army',
    role: 'US SOF fwd garrison · 55km deconfliction zone · MaT Syrians training · Iran interdiction',
    personnel: '~200 US SOF',
  },
  {
    id: 'rmeilan', name: 'Rmeilan (Qamishli) AB', short: 'RMEILAN', baseId: 'SDF/CJTF-OIR US det',
    lng: 40.669, lat: 37.051, nation: 'US', type: 'air',
    role: 'US SOF det · SDF support · C-17/STOL ops · NE Syria oil field security',
    personnel: '~900 US SOF + JTAC',
  },
  // ── Syria: Russian (hostile/monitored) ────────────────────────────────────
  {
    id: 'hmeimim', name: 'Hmeimim AB (RU)', short: 'HMEIMIM', baseId: 'VKS RUSSIA / HOSTILE',
    lng: 35.988, lat: 35.401, nation: 'RU', type: 'air',
    role: '⚠ HOSTILE — Russian VKS Syria primary · Su-35/Su-34/Su-24M · Monitored',
    personnel: '~4,000+ VKS',
  },
  {
    id: 'tartus', name: 'Tartus Naval Base (RU)', short: 'TARTUS', baseId: 'VMF RUSSIA / HOSTILE',
    lng: 35.866, lat: 34.895, nation: 'RU', type: 'naval',
    role: '⚠ HOSTILE — Only Russian warm-water port · Kilo-class subs · ELINT monitored',
    personnel: '~1,500 VMF',
  },
  // ── Iraq (US/Coalition) ───────────────────────────────────────────────────
  {
    id: 'al-asad', name: 'Al-Asad Air Base', short: 'AL-ASAD', baseId: 'USAF / MNF-I',
    lng: 42.441, lat: 33.786, nation: 'US', type: 'air',
    role: 'USAF/USMC western Iraq ops · F/A-18 det · Iraqi AF joint ops · Ballistic missile hit 2020',
    personnel: '~2,000 US + coalition',
  },
  {
    id: 'erbil-ab', name: 'Erbil AB (AASAB)', short: 'ERBIL AB', baseId: 'CJTF-OIR / KRAB',
    lng: 44.013, lat: 36.237, nation: 'US', type: 'joint',
    role: 'Coalition NE Iraq ops · F-16/A-10 · CJTF-OIR SOF · LOGCAP resupply hub',
    personnel: '~3,000 US + coalition',
  },
  {
    id: 'biap', name: 'Baghdad Intl (Camp Victory)', short: 'BIAP/VBC', baseId: 'MNF-I / USAF 447 AEG',
    lng: 44.234, lat: 33.262, nation: 'US', type: 'joint',
    role: 'Main Iraq logistics hub · Coalition HQ · CAOC-I · Theater airlift terminus',
    personnel: '~4,000 coalition',
  },
  // ── Israel ────────────────────────────────────────────────────────────────
  {
    id: 'nevatim', name: 'Nevatim Air Base', short: 'NEVATIM', baseId: 'IAF / F-35I ADIR',
    lng: 35.012, lat: 31.208, nation: 'IL', type: 'air',
    role: 'IAF F-35I Adir sqn · USAF det · Strike package hub · Regional power projection',
    personnel: '~1,500 IAF + USAF det',
  },
  {
    id: 'ramon-ab', name: 'Ramon Air Base', short: 'RAMON AB', baseId: 'IAF / NEGEV',
    lng: 34.663, lat: 30.776, nation: 'IL', type: 'air',
    role: 'IAF F-16I/F-15I · Negev hub · Training + fwd ops · Jordan Valley proximity',
    personnel: '~1,200 IAF',
  },
  // ── Egypt ─────────────────────────────────────────────────────────────────
  {
    id: 'cairo-west', name: 'Cairo West Air Base', short: 'CAIRO WEST', baseId: 'EAAF / US MOU',
    lng: 29.924, lat: 30.116, nation: 'US', type: 'air',
    role: 'US/Egypt exercise base · Bright Star · C-130/KC-135 ops · USAF fwd access MOU',
    personnel: '~800 USAF (exercise)',
  },
  // ── Saudi Arabia ──────────────────────────────────────────────────────────
  {
    id: 'tabuk-ab', name: 'Tabuk Air Base', short: 'TABUK AB', baseId: 'RSAF / US det',
    lng: 36.617, lat: 28.363, nation: 'SA', type: 'air',
    role: 'RSAF northern theater · USAF det · F-15 ops · Red Sea air coverage / Sinai proximity',
    personnel: '~1,500 RSAF + US det',
  },
  {
    id: 'king-khalid', name: 'King Khalid Military City', short: 'KKMC', baseId: 'RSLF / ARCENT',
    lng: 45.530, lat: 27.900, nation: 'SA', type: 'army',
    role: 'Largest military city world · RSLF garrison · ARCENT prepo POMCUS stocks · 65k garrison',
    personnel: '~65,000 RSLF + US logistics',
  },
  // ── Ethiopia / Horn of Africa ─────────────────────────────────────────────
  {
    id: 'chabelley', name: 'Chabelley Airfield', short: 'CHABELLEY', baseId: 'USAF / RPA / HOA',
    lng: 43.001, lat: 11.294, nation: 'US', type: 'air',
    role: 'MQ-9 Reaper launch/recovery · CJTF-HOA ISR support · Djibouti overflow',
    personnel: '~200 USAF',
  },
  // ── Kenya ─────────────────────────────────────────────────────────────────
  {
    id: 'manda-bay', name: 'Manda Bay Air Base (Kenya)', short: 'MANDA BAY', baseId: 'USAFRICOM / HOA',
    lng: 40.895, lat: -2.270, nation: 'US', type: 'joint',
    role: 'Counter-piracy / CT ops · P-3C/MQ-9 · Indian Ocean ISR · Jan 2020 al-Shabaab attack site',
    personnel: '~150 US',
  },
  // ── Somalia ───────────────────────────────────────────────────────────────
  {
    id: 'baledogle', name: 'Baledogle AB', short: 'BALEDOGLE', baseId: 'USAFRICOM / SOMA CT',
    lng: 44.942, lat: 2.330, nation: 'US', type: 'air',
    role: 'CT ops Somalia · MQ-9 ops · AMISOM support · al-Shabaab interdiction',
    personnel: '~500 US + SOMA',
  },
  // ── Oman ──────────────────────────────────────────────────────────────────
  {
    id: 'masirah', name: 'Masirah Island AB', short: 'MASIRAH', baseId: 'RAFO / US det / IO',
    lng: 58.900, lat: 20.680, nation: 'OM', type: 'air',
    role: 'RAFO Indian Ocean base · US det · P-3C/P-8 · Strait of Hormuz ISR',
    personnel: '~600 RAFO + US det',
  },
  // ── Australia ─────────────────────────────────────────────────────────────
  {
    id: 'darwin-raaf', name: 'RAAF Base Darwin', short: 'DARWIN', baseId: 'RAAF / MRF-D',
    lng: 130.876, lat: -12.424, nation: 'AU', type: 'joint',
    role: 'RAAF + US Marine Rotational Force-Darwin · IO access · Indo-Pacific fwd ops',
    personnel: '~2,500 RAAF + 2,500 USMC',
  },
];

// Nation color coding for base markers
const BASE_NATION_COLORS: Record<string, [number, number, number, number]> = {
  US: [30,  144, 255, 220],
  UK: [200, 30,  70,  200],
  FR: [20,  80,  200, 200],
  IT: [0,   160, 80,  200],
  JO: [200, 160, 0,   200],
  OM: [180, 100, 0,   200],
  SA: [0,   180, 100, 200],
  TR: [200, 30,  30,  200],
  IL: [60,  120, 220, 200],
  IQ: [0,   180, 80,  200],
  ET: [200, 160, 0,   180],
  RU: [220, 50,  50,  220],
  AU: [0,   100, 180, 200],
};

const BASE_NATION_CSS: Record<string, string> = {
  US: '#1e90ff', UK: '#c81e46', FR: '#1450c8', IT: '#00a050',
  JO: '#c8a000', OM: '#b46400', SA: '#00b464', TR: '#c81e1e',
  IL: '#3c78dc', IQ: '#00b450', ET: '#c8a000', RU: '#dc3232', AU: '#0064b4',
};

// Ambient commercial vessel traffic along shipping lanes
interface AmbientVessel {
  id:   string;
  lng:  number;
  lat:  number;
  type: 'tanker' | 'cargo' | 'container' | 'bulk';
  name: string;
  flag: string;
  cargo: string;
  heading: number;
}

const AMBIENT_VESSELS: AmbientVessel[] = [
  // Red Sea
  { id: 'amb-001', lng: 42.0, lat: 14.0, type: 'tanker',    name: 'NORDIC LUNA',     flag: 'NO', cargo: 'Crude Oil 2.1Mt', heading: 340 },
  { id: 'amb-002', lng: 41.2, lat: 16.5, type: 'container', name: 'MAERSK CAPE',     flag: 'DK', cargo: '14,500 TEU',      heading: 340 },
  { id: 'amb-003', lng: 40.8, lat: 19.0, type: 'cargo',     name: 'GLOBAL TRADER',   flag: 'MH', cargo: 'Mixed Cargo',     heading: 5   },
  { id: 'amb-004', lng: 39.5, lat: 21.2, type: 'bulk',      name: 'OCEAN SPIRIT',    flag: 'LR', cargo: 'Iron Ore 85kt',   heading: 350 },
  { id: 'amb-005', lng: 38.2, lat: 23.0, type: 'tanker',    name: 'PHOENIX STAR',    flag: 'GR', cargo: 'LNG',             heading: 355 },
  { id: 'amb-006', lng: 36.8, lat: 24.5, type: 'container', name: 'CMA CGM SUEZ',    flag: 'FR', cargo: '18,000 TEU',      heading: 0   },
  { id: 'amb-007', lng: 35.0, lat: 26.0, type: 'cargo',     name: 'BALTIC SEA',      flag: 'LR', cargo: 'Grain 45kt',      heading: 350 },
  { id: 'amb-008', lng: 33.8, lat: 27.8, type: 'tanker',    name: 'GULF MARINER',    flag: 'SA', cargo: 'Petroleum 180kt', heading: 355 },
  { id: 'amb-009', lng: 33.1, lat: 29.0, type: 'container', name: 'EVER GREET',      flag: 'TW', cargo: '20,000 TEU',      heading: 0   },
  // Southbound (different heading)
  { id: 'amb-010', lng: 41.8, lat: 15.5, type: 'cargo',     name: 'ATLAS DIANA',     flag: 'GR', cargo: 'Military Equip',  heading: 170 },
  { id: 'amb-011', lng: 40.5, lat: 18.5, type: 'container', name: 'MSC BEATRICE',    flag: 'PA', cargo: '13,800 TEU',      heading: 165 },
  { id: 'amb-012', lng: 39.2, lat: 22.0, type: 'tanker',    name: 'SEAWAYS PACIFIC', flag: 'MH', cargo: 'Crude 1.8Mt',     heading: 175 },
  // Gulf of Aden
  { id: 'amb-013', lng: 47.0, lat: 11.8, type: 'container', name: 'COSCO BEIJING',   flag: 'CN', cargo: '15,200 TEU',      heading: 270 },
  { id: 'amb-014', lng: 49.5, lat: 11.9, type: 'tanker',    name: 'GULF PIONEER',    flag: 'SA', cargo: 'LNG 160kt',       heading: 265 },
  { id: 'amb-015', lng: 52.0, lat: 12.1, type: 'bulk',      name: 'HARVEST QUEEN',   flag: 'LR', cargo: 'Wheat 72kt',      heading: 270 },
  { id: 'amb-016', lng: 54.5, lat: 12.3, type: 'cargo',     name: 'EASTERN PRIDE',   flag: 'SG', cargo: 'Electronics',     heading: 275 },
  // Indian Ocean approach
  { id: 'amb-017', lng: 60.0, lat: 13.0, type: 'tanker',    name: 'MUMBAI SPIRIT',   flag: 'IN', cargo: 'Crude 2.4Mt',     heading: 280 },
  { id: 'amb-018', lng: 64.0, lat: 14.0, type: 'container', name: 'HAPAG LLOYD',     flag: 'DE', cargo: '12,000 TEU',      heading: 270 },
  { id: 'amb-019', lng: 68.0, lat: 16.0, type: 'bulk',      name: 'IRON ATLAS',      flag: 'LR', cargo: 'Iron Ore 95kt',   heading: 265 },
  // Persian Gulf
  { id: 'amb-020', lng: 55.5, lat: 25.5, type: 'tanker',    name: 'ARABIAN FALCON',  flag: 'AE', cargo: 'Crude 1.2Mt',     heading: 130 },
  { id: 'amb-021', lng: 54.0, lat: 25.0, type: 'cargo',     name: 'DUBAI EXPRESS',   flag: 'AE', cargo: 'General Cargo',   heading: 145 },
  { id: 'amb-022', lng: 51.5, lat: 25.5, type: 'tanker',    name: 'GULF STAR',       flag: 'KW', cargo: 'Petroleum 220kt', heading: 160 },
  // Mediterranean
  { id: 'amb-023', lng: 28.0, lat: 33.5, type: 'container', name: 'ZIM ISTANBUL',    flag: 'IL', cargo: '8,500 TEU',       heading: 280 },
  { id: 'amb-024', lng: 22.0, lat: 35.0, type: 'cargo',     name: 'HELLAS SEA',      flag: 'GR', cargo: 'Mixed Cargo',     heading: 285 },
  { id: 'amb-025', lng: 16.0, lat: 36.5, type: 'tanker',    name: 'MED TRADER',      flag: 'MT', cargo: 'Refined Products', heading: 278 },
  { id: 'amb-026', lng: 10.0, lat: 37.5, type: 'container', name: 'GENOVA STAR',     flag: 'IT', cargo: '11,000 TEU',      heading: 280 },
  // Cape of Good Hope area
  { id: 'amb-027', lng: 25.0, lat: -15.0, type: 'tanker',   name: 'CAPE NAVIGATOR',  flag: 'NO', cargo: 'Crude 2.8Mt',     heading: 340 },
  { id: 'amb-028', lng: 20.0, lat: -25.0, type: 'container', name: 'CAPE VENTURE',   flag: 'UK', cargo: '16,000 TEU',      heading: 345 },
  { id: 'amb-029', lng: 38.0, lat: 5.0,  type: 'bulk',      name: 'AFRICAN STAR',    flag: 'LR', cargo: 'Coal 110kt',      heading: 175 },
  { id: 'amb-030', lng: 33.0, lat: -5.0, type: 'tanker',    name: 'HORIZON PRIDE',   flag: 'GR', cargo: 'Crude 1.9Mt',     heading: 180 },
  // Suez queue
  { id: 'amb-031', lng: 32.4, lat: 30.0, type: 'container', name: 'SUEZ QUEUE-1',   flag: 'PA', cargo: '14,100 TEU',      heading: 0   },
  { id: 'amb-032', lng: 32.5, lat: 29.7, type: 'tanker',    name: 'SUEZ QUEUE-2',   flag: 'MH', cargo: 'Petroleum',       heading: 0   },
  { id: 'amb-033', lng: 32.3, lat: 30.3, type: 'cargo',     name: 'SUEZ QUEUE-3',   flag: 'LR', cargo: 'General Cargo',   heading: 0   },
  { id: 'amb-034', lng: 32.6, lat: 30.1, type: 'bulk',      name: 'SUEZ QUEUE-4',   flag: 'GR', cargo: 'Grain 68kt',      heading: 0   },
  { id: 'amb-035', lng: 32.2, lat: 30.5, type: 'container', name: 'SUEZ QUEUE-5',   flag: 'TW', cargo: '13,500 TEU',      heading: 0   },
];

// ---------------------------------------------------------------------------
// Route interpolation helper for animated objects
// ---------------------------------------------------------------------------
function lerpRoute(path: [number, number][], t: number): [number, number] {
  if (!path || path.length === 0) return [0, 0];
  if (path.length === 1) return path[0];
  const clamped = Math.max(0, Math.min(0.9999, t));
  const totalSegs = path.length - 1;
  const pos = clamped * totalSegs;
  const segIdx = Math.floor(pos);
  const segT = pos - segIdx;
  const [lngA, latA] = path[Math.min(segIdx, totalSegs - 1)];
  const [lngB, latB] = path[Math.min(segIdx + 1, totalSegs)];
  return [lngA + (lngB - lngA) * segT, latA + (latB - latA) * segT];
}

// ---------------------------------------------------------------------------
// Moving aircraft — full theater air picture
// ---------------------------------------------------------------------------
interface MovingAircraft {
  id: string; callsign: string; nato: string; type: string;
  nationality: 'US' | 'UK' | 'FR' | 'AU';
  altitudeFt: number; speedKts: number;
  mission: string; status: 'AIRBORNE' | 'RTB' | 'HOLDING' | 'DIVERTED';
  note: string;
  route: [number, number][]; cycleMins: number; offsetFrac: number;
}

const MOVING_AIRCRAFT: MovingAircraft[] = [
  { id: 'eagle-01',   callsign: 'EAGLE-01',   nato: 'C-17A GLOBEMASTER III',  type: 'C-17',   nationality: 'US', altitudeFt: 35000, speedKts: 450, mission: 'STRATEGIC AIRLIFT',          status: 'AIRBORNE', note: 'Al Udeid → Muscat → Djibouti — Critical Class I/V stores UNIT-FOXTROT', route: [[51.3,25.1],[58.6,23.6],[50.0,13.0],[43.1,11.6]], cycleMins: 200, offsetFrac: 0.0 },
  { id: 'eagle-02',   callsign: 'EAGLE-02',   nato: 'C-130J SUPER HERCULES',  type: 'C-130',  nationality: 'US', altitudeFt: 24000, speedKts: 340, mission: 'THEATER AIRLIFT',            status: 'AIRBORNE', note: 'Ali Al Salem → Baghdad BIAP — Coalition theater mobility / ARCENT resupply', route: [[47.7,29.3],[46.2,31.0],[44.3,33.3]], cycleMins: 60, offsetFrac: 0.3 },
  { id: 'raptor-01',  callsign: 'RAPTOR-01',  nato: 'P-8A POSEIDON',           type: 'P-8',    nationality: 'US', altitudeFt: 25000, speedKts: 450, mission: 'MARITIME PATROL / ASW',      status: 'AIRBORNE', note: 'Red Sea MPA ellipse — AIS correlation / convoy overwatch / Houthi sub tracking', route: [[36.5,19.0],[40.5,15.0],[43.0,12.5],[43.2,13.5],[41.0,16.0],[38.0,18.5],[36.5,19.0]], cycleMins: 120, offsetFrac: 0.5 },
  { id: 'shadow-01',  callsign: 'SHADOW-01',  nato: 'MQ-9 REAPER',             type: 'MQ-9',   nationality: 'US', altitudeFt: 25000, speedKts: 230, mission: 'ISR / STRIKE READY',         status: 'HOLDING',  note: 'Yemen border orbit — Houthi TEL site surveillance — HELLFIRE ready — CJTF-HOA tasked', route: [[44.2,16.0],[45.8,16.5],[46.1,15.2],[44.7,14.8],[44.2,16.0]], cycleMins: 40, offsetFrac: 0.2 },
  { id: 'guardian-01',callsign: 'GUARDIAN-01',nato: 'E-3G SENTRY AWACS',       type: 'E-3',    nationality: 'US', altitudeFt: 35000, speedKts: 350, mission: 'AWACS / THEATER C2',         status: 'AIRBORNE', note: 'Saudi racetrack orbit — Theater air picture — CAOC data link — feeds HAWK-I', route: [[46.0,23.0],[49.0,23.0],[49.0,26.0],[46.0,26.0],[46.0,23.0]], cycleMins: 90, offsetFrac: 0.7 },
  { id: 'fury-01',    callsign: 'FURY-01',    nato: 'KC-135R STRATOTANKER',    type: 'KC-135', nationality: 'US', altitudeFt: 30000, speedKts: 450, mission: 'AERIAL REFUELING',           status: 'AIRBORNE', note: 'Persian Gulf AAR orbit — FALCON-01 / RAPTOR-01 refueling — CENTCOM tasked', route: [[52.0,24.0],[55.0,24.0],[55.0,26.0],[52.0,26.0],[52.0,24.0]], cycleMins: 60, offsetFrac: 0.4 },
  { id: 'atlas-01',   callsign: 'ATLAS-01',   nato: 'C-17A GLOBEMASTER III',   type: 'C-17',   nationality: 'US', altitudeFt: 35000, speedKts: 450, mission: 'STRATEGIC PRE-POSITIONING',  status: 'AIRBORNE', note: 'Diego Garcia → Al Udeid — CENTCOM pre-pos ordnance/munitions fwd staging', route: [[72.4,-7.3],[65.0,12.0],[58.0,19.0],[51.3,25.1]], cycleMins: 480, offsetFrac: 0.15 },
  { id: 'falcon-01',  callsign: 'FALCON-01',  nato: 'F-35A LIGHTNING II',      type: 'F-35',   nationality: 'US', altitudeFt: 25000, speedKts: 600, mission: 'COMBAT AIR PATROL',          status: 'AIRBORNE', note: 'N.Red Sea CAP — convoy escort overwatch — weapons free — CAOC control', route: [[35.0,27.0],[38.0,24.5],[41.0,22.0],[38.5,23.5],[35.5,26.0],[35.0,27.0]], cycleMins: 60, offsetFrac: 0.6 },
  { id: 'ghost-01',   callsign: 'GHOST-01',   nato: 'RQ-4B GLOBAL HAWK',       type: 'RQ-4',   nationality: 'US', altitudeFt: 60000, speedKts: 340, mission: 'BROAD AREA ISR / SIGINT',    status: 'AIRBORNE', note: 'Syria-Iraq-Iran ISR — EO/IR/SAR — SIGINT collection — feeds HAWK-I Palantir pipeline', route: [[35.4,37.0],[40.0,35.5],[44.0,34.5],[47.0,35.0],[44.0,37.0],[38.0,37.5],[35.4,37.0]], cycleMins: 180, offsetFrac: 0.85 },
  { id: 'calypso-01', callsign: 'CALYPSO-01', nato: 'P-8A POSEIDON',           type: 'P-8',    nationality: 'AU', altitudeFt: 25000, speedKts: 450, mission: 'ASW / MPA',                  status: 'AIRBORNE', note: 'Indian Ocean ASW — HMAS ANZAC coord — potential IRGC sub threat monitoring', route: [[65.0,10.0],[70.0,8.0],[72.4,12.0],[68.0,15.0],[65.0,10.0]], cycleMins: 150, offsetFrac: 0.45 },
];

// ---------------------------------------------------------------------------
// Military naval vessels
// ---------------------------------------------------------------------------
interface MilitaryVessel {
  id: string; name: string; hull: string; class: string;
  nationality: 'US' | 'UK' | 'FR' | 'AU' | 'CN';
  type: 'DDG' | 'LHD' | 'FFG' | 'CG';
  mission: string; status: 'UNDERWAY' | 'PATROL' | 'ESCORT' | 'STANDBY' | 'MONITORING';
  note: string;
  route: [number, number][]; cycleMins: number; offsetFrac: number;
}

const MILITARY_VESSELS: MilitaryVessel[] = [
  { id: 'uss-bainbridge', name: 'USS BAINBRIDGE',  hull: 'DDG-96', class: 'ARLEIGH BURKE',    nationality: 'US', type: 'DDG', mission: 'MARITIME INTERDICTION', status: 'PATROL',    note: 'Gulf of Aden patrol — Aegis BMD active — convoy overwatch — SM-2 ready — NAVCENT tasked',    route: [[44.9,12.0],[48.0,11.8],[50.5,12.2],[48.0,12.5],[44.9,12.5],[44.9,12.0]], cycleMins: 240, offsetFrac: 0.0 },
  { id: 'uss-bataan',     name: 'USS BATAAN',       hull: 'LHD-5', class: 'WASP CLASS',        nationality: 'US', type: 'LHD', mission: 'AMPHIBIOUS READY GROUP', status: 'STANDBY',  note: 'Red Sea ARG — 2,400 Marines — F-35B/AV-8B air wing — MEU ready for NEO/strike',            route: [[39.5,20.0],[41.5,17.0],[43.0,14.5],[41.5,16.0],[39.5,18.0],[39.5,20.0]], cycleMins: 360, offsetFrac: 0.2 },
  { id: 'hms-diamond',    name: 'HMS DIAMOND',      hull: 'D34',   class: 'TYPE 45 DESTROYER', nationality: 'UK', type: 'DDG', mission: 'MARITIME PATROL / AD',  status: 'PATROL',    note: 'E.Med patrol — Sea Viper AD — Cyprus to Port Said corridor — UKMCC coordination',          route: [[32.3,31.0],[27.0,34.0],[23.0,35.5],[27.0,33.0],[32.3,31.0]], cycleMins: 480, offsetFrac: 0.4 },
  { id: 'hmas-anzac',     name: 'HMAS ANZAC',       hull: 'FFH-150',class: 'ANZAC CLASS',      nationality: 'AU', type: 'FFG', mission: 'ASW / PATROL',          status: 'PATROL',    note: 'Indian Ocean ASW — CALYPSO-01 P-8 coord — counter-piracy — Hormuz approach monitoring',    route: [[63.0,11.0],[67.0,9.0],[70.0,12.0],[66.0,14.0],[63.0,11.0]], cycleMins: 300, offsetFrac: 0.6 },
  { id: 'fns-provence',   name: 'FNS PROVENCE',     hull: 'D652',  class: 'HORIZON CLASS',     nationality: 'FR', type: 'DDG', mission: 'EU NAVFOR ATALANTA',    status: 'PATROL',    note: 'EU NAVFOR Atalanta E.sector — counter-piracy — French HOA patrol zone',                    route: [[48.0,11.5],[51.0,11.8],[53.0,12.2],[50.0,11.7],[48.0,11.5]], cycleMins: 240, offsetFrac: 0.8 },
  { id: 'cns-nanchang',   name: 'CNS NANCHANG',     hull: '101',   class: 'TYPE 055 CRUISER',  nationality: 'CN', type: 'CG',  mission: 'PRESENCE / MONITORING', status: 'MONITORING',note: '⚠ PRC MONITORING — Hormuz transit tracking US/coalition — CAUTION — passive SIGINT posture', route: [[56.5,26.5],[55.0,25.0],[53.5,24.5],[55.0,25.5],[56.5,26.5]], cycleMins: 300, offsetFrac: 0.5 },
];

// ---------------------------------------------------------------------------
// Ground convoys (road + rail)
// ---------------------------------------------------------------------------
interface GroundConvoy {
  id: string; callsign: string; type: 'ROAD' | 'RAIL';
  vehicles: string; nationality: string; cargo: string;
  status: 'MOVING' | 'HALTED' | 'DELAYED' | 'DIVERTED' | 'IMPEDED';
  impactReason?: string; note: string;
  route: [number, number][]; cycleMins: number; offsetFrac: number;
}

const GROUND_CONVOYS: GroundConvoy[] = [
  { id: 'alpha-1',       callsign: 'CONV ALPHA-1',    type: 'ROAD', vehicles: '14x LMTV / 4x MRAP / 1x MEDEVAC', nationality: 'US/KW', cargo: 'Class I/V — 480T military stores',           status: 'MOVING',   note: 'Kuwait → Baghdad BIAP · MSR TAMPA · ARCENT priority · armed escort', route: [[47.93,29.36],[47.0,30.1],[46.2,31.1],[44.36,33.32]], cycleMins: 240, offsetFrac: 0.0 },
  { id: 'charlie-3',     callsign: 'CONV CHARLIE-3',  type: 'ROAD', vehicles: '8x HET / 2x WMI loader', nationality: 'US/JO', cargo: 'Patriot PAC-3 battery components — classified NATO equip', status: 'DELAYED',  impactReason: 'Houthi drone threat assessment — MSR VERT hold at Amman checkpoint', note: 'Aqaba → Amman → Muwaffaq RJAF · DELAYED pending air threat clearance', route: [[35.0,29.5],[35.9,31.95],[36.5,32.5]], cycleMins: 180, offsetFrac: 0.5 },
  { id: 'tango-2',       callsign: 'CONV TANGO-2',    type: 'ROAD', vehicles: '22x WFP 10T trucks', nationality: 'WFP/ET', cargo: 'Humanitarian — 185T food/medical/water purification', status: 'MOVING',   note: 'Djibouti Port → Addis Ababa · WFP humanitarian corridor · CJTF-HOA deconflicted', route: [[43.1,11.6],[41.9,11.8],[41.0,12.5],[38.8,14.3],[38.5,15.5],[38.7,8.9]], cycleMins: 420, offsetFrac: 0.3 },
  { id: 'neom-rail-01',  callsign: 'NEOM RAIL-01',    type: 'RAIL', vehicles: '48 freight wagons', nationality: 'SA', cargo: 'Military logistics — pre-pos stocks for Jeddah hub — 3,200T', status: 'HALTED',   impactReason: 'IRGC GPS spoofing — rail navigation system safety check by MODA directive', note: 'Saudi Land Bridge · HALTED at Tabuk depot · GPS nav verification in progress', route: [[46.7,24.7],[44.5,26.0],[41.5,26.5],[38.5,26.5],[36.6,28.4]], cycleMins: 300, offsetFrac: 0.6 },
  { id: 'cairo-rail-01', callsign: 'CAIRO RAIL-01',   type: 'RAIL', vehicles: '31 container wagons', nationality: 'EG', cargo: 'Diverted Suez transit — 14,100 TEU equivalent',     status: 'DIVERTED', impactReason: 'APT-41 Suez SCADA compromise — canal rail link isolated per EGA security protocol', note: 'Cairo → Ismailia → Suez · DIVERTED to Ain Sokhna alt terminal', route: [[31.25,30.05],[31.8,30.4],[32.26,30.59],[32.55,29.97]], cycleMins: 120, offsetFrac: 0.2 },
  { id: 'delta-2',       callsign: 'CONV DELTA-2',    type: 'ROAD', vehicles: '10x FMTV / 1x wrecker', nationality: 'US/IQ', cargo: 'Class I/III/V — N.Iraq coalition resupply',     status: 'MOVING',   note: 'Baghdad → Kirkuk → Erbil · Northern MSR SWORD · CJTF-OIR resupply', route: [[44.36,33.32],[44.4,35.47],[44.01,36.19]], cycleMins: 180, offsetFrac: 0.7 },
  { id: 'bravo-truck-01',callsign: 'BRAVO TRUCK-01', type: 'ROAD', vehicles: '6x tanker trucks', nationality: 'SA/AE', cargo: 'JP-8 fuel — 360,000L — PSAB / ESKAN resupply',        status: 'MOVING',   note: 'Riyadh → PSAB fuel depot · ARCENT LOGCAP fuel mission', route: [[46.7,24.7],[47.0,24.3],[47.58,24.07]], cycleMins: 90, offsetFrac: 0.1 },
  { id: 'med-convoy-01', callsign: 'MED CONVOY-01',  type: 'ROAD', vehicles: '18x MAN trucks', nationality: 'UK/IT', cargo: 'EU NAVFOR equipment — Djibouti sustainment',            status: 'MOVING',   note: 'Amman → Aqaba Port · EU NAVFOR ATALANTA logistics · British Army coordinated', route: [[35.99,31.72],[35.5,30.5],[35.0,29.5]], cycleMins: 150, offsetFrac: 0.4 },
];

// ---------------------------------------------------------------------------
// Supply chain nodes — ports, airports, depots
// ---------------------------------------------------------------------------
interface SupplyChainNode {
  id: string; name: string; short: string;
  type: 'PORT' | 'AIRPORT' | 'DEPOT';
  lat: number; lng: number; throughput: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'DISRUPTED' | 'HOSTILE';
  note: string;
}

const SUPPLY_CHAIN_NODES: SupplyChainNode[] = [
  { id: 'jeddah-port',   name: 'Jeddah Islamic Port',          short: 'JEDDAH PORT',  type: 'PORT',    lng: 39.15, lat: 21.46, throughput: '5.3M TEU/yr', status: 'DEGRADED',     note: 'Diverted vessel overflow — +23% surge above nominal capacity' },
  { id: 'aden-port',     name: 'Aden Container Terminal',       short: 'ADEN PORT',    type: 'PORT',    lng: 44.97, lat: 12.77, throughput: '0 — SUSPENDED',status: 'DISRUPTED',   note: 'Houthi controlled AOR — all commercial traffic suspended' },
  { id: 'djibouti-port', name: 'Djibouti Port',                 short: 'DJIB PORT',    type: 'PORT',    lng: 43.13, lat: 11.59, throughput: '78% MIL',      status: 'DEGRADED',    note: 'CJTF-HOA surge — 78% military traffic — commercial queuing' },
  { id: 'kuwait-port',   name: 'Al-Shuwaikh Port Kuwait',       short: 'KUWAIT PORT',  type: 'PORT',    lng: 47.94, lat: 29.35, throughput: 'ARCENT PREPO',  status: 'OPERATIONAL', note: 'NATO POMCUS pre-pos loading — ARCENT LOGCAP active' },
  { id: 'jebel-ali',     name: 'Dubai Jebel Ali',               short: 'JEBEL ALI',    type: 'PORT',    lng: 55.02, lat: 24.98, throughput: '22K TEU/day',   status: 'OPERATIONAL', note: "World's largest container port — absorbing Red Sea overflow cargo" },
  { id: 'cairo-apt',     name: 'Cairo International Airport',   short: "CAIRO INT'L",  type: 'AIRPORT', lng: 31.41, lat: 30.12, throughput: 'DEGRADED',      status: 'DEGRADED',    note: 'APT-41 SCADA risk — restricted to verified cargo operators only' },
  { id: 'baghdad-apt',   name: 'Baghdad BIAP',                  short: 'BIAP',         type: 'AIRPORT', lng: 44.23, lat: 33.26, throughput: '14 C-17/day',   status: 'OPERATIONAL', note: 'Coalition airlift hub — C-17/C-130 surge ops active' },
  { id: 'erbil-apt',     name: 'Erbil International Airport',   short: "ERBIL INT'L",  type: 'AIRPORT', lng: 44.01, lat: 36.23, throughput: '6 C-130/day',   status: 'OPERATIONAL', note: 'Kurdistan coalition hub — CJTF-OIR northern logistics terminus' },
  { id: 'amman-apt',     name: 'Amman Queen Alia (QAIA)',        short: 'AMMAN QAIA',   type: 'AIRPORT', lng: 35.99, lat: 31.72, throughput: 'PREPO ACTIVE',  status: 'OPERATIONAL', note: 'Jordan transit hub — US prepo agreement — Patriot battery staging' },
  { id: 'muscat-apt',    name: 'Muscat International Airport',  short: "MUSCAT INT'L", type: 'AIRPORT', lng: 58.28, lat: 23.60, throughput: 'ACTIVE',        status: 'OPERATIONAL', note: 'AFCENT logistics node — Thumrait/Masirah support ops' },
  { id: 'haifa-port',    name: 'Haifa Port',                    short: 'HAIFA PORT',   type: 'PORT',    lng: 34.99, lat: 32.83, throughput: 'PREPO ACTIVE',  status: 'OPERATIONAL', note: 'IDF logistics — US prepo maritime agreement — strategic stockpile' },
  { id: 'latakia-port',  name: 'Latakia Port (RU/Syria)',        short: 'LATAKIA',      type: 'PORT',    lng: 35.81, lat: 35.52, throughput: 'RUSSIAN VMF',   status: 'HOSTILE',     note: '⚠ HOSTILE — Russian naval support base — VMF logistics — ELINT monitored' },
  { id: 'ain-sokhna',    name: 'Ain Sokhna Port (Egypt)',        short: 'AIN SOKHNA',   type: 'PORT',    lng: 32.34, lat: 29.58, throughput: 'SURGE ACTIVE',  status: 'DEGRADED',    note: 'Suez canal backup port — absorbing diverted cargo from APT-41 cyber incident' },
  { id: 'salalah-port',  name: 'Salalah Port (Oman)',            short: 'SALALAH',      type: 'PORT',    lng: 54.00, lat: 16.95, throughput: '4.1M TEU/yr',   status: 'OPERATIONAL', note: 'Strategic Indian Ocean hub — receiving diverted Indian Ocean traffic' },
];

// ---------------------------------------------------------------------------
// Ground logistics routes (rail + road MSRs)
// ---------------------------------------------------------------------------
interface LogisticsRoute {
  id: string; name: string; routeId: string; type: 'ROAD' | 'RAIL';
  path: [number, number][];
  status: 'ACTIVE' | 'DEGRADED' | 'HALTED' | 'DIVERTED';
  color: [number, number, number, number]; width: number;
  labelLng: number; labelLat: number;
}

const LOGISTICS_ROUTES: LogisticsRoute[] = [
  { id: 'saudi-rail',   name: 'Saudi Land Bridge Rail', routeId: 'KSA-RAIL-001 / NEOM LINK', type: 'RAIL', status: 'HALTED',   path: [[46.7,24.7],[44.5,26.0],[41.5,26.5],[38.5,26.5],[36.6,28.4]],                         color: [255,140,0,110],   width: 2, labelLng: 42.0, labelLat: 26.3 },
  { id: 'kuwait-msrn',  name: 'Kuwait–Riyadh MSR',      routeId: 'MSR TAMPA / KU-SA-001',    type: 'ROAD', status: 'ACTIVE',   path: [[47.93,29.36],[47.5,28.0],[47.0,26.5],[46.7,24.7]],                                   color: [200,180,20,90],   width: 2, labelLng: 47.3, labelLat: 27.2 },
  { id: 'jordan-msrn',  name: 'Jordan MSR North',        routeId: 'MSR VERT / JO-001',         type: 'ROAD', status: 'DEGRADED', path: [[35.0,29.5],[35.9,31.95],[36.0,33.5],[37.5,34.5]],                                   color: [200,150,20,80],   width: 2, labelLng: 35.9, labelLat: 31.5 },
  { id: 'egypt-rail',   name: 'Cairo–Suez Rail',          routeId: 'EG-RAIL-002 / CAIRO EAST', type: 'RAIL', status: 'DIVERTED', path: [[31.25,30.05],[31.8,30.4],[32.26,30.59],[32.55,29.97]],                               color: [255,100,0,110],   width: 2, labelLng: 31.9, labelLat: 30.3 },
  { id: 'djib-eth',     name: 'Djibouti–Ethiopia Road',   routeId: 'MSR ADDIS / WFP-001',      type: 'ROAD', status: 'ACTIVE',   path: [[43.1,11.6],[41.9,11.8],[41.0,12.5],[38.8,14.3],[38.5,15.5],[38.7,8.9]],               color: [0,200,100,70],    width: 2, labelLng: 40.5, labelLat: 12.8 },
  { id: 'iraq-msrn',    name: 'Iraq MSR North',           routeId: 'MSR SWORD / IQ-001',        type: 'ROAD', status: 'ACTIVE',   path: [[47.3,30.0],[46.2,31.1],[44.36,33.32],[44.4,35.47],[44.01,36.19]],                    color: [200,180,20,70],   width: 2, labelLng: 44.6, labelLat: 33.5 },
  { id: 'turkey-rail',  name: 'Turkish Rail Corridor',    routeId: 'NATO-RAIL-TK-001',          type: 'RAIL', status: 'ACTIVE',   path: [[35.4,37.0],[31.0,38.5],[28.0,40.0],[29.0,41.0]],                                     color: [200,150,0,70],    width: 2, labelLng: 30.0, labelLat: 39.5 },
  { id: 'oman-msrn',    name: 'Oman MSR / Strait Approach',routeId: 'MSR FALCON-OMAN / OM-001', type: 'ROAD', status: 'ACTIVE',   path: [[54.0,17.7],[56.0,20.0],[57.5,22.5],[58.6,23.6],[58.9,20.7]],                        color: [180,120,0,70],    width: 2, labelLng: 57.0, labelLat: 21.5 },
];

// ---------------------------------------------------------------------------
// Air corridors
// ---------------------------------------------------------------------------
interface AirCorridor {
  id: string; name: string; corridorId: string;
  path: [number, number][];
  color: [number, number, number, number]; labelLng: number; labelLat: number;
}

const AIR_CORRIDORS: AirCorridor[] = [
  { id: 'airlift-alpha',   name: 'Airlift Corridor Alpha',    corridorId: 'ALC ALPHA / AUAB→CLJ',     path: [[51.3,25.1],[55.0,22.0],[50.0,16.0],[43.1,11.6]],          color: [0,180,255,35],    labelLng: 50.5, labelLat: 19.5 },
  { id: 'patrol-bravo',    name: 'Patrol Corridor Bravo',     corridorId: 'PATROL BRAVO / DGA→TRH',   path: [[54.5,24.2],[56.0,22.0],[57.0,20.0],[54.0,17.7]],          color: [0,160,220,30],    labelLng: 56.0, labelLat: 21.0 },
  { id: 'isr-charlie',     name: 'ISR Corridor Charlie',       corridorId: 'ISR CHARLIE / AKTRI→RED SEA', path: [[33.0,34.6],[32.3,31.2],[34.0,27.0],[37.0,21.0]],      color: [160,100,255,30],  labelLng: 34.0, labelLat: 28.5 },
  { id: 'strategic-delta', name: 'Strategic Corridor Delta',   corridorId: 'STRAT DELTA / DG→AUAB',   path: [[72.4,-7.3],[65.0,12.0],[58.0,19.0],[51.3,25.1]],          color: [0,120,200,25],    labelLng: 63.0, labelLat: 10.0 },
  { id: 'med-corridor',    name: 'Mediterranean Air Bridge',   corridorId: 'MED BRIDGE / AKTRI→PSAB',  path: [[33.0,34.6],[35.9,31.7],[38.0,28.0],[42.0,26.0],[47.6,24.1]], color: [100,160,255,25], labelLng: 38.0, labelLat: 29.0 },
];

// Supply chain impact arcs per demo scene — arcs show disruption flow from incident to affected nodes
const SC_IMPACTS: Record<number, {
  arcs: Array<{ from: [number, number]; to: [number, number]; label: string; color: [number, number, number, number]; width: number }>;
  zones: Array<{ lng: number; lat: number; radiusKm: number; label: string; color: [number, number, number, number]; cargoAtRisk: string; delay: string }>;
}> = {
  2: {
    arcs: [
      { from: [43.5, 12.7], to: [32.3, 31.2], label: 'CONVOY-BRAVO → SUEZ blocked', color: [255, 60, 30, 160], width: 3 },
      { from: [43.2, 12.3], to: [43.1, 11.6], label: 'Traffic diverted → Djibouti', color: [255, 160, 0, 140], width: 2 },
      { from: [43.2, 12.3], to: [25.0, -15.0], label: 'Cape of Good Hope reroute', color: [255, 140, 0, 120], width: 2 },
    ],
    zones: [
      { lng: 43.2, lat: 12.4, radiusKm: 55, label: 'BAB-EL-MANDEB THREAT ZONE', color: [255, 30, 60, 80], cargoAtRisk: '$5.1B/day', delay: '72-96h' },
    ],
  },
  3: {
    arcs: [
      { from: [43.55, 12.75], to: [32.3, 31.2], label: 'ASBM impact on SUEZ transit', color: [255, 40, 20, 180], width: 4 },
      { from: [43.55, 12.75], to: [14.8, 42.95], label: 'Houthi launch origin', color: [255, 100, 0, 120], width: 2 },
      { from: [43.2, 12.3], to: [25.0, -15.0], label: 'Emergency cape reroute', color: [255, 140, 0, 130], width: 3 },
      { from: [43.5, 12.7], to: [21.5, 39.2], label: 'UNIT-DELTA resupply delay', color: [255, 180, 0, 130], width: 2 },
    ],
    zones: [
      { lng: 43.55, lat: 12.75, radiusKm: 30, label: 'ASBM IMPACT ZONE', color: [255, 20, 40, 100], cargoAtRisk: '$2.3B', delay: '120h' },
      { lng: 43.2, lat: 12.4, radiusKm: 65, label: 'MARITIME EXCLUSION ZONE', color: [255, 60, 0, 60], cargoAtRisk: '$5.1B/day', delay: '96h' },
    ],
  },
  4: {
    arcs: [
      { from: [32.28, 31.26], to: [28.0, 33.5], label: 'Canal blockage → Med halted', color: [255, 100, 0, 160], width: 4 },
      { from: [32.28, 31.26], to: [25.0, -15.0], label: 'Vessels rerouting Cape', color: [255, 140, 0, 130], width: 3 },
      { from: [32.28, 31.26], to: [43.1, 11.6], label: 'Southbound queue halted', color: [255, 60, 0, 130], width: 2 },
      { from: [32.28, 31.26], to: [18.5, -34.0], label: 'Cape Town diversion hub', color: [255, 160, 0, 110], width: 2 },
    ],
    zones: [
      { lng: 32.28, lat: 31.26, radiusKm: 20, label: 'APT-41 SCADA ATTACK — SUEZ', color: [255, 100, 0, 100], cargoAtRisk: '$9.4B/day', delay: '48-96h' },
      { lng: 32.3, lat: 30.0,  radiusKm: 40, label: 'CANAL QUEUE — 47 VESSELS', color: [255, 160, 0, 60], cargoAtRisk: '$47B blocked', delay: '72h+' },
    ],
  },
  5: {
    arcs: [
      { from: [32.27, 30.58], to: [32.3, 31.2], label: 'Power failure → Canal dark', color: [255, 80, 0, 160], width: 3 },
      { from: [32.28, 31.26], to: [25.0, -15.0], label: 'Emergency cape reroute', color: [255, 140, 0, 130], width: 3 },
      { from: [32.27, 30.58], to: [55.0, 25.0], label: 'UAE port overflow', color: [255, 160, 0, 110], width: 2 },
    ],
    zones: [
      { lng: 32.27, lat: 30.58, radiusKm: 15, label: 'DNP3 POWER GRID ATTACK', color: [255, 80, 0, 100], cargoAtRisk: '$3.1B/day', delay: '24-48h' },
      { lng: 32.28, lat: 31.26, radiusKm: 25, label: 'SUEZ — SECONDARY BLOCKAGE RISK', color: [255, 120, 0, 70], cargoAtRisk: '$9.4B/day', delay: '48h+' },
    ],
  },
  6: {
    arcs: [
      { from: [43.9, 12.6], to: [43.1, 11.6], label: 'GPS deviated → Djibouti emergency', color: [160, 80, 255, 160], width: 3 },
      { from: [12.9, 43.7], to: [43.9, 12.6], label: 'IRGC spoofing source', color: [255, 60, 0, 140], width: 2 },
    ],
    zones: [
      { lng: 43.7, lat: 12.7, radiusKm: 80, label: 'IRGC GPS SPOOFING ZONE', color: [160, 60, 255, 70], cargoAtRisk: 'NAV COMPROMISED', delay: '6-12h deviation' },
    ],
  },
  7: {
    arcs: [
      { from: [43.55, 12.75], to: [32.3, 31.2], label: 'CONVOY-BRAVO → SUEZ', color: [255, 40, 20, 160], width: 3 },
      { from: [32.28, 31.26], to: [25.0, -15.0], label: 'Cape reroute active', color: [255, 140, 0, 120], width: 2 },
      { from: [43.2, 12.3], to: [43.1, 11.6], label: 'Djibouti diversion', color: [255, 160, 0, 110], width: 2 },
      { from: [43.55, 12.75], to: [21.5, 39.2], label: 'UNIT-DELTA critical supply', color: [0, 200, 100, 140], width: 3 },
      { from: [32.3, 31.1], to: [55.0, 25.0], label: 'UAE fallback logistics', color: [0, 180, 220, 120], width: 2 },
    ],
    zones: [
      { lng: 43.2, lat: 12.4, radiusKm: 55, label: 'BAB-EL-MANDEB CLOSURE', color: [255, 30, 60, 80], cargoAtRisk: '$5.1B/day', delay: '72h' },
      { lng: 32.28, lat: 31.26, radiusKm: 20, label: 'SUEZ CYBER ATTACK', color: [255, 100, 0, 80], cargoAtRisk: '$9.4B/day', delay: '48h' },
    ],
  },
  // ── SCENE 8: CDR Approves COA-001 / COA-002 — escort + CNO team ──────────
  8: {
    arcs: [
      { from: [43.35, 12.4],  to: [43.9, 12.6],  label: 'USS CARNEY: hard escort → CONVOY-BRAVO',         color: [0, 255, 136, 200], width: 3 },
      { from: [43.9, 12.6],   to: [32.3, 31.2],  label: 'CONVOY-BRAVO: escort corridor ACTIVE',             color: [0, 220, 100, 160], width: 4 },
      { from: [51.3, 25.1],   to: [43.1, 11.6],  label: 'EAGLE-01 C-17: Al Udeid → Djibouti airlift',      color: [0, 180, 255, 160], width: 2 },
      { from: [43.1, 11.6],   to: [21.5, 39.2],  label: 'Emergency stores: Djibouti → UNIT-FOXTROT',       color: [0, 200, 255, 120], width: 2 },
      { from: [32.27, 30.58], to: [32.28, 31.26],label: 'CNO team: SUEZ SCADA — APT-41 eviction',          color: [100, 200, 255, 140],width: 2 },
    ],
    zones: [
      { lng: 43.9, lat: 12.6, radiusKm: 28, label: 'CDR APPROVED: HARD ESCORT ACTIVE', color: [0, 220, 100, 80], cargoAtRisk: 'PROTECTED', delay: 'MITIGATED' },
      { lng: 51.3, lat: 25.1, radiusKm: 15, label: 'EAGLE-01: AIRBORNE / ENROUTE',     color: [0, 160, 255, 60], cargoAtRisk: '180T stores', delay: '4H ETA' },
    ],
  },
  // ── SCENE 9: Canal restored — air bridge active ───────────────────────────
  9: {
    arcs: [
      { from: [32.28, 31.26], to: [28.0, 33.5], label: 'VSL-004: Suez canal transit RESUMED',              color: [0, 255, 136, 180], width: 3 },
      { from: [32.28, 31.26], to: [32.3, 30.0], label: 'Canal queue CLEARING — APT-41 EVICTED',            color: [0, 220, 100, 140], width: 2 },
      { from: [51.3, 25.1],   to: [43.1, 11.6], label: 'EAGLE-01: arriving Djibouti',                      color: [0, 180, 255, 160], width: 2 },
      { from: [46.7, 24.7],   to: [39.2, 21.5], label: 'NEOM RAIL ALT: Riyadh → Jeddah activated',        color: [200, 160, 0, 130],  width: 2 },
      { from: [43.9, 12.6],   to: [32.3, 31.2], label: 'CONVOY-BRAVO: escort corridor in transit',         color: [0, 220, 100, 140], width: 3 },
      { from: [43.1, 11.6],   to: [21.5, 39.2], label: 'Emergency stores: DELIVERED to UNIT-FOXTROT',     color: [0, 255, 136, 120], width: 2 },
    ],
    zones: [
      { lng: 32.28, lat: 31.26, radiusKm: 20, label: 'SUEZ: APT-41 EVICTED — RESTORING', color: [0, 200, 100, 60], cargoAtRisk: 'RESUMING', delay: 'T+4H' },
      { lng: 43.1,  lat: 11.6,  radiusKm: 18, label: 'DJIBOUTI: EAGLE-01 OFFLOAD ACTIVE',color: [0, 160, 255, 50], cargoAtRisk: '180T stores',delay: 'DELIVERED' },
    ],
  },
  // ── SCENE 10: Theater stabilization — supply chain status ──────────────────
  10: {
    arcs: [
      { from: [43.15, 12.35], to: [32.3, 31.2],  label: 'Red Sea SLOC RS-001: FULLY CLEARED',              color: [0, 255, 136, 170], width: 4 },
      { from: [51.3, 25.1],   to: [43.1, 11.6],  label: 'Air Bridge ALPHA: OPERATIONAL 24/7',               color: [0, 180, 255, 160], width: 3 },
      { from: [46.7, 24.7],   to: [39.2, 21.5],  label: 'Saudi Land Bridge Rail: ALT ROUTE ACTIVE',         color: [200, 160, 0, 140], width: 2 },
      { from: [43.9, 12.6],   to: [32.3, 31.2],  label: 'CONVOY-BRAVO: SUEZ approach — ETA 8H',             color: [0, 220, 100, 160], width: 3 },
      { from: [47.93, 29.36], to: [44.36, 33.32], label: 'MSR TAMPA: Kuwait → Baghdad CLEAR',               color: [200, 200, 0, 110],  width: 2 },
      { from: [32.28, 31.26], to: [22.0, 35.0],  label: 'MED SLOC: Suez → Gibraltar RESUMED',              color: [0, 200, 255, 130], width: 2 },
    ],
    zones: [
      { lng: 37.0, lat: 22.0, radiusKm: 140, label: 'THEATER: SUPPLY CHAIN RESTORED', color: [0, 200, 100, 20], cargoAtRisk: 'PROTECTED', delay: 'NOMINAL' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Ontological provenance matching
// ---------------------------------------------------------------------------

interface OntologyHit {
  objectType: string;
  pk:         string;
  label:      string;
  icon:       string;
  color:      string;
  detail:     string;
  url:        string;
}

function getTrackProvenance(
  track: DemoTrackUpdate,
  sigintItems: DemoSigintItem[],
  isrItems:    DemoIsrItem[],
  humintItems: DemoHumintItem[],
  aisItems:    DemoAisItem[],
  iocItems:    DemoIocItem[],
): OntologyHit[] {
  const hits: OntologyHit[] = [];
  const id    = track.id.toLowerCase();
  const label = track.label.toLowerCase();
  const trackKeywords = [id, label, ...label.split('-').filter(p => p.length > 2)];
  const matchesAny = (str: string) =>
    trackKeywords.some(kw => str.toLowerCase().includes(kw));

  if (track.type === 'hostile' || track.type === 'unknown') {
    for (const s of sigintItems) {
      const refStr = `${s.associatedThreatId ?? ''} ${s.pk} ${s.frequency ?? ''} ${s.signalType ?? ''}`;
      if ((matchesAny(refStr) || track.type === 'hostile') && hits.filter(h => h.objectType === 'SigintIntercept').length < 2) {
        hits.push({ objectType: 'SigintIntercept', pk: s.pk, label: `${s.signalType ?? 'SIGINT'} ${s.frequency ? `@ ${s.frequency}` : ''}`, icon: '📡', color: '#a78bfa', detail: `${s.classification ?? 'CLASSIFIED'} · ${s.location ?? ''}`, url: foundryLink('SigintIntercept', s.pk) });
      }
    }
    for (const h of humintItems) {
      const refStr = `${h.relatedThreatId ?? ''} ${h.pk} ${h.sourceId ?? ''} ${h.summary ?? ''}`;
      if ((matchesAny(refStr) || hits.length < 2) && hits.filter(x => x.objectType === 'HumintReport').length < 1) {
        hits.push({ objectType: 'HumintReport', pk: h.pk, label: h.sourceId ? `SRC: ${h.sourceId}` : h.pk, icon: '🕵️', color: '#fb923c', detail: h.summary?.slice(0, 60) ?? 'HUMINT REPORT', url: foundryLink('HumintReport', h.pk) });
      }
    }
    for (const ioc of iocItems) {
      if (hits.filter(x => x.objectType === 'CyberIoc').length < 2) {
        hits.push({ objectType: 'CyberIoc', pk: ioc.pk, label: ioc.indicatorType ? `${ioc.indicatorType}: ${ioc.indicatorValue?.slice(0, 20) ?? ioc.pk}` : ioc.pk, icon: '🔴', color: '#f43f5e', detail: ioc.attribution ?? 'IOC INDICATOR', url: foundryLink('CyberIoc', ioc.pk) });
      }
    }
  }
  if (track.type === 'friendly' || track.type === 'neutral' || track.type === 'unknown') {
    for (const a of aisItems) {
      const refStr = `${a.linkedVesselId ?? ''} ${a.pk} ${a.mmsi ?? ''} ${a.vesselName ?? ''}`;
      if ((matchesAny(refStr) || hits.length < 2) && hits.filter(x => x.objectType === 'MaritimeAisTrack').length < 2) {
        hits.push({ objectType: 'MaritimeAisTrack', pk: a.pk, label: a.vesselName ? `${a.vesselName} (MMSI:${a.mmsi ?? '?'})` : a.pk, icon: '📍', color: '#22d3ee', detail: a.navStatus ?? 'AIS TRACK', url: foundryLink('MaritimeAisTrack', a.pk) });
      }
    }
    for (const isr of isrItems) {
      if ((matchesAny(`${isr.targetVesselId ?? ''} ${isr.pk}`) || hits.length < 3) && hits.filter(x => x.objectType === 'IsrImagery').length < 1) {
        hits.push({ objectType: 'IsrImagery', pk: isr.pk, label: `${isr.sensorType ?? 'ISR'} ${isr.resolution ? `@ ${isr.resolution}` : ''}`, icon: '🛰️', color: '#34d399', detail: isr.classification ?? 'ISR IMAGERY', url: foundryLink('IsrImagery', isr.pk) });
      }
    }
  }
  return hits.slice(0, 5);
}

function getThreatProvenance(
  threat: DemoCyberThreat,
  sigintItems: DemoSigintItem[],
  iocItems:    DemoIocItem[],
  humintItems: DemoHumintItem[],
): OntologyHit[] {
  const hits: OntologyHit[] = [];
  const ip  = threat.ip?.toLowerCase() ?? '';
  const att = threat.attacker?.toLowerCase() ?? '';
  for (const ioc of iocItems) {
    const refStr = `${ioc.indicatorValue ?? ''} ${ioc.attribution ?? ''} ${ioc.pk}`.toLowerCase();
    if ((refStr.includes(ip) || refStr.includes(att) || hits.length < 2) && hits.filter(h => h.objectType === 'CyberIoc').length < 3) {
      hits.push({ objectType: 'CyberIoc', pk: ioc.pk, label: ioc.indicatorType ? `${ioc.indicatorType}: ${ioc.indicatorValue?.slice(0, 20) ?? ioc.pk}` : ioc.pk, icon: '🔴', color: '#f43f5e', detail: ioc.attribution ?? 'IOC INDICATOR', url: foundryLink('CyberIoc', ioc.pk) });
    }
  }
  for (const s of sigintItems) {
    if (hits.filter(h => h.objectType === 'SigintIntercept').length < 1) {
      hits.push({ objectType: 'SigintIntercept', pk: s.pk, label: `${s.signalType ?? 'SIGINT'} ${s.frequency ? `@ ${s.frequency}` : ''}`, icon: '📡', color: '#a78bfa', detail: `${s.classification ?? 'CLASSIFIED'} · ${s.location ?? ''}`, url: foundryLink('SigintIntercept', s.pk) });
    }
  }
  for (const h of humintItems) {
    if (hits.filter(x => x.objectType === 'HumintReport').length < 1) {
      hits.push({ objectType: 'HumintReport', pk: h.pk, label: h.sourceId ? `SRC: ${h.sourceId}` : h.pk, icon: '🕵️', color: '#fb923c', detail: h.summary?.slice(0, 60) ?? 'HUMINT REPORT', url: foundryLink('HumintReport', h.pk) });
    }
  }
  return hits.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Main DeckGL map component
// ---------------------------------------------------------------------------

function DeckGLMap() {
  const { demoState } = useDemo();
  const { data: shodanResponse } = useListShodanThreats(undefined, { query: { enabled: true, refetchInterval: 30000 } });

  const [viewState, setViewState] = useState<Record<string, unknown>>(INITIAL_VIEW_STATE);
  const prevSceneRef  = useRef(0);
  const mountedMs     = useRef(Date.now());   // guard against Mapbox default-center overwrite on init
  const [pulsePhase, setPulsePhase] = useState(0);

  const [hoverInfo, setHoverInfo] = useState<{
    object: DemoTrackUpdate | DemoCyberThreat | ShodanThreat | AmbientVessel | Chokepoint;
    x: number; y: number;
    layerId: string;
  } | null>(null);

  const [hoveredAmbient, setHoveredAmbient] = useState<AmbientVessel | null>(null);
  const [hoveredChokepoint, setHoveredChokepoint] = useState<Chokepoint | null>(null);
  const [hoveredBase, setHoveredBase] = useState<MilitaryBase | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredAircraft,   setHoveredAircraft]   = useState<MovingAircraft | null>(null);
  const [hoveredMilVessel,  setHoveredMilVessel]  = useState<MilitaryVessel | null>(null);
  const [hoveredConvoy,     setHoveredConvoy]     = useState<GroundConvoy | null>(null);
  const [hoveredSupplyNode, setHoveredSupplyNode] = useState<SupplyChainNode | null>(null);

  const flyTo = useCallback((lat: number, lng: number, zoom: number, pitch: number, bearing: number) => {
    setViewState({
      latitude: lat, longitude: lng, zoom, pitch, bearing,
      transitionDuration: 2800,
      transitionInterpolator: new FlyToInterpolator({ speed: 1.2 }),
    });
  }, []);

  useEffect(() => {
    if (demoState.currentScene !== prevSceneRef.current && demoState.currentScene > 0 && demoState.mapTarget) {
      prevSceneRef.current = demoState.currentScene;
      const { lat, lng, zoom, pitch, bearing } = demoState.mapTarget;
      flyTo(lat, lng, zoom, pitch, bearing);
    }
  }, [demoState.currentScene, demoState.mapTarget, flyTo]);

  // Animate pulse for disruption zones
  useEffect(() => {
    if (!demoState.running && !demoState.complete) return;
    let id: ReturnType<typeof requestAnimationFrame>;
    const tick = () => {
      setPulsePhase(p => (p + 0.02) % (Math.PI * 2));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [demoState.running, demoState.complete]);

  const demoTracks  = demoState.trackUpdates;
  const demoThreats = demoState.cyberThreats;
  const staticThreats = (!demoState.running && !demoState.complete) ? (shodanResponse?.results ?? []) : [];
  const cyberPoints   = demoState.running || demoState.complete ? demoThreats : staticThreats;

  const currentScene = demoState.currentScene;
  const scImpact = (demoState.running || demoState.complete) ? (SC_IMPACTS[currentScene] ?? null) : null;

  const layers = useMemo(() => {
    const pulse = 0.5 + 0.5 * Math.sin(pulsePhase);
    const allLayers = [];

    // ── 1. Shipping lanes ──
    allLayers.push(
      new PathLayer<ShippingLane>({
        id: 'shipping-lanes',
        data: SHIPPING_LANES,
        pickable: false,
        widthMinPixels: 1, widthMaxPixels: 5,
        getPath: d => d.path,
        getColor: d => d.color,
        getWidth: d => d.width,
        getDashArray: d => d.isDashed ? [8, 6] : [0, 0],
        dashJustified: true,
        parameters: { depthTest: false },
      })
    );

    // ── 2. Supply chain impact arcs (demo only) ──
    if (scImpact && scImpact.arcs.length > 0) {
      allLayers.push(
        new ArcLayer({
          id: 'sc-impact-arcs',
          data: scImpact.arcs,
          pickable: false,
          getSourcePosition: (d: any) => d.from,
          getTargetPosition: (d: any) => d.to,
          getSourceColor: (d: any) => d.color,
          getTargetColor: (d: any) => [d.color[0], d.color[1], d.color[2], Math.max(40, d.color[3] - 80)],
          getWidth: (d: any) => d.width,
          widthMinPixels: 1,
          widthMaxPixels: 6,
          greatCircle: true,
          parameters: { depthTest: false },
        })
      );
    }

    // ── 3. Disruption zone rings (demo only, pulsing) ──
    if (scImpact && scImpact.zones.length > 0) {
      const pulsedZones = scImpact.zones.flatMap(z => [
        { ...z, radiusKm: z.radiusKm * 1000, opacity: 90 + Math.floor(pulse * 60) },
        { ...z, radiusKm: z.radiusKm * 1000 * 1.4, opacity: 30 + Math.floor(pulse * 30) },
      ]);
      allLayers.push(
        new ScatterplotLayer({
          id: 'disruption-zones',
          data: pulsedZones,
          pickable: false,
          opacity: 1,
          stroked: true,
          filled: true,
          radiusMinPixels: 2, radiusMaxPixels: 400,
          lineWidthMinPixels: 1, lineWidthMaxPixels: 3,
          getPosition: (d: any) => [d.lng, d.lat],
          getRadius: (d: any) => d.radiusKm,
          getFillColor: (d: any) => [d.color[0], d.color[1], d.color[2], Math.floor(d.opacity * 0.18)],
          getLineColor: (d: any) => [d.color[0], d.color[1], d.color[2], d.opacity],
          getLineWidth: 800,
          parameters: { depthTest: false },
          updateTriggers: { getFillColor: [pulsePhase], getLineColor: [pulsePhase] },
        })
      );
    }

    // ── 4. Ambient commercial vessels (always visible) ──
    allLayers.push(
      new ScatterplotLayer<AmbientVessel>({
        id: 'ambient-vessels',
        data: AMBIENT_VESSELS,
        pickable: true,
        opacity: 0.75, stroked: true, filled: true,
        radiusMinPixels: 2, radiusMaxPixels: 8, lineWidthMinPixels: 1,
        getPosition: d => [d.lng, d.lat],
        getRadius: 500,
        getFillColor: d => d.type === 'tanker' ? [100, 200, 255, 180] : d.type === 'container' ? [80, 180, 255, 160] : d.type === 'bulk' ? [140, 160, 200, 160] : [120, 170, 220, 160],
        getLineColor: [200, 230, 255, 100],
        onHover: info => {
          if (info.object) {
            setHoveredAmbient(info.object as AmbientVessel);
            setHoveredChokepoint(null); setHoveredBase(null);
            setHoveredAircraft(null); setHoveredMilVessel(null); setHoveredConvoy(null); setHoveredSupplyNode(null);
            setHoverPos({ x: info.x, y: info.y });
          } else if (hoveredAmbient) {
            setHoveredAmbient(null);
            setHoverPos(null);
          }
        },
      })
    );

    // ── 5. Chokepoints (always visible) ──
    allLayers.push(
      new ScatterplotLayer<Chokepoint>({
        id: 'chokepoints-fill',
        data: CHOKEPOINTS,
        pickable: true,
        opacity: 0.9, stroked: true, filled: true,
        radiusMinPixels: 3, radiusMaxPixels: 14, lineWidthMinPixels: 1,
        getPosition: d => [d.lng, d.lat],
        getRadius: d => d.type === 'strategic' ? 1800 : 900,
        getFillColor: d => d.isHostile ? [255, 30, 60, 60] : d.type === 'strategic' ? [255, 200, 0, 40] : [0, 180, 220, 40],
        getLineColor: d => d.isHostile ? [255, 30, 60, 220] : d.type === 'strategic' ? [255, 200, 0, 200] : [0, 180, 220, 160],
        getLineWidth: 400,
        onHover: info => {
          if (info.object) {
            setHoveredChokepoint(info.object as Chokepoint);
            setHoveredAmbient(null); setHoveredBase(null);
            setHoveredAircraft(null); setHoveredMilVessel(null); setHoveredConvoy(null); setHoveredSupplyNode(null);
            setHoverPos({ x: info.x, y: info.y });
          } else if (hoveredChokepoint) {
            setHoveredChokepoint(null);
            setHoverPos(null);
          }
        },
      })
    );

    // Chokepoint labels
    allLayers.push(
      new TextLayer<Chokepoint>({
        id: 'chokepoint-labels',
        data: CHOKEPOINTS.filter(c => c.type === 'strategic'),
        pickable: false,
        getPosition: d => [d.lng, d.lat + 0.6],
        getText: d => d.short,
        getColor: d => d.isHostile ? [255, 60, 60, 220] : [255, 200, 0, 200],
        getSize: 11,
        fontFamily: 'monospace',
        fontWeight: 'bold',
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'bottom',
        billboard: true,
        parameters: { depthTest: false },
      })
    );

    // ── 6. Shipping lane route ID labels ──
    allLayers.push(
      new TextLayer<ShippingLane>({
        id: 'lane-route-labels',
        data: SHIPPING_LANES,
        pickable: false,
        getPosition: d => [d.labelLng, d.labelLat],
        getText: d => d.routeId,
        getColor: d => [d.color[0], d.color[1], d.color[2], 160],
        getSize: 9,
        fontFamily: 'monospace',
        fontWeight: 'bold',
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        billboard: true,
        parameters: { depthTest: false },
      })
    );

    // ── 7. Military base outer ring (glow) ──
    allLayers.push(
      new ScatterplotLayer<MilitaryBase>({
        id: 'base-glow',
        data: MILITARY_BASES,
        pickable: false,
        opacity: 0.5, stroked: true, filled: true,
        radiusMinPixels: 5, radiusMaxPixels: 22, lineWidthMinPixels: 1,
        getPosition: d => [d.lng, d.lat],
        getRadius: 1600,
        getFillColor: d => { const c = BASE_NATION_COLORS[d.nation] ?? [200,200,200,200]; return [c[0], c[1], c[2], 18]; },
        getLineColor: d => { const c = BASE_NATION_COLORS[d.nation] ?? [200,200,200,200]; return [c[0], c[1], c[2], 80]; },
        getLineWidth: 300,
        parameters: { depthTest: false },
      })
    );

    // ── 8. Military base filled markers ──
    allLayers.push(
      new ScatterplotLayer<MilitaryBase>({
        id: 'base-markers',
        data: MILITARY_BASES,
        pickable: true,
        opacity: 0.95, stroked: true, filled: true,
        radiusMinPixels: 4, radiusMaxPixels: 14, lineWidthMinPixels: 2,
        getPosition: d => [d.lng, d.lat],
        getRadius: 800,
        getFillColor: d => { const c = BASE_NATION_COLORS[d.nation] ?? [200,200,200,200]; return [c[0], c[1], c[2], 200]; },
        getLineColor: [255, 255, 255, 200],
        getLineWidth: 300,
        onHover: info => {
          if (info.object) {
            setHoveredBase(info.object as MilitaryBase);
            setHoveredAmbient(null); setHoveredChokepoint(null);
            setHoveredAircraft(null); setHoveredMilVessel(null); setHoveredConvoy(null); setHoveredSupplyNode(null);
            setHoverPos({ x: info.x, y: info.y });
          } else if (hoveredBase) {
            setHoveredBase(null);
            setHoverPos(null);
          }
        },
        parameters: { depthTest: false },
      })
    );

    // ── 9. Military base short labels ──
    allLayers.push(
      new TextLayer<MilitaryBase>({
        id: 'base-labels',
        data: MILITARY_BASES,
        pickable: false,
        getPosition: d => [d.lng, d.lat + 0.45],
        getText: d => d.short,
        getColor: d => BASE_NATION_COLORS[d.nation] ?? [200, 200, 200, 200],
        getSize: 9,
        fontFamily: 'monospace',
        fontWeight: 'bold',
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'bottom',
        billboard: true,
        parameters: { depthTest: false },
      })
    );

    // ── 10. Demo track layer ──
    allLayers.push(
      new ScatterplotLayer<DemoTrackUpdate>({
        id: 'demo-tracks-layer',
        data: demoTracks,
        pickable: true, opacity: 0.9, stroked: true, filled: true,
        radiusMinPixels: 5, radiusMaxPixels: 22, lineWidthMinPixels: 1,
        getPosition: d => [d.lng, d.lat],
        getRadius: 1200,
        getFillColor: d => TRACK_COLORS[d.type] ?? [200, 200, 200, 200],
        getLineColor: [255, 255, 255, 180],
        onHover: info => {
          setHoveredAmbient(null); setHoveredChokepoint(null); setHoveredBase(null);
          setHoveredAircraft(null); setHoveredMilVessel(null); setHoveredConvoy(null); setHoveredSupplyNode(null);
          setHoverPos(null);
          setHoverInfo(info.object ? { ...info, object: info.object as DemoTrackUpdate, layerId: 'track' } : null);
        },
        updateTriggers: { getPosition: [demoTracks], getFillColor: [demoTracks] },
      })
    );

    // ── 7. Cyber threats layer ──
    allLayers.push(
      new ScatterplotLayer<DemoCyberThreat | ShodanThreat>({
        id: 'cyber-threats-layer',
        data: (cyberPoints as (DemoCyberThreat | ShodanThreat)[]).filter(t => (t as any).lat != null && (t as any).lng != null),
        pickable: true, opacity: 0.85, stroked: true, filled: true,
        radiusMinPixels: 4, radiusMaxPixels: 18, lineWidthMinPixels: 2,
        getPosition: d => [(d as any).lng, (d as any).lat],
        getRadius: 800,
        getFillColor: d => THREAT_COLORS[(d as any).severity] ?? [200, 100, 0, 160],
        getLineColor: d => THREAT_COLORS[(d as any).severity] ?? [200, 100, 0, 200],
        onHover: info => {
          setHoveredAmbient(null); setHoveredChokepoint(null); setHoveredBase(null);
          setHoveredAircraft(null); setHoveredMilVessel(null); setHoveredConvoy(null); setHoveredSupplyNode(null);
          setHoverPos(null);
          setHoverInfo(info.object ? { ...info, object: info.object as DemoCyberThreat, layerId: 'threat' } : null);
        },
        updateTriggers: { getPosition: [cyberPoints] },
      })
    );

    // ── Compute animated positions (Date.now() triggered by pulsePhase rAF) ──
    const nowMs = Date.now();
    const aircraftAnimated = MOVING_AIRCRAFT.map(ac => {
      const t = ((nowMs / (ac.cycleMins * 60000)) + ac.offsetFrac) % 1;
      const [lng, lat] = lerpRoute(ac.route, t);
      return { ...ac, lng, lat };
    });
    const milVesselsAnimated = MILITARY_VESSELS.map(v => {
      const t = ((nowMs / (v.cycleMins * 60000)) + v.offsetFrac) % 1;
      const [lng, lat] = lerpRoute(v.route, t);
      return { ...v, lng, lat };
    });
    const convoysAnimated = GROUND_CONVOYS.map(c => {
      const tFrac = c.status === 'HALTED' ? c.offsetFrac : ((nowMs / (c.cycleMins * 60000)) + c.offsetFrac) % 1;
      const [lng, lat] = lerpRoute(c.route, tFrac);
      return { ...c, lng, lat };
    });

    // ── A. Air corridors (background dashed) — insert before shipping lanes ──
    (allLayers as unknown[]).splice(1, 0,
      new PathLayer<AirCorridor>({
        id: 'air-corridors',
        data: AIR_CORRIDORS,
        pickable: false,
        widthMinPixels: 1, widthMaxPixels: 2,
        getPath: (d: AirCorridor) => d.path,
        getColor: (d: AirCorridor) => d.color,
        getWidth: 1.5,
        getDashArray: [5, 5],
        dashJustified: true,
        parameters: { depthTest: false },
      })
    );

    // ── B. Logistics routes (road/rail MSRs) ──
    (allLayers as unknown[]).splice(2, 0,
      new PathLayer<LogisticsRoute>({
        id: 'logistics-routes',
        data: LOGISTICS_ROUTES,
        pickable: false,
        widthMinPixels: 1, widthMaxPixels: 4,
        getPath: (d: LogisticsRoute) => d.path,
        getColor: (d: LogisticsRoute) => d.status === 'HALTED' ? [255,80,0,d.color[3]] as [number,number,number,number] : d.status === 'DIVERTED' ? [255,140,0,d.color[3]] as [number,number,number,number] : d.status === 'DEGRADED' ? [200,140,0,d.color[3]] as [number,number,number,number] : d.color,
        getWidth: (d: LogisticsRoute) => d.width,
        getDashArray: (d: LogisticsRoute) => d.type === 'RAIL' ? [4, 3] : [1, 0],
        dashJustified: true,
        parameters: { depthTest: false },
      })
    );

    // ── C. Supply chain nodes (ports, airports, depots) ──
    allLayers.push(
      new ScatterplotLayer<SupplyChainNode>({
        id: 'supply-nodes-fill',
        data: SUPPLY_CHAIN_NODES,
        pickable: true, opacity: 0.9, stroked: true, filled: true,
        radiusMinPixels: 4, radiusMaxPixels: 18, lineWidthMinPixels: 2,
        getPosition: (d: SupplyChainNode) => [d.lng, d.lat],
        getRadius: 1100,
        getFillColor: (d: SupplyChainNode) => d.status === 'OPERATIONAL' ? [0,200,100,45] : d.status === 'DEGRADED' ? [255,180,0,50] : d.status === 'DISRUPTED' ? [255,60,60,55] : [180,0,0,55],
        getLineColor: (d: SupplyChainNode) => d.status === 'OPERATIONAL' ? [0,200,100,200] : d.status === 'DEGRADED' ? [255,180,0,200] : d.status === 'DISRUPTED' ? [255,60,60,200] : [220,0,0,230],
        getLineWidth: 450,
        onHover: info => {
          if (info.object) {
            setHoveredSupplyNode(info.object as SupplyChainNode);
            setHoveredAmbient(null); setHoveredChokepoint(null); setHoveredBase(null);
            setHoveredAircraft(null); setHoveredMilVessel(null); setHoveredConvoy(null);
            setHoverPos({ x: info.x, y: info.y });
          } else if (hoveredSupplyNode) { setHoveredSupplyNode(null); setHoverPos(null); }
        },
        parameters: { depthTest: false },
      })
    );
    allLayers.push(
      new TextLayer<SupplyChainNode>({
        id: 'supply-nodes-labels',
        data: SUPPLY_CHAIN_NODES,
        pickable: false,
        getPosition: (d: SupplyChainNode) => [d.lng, d.lat + 0.55],
        getText: (d: SupplyChainNode) => d.short,
        getColor: (d: SupplyChainNode) => d.status === 'OPERATIONAL' ? [0,200,100,180] : d.status === 'DEGRADED' ? [255,180,0,180] : d.status === 'DISRUPTED' ? [255,100,100,200] : [220,60,60,220],
        getSize: 8, fontFamily: 'monospace', fontWeight: 'bold',
        getTextAnchor: 'middle', getAlignmentBaseline: 'bottom',
        billboard: true, parameters: { depthTest: false },
      })
    );

    // ── D. Military naval vessels (animated) ──
    allLayers.push(
      new ScatterplotLayer<typeof milVesselsAnimated[number]>({
        id: 'mil-vessels-fill',
        data: milVesselsAnimated,
        pickable: true, opacity: 0.95, stroked: true, filled: true,
        radiusMinPixels: 5, radiusMaxPixels: 20, lineWidthMinPixels: 2,
        getPosition: d => [d.lng, d.lat],
        getRadius: 1400,
        getFillColor: d => d.nationality === 'US' ? [30,144,255,190] : d.nationality === 'UK' ? [200,30,70,190] : d.nationality === 'FR' ? [20,80,200,190] : d.nationality === 'AU' ? [0,100,180,190] : [255,140,0,200],
        getLineColor: d => d.nationality === 'CN' ? [255,100,0,255] : [255,255,255,200],
        getLineWidth: 500,
        onHover: info => {
          if (info.object) {
            setHoveredMilVessel(info.object as typeof milVesselsAnimated[number]);
            setHoveredAmbient(null); setHoveredChokepoint(null); setHoveredBase(null);
            setHoveredAircraft(null); setHoveredConvoy(null); setHoveredSupplyNode(null);
            setHoverPos({ x: info.x, y: info.y });
          } else if (hoveredMilVessel) { setHoveredMilVessel(null); setHoverPos(null); }
        },
        parameters: { depthTest: false },
        updateTriggers: { getPosition: [pulsePhase] },
      })
    );
    allLayers.push(
      new TextLayer<typeof milVesselsAnimated[number]>({
        id: 'mil-vessels-labels',
        data: milVesselsAnimated,
        pickable: false,
        getPosition: d => [d.lng, d.lat + 0.55],
        getText: d => `${d.name}`,
        getColor: d => d.nationality === 'US' ? [30,144,255,200] : d.nationality === 'UK' ? [200,30,70,200] : d.nationality === 'FR' ? [60,120,220,200] : d.nationality === 'AU' ? [0,120,200,200] : [255,140,0,220],
        getSize: 8, fontFamily: 'monospace', fontWeight: 'bold',
        getTextAnchor: 'middle', getAlignmentBaseline: 'bottom',
        billboard: true, parameters: { depthTest: false },
        updateTriggers: { getPosition: [pulsePhase] },
      })
    );

    // ── E. Ground convoys (animated, road + rail) ──
    allLayers.push(
      new ScatterplotLayer<typeof convoysAnimated[number]>({
        id: 'convoys-fill',
        data: convoysAnimated,
        pickable: true, opacity: 0.9, stroked: true, filled: true,
        radiusMinPixels: 3, radiusMaxPixels: 14, lineWidthMinPixels: 2,
        getPosition: d => [d.lng, d.lat],
        getRadius: 900,
        getFillColor: d => d.status === 'MOVING' ? [0,200,100,170] : d.status === 'DELAYED' ? [255,180,0,170] : d.status === 'HALTED' ? [255,80,0,180] : [255,140,0,170],
        getLineColor: d => d.type === 'RAIL' ? [255,200,60,230] : [255,255,255,170],
        getLineWidth: 400,
        onHover: info => {
          if (info.object) {
            setHoveredConvoy(info.object as typeof convoysAnimated[number]);
            setHoveredAmbient(null); setHoveredChokepoint(null); setHoveredBase(null);
            setHoveredAircraft(null); setHoveredMilVessel(null); setHoveredSupplyNode(null);
            setHoverPos({ x: info.x, y: info.y });
          } else if (hoveredConvoy) { setHoveredConvoy(null); setHoverPos(null); }
        },
        parameters: { depthTest: false },
        updateTriggers: { getPosition: [pulsePhase] },
      })
    );
    allLayers.push(
      new TextLayer<typeof convoysAnimated[number]>({
        id: 'convoys-labels',
        data: convoysAnimated,
        pickable: false,
        getPosition: d => [d.lng, d.lat + 0.45],
        getText: d => d.callsign,
        getColor: d => d.status === 'MOVING' ? [0,200,100,180] : d.status === 'DELAYED' ? [255,180,0,180] : [255,100,0,200],
        getSize: 8, fontFamily: 'monospace', fontWeight: 'bold',
        getTextAnchor: 'middle', getAlignmentBaseline: 'bottom',
        billboard: true, parameters: { depthTest: false },
        updateTriggers: { getPosition: [pulsePhase] },
      })
    );

    // ── F. Moving aircraft (animated) ──
    allLayers.push(
      new ScatterplotLayer<typeof aircraftAnimated[number]>({
        id: 'aircraft-fill',
        data: aircraftAnimated,
        pickable: true, opacity: 0.95, stroked: true, filled: true,
        radiusMinPixels: 3, radiusMaxPixels: 14, lineWidthMinPixels: 1,
        getPosition: d => [d.lng, d.lat],
        getRadius: 850,
        getFillColor: d => {
          if (d.type === 'MQ-9' || d.type === 'RQ-4') return [255,200,0,210];
          if (d.type === 'E-3') return [0,220,100,210];
          if (d.type === 'KC-135') return [200,200,200,200];
          if (d.type === 'F-35' || d.type === 'F-16') return [255,80,80,210];
          if (d.type === 'P-8' || d.type === 'P-3C') return [0,200,220,210];
          return [30,144,255,210];
        },
        getLineColor: [255,255,255,170],
        getLineWidth: 300,
        onHover: info => {
          if (info.object) {
            setHoveredAircraft(info.object as typeof aircraftAnimated[number]);
            setHoveredAmbient(null); setHoveredChokepoint(null); setHoveredBase(null);
            setHoveredMilVessel(null); setHoveredConvoy(null); setHoveredSupplyNode(null);
            setHoverPos({ x: info.x, y: info.y });
          } else if (hoveredAircraft) { setHoveredAircraft(null); setHoverPos(null); }
        },
        parameters: { depthTest: false },
        updateTriggers: { getPosition: [pulsePhase] },
      })
    );
    allLayers.push(
      new TextLayer<typeof aircraftAnimated[number]>({
        id: 'aircraft-labels',
        data: aircraftAnimated,
        pickable: false,
        getPosition: d => [d.lng, d.lat + 0.5],
        getText: d => d.callsign,
        getColor: d => {
          if (d.type === 'MQ-9' || d.type === 'RQ-4') return [255,200,0,200];
          if (d.type === 'E-3') return [0,220,100,200];
          if (d.type === 'KC-135') return [200,200,200,200];
          if (d.type === 'F-35' || d.type === 'F-16') return [255,100,100,200];
          return [30,144,255,200];
        },
        getSize: 8, fontFamily: 'monospace', fontWeight: 'bold',
        getTextAnchor: 'middle', getAlignmentBaseline: 'bottom',
        billboard: true, parameters: { depthTest: false },
        updateTriggers: { getPosition: [pulsePhase] },
      })
    );

    return allLayers;
  }, [demoTracks, cyberPoints, scImpact, pulsePhase, hoveredAmbient, hoveredChokepoint, hoveredBase, hoveredAircraft, hoveredMilVessel, hoveredConvoy, hoveredSupplyNode]);

  const demoRunning = demoState.running;
  const sceneLabel  = demoState.sceneLabel;
  const location    = demoState.location;
  const narration   = demoState.narration;

  const hoverProvenance = useMemo((): OntologyHit[] => {
    if (!hoverInfo?.object) return [];
    if (hoverInfo.layerId === 'track') {
      return getTrackProvenance(
        hoverInfo.object as DemoTrackUpdate,
        demoState.sigintItems ?? [], demoState.isrItems ?? [],
        demoState.humintItems ?? [], demoState.aisItems ?? [], demoState.iocItems ?? [],
      );
    }
    return getThreatProvenance(
      hoverInfo.object as DemoCyberThreat,
      demoState.sigintItems ?? [], demoState.iocItems ?? [], demoState.humintItems ?? [],
    );
  }, [hoverInfo, demoState.sigintItems, demoState.isrItems, demoState.humintItems, demoState.aisItems, demoState.iocItems]);

  return (
    <div className="w-full h-full absolute inset-0">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => {
          // Guard: ignore any spurious Mapbox-default sync during the first 800ms
          if (Date.now() - mountedMs.current < 800) return;
          setViewState(vs as Record<string, unknown>);
        }}
        controller={true}
        layers={layers}
      >
        <Map
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        />
      </DeckGL>

      {/* Crosshair */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30">
        <div className="absolute w-full h-px bg-[#00ff8822]" />
        <div className="absolute h-full w-px bg-[#00ff8822]" />
        <div className="absolute w-3 h-3 rounded-full border border-[#00ff8844]" />
      </div>

      {/* Demo narration banner */}
      {(demoRunning || demoState.paused) && narration && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none max-w-[70%]">
          <div className="px-3 py-1.5 bg-black/80 border border-[#00ff8833] flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full bg-[#ff1e3c] shrink-0 ${demoState.paused ? '' : 'animate-ping'}`} />
            <span className="font-mono text-[9px] text-[#00ff88] font-bold tracking-widest uppercase text-center">{narration}</span>
          </div>
        </div>
      )}

      {/* Scene label + location */}
      {(demoRunning || demoState.paused) && sceneLabel && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="px-3 py-1 bg-black/70 border border-[#a78bfa33] text-center">
            <div className="text-[8px] font-mono text-[#a78bfa] tracking-widest uppercase">{sceneLabel}</div>
            <div className="text-[8px] font-mono text-[#555]">{location}</div>
          </div>
        </div>
      )}

      {/* Scene intel data overlay — progressive briefing lines + metrics + threat bar */}
      {(demoRunning || demoState.paused) && demoState.currentScene > 0 && (() => {
        const sceneData = DEMO_SCENES.find(s => s.id === demoState.currentScene);
        if (!sceneData?.briefingLines?.length) return null;
        const sceneElapsed = demoState.elapsedMs - sceneData.startMs;
        const lineCount = Math.min(sceneData.briefingLines.length, Math.floor(sceneElapsed / 2800) + 1);
        const visibleLines = sceneData.briefingLines.slice(0, lineCount);
        const tl = sceneData.threatLevel ?? 0;
        const tlColor = tl >= 90 ? '#ff1e3c' : tl >= 75 ? '#ff6400' : tl >= 50 ? '#ffb800' : '#00ff88';
        const tlLabel = tl >= 90 ? 'CRITICAL' : tl >= 75 ? 'HIGH' : tl >= 50 ? 'MEDIUM' : 'LOW';
        return (
          <div className="absolute left-3 top-24 z-40 pointer-events-none" style={{ width: 338, fontFamily: 'monospace' }}>
            <div className="bg-black/88 border border-[#00ff8820]" style={{ borderLeft: '2px solid #00ff8840' }}>
              <div className="flex items-center justify-between px-2 py-1 border-b border-[#00ff8815]">
                <span className="text-[8px] font-bold tracking-widest text-[#00ff88]">
                  SCN {String(demoState.currentScene).padStart(2,'0')}/{DEMO_SCENES.length}
                </span>
                <span className="text-[8px] text-[#a78bfa] tracking-wider">{sceneData.label}</span>
                {demoState.paused && <span className="text-[8px] text-[#ffb800] animate-pulse ml-2">⏸ PAUSED</span>}
              </div>
              <div className="px-2 py-1.5 flex flex-col gap-0.5 border-b border-[#00ff8810]" style={{ minHeight: 40 }}>
                {visibleLines.map((line, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-[#00ff8855] text-[7px] shrink-0 mt-0.5">›</span>
                    <span className={`text-[8px] leading-tight ${i === visibleLines.length - 1 ? 'text-[#00ee77]' : 'text-[#445544]'}`}>{line}</span>
                  </div>
                ))}
              </div>
              {(sceneData.metrics ?? []).length > 0 && (
                <div className="px-2 py-1 flex flex-wrap gap-x-3 gap-y-0.5 border-b border-[#00ff8810]">
                  {sceneData.metrics.map((m, i) => (
                    <span key={i} className="text-[8px]">
                      <span className="text-[#444]">{m.label}:</span>{' '}
                      <span style={{ color: m.color ?? '#aaaaaa' }} className="font-bold tabular-nums">{m.value}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="px-2 py-1 flex items-center gap-2">
                <span className="text-[7px] text-[#555] shrink-0 tracking-wider">THREAT</span>
                <div className="flex-1 h-1.5 bg-[#111] rounded-sm overflow-hidden">
                  <div
                    className="h-full rounded-sm transition-all duration-1000"
                    style={{ width: `${tl}%`, backgroundColor: tlColor, boxShadow: `0 0 4px ${tlColor}` }}
                  />
                </div>
                <span className="text-[7px] font-bold shrink-0 tracking-wider" style={{ color: tlColor }}>{tlLabel} {tl}%</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Supply chain impact panel (demo only) */}
      {scImpact && scImpact.zones.length > 0 && (
        <div className="absolute top-24 right-3 z-40 pointer-events-none max-w-[200px]">
          <div className="bg-black/85 border border-[#ff640030] p-2 flex flex-col gap-1" style={{ fontFamily: 'monospace' }}>
            <div className="text-[8px] font-bold text-[#ff6400] tracking-widest uppercase border-b border-[#ff640020] pb-1">
              ⚠ SUPPLY CHAIN IMPACT
            </div>
            {scImpact.zones.map((z, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <div className="text-[7px] text-[#ff9944] font-bold truncate">{z.label}</div>
                <div className="flex justify-between text-[7px]">
                  <span className="text-[#888]">CARGO:</span>
                  <span className="text-[#ffb800]">{z.cargoAtRisk}</span>
                </div>
                <div className="flex justify-between text-[7px]">
                  <span className="text-[#888]">DELAY:</span>
                  <span className="text-[#ff6400]">{z.delay}</span>
                </div>
              </div>
            ))}
            {scImpact.arcs.length > 0 && (
              <div className="border-t border-[#ff640018] pt-1 text-[6px] text-[#555]">
                {scImpact.arcs.length} SUPPLY CHAIN VECTORS DISRUPTED
              </div>
            )}
          </div>
        </div>
      )}

      {/* Standby overlay */}
      {!demoRunning && !demoState.complete && demoState.currentScene === 0 && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-end justify-center pb-16">
          <div className="px-5 py-3 bg-black/80 border border-[#00ff8822] text-center">
            <div className="text-[10px] font-mono text-[#444] tracking-widest uppercase">RED SEA / SUEZ THEATER — STANDBY</div>
            <div className="text-[9px] font-mono text-[#2a2a2a] mt-1">PRESS START SESSION TO BEGIN OPERATION EPIC FURY</div>
          </div>
        </div>
      )}

      {/* Coordinates HUD */}
      <div className="absolute bottom-4 left-4 z-40 pointer-events-none p-2 bg-black/60 border border-[#00ff884d] font-mono text-[10px] text-[#00ff88] flex flex-col">
        <span>LAT: {((viewState['latitude'] as number) ?? 0).toFixed(4)}° {((viewState['latitude'] as number) ?? 0) >= 0 ? 'N' : 'S'}</span>
        <span>LNG: {Math.abs((viewState['longitude'] as number) ?? 0).toFixed(4)}° {((viewState['longitude'] as number) ?? 0) >= 0 ? 'E' : 'W'}</span>
        <span className="text-[8px] text-[#446644] mt-0.5">ZOOM: {((viewState['zoom'] as number) ?? 0).toFixed(1)}</span>
      </div>

      {/* Map legend */}
      <div className="absolute bottom-4 right-4 z-40 pointer-events-none p-2 bg-black/80 border border-[#00ff8820]" style={{ fontFamily: 'monospace' }}>
        <div className="text-[7px] text-[#00ff8844] tracking-widest uppercase mb-1.5 font-bold">LEGEND</div>
        <div className="flex flex-col gap-0.5">
          <div className="text-[6px] text-[#333] tracking-widest uppercase mb-0.5">── TRACKS ──</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#0078ff]" /><span className="text-[7px] text-[#888]">FRIENDLY TRACK</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ff1e1e]" /><span className="text-[7px] text-[#888]">HOSTILE TRACK</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ffb400]" /><span className="text-[7px] text-[#888]">UNKNOWN TRACK</span></div>
          <div className="text-[6px] text-[#333] tracking-widest uppercase mb-0.5 mt-1">── MARITIME ──</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#22c5e0] opacity-70" /><span className="text-[7px] text-[#888]">COMMERCIAL VESSEL</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full border border-[#ffc800]" /><span className="text-[7px] text-[#888]">CHOKEPOINT / PORT</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[#0090ff] opacity-50" /><span className="text-[7px] text-[#888]">SLOC / SHIPPING LANE</span></div>
          <div className="text-[6px] text-[#333] tracking-widest uppercase mb-0.5 mt-1">── BASES ──</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#1e90ff]" /><span className="text-[7px] text-[#888]">US INSTALLATION</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#c81e46]" /><span className="text-[7px] text-[#888]">UK INSTALLATION</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#1450c8]" /><span className="text-[7px] text-[#888]">FR INSTALLATION</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#00a050]" /><span className="text-[7px] text-[#888]">IT / COALITION BASE</span></div>
          <div className="text-[6px] text-[#333] tracking-widest uppercase mb-0.5 mt-1">── AIR ──</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#1e90ff]" /><span className="text-[7px] text-[#888]">AIRLIFT (C-17/C-130)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#00c8dc]" /><span className="text-[7px] text-[#888]">MPA / ASW (P-8)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ffc800]" /><span className="text-[7px] text-[#888]">ISR / UAS (MQ-9/RQ-4)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ff5050]" /><span className="text-[7px] text-[#888]">COMBAT (F-35/CAP)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[#00b4ff] opacity-40" style={{borderTop:'1px dashed #00b4ff'}} /><span className="text-[7px] text-[#888]">AIR CORRIDOR</span></div>
          <div className="text-[6px] text-[#333] tracking-widest uppercase mb-0.5 mt-1">── NAVAL ──</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#1e90ff] border border-white/50" /><span className="text-[7px] text-[#888]">US WARSHIP</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#c81e46] border border-white/50" /><span className="text-[7px] text-[#888]">UK/FR/AU VESSEL</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ff8c00] border border-white/50" /><span className="text-[7px] text-[#888]">CN MONITORING ⚠</span></div>
          <div className="text-[6px] text-[#333] tracking-widest uppercase mb-0.5 mt-1">── GROUND / SUPPLY ──</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#00c864]" /><span className="text-[7px] text-[#888]">CONVOY MOVING</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ffb400]" /><span className="text-[7px] text-[#888]">CONVOY DELAYED</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ff5000]" /><span className="text-[7px] text-[#888]">CONVOY HALTED</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full border border-[#00c864]" /><span className="text-[7px] text-[#888]">PORT / AIRPORT NOMINAL</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full border border-[#ffb400]" /><span className="text-[7px] text-[#888]">PORT / AIRPORT DEGRADED</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full border border-[#ff5050]" /><span className="text-[7px] text-[#888]">PORT / AIRPORT DISRUPTED</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[#c8b400] opacity-50" style={{borderTop:'1px dashed #c8b400'}} /><span className="text-[7px] text-[#888]">MSR / RAIL ROUTE</span></div>
          {scImpact && <><div className="text-[6px] text-[#333] tracking-widest uppercase mb-0.5 mt-1">── SC IMPACT ──</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[#ff6020] opacity-70" /><span className="text-[7px] text-[#888]">SC DISRUPTION ARC</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full border border-[#ff2020] opacity-70" /><span className="text-[7px] text-[#888]">DISRUPTION ZONE</span></div></>}
        </div>
      </div>

      {/* ── HOVER TOOLTIP — demo tracks / threats ── */}
      {hoverInfo?.object && (
        <div
          className="absolute z-50 pointer-events-none flex flex-col gap-0"
          style={{
            left: hoverInfo.x + 15, top: hoverInfo.y + 15,
            background: 'rgba(3,6,4,0.97)', border: '1px solid rgba(0,255,136,0.25)',
            fontFamily: 'monospace', color: '#00ff88', minWidth: 240, maxWidth: 300,
            boxShadow: '0 0 24px rgba(0,255,136,0.08)',
          }}
        >
          {hoverInfo.layerId === 'track' ? (() => {
            const t = hoverInfo.object as DemoTrackUpdate;
            return (
              <>
                <div className="px-3 pt-2 pb-1.5 border-b border-[#00ff8820]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TRACK_COLORS_CSS[t.type] ?? '#ccc', boxShadow: `0 0 6px ${TRACK_COLORS_CSS[t.type] ?? '#ccc'}` }} />
                    <span className="text-white font-bold text-[11px]">TRK: {t.label}</span>
                    <span className="text-[#444] text-[9px] ml-auto">[{t.id}]</span>
                  </div>
                </div>
                <div className="px-3 py-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] border-b border-[#ffffff08]">
                  <span className="text-[#555]">TYPE:</span><span style={{ color: TRACK_COLORS_CSS[t.type] ?? '#ccc' }}>{t.type.toUpperCase()}</span>
                  <span className="text-[#555]">SPD:</span><span>{t.speed.toFixed(0)} KTS</span>
                  <span className="text-[#555]">HDG:</span><span>{t.heading.toFixed(0)}°</span>
                  <span className="text-[#555]">STATUS:</span><span className="truncate">{t.status}</span>
                  {t.cargo && <><span className="text-[#555]">CARGO:</span><span className="truncate text-[#ffb400]">{t.cargo}</span></>}
                </div>
                {t.note && <div className="px-3 py-1 text-[#555] text-[9px] border-b border-[#ffffff08] leading-relaxed">{t.note}</div>}
                {hoverProvenance.length > 0 && <OntologyProvenanceSection hits={hoverProvenance} />}
              </>
            );
          })() : (() => {
            const t = hoverInfo.object as DemoCyberThreat;
            return (
              <>
                <div className="px-3 pt-2 pb-1.5 border-b border-[#ff1e3c33]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: THREAT_COLORS_CSS[t.severity] ?? '#ff6400', boxShadow: `0 0 6px ${THREAT_COLORS_CSS[t.severity] ?? '#ff6400'}` }} />
                    <span className="text-white font-bold text-[11px]">TGT: {t.ip}:{t.port}</span>
                  </div>
                </div>
                <div className="px-3 py-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] border-b border-[#ffffff08]">
                  <span className="text-[#555]">ORG:</span><span className="truncate">{t.org}</span>
                  <span className="text-[#555]">SEV:</span><span style={{ color: THREAT_COLORS_CSS[t.severity] ?? '#ccc' }}>{t.severity.toUpperCase()}</span>
                  <span className="text-[#555]">ACTOR:</span><span className="truncate text-[#ff6400]">{t.attacker ?? 'UNKNOWN'}</span>
                </div>
                {t.description && <div className="px-3 py-1 text-[#555] text-[9px] border-b border-[#ffffff08] leading-relaxed">{t.description.slice(0, 100)}…</div>}
                {hoverProvenance.length > 0 && <OntologyProvenanceSection hits={hoverProvenance} />}
              </>
            );
          })()}
        </div>
      )}

      {/* ── HOVER TOOLTIP — ambient commercial vessels ── */}
      {hoveredAmbient && hoverPos && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: hoverPos.x + 15, top: hoverPos.y + 15,
            background: 'rgba(3,6,4,0.97)', border: '1px solid rgba(34,197,238,0.3)',
            fontFamily: 'monospace', minWidth: 210, maxWidth: 260,
            boxShadow: '0 0 20px rgba(34,197,238,0.1)',
          }}
        >
          <div className="px-3 pt-2 pb-1.5 border-b border-[#22d3ee20]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#22d3ee]" style={{ boxShadow: '0 0 4px #22d3ee' }} />
              <span className="text-white font-bold text-[11px]">{hoveredAmbient.name}</span>
              <span className="text-[#444] text-[8px] ml-auto">AIS</span>
            </div>
          </div>
          <div className="px-3 py-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
            <span className="text-[#555]">TYPE:</span><span className="text-[#22d3ee] capitalize">{hoveredAmbient.type}</span>
            <span className="text-[#555]">FLAG:</span><span>{hoveredAmbient.flag}</span>
            <span className="text-[#555]">HDG:</span><span>{hoveredAmbient.heading}°</span>
            <span className="text-[#555]">CARGO:</span><span className="truncate text-[#ffb400]">{hoveredAmbient.cargo}</span>
          </div>
          <div className="px-3 pb-1.5 text-[8px] text-[#444]">COMMERCIAL — AIS TRANSPONDER ACTIVE</div>
        </div>
      )}

      {/* ── HOVER TOOLTIP — military bases ── */}
      {hoveredBase && hoverPos && !hoveredAmbient && !hoveredChokepoint && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: hoverPos.x + 15, top: hoverPos.y + 15,
            background: 'rgba(3,6,4,0.97)',
            border: `1px solid ${BASE_NATION_CSS[hoveredBase.nation] ?? '#888'}55`,
            fontFamily: 'monospace', minWidth: 260, maxWidth: 320,
            boxShadow: `0 0 20px ${BASE_NATION_CSS[hoveredBase.nation] ?? '#888'}22`,
          }}
        >
          <div className="px-3 pt-2 pb-1.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  backgroundColor: BASE_NATION_CSS[hoveredBase.nation] ?? '#888',
                  boxShadow: `0 0 6px ${BASE_NATION_CSS[hoveredBase.nation] ?? '#888'}`,
                }}
              />
              <div>
                <div className="text-white font-bold text-[11px] leading-tight">{hoveredBase.name}</div>
                <div className="text-[8px]" style={{ color: BASE_NATION_CSS[hoveredBase.nation] ?? '#888' }}>{hoveredBase.baseId}</div>
              </div>
            </div>
          </div>
          <div className="px-3 py-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] border-b border-white/5">
            <span className="text-[#555]">NATION:</span>
            <span style={{ color: BASE_NATION_CSS[hoveredBase.nation] ?? '#888' }} className="font-bold">{hoveredBase.nation}</span>
            <span className="text-[#555]">TYPE:</span>
            <span className="text-[#aaa]">{hoveredBase.type.toUpperCase()}</span>
            <span className="text-[#555]">PERS:</span>
            <span className="text-[#aaa]">{hoveredBase.personnel}</span>
            <span className="text-[#555]">LAT/LNG:</span>
            <span className="text-[#666]">{hoveredBase.lat.toFixed(3)}°, {hoveredBase.lng.toFixed(3)}°</span>
          </div>
          <div className="px-3 py-1.5 text-[9px] text-[#777] leading-relaxed">{hoveredBase.role}</div>
          <div className="px-3 pb-1.5 text-[7px] text-[#333] tracking-wider uppercase">
            MILITARY INSTALLATION — {hoveredBase.nation} FORCES
          </div>
        </div>
      )}

      {/* ── HOVER TOOLTIP — chokepoints ── */}
      {hoveredChokepoint && hoverPos && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: hoverPos.x + 15, top: hoverPos.y + 15,
            background: 'rgba(3,6,4,0.97)',
            border: `1px solid ${hoveredChokepoint.isHostile ? 'rgba(255,30,60,0.4)' : 'rgba(255,200,0,0.35)'}`,
            fontFamily: 'monospace', minWidth: 220,
            boxShadow: hoveredChokepoint.isHostile ? '0 0 20px rgba(255,30,60,0.1)' : '0 0 20px rgba(255,200,0,0.1)',
          }}
        >
          <div className="px-3 pt-2 pb-1.5 border-b border-[#ffffff10]">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full border shrink-0"
                style={{
                  borderColor: hoveredChokepoint.isHostile ? '#ff1e3c' : '#ffc800',
                  boxShadow:   hoveredChokepoint.isHostile ? '0 0 4px #ff1e3c' : '0 0 4px #ffc800',
                }}
              />
              <span className="text-white font-bold text-[11px]">{hoveredChokepoint.name}</span>
            </div>
          </div>
          <div className="px-3 py-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
            <span className="text-[#555]">TYPE:</span>
            <span style={{ color: hoveredChokepoint.isHostile ? '#ff4444' : hoveredChokepoint.type === 'strategic' ? '#ffc800' : '#22d3ee' }}>
              {hoveredChokepoint.isHostile ? 'HOSTILE CTRL' : hoveredChokepoint.type.toUpperCase()}
            </span>
            <span className="text-[#555]">TRANSIT:</span>
            <span className="text-[#ffb800]">{hoveredChokepoint.cargoValue}</span>
            <span className="text-[#555]">LAT/LNG:</span>
            <span className="text-[#666]">{hoveredChokepoint.lat.toFixed(2)}°, {hoveredChokepoint.lng.toFixed(2)}°</span>
          </div>
          {hoveredChokepoint.type === 'strategic' && (
            <div className="px-3 pb-1.5 text-[8px] text-[#555]">STRATEGIC CHOKEPOINT — SUPPLY CHAIN CRITICAL</div>
          )}
        </div>
      )}

      {/* ── HOVER TOOLTIP — moving aircraft ── */}
      {hoveredAircraft && hoverPos && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: hoverPos.x + 15, top: hoverPos.y + 15,
            background: 'rgba(3,6,4,0.97)',
            border: `1px solid ${hoveredAircraft.type === 'MQ-9' || hoveredAircraft.type === 'RQ-4' ? 'rgba(255,200,0,0.35)' : hoveredAircraft.type === 'F-35' || hoveredAircraft.type === 'F-16' ? 'rgba(255,80,80,0.35)' : 'rgba(30,144,255,0.3)'}`,
            fontFamily: 'monospace', minWidth: 290, maxWidth: 340,
            boxShadow: '0 0 20px rgba(30,144,255,0.08)',
          }}
        >
          <div className="px-3 pt-2 pb-1.5 border-b border-[#1e90ff25]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{
                backgroundColor: hoveredAircraft.type === 'MQ-9' || hoveredAircraft.type === 'RQ-4' ? '#ffc800' : hoveredAircraft.type === 'E-3' ? '#00dc64' : hoveredAircraft.type === 'F-35' ? '#ff5050' : '#1e90ff',
                boxShadow: `0 0 5px ${hoveredAircraft.type === 'MQ-9' || hoveredAircraft.type === 'RQ-4' ? '#ffc800' : '#1e90ff'}`,
              }} />
              <span className="text-white font-bold text-[11px]">{hoveredAircraft.callsign}</span>
              <span className="text-[#444] text-[8px] ml-auto">{hoveredAircraft.status}</span>
            </div>
            <div className="text-[8px] mt-0.5" style={{ color: hoveredAircraft.type === 'MQ-9' || hoveredAircraft.type === 'RQ-4' ? '#ffc800' : '#1e90ff' }}>{hoveredAircraft.nato}</div>
          </div>
          <div className="px-3 py-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] border-b border-[#ffffff08]">
            <span className="text-[#555]">MISSION:</span><span className="text-[#aaa] truncate">{hoveredAircraft.mission}</span>
            <span className="text-[#555]">ALT:</span><span>FL{Math.floor(hoveredAircraft.altitudeFt / 100)}</span>
            <span className="text-[#555]">SPEED:</span><span>{hoveredAircraft.speedKts} KTS</span>
            <span className="text-[#555]">NATION:</span><span>{hoveredAircraft.nationality}</span>
          </div>
          <div className="px-3 py-1 text-[#555] text-[9px] leading-relaxed border-b border-[#ffffff05]">{hoveredAircraft.note}</div>
          <div className="px-3 pb-1.5 text-[7px] text-[#2a2a2a] tracking-wider uppercase">AIRBORNE ASSET — CAOC TRACK — REAL-TIME POSITION</div>
        </div>
      )}

      {/* ── HOVER TOOLTIP — military naval vessels ── */}
      {hoveredMilVessel && hoverPos && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: hoverPos.x + 15, top: hoverPos.y + 15,
            background: 'rgba(3,6,4,0.97)',
            border: `1px solid ${hoveredMilVessel.nationality === 'CN' ? 'rgba(255,140,0,0.4)' : hoveredMilVessel.nationality === 'US' ? 'rgba(30,144,255,0.3)' : hoveredMilVessel.nationality === 'UK' ? 'rgba(200,30,70,0.35)' : 'rgba(30,80,200,0.35)'}`,
            fontFamily: 'monospace', minWidth: 290, maxWidth: 340,
            boxShadow: hoveredMilVessel.nationality === 'CN' ? '0 0 20px rgba(255,140,0,0.1)' : '0 0 20px rgba(30,144,255,0.08)',
          }}
        >
          <div className="px-3 pt-2 pb-1.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{
                backgroundColor: hoveredMilVessel.nationality === 'US' ? '#1e90ff' : hoveredMilVessel.nationality === 'UK' ? '#c81e46' : hoveredMilVessel.nationality === 'FR' ? '#1450c8' : hoveredMilVessel.nationality === 'AU' ? '#0064b4' : '#ff8c00',
                boxShadow: `0 0 5px currentColor`,
              }} />
              <div>
                <div className="text-white font-bold text-[11px]">{hoveredMilVessel.name}</div>
                <div className="text-[8px] text-[#555]">{hoveredMilVessel.hull} · {hoveredMilVessel.class}</div>
              </div>
              {hoveredMilVessel.nationality === 'CN' && <span className="ml-auto text-[7px] text-[#ff8c00] font-bold animate-pulse">⚠ CAUTION</span>}
            </div>
          </div>
          <div className="px-3 py-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] border-b border-[#ffffff08]">
            <span className="text-[#555]">NATION:</span><span>{hoveredMilVessel.nationality}</span>
            <span className="text-[#555]">TYPE:</span><span>{hoveredMilVessel.type}</span>
            <span className="text-[#555]">MISSION:</span><span className="truncate">{hoveredMilVessel.mission}</span>
            <span className="text-[#555]">STATUS:</span><span style={{ color: hoveredMilVessel.status === 'MONITORING' ? '#ff8c00' : '#00ff88' }}>{hoveredMilVessel.status}</span>
          </div>
          <div className="px-3 py-1 text-[#555] text-[9px] leading-relaxed border-b border-[#ffffff05]">{hoveredMilVessel.note}</div>
          <div className="px-3 pb-1.5 text-[7px] text-[#2a2a2a] tracking-wider uppercase">NAVAL ASSET — {hoveredMilVessel.nationality} NAVY — TRACK ACTIVE</div>
        </div>
      )}

      {/* ── HOVER TOOLTIP — ground convoys ── */}
      {hoveredConvoy && hoverPos && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: hoverPos.x + 15, top: hoverPos.y + 15,
            background: 'rgba(3,6,4,0.97)',
            border: `1px solid ${hoveredConvoy.status === 'MOVING' ? 'rgba(0,200,100,0.3)' : hoveredConvoy.status === 'HALTED' ? 'rgba(255,80,0,0.4)' : 'rgba(255,180,0,0.35)'}`,
            fontFamily: 'monospace', minWidth: 290, maxWidth: 340,
          }}
        >
          <div className="px-3 pt-2 pb-1.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{
                backgroundColor: hoveredConvoy.status === 'MOVING' ? '#00c864' : hoveredConvoy.status === 'HALTED' ? '#ff5000' : '#ffb400',
                boxShadow: `0 0 4px ${hoveredConvoy.status === 'HALTED' ? '#ff5000' : '#00c864'}`,
              }} />
              <span className="text-white font-bold text-[11px]">{hoveredConvoy.callsign}</span>
              <span className={`text-[8px] ml-auto font-bold ${hoveredConvoy.status === 'MOVING' ? 'text-[#00c864]' : hoveredConvoy.status === 'HALTED' ? 'text-[#ff5000]' : 'text-[#ffb400]'}`}>{hoveredConvoy.status}</span>
            </div>
            <div className="text-[8px] text-[#555] mt-0.5">{hoveredConvoy.type} CONVOY · {hoveredConvoy.nationality} · {hoveredConvoy.vehicles}</div>
          </div>
          <div className="px-3 py-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] border-b border-[#ffffff08]">
            <span className="text-[#555]">CARGO:</span><span className="text-[#ffb800] truncate col-span-1">{hoveredConvoy.cargo.slice(0, 30)}{hoveredConvoy.cargo.length > 30 ? '…' : ''}</span>
            <span className="text-[#555]">TYPE:</span><span>{hoveredConvoy.type}</span>
          </div>
          {hoveredConvoy.impactReason && (
            <div className="px-3 py-1 text-[9px] text-[#ff8040] border-b border-[#ff640015] leading-relaxed">
              <span className="text-[#ff6400]">⚠ </span>{hoveredConvoy.impactReason}
            </div>
          )}
          <div className="px-3 py-1 text-[#555] text-[9px] leading-relaxed border-b border-[#ffffff05]">{hoveredConvoy.note}</div>
          <div className="px-3 pb-1.5 text-[7px] text-[#2a2a2a] tracking-wider uppercase">GROUND ELEMENT — {hoveredConvoy.type} — GPS TRACKED</div>
        </div>
      )}

      {/* ── HOVER TOOLTIP — supply chain nodes ── */}
      {hoveredSupplyNode && hoverPos && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: hoverPos.x + 15, top: hoverPos.y + 15,
            background: 'rgba(3,6,4,0.97)',
            border: `1px solid ${hoveredSupplyNode.status === 'OPERATIONAL' ? 'rgba(0,200,100,0.3)' : hoveredSupplyNode.status === 'HOSTILE' ? 'rgba(200,0,0,0.45)' : 'rgba(255,180,0,0.35)'}`,
            fontFamily: 'monospace', minWidth: 270, maxWidth: 330,
            boxShadow: hoveredSupplyNode.status === 'HOSTILE' ? '0 0 20px rgba(200,0,0,0.12)' : '0 0 14px rgba(0,200,100,0.06)',
          }}
        >
          <div className="px-3 pt-2 pb-1.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{
                backgroundColor: hoveredSupplyNode.status === 'OPERATIONAL' ? '#00c864' : hoveredSupplyNode.status === 'DEGRADED' ? '#ffb400' : hoveredSupplyNode.status === 'DISRUPTED' ? '#ff3c3c' : '#aa0000',
              }} />
              <span className="text-white font-bold text-[11px]">{hoveredSupplyNode.name}</span>
            </div>
            <div className="text-[8px] text-[#555] mt-0.5">{hoveredSupplyNode.type} · {hoveredSupplyNode.short}</div>
          </div>
          <div className="px-3 py-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] border-b border-[#ffffff08]">
            <span className="text-[#555]">STATUS:</span>
            <span style={{ color: hoveredSupplyNode.status === 'OPERATIONAL' ? '#00c864' : hoveredSupplyNode.status === 'DEGRADED' ? '#ffb400' : hoveredSupplyNode.status === 'DISRUPTED' ? '#ff5050' : '#cc0000' }}>{hoveredSupplyNode.status}</span>
            <span className="text-[#555]">THROUGHPUT:</span><span className="truncate">{hoveredSupplyNode.throughput}</span>
            <span className="text-[#555]">TYPE:</span><span>{hoveredSupplyNode.type}</span>
            <span className="text-[#555]">LAT/LNG:</span><span className="text-[#666]">{hoveredSupplyNode.lat.toFixed(2)}°, {hoveredSupplyNode.lng.toFixed(2)}°</span>
          </div>
          <div className="px-3 py-1 text-[#555] text-[9px] leading-relaxed">{hoveredSupplyNode.note}</div>
          <div className="px-3 pb-1.5 text-[7px] text-[#2a2a2a] tracking-wider uppercase">SUPPLY CHAIN NODE — HAWK-I MONITORED</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ontological Provenance Section
// ---------------------------------------------------------------------------
function OntologyProvenanceSection({ hits }: { hits: OntologyHit[] }) {
  return (
    <div className="px-3 py-2 bg-[#000a04] border-t border-[#00ff8814]">
      <div className="text-[7px] font-mono text-[#00ff8844] tracking-widest uppercase mb-1.5 flex items-center gap-1">
        <span className="w-1 h-1 rounded-full bg-[#00ff8844] inline-block" />
        ONTOLOGY PROVENANCE — PALANTIR FOUNDRY
      </div>
      <div className="flex flex-col gap-1">
        {hits.map((hit, i) => (
          <div key={`${hit.objectType}-${hit.pk}-${i}`} className="flex items-start gap-1.5">
            <span className="text-[8px] shrink-0 mt-0.5">{hit.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[7px] font-mono font-bold" style={{ color: hit.color }}>{hit.objectType}</span>
                <span className="text-[7px] font-mono text-[#333]">/</span>
                <span className="text-[7px] font-mono" style={{ color: hit.color }}>{hit.pk}</span>
              </div>
              <div className="text-[7px] font-mono text-[#666] truncate">{hit.label}</div>
              <div className="text-[6px] font-mono text-[#444] truncate">{hit.detail}</div>
            </div>
            <a
              href={hit.url} target="_blank" rel="noreferrer"
              className="shrink-0 text-[6px] font-black px-1 py-0.5 border font-mono transition-all pointer-events-auto"
              style={{ color: '#00bcd466', borderColor: '#00bcd422', backgroundColor: '#00bcd408' }}
              title={`Open ${hit.objectType}/${hit.pk} in Palantir Foundry`}
            >↗</a>
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[6px] font-mono text-[#2a2a2a] tracking-wider">
        runtime-configured
      </div>
    </div>
  );
}

export function C2Map() {
  if (!hasWebGL()) return <MapFallback />;
  return (
    <MapErrorBoundary fallback={<MapFallback />}>
      <DeckGLMap />
    </MapErrorBoundary>
  );
}
