import { useCallback } from "react";

export interface Region {
    id: string;
    name: string;
    confidence: number;
    bbox: [number, number, number, number]; // [x1, y1, x2, y2] in slide pixels
}

interface RegionOverlayProps {
    regions: Region[];
    slideWidth: number;
    slideHeight: number;
    containerWidth: number;
    containerHeight: number;
    zoom: number;
    panX: number;
    panY: number;
    onRegionClick?: (region: Region) => void;
    show: boolean;
}

/**
 * SVG overlay that draws red bounding boxes for detected tumor regions.
 * Coordinates are computed using the same transform as HeatmapOverlay.
 */
export const RegionOverlay = ({
    regions,
    slideWidth,
    slideHeight,
    containerWidth,
    containerHeight,
    zoom,
    panX,
    panY,
    onRegionClick,
    show,
}: RegionOverlayProps) => {
    const toDisplay = useCallback(
        (sx: number, sy: number) => {
            if (slideWidth === 0 || slideHeight === 0) return { x: 0, y: 0 };
            const imageAspect = slideWidth / slideHeight;
            const containerAspect = containerWidth / containerHeight;
            let displayW: number, displayH: number;
            if (imageAspect > containerAspect) {
                displayW = containerWidth;
                displayH = containerWidth / imageAspect;
            } else {
                displayH = containerHeight;
                displayW = containerHeight * imageAspect;
            }
            const scaleX = (displayW / slideWidth) * zoom;
            const scaleY = (displayH / slideHeight) * zoom;
            const cx = containerWidth / 2;
            const cy = containerHeight / 2;
            const imgOriginX = cx - (displayW * zoom) / 2 + panX;
            const imgOriginY = cy - (displayH * zoom) / 2 + panY;
            return { x: imgOriginX + sx * scaleX, y: imgOriginY + sy * scaleY };
        },
        [slideWidth, slideHeight, containerWidth, containerHeight, zoom, panX, panY]
    );

    if (!show || !regions.length) return null;

    return (
        <svg
            className="absolute inset-0"
            width={containerWidth}
            height={containerHeight}
            style={{ zIndex: 10, overflow: "visible" }}
        >
            {regions.map((region) => {
                const [x1, y1, x2, y2] = region.bbox;
                const tl = toDisplay(x1, y1);
                const br = toDisplay(x2, y2);
                const w = br.x - tl.x;
                const h = br.y - tl.y;

                // Skip if entirely out of view
                if (br.x < 0 || br.y < 0 || tl.x > containerWidth || tl.y > containerHeight) return null;

                const confidenceColor =
                    region.confidence >= 80
                        ? "#ef4444"   // red-500
                        : region.confidence >= 60
                            ? "#f97316"   // orange-500
                            : "#eab308";  // yellow-500

                return (
                    <g
                        key={region.id}
                        onClick={() => onRegionClick?.(region)}
                        style={{ cursor: onRegionClick ? "pointer" : "default" }}
                    >
                        {/* Bounding box */}
                        <rect
                            x={tl.x}
                            y={tl.y}
                            width={Math.max(w, 2)}
                            height={Math.max(h, 2)}
                            fill="none"
                            stroke={confidenceColor}
                            strokeWidth={Math.max(1.5, 2 / zoom)}
                            strokeDasharray={zoom < 0.8 ? "none" : undefined}
                            opacity={0.9}
                        />
                        {/* Glow effect */}
                        <rect
                            x={tl.x}
                            y={tl.y}
                            width={Math.max(w, 2)}
                            height={Math.max(h, 2)}
                            fill="none"
                            stroke={confidenceColor}
                            strokeWidth={Math.max(3, 5 / zoom)}
                            opacity={0.2}
                        />
                        {/* Label background */}
                        {w > 30 && h > 16 && (
                            <>
                                <rect
                                    x={tl.x}
                                    y={tl.y - 20}
                                    width={Math.min(w, 110)}
                                    height={20}
                                    fill={confidenceColor}
                                    opacity={0.9}
                                    rx={3}
                                />
                                <text
                                    x={tl.x + 5}
                                    y={tl.y - 5}
                                    fontSize={Math.max(9, Math.min(12, 11 * zoom))}
                                    fill="white"
                                    fontFamily="Inter, system-ui, sans-serif"
                                    fontWeight="600"
                                    style={{ userSelect: "none" }}
                                >
                                    {region.name} · {region.confidence.toFixed(1)}%
                                </text>
                            </>
                        )}
                    </g>
                );
            })}
        </svg>
    );
};
