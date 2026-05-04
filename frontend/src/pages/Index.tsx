import { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { WSIViewer } from "@/components/WSIViewer";
import { ConfidenceDisplay } from "@/components/ConfidenceDisplay";
import { ExplainabilityPanel } from "@/components/ExplainabilityPanel";
import { PatientSidebar } from "@/components/PatientSidebar";
import { AnalysisMetricsPanel } from "@/components/AnalysisMetricsPanel";
import { RegionSidebar } from "@/components/RegionSidebar";
import type { Region } from "@/components/RegionOverlay";
import { Microscope, Activity, Loader2, MapPin, LogOut, ArrowBigLeftIcon, User } from "lucide-react";
import { analysisApi } from "@/services/api";
import { toast } from "sonner";
import { UserCard } from "@/components/UserCard";
import { persistor, type RootState } from "@/app/store";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "@/app/store";
import { clearProfile } from "@/features/user/profileSlice";
import { logout } from "@/features/auth/authSlice";

const Index = () => {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [activeRegionId, setActiveRegionId] = useState<string | undefined>(undefined);
  const [jumpTarget, setJumpTarget] = useState<Region | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  console.log("Index component rendered");
  const ProfileState = useSelector((state: RootState) => state.profile);
  console.log("profileStatusState:", ProfileState);

  useEffect(() => {
    const { imageFile, patientData, patientId } = location.state || {};

    if (imageFile) {
      setUploadedImage(imageFile);
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

  // const BASE = "http://localhost:8000";

  // async function adminFetch(path: string, opts: RequestInit = {}) {
  //   const token = localStorage.getItem("access_token") || "";
  //   const res = await fetch(`${BASE}${path}`, {
  //     ...opts,
  //     headers: {
  //       "Content-Type": "application/json",
  //       Authorization: `Bearer ${token}`,
  //       ...(opts.headers || {}),
  //     },
  //   });
  //   if (!res.ok) {
  //     const err = await res.json().catch(() => ({}));
  //     throw new Error(err.detail || `HTTP ${res.status}`);
  //   }
  //   return res.json();
  // }

  const handleRegenerateExplanation = async (analysisId: number, specificQuestion?: string) => {
    if (!analysisId) {
      toast.error("No analysis data available");
      return;
    }

    setIsRegenerating(true);
    try {
      const result = await analysisApi.regenerateExplanation(analysisId, specificQuestion);

      setAnalysisData((prev: any) => {
        if (!prev) return result;
        return {
          ...prev,
          ai_explanation: result.ai_explanation || prev.ai_explanation,
          ai_analysis: {
            key_findings: result.key_findings || prev.ai_analysis?.key_findings || [],
            recommendations: result.recommendations || prev.ai_analysis?.recommendations || []
          },
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

  const getRealRegions = () => {
    if (!analysisData?.regions || !Array.isArray(analysisData.regions)) return [];
    return analysisData.regions.map((region: any, index: number) => ({
      id: region.id || `R${index + 1}`,
      name: region.name || region.description || `Region ${index + 1}`,
      confidence: region.confidence || Math.round((region.score || 0) * 100),
      score: region.score || 0,
      description: region.description || ""
    }));
  };

  /** Derive Region[] objects (with bbox) for sidebar & overlay */
  const overlayRegions: Region[] = (() => {
    if (!analysisData?.regions || !Array.isArray(analysisData.regions)) return [];
    return analysisData.regions
      .filter((r: any) => Array.isArray(r.bbox) && r.bbox.length === 4)
      .map((r: any, i: number) => ({
        id: r.id ?? `R${i + 1}`,
        name: r.name ?? `Region ${i + 1}`,
        confidence: typeof r.confidence === 'number' ? r.confidence : (r.score ?? 0) * 100,
        bbox: r.bbox as [number, number, number, number],
      }));
  })();

  const handleJumpToRegion = useCallback((region: Region) => {
    setActiveRegionId(region.id);
    setJumpTarget(region);
    // If heatmap isn't on yet, enable it for context
    if (!showHeatmap) setShowHeatmap(true);
  }, [showHeatmap]);

  const handleBack = () => {
    navigate("/");
  };

  const handleLogout = async () => {
    // 1. Clear Redux
    dispatch(clearProfile());
    dispatch(logout());

    await persistor.purge();

    // 2. Clear storage (VERY IMPORTANT)
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    // 3. Redirect
    navigate("/login");
  };

  const user = useSelector((state: RootState) => state.profile.profile);

  // const getUserinfo = useCallback(async () => {
  //   setUser(await adminFetch("/auth/auth/me"));
  // }, [setUser]);

  // useEffect(() => { getUserinfo(); }, [getUserinfo]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md shadow-soft sticky top-0 z-30">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-glow"
              style={{ background: 'linear-gradient(135deg, hsl(187 85% 40%), hsl(160 70% 40%))' }}
            >
              <Microscope className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-none">PathAI Pro</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">Digital Pathology Analysis Platform</p>
            </div>
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border hover:border-destructive/30 transition-all"
            >
              <ArrowBigLeftIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Live status */}
          <div className="flex items-center gap-3">
            {uploadedImage && (
              <div className={`status-pill border ${isAnalyzing
                ? 'bg-warning/10 border-warning/30 text-warning'
                : analysisData
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'bg-primary/10 border-primary/30 text-primary'
                }`}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Analyzing</span>
                  </>
                ) : analysisData ? (
                  <>
                    <span className="status-dot bg-success" />
                    <span>Analysis Complete</span>
                  </>
                ) : (
                  <>
                    <Activity className="h-3 w-3" />
                    <span>Ready</span>
                  </>
                )}
              </div>
            )}
            {analysisData && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full border border-border">
                <span>Case:</span>
                <span className="font-semibold text-foreground font-mono">{analysisData.case_id}</span>
              </div>
            )}
            <UserCard user={user} onLogout={handleLogout} />
          </div>
        </div>
      </header>



      {/* ── Main Content ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Workspace */}
        <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden min-w-0">
          {/* Existing: Confidence metrics */}
          {analysisData && (
            <div className="animate-slide-up">
              <ConfidenceDisplay
                lesionProbability={analysisData.lesion_probability}
                overallConfidence={analysisData.overall_confidence}
                regionsCount={analysisData.regions?.length || 0}
              />
            </div>
          )}

          {/* NEW: Analysis Metrics Panel */}
          {analysisData && (
            <AnalysisMetricsPanel analysisData={analysisData} />
          )}

          {/* WSI Viewer */}
          <div className="flex-1 min-h-0">
            <WSIViewer
              showHeatmap={showHeatmap}
              onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
              uploadedImage={uploadedImage}
              analysisData={analysisData}
              isLoading={isRegenerating}
            />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-96 border-l border-border bg-card/60 backdrop-blur-sm shadow-medium overflow-hidden flex-shrink-0 flex flex-col">

          {/* NEW: Region Navigation Sidebar (only when analysis has bbox regions) */}
          {analysisData && overlayRegions.length > 0 && (
            <div className="border-b border-border/60 flex-shrink-0">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-card">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">Tumor Regions</span>
              </div>
              <RegionSidebar
                regions={overlayRegions}
                onJumpToRegion={handleJumpToRegion}
                activeRegionId={activeRegionId}
              />
            </div>
          )}

          {/* Existing: PatientSidebar */}
          <div className="flex-1 overflow-hidden">
            <PatientSidebar
              patientData={location.state?.patientData}
              analysisData={analysisData}
              onRequestNewExplanation={(question?: string) =>
                // analysisData?.id && 
                handleRegenerateExplanation(analysisData.id, question)
              }
            />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Index;