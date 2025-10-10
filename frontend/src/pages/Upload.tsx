import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Microscope, Upload, FileImage, ArrowRight, User, Plus } from "lucide-react";
import { toast } from "sonner";
import { patientApi } from "@/services/api";

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
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);

  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingPatient(true);

    try {
      const patient = await patientApi.create({
        ...patientData,
        age: parseInt(patientData.age)
      });
      
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
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
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

  const handleAnalyze = () => {
    if (!selectedFile) {
      toast.error("Please select an image first");
      return;
    }

    // For demo, we'll use a mock patient ID
    // In real app, you'd use the actual patient ID from created patient
    const mockPatientId = 1;
    navigate("/analysis", { 
      state: { 
        imageFile: selectedFile,
        patientData: patientData,
        patientId: mockPatientId
      } 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-soft">
        <div className="px-6 py-4 flex items-center gap-3">
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
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-6">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-foreground">
              New Pathology Analysis
            </h2>
            <p className="text-muted-foreground text-lg">
              Start by creating a patient record and uploading their pathology image
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'patient'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('patient')}
            >
              <User className="h-4 w-4" />
              Patient Information
            </button>
            <button
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'upload'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('upload')}
            >
              <Upload className="h-4 w-4" />
              Upload Image
            </button>
          </div>

          {/* Patient Form */}
          {activeTab === 'patient' && (
            <Card className="p-6 shadow-medium">
              <form onSubmit={handlePatientSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={patientData.name}
                      onChange={(e) => setPatientData({...patientData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age">Age *</Label>
                    <Input
                      id="age"
                      type="number"
                      value={patientData.age}
                      onChange={(e) => setPatientData({...patientData, age: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select onValueChange={(value) => setPatientData({...patientData, gender: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact">Contact Information</Label>
                  <Input
                    id="contact"
                    value={patientData.contact_info}
                    onChange={(e) => setPatientData({...patientData, contact_info: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="history">Medical History</Label>
                  <Textarea
                    id="history"
                    rows={3}
                    value={patientData.medical_history}
                    onChange={(e) => setPatientData({...patientData, medical_history: e.target.value})}
                    placeholder="Relevant medical history, previous conditions, etc."
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isCreatingPatient}>
                  <Plus className="h-4 w-4 mr-2" />
                  {isCreatingPatient ? "Creating Patient..." : "Create Patient Record"}
                </Button>
              </form>
            </Card>
          )}

          {/* Upload Section */}
          {activeTab === 'upload' && (
            <Card className="p-8 shadow-medium border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-all duration-300">
              <div
                className={`flex flex-col items-center justify-center space-y-6 p-8 rounded-lg transition-all duration-300 ${
                  isDragging ? 'bg-primary/5 border-primary' : 'bg-transparent'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-10 w-10 text-primary" />
                </div>

                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">
                    {selectedFile ? "Image Selected" : "Drag & Drop Your Pathology Image"}
                  </h3>
                  <p className="text-muted-foreground">
                    {selectedFile 
                      ? selectedFile.name
                      : "Supported formats: PNG, JPG, TIFF"
                    }
                  </p>
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-2 p-3 bg-success/10 text-success rounded-lg">
                    <FileImage className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Ready for analysis
                    </span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    variant={selectedFile ? "outline" : "default"}
                    size="lg"
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {selectedFile ? "Change Image" : "Select Image"}
                  </Button>

                  <input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileInput}
                    className="hidden"
                  />

                  {selectedFile && (
                    <Button size="lg" onClick={handleAnalyze}>
                      Start Analysis
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Drag and drop your pathology image here, or click to browse
                </p>
              </div>
            </Card>
          )}

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: <User className="h-5 w-5" />,
                title: "Patient Management",
                description: "Complete patient records"
              },
              {
                icon: <Microscope className="h-5 w-5" />,
                title: "AI Analysis",
                description: "Advanced lesion detection"
              },
              {
                icon: <FileImage className="h-5 w-5" />,
                title: "PDF Reports",
                description: "Comprehensive reports"
              }
            ].map((feature, index) => (
              <Card key={index} className="p-4 text-center shadow-soft">
                <div className="flex justify-center mb-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {feature.icon}
                  </div>
                </div>
                <h4 className="font-semibold text-foreground">{feature.title}</h4>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;