import { useEffect, useRef, useCallback } from "react";

interface HeatmapTile {
    x: number;
    y: number;
    confidence: number;
    is_tumor: boolean;
}

interface HeatmapOverlayProps {
    tiles: HeatmapTile[];
    tileSize: number;
    slideWidth: number;
    slideHeight: number;
    show: boolean;
    /** The zoom scale currently applied to the image */
    zoom: number;
    /** Pan offset X (in screen pixels) */
    panX: number;
    /** Pan offset Y (in screen pixels) */
    panY: number;
    /** CSS width of the image container */
    containerWidth: number;
    /** CSS height of the image container */
    containerHeight: number;
}

/** Map confidence [0,1] → RGBA color string */
function confidenceToColor(c: number): [number, number, number] {
    if (c < 0.2) return [0, 0, 255];        // Blue
    if (c < 0.4) return [0, 255, 255];      // Cyan
    if (c < 0.6) return [255, 255, 0];      // Yellow
    if (c < 0.8) return [255, 165, 0];      // Orange
    return [255, 0, 0];                      // Red
}

export const HeatmapOverlay = ({
    tiles,
    tileSize,
    slideWidth,
    slideHeight,
    show,
    zoom,
    panX,
    panY,
    containerWidth,
    containerHeight,
}: HeatmapOverlayProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number | null>(null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Match canvas pixel resolution to container
        canvas.width = containerWidth;
        canvas.height = containerHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!show || !tiles.length || slideWidth === 0 || slideHeight === 0) return;

        // The viewer applies: scale(zoom) translate(panX/zoom, panY/zoom) around center.
        // Displayed image fills the container (object-contain).
        // We need to map from slide coordinates → display coordinates.

        // Compute how the image is fit inside the container (object-contain logic).
        const imageAspect = slideWidth / slideHeight;
        const containerAspect = containerWidth / containerHeight;

        let displayW: number;
        let displayH: number;
        if (imageAspect > containerAspect) {
            displayW = containerWidth;
            displayH = containerWidth / imageAspect;
        } else {
            displayH = containerHeight;
            displayW = containerHeight * imageAspect;
        }

        // Center offset of the image in the unzoomed container
        const baseOffsetX = (containerWidth - displayW) / 2;
        const baseOffsetY = (containerHeight - displayH) / 2;

        // The viewer transform is: scale(zoom) translate(panX/zoom, panY/zoom) from center.
        // In display space this becomes: origin at center, scale zoom, then translate panX, panY.
        const scaleX = (displayW / slideWidth) * zoom;
        const scaleY = (displayH / slideHeight) * zoom;

        // Center of the container
        const cx = containerWidth / 2;
        const cy = containerHeight / 2;

        // Offset from center to image top-left (before pan)
        const imgOriginX = cx - (displayW * zoom) / 2 + panX;
        const imgOriginY = cy - (displayH * zoom) / 2 + panY;

        // Draw all tiles
        for (const tile of tiles) {
            const [r, g, b] = confidenceToColor(tile.confidence);
            const alpha = tile.confidence * 0.8;

            const sx = imgOriginX + tile.x * scaleX;
            const sy = imgOriginY + tile.y * scaleY;
            const sw = tileSize * scaleX;
            const sh = tileSize * scaleY;

            // Skip tiles completely outside the viewport
            if (sx + sw < 0 || sy + sh < 0 || sx > containerWidth || sy > containerHeight) continue;

            ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
            ctx.fillRect(sx, sy, sw, sh);
        }
    }, [tiles, tileSize, slideWidth, slideHeight, show, zoom, panX, panY, containerWidth, containerHeight]);

    useEffect(() => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw);
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        };
    }, [draw]);

    if (!show) return null;

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ width: "100%", height: "100%", zIndex: 5 }}
        />
    );
};
