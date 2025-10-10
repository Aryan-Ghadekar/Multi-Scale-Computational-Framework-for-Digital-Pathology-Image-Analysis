from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.sql import func
from database import Base
import datetime

class Patient(Base):
    __tablename__ = "patients"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    age = Column(Integer)
    gender = Column(String)
    contact_info = Column(String, nullable=True)
    medical_history = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Analysis(Base):
    __tablename__ = "analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(String, index=True)
    patient_id = Column(Integer, index=True)
    image_path = Column(String)
    heatmap_path = Column(String, nullable=True)
    lesion_probability = Column(Float)
    overall_confidence = Column(Float)
    confidence_level = Column(String)
    analysis_data = Column(Text)  # JSON string of analysis results
    ai_explanation = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Report(Base):
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(String, index=True)
    patient_id = Column(Integer, index=True)
    analysis_id = Column(Integer, index=True)
    report_path = Column(String)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    is_finalized = Column(Boolean, default=False)