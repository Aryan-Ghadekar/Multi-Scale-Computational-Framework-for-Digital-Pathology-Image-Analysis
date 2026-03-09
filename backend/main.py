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
from service.analysis_service import AnalysisService
from config.database import get_db, engine, Base
from models.models import Patient, Analysis, Report
from schema.schemas import (
    PatientCreate, PatientUpdate, PatientResponse, 
    AnalysisResponse, ReportCreate, ReportResponse,
    AIExplanationRequest, AIExplanationResponse
)
from service.patient_service import PatientService
from service.report_service import ReportService
from service.ai_service import AIService

from service.tif_to_png_service import convert_tif_to_png


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
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5175",
        "http://192.168.35.239:8080",
        "http://192.168.100.3:5175",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Mount static files
app.mount(
    "/static",
    StaticFiles(directory="static"),
    name="static"
)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/reports", StaticFiles(directory="reports"), name="reports")

# Initialize services
ai_service = AIService()

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
        
        preview_png_path = convert_tif_to_png(file_path)
        # Perform analysis (simplified for now)
        analysis_result = AnalysisService.analyze_image(file_path)
        
        
        # Save analysis to database
        db_analysis = Analysis(
            case_id=patient.case_id,
            patient_id=patient_id,
            image_path=file_path,
            lesion_probability=analysis_result["lesion_probability"],
            overall_confidence=analysis_result["overall_confidence"],
            confidence_level=analysis_result["confidence_level"],
            analysis_data=json.dumps(analysis_result),
            ai_explanation=""  # Empty for now, will be filled by dedicated call
        )
        
        db.add(db_analysis)
        db.commit()
        db.refresh(db_analysis)

        ai_request = AIExplanationRequest(
            patient_info={
                "name": patient.name,
                "age": patient.age,
                "gender": patient.gender,
                "medical_history": patient.medical_history
            },
            analysis_data=analysis_result,
            specific_question="Please explain these pathology findings in clinical terms."
        )
        
        try:
            ai_response = ai_service.generate_explanation(ai_request)
            detailed_explanation = f"{ai_response.explanation}\n\nKey Findings:\n" + \
                                "\n".join(f"• {finding}" for finding in ai_response.key_findings) + \
                                f"\n\nRecommendations:\n" + \
                                "\n".join(f"• {rec}" for rec in ai_response.recommendations)
            
            # Update with detailed explanation
            db_analysis.ai_explanation = detailed_explanation
            db.commit()
            
        except Exception as e:
            # Fallback to simple explanation
            simple_explanation = AnalysisService.generate_ai_insights(
                analysis_result, 
                {
                    "name": patient.name,
                    "age": patient.age,
                    "gender": patient.gender,
                    "medical_history": patient.medical_history
                }
            )
            db_analysis.ai_explanation = simple_explanation
            db.commit()

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
            "ai_explanation": db_analysis.ai_explanation,  # Now with proper AI explanation
            "original_image_url": f"/uploads/{unique_filename}",
            "preview_image_url": (
                f"/static/previews/{os.path.basename(preview_png_path)}"
                if preview_png_path else None
            ),
            "created_at": db_analysis.created_at.isoformat() if db_analysis.created_at else datetime.now().isoformat(),
            # Add structured AI data for frontend
            "ai_analysis": {
                "key_findings": ai_response.key_findings if 'ai_response' in locals() else [],
                "recommendations": ai_response.recommendations if 'ai_response' in locals() else []
            }
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


@app.post("/api/analysis/{analysis_id}/regenerate-explanation")
def regenerate_explanation(
    analysis_id: int,
    specific_question: str = None,
    db: Session = Depends(get_db)
):
    """Regenerate AI explanation for an existing analysis"""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    patient = db.query(Patient).filter(Patient.id == analysis.patient_id).first()
    
    # Parse analysis data
    analysis_data = json.loads(analysis.analysis_data) if analysis.analysis_data else {}
    
    # Create AI request
    ai_request = AIExplanationRequest(
        patient_info={
            "name": patient.name if patient else "Unknown",
            "age": patient.age if patient else "N/A",
            "gender": patient.gender if patient else "N/A",
            "medical_history": patient.medical_history if patient else ""
        },
        analysis_data=analysis_data,
        specific_question=specific_question or "Please explain these findings."
    )
    
    # Get AI explanation
    ai_response = ai_service.generate_explanation(ai_request)
    
    # Update analysis
    detailed_explanation = f"{ai_response.explanation}\n\nKey Findings:\n" + \
                          "\n".join(f"• {finding}" for finding in ai_response.key_findings) + \
                          f"\n\nRecommendations:\n" + \
                          "\n".join(f"• {rec}" for rec in ai_response.recommendations)
    
    analysis.ai_explanation = detailed_explanation
    db.commit()
    db.refresh(analysis)  # Refresh to get updated data
    
    # Return COMPLETE analysis data, not just explanation
    return {
        "id": analysis.id,
        "case_id": analysis.case_id,
        "patient_id": analysis.patient_id,
        "lesion_probability": analysis.lesion_probability,
        "overall_confidence": analysis.overall_confidence,
        "confidence_level": analysis.confidence_level,
        "regions": analysis_data.get("regions", []),
        "analysis_summary": analysis_data.get("analysis_summary", ""),
        "ai_explanation": analysis.ai_explanation,
        "original_image_url": analysis.image_path.replace("uploads/", "/uploads/") if analysis.image_path else None,
        "preview_image_url": (
            f"/static/previews/{os.path.basename(analysis.image_path).replace('.tif', '.png').replace('.tiff', '.png')}"
            if analysis.image_path and any(ext in analysis.image_path.lower() for ext in ['.tif', '.tiff'])
            else None
        ),
        "created_at": analysis.created_at.isoformat() if analysis.created_at else datetime.now().isoformat(),
        "ai_analysis": {
            "key_findings": ai_response.key_findings,
            "recommendations": ai_response.recommendations
        },
        "metrics": analysis_data.get("metrics", {}),
        "raw_predictions": analysis_data.get("raw_predictions", {})
    }

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