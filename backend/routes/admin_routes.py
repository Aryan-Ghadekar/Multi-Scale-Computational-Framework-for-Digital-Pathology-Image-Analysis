"""
routes/admin_routes.py
Admin-only endpoints — requires role="admin" in JWT profile.
Exposes platform-wide stats, all patients, analyses, reports, and users.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from config.database import get_db
from models.models import Patient, Analysis, Report
from service.auth_service import auth_service
from supabase_client import SupabaseClient

logger = logging.getLogger("admin.routes")

admin_router = APIRouter(prefix="/admin", tags=["Admin"])


# ─────────────────────────────────────────────
# Auth dependency — verifies token & enforces admin role
# ─────────────────────────────────────────────

async def require_admin(authorization: str = None):
    """
    Pass Authorization: Bearer <token> header.
    Raises 401/403 if missing, invalid, or non-admin.
    """
    from fastapi import Header
    return None  # placeholder; wire in below via proper Header dep


from fastapi import Header as _Header


async def get_admin_user(authorization: Optional[str] = _Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    token = authorization.split(" ", 1)[1]
    try:
        token_data = await auth_service.verify_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    # Fetch profile to check role
    try:
        profile = await auth_service.get_profile_by_id(token_data["user_id"])
    except ValueError:
        raise HTTPException(status_code=401, detail="User profile not found.")

    if profile.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

    return profile


# ─────────────────────────────────────────────
# Response models
# ─────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_patients: int
    total_analyses: int
    total_reports: int
    total_users: int
    high_risk_cases: int
    analyses_today: int
    analyses_this_week: int
    avg_lesion_probability: float
    finalized_reports: int
    pending_reports: int


class PatientSummary(BaseModel):
    id: int
    case_id: str
    name: str
    age: int
    gender: str
    contact_info: Optional[str]
    medical_history: Optional[str]
    analysis_count: int
    report_count: int
    latest_lesion_probability: Optional[float]
    latest_confidence_level: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]


class AnalysisSummary(BaseModel):
    id: int
    case_id: str
    patient_id: int
    patient_name: Optional[str]
    lesion_probability: float
    overall_confidence: float
    confidence_level: str
    ai_explanation: Optional[str]
    image_path: Optional[str]
    created_at: datetime


class ReportSummary(BaseModel):
    id: int
    case_id: str
    patient_id: int
    patient_name: Optional[str]
    analysis_id: int
    report_path: str
    generated_at: datetime
    is_finalized: bool


class UserSummary(BaseModel):
    id: str
    full_name: Optional[str]
    role: Optional[str]
    email: Optional[str]
    created_at: Optional[str]


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@admin_router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Aggregate platform-wide stats for the admin dashboard."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    total_patients = db.query(func.count(Patient.id)).scalar() or 0
    total_analyses = db.query(func.count(Analysis.id)).scalar() or 0
    total_reports = db.query(func.count(Report.id)).scalar() or 0

    high_risk = (
        db.query(func.count(Analysis.id))
        .filter(Analysis.lesion_probability >= 0.7)
        .scalar() or 0
    )

    analyses_today = (
        db.query(func.count(Analysis.id))
        .filter(Analysis.created_at >= today_start)
        .scalar() or 0
    )

    analyses_week = (
        db.query(func.count(Analysis.id))
        .filter(Analysis.created_at >= week_start)
        .scalar() or 0
    )

    avg_prob_row = db.query(func.avg(Analysis.lesion_probability)).scalar()
    avg_prob = round(float(avg_prob_row), 4) if avg_prob_row else 0.0

    finalized = (
        db.query(func.count(Report.id))
        .filter(Report.is_finalized == True)
        .scalar() or 0
    )
    pending = (
        db.query(func.count(Report.id))
        .filter(Report.is_finalized == False)
        .scalar() or 0
    )

    # Fetch user count from Supabase profiles
    try:
        users_res = SupabaseClient.table("profiles").select("id", count="exact").execute()
        total_users = users_res.count or 0
    except Exception:
        total_users = 0

    return DashboardStats(
        total_patients=total_patients,
        total_analyses=total_analyses,
        total_reports=total_reports,
        total_users=total_users,
        high_risk_cases=high_risk,
        analyses_today=analyses_today,
        analyses_this_week=analyses_week,
        avg_lesion_probability=avg_prob,
        finalized_reports=finalized,
        pending_reports=pending,
    )


@admin_router.get("/patients", response_model=List[PatientSummary])
async def list_all_patients(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Return all patients with aggregated analysis/report counts."""
    q = db.query(Patient)
    if search:
        q = q.filter(
            Patient.name.ilike(f"%{search}%") |
            Patient.case_id.ilike(f"%{search}%")
        )
    patients = q.order_by(desc(Patient.created_at)).offset(skip).limit(limit).all()

    results = []
    for p in patients:
        analyses = db.query(Analysis).filter(Analysis.patient_id == p.id).all()
        reports = db.query(Report).filter(Report.patient_id == p.id).all()
        latest = (
            db.query(Analysis)
            .filter(Analysis.patient_id == p.id)
            .order_by(desc(Analysis.created_at))
            .first()
        )
        results.append(PatientSummary(
            id=p.id,
            case_id=p.case_id,
            name=p.name,
            age=p.age,
            gender=p.gender,
            contact_info=p.contact_info,
            medical_history=p.medical_history,
            analysis_count=len(analyses),
            report_count=len(reports),
            latest_lesion_probability=latest.lesion_probability if latest else None,
            latest_confidence_level=latest.confidence_level if latest else None,
            created_at=p.created_at,
            updated_at=p.updated_at,
        ))
    return results


@admin_router.get("/analyses", response_model=List[AnalysisSummary])
async def list_all_analyses(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    risk_filter: Optional[str] = Query(None, description="high | medium | low"),
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Return all analyses with optional risk-level filter."""
    q = db.query(Analysis)
    if risk_filter == "high":
        q = q.filter(Analysis.lesion_probability >= 0.7)
    elif risk_filter == "medium":
        q = q.filter(Analysis.lesion_probability >= 0.4, Analysis.lesion_probability < 0.7)
    elif risk_filter == "low":
        q = q.filter(Analysis.lesion_probability < 0.4)

    analyses = q.order_by(desc(Analysis.created_at)).offset(skip).limit(limit).all()

    patient_map: dict[int, str] = {}
    for a in analyses:
        if a.patient_id not in patient_map:
            p = db.query(Patient).filter(Patient.id == a.patient_id).first()
            patient_map[a.patient_id] = p.name if p else "Unknown"

    return [
        AnalysisSummary(
            id=a.id,
            case_id=a.case_id,
            patient_id=a.patient_id,
            patient_name=patient_map.get(a.patient_id),
            lesion_probability=a.lesion_probability,
            overall_confidence=a.overall_confidence,
            confidence_level=a.confidence_level,
            ai_explanation=a.ai_explanation,
            image_path=a.image_path,
            created_at=a.created_at,
        )
        for a in analyses
    ]


@admin_router.get("/reports", response_model=List[ReportSummary])
async def list_all_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    finalized: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Return all reports with optional finalization filter."""
    q = db.query(Report)
    if finalized is not None:
        q = q.filter(Report.is_finalized == finalized)
    reports = q.order_by(desc(Report.generated_at)).offset(skip).limit(limit).all()

    patient_map: dict[int, str] = {}
    for r in reports:
        if r.patient_id not in patient_map:
            p = db.query(Patient).filter(Patient.id == r.patient_id).first()
            patient_map[r.patient_id] = p.name if p else "Unknown"

    return [
        ReportSummary(
            id=r.id,
            case_id=r.case_id,
            patient_id=r.patient_id,
            patient_name=patient_map.get(r.patient_id),
            analysis_id=r.analysis_id,
            report_path=r.report_path,
            generated_at=r.generated_at,
            is_finalized=r.is_finalized,
        )
        for r in reports
    ]


@admin_router.get("/users", response_model=List[UserSummary])
async def list_all_users(
    admin=Depends(get_admin_user),
):
    """Return all registered users from Supabase profiles table."""
    try:
        res = SupabaseClient.table("profiles").select("*").execute()
        rows = res.data or []
    except Exception as exc:
        logger.error("Failed to fetch users: %s", exc)
        raise HTTPException(status_code=500, detail="Could not fetch users.")

    # Also try to get emails from auth (admin client needed)
    from service.auth_service import supabase_admin
    email_map: dict[str, str] = {}
    try:
        auth_users = supabase_admin.auth.admin.list_users()
        for u in auth_users:
            email_map[u.id] = u.email or ""
    except Exception:
        pass

    return [
        UserSummary(
            id=row["id"],
            full_name=row.get("full_name"),
            role=row.get("role"),
            email=email_map.get(row["id"]),
            created_at=row.get("created_at"),
        )
        for row in rows
    ]


@admin_router.delete("/patients/{patient_id}")
async def admin_delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Hard-delete a patient and all cascade records."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
    db.delete(patient)
    db.commit()
    return {"message": f"Patient {patient_id} deleted.", "success": True}


@admin_router.patch("/reports/{report_id}/finalize")
async def admin_finalize_report(
    report_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Mark a report as finalized."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    report.is_finalized = True
    db.commit()
    return {"message": f"Report {report_id} finalized.", "success": True}