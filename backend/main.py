from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import uvicorn
import os
import uuid
from datetime import datetime
import aiofiles
import json
from analysis_service import AnalysisService
from database import get_db, engine, Base
from models import Patient, Analysis, Report
from schemas import (
    PatientCreate, PatientUpdate, PatientResponse, 
    AnalysisResponse, ReportCreate, ReportResponse,
    AIExplanationRequest, AIExplanationResponse
)
from patient_service import PatientService
from report_service import ReportService
from ai_service import AIService

# Create tables
Base.metadata.create_all(bind=engine)

# Create directories
os.makedirs("uploads", exist_ok=True)
os.makedirs("static", exist_ok=True)
os.makedirs("reports", exist_ok=True)

app = FastAPI(
    title="PathAI Pro Backend API",
    description="Digital Pathology Analysis and Patient Management System",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://192.168.35.239:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/reports", StaticFiles(directory="reports"), name="reports")

# Initialize services
ai_service = AIService()

# Mock analysis function (same as before)
def analyze_pathology_image(image_path: str) -> dict:
    import numpy as np
    lesion_probability = np.random.uniform(40, 90)
    overall_confidence = np.random.uniform(60, 95)
    
    if overall_confidence >= 75:
        confidence_level = "High"
    elif overall_confidence >= 50:
        confidence_level = "Moderate"
    else:
        confidence_level = "Low"
    
    regions = [
        {
            "id": "A",
            "name": "Region A (Upper Left)",
            "confidence": np.random.uniform(70, 90),
            "score": np.random.uniform(0.7, 0.9),
            "bbox": [100, 100, 200, 200]
        },
        {
            "id": "B", 
            "name": "Region B (Center)",
            "confidence": np.random.uniform(60, 80),
            "score": np.random.uniform(0.6, 0.8),
            "bbox": [300, 200, 400, 300]
        },
        {
            "id": "C",
            "name": "Region C (Lower Right)", 
            "confidence": np.random.uniform(50, 70),
            "score": np.random.uniform(0.5, 0.7),
            "bbox": [400, 400, 500, 500]
        }
    ]
    
    return {
        "lesion_probability": round(lesion_probability, 1),
        "overall_confidence": round(overall_confidence, 1),
        "confidence_level": confidence_level,
        "regions": regions,
        "analysis_summary": f"AI analysis completed with {confidence_level.lower()} confidence."
    }

# Patient Routes
@app.post("/api/patients/", response_model=PatientResponse)
def create_patient(patient: PatientCreate, db: Session = Depends(get_db)):
    return PatientService.create_patient(db, patient)

@app.get("/api/patients/", response_model=list[PatientResponse])
def read_patients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return PatientService.get_all_patients(db, skip=skip, limit=limit)

@app.get("/api/patients/{patient_id}", response_model=PatientResponse)
def read_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = PatientService.get_patient(db, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@app.put("/api/patients/{patient_id}", response_model=PatientResponse)
def update_patient(patient_id: int, patient: PatientUpdate, db: Session = Depends(get_db)):
    db_patient = PatientService.update_patient(db, patient_id, patient)
    if db_patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return db_patient

@app.delete("/api/patients/{patient_id}")
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    success = PatientService.delete_patient(db, patient_id)
    if not success:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"message": "Patient deleted successfully"}

# Analysis Routes
@app.post("/api/analyze/{patient_id}")
async def analyze_image(
    patient_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Validate patient exists
    patient = PatientService.get_patient(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/tiff", "image/tif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    try:
        # Save uploaded file
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join("uploads", unique_filename)
        
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
        
        # Perform analysis (simplified for now)
        analysis_result = AnalysisService.analyze_image(file_path)
        
        # Create a simple AI explanation without Groq dependency
        simple_explanation = AnalysisService.generate_ai_insights(
            analysis_result, 
            {
                "age": patient.age,
                "gender": patient.gender,
                "medical_history": patient.medical_history
            }
        )
        
        # Save analysis to database
        db_analysis = Analysis(
            case_id=patient.case_id,
            patient_id=patient_id,
            image_path=file_path,
            lesion_probability=analysis_result["lesion_probability"],
            overall_confidence=analysis_result["overall_confidence"],
            confidence_level=analysis_result["confidence_level"],
            analysis_data=json.dumps(analysis_result),
            ai_explanation=simple_explanation
        )
        
        db.add(db_analysis)
        db.commit()
        db.refresh(db_analysis)
        
        # Prepare response
        response_data = {
            "id": db_analysis.id,
            "case_id": db_analysis.case_id,
            "patient_id": db_analysis.patient_id,
            "lesion_probability": db_analysis.lesion_probability,
            "overall_confidence": db_analysis.overall_confidence,
            "confidence_level": db_analysis.confidence_level,
            "regions": analysis_result["regions"],
            "analysis_summary": analysis_result["analysis_summary"],
            "ai_explanation": db_analysis.ai_explanation,
            "original_image_url": f"/uploads/{unique_filename}",
            "created_at": db_analysis.created_at.isoformat() if db_analysis.created_at else datetime.now().isoformat()
        }
        
        return JSONResponse(content=response_data)
        
    except Exception as e:
        import traceback
        print(f"Analysis error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

# AI Explanation Routes
@app.post("/api/explain", response_model=AIExplanationResponse)
def get_ai_explanation(request: AIExplanationRequest):
    return ai_service.generate_explanation(request)

# Report Routes
@app.post("/api/reports/", response_model=ReportResponse)
def create_report(report_data: ReportCreate, db: Session = Depends(get_db)):
    return ReportService.create_report(db, report_data)

@app.get("/api/reports/{report_id}")
def download_report(report_id: int, db: Session = Depends(get_db)):
    report = ReportService.get_report(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return FileResponse(
        report.report_path,
        filename=f"pathology_report_{report.case_id}.pdf",
        media_type='application/pdf'
    )

@app.get("/api/patients/{patient_id}/reports")
def get_patient_reports(patient_id: int, db: Session = Depends(get_db)):
    return ReportService.get_reports_by_patient(db, patient_id)

# Health check
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0"
    }

@app.get("/")
def root():
    return {"message": "PathAI Pro Backend API", "version": "2.0.0"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )