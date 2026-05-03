import { useState, useRef, useEffect, useCallback } from 'react';
import { useDemo } from '@/demo/use-demo';
import { ScrollArea } from '@/components/ui/scroll-area';
import type {
  DemoCoaItem, DemoEvidenceLink, DemoOntologyEdge,
  DemoFoundryProvenance, DemoProvenanceDataset, DemoProvenanceLink,
} from '@/demo/demo-scenes';
import { DEMO_SCENES, TOTAL_DEMO_MS } from '@/demo/demo-scenes';

// ---------------------------------------------------------------------------
// Layout: 44% COA | 56% Ontology  (HAWK-I chat is a floating overlay)
// ---------------------------------------------------------------------------
export function RightPanel() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="h-[44%] flex flex-col overflow-hidden border-b border-[#00ff881f]">
        <CoaPanel />
      </div>
      <div className="h-[56%] flex flex-col overflow-hidden">
        <OntologyPanel />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
const getPriColor = (p: number) => {
  switch (p) { case 1: return '#ff1e3c'; case 2: return '#ff6400'; case 3: return '#ffb800'; default: return '#00ff88'; }
};
const getUrgencyStyle = (u: string) => {
  switch (u) {
    case 'immediate': return { color: '#ff1e3c', bg: '#ff1e3c18', border: '#ff1e3c55', glow: '0 0 8px #ff1e3c55' };
    case 'high':      return { color: '#ff6400', bg: '#ff640018', border: '#ff640055', glow: 'none' };
    case 'near-term': return { color: '#ffb800', bg: '#ffb80018', border: '#ffb80055', glow: 'none' };
    default:          return { color: '#00ff88', bg: '#00ff8818', border: '#00ff8855', glow: 'none' };
  }
};

const ROLE_META: Record<string, { color: string; icon: string; label: string }> = {
  TRIGGER:               { color: '#ff1e3c', icon: '⚡', label: 'TRIGGER' },
  INCIDENT:              { color: '#f97316', icon: '💥', label: 'INCIDENT' },
  ASSET_AT_RISK:         { color: '#ffb800', icon: '🚢', label: 'ASSET AT RISK' },
  RECOMMENDATION:        { color: '#00bcd4', icon: '🎯', label: 'COA / LEAD' },
  SIGINT_CORROBORATION:  { color: '#a78bfa', icon: '📡', label: 'SIGINT' },
  ISR_CONFIRMATION:      { color: '#34d399', icon: '🛰️', label: 'ISR' },
  HUMINT_REPORT:         { color: '#fb923c', icon: '🕵️', label: 'HUMINT' },
  AIS_TRACK:             { color: '#22d3ee', icon: '📍', label: 'AIS TRACK' },
  IOC_INDICATOR:         { color: '#f43f5e', icon: '🔴', label: 'IOC' },
};

const TYPE_COLOR: Record<string, string> = {
  actor: '#ff6400', infrastructure: '#ffb800', vessel: '#60a5fa',
  unit: '#00ff88', event: '#f97316', threat: '#ff1e3c',
  sigint: '#a78bfa', isr: '#34d399', humint: '#fb923c',
  ais: '#22d3ee', ioc: '#f43f5e', lead: '#00bcd4',
};
const getTypeColor = (type: string) => TYPE_COLOR[type] ?? '#888';

const DS_ICON: Record<string, string> = {
  LogisticsVessel: '🚢', HostileThreat: '⚠️', CombatUnit: '🪖',
  ConfirmedKineticIncident: '💥', GeneratedTacticalLead: '🎯',
  SigintIntercept: '📡', IsrImagery: '🛰️', HumintReport: '🕵️',
  MaritimeAisTrack: '📍', CyberIoc: '🔴',
};
const dsIcon = (ds: string) => DS_ICON[ds] ?? '📂';

type InsightKind = 'impact' | 'change' | 'prevention';

interface GeneratedInsight {
  id: string;
  kind: InsightKind;
  label: string;
  headline: string;
  detail: string;
  accent: string;
}

const INSIGHT_META: Record<InsightKind, { label: string; icon: string }> = {
  impact:     { label: 'IMPACT',     icon: '▲' },
  change:     { label: 'CHANGE',     icon: '◌' },
  prevention: { label: 'PREVENTION', icon: '■' },
};

function getSceneById(sceneId: number) {
  return DEMO_SCENES.find(scene => scene.id === sceneId) ?? null;
}

function getSceneDurationMs(sceneId: number) {
  const currentIndex = DEMO_SCENES.findIndex(scene => scene.id === sceneId);
  if (currentIndex < 0) return 20000;
  const current = DEMO_SCENES[currentIndex]!;
  const next = DEMO_SCENES[currentIndex + 1];
  return (next?.startMs ?? TOTAL_DEMO_MS) - current.startMs;
}

function buildSupplyChainInsights(
  currentSceneId: number,
  currentLabel: string,
): GeneratedInsight[] {
  switch (currentSceneId) {
    case 1:
      return [
        {
          id: 'scene-1-impact',
          kind: 'impact',
          label: 'Queue Impact',
          headline: 'Suez congestion is already compressing downstream resupply windows.',
          detail: '47 northbound vessels are delayed, including VSL-004 and VSL-008, which narrows UNIT-DELTA and UNIT-CHARLIE replenishment slack before any direct attack occurs.',
          accent: '#ffb800',
        },
        {
          id: 'scene-1-change',
          kind: 'change',
          label: 'Baseline Shift',
          headline: 'The supply network has moved from normal throughput to constrained flow.',
          detail: 'MARSEC Level 3 and the Port Said queue indicate that the theater is no longer dealing with isolated incidents; routing friction is now a live operational condition.',
          accent: '#22d3ee',
        },
        {
          id: 'scene-1-prevention',
          kind: 'prevention',
          label: 'Prevention Move',
          headline: 'Pre-stage alternate lift and reroute triggers before the queue hardens further.',
          detail: 'Use this early warning window to lock escort availability, pre-authorize air bridge capacity, and publish branch-route criteria before vessels hit a no-options choke point.',
          accent: '#00ff88',
        },
      ];
    case 2:
    case 3:
      return [
        {
          id: `scene-${currentSceneId}-impact`,
          kind: 'impact',
          label: 'Convoy Impact',
          headline: 'CONVOY-BRAVO is now a direct threat-to-sustainment problem, not only a force-protection problem.',
          detail: 'A UAV swarm and confirmed ASBM chain against VSL-002 put petroleum and military stores for UNIT-FOXTROT at immediate risk of disruption or loss in transit.',
          accent: '#ff1e3c',
        },
        {
          id: `scene-${currentSceneId}-change`,
          kind: 'change',
          label: 'Threat Escalation',
          headline: 'The risk has escalated from threat indication to active kill-chain execution.',
          detail: currentSceneId === 2
            ? 'SIGINT plus AIS confirms the convoy is inside the attack corridor, meaning routing assumptions are no longer valid.'
            : 'ISR, HUMINT, and SIGINT now validate launch-to-target linkage, shrinking decision time and increasing the cost of delay.'
          ,
          accent: '#f97316',
        },
        {
          id: `scene-${currentSceneId}-prevention`,
          kind: 'prevention',
          label: 'Prevention Move',
          headline: 'Break the kill chain before it repeats on the next logistics movement.',
          detail: 'Shift escorted transit windows, harden air-cover and intercept posture around Bab-el-Mandeb, and require pre-cleared alternate delivery paths for critical cargo classes before the next convoy departs.',
          accent: '#00ff88',
        },
      ];
    case 4:
    case 5:
      return [
        {
          id: `scene-${currentSceneId}-impact`,
          kind: 'impact',
          label: 'Infrastructure Impact',
          headline: 'Cyber compromise at Suez is converting port infrastructure into a supply-chain denial mechanism.',
          detail: currentSceneId === 4
            ? 'APT-41 access to Port Said SCADA threatens lock operations and can strand 47 queued vessels, including allied logistics ships carrying fuel and military stores.'
            : 'The Ismailia DNP3 intrusion expands the blast radius from canal locks to power support systems, raising the chance of prolonged transit paralysis for VSL-008 and adjacent shipping lanes.'
          ,
          accent: '#ff6400',
        },
        {
          id: `scene-${currentSceneId}-change`,
          kind: 'change',
          label: 'Network Change',
          headline: 'This is no longer a single chokepoint issue; it is now a layered logistics systems attack.',
          detail: currentSceneId === 4
            ? 'The campaign has shifted from maritime threat pressure to a canal-control vulnerability that can freeze throughput without firing a missile.'
            : 'A second cyber front means attackers can preserve disruption even if one node is contained, so recovery planning must cover dependent infrastructure as well.'
          ,
          accent: '#22d3ee',
        },
        {
          id: `scene-${currentSceneId}-prevention`,
          kind: 'prevention',
          label: 'Prevention Move',
          headline: 'Contain the cyber foothold and reduce repeatable choke-point exposure.',
          detail: 'Push emergency segmentation on exposed ICS devices, stand up manual lock and power continuity procedures, and pre-designate alternate maritime or overland channels before attackers can re-establish persistence.',
          accent: '#00ff88',
        },
      ];
    case 6:
      return [
        {
          id: 'scene-6-impact',
          kind: 'impact',
          label: 'Navigation Impact',
          headline: 'GPS spoofing is degrading route assurance for live sustainment traffic.',
          detail: 'A 4.2nm deviation on CONVOY-BRAVO creates collision, delay, and corridor-exit risk that can compound earlier kinetic and cyber disruptions.',
          accent: '#a78bfa',
        },
        {
          id: 'scene-6-change',
          kind: 'change',
          label: 'Control Change',
          headline: 'The disruption model has shifted from blocking routes to silently bending them.',
          detail: 'IRGC-EW interference means vessels may appear mobile while still being operationally displaced, which hides supply degradation inside apparently normal movement.',
          accent: '#22d3ee',
        },
        {
          id: 'scene-6-prevention',
          kind: 'prevention',
          label: 'Prevention Move',
          headline: 'Make navigation resilience part of the logistics plan, not a fallback after compromise.',
          detail: 'Mandate INS cross-check procedures, spoofing alarms, escorted navigation corridors, and authenticated waypoint validation before future convoys enter EW-exposed water.',
          accent: '#00ff88',
        },
      ];
    case 7:
      return [
        {
          id: 'scene-7-impact',
          kind: 'impact',
          label: 'Theater Impact',
          headline: 'Multiple attack vectors are now converging on the same supply web.',
          detail: 'HAWK-I has enough fused evidence to show that canal disruption, convoy attacks, and navigation spoofing are all compressing the same resupply timeline for UNIT-DELTA and UNIT-FOXTROT.',
          accent: '#ff1e3c',
        },
        {
          id: 'scene-7-change',
          kind: 'change',
          label: 'Assessment Change',
          headline: 'The problem has matured from incident response into campaign-level supply protection.',
          detail: 'With three actors and ten datasets aligned, the system can now prioritize which routes, units, and interventions matter most instead of reacting feed-by-feed.',
          accent: '#22d3ee',
        },
        {
          id: 'scene-7-prevention',
          kind: 'prevention',
          label: 'Prevention Move',
          headline: 'Use the generated COAs to create recurrence barriers, not just one-time fixes.',
          detail: 'Pair escort, cyber eviction, and alternate-route activation with standing triggers so similar threat patterns automatically force route hardening, backup lift, and chokepoint contingency actions.',
          accent: '#00ff88',
        },
      ];
    case 8:
      return [
        {
          id: 'scene-8-impact',
          kind: 'impact',
          label: 'Mitigation Impact',
          headline: 'Approved actions are beginning to restore supply continuity before stock thresholds are crossed.',
          detail: 'USS CARNEY escort, EAGLE-01 airlift, and the CNO response reduce the chance that one compromised route cascades into theater-wide shortfalls.',
          accent: '#00ff88',
        },
        {
          id: 'scene-8-change',
          kind: 'change',
          label: 'Execution Change',
          headline: 'The session has moved from recommendation to active supply-chain intervention.',
          detail: 'Assets are now repositioning in real time, which means the dashboard should emphasize execution effects and residual risk instead of initial detection alone.',
          accent: '#0ea5e9',
        },
        {
          id: 'scene-8-prevention',
          kind: 'prevention',
          label: 'Prevention Move',
          headline: 'Institutionalize these actions as rapid-response playbooks.',
          detail: 'Convert the approved escort, air bridge, and CNO sequences into pre-authorized drills so future disruptions trigger mitigation earlier and with less command delay.',
          accent: '#ffb800',
        },
      ];
    case 9:
      return [
        {
          id: 'scene-9-impact',
          kind: 'impact',
          label: 'Recovery Impact',
          headline: 'Restored canal control is reopening throughput and reducing accumulated backlog risk.',
          detail: 'As VSL-004 and VSL-008 regain transit clearance and EAGLE-01 offloads in Djibouti, the supply chain starts recovering both speed and redundancy.',
          accent: '#00ff88',
        },
        {
          id: 'scene-9-change',
          kind: 'change',
          label: 'Recovery Change',
          headline: 'The operating picture has shifted from disruption management to throughput recovery.',
          detail: 'The key question is no longer whether shipments can move, but how fast queued cargo, alternate routes, and downstream units can normalize.',
          accent: '#22d3ee',
        },
        {
          id: 'scene-9-prevention',
          kind: 'prevention',
          label: 'Prevention Move',
          headline: 'Use the recovery window to harden the network before attackers re-enter.',
          detail: 'Keep cyber watch on cleaned SCADA nodes, retain alternate transport activation thresholds, and capture the route-diversion decisions that prevented repeat congestion shock.',
          accent: '#ffb800',
        },
      ];
    case 10:
      return [
        {
          id: 'scene-10-impact',
          kind: 'impact',
          label: 'Stability Impact',
          headline: 'Supply-line risk has shifted from critical disruption to controlled stability.',
          detail: 'Escorted maritime flow, restored Suez throughput, and active alternate routes have stabilized the units that were closest to critical shortage.',
          accent: '#00ff88',
        },
        {
          id: 'scene-10-change',
          kind: 'change',
          label: 'Posture Change',
          headline: 'The theater now has a more resilient logistics posture than it had at the start of the incident.',
          detail: 'Air bridge, rail alternatives, and hardened convoy procedures create multiple ways to absorb future shocks instead of relying on a single uninterrupted sea route.',
          accent: '#22d3ee',
        },
        {
          id: 'scene-10-prevention',
          kind: 'prevention',
          label: 'Prevention Move',
          headline: 'Prevent recurrence by keeping resilience measures alive after the crisis fades.',
          detail: 'Maintain watch on Suez cyber nodes, preserve escort and EW trigger criteria, and keep alternate-route rehearsal active so the next disruption is absorbed before it becomes a theater-level shortage.',
          accent: '#ffb800',
        },
      ];
    default:
      return [
        {
          id: `scene-${currentSceneId}-impact`,
          kind: 'impact',
          label: 'Operational Impact',
          headline: `${currentLabel || 'Current activity'} is influencing logistics flow across the theater.`,
          detail: 'HAWK-I is correlating route pressure, threat activity, and resupply exposure to determine which supply lines are most at risk.',
          accent: '#ff1e3c',
        },
        {
          id: `scene-${currentSceneId}-change`,
          kind: 'change',
          label: 'Status Change',
          headline: 'The supply picture is being updated as new mission data arrives.',
          detail: 'As fresh maritime, cyber, and intel signals enter the graph, the dashboard revises route confidence and downstream readiness assumptions.',
          accent: '#22d3ee',
        },
        {
          id: `scene-${currentSceneId}-prevention`,
          kind: 'prevention',
          label: 'Prevention Move',
          headline: 'Recommended actions focus on absorbing disruption before it expands.',
          detail: 'Pre-planned alternates, earlier triggers, and cross-domain monitoring reduce the chance that future incidents cascade into unit-level shortages.',
          accent: '#00ff88',
        },
      ];
  }
}

// ---------------------------------------------------------------------------
// COA Panel
// ---------------------------------------------------------------------------
function CoaPanel() {
  const { demoState } = useDemo();
  const items   = demoState.coaItems;
  const started = demoState.running || demoState.complete || demoState.currentScene > 0;
  const currentScene = getSceneById(demoState.currentScene);
  const sceneElapsed = currentScene ? Math.max(0, demoState.elapsedMs - currentScene.startMs) : 0;
  const sceneDuration = currentScene ? Math.max(1, getSceneDurationMs(currentScene.id)) : 1;
  const sceneProgress = Math.min(1, sceneElapsed / sceneDuration);
  const allInsights = buildSupplyChainInsights(demoState.currentScene, demoState.sceneLabel);
  const revealCount = demoState.complete
    ? allInsights.length
    : currentScene
      ? Math.max(1, Math.min(allInsights.length, Math.ceil(sceneProgress * allInsights.length)))
      : 0;
  const visibleInsights = allInsights.slice(0, revealCount);

  return (
    <div className="flex flex-col h-full bg-black/20">
      <div className="px-3 py-1.5 border-b border-[#00ff8826] bg-[#00ff880a] flex items-center justify-between shrink-0">
        <span className="font-mono text-xs text-white font-bold tracking-widest">AI_RECOMMENDATIONS</span>
        {items.length > 0 && (
          <div className="text-[9px] font-mono font-bold text-[#00ff88] border border-[#00ff8844] px-1.5 py-0.5 bg-[#00ff8810] animate-pulse">
            {items.length} COA GENERATED
          </div>
        )}
      </div>
      <ScrollArea className="flex-1">
        {!started ? (
          <CoaStandby />
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-[#555] text-[11px] font-mono tracking-widest animate-pulse">
            HAWK-I ANALYZING THREAT CHAIN...
          </div>
        ) : (
          <div className="p-2 flex flex-col gap-2">
            {visibleInsights.length > 0 && (
              <SupplyChainInsightStream
                insights={visibleInsights}
                totalCount={allInsights.length}
                currentSceneId={demoState.currentScene}
              />
            )}
            {items.map(item => (
              <CoaCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function SupplyChainInsightStream({
  insights,
  totalCount,
  currentSceneId,
}: {
  insights: GeneratedInsight[];
  totalCount: number;
  currentSceneId: number;
}) {
  return (
    <div className="border border-[#00ff8826] bg-[#04120d]">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-[#00ff8818] bg-[#00ff8808]">
        <div className="min-w-0">
          <div className="text-[8px] font-mono tracking-[0.28em] text-[#00ff88]">AI SUPPLY-CHAIN INSIGHTS</div>
          <div className="text-[9px] text-[#7ee7b8] font-sans">
            Session-linked impacts, changes, and prevention guidance for active logistics disruption.
          </div>
        </div>
        <div className="shrink-0 text-[8px] font-mono px-1.5 py-0.5 border border-[#00ff8844] text-[#00ff88] bg-[#00ff8810]">
          SCN {String(currentSceneId).padStart(2, '0')} • {insights.length}/{totalCount}
        </div>
      </div>
      <div className="p-2 flex flex-col gap-1.5">
        {insights.map(insight => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: GeneratedInsight }) {
  const meta = INSIGHT_META[insight.kind];

  return (
    <div
      className="border px-2 py-1.5 bg-black/45 animate-in fade-in duration-500"
      style={{ borderColor: `${insight.accent}55`, boxShadow: `inset 0 0 0 1px ${insight.accent}12` }}
    >
      <div className="flex items-center gap-1.5 text-[7px] font-mono tracking-[0.24em] uppercase mb-1">
        <span style={{ color: insight.accent }}>{meta.icon}</span>
        <span style={{ color: insight.accent }}>{meta.label}</span>
        <span className="text-[#3f6f58]">/</span>
        <span className="text-[#8cbfa7]">{insight.label}</span>
      </div>
      <div className="text-[10px] font-semibold text-white leading-snug">{insight.headline}</div>
      <div className="text-[9px] text-[#9ab3a5] leading-relaxed mt-1">{insight.detail}</div>
    </div>
  );
}

function CoaCard({ item }: { item: DemoCoaItem }) {
  const [bbOpen, setBbOpen] = useState(false);
  const priColor = getPriColor(item.priority);
  const uStyle   = getUrgencyStyle(item.urgency);

  const coreEvidence  = item.evidenceChain.filter(e => ['TRIGGER','INCIDENT','ASSET_AT_RISK','RECOMMENDATION'].includes(e.role));
  const intelEvidence = item.evidenceChain.filter(e => ['SIGINT_CORROBORATION','ISR_CONFIRMATION','HUMINT_REPORT','AIS_TRACK','IOC_INDICATOR'].includes(e.role));

  return (
    <div className="flex flex-col bg-black/60 border border-white/10 hover:border-[#00ff8833] transition-colors">
      <div className="flex items-start gap-2 p-2">
        <div className="w-5 h-5 flex items-center justify-center font-black text-xs shrink-0 mt-0.5"
          style={{ color: priColor, border: `1px solid ${priColor}`, backgroundColor: `${priColor}18` }}>
          {item.priority}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono font-black text-white text-[10px] leading-tight">{item.title}</div>
          <div className="text-[#aaa] text-[9px] leading-relaxed mt-1 font-sans">{item.action}</div>
        </div>
        <div className="text-[9px] uppercase font-black px-1.5 py-0.5 shrink-0 font-mono"
          style={{ color: uStyle.color, border: `1px solid ${uStyle.border}`, backgroundColor: uStyle.bg, boxShadow: uStyle.glow }}>
          {item.urgency}
        </div>
      </div>

      <div className="flex items-center gap-2 px-2 pb-2">
        <span className="text-[8px] text-[#555] font-mono">CONF:</span>
        <div className="flex-1 h-0.5 bg-white/10 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 transition-all duration-1000"
            style={{ width: `${(item.confidence * 100).toFixed(0)}%`, backgroundColor: uStyle.color }} />
        </div>
        <span className="text-[9px] font-mono font-bold" style={{ color: uStyle.color }}>
          {(item.confidence * 100).toFixed(0)}%
        </span>
        {item.datasetsQueried?.slice(0, 3).map(ds => (
          <span key={ds} className="text-[7px] font-mono px-1 py-0.5 border border-white/10 text-[#555]" title={ds}>
            {dsIcon(ds)}
          </span>
        ))}
        {item.datasetsQueried && item.datasetsQueried.length > 3 && (
          <span className="text-[7px] font-mono text-[#444]">+{item.datasetsQueried.length - 3}</span>
        )}
        <button
          onClick={() => setBbOpen(v => !v)}
          className="text-[8px] font-black px-1.5 py-0.5 border tracking-widest font-mono transition-all ml-1"
          style={{ color: bbOpen ? '#050508' : '#00bcd4', borderColor: '#00bcd466', backgroundColor: bbOpen ? '#00bcd4' : '#00bcd410' }}
        >
          BLACKBOX
        </button>
      </div>

      {bbOpen && (
        <div className="border-t border-[#00bcd422] bg-[#000a0f] flex flex-col">
          {item.datasetsQueried && item.datasetsQueried.length > 0 && (
            <div className="px-2 pt-2 pb-1.5 border-b border-[#00bcd414]">
              <div className="text-[7px] font-mono text-[#00bcd466] tracking-widest uppercase mb-1">
                PALANTIR FOUNDRY DATASETS QUERIED ({item.datasetsQueried.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {item.datasetsQueried.map(ds => (
                  <span key={ds} className="text-[7px] font-mono px-1.5 py-0.5 border border-[#00bcd422] text-[#00bcd488] bg-[#00bcd408]">
                    {dsIcon(ds)} {ds}
                  </span>
                ))}
              </div>
            </div>
          )}
          {coreEvidence.length > 0 && (
            <div className="px-2 pt-2 pb-1">
              <div className="text-[7px] font-mono text-[#00bcd466] tracking-widest uppercase mb-1.5">CAUSAL CHAIN → FOUNDRY OBJECT PATH</div>
              <div className="flex flex-col gap-1">
                {coreEvidence.map((link, idx) => (
                  <EvidenceLink key={`${link.primaryKey}-${idx}`} link={link} index={idx} total={coreEvidence.length} />
                ))}
              </div>
            </div>
          )}
          {intelEvidence.length > 0 && (
            <div className="px-2 pt-1.5 pb-2 border-t border-[#00bcd414]">
              <div className="text-[7px] font-mono text-[#00bcd466] tracking-widest uppercase mb-1.5">
                MULTI-INT CORROBORATION ({intelEvidence.length} SOURCES)
              </div>
              <div className="flex flex-col gap-1">
                {intelEvidence.map((link, idx) => (
                  <EvidenceLink key={`${link.primaryKey}-${idx}`} link={link} index={idx} total={intelEvidence.length} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EvidenceLink({ link, index, total }: { link: DemoEvidenceLink; index: number; total: number }) {
  const meta   = ROLE_META[link.role] ?? { color: '#888', icon: '●', label: link.role };
  const isLast = index === total - 1;
  return (
    <div className="flex items-start gap-1.5">
      <div className="flex flex-col items-center shrink-0 mt-0.5">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color, boxShadow: `0 0 4px ${meta.color}` }} />
        {!isLast && <div className="w-px flex-1 mt-0.5" style={{ backgroundColor: meta.color, opacity: 0.25, minHeight: 10 }} />}
      </div>
      <div className="flex-1 min-w-0 pb-0.5">
        <div className="flex items-center justify-between gap-1">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[7px]">{meta.icon}</span>
              <span className="text-[7px] font-mono font-bold uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
              {link.linkName && (
                <span className="text-[6px] font-mono text-[#00bcd444] border border-[#00bcd418] px-0.5">link:{link.linkName}</span>
              )}
            </div>
            <span className="text-[9px] font-mono text-white truncate">{link.label}</span>
            <div className="flex items-center gap-1">
              <span className="text-[7px] font-mono text-[#444]">{link.objectType}</span>
              <span className="text-[7px] font-mono text-[#333]">/</span>
              <span className="text-[7px] font-mono" style={{ color: meta.color }}>{link.primaryKey}</span>
              {link.dataset && link.dataset !== link.objectType && (
                <span className="text-[6px] font-mono text-[#333]">← {link.dataset}</span>
              )}
            </div>
          </div>
          <a href={link.url} target="_blank" rel="noreferrer"
            className="shrink-0 text-[7px] font-black px-1.5 py-0.5 border transition-all hover:opacity-80 font-mono"
            style={{ color: '#00bcd4', borderColor: '#00bcd444', backgroundColor: '#00bcd40d' }}>
            ↗ FOUNDRY
          </a>
        </div>
      </div>
    </div>
  );
}

function CoaStandby() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-8 px-4 text-center">
      <div className="text-[#1a2a1a] text-[11px] font-mono tracking-widest uppercase">AI RECOMMENDATIONS</div>
      <div className="text-[#131f13] text-[10px] font-mono">— AWAITING THREAT DATA —</div>
      <div className="text-[#0d150d] text-[9px] font-mono leading-relaxed max-w-[180px]">
        COA + BLACKBOX EVIDENCE CHAIN + MULTI-INT CORROBORATION AT SCENE 7
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ontology Panel
// ---------------------------------------------------------------------------
function OntologyPanel() {
  const { demoState } = useDemo();
  const edges      = demoState.ontologyEdges;
  const provenance = demoState.provenance;
  const started    = demoState.running || demoState.complete || demoState.currentScene > 0;
  const [bbOpen, setBbOpen] = useState(false);
  const [tab, setTab]       = useState<'edges' | 'provenance'>('edges');
  const prevSceneRef        = useRef(demoState.currentScene);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (demoState.currentScene !== prevSceneRef.current && demoState.currentScene > 0) {
      prevSceneRef.current = demoState.currentScene;
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [demoState.currentScene]);

  const datasetCounts = edges.reduce<Record<string, number>>((acc, e) => {
    if (e.dataset) acc[e.dataset] = (acc[e.dataset] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-black/40">
      <div className="px-3 py-1.5 border-b border-[#00ff8826] bg-[#00ff880a] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-white font-bold tracking-widest">ONTOLOGY_GRAPH</span>
          {edges.length > 0 && (
            <span className="text-[8px] font-mono text-[#555] border border-white/10 px-1">{edges.length} edges</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {demoState.running && edges.length > 0 && (
            <span className="text-[8px] font-mono text-[#a78bfa] animate-pulse tracking-wider">LIVE</span>
          )}
          {provenance && (
            <button
              onClick={() => { setBbOpen(v => !v); setTab('provenance'); }}
              className="text-[7px] font-black px-1.5 py-0.5 border font-mono tracking-widest transition-all"
              style={{ color: bbOpen ? '#050508' : '#00bcd4', borderColor: '#00bcd466', backgroundColor: bbOpen ? '#00bcd4' : '#00bcd410' }}
            >
              BLACKBOX
            </button>
          )}
          <div className={`w-2 h-2 rounded-full ${started && edges.length > 0 ? 'bg-[#00ff88] shadow-[0_0_5px_#00ff88]' : 'bg-[#333]'}`} />
        </div>
      </div>

      {bbOpen && provenance && (
        <div className="border-b border-[#00bcd422] bg-[#000a0f] shrink-0">
          <div className="flex border-b border-[#00bcd414]">
            {(['edges', 'provenance'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 text-[7px] font-mono font-bold py-1 tracking-widest uppercase transition-all"
                style={{ color: tab === t ? '#00bcd4' : '#333', borderBottom: tab === t ? '1px solid #00bcd4' : '1px solid transparent', backgroundColor: tab === t ? '#00bcd408' : 'transparent' }}>
                {t === 'edges' ? `EDGE SOURCES (${edges.length})` : `DATASETS (${provenance.datasets.length})`}
              </button>
            ))}
            <button onClick={() => setBbOpen(false)} className="text-[8px] font-mono text-[#333] px-2 hover:text-[#666]">✕</button>
          </div>
          {tab === 'edges' && (
            <div className="px-2 py-1.5 max-h-24 overflow-y-auto">
              <div className="text-[7px] font-mono text-[#00bcd444] tracking-widest mb-1">EDGE DERIVATION — FK FIELD / LINK TRAVERSAL</div>
              <div className="flex flex-col gap-0.5">
                {edges.filter(e => e.derivedFrom).map(e => (
                  <div key={e.id} className="flex items-center gap-1 text-[7px] font-mono">
                    <span style={{ color: getTypeColor(e.sourceType) }} className="shrink-0">{dsIcon(e.dataset ?? '')} {e.dataset}</span>
                    <span className="text-[#333]">.</span>
                    <span className="text-[#00bcd477]">{e.derivedFrom?.split('.')[1] ?? e.derivedFrom}</span>
                    <span className="text-[#333]">→</span>
                    <span className="text-[#555]">{e.relation}</span>
                    {e.linkName && <span className="text-[#00bcd422] border border-[#00bcd414] px-0.5">{e.linkName}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === 'provenance' && (
            <div className="px-2 py-1.5 max-h-28 overflow-y-auto">
              <ProvenancePanel provenance={provenance} />
            </div>
          )}
        </div>
      )}

      <div className="flex border-b border-white/5 shrink-0">
        <button onClick={() => setTab('edges')}
          className="flex-1 text-[7px] font-mono py-0.5 tracking-widest text-[#444] hover:text-[#666] transition-colors">
          RELATIONSHIP EDGES
        </button>
        <div className="flex items-center gap-1 px-2">
          {Object.entries(datasetCounts).slice(0, 5).map(([ds, count]) => (
            <span key={ds} className="text-[6px] font-mono text-[#333]" title={ds}>{dsIcon(ds)}{count}</span>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {!started ? (
          <div className="p-4 text-center text-[#1a2a1a] text-[10px] font-mono tracking-widest">— ONTOLOGY STANDBY —</div>
        ) : edges.length === 0 ? (
          <div className="p-4 text-center text-[#333] text-[10px] font-mono tracking-widest animate-pulse">SCANNING THREAT RELATIONSHIPS...</div>
        ) : (
          <div className="p-1.5 flex flex-col gap-0.5 transition-all duration-300"
            style={{ opacity: animating ? 0.4 : 1, transform: animating ? 'scale(0.97)' : 'scale(1)' }}>
            {edges.map(edge => (
              <OntologyEdgeRow key={edge.id} edge={edge} isNew={demoState.newEdgeIds.has(edge.id)} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function OntologyEdgeRow({ edge, isNew }: { edge: DemoOntologyEdge; isNew: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const sColor = edge.sourceColor ?? getTypeColor(edge.sourceType);
  const tColor = edge.targetColor ?? getTypeColor(edge.targetType);
  return (
    <div className="border flex flex-col font-mono text-[9px] transition-all duration-500"
      style={{ borderColor: isNew ? '#a78bfa55' : '#ffffff08', backgroundColor: isNew ? '#a78bfa08' : 'rgba(0,0,0,0.3)', boxShadow: isNew ? '0 0 8px #a78bfa22' : 'none' }}>
      <div className="px-2 py-1 flex items-center gap-1">
        <button onClick={() => edge.sourcePalantirUrl && window.open(edge.sourcePalantirUrl, '_blank')}
          className="font-bold truncate max-w-[72px] hover:underline"
          style={{ color: sColor, cursor: edge.sourcePalantirUrl ? 'pointer' : 'default' }}>
          {edge.sourceLabel}
        </button>
        <span className="text-[#333] shrink-0 flex-1 text-center">—[{edge.relation}]→</span>
        <button onClick={() => edge.targetPalantirUrl && window.open(edge.targetPalantirUrl, '_blank')}
          className="font-bold truncate max-w-[72px] hover:underline"
          style={{ color: tColor, cursor: edge.targetPalantirUrl ? 'pointer' : 'default' }}>
          {edge.targetLabel}
        </button>
        {isNew && <div className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-ping shrink-0" />}
        {edge.derivedFrom && (
          <button onClick={() => setExpanded(v => !v)}
            className="text-[6px] font-mono text-[#00bcd433] hover:text-[#00bcd4] px-0.5 shrink-0 ml-auto">
            {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>
      {expanded && edge.derivedFrom && (
        <div className="px-2 pb-1 pt-0 flex items-center gap-1.5 border-t border-[#00bcd414]">
          <span className="text-[6px] font-mono text-[#00bcd444] uppercase tracking-widest">SOURCE:</span>
          <span className="text-[6px] font-mono text-[#00bcd477]">{dsIcon(edge.dataset ?? '')} {edge.dataset}</span>
          <span className="text-[6px] font-mono text-[#333]">·</span>
          <span className="text-[6px] font-mono text-[#00bcd455]">{edge.derivedFrom}</span>
          {edge.linkName && (
            <><span className="text-[6px] font-mono text-[#333]">·</span>
            <span className="text-[6px] font-mono text-[#00bcd422] border border-[#00bcd414] px-0.5">link:{edge.linkName}</span></>
          )}
          {edge.sourcePalantirUrl && (
            <a href={edge.sourcePalantirUrl} target="_blank" rel="noreferrer"
              className="ml-auto text-[6px] font-mono text-[#00bcd433] hover:text-[#00bcd4] underline">↗</a>
          )}
        </div>
      )}
    </div>
  );
}

function ProvenancePanel({ provenance }: { provenance: DemoFoundryProvenance }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 border border-[#00bcd414] px-2 py-1 bg-[#00bcd408]">
        <span className="text-[7px] font-mono text-[#00bcd466]">ONTOLOGY RID</span>
        <span className="text-[7px] font-mono text-[#00bcd488] truncate flex-1">{provenance.ontologyRid.slice(0, 40)}…</span>
      </div>
      <div className="flex gap-2 text-[7px] font-mono">
        <span className="text-[#555]">Objects:</span><span className="text-[#00bcd4]">{provenance.objectsLoaded}</span>
        <span className="text-[#555]">Edges:</span><span className="text-[#00bcd4]">{provenance.edgesBuilt}</span>
        <span className="text-[#555]">Links:</span><span className="text-[#00bcd4]">{provenance.linksTraversed.length}</span>
      </div>
      {provenance.datasets.map((ds: DemoProvenanceDataset) => (
        <DatasetRow key={ds.objectType} ds={ds} />
      ))}
      {provenance.linksTraversed.length > 0 && (
        <div className="mt-1">
          <div className="text-[6px] font-mono text-[#00bcd433] tracking-widest uppercase mb-0.5">LINK TYPES TRAVERSED</div>
          {provenance.linksTraversed.map((lk: DemoProvenanceLink) => (
            <LinkRow key={lk.linkName} lk={lk} />
          ))}
        </div>
      )}
    </div>
  );
}

function DatasetRow({ ds }: { ds: DemoProvenanceDataset }) {
  return (
    <div className="flex flex-col border border-[#00bcd414] bg-[#000508] mb-0.5">
      <div className="flex items-center gap-1.5 text-[7px] font-mono px-1.5 py-0.5">
        <span>{ds.icon}</span>
        <span className="text-[#00bcd488] flex-1 truncate">{ds.displayName}</span>
        <span className="text-[#00bcd433]">×{ds.count}</span>
        <a href={ds.foundryOntUrl} target="_blank" rel="noreferrer"
          className="text-[#a78bfa88] hover:text-[#a78bfa] text-[6px] uppercase tracking-widest border border-[#a78bfa22] px-0.5 shrink-0">TYPE ↗</a>
        <a href={ds.datasetUrl} target="_blank" rel="noreferrer"
          className="text-[#00bcd433] hover:text-[#00bcd4] text-[6px] uppercase tracking-widest border border-[#00bcd422] px-0.5 shrink-0">DATA ↗</a>
      </div>
      <div className="px-1.5 pb-0.5 text-[5.5px] font-mono text-[#333] truncate">{ds.datasetRid}</div>
    </div>
  );
}

function LinkRow({ lk }: { lk: DemoProvenanceLink }) {
  return (
    <div className="flex items-center gap-1 text-[6px] font-mono text-[#00bcd444] pl-1 border-l border-[#00bcd414] my-0.5">
      <span className="text-[#00bcd455]">{lk.from}</span>
      <span className="text-[#333]">─[{lk.linkName}]→</span>
      <span className="text-[#00bcd455]">{lk.to}</span>
      <span className="text-[#00bcd433] ml-auto">×{lk.edgeCount}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAVEN-ALPHA Chat — AIP Long-Term Memory Chatbot
// ---------------------------------------------------------------------------

interface ChatEntry {
  id:       string;
  role:     'user' | 'assistant' | 'system';
  content:  string;
  provenance?: {
    memoryCount:    number;
    memoriesUsed:   boolean;
    ontologyUsed:   boolean;
    datasetsQueried:string[];
    modelVersion:   string;
    memoryDataset:  string;
    ontologyRid:    string;
  };
}

const FOUNDRY_BASE = "https://nshackathon.palantirfoundry.com";
const MEMORY_OBJECT_URL = `${FOUNDRY_BASE}/workspace/ontology/objects/example-rv17-memory`;
const ONTOLOGY_RID_SHORT = "runtime-configured";

const QUICK_PROMPTS = [
  "SITREP: What are the highest-priority threats right now?",
  "What COA do you recommend for the active kinetic incident?",
  "Summarize all SIGINT and HUMINT corroboration for THR-003",
  "What AIS deviations indicate possible vessel compromise?",
  "Which Cyber IOCs are attributed to APT-41?",
];

function MavenAlphaChat() {
  const [entries, setEntries] = useState<ChatEntry[]>([{
    id: 'init', role: 'system',
    content: 'MAVEN-ALPHA ONLINE // PALANTIR LONG-TERM MEMORY ACTIVE // 10 FOUNDRY DATASETS // READY FOR COMMAND',
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [bbEntry, setBbEntry] = useState<string | null>(null);
  const [memCount, setMemCount] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const { demoState } = useDemo();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  // Fetch current memory count on mount
  useEffect(() => {
    fetch('/api/memory').then(r => r.json()).then((d: any) => {
      if (typeof d?.count === 'number') setMemCount(d.count);
    }).catch(() => {});
  }, []);

  const submit = useCallback(async (query: string) => {
    if (!query.trim() || loading) return;
    const userEntry: ChatEntry = { id: `u-${Date.now()}`, role: 'user', content: query.trim() };
    setEntries(prev => [...prev, userEntry]);
    setInput('');
    setLoading(true);
    const thinkId = `t-${Date.now()}`;
    setEntries(prev => [...prev, {
      id: thinkId, role: 'system',
      content: 'MAVEN-ALPHA PROCESSING // QUERYING PALANTIR MEMORY + 10 DATASETS...',
    }]);
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
        provenance?: { memories?: { count: number; dataset: string; ontologyRid: string } };
      };
      const newCount = data.memoryCount ?? 0;
      setMemCount(newCount);
      setEntries(prev => prev.filter(e => e.id !== thinkId).concat({
        id: `a-${Date.now()}`, role: 'assistant',
        content: data.answer ?? data.error ?? 'NO RESPONSE',
        provenance: {
          memoryCount:    newCount,
          memoriesUsed:   data.memoriesUsed ?? false,
          ontologyUsed:   data.ontologyUsed ?? false,
          datasetsQueried:data.datasetsQueried ?? [],
          modelVersion:   data.modelVersion ?? 'MAVEN-ALPHA',
          memoryDataset:  data.provenance?.memories?.dataset ?? 'runtime-configured',
          ontologyRid:    ONTOLOGY_RID_SHORT,
        },
      }));
    } catch {
      setEntries(prev => prev.filter(e => e.id !== thinkId).concat({
        id: `err-${Date.now()}`, role: 'system',
        content: 'COMMS FAILURE — MAVEN-ALPHA UNREACHABLE',
      }));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading]);

  const clearMemory = useCallback(async () => {
    await fetch('/api/memory/clear', { method: 'POST' });
    setMemCount(0);
    setEntries([{ id: 'cleared', role: 'system', content: 'LONG-TERM MEMORY CLEARED // PALANTIR ExampleRv17memory FLUSHED' }]);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#010901]">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-[#00ff8826] bg-[#00ff880a] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-white font-bold tracking-widest">MAVEN-ALPHA</span>
          <span className="text-[7px] font-mono text-[#00bcd466] border border-[#00bcd422] px-1">AIP MEMORY</span>
        </div>
        <div className="flex items-center gap-2">
          {memCount !== null && (
            <a href={MEMORY_OBJECT_URL} target="_blank" rel="noreferrer"
              className="text-[7px] font-mono text-[#00bcd455] hover:text-[#00bcd4] border border-[#00bcd422] px-1 py-0.5 transition-colors"
              title="View memory objects in Palantir Foundry">
              MEM:{memCount} ↗
            </a>
          )}
          <div className={`w-2 h-2 rounded-full ${loading ? 'bg-[#ffb800] animate-pulse' : 'bg-[#00ff88]'} shadow-[0_0_4px_currentColor]`} />
          <span className="text-[9px] font-mono text-[#888]">{loading ? 'QUERYING' : 'READY'}</span>
        </div>
      </div>

      {/* Scene context strip */}
      {(demoState.running || demoState.currentScene > 0) && (
        <div className="px-2 py-0.5 bg-[#00ff8808] border-b border-[#00ff8814] flex items-center gap-2 shrink-0">
          <div className="text-[7px] font-mono text-[#00ff8866] tracking-widest">
            SCENE {demoState.currentScene}: {demoState.sceneLabel || 'ACTIVE'}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {demoState.sigintItems?.length > 0  && <span className="text-[6px] font-mono text-[#a78bfa]" title="SIGINT active">📡{demoState.sigintItems.length}</span>}
            {demoState.isrItems?.length > 0     && <span className="text-[6px] font-mono text-[#34d399]" title="ISR active">🛰️{demoState.isrItems.length}</span>}
            {demoState.humintItems?.length > 0  && <span className="text-[6px] font-mono text-[#fb923c]" title="HUMINT active">🕵️{demoState.humintItems.length}</span>}
            {demoState.aisItems?.length > 0     && <span className="text-[6px] font-mono text-[#22d3ee]" title="AIS active">📍{demoState.aisItems.length}</span>}
            {demoState.iocItems?.length > 0     && <span className="text-[6px] font-mono text-[#f43f5e]" title="IOC active">🔴{demoState.iocItems.length}</span>}
          </div>
        </div>
      )}

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {entries.map(entry => (
          <div key={entry.id}>
            {entry.role === 'user' && (
              <div className="flex gap-2">
                <span className="text-[#00ff88] font-mono text-[10px] font-bold shrink-0">CMD&gt;</span>
                <span className="text-[#00ff88] font-mono text-[10px] break-all">{entry.content}</span>
              </div>
            )}
            {entry.role === 'assistant' && (
              <div className="flex flex-col gap-0.5">
                <div className="pl-3 border-l-2 border-[#00bcd433]">
                  <span className="text-[9px] font-mono text-[#00bcd4] font-bold">MAVEN-ALPHA&gt; </span>
                  <span className="text-[#00bcd4] font-mono text-[10px] whitespace-pre-wrap break-words">{entry.content}</span>
                </div>
                {/* Inline provenance row */}
                {entry.provenance && (
                  <div className="pl-3 flex items-center gap-1.5 flex-wrap mt-0.5">
                    {entry.provenance.memoriesUsed && (
                      <a href={`${MEMORY_OBJECT_URL}`} target="_blank" rel="noreferrer"
                        className="text-[6px] font-mono text-[#00bcd444] hover:text-[#00bcd4] border border-[#00bcd41a] px-0.5 transition-colors"
                        title="Memories retrieved from Palantir ExampleRv17memory">
                        MEM:{entry.provenance.memoryCount} ↗
                      </a>
                    )}
                    {entry.provenance.ontologyUsed && (
                      <span className="text-[6px] font-mono text-[#00bcd433] border border-[#00bcd41a] px-0.5">ONTOLOGY:LIVE</span>
                    )}
                    {entry.provenance.datasetsQueried.slice(0, 4).map(ds => (
                      <span key={ds} className="text-[6px] font-mono text-[#333]" title={ds}>{dsIcon(ds)}</span>
                    ))}
                    <button
                      onClick={() => setBbEntry(bbEntry === entry.id ? null : entry.id)}
                      className="text-[6px] font-black px-1 py-0.5 border font-mono tracking-widest transition-all"
                      style={{ color: bbEntry === entry.id ? '#050508' : '#00bcd444', borderColor: '#00bcd422', backgroundColor: bbEntry === entry.id ? '#00bcd4' : '#00bcd408' }}>
                      BLACKBOX
                    </button>
                  </div>
                )}
                {/* BLACKBOX expansion */}
                {bbEntry === entry.id && entry.provenance && (
                  <div className="ml-3 mt-0.5 border border-[#00bcd422] bg-[#000a0f] p-2 flex flex-col gap-1.5">
                    <div className="text-[7px] font-mono text-[#00bcd466] tracking-widest uppercase border-b border-[#00bcd414] pb-1">
                      AIP PROVENANCE — RESOURCES USED
                    </div>
                    {/* Memory */}
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[6px] font-mono text-[#00bcd444] tracking-widest uppercase">LONG-TERM MEMORY</div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[6px] font-mono text-[#00bcd488]">ExampleRv17memory</span>
                        <span className="text-[6px] font-mono text-[#333]">×{entry.provenance.memoryCount}</span>
                        <a href={MEMORY_OBJECT_URL} target="_blank" rel="noreferrer"
                          className="text-[6px] font-mono text-[#00bcd433] hover:text-[#00bcd4] underline">↗ FOUNDRY</a>
                      </div>
                      <div className="text-[6px] font-mono text-[#333] truncate">{entry.provenance.memoryDataset}</div>
                    </div>
                    {/* Ontology */}
                    {entry.provenance.ontologyUsed && (
                      <div className="flex flex-col gap-0.5 border-t border-[#00bcd414] pt-1">
                        <div className="text-[6px] font-mono text-[#00bcd444] tracking-widest uppercase">ONTOLOGY GRAPH</div>
                        <div className="text-[6px] font-mono text-[#333] truncate">{entry.provenance.ontologyRid.slice(0, 48)}…</div>
                      </div>
                    )}
                    {/* Datasets */}
                    <div className="flex flex-col gap-0.5 border-t border-[#00bcd414] pt-1">
                      <div className="text-[6px] font-mono text-[#00bcd444] tracking-widest uppercase">DATASETS QUERIED ({entry.provenance.datasetsQueried.length})</div>
                      <div className="flex flex-wrap gap-0.5">
                        {entry.provenance.datasetsQueried.map(ds => (
                          <span key={ds} className="text-[6px] font-mono px-1 border border-[#00bcd414] text-[#00bcd466]">{dsIcon(ds)} {ds}</span>
                        ))}
                      </div>
                    </div>
                    {/* Model */}
                    <div className="border-t border-[#00bcd414] pt-1 text-[6px] font-mono text-[#333] truncate">
                      {entry.provenance.modelVersion}
                    </div>
                  </div>
                )}
              </div>
            )}
            {entry.role === 'system' && (
              <div className="text-[9px] font-mono text-[#444] tracking-widest text-center py-0.5">[{entry.content}]</div>
            )}
          </div>
        ))}

        {/* Quick prompts when no demo running */}
        {!demoState.running && entries.length <= 2 && (
          <div className="flex flex-col gap-0.5 mt-2">
            <div className="text-[7px] font-mono text-[#333] tracking-widest uppercase mb-0.5">QUICK QUERIES</div>
            {QUICK_PROMPTS.map(p => (
              <button key={p} onClick={() => submit(p)}
                className="text-left text-[7px] font-mono text-[#445544] hover:text-[#00ff88] hover:border-[#00ff8822] border border-transparent px-1 py-0.5 transition-colors truncate">
                › {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="px-2 py-1.5 border-t border-[#00ff8826] shrink-0 flex flex-col gap-1 bg-black/60">
        <div className="flex items-center gap-2">
          <span className="text-[#00ff88] font-mono text-[11px] font-bold shrink-0">CMD&gt;</span>
          <input ref={inputRef} type="text" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(input); } }}
            disabled={loading}
            placeholder="Tactical query... (Enter to send)"
            className="flex-1 bg-transparent text-[#00ff88] font-mono text-[10px] outline-none placeholder-[#224433] caret-[#00ff88] disabled:opacity-50"
            autoComplete="off" spellCheck={false} />
          <button onClick={() => submit(input)} disabled={loading || !input.trim()}
            className="text-[9px] font-mono text-[#00ff88] border border-[#00ff884d] px-2 py-0.5 hover:bg-[#00ff881a] disabled:opacity-30 transition-colors tracking-widest shrink-0">
            SEND
          </button>
          <button onClick={clearMemory} disabled={loading}
            title="Clear all Palantir long-term memories"
            className="text-[9px] font-mono text-[#ff640055] border border-[#ff640022] px-1.5 py-0.5 hover:border-[#ff640066] hover:text-[#ff6400] transition-colors shrink-0 disabled:opacity-30">
            CLR
          </button>
        </div>
        <div className="text-[6px] font-mono text-[#222] tracking-widest">
          AIP AGENT · ExampleRv17memory · gpt-5.4 · 10 PALANTIR DATASETS
        </div>
      </div>
    </div>
  );
}
