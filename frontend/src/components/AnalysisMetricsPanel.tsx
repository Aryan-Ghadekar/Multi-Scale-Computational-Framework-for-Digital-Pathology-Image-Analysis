import { Activity, Grid3X3, Target, TrendingUp, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalysisData {
    lesion_probability?: number;
    overall_confidence?: number;
    confidence_level?: string;
    metrics?: {
        total_tiles_analyzed?: number;
        tumor_tiles_detected?: number;
        non_tumor_tiles?: number;
        average_tumor_confidence?: number;
    };
}

interface AnalysisMetricsPanelProps {
    analysisData: AnalysisData | null;
}

interface MetricCardProps {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    sub?: string;
    accent?: "default" | "success" | "warning" | "danger";
}

const MetricCard = ({ icon, label, value, sub, accent = "default" }: MetricCardProps) => {
    const accentClasses = {
        default: "text-primary bg-primary/10",
        success: "text-success bg-success/10",
        warning: "text-warning bg-warning/10",
        danger: "text-destructive bg-destructive/10",
    };

    return (
        <div className="glass-card rounded-xl p-3.5 shadow-soft flex items-start gap-3 min-w-0">
            <div className={cn("flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center", accentClasses[accent])}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">{label}</p>
                <div className="text-lg font-extrabold text-foreground leading-tight mt-0.5">{value}</div>
                {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
            </div>
        </div>
    );
};

/**
 * Horizontal panel of analysis metric cards shown below the WSI viewer.
 * Reads data from the existing analysis API response.
 */
export const AnalysisMetricsPanel = ({ analysisData }: AnalysisMetricsPanelProps) => {
    if (!analysisData) return null;

    const {
        lesion_probability = 0,
        overall_confidence = 0,
        confidence_level = "—",
        metrics = {},
    } = analysisData;

    const {
        total_tiles_analyzed = 0,
        tumor_tiles_detected = 0,
        average_tumor_confidence = 0,
    } = metrics;

    const confidenceAccent =
        confidence_level === "High"
            ? "success"
            : confidence_level === "Moderate"
                ? "warning"
                : confidence_level === "Analysis Failed"
                    ? "danger"
                    : "default";

    const tumorRatio = total_tiles_analyzed > 0
        ? ((tumor_tiles_detected / total_tiles_analyzed) * 100).toFixed(1)
        : "0.0";

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 animate-slide-up">
            <MetricCard
                icon={<Activity className="h-4 w-4" />}
                label="Lesion Probability"
                value={<span>{lesion_probability}<span className="text-sm font-semibold text-muted-foreground">%</span></span>}
                sub="AI lesion score"
                accent={lesion_probability >= 70 ? "danger" : lesion_probability >= 40 ? "warning" : "success"}
            />
            <MetricCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Overall Confidence"
                value={<span>{typeof overall_confidence === 'number' ? overall_confidence.toFixed(1) : overall_confidence}<span className="text-sm font-semibold text-muted-foreground">%</span></span>}
                sub="Model certainty"
                accent="default"
            />
            <MetricCard
                icon={<Shield className="h-4 w-4" />}
                label="Confidence Level"
                value={
                    <span
                        className={cn(
                            "text-sm font-bold px-2 py-0.5 rounded-md",
                            confidence_level === "High"
                                ? "bg-success/15 text-success"
                                : confidence_level === "Moderate"
                                    ? "bg-warning/15 text-warning"
                                    : "bg-destructive/15 text-destructive"
                        )}
                    >
                        {confidence_level}
                    </span>
                }
                sub="Clinical grade"
                accent={confidenceAccent as any}
            />
            <MetricCard
                icon={<Grid3X3 className="h-4 w-4" />}
                label="Total Tiles"
                value={total_tiles_analyzed.toLocaleString()}
                sub="Tiles analyzed"
                accent="default"
            />
            <MetricCard
                icon={<Target className="h-4 w-4" />}
                label="Tumor Tiles"
                value={tumor_tiles_detected.toLocaleString()}
                sub={`${tumorRatio}% of total`}
                accent={tumor_tiles_detected > 0 ? "danger" : "success"}
            />
        </div>
    );
};
