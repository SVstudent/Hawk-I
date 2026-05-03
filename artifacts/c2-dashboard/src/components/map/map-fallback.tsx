import { useState } from 'react';
import { useListTracks, useListShodanThreats } from '@workspace/api-client-react';

const SF_BOUNDS = {
  minLat: 37.2, maxLat: 38.2,
  minLng: -122.8, maxLng: -121.7,
};

function projectLat(lat: number, h: number) {
  return ((SF_BOUNDS.maxLat - lat) / (SF_BOUNDS.maxLat - SF_BOUNDS.minLat)) * h;
}
function projectLng(lng: number, w: number) {
  return ((lng - SF_BOUNDS.minLng) / (SF_BOUNDS.maxLng - SF_BOUNDS.minLng)) * w;
}

function unprojectLat(y: number, h: number) {
  return SF_BOUNDS.maxLat - (y / h) * (SF_BOUNDS.maxLat - SF_BOUNDS.minLat);
}
function unprojectLng(x: number, w: number) {
  return (x / w) * (SF_BOUNDS.maxLng - SF_BOUNDS.minLng) + SF_BOUNDS.minLng;
}

const TRACK_COLORS: Record<string, string> = {
  friendly: '#0078ff',
  hostile: '#ff1e1e',
  unknown: '#ffb400',
  neutral: '#888888',
};

const THREAT_COLORS: Record<string, string> = {
  critical: '#ff003c',
  high: '#ff6400',
  medium: '#ffc800',
  low: '#00c864',
};

const LANDMARKS = [
  { label: 'SFO', lat: 37.6213, lng: -122.379 },
  { label: 'OAK', lat: 37.7213, lng: -122.2208 },
  { label: 'SJC', lat: 37.3626, lng: -121.9291 },
  { label: 'SF', lat: 37.7749, lng: -122.4194 },
  { label: 'OKL', lat: 37.8044, lng: -122.2712 },
];

export function MapFallback() {
  const { data: tracks = [] } = useListTracks({
    query: { enabled: true, refetchInterval: 8000 } as any,
  });
  const { data: shodanResponse } = useListShodanThreats(undefined, {
    query: { enabled: true, refetchInterval: 15000 } as any,
  });
  const threats = (shodanResponse?.results || []).filter(t => t.lat != null && t.lng != null);

  const W = 900;
  const H = 500;

  const [mousePos, setMousePos] = useState({ x: W/2, y: H/2 });

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * W;
    const y = (e.clientY - rect.top) / rect.height * H;
    setMousePos({ x, y });
  };

  const currentLat = unprojectLat(mousePos.y, H);
  const currentLng = unprojectLng(mousePos.x, W);

  const gridLines = [];
  for (let i = 0; i <= 8; i++) {
    gridLines.push(<line key={`v${i}`} x1={i * W / 8} y1={0} x2={i * W / 8} y2={H} stroke="#00ff8814" strokeWidth={1} />);
    gridLines.push(<line key={`h${i}`} x1={0} y1={i * H / 8} x2={W} y2={i * H / 8} stroke="#00ff8814" strokeWidth={1} />);
  }

  return (
    <div className="w-full h-full absolute inset-0 bg-[#050508] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full cursor-crosshair"
          style={{ maxHeight: '100%' }}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
        >
          <defs>
            <radialGradient id="bgGrad" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#0a1520" />
              <stop offset="100%" stopColor="#050508" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glowStrong">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width={W} height={H} fill="url(#bgGrad)" />

          {gridLines}

          <rect width={W} height={H} fill="none" stroke="#00ff8830" strokeWidth={1} />

          {LANDMARKS.map(lm => {
            const x = projectLng(lm.lng, W);
            const y = projectLat(lm.lat, H);
            return (
              <g key={lm.label}>
                <line x1={x - 6} y1={y} x2={x + 6} y2={y} stroke="#00ff8840" strokeWidth={1} />
                <line x1={x} y1={y - 6} x2={x} y2={y + 6} stroke="#00ff8840" strokeWidth={1} />
                <text x={x + 8} y={y + 4} fill="#00ff8866" fontSize={9} fontFamily="monospace">{lm.label}</text>
              </g>
            );
          })}

          {threats.map((t) => {
            const x = projectLng(t.lng!, W);
            const y = projectLat(t.lat!, H);
            const color = THREAT_COLORS[t.severity] ?? '#888';
            return (
              <g key={t.ip} filter="url(#glow)">
                <circle cx={x} cy={y} r={5} fill={color} opacity={0.6} />
                <circle cx={x} cy={y} r={9} fill="none" stroke={color} strokeWidth={0.8} opacity={0.4} />
              </g>
            );
          })}

          {tracks.map((t) => {
            const x = projectLng(t.lng, W);
            const y = projectLat(t.lat, H);
            const color = TRACK_COLORS[t.type] ?? '#ccc';
            const rad = t.heading * Math.PI / 180;
            const len = 14;
            const ex = x + Math.sin(rad) * len;
            const ey = y - Math.cos(rad) * len;
            return (
              <g key={t.id} filter={t.type === 'hostile' ? 'url(#glowStrong)' : 'url(#glow)'}>
                <line x1={x} y1={y} x2={ex} y2={ey} stroke={color} strokeWidth={1.5} opacity={0.7} />
                <polygon
                  points={`${x},${y - 7} ${x - 5},${y + 5} ${x + 5},${y + 5}`}
                  fill={color}
                  opacity={0.85}
                  stroke="white"
                  strokeWidth={0.8}
                  transform={`rotate(${t.heading}, ${x}, ${y})`}
                />
                <text x={x + 8} y={y - 2} fill={color} fontSize={8} fontFamily="monospace" opacity={0.9}>{t.label}</text>
              </g>
            );
          })}

          <text x={8} y={H - 8} fill="#00ff8830" fontSize={8} fontFamily="monospace">
            TACTICAL DISPLAY — SF BAY AREA — {new Date().toUTCString().slice(0, 25).toUpperCase()} UTC
          </text>
          <text x={W - 8} y={H - 8} fill="#00ff8830" fontSize={8} fontFamily="monospace" textAnchor="end">
            WEBGL FALLBACK MODE
          </text>
        </svg>

        {/* Crosshair Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-40">
          <div className="absolute w-full h-px bg-[#00ff8866]" />
          <div className="absolute h-full w-px bg-[#00ff8866]" />
          <div className="absolute w-3 h-3 rounded-full border border-[#00ff8866]" />
        </div>

        {/* Cursor coordinates */}
        <div className="absolute bottom-4 left-4 z-40 pointer-events-none p-2 bg-black/60 border border-[#00ff884d] font-mono text-[10px] text-[#00ff88] flex flex-col">
          <span>LAT: {currentLat.toFixed(4)}&deg; N</span>
          <span>LNG: {Math.abs(currentLng).toFixed(4)}&deg; W</span>
        </div>
      </div>
    </div>
  );
}
