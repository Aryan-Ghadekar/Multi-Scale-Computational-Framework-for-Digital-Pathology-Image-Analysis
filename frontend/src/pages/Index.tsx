import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { WSIViewer } from "@/components/WSIViewer";
import { ConfidenceDisplay } from "@/components/ConfidenceDisplay";
import { ExplainabilityPanel } from "@/components/ExplainabilityPanel";
import { PatientSidebar } from "@/components/PatientSidebar";
import { Microscope } from "lucide-react";
import { analysisApi } from "@/services/api";
import { toast } from "sonner";

const Index = () => {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
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

  const handleRegenerateExplanation = async (analysisId: number, specificQuestion?: string) => {
  if (!analysisId) {
    toast.error("No analysis data available");
    return;
  }

  setIsRegenerating(true);
  try {
    const result = await analysisApi.regenerateExplanation(analysisId, specificQuestion);
    
    // Merge the new explanation with existing analysis data
    // This preserves image URLs and other important data
    setAnalysisData(prev => {
      // If this is the first time, just use the result
      if (!prev) return result;
      
      // Otherwise, merge: keep all original data, update only AI explanation fields
      return {
        ...prev,  // Keep all existing data (image URLs, etc.)
        ai_explanation: result.ai_explanation || prev.ai_explanation,
        ai_analysis: {
          key_findings: result.key_findings || prev.ai_analysis?.key_findings || [],
          recommendations: result.recommendations || prev.ai_analysis?.recommendations || []
        },
        // Also update any other fields that might have changed
        ...(result.regions && { regions: result.regions }),
        ...(result.analysis_summary && { analysis_summary: result.analysis_summary })
      };
    });
    
    toast.success("AI explanation regenerated successfully");
    return result;
  } catch (error) {
    toast.error("Failed to regenerate explanation");
    throw error;
  } finally {
    setIsRegenerating(false);
  }
};


   const handleExplainabilityRegeneration = async () => {
      if (!analysisData?.id) return;
      
      try {
        await handleRegenerateExplanation(analysisData.id);
      } catch (error) {
        console.error("Regeneration failed:", error);
      }
    };

    // Function to get real regions from analysis data
  const getRealRegions = () => {
    if (!analysisData?.regions || !Array.isArray(analysisData.regions)) {
      return [];
    }
    
    return analysisData.regions.map((region: any, index: number) => ({
      id: region.id || `R${index + 1}`,
      name: region.name || region.description || `Region ${index + 1}`,
      confidence: region.confidence || Math.round((region.score || 0) * 100),
      score: region.score || 0,
      description: region.description || ""
    }));
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
            <div className="space-y-4">
              <ConfidenceDisplay 
                lesionProbability={analysisData.lesion_probability}
                overallConfidence={analysisData.overall_confidence}
              />
              
              
            </div>
          )}

          {/* WSI Viewer */}
          <div className="flex-1 min-h-0">
            <WSIViewer
              showHeatmap={showHeatmap}
              onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
              uploadedImage={uploadedImage}
              analysisData={analysisData}
              isLoading={isRegenerating}  // Add this line
            />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-96 border-l border-border bg-card shadow-medium overflow-hidden">
          <PatientSidebar 
            patientData={location.state?.patientData}
            analysisData={analysisData}
            onRequestNewExplanation={(question?: string) => 
              analysisData?.id && handleRegenerateExplanation(analysisData.id, question)
            }
          />
        </aside>
      </div>
    </div>
  );
};

export default Index;