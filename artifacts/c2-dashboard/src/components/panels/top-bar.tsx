import { useEffect, useState } from 'react';
import { useGetDashboardSummary } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { AlertCircle, Activity, Crosshair, Radar, ShieldAlert, Cpu } from 'lucide-react';

export function TopBar() {
  const { data: summary, isLoading, isError } = useGetDashboardSummary({
    query: { refetchInterval: 5000 } as any,
  });
  
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'critical': return 'text-destructive glow-destructive border-destructive bg-destructive/10';
      case 'degraded': return 'text-warning glow-warning border-warning bg-warning/10';
      case 'nominal': return 'text-primary glow-primary border-primary bg-primary/10';
      default: return 'text-secondary-foreground border-secondary-foreground/30';
    }
  };

  return (
    <div className="panel-glass w-full flex items-center justify-between p-3 shrink-0">
      
      {/* Brand & Status */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Radar className="w-5 h-5 text-primary glow-text-primary" />
          <div>
            <div className="text-xs text-secondary-foreground font-sans font-semibold tracking-widest">COMMAND & CONTROL</div>
            <div className="text-lg font-bold text-white tracking-wider leading-none">NORAD-ALPHA</div>
          </div>
        </div>
        
        <div className="h-8 w-px bg-primary/20" />
        
        <div className="flex items-center gap-3">
          <div className="text-xs text-secondary-foreground font-sans uppercase tracking-wider">SYS STAT</div>
          {isLoading ? (
            <div className="px-3 py-1 border border-secondary-foreground/30 text-secondary-foreground text-sm font-bold">LOADING...</div>
          ) : isError || !summary ? (
            <div className="px-3 py-1 border border-destructive/50 text-destructive text-sm font-bold animate-pulse-radar">NO DATA</div>
          ) : (
            <div className={`px-4 py-1 border text-sm font-bold uppercase tracking-wider ${getStatusColor(summary.systemStatus)}`}>
              {summary.systemStatus}
            </div>
          )}
        </div>
      </div>
      
      {/* Metrics */}
      <div className="flex items-center gap-6">
        <MetricItem 
          icon={<Crosshair className="w-4 h-4" />}
          label="ACTIVE TRACKS" 
          value={summary?.activeTracksCount} 
          isLoading={isLoading} 
        />
        <MetricItem 
          label="HOSTILE" 
          value={summary?.hostileCount} 
          isLoading={isLoading}
          valueClassName={summary?.hostileCount && summary.hostileCount > 0 ? "text-destructive glow-text-destructive" : ""}
        />
        <MetricItem 
          label="UNKNOWN" 
          value={summary?.unknownCount} 
          isLoading={isLoading}
          valueClassName={summary?.unknownCount && summary.unknownCount > 0 ? "text-warning glow-text-warning" : ""}
        />
        
        <div className="h-8 w-px bg-primary/20" />
        
        <MetricItem 
          icon={<ShieldAlert className="w-4 h-4" />}
          label="THREATS" 
          value={summary?.threatCount} 
          isLoading={isLoading} 
        />
        <MetricItem 
          label="CRITICAL" 
          value={summary?.criticalThreatsCount} 
          isLoading={isLoading}
          valueClassName={summary?.criticalThreatsCount && summary.criticalThreatsCount > 0 ? "text-destructive glow-text-destructive" : ""}
        />
      </div>

      {/* Time & Sync */}
      <div className="flex items-center gap-4 text-right">
        <div className="flex flex-col">
          <div className="text-xs text-secondary-foreground font-sans tracking-wider">ZULU TIME</div>
          <div className="text-white font-bold">{format(time, 'HH:mm:ss.SSS')}Z</div>
        </div>
        <div className="flex flex-col">
          <div className="text-xs text-secondary-foreground font-sans tracking-wider">LOCAL</div>
          <div className="text-primary">{format(time, 'MM/dd/yyyy')}</div>
        </div>
      </div>

    </div>
  );
}

function MetricItem({ 
  icon, 
  label, 
  value, 
  isLoading, 
  valueClassName = "text-white" 
}: { 
  icon?: React.ReactNode; 
  label: string; 
  value?: number; 
  isLoading: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-[10px] text-secondary-foreground font-sans tracking-widest uppercase">
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </div>
      <div className={`text-lg font-bold leading-none ${valueClassName}`}>
        {isLoading ? '---' : value !== undefined ? value.toString().padStart(3, '0') : 'ERR'}
      </div>
    </div>
  );
}
