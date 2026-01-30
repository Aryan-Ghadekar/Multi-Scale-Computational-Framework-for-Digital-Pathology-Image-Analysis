import { useState, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2, ImageIcon, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WSIViewerProps {
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  uploadedImage?: File | null;
  analysisData?: any;
}

export const WSIViewer = ({ showHeatmap, onToggleHeatmap, uploadedImage, analysisData }: WSIViewerProps) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageUrl, setImageUrl] = useState<string>("");
  const [heatmapImageUrl, setHeatmapImageUrl] = useState<string>(""); // ADD THIS LINE

  useEffect(() => {
  if (analysisData?.preview_png) {
    setImageUrl(`${analysisData.preview_png}?t=${Date.now()}`);
  } else if (uploadedImage) {
    const url = URL.createObjectURL(uploadedImage);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }
}, [analysisData, uploadedImage]);



  useEffect(() => {
    if (uploadedImage) {
      const url = URL.createObjectURL(uploadedImage);
      setImageUrl(url);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [uploadedImage]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };
  

  const handleMouseUp = () => setIsDragging(false);

  // Render REAL heatmap overlay from ML analysis data
  const renderHeatmapOverlay = () => {
    if (!showHeatmap || !heatmapImageUrl) return null;

    return (
      <div className="absolute inset-0 pointer-events-none">
        <img
          src={heatmapImageUrl}
          alt="Tumor Confidence Heatmap"
          className="w-full h-full object-contain opacity-70"
        />
      </div>
    );
  };

  // Render heatmap legend
  const renderHeatmapLegend = () => {
    if (!showHeatmap || !analysisData?.heatmap_data) return null;

    return (
      <Card className="absolute bottom-4 left-4 p-3 bg-card/90 backdrop-blur-sm shadow-medium">
        <h4 className="text-xs font-semibold mb-2 text-foreground">Heatmap Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500/70 border border-red-600" />
            <span className="text-foreground/80">Tumor Regions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500/50 border border-green-600" />
            <span className="text-foreground/80">Normal Tissue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white border border-gray-600" />
            <span className="text-foreground/80">High Confidence</span>
          </div>
        </div>
        {analysisData.metrics && (
          <div className="mt-2 pt-2 border-t border-border text-xs">
            <div className="text-foreground/70">
              Tiles: {analysisData.metrics.total_tiles_analyzed}
            </div>
            <div className="text-foreground/70">
              Tumor: {analysisData.metrics.tumor_tiles_detected}
            </div>
          </div>
        )}
      </Card>
    );
  };

  // Render analysis info panel
  const renderAnalysisInfo = () => {
    if (!analysisData || !showHeatmap) return null;

    return (
      <Card className="absolute top-4 right-4 p-3 bg-card/90 backdrop-blur-sm shadow-medium max-w-xs">
        <h4 className="text-xs font-semibold mb-2 text-foreground">Analysis Results</h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-foreground/70">Lesion Probability:</span>
            <span className="font-semibold text-foreground">
              {analysisData.lesion_probability}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/70">Confidence:</span>
            <span className={cn(
              "font-semibold",
              analysisData.confidence_level === "High" && "text-green-600",
              analysisData.confidence_level === "Moderate" && "text-yellow-600",
              analysisData.confidence_level === "Low" && "text-red-600"
            )}>
              {analysisData.confidence_level}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/70">Regions Found:</span>
            <span className="font-semibold text-foreground">
              {analysisData.regions?.length || 0}
            </span>
          </div>
        </div>
      </Card>
    );
  };

  return (
     <div className="relative w-full h-full bg-viewer-bg rounded-xl overflow-hidden">
      {/* Floating Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Card className="flex items-center gap-1 p-1 bg-toolbar-bg/90 backdrop-blur-sm shadow-medium">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            className="h-8 w-8 p-0 hover:bg-background/50"
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium px-2 text-foreground min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            className="h-8 w-8 p-0 hover:bg-background/50"
            disabled={zoom >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 w-8 p-0 hover:bg-background/50"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </Card>

        <Button
          variant={showHeatmap ? "default" : "secondary"}
          size="sm"
          onClick={onToggleHeatmap}
          className="shadow-medium bg-toolbar-bg/90 backdrop-blur-sm"
          disabled={!analysisData}
        >
          <ImageIcon className="h-4 w-4 mr-2" />
          {showHeatmap ? "Show Original" : "Show Heatmap"}
        </Button>
      </div>

      {/* Mini-map */}
      <Card className="absolute bottom-4 right-4 w-32 h-32 p-2 shadow-medium bg-card/90 backdrop-blur-sm z-10">
        <div className="w-full h-full border-2 border-primary/30 rounded relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
          <div
            className="absolute border-2 border-primary bg-primary/20"
            style={{
              width: `${100 / zoom}%`,
              height: `${100 / zoom}%`,
              left: `${50 - position.x / 10}%`,
              top: `${50 - position.y / 10}%`,
            }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 text-center">
          Mini-map
        </p>
      </Card>

      {/* Heatmap Legend */}
      {renderHeatmapLegend()}

      {/* Analysis Info Panel */}
      {renderAnalysisInfo()}

      {/* WSI Viewer Area */}
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
          className="relative transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
          }}
        >
          {/* Main Image Container */}
          <div className="w-[800px] h-[600px] rounded-lg overflow-hidden shadow-soft border-2 border-panel-border bg-card relative">
            {imageUrl ? (
              <>
                {/* Background Image */}
                <img
                  src={imageUrl}
                  alt="Uploaded pathology image"
                  className={cn(
                    "w-full h-full object-contain transition-opacity duration-300",
                    showHeatmap ? "opacity-40" : "opacity-100"
                  )}
                />
                
                {/* Heatmap Overlay */}
                {renderHeatmapOverlay()}

                {/* Loading/Status Overlay */}
                {!analysisData && (
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                    <div className="text-center space-y-3 bg-card/80 p-6 rounded-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                      <p className="text-sm font-medium text-foreground">
                        Analyzing Image...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ML model processing tissue regions
                      </p>
                    </div>
                  </div>
                )}

                {/* Heatmap Mode Indicator */}
                {showHeatmap && analysisData && (
                  <div className="absolute top-2 left-2 bg-destructive/80 text-destructive-foreground px-2 py-1 rounded text-xs font-medium">
                    HEATMAP MODE
                  </div>
                )}
              </>
            ) : (
              // Default state when no image uploaded
              <div className="w-full h-full bg-gradient-to-br from-muted/50 to-secondary/30 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <FileImage className="h-16 w-16 text-muted-foreground mx-auto" />
                  <p className="text-lg font-medium text-foreground/70">
                    No Image Selected
                  </p>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Upload a pathology image to begin AI-powered analysis and visualization
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zoom Controls for Mobile */}
      <div className="md:hidden absolute bottom-20 right-4 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleZoomIn}
          className="h-10 w-10 p-0 rounded-full shadow-medium"
        >
          <ZoomIn className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleZoomOut}
          className="h-10 w-10 p-0 rounded-full shadow-medium"
        >
          <ZoomOut className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};