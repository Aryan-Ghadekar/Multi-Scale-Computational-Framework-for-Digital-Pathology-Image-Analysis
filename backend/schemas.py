from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

# Patient Schemas
class PatientBase(BaseModel):
    name: str
    age: int
    gender: str
    contact_info: Optional[str] = None
    medical_history: Optional[str] = None

class PatientCreate(PatientBase):
    pass

class PatientUpdate(PatientBase):
    pass

class PatientResponse(PatientBase):
    id: int
    case_id: str
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# Analysis Schemas
class RegionAnalysis(BaseModel):
    id: str
    name: str
    confidence: float
    score: float
    bbox: Optional[List[int]] = None

class AnalysisBase(BaseModel):
    case_id: str
    patient_id: int

class AnalysisCreate(AnalysisBase):
    image_data: str  # Base64 encoded image or file path

class AnalysisResponse(BaseModel):
    id: int
    case_id: str
    patient_id: int
    lesion_probability: float
    overall_confidence: float
    confidence_level: str
    regions: List[RegionAnalysis]
    analysis_summary: str
    ai_explanation: Optional[str]
    heatmap_url: Optional[str]
    original_image_url: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Report Schemas
class ReportBase(BaseModel):
    case_id: str
    patient_id: int
    analysis_id: int

class ReportCreate(ReportBase):
    pass

class ReportResponse(ReportBase):
    id: int
    report_path: str
    generated_at: datetime
    is_finalized: bool
    
    class Config:
        from_attributes = True

# AI Explanation Schema
class AIExplanationRequest(BaseModel):
    analysis_data: Dict[str, Any]
    patient_info: Dict[str, Any]
    specific_question: Optional[str] = None

class AIExplanationResponse(BaseModel):
    explanation: str
    key_findings: List[str]
    recommendations: List[str]