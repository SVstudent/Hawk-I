import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useDemo } from '@/demo/use-demo';

// ---------------------------------------------------------------------------
// HAWK-I — Floating AIP Long-Term Memory Chatbot
// Round FAB fixed to bottom-right; expands to a 460×580px floating overlay.
// ---------------------------------------------------------------------------

const FOUNDRY_BASE = "https://nshackathon.palantirfoundry.com";
const MEMORY_OBJECT_URL = `${FOUNDRY_BASE}/workspace/ontology/objects/example-rv17-memory`;
const ONTOLOGY_RID_SHORT = "runtime-configured";
const ONTOLOGY_URL = `${FOUNDRY_BASE}/workspace/ontology`;

const DATASET_URLS: Record<string, string> = {
  LogisticsVessel:          `${FOUNDRY_BASE}/workspace/data-integration`,
  HostileThreat:            `${FOUNDRY_BASE}/workspace/data-integration`,
  CombatUnit:               `${FOUNDRY_BASE}/workspace/data-integration`,
  ConfirmedKineticIncident: `${FOUNDRY_BASE}/workspace/data-integration`,
  GeneratedTacticalLead:    `${FOUNDRY_BASE}/workspace/data-integration`,
  SigintIntercept:          `${FOUNDRY_BASE}/workspace/data-integration`,
  IsrImagery:               `${FOUNDRY_BASE}/workspace/data-integration`,
  HumintReport:             `${FOUNDRY_BASE}/workspace/data-integration`,
  MaritimeAisTrack:         `${FOUNDRY_BASE}/workspace/data-integration`,
  CyberIoc:                 `${FOUNDRY_BASE}/workspace/data-integration`,
  ExampleRv17memory:        `${FOUNDRY_BASE}/workspace/data-integration`,
};

const DS_ICON: Record<string, string> = {
  LogisticsVessel: '🚢', HostileThreat: '⚠️', CombatUnit: '🪖',
  ConfirmedKineticIncident: '💥', GeneratedTacticalLead: '🎯',
  SigintIntercept: '📡', IsrImagery: '🛰️', HumintReport: '🕵️',
  MaritimeAisTrack: '📍', CyberIoc: '🔴', ExampleRv17memory: '🧠',
};
const dsIcon = (ds: string) => DS_ICON[ds] ?? '📂';

const QUICK_PROMPTS = [
  "SITREP: Highest-priority threats right now?",
  "COA recommendation for active kinetic incident?",
  "SIGINT + HUMINT corroboration for THR-003?",
  "Which AIS deviations indicate vessel compromise?",
  "Cyber IOCs attributed to APT-41?",
];

interface FoundrySource {
  type: string; label: string; objectType?: string; primaryKey?: string;
  url: string; confidence?: number;
}
interface FoundryProvenanceChain {
  id: string; totalObjectsConsulted: number; totalLinksTraversed: number;
  traversalPath: string[]; sources: FoundrySource[];
  ontologyUrl: string; decisionTimestamp: string;
}
interface ChatEntry {
  id:       string;
  role:     'user' | 'assistant' | 'system';
  content:  string;
  provenance?: {
    memoryCount:     number;
    memoriesUsed:    boolean;
    ontologyUsed:    boolean;
    datasetsQueried: string[];
    modelVersion:    string;
    chain?:          FoundryProvenanceChain;
  };
}

// ---------------------------------------------------------------------------
// Markdown renderer — styled to match the military terminal aesthetic
// ---------------------------------------------------------------------------
function MdResponse({ content }: { content: string }) {
  return (
    <div
      className="md-response"
      style={{ fontSize: '13px', lineHeight: '1.7', color: '#d9f7ee', fontFamily: 'Inter, sans-serif' }}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <div style={{ color: '#00ff88', fontWeight: 700, fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid rgba(0,255,136,0.18)', paddingBottom: '4px', marginBottom: '10px', marginTop: '6px' }}>{children}</div>
          ),
          h2: ({ children }) => (
            <div style={{ color: '#00ff88', fontWeight: 700, fontSize: '12px', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '6px', marginTop: '12px' }}>{children}</div>
          ),
          h3: ({ children }) => (
            <div style={{ color: '#7dd3fc', fontWeight: 700, fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '5px', marginTop: '10px' }}>{children}</div>
          ),
          p: ({ children }) => (
            <p style={{ marginBottom: '10px', lineHeight: '1.7', color: '#d9f7ee' }}>{children}</p>
          ),
          ul: ({ children }) => (
            <ul style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px', listStyle: 'disc', paddingLeft: '18px' }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px', listStyle: 'decimal', paddingLeft: '18px' }}>{children}</ol>
          ),
          li: ({ children }) => (
            <li style={{ lineHeight: '1.65', color: '#d9f7ee', paddingLeft: '2px' }}>{children}</li>
          ),
          strong: ({ children }) => (
            <strong style={{ color: '#ffffff', fontWeight: 700 }}>{children}</strong>
          ),
          em: ({ children }) => (
            <em style={{ color: '#93c5fd', fontStyle: 'normal', fontWeight: 600 }}>{children}</em>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            return isBlock ? (
              <code style={{ display: 'block', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,255,136,0.12)', color: '#b6f7d8', fontSize: '11px', padding: '8px 10px', margin: '8px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderRadius: '2px', fontFamily: 'Fira Code, monospace' }}>{children}</code>
            ) : (
              <code style={{ background: 'rgba(0,0,0,0.45)', color: '#8be9fd', fontSize: '11px', padding: '1px 4px', border: '1px solid rgba(0,188,212,0.25)', borderRadius: '2px', fontFamily: 'Fira Code, monospace' }}>{children}</code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote style={{ borderLeft: '2px solid rgba(0,255,136,0.25)', paddingLeft: '10px', color: '#a7c7bf', margin: '8px 0' }}>{children}</blockquote>
          ),
          hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(0,255,136,0.12)', margin: '10px 0' }} />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" style={{ color: '#7dd3fc', textDecoration: 'underline' }}>{children}</a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function HawkIChat() {
  const [open,    setOpen]    = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([{
    id: 'init', role: 'system',
    content: 'HAWK-I ONLINE // PALANTIR LONG-TERM MEMORY ACTIVE // 10 FOUNDRY DATASETS // READY',
  }]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [bbEntry,  setBbEntry]  = useState<string | null>(null);
  const [memCount, setMemCount] = useState<number | null>(null);
  const [pulse,    setPulse]    = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const { demoState } = useDemo();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [entries]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    fetch('/api/memory').then(r => r.json()).then((d: any) => {
      if (typeof d?.count === 'number') setMemCount(d.count);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (demoState.currentScene > 0 && !open) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 2000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [demoState.currentScene, open]);

  const submit = useCallback(async (query: string) => {
    if (!query.trim() || loading) return;
    setEntries(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: query.trim() }]);
    setInput('');
    setLoading(true);
    const thinkId = `t-${Date.now()}`;
    setEntries(prev => [...prev, { id: thinkId, role: 'system', content: 'QUERYING PALANTIR MEMORY + 10 DATASETS...' }]);
    try {
      const res  = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), sessionId: 'commander-default' }),
      });
      const data = await res.json() as {
        answer?: string; error?: string;
        memoryCount?: number; memoriesUsed?: boolean; ontologyUsed?: boolean;
        datasetsQueried?: string[]; modelVersion?: string;
        provenanceChain?: {
          id: string; totalObjectsConsulted: number; totalLinksTraversed: number;
          traversalPath: string[]; sources: { type: string; label: string; objectType?: string; primaryKey?: string; url: string; confidence?: number }[];
          ontologyUrl: string; decisionTimestamp: string;
        };
      };
      const newCount = data.memoryCount ?? 0;
      setMemCount(newCount);
      setEntries(prev => prev.filter(e => e.id !== thinkId).concat({
        id: `a-${Date.now()}`, role: 'assistant',
        content: data.answer ?? data.error ?? 'NO RESPONSE',
        provenance: {
          memoryCount:     newCount,
          memoriesUsed:    data.memoriesUsed    ?? false,
          ontologyUsed:    data.ontologyUsed    ?? false,
          datasetsQueried: data.datasetsQueried ?? [],
          modelVersion:    data.modelVersion    ?? 'HAWK-I',
          chain:           data.provenanceChain,
        },
      }));
    } catch {
      setEntries(prev => prev.filter(e => e.id !== thinkId).concat({
        id: `err-${Date.now()}`, role: 'system',
        content: 'COMMS FAILURE — HAWK-I ENGINE UNREACHABLE',
      }));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [loading]);

  const clearMemory = useCallback(async () => {
    await fetch('/api/memory/clear', { method: 'POST' });
    setMemCount(0);
    setEntries([{ id: 'cleared', role: 'system', content: 'MEMORY CLEARED // ExampleRv17memory FLUSHED' }]);
  }, []);

  return (
    <>
      {/* ── Floating chat window ── */}
      {open && (
        <div
          className="fixed z-[200] flex flex-col"
          style={{
            right:      '1.25rem',
            bottom:     '5rem',
            width:      '460px',
            height:     '580px',
            background: 'rgba(4, 10, 5, 0.98)',
            border:     '1px solid rgba(0,255,136,0.3)',
            boxShadow:  '0 0 60px rgba(0,255,136,0.15), 0 12px 60px rgba(0,0,0,0.9)',
            fontFamily: 'monospace',
          }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#00ff8830] bg-[#00ff8810] shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-[15px] font-black text-white tracking-widest">HAWK-I</span>
              <span className="text-[10px] font-mono text-[#00bcd4] border border-[#00bcd440] px-1.5 py-0.5">AIP MEMORY</span>
              {memCount !== null && (
                <a
                  href={MEMORY_OBJECT_URL} target="_blank" rel="noreferrer"
                  className="text-[10px] font-mono text-[#00bcd4] hover:text-white border border-[#00bcd430] px-1.5 py-0.5 transition-colors"
                  title="View memory objects in Palantir Foundry"
                >
                  MEM:{memCount} ↗
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${loading ? 'bg-[#ffb800] animate-pulse' : 'bg-[#00ff88]'}`}
                style={{ boxShadow: loading ? '0 0 6px #ffb800' : '0 0 6px #00ff88' }}
              />
              <span className="text-[11px] font-mono text-[#aaa]">{loading ? 'PROCESSING' : 'READY'}</span>
              <button
                onClick={clearMemory}
                className="text-[10px] font-mono text-[#888] hover:text-[#ff6400] border border-transparent hover:border-[#ff640040] px-1.5 py-0.5 transition-colors"
                title="Clear all long-term memories"
              >
                CLR
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-[#888] hover:text-white text-[18px] leading-none transition-colors"
              >
                ×
              </button>
            </div>
          </div>

          {/* ── Scene context strip ── */}
          {(demoState.running || demoState.currentScene > 0) && (
            <div className="px-4 py-1 bg-[#00ff8808] border-b border-[#00ff8818] flex items-center gap-3 shrink-0">
              <div className="text-[10px] font-mono text-[#00ff8888] tracking-widest truncate flex-1">
                SCENE {demoState.currentScene}: {demoState.sceneLabel || 'ACTIVE'}
              </div>
              <div className="flex items-center gap-2 shrink-0 text-[11px]">
                {(demoState.sigintItems?.length ?? 0) > 0  && <span className="text-[#a78bfa]">📡 {demoState.sigintItems.length}</span>}
                {(demoState.isrItems?.length ?? 0) > 0     && <span className="text-[#34d399]">🛰️ {demoState.isrItems.length}</span>}
                {(demoState.humintItems?.length ?? 0) > 0  && <span className="text-[#fb923c]">🕵️ {demoState.humintItems.length}</span>}
                {(demoState.aisItems?.length ?? 0) > 0     && <span className="text-[#22d3ee]">📍 {demoState.aisItems.length}</span>}
                {(demoState.iocItems?.length ?? 0) > 0     && <span className="text-[#f43f5e]">🔴 {demoState.iocItems.length}</span>}
              </div>
            </div>
          )}

          {/* ── Messages ── */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {entries.map(entry => (
              <div key={entry.id}>

                {/* User bubble */}
                {entry.role === 'user' && (
                  <div className="flex justify-end">
                    <div
                      className="max-w-[82%] px-3 py-2"
                      style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)' }}
                    >
                      <span className="text-[#00ff88] font-mono text-[13px] leading-relaxed">{entry.content}</span>
                    </div>
                  </div>
                )}

                {/* Assistant bubble */}
                {entry.role === 'assistant' && (
                  <div className="flex flex-col gap-1.5">
                    <div
                      className="px-3 py-2.5"
                      style={{ background: 'rgba(0,188,212,0.07)', border: '1px solid rgba(0,188,212,0.2)' }}
                    >
                      <div className="text-[10px] font-mono text-[#00bcd4] font-bold tracking-widest mb-2">HAWK-I</div>
                      <MdResponse content={entry.content} />
                    </div>

                    {/* Provenance row */}
                    {entry.provenance && (
                      <div className="flex items-center gap-2 flex-wrap px-1">
                        {entry.provenance.memoriesUsed && (
                          <a href={MEMORY_OBJECT_URL} target="_blank" rel="noreferrer"
                            className="text-[10px] font-mono text-[#00bcd4] hover:text-white border border-[#00bcd430] px-1 py-0.5 transition-colors">
                            🧠 MEM:{entry.provenance.memoryCount} ↗
                          </a>
                        )}
                        {entry.provenance.ontologyUsed && (
                          <span className="text-[10px] font-mono text-[#00bcd4] border border-[#00bcd430] px-1 py-0.5">
                            ONTOLOGY:LIVE
                          </span>
                        )}
                        <div className="flex gap-1">
                          {entry.provenance.datasetsQueried.slice(0, 6).map(ds => (
                            <span key={ds} className="text-[11px]" title={ds}>{dsIcon(ds)}</span>
                          ))}
                        </div>
                        <button
                          onClick={() => setBbEntry(bbEntry === entry.id ? null : entry.id)}
                          className="text-[9px] font-black px-2 py-0.5 border font-mono tracking-widest transition-all ml-auto"
                          style={{
                            color:           bbEntry === entry.id ? '#050508' : '#00bcd4',
                            borderColor:     '#00bcd440',
                            backgroundColor: bbEntry === entry.id ? '#00bcd4' : 'rgba(0,188,212,0.1)',
                          }}
                        >
                          BLACKBOX
                        </button>
                      </div>
                    )}

                    {/* BLACKBOX drawer */}
                    {bbEntry === entry.id && entry.provenance && (
                      <div className="mx-1 border border-[#00bcd430] bg-[#000d12] p-3 flex flex-col gap-2 font-mono">
                        <div className="text-[10px] text-[#00bcd4] tracking-widest uppercase border-b border-[#00bcd420] pb-1.5 font-bold flex items-center justify-between">
                          <span>AIP PROVENANCE — RESOURCES USED</span>
                          {entry.provenance.chain && (
                            <span className="text-[8px] text-[#555] font-normal">{entry.provenance.chain.id}</span>
                          )}
                        </div>

                        {/* Memory */}
                        <div>
                          <div className="text-[9px] text-[#888] uppercase tracking-widest mb-1">🧠 LONG-TERM MEMORY</div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#00bcd4]">ExampleRv17memory ×{entry.provenance.memoryCount}</span>
                            <a href={MEMORY_OBJECT_URL} target="_blank" rel="noreferrer"
                              className="text-[9px] text-[#00bcd455] hover:text-[#00bcd4] border border-[#00bcd422] px-1">OBJECTS ↗</a>
                            <a href={DATASET_URLS['ExampleRv17memory']} target="_blank" rel="noreferrer"
                              className="text-[9px] text-[#a78bfa55] hover:text-[#a78bfa] border border-[#a78bfa22] px-1">DATASET ↗</a>
                          </div>
                        </div>

                        {/* Datasets queried — each with a real clickable link */}
                        <div className="border-t border-[#00bcd420] pt-2">
                          <div className="text-[9px] text-[#888] uppercase tracking-widest mb-1.5">
                            📊 DATASETS QUERIED ({entry.provenance.datasetsQueried.filter(d => d !== 'ExampleRv17memory' && d !== 'BattlespaceCache').length})
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {entry.provenance.datasetsQueried
                              .filter(ds => ds !== 'ExampleRv17memory' && ds !== 'BattlespaceCache')
                              .map(ds => {
                                const url = DATASET_URLS[ds];
                                return (
                                  <div key={ds} className="flex items-center gap-1.5 text-[9px] border border-[#00bcd418] px-1 py-0.5 bg-[#00bcd408]">
                                    <span>{dsIcon(ds)}</span>
                                    <span className="text-[#00bcd477] flex-1">{ds}</span>
                                    {url
                                      ? <a href={url} target="_blank" rel="noreferrer" className="text-[#00bcd433] hover:text-[#00bcd4] underline shrink-0">↗ DATA</a>
                                      : <span className="text-[#333]">—</span>
                                    }
                                  </div>
                                );
                              })
                            }
                          </div>
                        </div>

                        {/* Provenance chain stats from the server */}
                        {entry.provenance.chain && (
                          <div className="border-t border-[#00bcd420] pt-2">
                            <div className="text-[9px] text-[#888] uppercase tracking-widest mb-1">🔗 EVIDENCE CHAIN</div>
                            <div className="flex gap-3 text-[9px] mb-1.5">
                              <span className="text-[#555]">Objects:</span>
                              <span className="text-[#00bcd4]">{entry.provenance.chain.totalObjectsConsulted}</span>
                              <span className="text-[#555]">Links:</span>
                              <span className="text-[#00bcd4]">{entry.provenance.chain.totalLinksTraversed}</span>
                              <a href={entry.provenance.chain.ontologyUrl} target="_blank" rel="noreferrer"
                                className="ml-auto text-[#00bcd433] hover:text-[#00bcd4] border border-[#00bcd422] px-1">ONTOLOGY ↗</a>
                            </div>
                            {entry.provenance.chain.sources.filter(s => s.confidence === 1.0).length > 0 && (
                              <>
                                <div className="text-[8px] text-[#888] uppercase tracking-widest mb-0.5">🎯 DIRECTLY REFERENCED IN RESPONSE</div>
                                <div className="flex flex-col gap-0.5">
                                  {entry.provenance.chain.sources.filter(s => s.confidence === 1.0).slice(0, 8).map((s, i) => (
                                    <a key={i} href={s.url} target="_blank" rel="noreferrer"
                                      className="text-[9px] text-[#00ff8877] hover:text-[#00ff88] border border-[#00ff8820] px-1 py-0.5 truncate">
                                      {s.objectType && dsIcon(s.objectType)} {s.primaryKey ?? s.label}
                                    </a>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Ontology link */}
                        {entry.provenance.ontologyUsed && (
                          <div className="border-t border-[#00bcd420] pt-2">
                            <div className="text-[9px] text-[#888] uppercase tracking-widest mb-1">🌐 ONTOLOGY GRAPH</div>
                            <a href={ONTOLOGY_URL} target="_blank" rel="noreferrer"
                              className="text-[9px] text-[#00bcd444] hover:text-[#00bcd4] underline block truncate">{ONTOLOGY_RID_SHORT}</a>
                          </div>
                        )}

                        <div className="border-t border-[#00bcd420] pt-2 text-[9px] text-[#444] truncate">
                          {entry.provenance.modelVersion}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* System message */}
                {entry.role === 'system' && (
                  <div className="text-[10px] font-mono text-[#555] tracking-widest text-center py-1 italic">
                    [ {entry.content} ]
                  </div>
                )}
              </div>
            ))}

            {/* Quick prompts */}
            {entries.length <= 2 && (
              <div className="flex flex-col gap-1 mt-2">
                <div className="text-[10px] font-mono text-[#555] tracking-widest uppercase mb-1">QUICK QUERIES</div>
                {QUICK_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => submit(p)}
                    className="text-left text-[11px] font-mono text-[#00ff8877] hover:text-[#00ff88] hover:border-[#00ff8830] border border-transparent px-2 py-1 transition-colors"
                  >
                    › {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Input bar ── */}
          <div className="px-4 py-3 border-t border-[#00ff8828] shrink-0 bg-black/60">
            <div className="flex items-center gap-2">
              <span className="text-[#00ff88] font-mono text-[14px] font-bold shrink-0">›</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(input); } }}
                disabled={loading}
                placeholder="Tactical query..."
                className="flex-1 bg-transparent text-[#00ff88] font-mono text-[13px] outline-none placeholder-[#2a4433] caret-[#00ff88] disabled:opacity-50"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                onClick={() => submit(input)}
                disabled={loading || !input.trim()}
                className="text-[11px] font-mono text-[#00ff88] border border-[#00ff8850] px-3 py-1 hover:bg-[#00ff8818] disabled:opacity-30 transition-colors tracking-widest shrink-0"
              >
                SEND
              </button>
            </div>
            <div className="text-[9px] font-mono text-[#333] tracking-widest mt-1.5">
              HAWK-I · AIP AGENT · ExampleRv17memory · gpt-5.4 · PALANTIR FOUNDRY
            </div>
          </div>
        </div>
      )}

      {/* ── FAB — round button fixed to bottom-right ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed z-[201] flex items-center justify-center transition-all duration-200 active:scale-95 select-none"
        style={{
          right:        '1.25rem',
          bottom:       '1rem',
          width:        '52px',
          height:       '52px',
          borderRadius: '50%',
          background:   open ? 'rgba(0,255,136,0.18)' : 'rgba(4,10,5,0.97)',
          border:       open
            ? '2px solid rgba(0,255,136,0.75)'
            : `2px solid rgba(0,255,136,${pulse ? '0.85' : '0.4'})`,
          boxShadow:    open
            ? '0 0 32px rgba(0,255,136,0.45), 0 4px 24px rgba(0,0,0,0.8)'
            : pulse
              ? '0 0 24px rgba(0,255,136,0.55), 0 4px 18px rgba(0,0,0,0.7)'
              : '0 0 14px rgba(0,255,136,0.2), 0 4px 18px rgba(0,0,0,0.7)',
        }}
        title={open ? 'Close HAWK-I' : 'Open HAWK-I Tactical Assistant'}
        aria-label="HAWK-I Chat"
      >
        {open ? (
          <span className="text-[#00ff88] font-mono font-black text-[20px] leading-none">×</span>
        ) : (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="12" stroke="rgba(0,255,136,0.65)" strokeWidth="1.2" fill="none"/>
            <line x1="14" y1="2"  x2="14" y2="7"  stroke="rgba(0,255,136,0.55)" strokeWidth="1.4"/>
            <line x1="14" y1="21" x2="14" y2="26" stroke="rgba(0,255,136,0.55)" strokeWidth="1.4"/>
            <line x1="2"  y1="14" x2="7"  y2="14" stroke="rgba(0,255,136,0.55)" strokeWidth="1.4"/>
            <line x1="21" y1="14" x2="26" y2="14" stroke="rgba(0,255,136,0.55)" strokeWidth="1.4"/>
            <circle cx="14" cy="14" r="5" stroke="rgba(0,255,136,0.85)" strokeWidth="1.2" fill="rgba(0,255,136,0.08)"/>
            <circle cx="14" cy="14" r="1.8" fill="rgba(0,255,136,0.95)"/>
            {loading && (
              <circle cx="14" cy="14" r="9" stroke="rgba(255,184,0,0.45)" strokeWidth="1" fill="none" strokeDasharray="4 3"/>
            )}
          </svg>
        )}

        {/* Memory count badge */}
        {!open && (memCount ?? 0) > 0 && (
          <div
            className="absolute top-0 right-0 w-4 h-4 rounded-full flex items-center justify-center"
            style={{
              background:  '#00bcd4',
              border:      '1.5px solid rgba(4,10,5,0.97)',
              fontSize:    '8px',
              fontFamily:  'monospace',
              color:       '#000',
              fontWeight:  'bold',
              transform:   'translate(30%, -30%)',
            }}
          >
            {Math.min(memCount ?? 0, 99)}
          </div>
        )}
      </button>
    </>
  );
}
