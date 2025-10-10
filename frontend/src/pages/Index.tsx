import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { WSIViewer } from "@/components/WSIViewer";
import { ConfidenceDisplay } from "@/components/ConfidenceDisplay";
import { PatientSidebar } from "@/components/PatientSidebar";
import { Microscope } from "lucide-react";
import { analysisApi } from "@/services/api";
import { toast } from "sonner";

const Index = () => {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const { imageFile, patientData, patientId } = location.state || {};
    
    if (imageFile) {
      setUploadedImage(imageFile);
      // Start analysis automatically when image is provided
      handleAnalysis(patientId, imageFile);
    }
  }, [location]);

  const handleAnalysis = async (patientId: number, imageFile: File) => {
    setIsAnalyzing(true);
    try {
      const result = await analysisApi.analyze(patientId, imageFile);
      setAnalysisData(result);
      toast.success("Analysis completed successfully");
    } catch (error) {
      toast.error("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-soft">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
              <Microscope className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">PathAI Pro</h1>
              <p className="text-xs text-muted-foreground">
                Digital Pathology Analysis Platform
              </p>
            </div>
          </div>
          {uploadedImage && (
            <div className="text-sm text-muted-foreground">
              {isAnalyzing ? (
                "Analyzing..."
              ) : analysisData ? (
                <>
                  Case: <span className="font-medium text-foreground">{analysisData.case_id}</span>
                </>
              ) : (
                <>
                  Analyzing: <span className="font-medium text-foreground">{uploadedImage.name}</span>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Workspace */}
        <div className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
          {/* Confidence Display */}
          {analysisData && (
            <ConfidenceDisplay 
              lesionProbability={analysisData.lesion_probability}
              overallConfidence={analysisData.overall_confidence}
            />
          )}

          {/* WSI Viewer */}
          <div className="flex-1 min-h-0">
            <WSIViewer
              showHeatmap={showHeatmap}
              onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
              uploadedImage={uploadedImage}
              analysisData={analysisData}
            />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-96 border-l border-border bg-card shadow-medium overflow-hidden">
          <PatientSidebar 
            patientData={location.state?.patientData}
            analysisData={analysisData}
          />
        </aside>
      </div>
    </div>
  );
};

export default Index;