interface HeatmapLegendProps {
    show: boolean;
}

const LEGEND_ENTRIES = [
    { color: "#0000ff", label: "Very Low", range: "0–20%" },
    { color: "#00ffff", label: "Low", range: "20–40%" },
    { color: "#ffff00", label: "Moderate", range: "40–60%" },
    { color: "#ffa500", label: "High", range: "60–80%" },
    { color: "#ff0000", label: "Very High", range: "80–100%" },
] as const;

/**
 * Color legend panel for the heatmap probability scale.
 * Positioned in the bottom-right corner of the WSI viewer.
 */
export const HeatmapLegend = ({ show }: HeatmapLegendProps) => {
    if (!show) return null;

    return (
        <div
            className="absolute bottom-3 right-3 z-20 pointer-events-none"
            style={{ minWidth: 148 }}
        >
            <div
                className="glass-card rounded-xl p-3 shadow-medium"
                style={{ backdropFilter: "blur(8px)" }}
            >
                <h4 className="text-[10px] font-bold mb-2 text-foreground uppercase tracking-wide">
                    Tumor Probability
                </h4>
                <div className="space-y-1.5">
                    {LEGEND_ENTRIES.map((entry) => (
                        <div key={entry.label} className="flex items-center gap-2">
                            <div
                                className="flex-shrink-0 rounded-sm"
                                style={{
                                    width: 14,
                                    height: 14,
                                    backgroundColor: entry.color,
                                    opacity: 0.85,
                                    boxShadow: `0 0 5px ${entry.color}80`,
                                }}
                            />
                            <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                                <span className="text-[10px] font-semibold text-foreground">
                                    {entry.label}
                                </span>
                                <span className="text-[9px] text-muted-foreground font-mono">
                                    {entry.range}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Gradient bar */}
                <div className="mt-2 h-1.5 rounded-full" style={{
                    background: "linear-gradient(to right, #0000ff, #00ffff, #ffff00, #ffa500, #ff0000)"
                }} />
                <div className="flex justify-between mt-0.5">
                    <span className="text-[8px] text-muted-foreground">Normal</span>
                    <span className="text-[8px] text-muted-foreground">Tumor</span>
                </div>
            </div>
        </div>
    );
};
