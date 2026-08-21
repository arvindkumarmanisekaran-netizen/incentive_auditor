-- =====================================================
-- DATABASE RESET + BOOTSTRAP
--
-- Run with:
-- psql -h localhost -U incentive_user -d postgres -f setup.sql
--
-- IMPORTANT:
-- incentive_user must have CREATEDB privilege.
-- =====================================================


-- =====================================================
-- TERMINATE EXISTING CONNECTIONS
-- =====================================================

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'incentive_db'
  AND pid <> pg_backend_pid();


-- =====================================================
-- DROP DATABASE
-- =====================================================

DROP DATABASE IF EXISTS incentive_db;


-- =====================================================
-- CREATE DATABASE
-- =====================================================

CREATE DATABASE incentive_db
OWNER incentive_user;


-- =====================================================
-- CONNECT TO NEW DATABASE
-- =====================================================

\connect incentive_db


-- =====================================================
-- TERRITORIES
-- =====================================================

CREATE TABLE territories
(
    territory_id VARCHAR(20) PRIMARY KEY,
    territory_name VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_territory_name_country
        UNIQUE (territory_name, country)
);


-- =====================================================
-- REPRESENTATIVES
-- =====================================================

CREATE TABLE representatives
(
    representative_id VARCHAR(20) PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    territory_id VARCHAR(20) NOT NULL,
    joining_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- PRODUCTS
-- =====================================================

CREATE TABLE products
(
    product_id VARCHAR(20) PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL,
    product_category VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- DOCTORS
-- =====================================================

CREATE TABLE doctors
(
    doctor_id VARCHAR(20) PRIMARY KEY,
    doctor_name VARCHAR(200) NOT NULL,
    specialization VARCHAR(100),
    territory_id VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- REPRESENTATIVE DOCTOR ASSIGNMENTS
-- =====================================================

CREATE TABLE representative_doctor_assignments
(
    assignment_id VARCHAR(20) PRIMARY KEY,
    representative_id VARCHAR(20) NOT NULL,
    doctor_id VARCHAR(20) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- PRESCRIPTIONS
-- =====================================================

CREATE TABLE prescriptions
(
    prescription_id VARCHAR(20) PRIMARY KEY,
    prescription_date DATE NOT NULL,
    doctor_id VARCHAR(20) NOT NULL,
    product_id VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Valid',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- SALES
-- =====================================================

CREATE TABLE sales
(
    sale_id VARCHAR(20) PRIMARY KEY,
    sale_date DATE NOT NULL,
    doctor_id VARCHAR(20) NOT NULL,
    product_id VARCHAR(20) NOT NULL,
    selling_territory_id VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    sales_amount NUMERIC(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Valid',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- INCENTIVE PAYOUTS
-- =====================================================

CREATE TABLE incentive_payouts
(
    payout_id VARCHAR(20) PRIMARY KEY,

    representative_id VARCHAR(20) NOT NULL,
    product_id VARCHAR(20) NOT NULL,

    payout_month DATE NOT NULL,

    sales_target NUMERIC(15,2) NOT NULL DEFAULT 0,
    actual_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
    sales_achievement NUMERIC(8,2) NOT NULL DEFAULT 0,

    base_incentive NUMERIC(15,2) NOT NULL DEFAULT 0,
    achievement_multiplier NUMERIC(6,2) NOT NULL DEFAULT 0,

    calculated_payout NUMERIC(15,2) NOT NULL DEFAULT 0,
    maximum_payout NUMERIC(15,2) NOT NULL DEFAULT 0,

    expected_payout NUMERIC(15,2) NOT NULL DEFAULT 0,
    actual_payout NUMERIC(15,2) NOT NULL DEFAULT 0,
    payout_difference NUMERIC(15,2) NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'Pending',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_rep_product_month
        UNIQUE (
            representative_id,
            product_id,
            payout_month
        )
);


-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_doctors_territory
    ON doctors (territory_id);

CREATE INDEX idx_assignments_representative
    ON representative_doctor_assignments (representative_id);

CREATE INDEX idx_assignments_doctor
    ON representative_doctor_assignments (doctor_id);

CREATE INDEX idx_sales_date
    ON sales (sale_date);

CREATE INDEX idx_sales_doctor
    ON sales (doctor_id);

CREATE INDEX idx_sales_product
    ON sales (product_id);

CREATE INDEX idx_sales_territory
    ON sales (selling_territory_id);

CREATE INDEX idx_prescriptions_date
    ON prescriptions (prescription_date);

CREATE INDEX idx_prescriptions_doctor
    ON prescriptions (doctor_id);

CREATE INDEX idx_prescriptions_product
    ON prescriptions (product_id);

CREATE INDEX idx_payout_month
    ON incentive_payouts (payout_month);

CREATE INDEX idx_payout_product
    ON incentive_payouts (product_id);

CREATE INDEX idx_payout_representative
    ON incentive_payouts (representative_id);


-- =====================================================
-- VERIFY
-- =====================================================

SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;