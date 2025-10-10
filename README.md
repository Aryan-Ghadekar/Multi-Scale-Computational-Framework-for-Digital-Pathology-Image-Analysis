# PathAI Pro — Digital Pathology Analysis Platform

![PathAI Pro](https://img.shields.io/badge/PathAI-Pro-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-green)
![React](https://img.shields.io/badge/React-18.2.0-blue)
![SQLite](https://img.shields.io/badge/SQLite-Database-lightgrey)

A comprehensive digital pathology platform that leverages AI to analyze medical images, generate clinical reports, and provide explainable insights for healthcare professionals.

---

## Features
- AI-powered lesion detection with confidence scoring  
- Patient record and case management  
- Interactive WSI viewer (zoom, pan, heatmap)  
- Explainable AI: regional analysis and per-region confidence  
- PDF report generation (clinical reports)  
- Real-time analysis insights

---

## Tech Stack

### Backend
- FastAPI, SQLAlchemy, Pydantic  
- SQLite (local DB)  
- ReportLab (PDF generation), Pillow (image processing)

### Frontend
- React + TypeScript  
- Vite, Tailwind CSS, Lucide React (icons)

---

## Prerequisites
- Python 3.8+  
- Node.js 16+  
- npm or yarn

---

## Quick Start

### Backend
1. Open a terminal and go to the backend directory:
    ```bash
    cd backend
    ```
2. Create and activate a virtual environment:
    - Windows (PowerShell/CMD):
      ```powershell
      python -m venv venv
      venv\Scripts\activate
      ```
    - macOS / Linux:
      ```bash
      python -m venv venv
      source venv/bin/activate
      ```
3. Install Python dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4. Run the backend:
    ```bash
    python main.py
    ```
    - API: http://localhost:8000  
    - API docs: http://localhost:8000/api/docs  
    - Health check: http://localhost:8000/api/health

### Frontend
1. Open a new terminal and go to the frontend directory:
    ```bash
    cd frontend
    ```
2. Install dependencies and start dev server:
    ```bash
    npm install
    npm run dev
    ```
    - App (default): http://localhost:3000

---

## Project Structure
```
pathai-pro/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── patient_service.py
│   ├── analysis_service.py
│   ├── report_service.py
│   ├── ai_service.py
│   ├── requirements.txt
│   ├── uploads/
│   ├── reports/
│   └── static/
└── frontend/
     ├── src/
     │   ├── components/
     │   │   ├── WSIViewer.tsx
     │   │   ├── ConfidenceDisplay.tsx
     │   │   ├── ExplainabilityPanel.tsx
     │   │   └── PatientSidebar.tsx
     │   ├── pages/
     │   │   ├── Upload.tsx
     │   │   └── Index.tsx
     │   ├── services/
     │   │   └── api.ts
     │   └── App.tsx
     ├── package.json
     └── vite.config.ts
```

---

## API Endpoints (examples)

Patient Management
- POST /api/patients/ — Create patient
- GET /api/patients/ — List patients
- GET /api/patients/{id} — Get patient
- PUT /api/patients/{id} — Update patient
- DELETE /api/patients/{id} — Delete patient

Image Analysis
- POST /api/analyze/{patient_id} — Upload & analyze image  
  Returns: lesion probability, confidence scores, regional analysis, AI insights

Reports
- POST /api/reports/ — Generate PDF report
- GET /api/reports/{id} — Download report

AI Explanations
- POST /api/explain — Get AI analysis explanations

---

## Usage Guide (high level)
- Create patient via Upload page (name, age, gender, history)  
- Upload pathology image (JPEG, PNG, TIFF supported)  
- System processes image and displays:
  - Lesion probability (%)  
  - Overall confidence score  
  - Regional confidence breakdown  
  - AI-generated insights and recommendations  
- Generate PDF report from Reports tab

---

## Analysis Features
- Confidence tiers: High (≥75%), Moderate (50–74%), Low (<50%)  
- Region-level bounding boxes and scores  
- Feature detection and clinical context

---

## Data Security
- Local storage for uploads and SQLite DB (current implementation)  
- No external data transmission by default — processing happens locally

---

## Troubleshooting
- CORS errors: ensure backend runs on :8000 and frontend on :3000  
- Upload failures: check file format & size  
- Analysis/report errors: inspect backend logs and write permissions for reports/

---

## Future Enhancements
- Integrate real ML models and WSI/DICOM support  
- Multi-user auth & role-based access  
- Cloud storage options and real-time collaboration  
- Advanced visualizations

---

## Support
- API docs: http://localhost:8000/api/docs  
- Check backend logs and browser dev tools for troubleshooting

---

## License
For educational and research use by Team PathFinders.

Last updated: January 2025
