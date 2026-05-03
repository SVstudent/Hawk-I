import { C2Map } from "@/components/map/c2-map";
import { TopBar } from "@/components/panels/top-bar";
import { LeftPanel } from "@/components/panels/left-panel";
import { RightPanel } from "@/components/panels/right-panel";
import { BottomBar } from "@/components/panels/bottom-bar";
import { HawkIChat } from "@/components/panels/hawk-i-chat";

export default function Dashboard() {
  return (
    <div className="w-full h-[100dvh] overflow-hidden flex flex-col bg-[#050508] text-primary font-mono scanline-overlay selection:bg-primary/30 dark">
      {/* Row 1: TopBar */}
      <div className="shrink-0 h-[58px] border-b border-[#00ff881f]">
        <TopBar />
      </div>

      {/* Row 2: Body */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Left Pane */}
        <div className="w-[19%] min-w-[240px] max-w-[340px] shrink-0 border-r border-[#00ff881f] bg-black/40 panel-glass overflow-hidden flex flex-col z-10 pointer-events-auto">
          <LeftPanel />
        </div>

        {/* Center Canvas */}
        <div className="flex-1 relative overflow-hidden bg-black pointer-events-auto">
          <C2Map />
        </div>

        {/* Right Pane */}
        <div className="w-[19%] min-w-[240px] max-w-[340px] shrink-0 border-l border-[#00ff881f] bg-black/40 panel-glass overflow-hidden flex flex-col z-10 pointer-events-auto">
          <RightPanel />
        </div>
      </div>

      {/* Row 3: BottomBar */}
      <div className="shrink-0 h-[44px]">
        <BottomBar />
      </div>

      {/* Floating HAWK-I Chat — fixed bottom-right, renders above everything */}
      <HawkIChat />
    </div>
  );
}
