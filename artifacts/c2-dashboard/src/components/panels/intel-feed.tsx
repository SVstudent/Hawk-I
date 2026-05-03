import { ScrollArea } from '@/components/ui/scroll-area';
import { useDemo } from '@/demo/use-demo';
import { Satellite } from 'lucide-react';

export function IntelFeed() {
  const { demoState } = useDemo();
  const items    = demoState.intelItems;
  const started  = demoState.running || demoState.complete || demoState.currentScene > 0;

  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'kinetic':      return '#ff1e3c';
      case 'cyber':        return '#ff6400';
      case 'threat':       return '#ffb800';
      case 'vulnerability':return '#a78bfa';
      default:             return '#00ff88';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-[#00ff8826] bg-[#00ff880a] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Satellite className="w-3.5 h-3.5 text-[#00ff88]" />
          <span className="font-mono font-bold text-xs tracking-widest text-white">OSINT_FEED</span>
        </div>
        <div className="text-[10px] font-bold px-2 py-0.5 border"
          style={{
            color: items.length > 0 ? '#00ff88' : '#555',
            borderColor: items.length > 0 ? '#00ff8866' : '#333',
            backgroundColor: items.length > 0 ? '#00ff8811' : 'transparent',
          }}
        >
          {items.length} ITEMS
        </div>
      </div>

      <ScrollArea className="flex-1">
        {!started ? (
          <StandbyPlaceholder />
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-[#555] text-[11px] font-mono tracking-widest animate-pulse">
            SCANNING RED SEA FEEDS...
          </div>
        ) : (
          <div className="p-2 flex flex-col gap-2">
            {[...items].reverse().map((item) => (
              <div
                key={item.id}
                className="p-3 bg-black/40 border-l-2 hover:bg-white/[0.02] transition-colors flex flex-col gap-2"
                style={{ borderLeftColor: categoryColor(item.category) }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 border font-mono"
                    style={{
                      color: categoryColor(item.category),
                      borderColor: `${categoryColor(item.category)}55`,
                      backgroundColor: `${categoryColor(item.category)}15`,
                    }}>
                    {item.category}
                  </div>
                  <div className="text-[9px] text-[#555] shrink-0 font-mono">
                    {new Date(item.publishedDate).toUTCString().slice(5, 22)}Z
                  </div>
                </div>

                <div className="text-white text-xs font-mono leading-tight font-semibold">
                  {item.title}
                </div>

                <div className="text-[#aaa] text-[10px] leading-relaxed">
                  {item.summary}
                </div>

                <div className="flex items-center justify-between mt-1">
                  <div className="text-[9px] text-[#555] uppercase tracking-wider font-mono">
                    SRC: <span className="text-[#00ff8899]">{item.source}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="text-[9px] text-[#555] font-mono">CONF:</div>
                    <div className="w-14 h-1 bg-[#111] rounded overflow-hidden">
                      <div className="h-full rounded"
                        style={{ width: `${Math.round(item.score * 100)}%`, backgroundColor: categoryColor(item.category) }} />
                    </div>
                    <div className="text-[9px] font-bold font-mono" style={{ color: categoryColor(item.category) }}>
                      {Math.round(item.score * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function StandbyPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-16 px-4 text-center">
      <div className="relative w-14 h-14 border border-[#222] flex items-center justify-center">
        <div className="w-5 h-5 border border-[#333]" />
        <div className="absolute inset-0 border border-[#111]" style={{ margin: 3 }} />
      </div>
      <div className="text-[#444] text-[11px] font-mono tracking-widest uppercase">OSINT COLLECTION</div>
      <div className="text-[#333] text-[10px] font-mono tracking-wider">— STANDBY —</div>
      <div className="text-[#222] text-[9px] font-mono tracking-wide mt-1 leading-relaxed max-w-[180px]">
        PRESS START DEMO IN BOTTOM BAR TO BEGIN LIVE DATA ORCHESTRATION
      </div>
    </div>
  );
}
