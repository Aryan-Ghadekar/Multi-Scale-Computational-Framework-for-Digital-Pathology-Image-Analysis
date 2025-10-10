import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User,
  Calendar,
  FileText,
  Activity,
  Download,
  TrendingUp,
} from "lucide-react";
import { ExplainabilityPanel } from "./ExplainabilityPanel";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { reportApi } from "@/services/api";

interface PatientSidebarProps {
  patientData?: any;
  analysisData?: any;
}

export const PatientSidebar = ({ patientData, analysisData }: PatientSidebarProps) => {
  const handleGenerateReport = async () => {
    if (!analysisData) {
      toast.error("No analysis data available");
      return;
    }

    try {
      toast.loading("Generating clinical report...");
      
      // Create report data
      const reportData = {
        case_id: analysisData.case_id,
        patient_id: analysisData.patient_id,
        analysis_id: analysisData.id
      };

      // Create the report
      const report = await reportApi.create(reportData);
      
      toast.dismiss();
      toast.success("Report generated successfully!");
      
      // Download the report
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

    // For demo purposes - create a simple client-side PDF
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

  return (
    <div className="w-full h-full flex flex-col gap-4 overflow-y-auto p-4 bg-background">
      {/* Patient Metadata */}
      <Card className="p-4 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Patient Information</h3>
          </div>
          <Badge variant="outline" className="border-primary text-primary">
            Active
          </Badge>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Case ID:</span>
            <span className="font-medium text-foreground">
              {analysisData?.case_id || "PT-2024-1847"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Age:</span>
            <span className="font-medium text-foreground">
              {patientData?.age || "62"} years
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name:</span>
            <span className="font-medium text-foreground">
              {patientData?.name || "Patient Name"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Date Uploaded:</span>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium text-foreground">Jan 15, 2025</span>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <Badge className="bg-warning text-warning-foreground">
              {analysisData ? "Analysis Complete" : "Under Review"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="lesion" className="flex-1">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="lesion" className="text-xs">
            <Activity className="h-3 w-3 mr-1" />
            Analysis
          </TabsTrigger>
          <TabsTrigger value="uncertainty" className="text-xs">
            <TrendingUp className="h-3 w-3 mr-1" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="report" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lesion" className="space-y-4">
          <ExplainabilityPanel analysisData={analysisData} />
        </TabsContent>

        <TabsContent value="uncertainty" className="space-y-4">
          <Card className="p-6 shadow-medium space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-panel-border">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">
                Uncertainty Insights
              </h3>
            </div>

            {/* Overall Confidence */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground">
                  Overall Model Confidence
                </span>
                <span className="text-2xl font-bold text-warning">
                  {analysisData?.overall_confidence || 73}%
                </span>
              </div>
              <Progress 
                value={analysisData?.overall_confidence || 73} 
                className="h-3 [&>div]:bg-warning" 
              />
              <p className="text-xs text-muted-foreground">
                {analysisData?.confidence_level === "Moderate" 
                  ? "Moderate confidence - manual review recommended" 
                  : analysisData?.ai_explanation || "Analysis insights will appear here"}
              </p>
            </div>

            {/* Confidence Breakdown */}
            {analysisData?.regions && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">
                  Confidence by Region
                </h4>
                <div className="space-y-3">
                  {analysisData.regions.map((region: any) => (
                    <div key={region.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{region.name}</span>
                        <span className="font-medium text-foreground">
                          {region.confidence}%
                        </span>
                      </div>
                      <Progress
                        value={region.confidence}
                        className={`h-2 [&>div]:bg-${
                          region.confidence >= 75 ? "success" : 
                          region.confidence >= 50 ? "warning" : "destructive"
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Insights */}
            {analysisData?.ai_explanation && (
              <div className="p-4 bg-accent/20 rounded-lg space-y-2">
                <h4 className="text-sm font-medium text-accent-foreground">
                  AI Insights
                </h4>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {analysisData.ai_explanation}
                </p>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          <Card className="p-6 shadow-medium space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-panel-border">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Case Report</h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg space-y-2">
                <h4 className="text-sm font-semibold text-accent-foreground">
                  Report Summary
                </h4>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {analysisData 
                    ? `This clinical report includes comprehensive lesion analysis for ${patientData?.name || 'the patient'}. AI model analysis completed with ${analysisData.confidence_level.toLowerCase()} confidence.`
                    : "Upload and analyze an image to generate a comprehensive clinical report."
                  }
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-muted-foreground">
                    Patient metadata included
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-muted-foreground">
                    Lesion probability & confidence scores
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-muted-foreground">
                    Regional analysis details
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-muted-foreground">
                    AI insights and recommendations
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateReport}
                  className="flex-1 shadow-soft"
                  size="lg"
                  disabled={!analysisData}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Generate Full PDF Report
                </Button>

                <Button
                  onClick={handleQuickDownload}
                  variant="outline"
                  size="lg"
                  disabled={!analysisData}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Quick Report
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {analysisData 
                  ? "Full report will be generated as a clinician-ready PDF document"
                  : "Complete analysis to enable report generation"
                }
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};