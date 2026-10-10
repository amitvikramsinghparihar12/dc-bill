-- ==============================================================================
-- GBA CORPORATION - DETAILED CONTINGENT (DC) BILL MANAGEMENT SYSTEM
-- PostgreSQL Production Schema & Transaction Definitions
-- Enforces ACID Guarantees, DDO Budget Caps & Strict Audit Immutability
-- ==============================================================================

-- 1. Departments Master Table
CREATE TABLE departments (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. DDOs (Drawing and Disbursing Officers)
-- Enforces 6 or 7 numeric digits format via CHECK constraint
CREATE TABLE ddos (
    id VARCHAR(7) PRIMARY KEY CHECK (id ~ '^[0-9]{6,7}$'),
    name VARCHAR(255) NOT NULL,
    department_id VARCHAR(32) NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Users & RBAC
CREATE TYPE user_role AS ENUM (
    'Super Admin',
    'Director of Finance',
    'Finance Officer',
    'Creator',
    'Verifier',
    'Approver',
    'RTGS Manager'
);

CREATE TABLE users (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User to DDO Scope Mappings (Enforces Operational DDO Isolation)
CREATE TABLE user_ddo_mappings (
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ddo_id VARCHAR(7) NOT NULL REFERENCES ddos(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, ddo_id)
);

-- Verifier to Creator Mappings
CREATE TABLE verifier_creator_mappings (
    verifier_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (verifier_id, creator_id)
);

-- 4. Vendors & Statutory Credentials
CREATE TABLE vendors (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64) NOT NULL,
    gstin VARCHAR(15) NOT NULL CHECK (gstin ~ '^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
    bank_account_number VARCHAR(32) NOT NULL CHECK (bank_account_number ~ '^\d{9,18}$'),
    ifsc VARCHAR(11) NOT NULL CHECK (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
    bank_name VARCHAR(128) NOT NULL,
    branch_name VARCHAR(128) NOT NULL,
    address TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vendor Statutory Document Checklist
CREATE TABLE vendor_documents (
    id BIGSERIAL PRIMARY KEY,
    vendor_id VARCHAR(32) NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('Uploaded', 'Pending')),
    uploaded_at TIMESTAMPTZ
);

-- 5. Macro Budget Head Grants (Director of Finance)
CREATE TABLE budget_grants (
    id VARCHAR(64) PRIMARY KEY,
    financial_year VARCHAR(16) NOT NULL,
    department_id VARCHAR(32) NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    total_granted NUMERIC(16, 2) NOT NULL CHECK (total_granted > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dept_fy UNIQUE (financial_year, department_id)
);

-- 6. DDO Allocations (Finance Officer)
-- Critical Invariant: CHECK (utilized <= allocated)
CREATE TABLE ddo_allocations (
    id VARCHAR(64) PRIMARY KEY,
    grant_id VARCHAR(64) NOT NULL REFERENCES budget_grants(id) ON DELETE RESTRICT,
    ddo_id VARCHAR(7) NOT NULL UNIQUE REFERENCES ddos(id) ON DELETE RESTRICT,
    allocated NUMERIC(16, 2) NOT NULL CHECK (allocated >= 0),
    utilized NUMERIC(16, 2) NOT NULL DEFAULT 0.00 CHECK (utilized >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_utilized_within_cap CHECK (utilized <= allocated)
);

-- 7. RTGS Batches
CREATE TABLE rtgs_batches (
    id VARCHAR(64) PRIMARY KEY,
    bank_account_id VARCHAR(64) NOT NULL,
    total_amount NUMERIC(16, 2) NOT NULL CHECK (total_amount > 0),
    beneficiary_count INT NOT NULL CHECK (beneficiary_count > 0),
    generated_by VARCHAR(32) NOT NULL REFERENCES users(id),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Contingent (DC) Bills
CREATE TYPE bill_status AS ENUM (
    'Draft',
    'Pending Verification',
    'Pending Approval',
    'Pending RTGS',
    'Paid',
    'Rejected'
);

CREATE TABLE bills (
    id VARCHAR(64) PRIMARY KEY, -- sequential e.g. 'IFMS 56'
    ddo_id VARCHAR(7) NOT NULL REFERENCES ddos(id) ON DELETE RESTRICT,
    vendor_id VARCHAR(32) NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    work_order_no VARCHAR(128) NOT NULL,
    work_order_date DATE NOT NULL,
    agreement_no VARCHAR(128) NOT NULL,
    description TEXT NOT NULL,
    base_value NUMERIC(16, 2) NOT NULL CHECK (base_value >= 0),
    cgst NUMERIC(16, 2) NOT NULL DEFAULT 0.00 CHECK (cgst >= 0),
    sgst NUMERIC(16, 2) NOT NULL DEFAULT 0.00 CHECK (sgst >= 0),
    igst NUMERIC(16, 2) NOT NULL DEFAULT 0.00 CHECK (igst >= 0),
    gross_value NUMERIC(16, 2) NOT NULL CHECK (gross_value >= 0),
    total_deductions NUMERIC(16, 2) NOT NULL DEFAULT 0.00 CHECK (total_deductions >= 0),
    net_payable NUMERIC(16, 2) NOT NULL CHECK (net_payable >= 0),
    status bill_status NOT NULL DEFAULT 'Draft',
    -- Invariant: A bill can belong to AT MOST ONE RTGS batch
    rtgs_batch_id VARCHAR(64) UNIQUE REFERENCES rtgs_batches(id) ON DELETE SET NULL,
    created_by VARCHAR(32) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_net_calculation CHECK (net_payable = gross_value - total_deductions),
    CONSTRAINT chk_gross_calculation CHECK (gross_value = base_value + cgst + sgst + igst)
);

-- 16 Deductions Table
CREATE TABLE bill_deductions (
    id BIGSERIAL PRIMARY KEY,
    bill_id VARCHAR(64) NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    deduction_head_index INT NOT NULL CHECK (deduction_head_index BETWEEN 1 AND 16),
    label VARCHAR(255) NOT NULL,
    amount NUMERIC(16, 2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0)
);

-- 9. Append-Only Audit Log
-- Invariant: strictly insert-only (UPDATE and DELETE are revoked below)
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action_type VARCHAR(64) NOT NULL,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id),
    role user_role NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    old_value JSONB,
    new_value JSONB
);

-- Security hardening: Revoke UPDATE and DELETE on audit_logs
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;

-- ==============================================================================
-- TRANSACTION PATTERN FOR BILL SUBMISSION:
-- Atomically checks remaining balance and increments utilized gross in one SQL query:
-- ==============================================================================
--
-- BEGIN;
--
--   -- Attempt atomic budget reservation
--   UPDATE ddo_allocations
--   SET utilized = utilized + :gross_value,
--       updated_at = NOW()
--   WHERE ddo_id = :ddo_id
--     AND (allocated - utilized) >= :gross_value;
--
--   -- Check affected rows: If 0 rows updated, fail with exact error
--   -- IF ROW_COUNT() = 0 THEN
--   --     ROLLBACK;
--   --     RAISE EXCEPTION 'Insufficient DDO Budget Balance.';
--   -- END IF;
--
--   -- Update bill status
--   UPDATE bills
--   SET status = 'Pending Verification',
--       updated_at = NOW()
--   WHERE id = :bill_id;
--
--   -- Insert audit log
--   INSERT INTO audit_logs (action_type, user_id, role, entity_type, entity_id, old_value, new_value)
--   VALUES ('BILL_SUBMITTED', :user_id, 'Creator', 'Bill', :bill_id, :old_val, :new_val);
--
-- COMMIT;
-- ==============================================================================
