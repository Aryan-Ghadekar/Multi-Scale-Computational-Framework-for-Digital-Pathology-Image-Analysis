from sqlalchemy.orm import Session
from backend.models.models import Report, Patient, Analysis
from backend.schema.schemas import ReportCreate, ReportResponse
import os
import uuid
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
import json

class ReportService:
    @staticmethod
    def generate_pdf_report(db: Session, report_data: ReportCreate) -> str:
        # Get patient and analysis data
        patient = db.query(Patient).filter(Patient.id == report_data.patient_id).first()
        analysis = db.query(Analysis).filter(Analysis.id == report_data.analysis_id).first()
        
        if not patient or not analysis:
            raise ValueError("Patient or analysis not found")
        
        # Create reports directory if it doesn't exist
        os.makedirs("reports", exist_ok=True)
        
        # Generate unique filename
        report_filename = f"report_{report_data.case_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        report_path = os.path.join("reports", report_filename)
        
        # Create PDF
        doc = SimpleDocTemplate(report_path, pagesize=letter)
        story = []
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=30,
            textColor=colors.HexColor('#2c5530')
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=12,
            spaceAfter=12,
            textColor=colors.HexColor('#2c5530')
        )
        
        # Title
        story.append(Paragraph("Pathology Analysis Report", title_style))
        story.append(Spacer(1, 20))
        
        # Patient Information
        story.append(Paragraph("Patient Information", heading_style))
        patient_data = [
            ["Case ID:", patient.case_id],
            ["Name:", patient.name],
            ["Age:", str(patient.age)],
            ["Gender:", patient.gender],
            ["Report Date:", datetime.now().strftime("%Y-%m-%d %H:%M")]
        ]
        patient_table = Table(patient_data, colWidths=[100, 300])
        patient_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8f9fa')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e9ecef')),
        ]))
        story.append(patient_table)
        story.append(Spacer(1, 20))
        
        # Analysis Results
        story.append(Paragraph("Analysis Results", heading_style))
        analysis_data = json.loads(analysis.analysis_data)
        
        results_data = [
            ["Lesion Probability:", f"{analysis.lesion_probability}%"],
            ["Overall Confidence:", f"{analysis.overall_confidence}%"],
            ["Confidence Level:", analysis.confidence_level]
        ]
        results_table = Table(results_data, colWidths=[120, 280])
        results_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8f9fa')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e9ecef')),
        ]))
        story.append(results_table)
        story.append(Spacer(1, 12))
        
        # Regional Analysis
        story.append(Paragraph("Regional Analysis", heading_style))
        region_data = [["Region", "Confidence", "Score"]]
        for region in analysis_data.get('regions', []):
            region_data.append([
                region['name'],
                f"{region['confidence']}%",
                f"{region['score']:.2f}"
            ])
        
        region_table = Table(region_data, colWidths=[200, 100, 100])
        region_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5530')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8f9fa')),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey)
        ]))
        story.append(region_table)
        story.append(Spacer(1, 20))
        
        # AI Explanation
        if analysis.ai_explanation:
            story.append(Paragraph("AI Analysis Summary", heading_style))
            story.append(Paragraph(analysis.ai_explanation, styles['Normal']))
            story.append(Spacer(1, 20))
        
        # Footer
        story.append(Paragraph("Generated by PathAI Pro - Digital Pathology Analysis System", 
                             ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey)))
        
        doc.build(story)
        
        return report_path
    
    @staticmethod
    def create_report(db: Session, report_data: ReportCreate) -> Report:
        # Generate PDF first
        report_path = ReportService.generate_pdf_report(db, report_data)
        
        # Create report record
        db_report = Report(
            case_id=report_data.case_id,
            patient_id=report_data.patient_id,
            analysis_id=report_data.analysis_id,
            report_path=report_path
        )
        
        db.add(db_report)
        db.commit()
        db.refresh(db_report)
        return db_report
    
    @staticmethod
    def get_report(db: Session, report_id: int) -> Report:
        return db.query(Report).filter(Report.id == report_id).first()
    
    @staticmethod
    def get_reports_by_patient(db: Session, patient_id: int):
        return db.query(Report).filter(Report.patient_id == patient_id).all()