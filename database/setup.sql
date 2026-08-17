-- ============================================================
-- INCENTIVE AUDITOR DATABASE
-- ============================================================


-- ============================================================
-- DROP TABLES
-- Safe order because of foreign keys
-- ============================================================

DROP TABLE IF EXISTS incentive_payouts CASCADE;
DROP TABLE IF EXISTS incentive_targets CASCADE;
DROP TABLE IF EXISTS incentive_rules CASCADE;

DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS sales CASCADE;

DROP TABLE IF EXISTS representative_doctor_assignments CASCADE;

DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS representatives CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS territories CASCADE;


-- ============================================================
-- TERRITORIES
-- ============================================================

CREATE TABLE territories (
    territory_id VARCHAR(20) PRIMARY KEY,
    territory_name VARCHAR(150) NOT NULL,
    region_name VARCHAR(150),
    active BOOLEAN NOT NULL DEFAULT TRUE
);


-- ============================================================
-- REPRESENTATIVES
-- ============================================================

CREATE TABLE representatives (
    representative_id VARCHAR(20) PRIMARY KEY,

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,

    territory_id VARCHAR(20),

    email VARCHAR(200),
    active BOOLEAN NOT NULL DEFAULT TRUE,

    FOREIGN KEY (territory_id)
        REFERENCES territories(territory_id)
);


-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE products (
    product_id VARCHAR(20) PRIMARY KEY,

    product_name VARCHAR(150) NOT NULL,
    product_category VARCHAR(100),

    unit_price NUMERIC(12, 2),

    active BOOLEAN NOT NULL DEFAULT TRUE
);


-- ============================================================
-- DOCTORS
-- ============================================================

CREATE TABLE doctors (
    doctor_id VARCHAR(20) PRIMARY KEY,

    doctor_name VARCHAR(150) NOT NULL,

    territory_id VARCHAR(20),

    speciality VARCHAR(120),

    active BOOLEAN NOT NULL DEFAULT TRUE,

    FOREIGN KEY (territory_id)
        REFERENCES territories(territory_id)
);


-- ============================================================
-- REPRESENTATIVE / DOCTOR ASSIGNMENT
--
-- Doctor ownership determines representative attribution.
-- The effective dates are important because your SQL queries
-- already use them.
-- ============================================================

CREATE TABLE representative_doctor_assignments (
    assignment_id BIGSERIAL PRIMARY KEY,

    representative_id VARCHAR(20) NOT NULL,
    doctor_id VARCHAR(20) NOT NULL,

    effective_from DATE NOT NULL,
    effective_to DATE,

    FOREIGN KEY (representative_id)
        REFERENCES representatives(representative_id),

    FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id),

    CONSTRAINT valid_assignment_dates
        CHECK (
            effective_to IS NULL
            OR effective_to >= effective_from
        )
);


CREATE INDEX idx_rda_representative
ON representative_doctor_assignments(
    representative_id
);


CREATE INDEX idx_rda_doctor
ON representative_doctor_assignments(
    doctor_id
);


-- ============================================================
-- SALES
--
-- Your investigation service expects:
--
-- sale_date
-- doctor_id
-- product_id
-- sales_amount
-- selling_territory_id
-- status
-- ============================================================

CREATE TABLE sales (
    sale_id BIGSERIAL PRIMARY KEY,

    doctor_id VARCHAR(20) NOT NULL,
    product_id VARCHAR(20) NOT NULL,

    sale_date DATE NOT NULL,

    sales_amount NUMERIC(14, 2) NOT NULL,

    quantity NUMERIC(14, 2),

    selling_territory_id VARCHAR(20) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'Valid',

    FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id),

    FOREIGN KEY (product_id)
        REFERENCES products(product_id),

    FOREIGN KEY (selling_territory_id)
        REFERENCES territories(territory_id),

    CONSTRAINT sales_amount_non_negative
        CHECK (sales_amount >= 0)
);


CREATE INDEX idx_sales_investigation
ON sales(
    product_id,
    sale_date,
    doctor_id
);


-- ============================================================
-- PRESCRIPTIONS
--
-- Your investigation service expects:
--
-- prescription_date
-- doctor_id
-- product_id
-- quantity
-- status
-- ============================================================

CREATE TABLE prescriptions (
    prescription_id BIGSERIAL PRIMARY KEY,

    doctor_id VARCHAR(20) NOT NULL,
    product_id VARCHAR(20) NOT NULL,

    prescription_date DATE NOT NULL,

    quantity NUMERIC(14, 2) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'Valid',

    FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id),

    FOREIGN KEY (product_id)
        REFERENCES products(product_id),

    CONSTRAINT prescription_quantity_non_negative
        CHECK (quantity >= 0)
);


CREATE INDEX idx_prescriptions_investigation
ON prescriptions(
    product_id,
    prescription_date,
    doctor_id
);


-- ============================================================
-- INCENTIVE RULES
--
-- This is where your incentive_service can later retrieve the
-- rule instead of hardcoding it.
-- ============================================================

CREATE TABLE incentive_rules (
    incentive_rule_id BIGSERIAL PRIMARY KEY,

    product_id VARCHAR(20) NOT NULL,

    rule_name VARCHAR(150) NOT NULL,

    effective_from DATE NOT NULL,
    effective_to DATE,

    threshold_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,

    payout_percentage NUMERIC(8, 4) NOT NULL,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    FOREIGN KEY (product_id)
        REFERENCES products(product_id),

    CONSTRAINT valid_rule_dates
        CHECK (
            effective_to IS NULL
            OR effective_to >= effective_from
        )
);


-- ============================================================
-- TARGETS
-- ============================================================

CREATE TABLE incentive_targets (
    target_id BIGSERIAL PRIMARY KEY,

    representative_id VARCHAR(20) NOT NULL,
    product_id VARCHAR(20) NOT NULL,

    target_month DATE NOT NULL,

    target_amount NUMERIC(14, 2) NOT NULL,

    FOREIGN KEY (representative_id)
        REFERENCES representatives(representative_id),

    FOREIGN KEY (product_id)
        REFERENCES products(product_id),

    UNIQUE (
        representative_id,
        product_id,
        target_month
    )
);


-- ============================================================
-- PAYOUTS
--
-- Your investigation service already expects:
--
-- payout_id
-- representative_id
-- product_id
-- payout_month
-- expected_payout
-- actual_payout
-- payout_difference
-- status
-- ============================================================

CREATE TABLE incentive_payouts (
    payout_id BIGSERIAL PRIMARY KEY,

    representative_id VARCHAR(20) NOT NULL,
    product_id VARCHAR(20) NOT NULL,

    payout_month DATE NOT NULL,

    expected_payout NUMERIC(14, 2) NOT NULL,
    actual_payout NUMERIC(14, 2) NOT NULL,

    payout_difference NUMERIC(14, 2)
        GENERATED ALWAYS AS (
            actual_payout - expected_payout
        ) STORED,

    status VARCHAR(30) NOT NULL DEFAULT 'Processed',

    FOREIGN KEY (representative_id)
        REFERENCES representatives(representative_id),

    FOREIGN KEY (product_id)
        REFERENCES products(product_id),

    UNIQUE (
        representative_id,
        product_id,
        payout_month
    )
);


-- ============================================================
-- DUMMY DATA
-- ============================================================


-- ------------------------------------------------------------
-- TERRITORIES
-- ------------------------------------------------------------

INSERT INTO territories (
    territory_id,
    territory_name,
    region_name
)
VALUES
    (
        'T001',
        'Mumbai West',
        'West'
    ),
    (
        'T002',
        'Pune',
        'West'
    ),
    (
        'T003',
        'Mumbai Central',
        'West'
    );


-- ------------------------------------------------------------
-- REPRESENTATIVES
-- ------------------------------------------------------------

INSERT INTO representatives (
    representative_id,
    first_name,
    last_name,
    territory_id,
    email
)
VALUES
    (
        'FR001',
        'Amit',
        'Sharma',
        'T001',
        'amit.sharma@example.com'
    ),
    (
        'FR002',
        'Neha',
        'Patel',
        'T002',
        'neha.patel@example.com'
    ),
    (
        'FR003',
        'Rahul',
        'Kapoor',
        'T003',
        'rahul.kapoor@example.com'
    );


-- ------------------------------------------------------------
-- PRODUCTS
-- ------------------------------------------------------------

INSERT INTO products (
    product_id,
    product_name,
    product_category,
    unit_price
)
VALUES
    (
        'P001',
        'CardioPlus',
        'Cardiology',
        500.00
    ),
    (
        'P002',
        'GlucoCare',
        'Diabetes',
        350.00
    ),
    (
        'P003',
        'NeuroMax',
        'Neurology',
        650.00
    );


-- ------------------------------------------------------------
-- DOCTORS
-- ------------------------------------------------------------

INSERT INTO doctors (
    doctor_id,
    doctor_name,
    territory_id,
    speciality
)
VALUES
    (
        'D001',
        'Dr Mehta',
        'T001',
        'Cardiology'
    ),
    (
        'D002',
        'Dr Rao',
        'T002',
        'General Medicine'
    ),
    (
        'D003',
        'Dr Shah',
        'T002',
        'Diabetology'
    ),
    (
        'D004',
        'Dr Kulkarni',
        'T003',
        'Neurology'
    );


-- ------------------------------------------------------------
-- REPRESENTATIVE / DOCTOR OWNERSHIP
-- ------------------------------------------------------------

INSERT INTO representative_doctor_assignments (
    representative_id,
    doctor_id,
    effective_from,
    effective_to
)
VALUES
    (
        'FR001',
        'D001',
        '2026-01-01',
        NULL
    ),
    (
        'FR002',
        'D002',
        '2026-01-01',
        NULL
    ),
    (
        'FR002',
        'D003',
        '2026-01-01',
        NULL
    ),
    (
        'FR003',
        'D004',
        '2026-01-01',
        NULL
    );


-- ============================================================
-- FR001 / P001
--
-- Historical monthly sales:
-- Apr = 80,000
-- May = 85,000
-- Jun = 90,000
--
-- Average = 85,000
--
-- July = 125,000
--
-- Deviation:
-- (125000 - 85000) / 85000 * 100
-- = 47.0588%
--
-- This matches the test case you have been using.
-- ============================================================


-- ------------------------------------------------------------
-- HISTORICAL SALES
-- ------------------------------------------------------------

INSERT INTO sales (
    doctor_id,
    product_id,
    sale_date,
    sales_amount,
    quantity,
    selling_territory_id,
    status
)
VALUES
    (
        'D001',
        'P001',
        '2026-04-10',
        80000.00,
        160,
        'T001',
        'Valid'
    ),
    (
        'D001',
        'P001',
        '2026-05-10',
        85000.00,
        170,
        'T001',
        'Valid'
    ),
    (
        'D001',
        'P001',
        '2026-06-10',
        90000.00,
        180,
        'T001',
        'Valid'
    );


-- ------------------------------------------------------------
-- JULY SALES
--
-- 75,000 home territory
-- 50,000 Pune
--
-- Total = 125,000
-- Cross territory = 40%
-- ------------------------------------------------------------

INSERT INTO sales (
    doctor_id,
    product_id,
    sale_date,
    sales_amount,
    quantity,
    selling_territory_id,
    status
)
VALUES
    (
        'D001',
        'P001',
        '2026-07-05',
        75000.00,
        150,
        'T001',
        'Valid'
    ),
    (
        'D001',
        'P001',
        '2026-07-18',
        50000.00,
        100,
        'T002',
        'Valid'
    );


-- ============================================================
-- PRESCRIPTIONS
--
-- Historical:
-- Apr = 100
-- May = 110
-- Jun = 105
--
-- Average = 105
--
-- July = 25.5 approximately
--
-- Change:
-- (25.5 - 105) / 105 = -75.71%
-- ============================================================

INSERT INTO prescriptions (
    doctor_id,
    product_id,
    prescription_date,
    quantity,
    status
)
VALUES
    (
        'D001',
        'P001',
        '2026-04-12',
        100,
        'Valid'
    ),
    (
        'D001',
        'P001',
        '2026-05-12',
        110,
        'Valid'
    ),
    (
        'D001',
        'P001',
        '2026-06-12',
        105,
        'Valid'
    ),
    (
        'D001',
        'P001',
        '2026-07-12',
        25.5,
        'Valid'
    );


-- ============================================================
-- FR002 / P002
--
-- More normal data so you can test a different combination.
-- ============================================================

INSERT INTO sales (
    doctor_id,
    product_id,
    sale_date,
    sales_amount,
    quantity,
    selling_territory_id,
    status
)
VALUES
    (
        'D002',
        'P002',
        '2026-04-08',
        55000.00,
        157,
        'T002',
        'Valid'
    ),
    (
        'D003',
        'P002',
        '2026-04-14',
        25000.00,
        71,
        'T002',
        'Valid'
    ),

    (
        'D002',
        'P002',
        '2026-05-08',
        57000.00,
        163,
        'T002',
        'Valid'
    ),
    (
        'D003',
        'P002',
        '2026-05-14',
        26000.00,
        74,
        'T002',
        'Valid'
    ),

    (
        'D002',
        'P002',
        '2026-06-08',
        59000.00,
        169,
        'T002',
        'Valid'
    ),
    (
        'D003',
        'P002',
        '2026-06-14',
        27000.00,
        77,
        'T002',
        'Valid'
    ),

    (
        'D002',
        'P002',
        '2026-07-08',
        60000.00,
        171,
        'T002',
        'Valid'
    ),
    (
        'D003',
        'P002',
        '2026-07-14',
        28000.00,
        80,
        'T002',
        'Valid'
    );


INSERT INTO prescriptions (
    doctor_id,
    product_id,
    prescription_date,
    quantity,
    status
)
VALUES
    (
        'D002',
        'P002',
        '2026-04-10',
        60,
        'Valid'
    ),
    (
        'D003',
        'P002',
        '2026-04-16',
        35,
        'Valid'
    ),

    (
        'D002',
        'P002',
        '2026-05-10',
        62,
        'Valid'
    ),
    (
        'D003',
        'P002',
        '2026-05-16',
        36,
        'Valid'
    ),

    (
        'D002',
        'P002',
        '2026-06-10',
        64,
        'Valid'
    ),
    (
        'D003',
        'P002',
        '2026-06-16',
        37,
        'Valid'
    ),

    (
        'D002',
        'P002',
        '2026-07-10',
        65,
        'Valid'
    ),
    (
        'D003',
        'P002',
        '2026-07-16',
        38,
        'Valid'
    );


-- ============================================================
-- INCENTIVE RULES
-- ============================================================

INSERT INTO incentive_rules (
    product_id,
    rule_name,
    effective_from,
    effective_to,
    threshold_amount,
    payout_percentage,
    active
)
VALUES
    (
        'P001',
        'P001 Standard 5 Percent',
        '2026-01-01',
        NULL,
        0,
        5.0000,
        TRUE
    ),
    (
        'P002',
        'P002 Standard 5 Percent',
        '2026-01-01',
        NULL,
        0,
        5.0000,
        TRUE
    ),
    (
        'P003',
        'P003 Standard 4 Percent',
        '2026-01-01',
        NULL,
        0,
        4.0000,
        TRUE
    );


-- ============================================================
-- TARGETS
-- ============================================================

INSERT INTO incentive_targets (
    representative_id,
    product_id,
    target_month,
    target_amount
)
VALUES
    (
        'FR001',
        'P001',
        '2026-07-01',
        100000.00
    ),
    (
        'FR002',
        'P002',
        '2026-07-01',
        85000.00
    ),
    (
        'FR003',
        'P003',
        '2026-07-01',
        70000.00
    );


-- ============================================================
-- PAYOUT DATA
--
-- FR001:
-- Expected = 125,000 * 5% = 6,250
-- Actual = 9,000
-- Difference = 2,750
--
-- This matches your existing UI example.
-- ============================================================

INSERT INTO incentive_payouts (
    representative_id,
    product_id,
    payout_month,
    expected_payout,
    actual_payout,
    status
)
VALUES
    (
        'FR001',
        'P001',
        '2026-07-01',
        6250.00,
        9000.00,
        'Processed'
    ),
    (
        'FR002',
        'P002',
        '2026-07-01',
        4400.00,
        4400.00,
        'Processed'
    );


-- ============================================================
-- END
-- ============================================================