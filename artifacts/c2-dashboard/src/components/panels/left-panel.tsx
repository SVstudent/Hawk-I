import { useState, useEffect } from 'react';
import { ThreatList } from './threat-list';
import { IntelFeed } from './intel-feed';
import { useDemo } from '@/demo/use-demo';
import { ScrollArea } from '@/components/ui/scroll-area';

export function LeftPanel() {
  const [activeTab, setActiveTab] = useState<'CYBER_FEED' | 'OSINT_FEED' | 'KINETIC_TRACKS'>('CYBER_FEED');
  const { demoState } = useDemo();

  // Auto-switch tab when a demo scene targets a specific feed
  useEffect(() => {
    if (!demoState.running || !demoState.autoTab) return;
    const tab = demoState.autoTab;
    if (tab === 'CYBER_FEED' || tab === 'OSINT_FEED' || tab === 'KINETIC_TRACKS') {
      setActiveTab(tab);
    }
  }, [demoState.currentScene, demoState.autoTab, demoState.running]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center border-b border-[#00ff8826] bg-[#00ff880a] shrink-0">
        <TabButton id="CYBER_FEED"    active={activeTab} onClick={setActiveTab} />
        <TabButton id="OSINT_FEED"    active={activeTab} onClick={setActiveTab} />
        <TabButton id="KINETIC_TRACKS" active={activeTab} onClick={setActiveTab} />
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'CYBER_FEED'      && <ThreatList />}
        {activeTab === 'OSINT_FEED'      && <IntelFeed />}
        {activeTab === 'KINETIC_TRACKS'  && <KineticTracks />}
      </div>
    </div>
  );
}

function TabButton({ id, active, onClick }: { id: any; active: string; onClick: (id: any) => void }) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-3 py-2 text-[10px] uppercase tracking-widest font-mono font-bold transition-colors flex-1 text-center ${
        isActive
          ? 'text-[#00ff88] border-b-2 border-[#00ff88] bg-[#00ff881a]'
          : 'text-[#888] border-b-2 border-transparent hover:text-white hover:bg-white/5'
      }`}
    >
      {id.replace('_', ' ')}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Kinetic Tracks — driven entirely by demo context
// ---------------------------------------------------------------------------
function KineticTracks() {
  const { demoState } = useDemo();
  const tracks  = demoState.trackUpdates;
  const started = demoState.running || demoState.complete || demoState.currentScene > 0;

  const getColor = (type: string) => {
    switch (type) {
      case 'hostile':  return '#ff1e3c';
      case 'unknown':  return '#ffb800';
      case 'friendly': return '#0078ff';
      default:         return '#888888';
    }
  };

  const sortedTracks = [...tracks].sort((a, b) => {
    const order: Record<string, number> = { hostile: 0, unknown: 1, neutral: 2, friendly: 3 };
    return (order[a.type] ?? 99) - (order[b.type] ?? 99);
  });

  const hostileCount = tracks.filter(t => t.type === 'hostile').length;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-[#00ff8826] bg-[#00ff880a] flex items-center justify-between shrink-0">
        <div className="font-mono text-xs text-white font-bold tracking-widest">
          {started ? (
            <>
              <span className="text-white">{tracks.length}</span>
              <span className="text-[#555]"> CONTACTS / </span>
              <span className="text-[#ff1e3c]">{hostileCount} HOSTILE</span>
            </>
          ) : (
            <span className="text-[#444]">NO CONTACTS TRACKED</span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {!started ? (
          <KineticStandby />
        ) : sortedTracks.length === 0 ? (
          <div className="p-6 text-center text-[#555] text-[11px] font-mono tracking-widest animate-pulse">
            ACQUIRING TRACKS...
          </div>
        ) : (
          <div className="p-2 flex flex-col gap-1">
            {sortedTracks.map(t => {
              const color = getColor(t.type);
              return (
                <div key={t.id} className="flex flex-col p-2.5 bg-black/50 border-l-2 hover:bg-white/[0.02] transition-colors gap-1.5"
                  style={{ borderLeftColor: color }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
                      <span className="text-white font-mono font-black text-sm tracking-wider">{t.label}</span>
                      <span className="text-[#555] text-[9px] font-mono">{t.id}</span>
                    </div>
                    <div className="text-[10px] font-black px-1.5 py-0.5 uppercase font-mono"
                      style={{ color, border: `1px solid ${color}4d`, backgroundColor: `${color}1a` }}>
                      {t.type}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-1.5">
                    <Field label="ALT" value={`${t.altitude.toFixed(0)}ft`} />
                    <Field label="SPD" value={`${t.speed.toFixed(0)}kt`} />
                    <Field label="HDG" value={`${t.heading.toFixed(0)}°`} />
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-mono">
                    <span className="text-[#555] uppercase">STATUS:</span>
                    <span className="font-bold" style={{ color: t.type === 'hostile' ? '#ff1e3c' : t.type === 'unknown' ? '#ffb800' : '#00ff88' }}>
                      {t.status.toUpperCase()}
                    </span>
                  </div>

                  {t.note && (
                    <div className="text-[9px] text-[#666] font-mono leading-snug border-t border-white/5 pt-1">
                      {t.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[#555] text-[8px] font-mono uppercase">{label}</span>
      <span className="text-white text-xs font-mono font-bold">{value}</span>
    </div>
  );
}

function KineticStandby() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-16 px-4 text-center">
      <div className="relative w-14 h-14 border border-[#111] flex items-center justify-center">
        <div className="absolute inset-0 border-2 border-[#0a0a0a]" style={{ margin: 2, borderRadius: 2 }} />
        <div className="w-4 h-4 border border-[#222] rotate-45" />
      </div>
      <div className="text-[#333] text-[11px] font-mono tracking-widest uppercase">KINETIC TRACKING</div>
      <div className="text-[#222] text-[10px] font-mono tracking-wider">— STANDBY —</div>
      <div className="text-[#181818] text-[9px] font-mono tracking-wide mt-1 leading-relaxed max-w-[180px]">
        TRACK DATA WILL APPEAR AS DEMO SCENES ADVANCE
      </div>
    </div>
  );
}
