import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, AlertCircle, CheckCircle2, Lightbulb, ClipboardCheck, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ExplainabilityPanelProps {
  analysisData?: any;
  onRegenerateExplanation?: () => Promise<void>;
}

export const ExplainabilityPanel = ({
  analysisData,
  onRegenerateExplanation
}: ExplainabilityPanelProps) => {
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = async () => {
    if (!onRegenerateExplanation) return;
    setIsRegenerating(true);
    await onRegenerateExplanation();
    setIsRegenerating(false);
  };

  const aiAnalysis = analysisData?.ai_analysis || {};
  const keyFindings = aiAnalysis.key_findings || [];
  const recommendations = aiAnalysis.recommendations || [];
  const explanationText = analysisData?.ai_explanation || "";

  const regions = analysisData?.regions?.map((region: any, index: number) => ({
    id: region.id || `R${index + 1}`,
    name: region.name || `Region ${index + 1}`,
    confidence: region.confidence || Math.round((region.score || 0.5) * 100),
    score: region.score || 0.5
  })) || [];

  const getRegionVariant = (confidence: number) => {
    if (confidence >= 75) return { color: "text-success", bg: "bg-success/10", border: "border-success/30", icon: ShieldCheck };
    if (confidence >= 50) return { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", icon: ShieldAlert };
    return { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", icon: AlertCircle };
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(187 85% 40%), hsl(160 70% 40%))' }}
          >
            <Brain className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">AI Clinical Analysis</h3>
            <p className="text-[10px] text-muted-foreground">Powered by Groq LLaMA</p>
          </div>
        </div>
        {onRegenerateExplanation && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="h-7 text-xs gap-1.5 hover:border-primary hover:text-primary hover:bg-primary/5"
          >
            <Lightbulb className="h-3 w-3" />
            {isRegenerating ? "Thinking..." : "Regenerate"}
          </Button>
        )}
      </div>

      {/* Detected Regions */}
      {regions.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5">
            <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
              High-Probability Regions
            </h4>
          </div>
          <div className="space-y-2">
            {regions.map((region: any) => {
              const v = getRegionVariant(region.confidence);
              const RegionIcon = v.icon;
              return (
                <div
                  key={region.id}
                  className={cn("rounded-xl p-3 border transition-all hover:shadow-soft", v.bg, v.border)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <RegionIcon className={cn("h-3.5 w-3.5 flex-shrink-0", v.color)} />
                      <span className="text-xs font-semibold text-foreground">{region.name}</span>
                    </div>
                    <span className={cn("text-xs font-bold font-mono", v.color)}>
                      {region.confidence}%
                    </span>
                  </div>
                  {/* Animated fill bar */}
                  <div className="h-1.5 bg-background/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${region.confidence}%`,
                        background: region.confidence >= 75 ? 'hsl(158 64% 42%)' : region.confidence >= 50 ? 'hsl(38 95% 52%)' : 'hsl(4 86% 58%)',
                        boxShadow: `0 0 6px currentColor`
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Clinical Findings */}
      {keyFindings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Key Clinical Findings</h4>
          <div className="space-y-1.5">
            {keyFindings.map((finding: string, index: number) => (
              <div key={index}
                className="flex items-start gap-2.5 p-2.5 rounded-lg bg-primary/5 border border-primary/15"
              >
                <div className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                <p className="text-xs text-foreground/90 leading-relaxed">{finding}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clinical Interpretation (terminal-style block) */}
      {explanationText && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Clinical Interpretation</h4>
          <div className="rounded-xl overflow-hidden border border-border">
            {/* Terminal header bar */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/60 border-b border-border">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-warning/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-success/70" />
              <span className="ml-2 text-[10px] text-muted-foreground font-mono">AI Clinical Report</span>
            </div>
            <div className="p-3 bg-card/50 font-mono text-xs leading-relaxed text-foreground/85 whitespace-pre-line max-h-40 overflow-y-auto scrollbar-thin">
              {explanationText}
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Clinical Recommendations</h4>
          <div className="space-y-1.5">
            {recommendations.map((rec: string, index: number) => (
              <div key={index}
                className="flex items-start gap-2.5 p-2.5 rounded-lg bg-success/5 border border-success/20"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/90 leading-relaxed">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence summary */}
      {analysisData && (
        <div className="glass-card rounded-xl p-3 border border-border flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-foreground">Overall Analysis Confidence</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {analysisData?.metrics?.total_tiles_analyzed || 0} tissue tiles analyzed
            </p>
          </div>
          <div className={cn(
            "chip border font-bold text-sm px-3 py-1",
            analysisData.confidence_level === "High" ? "bg-success/15 border-success/30 text-success" :
              analysisData.confidence_level === "Moderate" ? "bg-warning/15 border-warning/30 text-warning" :
                "bg-destructive/15 border-destructive/30 text-destructive"
          )}>
            {analysisData.confidence_level || "—"}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!analysisData && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
            <Brain className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No analysis data yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Upload and analyze an image to see AI insights</p>
        </div>
      )}
    </div>
  );
};