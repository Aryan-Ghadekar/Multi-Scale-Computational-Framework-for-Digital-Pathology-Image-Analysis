import { useState, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2, ImageIcon, FileImage, AlertCircle, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WSIViewerProps {
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  uploadedImage?: File | null;
  analysisData?: any;
  isLoading?: boolean;
}

const BACKEND_URL = "http://localhost:8000";

export const WSIViewer = ({ showHeatmap, onToggleHeatmap, uploadedImage, analysisData, isLoading = false }: WSIViewerProps) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageError, setImageError] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(true);

  useEffect(() => {
    setImageError(false);
    setImageLoading(true);

    if (analysisData?.preview_image_url) {
      const fullUrl = analysisData.preview_image_url.startsWith("http")
        ? analysisData.preview_image_url
        : `${BACKEND_URL}${analysisData.preview_image_url}`;
      console.log("🟢 Setting preview image URL:", fullUrl);
      setImageUrl(fullUrl);
    } else if (uploadedImage) {
      const url = URL.createObjectURL(uploadedImage);
      console.log("🟡 Using uploaded blob URL:", url);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImageUrl("");
      setImageLoading(false);
    }
  }, [analysisData, uploadedImage]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleReset = () => { setZoom(1); setPosition({ x: 0, y: 0 }); };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleImageLoad = () => {
    console.log("✅ Image loaded successfully:", imageUrl);
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    console.error("❌ Image failed to load:", imageUrl);
    setImageError(true);
    setImageLoading(false);
  };

  const renderHeatmapOverlay = () => {
    if (!showHeatmap || !analysisData?.heatmap_data) return null;
    return (
      <div className="absolute inset-0 pointer-events-none">
        <div className="w-full h-full bg-gradient-to-br from-red-500/20 to-green-500/20 opacity-60" />
      </div>
    );
  };

  const renderHeatmapLegend = () => {
    if (!showHeatmap || !analysisData?.heatmap_data) return null;
    return (
      <div className="absolute bottom-4 left-4 glass-card rounded-xl p-3 shadow-medium z-10">
        <h4 className="text-xs font-bold mb-2.5 text-foreground uppercase tracking-wide">Heatmap Legend</h4>
        {/* Gradient bar */}
        <div className="h-2 rounded-full confidence-gradient mb-2 w-32" />
        <div className="flex justify-between text-[9px] font-semibold text-muted-foreground mb-3">
          <span>Normal</span>
          <span>Suspect</span>
          <span>Tumor</span>
        </div>
        {analysisData.metrics && (
          <div className="space-y-1.5 border-t border-border pt-2 text-xs">
            <div className="flex justify-between items-center gap-4">
              <span className="text-muted-foreground">Tiles Analyzed</span>
              <span className="font-semibold text-foreground">{analysisData.metrics.total_tiles_analyzed}</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-muted-foreground">Tumor Tiles</span>
              <span className="font-semibold text-destructive">{analysisData.metrics.tumor_tiles_detected}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAnalysisInfo = () => {
    if (!analysisData || !showHeatmap) return null;
    const levelColor = {
      High: "text-success bg-success/15 border-success/20",
      Moderate: "text-warning bg-warning/15 border-warning/20",
      Low: "text-destructive bg-destructive/15 border-destructive/20"
    }[analysisData.confidence_level as string] || "text-muted-foreground bg-muted/30 border-border";

    return (
      <div className="absolute top-4 right-4 glass-card rounded-xl p-3 shadow-medium max-w-[200px] z-10">
        <h4 className="text-xs font-bold mb-2.5 text-foreground uppercase tracking-wide">Analysis Results</h4>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Lesion Prob.</span>
            <span className="font-bold text-foreground">{analysisData.lesion_probability}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Confidence</span>
            <span className={cn("chip border font-semibold", levelColor)}>
              {analysisData.confidence_level}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Regions</span>
            <span className="font-bold text-foreground">{analysisData.regions?.length || 0}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-border bg-viewer-bg">
      {/* AI Analysis Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl">
          <div className="text-center glass-card rounded-2xl p-8 shadow-heavy">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-t-primary/60 animate-spin"
                style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
            </div>
            <p className="text-sm font-semibold text-foreground">AI Regenerating Analysis</p>
            <p className="text-xs text-muted-foreground mt-1">Groq LLaMA processing...</p>
          </div>
        </div>
      )}

      {/* ── Floating Toolbar ── */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        {/* Zoom controls */}
        <div className="glass-card flex items-center gap-1 p-1 rounded-xl shadow-soft">
          <Button variant="ghost" size="sm"
            onClick={handleZoomOut}
            className="h-8 w-8 p-0 hover:bg-background/60 rounded-lg transition-all hover:scale-110"
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-bold px-2 text-foreground min-w-[3rem] text-center font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="sm"
            onClick={handleZoomIn}
            className="h-8 w-8 p-0 hover:bg-background/60 rounded-lg transition-all hover:scale-110"
            disabled={zoom >= 3}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-5 bg-border/60 mx-0.5" />
          <Button variant="ghost" size="sm"
            onClick={handleReset}
            className="h-8 w-8 p-0 hover:bg-background/60 rounded-lg transition-all hover:scale-110"
            title="Reset view"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Heatmap toggle */}
        <button
          onClick={onToggleHeatmap}
          className={cn(
            "glass-card flex items-center gap-2 px-3 py-1.5 rounded-xl shadow-soft text-xs font-semibold transition-all",
            showHeatmap
              ? "bg-primary text-primary-foreground border-primary/50 shadow-glow"
              : "text-foreground hover:border-primary/40"
          )}
          disabled={!analysisData}
        >
          <Layers className="h-3.5 w-3.5" />
          {showHeatmap ? "Original View" : "Heatmap View"}
        </button>
      </div>

      {/* ── Mini-map ── */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="glass-card rounded-xl overflow-hidden w-28 h-28 shadow-soft">
          <div className="relative w-full h-full border border-primary/20 rounded-xl overflow-hidden">
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.1), hsl(var(--accent)/0.15))' }}
            />
            {imageUrl && !imageLoading && (
              <img src={imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-50" alt="" aria-hidden />
            )}
            <div
              className="absolute border-2 border-primary bg-primary/15 rounded-sm transition-all duration-200"
              style={{
                width: `${Math.max(20, 100 / zoom)}%`,
                height: `${Math.max(20, 100 / zoom)}%`,
                left: `${Math.min(80, Math.max(0, 50 - position.x / 10))}%`,
                top: `${Math.min(80, Math.max(0, 50 - position.y / 10))}%`,
              }}
            />
          </div>
          <p className="text-[9px] text-muted-foreground text-center py-1 leading-none">Mini-map</p>
        </div>
      </div>

      {/* Heatmap legend / analysis overlay */}
      {renderHeatmapLegend()}
      {renderAnalysisInfo()}

      {/* ── WSI Viewer Area ── */}
      <div
        className={cn(
          "w-full h-full flex items-center justify-center overflow-hidden",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="relative"
          style={{ transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`, transition: isDragging ? 'none' : 'transform 0.15s ease' }}
        >
          <div className="w-[800px] h-[580px] rounded-xl overflow-hidden shadow-heavy border border-border/40 bg-card relative">
            {imageUrl ? (
              <>
                {imageError && (
                  <Alert variant="destructive" className="absolute top-4 left-4 right-4 z-20 shadow-medium">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Failed to load image. Check server connectivity.</AlertDescription>
                  </Alert>
                )}

                {/* Main Image */}
                <img
                  src={imageUrl}
                  alt="Uploaded pathology image"
                  className={cn(
                    "w-full h-full object-contain transition-all duration-500",
                    showHeatmap && analysisData ? "opacity-40" : "opacity-100",
                    imageLoading ? "opacity-0" : ""
                  )}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />

                {/* Loading overlay */}
                {imageLoading && (
                  <div className="absolute inset-0 bg-background/90 flex items-center justify-center scan-overlay">
                    <div className="text-center space-y-3 glass-card p-8 rounded-2xl shadow-heavy">
                      <div className="relative w-14 h-14 mx-auto">
                        <div className="absolute inset-0 rounded-full border-3 border-primary/20" />
                        <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {analysisData?.preview_image_url ? "Loading Analysis Preview" : "Processing Image"}
                      </p>
                      <p className="text-xs text-muted-foreground">Preparing high-resolution tissue view</p>
                    </div>
                  </div>
                )}

                {/* Heatmap overlay */}
                {renderHeatmapOverlay()}

                {/* Analysis running overlay */}
                {!analysisData && !imageLoading && (
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                    <div className="text-center space-y-3 glass-card p-6 rounded-2xl scan-overlay">
                      <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary border-t-transparent mx-auto" />
                      <p className="text-sm font-semibold text-foreground">Running AI Analysis</p>
                      <p className="text-xs text-muted-foreground">ML model processing tissue tiles...</p>
                    </div>
                  </div>
                )}

                {/* Heatmap mode badge */}
                {showHeatmap && analysisData && (
                  <div className="absolute top-3 left-3 bg-primary/90 text-primary-foreground px-2.5 py-1 rounded-lg text-[10px] font-bold z-10 shadow-glow uppercase tracking-widest">
                    Heatmap Mode
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, hsl(var(--muted)/0.5), hsl(var(--secondary)/0.3))' }}
              >
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto border border-border">
                    <FileImage className="h-10 w-10 text-muted-foreground/60" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-foreground/70">No Image Selected</p>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Upload a pathology image to begin AI-powered analysis and WSI visualization
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile zoom */}
      <div className="md:hidden absolute bottom-20 right-4 flex flex-col gap-2 z-10">
        <Button variant="secondary" size="sm" onClick={handleZoomIn}
          className="h-10 w-10 p-0 rounded-full shadow-medium glass-card"
        >
          <ZoomIn className="h-5 w-5" />
        </Button>
        <Button variant="secondary" size="sm" onClick={handleZoomOut}
          className="h-10 w-10 p-0 rounded-full shadow-medium glass-card"
        >
          <ZoomOut className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};