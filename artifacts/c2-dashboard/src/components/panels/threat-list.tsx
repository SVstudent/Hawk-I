import { useDemo } from '@/demo/use-demo';
import { ShieldAlert, Server, MapPin } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ThreatList() {
  const { demoState } = useDemo();
  const threats  = demoState.cyberThreats;
  const started  = demoState.running || demoState.complete || demoState.currentScene > 0;

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical': return { color: '#ff1e3c', bg: 'rgba(255,30,60,0.12)', border: '#ff1e3c66', glow: '0 0 8px #ff1e3c44' };
      case 'high':     return { color: '#ff6400', bg: 'rgba(255,100,0,0.10)', border: '#ff640066', glow: 'none' };
      case 'medium':   return { color: '#ffb800', bg: 'rgba(255,184,0,0.10)', border: '#ffb80066', glow: 'none' };
      default:         return { color: '#00ff88', bg: 'rgba(0,255,136,0.08)', border: '#00ff8855', glow: 'none' };
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-[#ff1e3c26] bg-[#ff1e3c0a] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#ff1e3c]" />
          <span className="font-mono font-bold text-xs tracking-widest text-white">SHODAN_THREATS</span>
        </div>
        <div className="text-[10px] font-bold px-2 py-0.5 border"
          style={{
            color: threats.length > 0 ? '#ff1e3c' : '#555',
            borderColor: threats.length > 0 ? '#ff1e3c55' : '#333',
            backgroundColor: threats.length > 0 ? '#ff1e3c0d' : 'transparent',
          }}
        >
          {threats.length > 0 ? `${threats.length} DETECTED` : '0 DETECTED'}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {!started ? (
          <CyberStandby />
        ) : threats.length === 0 ? (
          <div className="p-6 text-center text-[#555] text-[11px] font-mono tracking-widest animate-pulse">
            SCANNING ICS/SCADA EXPOSURE...
          </div>
        ) : (
          <div className="p-2 flex flex-col gap-2">
            {threats.map((threat, i) => {
              const s = getSeverityStyles(threat.severity);
              return (
                <div
                  key={`${threat.ip}-${threat.port}-${i}`}
                  className="p-3 bg-black/50 border-l-2 hover:bg-white/[0.02] transition-colors flex flex-col gap-2"
                  style={{ borderLeftColor: s.color }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Server className="w-3 h-3 shrink-0" style={{ color: s.color }} />
                      <span className="text-white font-bold font-mono text-sm">{threat.ip}</span>
                      <span className="text-[#555] text-xs font-mono">:{threat.port}</span>
                    </div>
                    <div className="text-[10px] uppercase font-black tracking-widest px-2 py-0.5 shrink-0 font-mono"
                      style={{ color: s.color, border: `1px solid ${s.border}`, backgroundColor: s.bg, boxShadow: s.glow }}>
                      {threat.severity}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] font-mono uppercase tracking-wider">
                    <div className="flex flex-col">
                      <span className="text-[#555]">ORG</span>
                      <span style={{ color: s.color }} className="truncate" title={threat.org}>{threat.org}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[#555]">PRODUCT</span>
                      <span className="text-white truncate" title={threat.product}>{threat.product}</span>
                    </div>
                  </div>

                  {threat.attacker && (
                    <div className="text-[10px] font-mono">
                      <span className="text-[#555]">ACTOR: </span>
                      <span style={{ color: '#ff6400' }} className="font-bold">{threat.attacker}</span>
                    </div>
                  )}

                  {threat.location && (
                    <div className="flex items-center gap-1 text-[10px] text-[#666] font-mono mt-0.5">
                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{threat.location}</span>
                    </div>
                  )}

                  {threat.description && (
                    <div className="text-[9px] text-[#888] leading-relaxed border-t border-white/5 pt-2 mt-1">
                      {threat.description.slice(0, 160)}{threat.description.length > 160 ? '…' : ''}
                    </div>
                  )}

                  {threat.vulnerabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {threat.vulnerabilities.slice(0, 3).map(v => (
                        <span key={v} className="text-[9px] px-1.5 py-0.5 font-mono"
                          style={{ color: '#ff6400', border: '1px solid #ff640033', backgroundColor: '#ff640010' }}>
                          {v}
                        </span>
                      ))}
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

function CyberStandby() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-16 px-4 text-center">
      <div className="relative w-14 h-14 border border-[#1a0808] flex items-center justify-center">
        <Server className="w-5 h-5 text-[#2a1010]" />
      </div>
      <div className="text-[#442222] text-[11px] font-mono tracking-widest uppercase">CYBER THREAT SCAN</div>
      <div className="text-[#2a1515] text-[10px] font-mono tracking-wider">— STANDBY —</div>
      <div className="text-[#1a0808] text-[9px] font-mono tracking-wide mt-1 leading-relaxed max-w-[180px]">
        SHODAN ICS/SCADA SCAN WILL POPULATE WHEN DEMO STARTS
      </div>
    </div>
  );
}
