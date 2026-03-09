import { MapPin, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfidenceDisplayProps {
  lesionProbability?: number;
  overallConfidence?: number;
  regionsCount?: number;
}

const ArcMeter = ({ value, size = 100 }: { value: number; size?: number }) => {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference * 0.75;
  const startAngle = 135;

  const getColor = (v: number) => {
    if (v >= 75) return "hsl(158 64% 42%)";
    if (v >= 50) return "hsl(38 95% 52%)";
    return "hsl(4 86% 58%)";
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="-rotate-[135deg]"
      >
        {/* Track */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          strokeWidth="8"
          stroke="hsl(var(--border))"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          strokeWidth="8"
          stroke={getColor(value)}
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${getColor(value)}80)`,
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)'
          }}
        />
      </svg>
      {/* Text overlay — always rounded to prevent overflow */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ marginTop: 4 }}>
        <span
          className="font-extrabold text-foreground leading-none tabular-nums"
          style={{ fontSize: Math.round(value) >= 100 ? 14 : Math.round(value) >= 10 ? 18 : 20 }}
        >
          {Math.round(value)}
        </span>
        <span className="text-[9px] font-semibold text-muted-foreground leading-none mt-0.5">%</span>
      </div>
    </div>
  );
};

export const ConfidenceDisplay = ({
  lesionProbability = 60,
  overallConfidence = 73,
  regionsCount = 0
}: ConfidenceDisplayProps) => {
  const getConfidenceLevel = (value: number) => {
    if (value >= 75) return { label: "High", color: "success" as const, icon: CheckCircle2, desc: "Strong lesion certainty detected" };
    if (value >= 50) return { label: "Moderate", color: "warning" as const, icon: AlertTriangle, desc: "Manual review recommended" };
    return { label: "Low", color: "danger" as const, icon: XCircle, desc: "Expert pathologist review required" };
  };

  const confidence = getConfidenceLevel(overallConfidence);
  const ConfidenceIcon = confidence.icon;

  const confidenceColorValue = {
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive"
  }[confidence.color];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-slide-up">
      {/* Lesion Probability — arc meter */}
      <div className="glass-card rounded-2xl p-4 flex items-center gap-4 shadow-soft">
        <ArcMeter value={lesionProbability} size={90} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Lesion Probability</p>
          <p className="text-xl font-bold text-foreground mt-0.5">{lesionProbability}%</p>
          <div className={cn("flex items-center gap-1.5 mt-1.5 chip", {
            "bg-success/15 text-success": confidence.color === "success",
            "bg-warning/15 text-warning": confidence.color === "warning",
            "bg-destructive/15 text-destructive": confidence.color === "danger",
          })}>
            <ConfidenceIcon className="h-3 w-3" />
            {confidence.label} Risk
          </div>
        </div>
      </div>

      {/* Model Confidence */}
      <div className="glass-card rounded-2xl p-4 shadow-soft">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Model Confidence</p>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-extrabold text-foreground">{overallConfidence}</span>
          <span className="text-sm text-muted-foreground font-medium">%</span>
        </div>
        {/* Segmented progress bar */}
        <div className="relative h-2.5 rounded-full overflow-hidden bg-muted">
          <div className="absolute inset-0 confidence-gradient opacity-25 rounded-full" />
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${overallConfidence}%`,
              background: overallConfidence >= 75
                ? 'hsl(158 64% 42%)'
                : overallConfidence >= 50
                  ? 'hsl(38 95% 52%)'
                  : 'hsl(4 86% 58%)',
              boxShadow: `0 0 8px ${overallConfidence >= 75 ? 'hsl(158 64% 42%)' : overallConfidence >= 50 ? 'hsl(38 95% 52%)' : 'hsl(4 86% 58%)'}80`
            }}
          />
          {/* Needle */}
          <div
            className="absolute inset-y-0 w-0.5 bg-white/80 rounded-full"
            style={{ left: `calc(${overallConfidence}% - 1px)` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] font-semibold">
          <span className="text-destructive">Low</span>
          <span className="text-warning">Moderate</span>
          <span className="text-success">High</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{confidence.desc}</p>
      </div>

      {/* Regions Detected */}
      <div className="glass-card rounded-2xl p-4 shadow-soft">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Regions Detected</p>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-extrabold text-foreground">{regionsCount}</span>
          <span className="text-sm text-muted-foreground font-medium">regions</span>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs text-muted-foreground">Suspicious tissue regions</span>
        </div>
        <div className={cn(
          "mt-3 p-2 rounded-lg text-xs font-medium",
          regionsCount > 5 ? "bg-destructive/10 text-destructive" :
            regionsCount > 2 ? "bg-warning/10 text-warning" :
              "bg-success/10 text-success"
        )}>
          {regionsCount > 5 ? "⚠ High region count — review required" :
            regionsCount > 2 ? "Moderate spread detected" :
              regionsCount === 0 ? "No suspicious regions found" :
                "Localized findings"}
        </div>
      </div>
    </div>
  );
};