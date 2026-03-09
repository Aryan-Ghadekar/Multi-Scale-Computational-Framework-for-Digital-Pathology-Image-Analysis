import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User, Calendar, FileText, Activity, Download,
  TrendingUp, MessageSquare, Brain, Hash, Send,
  CheckCircle2, Sparkles, Phone
} from "lucide-react";
import { ExplainabilityPanel } from "./ExplainabilityPanel";
import { toast } from "sonner";
import { reportApi } from "@/services/api";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";

interface PatientSidebarProps {
  patientData?: any;
  analysisData?: any;
  onRequestNewExplanation?: (question?: string) => void;
}

export const PatientSidebar = ({
  patientData,
  analysisData,
  onRequestNewExplanation
}: PatientSidebarProps) => {
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  const handleAskQuestion = async () => {
    if (!question.trim() || !onRequestNewExplanation) return;
    setIsAsking(true);
    try {
      await onRequestNewExplanation(question.trim());
      toast.success("AI is analyzing your question...");
      setQuestion("");
    } catch (error) {
      toast.error("Failed to process your question");
    } finally {
      setIsAsking(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!analysisData) {
      toast.error("No analysis data available");
      return;
    }
    try {
      toast.loading("Generating clinical report...");
      const reportData = {
        case_id: analysisData.case_id,
        patient_id: analysisData.patient_id,
        analysis_id: analysisData.id
      };
      const report = await reportApi.create(reportData);
      toast.dismiss();
      toast.success("Report generated successfully!");
      setTimeout(() => {
        reportApi.download(report.id);
        toast.info("Report download started");
      }, 1000);
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to generate report");
      console.error("Report generation error:", error);
    }
  };

  const handleQuickDownload = () => {
    if (!analysisData) {
      toast.error("No analysis data available");
      return;
    }
    const blob = new Blob([
      `Pathology Analysis Report\n
Patient: ${patientData?.name || 'N/A'}
Age: ${patientData?.age || 'N/A'}
Case ID: ${analysisData.case_id}\n
Lesion Probability: ${analysisData.lesion_probability}%
Overall Confidence: ${analysisData.overall_confidence}%
Confidence Level: ${analysisData.confidence_level}\n
Generated: ${new Date().toLocaleString()}
      `], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pathology_report_${analysisData.case_id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Quick report downloaded!");
  };

  const commonQuestions = [
    "What are the clinical implications of these findings?",
    "How reliable are these lesion probability scores?",
    "What follow-up tests would you recommend?",
    "How does this compare to normal tissue patterns?",
  ];

  // Build chart data from regions
  const chartData = analysisData?.regions?.map((r: any, i: number) => ({
    name: r.name ? r.name.substring(0, 8) : `R${i + 1}`,
    confidence: r.confidence || Math.round((r.score || 0.5) * 100),
  })) || [];

  const getBarColor = (confidence: number) => {
    if (confidence >= 75) return "hsl(158 64% 42%)";
    if (confidence >= 50) return "hsl(38 95% 52%)";
    return "hsl(4 86% 58%)";
  };

  // Patient initials
  const initials = patientData?.name
    ? patientData.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'PT';

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-4">
        {/* ── Patient Info Card ── */}
        <div className="glass-card rounded-2xl p-4 shadow-soft border border-border">
          <div className="flex items-start gap-3 mb-4">
            {/* Avatar */}
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-soft font-bold text-sm text-white"
              style={{ background: 'linear-gradient(135deg, hsl(187 85% 40%), hsl(160 70% 40%))' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground truncate">
                {patientData?.name || "Patient Name"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {patientData?.age ? `${patientData.age} years` : 'Age unknown'} · {patientData?.gender || 'Unknown'}
              </p>
            </div>
            {/* Status badge */}
            <div className={cn(
              "status-pill border text-[10px] flex-shrink-0",
              analysisData
                ? "bg-success/10 border-success/30 text-success"
                : "bg-warning/10 border-warning/30 text-warning"
            )}>
              <span className={cn("status-dot", analysisData ? "bg-success" : "bg-warning")} />
              {analysisData ? "Complete" : "Pending"}
            </div>
          </div>

          {/* Info rows */}
          <div className="space-y-2 text-xs">
            {[
              { icon: Hash, label: "Case ID", value: analysisData?.case_id || "—" },
              { icon: Calendar, label: "Date", value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
              { icon: Phone, label: "Contact", value: patientData?.contact_info || "—" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2.5 py-1.5 border-b border-border/50 last:border-0">
                <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground w-14 flex-shrink-0">{label}</span>
                <span className="font-semibold text-foreground truncate font-mono text-[11px]">{value}</span>
              </div>
            ))}
          </div>

          {/* AI Question section */}
          {analysisData && onRequestNewExplanation && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-md flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, hsl(187 85% 40%), hsl(160 70% 40%))' }}
                >
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
                <h4 className="text-xs font-bold text-foreground">Ask AI Assistant</h4>
                <span className="text-[10px] text-muted-foreground">· Groq LLaMA</span>
              </div>

              {/* Quick question chips */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {commonQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => setQuestion(q)}
                    className="quick-chip"
                    disabled={isAsking}
                  >
                    {q.split(" ").slice(0, 3).join(" ")}…
                  </button>
                ))}
              </div>

              {/* Textarea + send */}
              <div className="relative">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && question.trim()) {
                      e.preventDefault();
                      handleAskQuestion();
                    }
                  }}
                  placeholder="Ask about clinical implications, reliability, follow-up tests..."
                  className="w-full p-3 pr-10 text-xs border border-input rounded-xl min-h-[80px] resize-none bg-background/60 focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all outline-none placeholder:text-muted-foreground/60 scrollbar-thin"
                  disabled={isAsking}
                />
                <button
                  onClick={handleAskQuestion}
                  disabled={!question.trim() || isAsking}
                  className="absolute right-2.5 bottom-2.5 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                  style={{
                    background: question.trim() && !isAsking
                      ? 'linear-gradient(135deg, hsl(187 85% 40%), hsl(160 70% 40%))'
                      : 'hsl(var(--muted))'
                  }}
                >
                  {isAsking ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full" />
                  ) : (
                    <Send className="h-3.5 w-3.5 text-white" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                Press Enter or click send · AI provides clinical insights from analysis
              </p>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="analysis" className="flex-1">
          <TabsList className="grid w-full grid-cols-3 rounded-xl h-9 bg-muted/60">
            <TabsTrigger value="analysis" className="text-[11px] rounded-lg gap-1">
              <Activity className="h-3 w-3" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-[11px] rounded-lg gap-1">
              <TrendingUp className="h-3 w-3" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="report" className="text-[11px] rounded-lg gap-1">
              <FileText className="h-3 w-3" />
              Report
            </TabsTrigger>
          </TabsList>

          {/* ── Analysis Tab ── */}
          <TabsContent value="analysis" className="mt-3 space-y-0">
            <ExplainabilityPanel
              analysisData={analysisData}
            />
          </TabsContent>

          {/* ── Insights Tab ── */}
          <TabsContent value="insights" className="mt-3 space-y-4">
            {/* Overall confidence */}
            <div className="glass-card rounded-2xl p-4 shadow-soft">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Analysis Insights</h3>
              </div>

              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs text-muted-foreground font-medium">Overall Model Confidence</span>
                <span className="text-2xl font-extrabold text-foreground">
                  {analysisData?.overall_confidence || 0}
                  <span className="text-sm font-medium text-muted-foreground">%</span>
                </span>
              </div>
              <div className="h-2 bg-muted/60 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${analysisData?.overall_confidence || 0}%`,
                    background: (analysisData?.overall_confidence || 0) >= 75
                      ? 'hsl(158 64% 42%)' : (analysisData?.overall_confidence || 0) >= 50
                        ? 'hsl(38 95% 52%)' : 'hsl(4 86% 58%)'
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {analysisData?.confidence_level === "Moderate"
                  ? "Moderate confidence — manual review recommended"
                  : analysisData?.ai_explanation?.split('\n')[0] || "No analysis data available"}
              </p>
            </div>

            {/* Region confidence chart */}
            {chartData.length > 0 && (
              <div className="glass-card rounded-2xl p-4 shadow-soft">
                <h4 className="text-xs font-bold text-foreground mb-3 uppercase tracking-wide">
                  Region Confidence Distribution
                </h4>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '11px',
                        boxShadow: 'var(--shadow-medium)'
                      }}
                      formatter={(v: any) => [`${v}%`, 'Confidence']}
                    />
                    <Bar dataKey="confidence" radius={[4, 4, 0, 0]}>
                      {chartData.map((_: any, i: number) => (
                        <Cell key={i} fill={getBarColor(chartData[i].confidence)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Metrics grid */}
            {analysisData?.metrics && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Tiles Analyzed", value: analysisData.metrics.total_tiles_analyzed || 0 },
                  { label: "Tumor Tiles", value: analysisData.metrics.tumor_tiles_detected || 0 },
                  { label: "Lesion Prob.", value: `${analysisData.lesion_probability || 0}%` },
                  { label: "Confidence", value: analysisData.confidence_level || "—" },
                ].map((m, i) => (
                  <div key={i} className="glass-card rounded-xl p-3 text-center border border-border">
                    <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">{m.label}</p>
                    <p className="text-base font-bold text-foreground">{m.value}</p>
                  </div>
                ))}
              </div>
            )}

            {!analysisData && (
              <div className="text-center py-8">
                <TrendingUp className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No insights yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Run analysis to see metrics</p>
              </div>
            )}
          </TabsContent>

          {/* ── Report Tab ── */}
          <TabsContent value="report" className="mt-3 space-y-4">
            <div className="glass-card rounded-2xl p-4 shadow-soft">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Clinical Report</h3>
              </div>

              {/* Summary preview */}
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 mb-4">
                <p className="text-xs font-semibold text-foreground mb-1">Report Summary</p>
                <p className="text-xs text-foreground/70 leading-relaxed">
                  {analysisData
                    ? `Comprehensive lesion analysis for ${patientData?.name || 'patient'}. AI model analysis completed with ${analysisData.confidence_level?.toLowerCase()} confidence using ResNet18 + MobileNet ensemble.`
                    : "Upload and analyze an image to generate a comprehensive clinical report."
                  }
                </p>
              </div>

              {/* Included items */}
              <div className="space-y-2 mb-4">
                {[
                  "Patient metadata & demographics",
                  "Lesion probability & confidence scores",
                  "Regional analysis with bounding boxes",
                  "AI insights and clinical recommendations",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className={cn("h-3.5 w-3.5 flex-shrink-0", analysisData ? "text-success" : "text-muted-foreground/40")} />
                    <span className={analysisData ? "text-foreground/80" : "text-muted-foreground/50"}>{item}</span>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                <Button
                  onClick={handleGenerateReport}
                  className="w-full h-10 font-semibold transition-all hover:shadow-glow hover:scale-[1.01]"
                  style={{ background: 'linear-gradient(135deg, hsl(187 85% 40%), hsl(160 70% 40%))' }}
                  disabled={!analysisData}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Generate Full PDF Report
                </Button>
                <Button
                  onClick={handleQuickDownload}
                  variant="outline"
                  className="w-full h-9 text-sm hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                  disabled={!analysisData}
                >
                  <FileText className="h-3.5 w-3.5 mr-2" />
                  Quick Text Report
                </Button>

                {analysisData && onRequestNewExplanation && (
                  <Button
                    onClick={() => {
                      toast.info("AI is enhancing your report...");
                      setTimeout(() => handleGenerateReport(), 1500);
                    }}
                    variant="ghost"
                    className="w-full h-9 text-xs border border-primary/25 hover:bg-primary/10 hover:border-primary/50 transition-all"
                  >
                    <Brain className="h-3.5 w-3.5 mr-2 text-primary" />
                    Generate AI-Enhanced Report
                  </Button>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground text-center mt-3">
                {analysisData
                  ? "Full report exported as clinician-ready PDF document"
                  : "Complete analysis to enable report generation"
                }
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
};