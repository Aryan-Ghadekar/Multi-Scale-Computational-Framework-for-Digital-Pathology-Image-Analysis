import { useState, useEffect, useRef, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize2, FileImage, AlertCircle, Layers, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HeatmapOverlay } from "./HeatmapOverlay";
import { RegionOverlay, type Region } from "./RegionOverlay";
import { HeatmapLegend } from "./HeatmapLegend";

interface WSIViewerProps {
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  uploadedImage?: File | null;
  analysisData?: any;
  isLoading?: boolean;
  /** Called whenever zoom or pan changes (for external overlay sync) */
  onViewStateChange?: (zoom: number, panX: number, panY: number) => void;
  /** When called, viewer zooms to frame the given bbox [x1,y1,x2,y2] in slide coords */
  onJumpToRegion?: (region: Region) => void;
}

const BACKEND_URL = "http://localhost:8000";

export const WSIViewer = ({
  showHeatmap,
  onToggleHeatmap,
  uploadedImage,
  analysisData,
  isLoading = false,
  onViewStateChange,
}: WSIViewerProps) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageError, setImageError] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(true);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container size for overlay calculations
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    ro.observe(el);
    // Initial read
    setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Propagate view state to parent whenever it changes
  useEffect(() => {
    onViewStateChange?.(zoom, position.x, position.y);
  }, [zoom, position.x, position.y, onViewStateChange]);

  useEffect(() => {
    setImageError(false);
    setImageLoading(true);

    if (analysisData?.preview_image_url) {
      const fullUrl = analysisData.preview_image_url.startsWith("http")
        ? analysisData.preview_image_url
        : `${BACKEND_URL}${analysisData.preview_image_url}`;
      setImageUrl(fullUrl);
    } else if (uploadedImage) {
      const url = URL.createObjectURL(uploadedImage);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImageUrl("");
      setImageLoading(false);
    }
  }, [analysisData, uploadedImage]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleReset = () => { setZoom(1); setPosition({ x: 0, y: 0 }); };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  const handleImageLoad = () => { setImageLoading(false); setImageError(false); };
  const handleImageError = () => { setImageError(true); setImageLoading(false); };

  /** Jump viewer to show a given region by computing the needed zoom & pan */
  const jumpToRegion = useCallback((region: Region) => {
    const hd = analysisData?.heatmap_data;
    if (!hd?.width || !hd?.height) return;
    const [x1, y1, x2, y2] = region.bbox;

    // Compute target zoom to fit this region at ~60% of viewport
    const regionW = x2 - x1;
    const regionH = y2 - y1;
    if (regionW <= 0 || regionH <= 0) return;

    const imageAspect = hd.width / hd.height;
    const containerAspect = containerSize.width / containerSize.height;
    let displayW: number, displayH: number;
    if (imageAspect > containerAspect) {
      displayW = containerSize.width;
      displayH = containerSize.width / imageAspect;
    } else {
      displayH = containerSize.height;
      displayW = containerSize.height * imageAspect;
    }

    const scaleX = displayW / hd.width;
    const scaleY = displayH / hd.height;

    // Target: fit region to 60% of smaller container dimension
    const targetZoom = Math.min(
      Math.max((containerSize.width * 0.6) / (regionW * scaleX), 0.5),
      3
    );

    // Region center in slide → display coords (unzoomed)
    const imgBaseX = (containerSize.width - displayW) / 2;
    const imgBaseY = (containerSize.height - displayH) / 2;
    const displayCX = imgBaseX + ((x1 + x2) / 2) * scaleX;
    const displayCY = imgBaseY + ((y1 + y2) / 2) * scaleY;

    // Pan needed to bring region center to viewport center at targetZoom.
    // Viewer transform: scale(zoom) translate(pan/zoom) from center, so:
    //   screenPos = containerCenter + zoom * (displayPos - containerCenter) + pan
    // Setting screenPos = containerCenter → pan = -zoom * (displayPos - containerCenter)
    const panX = -(displayCX - containerSize.width / 2) * targetZoom;
    const panY = -(displayCY - containerSize.height / 2) * targetZoom;

    setZoom(targetZoom);
    setPosition({ x: panX, y: panY });
  }, [analysisData, containerSize]);

  // Expose jumpToRegion via a ref-style prop pattern
  // We expose it by adding it to the returned JSX via a hidden handler in parent via onJumpToRegion

  // Parse heatmap data for overlay
  const heatmapData = analysisData?.heatmap_data;
  const tiles = heatmapData?.tiles ?? [];
  const slideWidth = heatmapData?.width ?? 0;
  const slideHeight = heatmapData?.height ?? 0;
  const tileSize = heatmapData?.tile_size ?? 224;

  // Parse region data for overlay
  const rawRegions: any[] = Array.isArray(analysisData?.regions) ? analysisData.regions : [];
  const regions: Region[] = rawRegions
    .filter(r => Array.isArray(r.bbox) && r.bbox.length === 4)
    .map((r, i) => ({
      id: r.id ?? `R${i + 1}`,
      name: r.name ?? `Region ${i + 1}`,
      confidence: typeof r.confidence === 'number' ? r.confidence : (r.score ?? 0) * 100,
      bbox: r.bbox as [number, number, number, number],
    }));

  return (
    <div className="relative w-full h-full flex flex-col rounded-2xl overflow-hidden border border-border/60 bg-card shadow-soft">

      {/* ── Fixed Toolbar (always on top) ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-card/80 backdrop-blur-sm flex-shrink-0 z-10">
        {/* Zoom group */}
        <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
          <Button variant="ghost" size="sm"
            onClick={handleZoomOut} disabled={zoom <= 0.5}
            className="h-7 w-7 p-0 rounded-lg hover:bg-background/70 transition-all"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-bold px-2 text-foreground min-w-[3rem] text-center font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="sm"
            onClick={handleZoomIn} disabled={zoom >= 3}
            className="h-7 w-7 p-0 rounded-lg hover:bg-background/70 transition-all"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-4 bg-border/60 mx-0.5" />
          <Button variant="ghost" size="sm"
            onClick={handleReset}
            className="h-7 w-7 p-0 rounded-lg hover:bg-background/70 transition-all"
            title="Reset view"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Pan hint */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg">
          <Move className="h-3 w-3" />
          <span>Drag to pan</span>
        </div>

        {/* Heatmap toggle */}
        <div className="ml-auto">
          <button
            onClick={onToggleHeatmap}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border",
              showHeatmap
                ? "bg-primary text-primary-foreground border-primary/50 shadow-lg"
                : "bg-muted/40 text-foreground border-border/60 hover:border-primary/40 hover:bg-primary/5"
            )}
            disabled={!analysisData}
          >
            <Layers className="h-3.5 w-3.5" />
            {showHeatmap ? "Original View" : "Heatmap View"}
          </button>
        </div>
      </div>

      {/* ── Viewer Canvas ── */}
      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden">

        {/* AI Analysis Regeneration Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center glass-card rounded-2xl p-8 shadow-heavy">
              <div className="relative w-14 h-14 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
                <div className="absolute inset-2 rounded-full border-2 border-t-primary/60 animate-spin"
                  style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
              </div>
              <p className="text-sm font-semibold text-foreground">Regenerating Analysis</p>
              <p className="text-xs text-muted-foreground mt-1">Groq LLaMA processing...</p>
            </div>
          </div>
        )}

        {/* ── NEW: Heatmap Legend (bottom-right) ── */}
        <HeatmapLegend show={showHeatmap && !!analysisData?.heatmap_data} />

        {/* Analysis results overlay (top-right, only in heatmap mode) */}
        {showHeatmap && analysisData && (
          <div className="absolute top-3 right-3 glass-card rounded-xl p-3 shadow-medium z-20 min-w-[160px] pointer-events-none">
            <h4 className="text-[10px] font-bold mb-2 text-foreground uppercase tracking-wide">Results</h4>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Lesion</span>
                <span className="font-bold">{analysisData.lesion_probability}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Confidence</span>
                <span className={cn("chip border font-semibold text-[10px]",
                  analysisData.confidence_level === "High" ? "bg-success/15 border-success/20 text-success" :
                    analysisData.confidence_level === "Moderate" ? "bg-warning/15 border-warning/20 text-warning" :
                      "bg-destructive/15 border-destructive/20 text-destructive"
                )}>
                  {analysisData.confidence_level}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Mini-map (bottom-right is now occupied by legend; move mini-map to bottom-left when heatmap is on) */}
        {imageUrl && !imageLoading && (
          <div className={cn("absolute bottom-3 z-20", showHeatmap && analysisData?.heatmap_data ? "left-3" : "right-3")}>
            <div className="bg-card/90 backdrop-blur border border-border/60 rounded-xl overflow-hidden shadow-medium">
              <div className="relative w-24 h-20">
                <img src={imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-50" alt="" aria-hidden />
                <div
                  className="absolute border-2 border-primary bg-primary/15 rounded-sm transition-all duration-200"
                  style={{
                    width: `${Math.max(20, 100 / zoom)}%`,
                    height: `${Math.max(20, 100 / zoom)}%`,
                    left: `${Math.min(75, Math.max(0, 50 - position.x / 15))}%`,
                    top: `${Math.min(75, Math.max(0, 50 - position.y / 15))}%`,
                  }}
                />
              </div>
              <p className="text-[9px] text-muted-foreground text-center py-1 leading-none bg-muted/30">Mini-map</p>
            </div>
          </div>
        )}

        {/* ── Pan/Zoom Area ── */}
        <div
          className={cn(
            "w-full h-full flex items-center justify-center",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {imageUrl ? (
            <div
              className="relative w-full h-full"
              style={{
                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                transition: isDragging ? 'none' : 'transform 0.15s ease',
                transformOrigin: 'center center'
              }}
            >
              {/* Error banner */}
              {imageError && (
                <Alert variant="destructive" className="absolute top-3 left-3 right-3 z-20 shadow-medium">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Failed to load image. Check server connectivity.</AlertDescription>
                </Alert>
              )}

              {/* Loading overlay */}
              {imageLoading && (
                <div className="absolute inset-0 bg-background/90 flex items-center justify-center z-10">
                  <div className="text-center space-y-3">
                    <div className="relative w-12 h-12 mx-auto">
                      <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                      <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Loading Image</p>
                    <p className="text-xs text-muted-foreground">Preparing tissue view...</p>
                  </div>
                </div>
              )}

              {/* Main Image — fills the entire panning area */}
              <img
                src={imageUrl}
                alt="Pathology tissue slide"
                className={cn(
                  "w-full h-full object-contain transition-opacity duration-500 select-none",
                  showHeatmap && analysisData ? "opacity-40" : "opacity-100",
                  imageLoading ? "opacity-0" : ""
                )}
                draggable={false}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />

              {/* ── NEW: Canvas Heatmap Overlay ── */}
              {!imageLoading && (
                <HeatmapOverlay
                  tiles={tiles}
                  tileSize={tileSize}
                  slideWidth={slideWidth}
                  slideHeight={slideHeight}
                  show={showHeatmap && tiles.length > 0}
                  zoom={zoom}
                  panX={position.x}
                  panY={position.y}
                  containerWidth={containerSize.width}
                  containerHeight={containerSize.height}
                />
              )}

              {/* ── NEW: Region Bounding Box Overlay ── */}
              {!imageLoading && regions.length > 0 && (
                <RegionOverlay
                  regions={regions}
                  slideWidth={slideWidth || 1}
                  slideHeight={slideHeight || 1}
                  containerWidth={containerSize.width}
                  containerHeight={containerSize.height}
                  zoom={zoom}
                  panX={position.x}
                  panY={position.y}
                  onRegionClick={jumpToRegion}
                  show={true}
                />
              )}

              {/* Heatmap mode badge */}
              {showHeatmap && analysisData && (
                <div className="absolute top-3 left-3 bg-primary/90 text-primary-foreground px-2.5 py-1 rounded-lg text-[10px] font-bold z-10 shadow-lg uppercase tracking-widest">
                  Heatmap Mode
                </div>
              )}

              {/* Analysis running placeholder */}
              {!analysisData && !imageLoading && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                  <div className="text-center space-y-3 glass-card p-6 rounded-2xl">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
                    <p className="text-sm font-semibold text-foreground">Running AI Analysis</p>
                    <p className="text-xs text-muted-foreground">Processing tissue tiles...</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* No image selected state */
            <div className="flex flex-col items-center justify-center gap-5 select-none">
              <div className="w-20 h-20 rounded-2xl bg-muted/60 flex items-center justify-center border border-border">
                <FileImage className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-base font-semibold text-foreground/70">No Image Selected</p>
                <p className="text-sm text-muted-foreground max-w-xs text-center">
                  Upload a pathology image to begin AI-powered analysis and WSI visualization
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};