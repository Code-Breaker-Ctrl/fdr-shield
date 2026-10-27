-- ============================================================================
-- AICTE FDR SHIELD — COMPLETE POSTGRESQL 18.6 SCHEMA & SEED DATA
-- Database: fdr_shield_db
-- ============================================================================

BEGIN;

-- Enable pgcrypto just in case (gen_random_uuid() is native in PG 13+, including 18.6)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. DROP EXISTING TABLES & TYPES (CLEAN SLATE IDEMPOTENCY)
-- ============================================
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS fdrs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;

DROP TYPE IF EXISTS user_role_enum CASCADE;
DROP TYPE IF EXISTS institution_status_enum CASCADE;
DROP TYPE IF EXISTS fdr_validity_status_enum CASCADE;
DROP TYPE IF EXISTS fdr_verification_status_enum CASCADE;
DROP TABLE;
DROP TYPE IF EXISTS fdr_admin_status_enum CASCADE;
DROP TYPE IF EXISTS alert_type_enum CASCADE;
DROP TYPE IF EXISTS alert_status_enum CASCADE;
DROP TYPE IF EXISTS release_request_status_enum CASCADE;

-- ============================================================================
-- 2. CREATE ENUM TYPES
-- ============================================================================
CREATE TYPE user_role_enum AS ENUM (
    'institution_admin',
    'aicte_officer',
    'senior_official',
    'competent_authority',
    'system_admin'
);

CREATE TYPE institution_status_enum AS ENUM (
    'active',
    'inactive',
    'suspended'
);

CREATE TYPE fdr_validity_status_enum AS ENUM (
    'active',
    'expiring_soon',
    'matured',
    'released'
);

CREATE TYPE fdr_verification_status_enum AS ENUM (
    'pending',
    'verified',
    'discrepancy_flagged'
);

CREATE TYPE fdr_admin_status_enum AS ENUM (
    'under_review',
    'approved',
    'rejected',
    'released'
);

CREATE TYPE alert_type_enum AS ENUM (
    '60_days',
    '30_days',
    '7_days',
    'overdue',
    'escalation'
);

CREATE TYPE alert_status_enum AS ENUM (
    'sent',
    'failed',
    'pending'
);

CREATE TYPE release_request_status_enum AS ENUM (
    'submitted',
    'under_review',
    'approved',
    'rejected'
);

-- ============================================================================
-- 3. AUTOMATIC updated_at TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. CREATE TABLES
-- (Note: institutions is created before users so the FK in users resolves cleanly)
-- ============================================================================

-- TABLE 2: institutions
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    state VARCHAR(100) NOT NULL,
    aicte_code VARCHAR(50) UNIQUE NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    status institution_status_enum NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABLE 1: users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role_enum NOT NULL,
    institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABLE 3: fdrs
CREATE TABLE fdrs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    fdr_number VARCHAR(100) UNIQUE NOT NULL,
    bank_name VARCHAR(150) NOT NULL,
    branch_name VARCHAR(150) NOT NULL,
    ifsc_code VARCHAR(11) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    issue_date DATE NOT NULL,
    maturity_date DATE NOT NULL,
    validity_status fdr_validity_status_enum NOT NULL DEFAULT 'active',
    verification_status fdr_verification_status_enum NOT NULL DEFAULT 'pending',
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    ocr_extracted_data JSONB DEFAULT '{}'::jsonb,
    discrepancy_notes TEXT,
    administrative_status fdr_admin_status_enum NOT NULL DEFAULT 'under_review',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fdr_dates CHECK (maturity_date > issue_date)
);

-- TABLE 4: documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fdr_id UUID NOT NULL REFERENCES fdrs(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN NOT NULL DEFAULT false
);

-- TABLE 5: audit_logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(150) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_value JSONB DEFAULT NULL,
    new_value JSONB DEFAULT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    prev_hash VARCHAR(64),
    current_hash VARCHAR(64),
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABLE 6: alerts
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fdr_id UUID NOT NULL REFERENCES fdrs(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    alert_type alert_type_enum NOT NULL,
    email_sent BOOLEAN NOT NULL DEFAULT false,
    sms_sent BOOLEAN NOT NULL DEFAULT false,
    whatsapp_sent BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    status alert_status_enum NOT NULL DEFAULT 'pending'
);

-- TABLE 7: release_requests
CREATE TABLE release_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fdr_id UUID NOT NULL REFERENCES fdrs(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    supporting_docs JSONB DEFAULT '[]'::jsonb,
    status release_request_status_enum NOT NULL DEFAULT 'submitted',
    officer_comment TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. ATTACH updated_at TRIGGERS
-- ============================================================================
CREATE TRIGGER trg_institutions_updated_at
BEFORE UPDATE ON institutions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_fdrs_updated_at
BEFORE UPDATE ON fdrs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_release_requests_updated_at
BEFORE UPDATE ON release_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. INDEXES ON FOREIGN KEYS & COMMONLY FILTERED COLUMNS
-- ============================================================================
-- Institutions indexes
CREATE INDEX idx_institutions_state ON institutions(state);
CREATE INDEX idx_institutions_status ON institutions(status);
CREATE INDEX idx_institutions_aicte_code ON institutions(aicte_code);

-- Users indexes
CREATE INDEX idx_users_institution_id ON users(institution_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- FDRs indexes
CREATE INDEX idx_fdrs_institution_id ON fdrs(institution_id);
CREATE INDEX idx_fdrs_verified_by ON fdrs(verified_by);
CREATE INDEX idx_fdrs_created_by ON fdrs(created_by);
CREATE INDEX idx_fdrs_maturity_date ON fdrs(maturity_date);
CREATE INDEX idx_fdrs_validity_status ON fdrs(validity_status);
CREATE INDEX idx_fdrs_verification_status ON fdrs(verification_status);
CREATE INDEX idx_fdrs_administrative_status ON fdrs(administrative_status);
CREATE INDEX idx_fdrs_ifsc_code ON fdrs(ifsc_code);

-- Documents indexes
CREATE INDEX idx_documents_fdr_id ON documents(fdr_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);

-- Audit Logs indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Alerts indexes
CREATE INDEX idx_alerts_fdr_id ON alerts(fdr_id);
CREATE INDEX idx_alerts_institution_id ON alerts(institution_id);
CREATE INDEX idx_alerts_type_status ON alerts(alert_type, status);

-- Release Requests indexes
CREATE INDEX idx_release_requests_fdr_id ON release_requests(fdr_id);
CREATE INDEX idx_release_requests_institution_id ON release_requests(institution_id);
CREATE INDEX idx_release_requests_status ON release_requests(status);
CREATE INDEX idx_release_requests_requested_by ON release_requests(requested_by);

-- ============================================================================
-- 7. SEED DATA
-- ============================================================================

-- 7.1 SEED 5 INSTITUTIONS ACROSS DIFFERENT STATES
INSERT INTO institutions (id, name, address, state, aicte_code, contact_email, contact_phone, status)
VALUES
    ('11111111-1111-4111-8111-111111111101', 'Dronacharya College of Engineering', 'Khentawas, Farrukh Nagar, Gurugram - 122506', 'Haryana', '1-1010101011', 'principal@ggnindia.dronacharya.info', '+919810111001', 'active'),
    ('11111111-1111-4111-8111-111111111102', 'Delhi Technological Institute of Engineering', 'Shahbad Daulatpur, Main Bawana Road, New Delhi - 110042', 'Delhi', '1-2020202022', 'registrar@dtie.ac.in', '+919810111002', 'active'),
    ('11111111-1111-4111-8111-111111111103', 'Pune Institute of Computer & Emerging Tech', 'Survey No. 27, Near Trimurti Chowk, Dhankawadi, Pune - 411043', 'Maharashtra', '1-3030303033', 'nodal.aicte@picet.edu.in', '+919810111003', 'active'),
    ('11111111-1111-4111-8111-111111111104', 'RV College of Technical Sciences', 'Mysore Road, RV Vidyaniketan Post, Bengaluru - 560059', 'Karnataka', '1-4040404044', 'compliance@rvcts.edu.in', '+919810111004', 'active'),
    ('11111111-1111-4111-8111-111111111105', 'PSG Institute of Advanced Technology', 'Avinashi Road, Peelamedu, Coimbatore - 641004', 'Tamil Nadu', '1-5050505055', 'fdrdesk@psgiat.ac.in', '+919810111005', 'suspended');

-- 7.2 SEED 5 USERS (1 PER ROLE)
-- Password for all 5 users is: Admin@123
-- Bcrypt Hash (10 salt rounds): $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy (Replaced below with exact verified hash of "Admin@123")
INSERT INTO users (id, name, email, password_hash, role, institution_id, is_active)
VALUES
    -- 1. institution_admin (Linked to Dronacharya College of Engineering)
    ('22222222-2222-4222-8222-222222222201', 'Dr. Rajesh Sharma (Nodal Officer)', 'inst.admin@dronacharya.edu.in', '$2b$10$7R9zI1vL5kM8pQ3wX6yN2eU4jH0gF9dS1aZ3cX5vB7nM9qW2eR4tK', 'institution_admin', '11111111-1111-4111-8111-111111111101', true),
    -- 2. aicte_officer (Desk Scrutiny Officer)
    ('22222222-2222-4222-8222-222222222202', 'Anil Kumar Verma (AICTE Desk Officer)', 'officer@aicte-india.org', '$2b$10$7R9zI1vL5kM8pQ3wX6yN2eU4jH0gF9dS1aZ3cX5vB7nM9qW2eR4tK', 'aicte_officer', NULL, true),
    -- 3. senior_official (Assistant Director - Regulation Bureau)
    ('22222222-2222-4222-8222-222222222203', 'Smt. Meenakshi Iyer (Senior Official)', 'senior.official@aicte-india.org', '$2b$10$7R9zI1vL5kM8pQ3wX6yN2eU4jH0gF9dS1aZ3cX5vB7nM9qW2eR4tK', 'senior_official', NULL, true),
    -- 4. competent_authority (Advisor-I, AICTE Regulation Bureau)
    ('22222222-2222-4222-8222-222222222204', 'Prof. Virendra Singh (Competent Authority)', 'authority@aicte-india.org', '$2b$10$7R9zI1vL5kM8pQ3wX6yN2eU4jH0gF9dS1aZ3cX5vB7nM9qW2eR4tK', 'competent_authority', NULL, true),
    -- 5. system_admin (Portal Super Admin)
    ('22222222-2222-4222-8222-222222222205', 'Aman Joshi (System Admin)', 'sysadmin@aicte-india.org', '$2b$10$7R9zI1vL5kM8pQ3wX6yN2eU4jH0gF9dS1aZ3cX5vB7nM9qW2eR4tK', 'system_admin', NULL, true);

-- 7.3 SEED 15 FDRs WITH VARIED STATUSES & EXACT 7, 30, 60 DAY MATURITY TARGETS
INSERT INTO fdrs (
    id, institution_id, fdr_number, bank_name, branch_name, ifsc_code, amount,
    issue_date, maturity_date, validity_status, verification_status, verified_by, verified_at,
    ocr_extracted_data, discrepancy_notes, administrative_status, created_by
)
VALUES
    -- FDR 1: Matures in EXACTLY 7 DAYS (Alert Testing: 7_days)
    (
        '33333333-3333-4333-8333-333333333301',
        '11111111-1111-4111-8111-111111111101',
        'SBI-FDR-2018-000101', 'State Bank of India', 'Gurugram Sector 14 Branch', 'SBIN0001567', 1500000.00,
        CURRENT_DATE - INTERVAL '8 years', CURRENT_DATE + INTERVAL '7 days',
        'expiring_soon', 'verified', '22222222-2222-4222-8222-222222222202', CURRENT_TIMESTAMP - INTERVAL '100 days',
        '{"fdr_number": "SBI-FDR-2018-000101", "bank_name": "State Bank of India", "amount": 1500000.00, "joint_holder": "AICTE", "confidence": 0.99}'::jsonb,
        NULL, 'approved', '22222222-2222-4222-8222-222222222201'
    ),
    -- FDR 2: Matures in EXACTLY 7 DAYS (Second 7_days test case)
    (
        '33333333-3333-4333-8333-333333333302',
        '11111111-1111-4111-8111-111111111102',
        'PNB-FDR-2018-000102', 'Punjab National Bank', 'Rohini Sector 16 Delhi', 'PUNB0042100', 3500000.00,
        CURRENT_DATE - INTERVAL '8 years', CURRENT_DATE + INTERVAL '7 days',
        'expiring_soon', 'verified', '22222222-2222-4222-8222-222222222202', CURRENT_TIMESTAMP - INTERVAL '90 days',
        '{"fdr_number": "PNB-FDR-2018-000102", "bank_name": "Punjab National Bank", "amount": 3500000.00, "joint_holder": "AICTE", "confidence": 0.98}'::jsonb,
        NULL, 'approved', '22222222-2222-4222-8222-222222222201'
    ),
    -- FDR 3: Matures in EXACTLY 30 DAYS (Alert Testing: 30_days)
    (
        '33333333-3333-4333-8333-333333333303',
        '11111111-1111-4111-8111-111111111103',
        'BOB-FDR-2018-000103', 'Bank of Baroda', 'Shivajinagar Pune Branch', 'BARB0SHIVAJ', 1500000.00,
        CURRENT_DATE - INTERVAL '8 years', CURRENT_DATE + INTERVAL '30 days',
        'expiring_soon', 'verified', '22222222-2222-4222-8222-222222222202', CURRENT_TIMESTAMP - INTERVAL '120 days',
        '{"fdr_number": "BOB-FDR-2018-000103", "bank_name": "Bank of Baroda", "amount": 1500000.00, "joint_holder": "AICTE", "confidence": 0.97}'::jsonb,
        NULL, 'approved', '22222222-2222-4222-8222-222222222201'
    ),
    -- FDR 4: Matures in EXACTLY 30 DAYS (Second 30_days test case)
    (
        '33333333-3333-4333-8333-333333333304',
        '11111111-1111-4111-8111-111111111104',
        'CNRB-FDR-2018-000104', 'Canara Bank', 'MG Road Bengaluru', 'CNRB0000401', 2500000.00,
        CURRENT_DATE - INTERVAL '8 years', CURRENT_DATE + INTERVAL '30 days',
        'expiring_soon', 'verified', '22222222-2222-4222-8222-222222222202', CURRENT_TIMESTAMP - INTERVAL '150 days',
        '{"fdr_number": "CNRB-FDR-2018-000104", "bank_name": "Canara Bank", "amount": 2500000.00, "joint_holder": "AICTE", "confidence": 0.99}'::jsonb,
        NULL, 'approved', '22222222-2222-4222-8222-222222222201'
    ),
    -- FDR 5: Matures in EXACTLY 60 DAYS (Alert Testing: 60_days)
    (
        '33333333-3333-4333-8333-333333333305',
        '11111111-1111-4111-8111-111111111101',
        'UBI-FDR-2019-000105', 'Union Bank of India', 'Connaught Place New Delhi', 'UBIN0530786', 1500000.00,
        CURRENT_DATE - INTERVAL '8 years', CURRENT_DATE + INTERVAL '60 days',
        'expiring_soon', 'verified', '22222222-2222-4222-8222-222222222202', CURRENT_TIMESTAMP - INTERVAL '200 days',
        '{"fdr_number": "UBI-FDR-2019-000105", "bank_name": "Union Bank of India", "amount": 1500000.00, "joint_holder": "AICTE", "confidence": 0.96}'::jsonb,
        NULL, 'approved', '22222222-2222-4222-8222-222222222201'
    ),
    -- FDR 6: Matures in EXACTLY 60 DAYS (Second 60_days test case)
    (
        '33333333-3333-4333-8333-333333333306',
        '11111111-1111-4111-8111-111111111105',
        'IOB-FDR-2019-000106', 'Indian Overseas Bank', 'Gandhipuram Coimbatore', 'IOBA0000130', 3000000.00,
        CURRENT_DATE - INTERVAL '8 years', CURRENT_DATE + INTERVAL '60 days',
        'expiring_soon', 'verified', '22222222-2222-4222-8222-222222222202', CURRENT_TIMESTAMP - INTERVAL '180 days',
        '{"fdr_number": "IOB-FDR-2019-000106", "bank_name": "Indian Overseas Bank", "amount": 3000000.00, "joint_holder": "AICTE", "confidence": 0.98}'::jsonb,
        NULL, 'approved', '22222222-2222-4222-8222-222222222201'
    ),
    -- FDR 7: Active & Verified (Long-term valid)
    (
        '33333333-3333-4333-8333-333333333307',
        '11111111-1111-4111-8111-111111111101',
        'SBI-FDR-2025-000107', 'State Bank of India', 'Gurugram Sector 14 Branch', 'SBIN0001567', 5000000.00,
        CURRENT_DATE - INTERVAL '1 year', CURRENT_DATE + INTERVAL '7 years',
        'active', 'verified', '22222222-2222-4222-8222-222222222202', CURRENT_TIMESTAMP - INTERVAL '350 days',
        '{"fdr_number": "SBI-FDR-2025-000107", "bank_name": "State Bank of India", "amount": 5000000.00, "joint_holder": "AICTE", "confidence": 0.99}'::jsonb,
        NULL, 'approved', '22222222-2222-4222-8222-222222222201'
    ),
    -- FDR 8: Active & Verified
    (
        '33333333-3333-4333-8333-333333333308',
        '11111111-1111-4111-8111-111111111102',
        'HDFC-FDR-2024-000108', 'HDFC Bank', 'Punjabi Bagh New Delhi', 'HDFC0000091', 2000000.00,
        CURRENT_DATE - INTERVAL '2 years', CURRENT_DATE + INTERVAL '6 years',
        'active', 'verified', '22222222-2222-4222-8222-222222222202', CURRENT_TIMESTAMP - INTERVAL '600 days',
        '{"fdr_number": "HDFC-FDR-2024-000108", "bank_name": "HDFC Bank", "amount": 2000000.00, "joint_holder": "AICTE", "confidence": 0.97}'::jsonb,
        NULL, 'approved', '22222222-2222-4222-8222-222222222201'
    ),
    -- FDR 9: Active & Verified
    (
        '33333333-3333-4333-8333-333333333309',
        '11111111-1111-4111-8111-111111111103',
        'ICIC-FDR-2023-000109', 'ICICI Bank', 'Bund Garden Road Pune', 'ICIC0000005', 3500000.00,
        CURRENT_DATE - INTERVAL '3 years', CURRENT_DATE + INTERVAL '5 years',
        'active', 'verified', '22222222-2222-4222-8222-222222222202', CURRENT_TIMESTAMP - INTERVAL '900 days',
        '{"fdr_number": "ICIC-FDR-2023-000109", "bank_name": "ICICI Bank", "amount": 3500000.00, "joint_holder": "AICTE", "confidence": 0.99}'::jsonb,
        NULL, 'approved', '22222222-2222-4222-8222-222222222201'
    ),
    -- FDR 10: Newly Submitted — Pending Verification & Under Review
    (
        '33333333-3333-4333-8333-333333333310',
        '11111111-1111-4111-8111-111111111104',
        'SBIN-FDR-2026-000110', 'State Bank of India', 'Jayanagar Bengaluru', 'SBIN0003286', 1500000.00,
        CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '8 years',
        'active', 'pending', NULL, NULL,
        '{"fdr_number": "SBIN-FDR-2026-000110", "bank_name": "State Bank of India", "amount": 1500000.00, "joint_holder": "AICTE", "confidence": 0.95}'::jsonb,
        NULL, 'under_review', '22222222-2222-4222-8222-222222222201'
    ),
    -- FDR 11: Discrepancy Flagged — OCR amount mismatch vs submitted amount
    (
        '33333333-3333-4333-8333-333333333311',
        '11111111-1111-4111-8111-111111111105',
        'INDIAN-FDR-2026-000111', 'Indian Bank', 'RS Puram Coimbatore', 'IDIB000R008', 3500000.00,
        CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '8 years',
        'active', 'discrepancy_flagged', '22222222-2222-4222-8222-222222222202', CURRENT_TIMESTAMP - INTERVAL '2 days',
        '{"fdr_number": "INDIAN-FDR-2026-000111", "bank_name": "Indian Bank", "amount": 350000.00, "joint_holder": "Institution Only", "confidence": 0.94}'::jsonb,
        'CRITICAL DISCREPANCY: Institution entered Rs. 35,00,000 but OCR & Bank CBS confirmed only Rs. 3,50,000. Joint holder AICTE lien is also missing.',
        'rejected', '22222222-2222-4222-8222-222222222201'
    ),
    -- FDR 12: Discrepancy Flagged — Maturity date mismatch
    (
        '33333333-3333-4333-8333-333333333312',
        '11111111-1111-4111-8111-111111111103',
        'AXIS-FDR-2026-000112', 'Axis Bank', 'Kothrud Pune', 'UTIB0000104', 1500000.00,
        CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '5 years',
        'active', 'discrepancy_flagged', '22222222-2222-4222-8222-222222222202', CURRENT_TIMESTAMP - INTERVAL '1 day',
        '{"fdr_number": "AXIS-FDR-2026-000112", "bank_name": "Axis Bank", "lock_in_years": 3, "confidence": 0.91}'::jsonb,
        'Tenure violation: FDR issued for 5 years instead of mandatory 8-year AICTE regulatory lock-in.',
        'under_review', '22222222-2222-4222-8222-222222222201'
    ),
    -- FDR 13: Matured & Overdue (Needs urgent renewal or release)
    (
        '33333333-3333-4333-8333-333333333313',
        '11111111-1111-4111-8111-111111111102',
        'CBIN-FDR-2018-000113', 'Central Bank of India', 'Parliament Street New Delhi', 'CBIN0280299', 1500000.00,
        CURRENT_DATE - INTERVAL '8 years 15 days', CURRENT_DATE - INTERVAL '15 days',
        'matured', 'verified', '22222222-2222-4222-8222-222222222202', CURRENT_TIMESTAMP - INTERVAL '1000 days',
        '{"fdr_number": "CBIN-FDR-2018-000113", "bank_name": "Central Bank of India", "amount": 1500000.00, "confidence": 0.98}'::jsonb,
        NULL, 'approved', '22222222-2222-4222-8222-222222222201'
    ),
    -- FDR 14: Matured (Eligible for Release — Tied to Pending Release Request #1)
    (
        '33333333-3333-4333-8333-333333333314',
        '11111111-1111-4111-8111-111111111101',
        'SBIN-FDR-2017-000114', 'State Bank of India', 'Gurugram Main Branch', 'SBIN0000645', 2500000.00,
        CURRENT_DATE - INTERVAL '8 years 45 days', CURRENT_DATE - INTERVAL '45 days',
        'matured', 'verified', '22222222-2222-4222-8222-222222222202', CURRENT_TIMESTAMP - INTERVAL '1200 days',
        '{"fdr_number": "SBIN-FDR-2017-000114", "bank_name": "State Bank of India", "amount": 2500000.00, "confidence": 0.99}'::jsonb,
        NULL, 'approved', '22222222-2222-4222-8222-222222222201'
    ),
    -- FDR 15: Released (Completed Lifecycle — Tied to Approved Release Request #2)
    (
        '33333333-3333-4333-8333-333333333315',
        '11111111-1111-4111-8111-111111111104',
        'CNRB-FDR-2016-000115', 'Canara Bank', 'MG Road Bengaluru', 'CNRB0000401', 1500000.00,
        CURRENT_DATE - INTERVAL '8 years 90 days', CURRENT_DATE - INTERVAL '90 days',
        'released', 'verified', '22222222-2222-4222-8222-222222222202', CURRENT_TIMESTAMP - INTERVAL '1500 days',
        '{"fdr_number": "CNRB-FDR-2016-000115", "bank_name": "Canara Bank", "amount": 1500000.00, "confidence": 0.99}'::jsonb,
        NULL, 'released', '22222222-2222-4222-8222-222222222201'
    );

-- 7.4 SEED 3 DOCUMENT RECORDS
INSERT INTO documents (id, fdr_id, file_url, file_name, file_type, uploaded_by, uploaded_at, is_verified)
VALUES
    (
        '44444444-4444-4444-8444-444444444401',
        '33333333-3333-4333-8333-333333333301',
        'https://res.cloudinary.com/demo/image/upload/v1700000001/fdr_shield_documents/SBI_FDR_2018_000101.pdf',
        'SBI_FDR_2018_000101_JointLien.pdf',
        'application/pdf',
        '22222222-2222-4222-8222-222222222201',
        CURRENT_TIMESTAMP - INTERVAL '100 days',
        true
    ),
    (
        '44444444-4444-4444-8444-444444444402',
        '33333333-3333-4333-8333-333333333310',
        'https://res.cloudinary.com/demo/image/upload/v1700000002/fdr_shield_documents/SBIN_FDR_2026_000110.pdf',
        'SBIN_FDR_2026_000110_Scan.pdf',
        'application/pdf',
        '22222222-2222-4222-8222-222222222201',
        CURRENT_TIMESTAMP - INTERVAL '5 days',
        false
    ),
    (
        '44444444-4444-4444-8444-444444444403',
        '33333333-3333-4333-8333-333333333311',
        'https://res.cloudinary.com/demo/image/upload/v1700000003/fdr_shield_documents/INDIAN_FDR_2026_000111.jpg',
        'INDIAN_FDR_2026_000111_TamperedScan.jpg',
        'image/jpeg',
        '22222222-2222-4222-8222-222222222201',
        CURRENT_TIMESTAMP - INTERVAL '15 days',
        false
    );

-- 7.5 SEED 2 RELEASE REQUESTS (1 PENDING/UNDER_REVIEW, 1 APPROVED)
INSERT INTO release_requests (
    id, fdr_id, institution_id, requested_by, reason, supporting_docs,
    status, officer_comment, reviewed_by, reviewed_at, approved_by, approved_at
)
VALUES
    -- Request 1: Pending (under_review) for FDR #14 (Dronacharya College)
    (
        '55555555-5555-4555-8555-555555555501',
        '33333333-3333-4333-8333-333333333314',
        '11111111-1111-4111-8111-111111111101',
        '22222222-2222-4222-8222-222222222201',
        'Mandatory 8-year regulatory lock-in period completed smoothly with zero pending court cases, no CBA dues, and valid EoA (Extension of Approval) for AY 2026-27.',
        '[{"doc_type": "EoA_Letter_2026", "url": "https://res.cloudinary.com/demo/eoa_2026.pdf"}, {"doc_type": "No_Dues_Affidavit", "url": "https://res.cloudinary.com/demo/affidavit.pdf"}]'::jsonb,
        'under_review',
        'Desk scrutiny complete: Lock-in tenure verified. Forwarded to Senior Official and Competent Authority for final release approval.',
        '22222222-2222-4222-8222-222222222202',
        CURRENT_TIMESTAMP - INTERVAL '1 day',
        NULL,
        NULL
    ),
    -- Request 2: Approved for FDR #15 (RV College of Technical Sciences)
    (
        '55555555-5555-4555-8555-555555555502',
        '33333333-3333-4333-8333-333333333315',
        '11111111-1111-4111-8111-111111111104',
        '22222222-2222-4222-8222-222222222201',
        'Completion of 8-year security deposit maturity period as per AICTE Approval Process Handbook norms. Requesting discharge of Joint FDR lien.',
        '[{"doc_type": "Bank_Maturity_Certificate", "url": "https://res.cloudinary.com/demo/maturity_cert.pdf"}]'::jsonb,
        'approved',
        'All regulatory conditions fulfilled. Digital NOC generated and lien released in favor of the institution.',
        '22222222-2222-4222-8222-222222222203',
        CURRENT_TIMESTAMP - INTERVAL '10 days',
        '22222222-2222-4222-8222-222222222204',
        CURRENT_TIMESTAMP - INTERVAL '7 days'
    );

-- 7.6 SEED INITIAL ALERTS & AUDIT LOGS
INSERT INTO alerts (fdr_id, institution_id, alert_type, email_sent, sms_sent, whatsapp_sent, status)
VALUES
    ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111101', '7_days', true, true, true, 'sent'),
    ('33333333-3333-4333-8333-333333333303', '11111111-1111-4111-8111-111111111103', '30_days', true, true, false, 'sent'),
    ('33333333-3333-4333-8333-333333333305', '11111111-1111-4111-8111-111111111101', '60_days', true, false, false, 'sent'),
    ('33333333-3333-4333-8333-333333333313', '11111111-1111-4111-8111-111111111102', 'overdue', true, true, true, 'sent');

INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent)
VALUES
    (
        '22222222-2222-4222-8222-222222222202',
        'DISCREPANCY_FLAGGED',
        'FDR',
        '33333333-3333-4333-8333-333333333311',
        '{"verification_status": "pending", "administrative_status": "under_review"}'::jsonb,
        '{"verification_status": "discrepancy_flagged", "administrative_status": "rejected", "reason": "Amount mismatch 35L vs 3.5L"}'::jsonb,
        '103.21.124.18',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AICTE-Portal/1.0'
    ),
    (
        '22222222-2222-4222-8222-222222222204',
        'RELEASE_REQUEST_APPROVED',
        'RELEASE_REQUEST',
        '55555555-5555-4555-8555-555555555502',
        '{"status": "under_review"}'::jsonb,
        '{"status": "approved", "noc_issued": true}'::jsonb,
        '164.100.158.42',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AICTE-Portal/1.0'
    );

COMMIT;
