from sqlalchemy.orm import Session
from models.models import Patient, Analysis, Report
from schema.schemas import PatientCreate, PatientUpdate, PatientResponse
import uuid
from datetime import datetime

class PatientService:
    @staticmethod
    def create_patient(db: Session, patient: PatientCreate) -> Patient:
        case_id = f"PT-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"
        
        db_patient = Patient(
            case_id=case_id,
            name=patient.name,
            age=patient.age,
            gender=patient.gender,
            contact_info=patient.contact_info,
            medical_history=patient.medical_history
        )
        
        db.add(db_patient)
        db.commit()
        db.refresh(db_patient)
        return db_patient
    
    @staticmethod
    def get_patient(db: Session, patient_id: int) -> Patient:
        return db.query(Patient).filter(Patient.id == patient_id).first()
    
    @staticmethod
    def get_patient_by_case_id(db: Session, case_id: str) -> Patient:
        return db.query(Patient).filter(Patient.case_id == case_id).first()
    
    @staticmethod
    def get_all_patients(db: Session, skip: int = 0, limit: int = 100):
        return db.query(Patient).offset(skip).limit(limit).all()
    
    @staticmethod
    def update_patient(db: Session, patient_id: int, patient_update: PatientUpdate) -> Patient:
        db_patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if db_patient:
            for key, value in patient_update.dict().items():
                setattr(db_patient, key, value)
            db.commit()
            db.refresh(db_patient)
        return db_patient
    
    @staticmethod
    def delete_patient(db: Session, patient_id: int) -> bool:
        db_patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if db_patient:
            db.delete(db_patient)
            db.commit()
            return True
        return False
    
    @staticmethod
    def get_patient_analyses(db: Session, patient_id: int):
        return db.query(Analysis).filter(Analysis.patient_id == patient_id).all()
    
    @staticmethod
    def get_patient_reports(db: Session, patient_id: int):
        return db.query(Report).filter(Report.patient_id == patient_id).all()