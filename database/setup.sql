-- ============================================
-- DROP DATABASE
-- ============================================

DROP DATABASE IF EXISTS incentive_db;


-- ============================================
-- CREATE DATABASE
-- ============================================

CREATE DATABASE incentive_db
OWNER incentive_user;


\connect incentive_db;


-- ============================================
-- TABLES
-- NO FOREIGN KEYS
-- ============================================


CREATE TABLE territories (

    territory_id VARCHAR(20) PRIMARY KEY,

    territory_name VARCHAR(100) NOT NULL,

    region VARCHAR(100) NOT NULL,

    country VARCHAR(100) NOT NULL,

    status VARCHAR(20)
        DEFAULT 'Active'
        NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL

);


CREATE TABLE representatives (

    representative_id VARCHAR(20) PRIMARY KEY,

    first_name VARCHAR(100) NOT NULL,

    last_name VARCHAR(100) NOT NULL,

    territory_id VARCHAR(20) NOT NULL,

    joining_date DATE NOT NULL,

    status VARCHAR(20)
        DEFAULT 'Active'
        NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL

);



CREATE TABLE products (

    product_id VARCHAR(20) PRIMARY KEY,

    product_name VARCHAR(200) NOT NULL,

    product_category VARCHAR(100),

    status VARCHAR(20)
        DEFAULT 'Active'
        NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL

);



CREATE TABLE doctors (

    doctor_id VARCHAR(20) PRIMARY KEY,

    doctor_name VARCHAR(200) NOT NULL,

    specialization VARCHAR(100),

    territory_id VARCHAR(20) NOT NULL,

    status VARCHAR(20)
        DEFAULT 'Active'
        NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL

);



CREATE TABLE incentive_programs (

    program_id VARCHAR(20) PRIMARY KEY,

    program_name VARCHAR(200) NOT NULL,

    period_type VARCHAR(20)
        DEFAULT 'Monthly'
        NOT NULL,

    effective_from DATE NOT NULL,

    effective_to DATE,

    minimum_sales_achievement NUMERIC(6,2)
        DEFAULT 80
        NOT NULL,

    maximum_payout_multiplier NUMERIC(6,2)
        DEFAULT 125
        NOT NULL,

    status VARCHAR(20)
        DEFAULT 'Active'
        NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL

);



CREATE TABLE incentive_tiers (

    tier_id VARCHAR(20) PRIMARY KEY,

    program_id VARCHAR(20) NOT NULL,

    minimum_achievement NUMERIC(6,2) NOT NULL,

    maximum_achievement NUMERIC(6,2),

    payout_multiplier NUMERIC(6,2) NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL

);



CREATE TABLE representative_doctor_assignments (

    assignment_id VARCHAR(20) PRIMARY KEY,

    representative_id VARCHAR(20) NOT NULL,

    doctor_id VARCHAR(20) NOT NULL,

    effective_from DATE NOT NULL,

    effective_to DATE,

    status VARCHAR(20)
        DEFAULT 'Active'
        NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL

);



CREATE TABLE prescriptions (

    prescription_id VARCHAR(20) PRIMARY KEY,

    prescription_date DATE NOT NULL,

    doctor_id VARCHAR(20) NOT NULL,

    product_id VARCHAR(20) NOT NULL,

    quantity INTEGER NOT NULL,

    status VARCHAR(20)
        DEFAULT 'Valid'
        NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL

);



CREATE TABLE sales (

    sale_id VARCHAR(20) PRIMARY KEY,

    sale_date DATE NOT NULL,

    doctor_id VARCHAR(20) NOT NULL,

    product_id VARCHAR(20) NOT NULL,

    selling_territory_id VARCHAR(20) NOT NULL,

    quantity INTEGER NOT NULL,

    sales_amount NUMERIC(15,2) NOT NULL,

    status VARCHAR(20)
        DEFAULT 'Valid'
        NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL

);



CREATE TABLE sales_targets (

    target_id VARCHAR(20) PRIMARY KEY,

    representative_id VARCHAR(20) NOT NULL,

    product_id VARCHAR(20) NOT NULL,

    target_month DATE NOT NULL,

    target_amount NUMERIC(15,2) NOT NULL,

    status VARCHAR(20)
        DEFAULT 'Active'
        NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL

);



CREATE TABLE product_incentive_rates (

    rate_id VARCHAR(20) PRIMARY KEY,

    program_id VARCHAR(20) NOT NULL,

    product_id VARCHAR(20) NOT NULL,

    incentive_rate NUMERIC(6,2) NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL

);



CREATE TABLE incentive_payouts (

    payout_id VARCHAR(20) PRIMARY KEY,

    representative_id VARCHAR(20) NOT NULL,

    product_id VARCHAR(20) NOT NULL,

    program_id VARCHAR(20) NOT NULL,

    payout_month DATE NOT NULL,

    sales_target NUMERIC(15,2)
        DEFAULT 0 NOT NULL,

    actual_sales NUMERIC(15,2)
        DEFAULT 0 NOT NULL,

    sales_achievement NUMERIC(8,2)
        DEFAULT 0 NOT NULL,

    base_incentive NUMERIC(15,2)
        DEFAULT 0 NOT NULL,

    achievement_multiplier NUMERIC(6,2)
        DEFAULT 0 NOT NULL,

    calculated_payout NUMERIC(15,2)
        DEFAULT 0 NOT NULL,

    maximum_payout NUMERIC(15,2)
        DEFAULT 0 NOT NULL,

    expected_payout NUMERIC(15,2)
        DEFAULT 0 NOT NULL,

    actual_payout NUMERIC(15,2)
        DEFAULT 0 NOT NULL,

    payout_difference NUMERIC(15,2)
        DEFAULT 0 NOT NULL,

    status VARCHAR(20)
        DEFAULT 'Pending'
        NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL

);



-- ============================================
-- UNIQUE CONSTRAINTS
-- ============================================


ALTER TABLE product_incentive_rates
ADD CONSTRAINT uq_program_product_rate
UNIQUE(program_id, product_id);



ALTER TABLE incentive_payouts
ADD CONSTRAINT uq_rep_product_program_month
UNIQUE(
    representative_id,
    product_id,
    program_id,
    payout_month
);



ALTER TABLE sales_targets
ADD CONSTRAINT uq_sales_target
UNIQUE(
    representative_id,
    product_id,
    target_month
);



ALTER TABLE territories
ADD CONSTRAINT uq_territory_name_country
UNIQUE(
    territory_name,
    country
);



-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_doctors_territory
ON doctors(territory_id);


CREATE INDEX idx_sales_doctor
ON sales(doctor_id);


CREATE INDEX idx_sales_product
ON sales(product_id);


CREATE INDEX idx_sales_date
ON sales(sale_date);


CREATE INDEX idx_prescriptions_doctor
ON prescriptions(doctor_id);


CREATE INDEX idx_prescriptions_product
ON prescriptions(product_id);


CREATE INDEX idx_payout_representative
ON incentive_payouts(representative_id);


CREATE INDEX idx_payout_product
ON incentive_payouts(product_id);


CREATE INDEX idx_payout_month
ON incentive_payouts(payout_month);


CREATE INDEX idx_sales_targets_representative
ON sales_targets(representative_id);


CREATE INDEX idx_sales_targets_product
ON sales_targets(product_id);


GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
TO incentive_user;