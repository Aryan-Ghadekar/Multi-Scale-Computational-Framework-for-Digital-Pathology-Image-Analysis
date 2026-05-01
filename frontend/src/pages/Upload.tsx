import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Microscope, Upload, FileImage, ArrowRight, User, Plus,
  Cpu, Shield, BarChart2, CheckCircle2, X, CloudUpload
} from "lucide-react";
import { toast } from "sonner";
import { patientApi } from "@/services/api";
import { cn } from "@/lib/utils";
import { UserCard } from "@/components/UserCard";

const UploadPage = () => {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'patient' | 'upload'>('patient');
  const [patientData, setPatientData] = useState({
    name: '',
    age: '',
    gender: '',
    contact_info: '',
    medical_history: ''
  });
  const [createdPatientId, setCreatedPatientId] = useState<number | null>(null);
  const [user, setUser] = useState(null);
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);

  const BASE = "http://localhost:8000";

  async function adminFetch(path: string, opts: RequestInit = {}) {
    const token = localStorage.getItem("access_token") || "";
    const res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }


  // const handlePatientSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setIsCreatingPatient(true);

  //   try {
  //     const patient = await patientApi.create({
  //       ...patientData,
  //       age: parseInt(patientData.age)
  //     });
  //     toast.success("Patient created successfully");
  //     setActiveTab('upload');
  //   } catch (error) {
  //     toast.error("Failed to create patient");
  //   } finally {
  //     setIsCreatingPatient(false);
  //   }
  // };

  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingPatient(true);
    try {
      const patient = await patientApi.create({
        ...patientData,
        age: parseInt(patientData.age)
      });

      setCreatedPatientId(patient.id); // ← save the real ID from API response
      toast.success("Patient created successfully");
      setActiveTab('upload');
    } catch (error) {
      toast.error("Failed to create patient");
    } finally {
      setIsCreatingPatient(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileSelection(files[0]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFileSelection(files[0]);
  };

  const handleFileSelection = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }
    setSelectedFile(file);
    toast.success("Image selected successfully", {
      description: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`
    });
  };

  // const handleAnalyze = () => {
  //   if (!selectedFile) {
  //     toast.error("Please select an image first");
  //     return;
  //   }
  //   const mockPatientId = 1;
  //   navigate("/analysis", {
  //     state: {
  //       imageFile: selectedFile,
  //       patientData: patientData,
  //       patientId: mockPatientId
  //     }
  //   });
  // };

  const handleAnalyze = () => {
    if (!selectedFile) {
      toast.error("Please select an image first");
      return;
    }
    if (!createdPatientId) {
      toast.error("Please create a patient record first");
      setActiveTab('patient'); // send them back to step 1
      return;
    }
    navigate("/analysis", {
      state: {
        imageFile: selectedFile,
        patientData: patientData,
        patientId: createdPatientId  // ← real ID now
      }
    });
  };

  const features = [
    {
      icon: <Cpu className="h-5 w-5" />,
      title: "AI-Powered Detection",
      description: "ResNet18 + MobileNet dual-model ensemble for tumor identification"
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: "Clinical Grade Accuracy",
      description: "Validated confidence scoring with explainable AI insights"
    },
    {
      icon: <BarChart2 className="h-5 w-5" />,
      title: "WSI Processing",
      description: "Up to 300M × 300M pixel whole slide image analysis"
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/login");
  };

  const getUserinfo = useCallback(async () => {
    setUser(await adminFetch("/auth/auth/me"));
  }, [setUser]);

  useEffect(() => { getUserinfo(); }, [getUserinfo]);

  return (
    <div className="min-h-screen flex overflow-hidden bg-background">
      {/* ── Left Branding Panel ── */}
      <div className="hidden lg:flex w-[420px] xl:w-[480px] flex-shrink-0 flex-col justify-between relative overflow-hidden medical-gradient p-10">
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(hsl(187 85% 48% / 0.3) 1px, transparent 1px),
                              linear-gradient(90deg, hsl(187 85% 48% / 0.3) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
        {/* Glow orbs */}
        <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full"
          style={{ background: 'radial-gradient(circle, hsl(187 85% 48% / 0.25), transparent 70%)' }}
        />
        <div className="absolute bottom-1/4 -right-20 w-56 h-56 rounded-full"
          style={{ background: 'radial-gradient(circle, hsl(160 70% 42% / 0.2), transparent 70%)' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex  justify-between gap-3 mb-12">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-glow"
                style={{ background: 'linear-gradient(135deg, hsl(187 85% 44%), hsl(160 70% 42%))' }}
              >
                <Microscope className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-white text-xl font-bold tracking-tight">PathAI Pro</h1>
                <p className="text-white/50 text-xs">Digital Pathology Platform</p>
              </div>
            </div>
            <UserCard user={user} onLogout={handleLogout} />
          </div>

          <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
            AI-Driven<br />
            <span style={{
              background: 'linear-gradient(135deg, hsl(187 85% 60%), hsl(160 70% 60%))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Pathology Analysis
            </span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            Upload whole slide images and receive instant AI-powered tumor probability analysis with explainable clinical insights.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 space-y-4">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-teal-300"
                style={{ background: 'rgba(14,178,196,0.15)' }}
              >
                {f.icon}
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{f.title}</p>
                <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer label */}
        <div className="relative z-10">
          <p className="text-white/30 text-xs">
            Powered by Groq LLaMA · ResNet18 · MobileNet
          </p>
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Mobile header */}
        <header className="lg:hidden border-b border-border bg-card px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(187 85% 44%), hsl(160 70% 42%))' }}
          >
            <Microscope className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-foreground">PathAI Pro</p>
            <p className="text-xs text-muted-foreground">Digital Pathology Platform</p>
          </div>
          <div className="justify-end">
            <UserCard user={user} onLogout={handleLogout} />
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-xl space-y-6">
            {/* Top section */}
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">New Pathology Analysis</h2>
              <p className="text-muted-foreground text-sm">
                Start by creating a patient record, then upload the pathology image.
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-3">
              {(['patient', 'upload'] as const).map((tab, idx) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex items-center gap-2 group"
                >
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200",
                    activeTab === tab
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                  )}>
                    {idx + 1}
                  </div>
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    activeTab === tab ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {tab === 'patient' ? 'Patient Info' : 'Upload Image'}
                  </span>
                  {idx < 1 && (
                    <div className={cn(
                      "w-12 h-px mx-1 transition-colors",
                      activeTab === 'upload' ? "bg-primary" : "bg-border"
                    )} />
                  )}
                </button>

              ))}

            </div>

            {/* ── Patient Form ── */}
            {activeTab === 'patient' && (
              <div className="glass-card rounded-2xl p-6 shadow-medium animate-slide-up">
                <div className="flex items-center gap-2 mb-5">
                  <User className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Patient Information</h3>
                </div>
                <form onSubmit={handlePatientSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Full Name *
                      </Label>
                      <Input
                        id="name"
                        placeholder="Patient full name"
                        value={patientData.name}
                        onChange={(e) => setPatientData({ ...patientData, name: e.target.value })}
                        required
                        className="bg-background/60 border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="age" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Age *
                      </Label>
                      <Input
                        id="age"
                        type="number"
                        placeholder="e.g. 54"
                        value={patientData.age}
                        onChange={(e) => setPatientData({ ...patientData, age: e.target.value })}
                        required
                        className="bg-background/60 border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="gender" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Gender *
                    </Label>
                    <Select onValueChange={(value) => setPatientData({ ...patientData, gender: value })}>
                      <SelectTrigger className="bg-background/60 border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="contact" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Contact Information
                    </Label>
                    <Input
                      id="contact"
                      placeholder="Phone or email"
                      value={patientData.contact_info}
                      onChange={(e) => setPatientData({ ...patientData, contact_info: e.target.value })}
                      className="bg-background/60 border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="history" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Medical History
                    </Label>
                    <Textarea
                      id="history"
                      rows={3}
                      value={patientData.medical_history}
                      onChange={(e) => setPatientData({ ...patientData, medical_history: e.target.value })}
                      placeholder="Relevant medical history, previous conditions..."
                      className="bg-background/60 border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 font-semibold shadow-medium transition-all hover:shadow-glow hover:scale-[1.01] active:scale-[0.99]"
                    style={{ background: 'linear-gradient(135deg, hsl(187 85% 40%), hsl(160 70% 40%))' }}
                    disabled={isCreatingPatient}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {isCreatingPatient ? "Creating Patient Record..." : "Create Patient Record"}
                    {!isCreatingPatient && <ArrowRight className="h-4 w-4 ml-2" />}
                  </Button>
                </form>
              </div>
            )}

            {/* ── Upload Section ── */}
            {activeTab === 'upload' && (
              <div className="space-y-4 animate-slide-up">
                {/* Drop zone */}
                <div
                  className={cn(
                    "relative rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden",
                    isDragging
                      ? "border-primary bg-primary/5 shadow-glow"
                      : selectedFile
                        ? "border-success bg-success/5"
                        : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {/* Scan animation when dragging */}
                  {isDragging && (
                    <div className="absolute inset-0 pointer-events-none scan-overlay" />
                  )}

                  <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                    <div className={cn(
                      "w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300",
                      isDragging ? "bg-primary/20 shadow-glow scale-110" :
                        selectedFile ? "bg-success/15" : "bg-muted"
                    )}>
                      {selectedFile ? (
                        <FileImage className="h-10 w-10 text-success" />
                      ) : (
                        <CloudUpload className={cn("h-10 w-10 transition-colors", isDragging ? "text-primary" : "text-muted-foreground")} />
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      {selectedFile ? "Image Ready for Analysis" : isDragging ? "Drop your image here" : "Drag & Drop Pathology Image"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {selectedFile ? selectedFile.name : "Supports PNG, JPG, TIFF — WSI formats up to 300MP"}
                    </p>

                    {selectedFile && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-success/15 text-success text-sm font-medium mb-4">
                        <CheckCircle2 className="h-4 w-4" />
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Ready
                      </div>
                    )}

                    <div className="flex gap-3 flex-wrap justify-center">
                      <Button
                        variant={selectedFile ? "outline" : "default"}
                        onClick={() => document.getElementById('file-input')?.click()}
                        className={cn(
                          "transition-all",
                          !selectedFile && "shadow-medium hover:shadow-glow"
                        )}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {selectedFile ? "Change Image" : "Select Image"}
                      </Button>

                      {selectedFile && (
                        <>
                          <Button
                            size="default"
                            onClick={handleAnalyze}
                            style={{ background: 'linear-gradient(135deg, hsl(187 85% 40%), hsl(160 70% 40%))' }}
                            className="shadow-medium hover:shadow-glow hover:scale-[1.02] transition-all font-semibold"
                          >
                            Start AI Analysis
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedFile(null)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mt-4">
                      Click to browse or drag and drop your pathology slide image
                    </p>
                  </div>

                  <input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>

                {/* Stat row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Max Resolution", value: "300M×300M px" },
                    { label: "Models", value: "ResNet18 + MobileNet" },
                    { label: "Report Format", value: "PDF + JSON" },
                  ].map((s, i) => (
                    <div key={i} className="glass-card rounded-xl px-3 py-3 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">{s.label}</p>
                      <p className="text-xs font-semibold text-foreground">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;