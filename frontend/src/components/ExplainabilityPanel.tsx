import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, AlertCircle, CheckCircle2, Lightbulb, ClipboardCheck } from "lucide-react";
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

  // Extract structured AI data if available
  const aiAnalysis = analysisData?.ai_analysis || {};
  const keyFindings = aiAnalysis.key_findings || [];
  const recommendations = aiAnalysis.recommendations || [];
  
  // Parse explanation text if not already structured
  const explanationText = analysisData?.ai_explanation || "";
  
  // Extract regions from real data
  const regions = analysisData?.regions?.map((region: any, index: number) => ({
    id: region.id || `R${index + 1}`,
    name: region.name || `Region ${index + 1}`,
    confidence: region.confidence || Math.round((region.score || 0.5) * 100),
    score: region.score || 0.5
  })) || [];

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 75) return "default"; // or "secondary" if you want a different color
    if (confidence >= 50) return "secondary";
    return "destructive";
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 75) return <CheckCircle2 className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  return (
    <Card className="p-6 space-y-6 shadow-medium animate-fade-in">
      <div className="flex items-center justify-between pb-4 border-b border-panel-border">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">AI Clinical Analysis</h3>
        </div>
        {onRegenerateExplanation && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRegenerate}
            disabled={isRegenerating}
          >
            <Lightbulb className="h-4 w-4 mr-2" />
            {isRegenerating ? "Regenerating..." : "Regenerate Analysis"}
          </Button>
        )}
      </div>

      {/* Top Contributing Regions - Using REAL data */}
      {regions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            High-Probability Regions Detected
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
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">
                        {region.name}
                      </span>
                      {region.description && (
                        <span className="text-xs text-muted-foreground">
                          {region.description}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-semibold",
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
      )}

      {/* Structured Key Findings - From AI Service */}
      {keyFindings.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Key Clinical Findings</h4>
          <div className="space-y-2">
            {keyFindings.map((finding: string, index: number) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-primary/5">
                <div className="mt-0.5">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
                <p className="text-sm text-foreground/90">{finding}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Clinical Explanation */}
      {explanationText && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Clinical Interpretation</h4>
          <div className="p-4 bg-accent/10 rounded-lg border border-accent/30">
            <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
              {explanationText}
            </div>
          </div>
        </div>
      )}

      {/* Structured Recommendations - From AI Service */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Clinical Recommendations</h4>
          <div className="space-y-2">
            {recommendations.map((rec: string, index: number) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                <div className="mt-0.5">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
                <p className="text-sm text-foreground/90">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence Summary */}
      {analysisData && (
        <div className="p-4 rounded-lg bg-muted/30 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Overall Analysis Confidence</p>
              <p className="text-xs text-muted-foreground">
                Based on {analysisData?.metrics?.total_tiles_analyzed || 0} tissue regions analyzed
              </p>
            </div>
            <Badge
              variant={getConfidenceColor(analysisData.overall_confidence || 0)}
              className="text-sm"
            >
              {analysisData.confidence_level || "Unknown"}
            </Badge>
          </div>
        </div>
      )}
    </Card>
  );
};