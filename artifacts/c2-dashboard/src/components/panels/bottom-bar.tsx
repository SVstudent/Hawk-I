import { useGetOntologyStatus } from '@workspace/api-client-react';
import { useEffect, useRef, useState } from 'react';
import { useDemo } from '@/demo/use-demo';
import { DEMO_SCENES, SCENE_COUNT } from '@/demo/demo-scenes';

export function BottomBar() {
  const { data: status } = useGetOntologyStatus({ query: { refetchInterval: 10000 } as any });
  const { demoState, startDemo, stopDemo, resetDemo, pauseDemo, resumeDemo } = useDemo();
  const [timeStr, setTimeStr] = useState('');
  const prevSceneRef = useRef(0);
  const [flashScene, setFlashScene] = useState(false);

  useEffect(() => {
    const updateTime = () => setTimeStr(new Date().toUTCString().slice(17, 25) + ' UTC');
    updateTime();
    const id = setInterval(updateTime, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (demoState.currentScene !== prevSceneRef.current && demoState.currentScene > 0) {
      prevSceneRef.current = demoState.currentScene;
      setFlashScene(true);
      const t = setTimeout(() => setFlashScene(false), 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [demoState.currentScene]);

  const datasets        = (status as any)?.datasets as Record<string, { ridConfigured: boolean }> | undefined;
  const configuredCount = datasets ? Object.values(datasets).filter(d => d.ridConfigured).length : 0;
  const totalDatasets   = datasets ? Object.keys(datasets).length : 5;
  const palantirFull    = status?.palantirConnected;
  const palantirPartial = !palantirFull && configuredCount > 0;
  const isAuthError     = (status as any)?.pipelineStatus === 'auth_error';
  const palantirDotClass = palantirFull
    ? 'bg-[#00ff88] shadow-[0_0_5px_#00ff88]'
    : isAuthError ? 'bg-[#ff6400] animate-pulse shadow-[0_0_5px_#ff6400]'
    : palantirPartial ? 'bg-[#ffb800] shadow-[0_0_5px_#ffb800]'
    : 'bg-[#ff1e3c] animate-pulse';
  const palantirColor = palantirFull ? '#00ff88' : isAuthError ? '#ff6400' : palantirPartial ? '#ffb800' : '#ff1e3c';
  const palantirLabel = palantirFull ? 'PALANTIR LIVE'
    : isAuthError ? 'PALANTIR AUTH ERR'
    : (status as any)?.pipelineStatus === 'idle' ? 'PALANTIR IDLE'
    : palantirPartial ? `PALANTIR ${configuredCount}/${totalDatasets} RIDs`
    : 'PALANTIR OFFLINE';

  const running    = demoState.running;
  const paused     = demoState.paused;
  const complete   = demoState.complete;
  const started    = demoState.currentScene > 0 || running || paused || complete;
  const elapsedSec = Math.floor(demoState.elapsedMs / 1000);

  return (
    <div className="w-full h-full bg-[rgba(2,6,2,0.97)] border-t border-[#00ff8826] flex items-center justify-between px-3 text-xs font-mono select-none gap-2">

      {/* LEFT — API status */}
      <div className="flex items-center gap-4 text-[10px] shrink-0">
        <StatusChip label="SHODAN" active={status?.shodanConnected} />
        <StatusChip label="EXA"    active={status?.exaConnected} />
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${palantirDotClass}`} />
          <span style={{ color: palantirColor }}>{palantirLabel}</span>
        </div>
      </div>

      {/* CENTER — Scene progress + START SESSION */}
      <div className="flex-1 flex items-center justify-center gap-4">
        {/* Scene pips */}
        <div className="flex items-center gap-1">
          {DEMO_SCENES.map(scene => {
            const done    = demoState.currentScene >= scene.id;
            const current = demoState.currentScene === scene.id;
            return (
              <div
                key={scene.id}
                title={scene.label}
                className={`h-[6px] rounded-sm transition-all duration-500 ${current ? 'w-10 animate-pulse' : 'w-4'}`}
                style={{
                  backgroundColor: done ? (current ? '#00ff88' : '#00ff8866') : '#333',
                  boxShadow: current ? '0 0 8px #00ff88' : 'none',
                }}
              />
            );
          })}
        </div>

        {started && (
          <div className={`text-[10px] tracking-widest uppercase transition-all ${flashScene ? 'text-[#00ff88]' : 'text-[#555]'}`}>
            {demoState.sceneLabel || 'STANDBY'}
          </div>
        )}

        {/* START SESSION button */}
        {!running && !complete && (
          <button
            onClick={startDemo}
            className="px-5 py-1.5 text-xs font-black tracking-widest uppercase border-2 border-[#00ff88] text-[#00ff88] bg-[#00ff8822] hover:bg-[#00ff8844] hover:shadow-[0_0_20px_#00ff8860] transition-all active:scale-95"
            style={{ fontFamily: 'monospace', letterSpacing: '0.15em' }}
          >
            ▶ START SESSION
          </button>
        )}

        {running && !paused && (
          <div className="flex items-center gap-2">
            <div className="text-[10px] text-[#00ff88] tabular-nums font-bold animate-pulse min-w-[52px]">
              T+{String(Math.floor(elapsedSec / 60)).padStart(2,'0')}:{String(elapsedSec % 60).padStart(2,'0')}
            </div>
            <button
              onClick={pauseDemo}
              className="px-3 py-1 text-[10px] font-bold tracking-widest uppercase border border-[#00ff88] text-[#00ff88] bg-[#00ff8818] hover:bg-[#00ff8830] transition-all active:scale-95"
            >
              ⏸ PAUSE
            </button>
            <button
              onClick={stopDemo}
              className="px-3 py-1 text-[10px] font-bold tracking-widest uppercase border border-[#ff640055] text-[#ff640099] bg-[#ff640008] hover:bg-[#ff640018] transition-all"
            >
              ■ HALT
            </button>
          </div>
        )}

        {paused && (
          <div className="flex items-center gap-2">
            <div className="text-[10px] text-[#ffb800] tabular-nums font-bold animate-pulse min-w-[52px]">
              ⏸ T+{String(Math.floor(elapsedSec / 60)).padStart(2,'0')}:{String(elapsedSec % 60).padStart(2,'0')}
            </div>
            <button
              onClick={resumeDemo}
              className="px-3 py-1.5 text-[10px] font-black tracking-widest uppercase border-2 border-[#00ff88] text-[#00ff88] bg-[#00ff8822] hover:bg-[#00ff8844] hover:shadow-[0_0_12px_#00ff8860] transition-all active:scale-95"
            >
              ▶ RESUME
            </button>
            <button
              onClick={stopDemo}
              className="px-3 py-1 text-[10px] font-bold tracking-widest uppercase border border-[#ff640055] text-[#ff640099] bg-[#ff640008] hover:bg-[#ff640018] transition-all"
            >
              ■ HALT
            </button>
          </div>
        )}

        {complete && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#00ff88] font-bold tracking-widest">SESSION COMPLETE</span>
            <button
              onClick={resetDemo}
              className="px-3 py-1 text-[10px] font-bold tracking-widest uppercase border border-[#00ff8866] text-[#00ff88] bg-[#00ff8811] hover:bg-[#00ff8822] transition-all"
            >
              ↺ RESET
            </button>
          </div>
        )}
      </div>

      {/* RIGHT — Time */}
      <div className="flex items-center gap-4 text-[10px] shrink-0">
        <div className="text-[#888]">
          {running ? (
            <span>
              SCENE <span className="text-white font-bold">{demoState.currentScene}</span>/<span className="text-[#00ff88] font-bold">{SCENE_COUNT}</span>
            </span>
          ) : (
            <span className="text-[#555] tracking-widest">PIPELINE: {(status as any)?.pipelineStatus?.toUpperCase() ?? 'IDLE'}</span>
          )}
        </div>
        <div className="text-[#00ff88] font-bold min-w-[72px] text-right tabular-nums">
          {timeStr}
        </div>
      </div>
    </div>
  );
}

function StatusChip({ label, active }: { label: string; active?: boolean }) {
  const color = active ? '#00ff88' : '#ff1e3c';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
      <span style={{ color }}>{label}</span>
    </div>
  );
}
