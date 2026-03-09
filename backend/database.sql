-- Create patients table
CREATE TABLE patients (
    id BIGSERIAL PRIMARY KEY,
    case_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    contact_info TEXT,
    medical_history TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on patients
CREATE INDEX idx_patients_case_id ON patients(case_id);
CREATE INDEX idx_patients_name ON patients(name);

-- Create analyses table
CREATE TABLE analyses (
    id BIGSERIAL PRIMARY KEY,
    case_id TEXT NOT NULL,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    heatmap_path TEXT,
    lesion_probability FLOAT NOT NULL,
    overall_confidence FLOAT NOT NULL,
    confidence_level TEXT NOT NULL,
    analysis_data TEXT NOT NULL, -- JSON string
    ai_explanation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Create indexes
    CONSTRAINT fk_analyses_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE CASCADE
);

-- Create indexes on analyses
CREATE INDEX idx_analyses_case_id ON analyses(case_id);
CREATE INDEX idx_analyses_patient_id ON analyses(patient_id);
CREATE INDEX idx_analyses_created_at ON analyses(created_at);

-- Create reports table
CREATE TABLE reports (
    id BIGSERIAL PRIMARY KEY,
    case_id TEXT NOT NULL,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    analysis_id BIGINT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    report_path TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    is_finalized BOOLEAN DEFAULT FALSE,
    
    -- Create indexes
    CONSTRAINT fk_reports_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_reports_analysis FOREIGN KEY (analysis_id) 
        REFERENCES analyses(id) ON DELETE CASCADE
);

-- Create indexes on reports
CREATE INDEX idx_reports_case_id ON reports(case_id);
CREATE INDEX idx_reports_patient_id ON reports(patient_id);
CREATE INDEX idx_reports_analysis_id ON reports(analysis_id);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for patients table
CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create a view for combined patient and analysis data
CREATE VIEW patient_analysis_view AS
SELECT 
    p.id as patient_id,
    p.case_id,
    p.name,
    p.age,
    p.gender,
    a.id as analysis_id,
    a.lesion_probability,
    a.overall_confidence,
    a.confidence_level,
    a.created_at as analysis_date,
    r.id as report_id,
    r.is_finalized,
    r.generated_at as report_generated_at
FROM patients p
LEFT JOIN analyses a ON p.id = a.patient_id
LEFT JOIN reports r ON a.id = r.analysis_id;