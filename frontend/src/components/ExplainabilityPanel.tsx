import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExplainabilityPanelProps {
  analysisData?: any;
}

export const ExplainabilityPanel = ({ analysisData }: ExplainabilityPanelProps) => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 75) return "success";
    if (confidence >= 50) return "warning";
    return "destructive";
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 75) return <CheckCircle2 className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  // Use analysis data or fallback to mock data
  const regions = analysisData?.regions || [
    { id: "A", name: "Region A (Upper Left)", confidence: 85, score: 0.85 },
    { id: "B", name: "Region B (Center)", confidence: 72, score: 0.72 },
    { id: "C", name: "Region C (Lower Right)", confidence: 68, score: 0.68 },
  ];

  return (
    <Card className="p-6 space-y-6 shadow-medium animate-fade-in">
      <div className="flex items-center gap-2 pb-4 border-b border-panel-border">
        <Brain className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">AI Explainability</h3>
      </div>

      {/* Top Contributing Regions */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">
          Top Contributing Regions
        </h4>
        <div className="space-y-3">
          {regions.map((region: any) => (
            <div
              key={region.id}
              className="space-y-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono",
                      region.confidence >= 75 && "border-success text-success",
                      region.confidence >= 50 &&
                        region.confidence < 75 &&
                        "border-warning text-warning",
                      region.confidence < 50 &&
                        "border-destructive text-destructive"
                    )}
                  >
                    {region.id}
                  </Badge>
                  <span className="text-sm text-foreground">{region.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      region.confidence >= 75 && "text-success",
                      region.confidence >= 50 &&
                        region.confidence < 75 &&
                        "text-warning",
                      region.confidence < 50 && "text-destructive"
                    )}
                  >
                    {region.confidence}%
                  </span>
                  {getConfidenceIcon(region.confidence)}
                </div>
              </div>
              <Progress
                value={region.confidence}
                className={cn(
                  "h-2",
                  region.confidence >= 75 && "[&>div]:bg-success",
                  region.confidence >= 50 &&
                    region.confidence < 75 &&
                    "[&>div]:bg-warning",
                  region.confidence < 50 && "[&>div]:bg-destructive"
                )}
              />
            </div>
          ))}
        </div>
      </div>

      {/* AI Reasoning Summary */}
      {analysisData?.ai_explanation && (
        <div className="space-y-2 p-4 bg-accent/20 rounded-lg border border-accent">
          <h4 className="text-sm font-medium text-accent-foreground">
            Key AI Reasoning
          </h4>
          <div className="text-sm text-foreground/80 leading-relaxed">
            {analysisData.ai_explanation.split('\n').map((line: string, index: number) => (
              <p key={index} className="mb-2">{line}</p>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};