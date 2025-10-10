import { Card } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfidenceDisplayProps {
  lesionProbability?: number;
  overallConfidence?: number;
}

export const ConfidenceDisplay = ({ 
  lesionProbability = 60, 
  overallConfidence = 73 
}: ConfidenceDisplayProps) => {
  const getConfidenceLevel = (value: number) => {
    if (value >= 75) return { label: "High", color: "success", icon: CheckCircle2 };
    if (value >= 50) return { label: "Moderate", color: "warning", icon: AlertTriangle };
    return { label: "Low", color: "destructive", icon: AlertTriangle };
  };

  const confidence = getConfidenceLevel(overallConfidence);
  const ConfidenceIcon = confidence.icon;

  return (
    <Card className="p-6 shadow-medium animate-slide-up">
      <div className="space-y-4">
        {/* Lesion Probability */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Lesion Probability</p>
            <p className="text-3xl font-bold text-foreground">{lesionProbability}%</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <ConfidenceIcon
                className={cn(
                  "h-5 w-5",
                  confidence.color === "success" && "text-success",
                  confidence.color === "warning" && "text-warning",
                  confidence.color === "destructive" && "text-destructive"
                )}
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  confidence.color === "success" && "text-success",
                  confidence.color === "warning" && "text-warning",
                  confidence.color === "destructive" && "text-destructive"
                )}
              >
                {confidence.label} Certainty
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {overallConfidence}% confidence
            </p>
          </div>
        </div>

        {/* Confidence Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Model Confidence</span>
            <div className="flex gap-4 text-[10px]">
              <span className="text-destructive">Low</span>
              <span className="text-warning">Moderate</span>
              <span className="text-success">High</span>
            </div>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden bg-muted">
            {/* Gradient background showing scale */}
            <div className="absolute inset-0 bg-gradient-to-r from-destructive via-warning to-success opacity-30" />
            {/* Actual confidence indicator */}
            <div
              className="absolute h-full flex items-center justify-end pr-1 transition-all duration-500"
              style={{ width: `${overallConfidence}%` }}
            >
              <div className="w-1 h-full bg-foreground/80 rounded-full" />
            </div>
          </div>
        </div>

        {/* Status Message */}
        <div
          className={cn(
            "p-3 rounded-lg text-sm",
            confidence.color === "success" && "bg-success/10 text-success-foreground",
            confidence.color === "warning" && "bg-warning/10 text-warning-foreground",
            confidence.color === "destructive" && "bg-destructive/10 text-destructive-foreground"
          )}
        >
          {confidence.color === "success" && (
            <p>
              <strong>High confidence detection:</strong> AI model shows strong
              certainty in lesion identification
            </p>
          )}
          {confidence.color === "warning" && (
            <p>
              <strong>Moderate confidence:</strong> Manual review recommended for
              final diagnosis
            </p>
          )}
          {confidence.color === "destructive" && (
            <p>
              <strong>Low confidence:</strong> Expert pathologist review required
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};