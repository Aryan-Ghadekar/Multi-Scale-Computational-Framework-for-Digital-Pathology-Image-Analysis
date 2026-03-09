import { MapPin, ChevronRight, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Region } from "./RegionOverlay";

interface RegionSidebarProps {
    regions: Region[];
    onJumpToRegion: (region: Region) => void;
    /** Currently highlighted region id (optional, for active state) */
    activeRegionId?: string;
}

function ConfidenceBadge({ value }: { value: number }) {
    const isHigh = value >= 80;
    const isMedium = value >= 60;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                isHigh
                    ? "bg-destructive/15 border-destructive/25 text-destructive"
                    : isMedium
                        ? "bg-warning/15 border-warning/25 text-warning"
                        : "bg-success/15 border-success/25 text-success"
            )}
        >
            {isHigh ? (
                <XCircle className="h-2.5 w-2.5" />
            ) : isMedium ? (
                <AlertTriangle className="h-2.5 w-2.5" />
            ) : (
                <CheckCircle2 className="h-2.5 w-2.5" />
            )}
            {value.toFixed(1)}%
        </span>
    );
}

/**
 * Sidebar panel listing all detected tumor regions with jump-to navigation.
 * Integrates cleanly into the existing PatientSidebar layout.
 */
export const RegionSidebar = ({
    regions,
    onJumpToRegion,
    activeRegionId,
}: RegionSidebarProps) => {
    if (!regions.length) {
        return (
            <div className="px-4 py-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <p className="text-sm font-semibold text-foreground">No Suspicious Regions</p>
                <p className="text-xs text-muted-foreground mt-1">
                    AI analysis found no high-confidence tumor regions.
                </p>
            </div>
        );
    }

    // Sort by confidence descending
    const sorted = [...regions].sort((a, b) => b.confidence - a.confidence);

    return (
        <div className="space-y-1.5">
            {/* Summary row */}
            <div className="flex items-center justify-between px-4 py-2 bg-destructive/5 border-b border-border/40">
                <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-[11px] font-bold text-foreground">
                        {regions.length} Region{regions.length !== 1 ? "s" : ""} Detected
                    </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                    Sorted by confidence
                </span>
            </div>

            {/* Region list */}
            <div className="px-2 space-y-1 max-h-72 overflow-y-auto overscroll-contain pb-2">
                {sorted.map((region, idx) => {
                    const isActive = region.id === activeRegionId;
                    return (
                        <button
                            key={region.id}
                            onClick={() => onJumpToRegion(region)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group border",
                                isActive
                                    ? "bg-primary/10 border-primary/30 shadow-sm"
                                    : "bg-background/40 border-border/30 hover:bg-accent/50 hover:border-primary/20"
                            )}
                        >
                            {/* Index badge */}
                            <div
                                className={cn(
                                    "flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                                )}
                            >
                                {idx + 1}
                            </div>

                            {/* Region info */}
                            <div className="flex-1 min-w-0">
                                <p className={cn(
                                    "text-xs font-semibold truncate",
                                    isActive ? "text-primary" : "text-foreground"
                                )}>
                                    {region.name}
                                </p>
                                <ConfidenceBadge value={region.confidence} />
                            </div>

                            {/* Jump arrow */}
                            <ChevronRight
                                className={cn(
                                    "h-3.5 w-3.5 flex-shrink-0 transition-all",
                                    isActive
                                        ? "text-primary translate-x-0.5"
                                        : "text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5"
                                )}
                            />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
