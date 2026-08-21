-- =====================================================
-- DATABASE BOOTSTRAP
-- Run this file initially against the postgres database.
-- =====================================================

SELECT 'CREATE DATABASE incentive_db OWNER incentive_user'
WHERE NOT EXISTS (
    SELECT 1
    FROM pg_database
    WHERE datname = 'incentive_db'
)
\gexec

\connect incentive_db

-- =====================================================
-- TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS territories
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

CREATE TABLE IF NOT EXISTS representatives
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

CREATE TABLE IF NOT EXISTS products
(
    product_id VARCHAR(20) PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL,
    product_category VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors
(
    doctor_id VARCHAR(20) PRIMARY KEY,
    doctor_name VARCHAR(200) NOT NULL,
    specialization VARCHAR(100),
    territory_id VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS representative_doctor_assignments
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

CREATE TABLE IF NOT EXISTS prescriptions
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

CREATE TABLE IF NOT EXISTS sales
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

CREATE TABLE IF NOT EXISTS sales_targets
(
    target_id VARCHAR(20) PRIMARY KEY,
    representative_id VARCHAR(20) NOT NULL,
    product_id VARCHAR(20) NOT NULL,
    target_month DATE NOT NULL,
    target_amount NUMERIC(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sales_target
        UNIQUE (representative_id, product_id, target_month)
);

CREATE TABLE IF NOT EXISTS incentive_programs
(
    program_id VARCHAR(20) PRIMARY KEY,
    program_name VARCHAR(200) NOT NULL,
    period_type VARCHAR(20) NOT NULL DEFAULT 'Monthly',
    effective_from DATE NOT NULL,
    effective_to DATE,
    minimum_sales_achievement NUMERIC(6,2) NOT NULL DEFAULT 80,
    maximum_payout_multiplier NUMERIC(6,2) NOT NULL DEFAULT 125,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incentive_tiers
(
    tier_id VARCHAR(20) PRIMARY KEY,
    program_id VARCHAR(20) NOT NULL,
    minimum_achievement NUMERIC(6,2) NOT NULL,
    maximum_achievement NUMERIC(6,2),
    payout_multiplier NUMERIC(6,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_incentive_rates
(
    rate_id VARCHAR(20) PRIMARY KEY,
    program_id VARCHAR(20) NOT NULL,
    product_id VARCHAR(20) NOT NULL,
    incentive_rate NUMERIC(6,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_program_product_rate
        UNIQUE (program_id, product_id)
);

CREATE TABLE IF NOT EXISTS incentive_payouts
(
    payout_id VARCHAR(20) PRIMARY KEY,
    representative_id VARCHAR(20) NOT NULL,
    product_id VARCHAR(20) NOT NULL,
    program_id VARCHAR(20) NOT NULL,
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
    CONSTRAINT uq_rep_product_program_month
        UNIQUE (
            representative_id,
            product_id,
            program_id,
            payout_month
        )
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_doctors_territory
    ON doctors (territory_id);

CREATE INDEX IF NOT EXISTS idx_sales_date
    ON sales (sale_date);

CREATE INDEX IF NOT EXISTS idx_sales_doctor
    ON sales (doctor_id);

CREATE INDEX IF NOT EXISTS idx_sales_product
    ON sales (product_id);

CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor
    ON prescriptions (doctor_id);

CREATE INDEX IF NOT EXISTS idx_prescriptions_product
    ON prescriptions (product_id);

CREATE INDEX IF NOT EXISTS idx_sales_targets_product
    ON sales_targets (product_id);

CREATE INDEX IF NOT EXISTS idx_sales_targets_representative
    ON sales_targets (representative_id);

CREATE INDEX IF NOT EXISTS idx_payout_month
    ON incentive_payouts (payout_month);

CREATE INDEX IF NOT EXISTS idx_payout_product
    ON incentive_payouts (product_id);

CREATE INDEX IF NOT EXISTS idx_payout_representative
    ON incentive_payouts (representative_id);


-- =====================================================
-- CLEAR EXISTING DATA
-- =====================================================

TRUNCATE TABLE
    incentive_payouts,
    product_incentive_rates,
    incentive_tiers,
    sales_targets,
    prescriptions,
    sales,
    representative_doctor_assignments,
    incentive_programs,
    doctors,
    products,
    representatives,
    territories;

-- =====================================================
-- INCENTIVE AUDITOR LARGE TEST DATA
-- PART 1
--
-- Covers:
-- Territories
-- Representatives
-- Products
-- Doctors
-- Assignments
--
-- Date range:
-- 2026-01-01 to 2026-07-31
-- =====================================================


-- =====================================================
-- CLEAR DATA
-- =====================================================

TRUNCATE TABLE
incentive_payouts,
incentive_programs,
prescriptions,
sales,
representative_doctor_assignments,
doctors,
products,
representatives,
territories
CASCADE;



-- =====================================================
-- TERRITORIES
-- =====================================================

INSERT INTO territories
(
territory_id,
territory_name,
region,
country
)
VALUES

('T001','North Zone','North','India'),
('T002','South Zone','South','India'),
('T003','East Zone','East','India'),
('T004','West Zone','West','India'),
('T005','Central Zone','Central','India'),
('T006','Metro Zone','Metro','India'),
('T007','Rural Zone','Rural','India'),
('T008','Export Zone','International','India');



-- =====================================================
-- REPRESENTATIVES
-- =====================================================

INSERT INTO representatives
(
representative_id,
first_name,
last_name,
territory_id,
joining_date
)
VALUES

(
'REP001',
'John',
'Smith',
'T001',
'2025-01-01'
),

(
'REP002',
'Mary',
'Joseph',
'T002',
'2025-02-01'
),

(
'REP003',
'David',
'Lee',
'T003',
'2025-03-01'
),

(
'REP004',
'Sarah',
'Wilson',
'T004',
'2025-04-01'
),

(
'REP005',
'Alex',
'Brown',
'T005',
'2025-05-01'
);



-- =====================================================
-- PRODUCTS
-- =====================================================

INSERT INTO products
(
product_id,
product_name,
product_category
)
VALUES

('PROD001','CardioPlus','Cardiology'),
('PROD002','CardioMax','Cardiology'),

('PROD003','DiabetesCare','Diabetes'),
('PROD004','InsulinPro','Diabetes'),

('PROD005','NeuroLife','Neurology'),
('PROD006','NeuroAdvance','Neurology'),

('PROD007','PainFree','Pain Management'),
('PROD008','PainRelief Plus','Pain Management'),

('PROD009','ImmunoMax','Immunology'),
('PROD010','Respira','Respiratory'),

('PROD011','GastroAid','Gastro'),
('PROD012','RenalCare','Nephrology'),

('PROD013','VitaminPro','Supplement'),
('PROD014','Dermacare','Dermatology'),
('PROD015','OncoSupport','Oncology');



-- =====================================================
-- DOCTORS
-- =====================================================


INSERT INTO doctors
(
doctor_id,
doctor_name,
specialization,
territory_id
)
VALUES


-- REP001 DOCTORS

('DOC001','Dr Arun Kumar','Cardiology','T001'),
('DOC002','Dr Priya Shah','Cardiology','T001'),
('DOC003','Dr Ravi Menon','Diabetes','T001'),
('DOC004','Dr Anita Rao','Neurology','T001'),
('DOC005','Dr Vijay Singh','General Medicine','T001'),
('DOC006','Dr Neha Patel','Cardiology','T001'),
('DOC007','Dr Amit Joshi','Diabetes','T001'),
('DOC008','Dr Kiran Das','Neurology','T001'),
('DOC009','Dr Rahul Verma','General','T001'),
('DOC010','Dr Meera Nair','Cardiology','T001'),



-- REP002 DOCTORS

('DOC011','Dr Peter John','Cardiology','T002'),
('DOC012','Dr Joseph Mathew','Diabetes','T002'),
('DOC013','Dr Lakshmi Rao','Neurology','T002'),
('DOC014','Dr Thomas George','General','T002'),
('DOC015','Dr Anil Kumar','Cardiology','T002'),
('DOC016','Dr Deepa Raj','Diabetes','T002'),
('DOC017','Dr Sonia Paul','Neurology','T002'),
('DOC018','Dr Hari Menon','General','T002'),
('DOC019','Dr Maya Krishnan','Cardiology','T002'),
('DOC020','Dr Ravi Pillai','Diabetes','T002'),



-- REP003 DOCTORS

('DOC021','Dr Robert Lee','Cardiology','T003'),
('DOC022','Dr Susan Wong','Diabetes','T003'),
('DOC023','Dr Kevin Roy','Neurology','T003'),
('DOC024','Dr Linda Paul','General','T003'),
('DOC025','Dr Michael Das','Cardiology','T003'),
('DOC026','Dr Joseph Kim','Diabetes','T003'),
('DOC027','Dr Alan Bose','Neurology','T003'),
('DOC028','Dr Maria George','General','T003'),
('DOC029','Dr Daniel Roy','Cardiology','T003'),
('DOC030','Dr Olivia Paul','Diabetes','T003'),



-- REP004 DOCTORS

('DOC031','Dr Henry Ford','Cardiology','T004'),
('DOC032','Dr Emma Stone','Diabetes','T004'),
('DOC033','Dr William Ray','Neurology','T004'),
('DOC034','Dr Grace Lee','General','T004'),
('DOC035','Dr Charles King','Cardiology','T004'),
('DOC036','Dr Sophia Roy','Diabetes','T004'),
('DOC037','Dr James Park','Neurology','T004'),
('DOC038','Dr Helen Roy','General','T004'),
('DOC039','Dr George Smith','Cardiology','T004'),
('DOC040','Dr Anna White','Diabetes','T004'),



-- REP005 DOCTORS

('DOC041','Dr Mark Brown','Cardiology','T005'),
('DOC042','Dr Lisa Green','Diabetes','T005'),
('DOC043','Dr Paul Young','Neurology','T005'),
('DOC044','Dr Karen Hill','General','T005'),
('DOC045','Dr Steve King','Cardiology','T005'),
('DOC046','Dr Nancy Hall','Diabetes','T005'),
('DOC047','Dr Tom Clark','Neurology','T005'),
('DOC048','Dr Amy Scott','General','T005'),
('DOC049','Dr Chris Adams','Cardiology','T005'),
('DOC050','Dr Eva Moore','Diabetes','T005');



-- =====================================================
-- REPRESENTATIVE DOCTOR ASSIGNMENTS
-- =====================================================


INSERT INTO representative_doctor_assignments
(
assignment_id,
representative_id,
doctor_id,
effective_from
)
VALUES


-- REP001

('A001','REP001','DOC001','2025-01-01'),
('A002','REP001','DOC002','2025-01-01'),
('A003','REP001','DOC003','2025-01-01'),
('A004','REP001','DOC004','2025-01-01'),
('A005','REP001','DOC005','2025-01-01'),
('A006','REP001','DOC006','2025-01-01'),
('A007','REP001','DOC007','2025-01-01'),
('A008','REP001','DOC008','2025-01-01'),
('A009','REP001','DOC009','2025-01-01'),
('A010','REP001','DOC010','2025-01-01'),


-- REP002

('A011','REP002','DOC011','2025-01-01'),
('A012','REP002','DOC012','2025-01-01'),
('A013','REP002','DOC013','2025-01-01'),
('A014','REP002','DOC014','2025-01-01'),
('A015','REP002','DOC015','2025-01-01'),
('A016','REP002','DOC016','2025-01-01'),
('A017','REP002','DOC017','2025-01-01'),
('A018','REP002','DOC018','2025-01-01'),
('A019','REP002','DOC019','2025-01-01'),
('A020','REP002','DOC020','2025-01-01'),


-- REP003

('A021','REP003','DOC021','2025-01-01'),
('A022','REP003','DOC022','2025-01-01'),
('A023','REP003','DOC023','2025-01-01'),
('A024','REP003','DOC024','2025-01-01'),
('A025','REP003','DOC025','2025-01-01'),
('A026','REP003','DOC026','2025-01-01'),
('A027','REP003','DOC027','2025-01-01'),
('A028','REP003','DOC028','2025-01-01'),
('A029','REP003','DOC029','2025-01-01'),
('A030','REP003','DOC030','2025-01-01'),


-- REP004

('A031','REP004','DOC031','2025-01-01'),
('A032','REP004','DOC032','2025-01-01'),
('A033','REP004','DOC033','2025-01-01'),
('A034','REP004','DOC034','2025-01-01'),
('A035','REP004','DOC035','2025-01-01'),
('A036','REP004','DOC036','2025-01-01'),
('A037','REP004','DOC037','2025-01-01'),
('A038','REP004','DOC038','2025-01-01'),
('A039','REP004','DOC039','2025-01-01'),
('A040','REP004','DOC040','2025-01-01'),


-- REP005

('A041','REP005','DOC041','2025-01-01'),
('A042','REP005','DOC042','2025-01-01'),
('A043','REP005','DOC043','2025-01-01'),
('A044','REP005','DOC044','2025-01-01'),
('A045','REP005','DOC045','2025-01-01'),
('A046','REP005','DOC046','2025-01-01'),
('A047','REP005','DOC047','2025-01-01'),
('A048','REP005','DOC048','2025-01-01'),
('A049','REP005','DOC049','2025-01-01'),
('A050','REP005','DOC050','2025-01-01');


-- =====================================================
-- INCENTIVE AUDITOR LARGE TEST DATA
-- PART 2
--
-- Sales
-- Prescriptions
-- Incentives
-- Payouts
--
-- Date:
-- 2026-01-01 to 2026-07-31
-- =====================================================


-- =====================================================
-- SALES DATA
-- =====================================================


INSERT INTO sales
(
sale_id,
sale_date,
doctor_id,
product_id,
selling_territory_id,
quantity,
sales_amount,
status
)
VALUES


-- =====================================================
-- REP001 NORMAL HISTORY PROD001
-- =====================================================


('S001','2026-01-05','DOC001','PROD001','T001',100,10000,'Valid'),
('S002','2026-02-05','DOC001','PROD001','T001',110,11000,'Valid'),
('S003','2026-03-05','DOC001','PROD001','T001',120,12000,'Valid'),
('S004','2026-04-05','DOC001','PROD001','T001',130,13000,'Valid'),
('S005','2026-05-05','DOC001','PROD001','T001',125,12500,'Valid'),
('S006','2026-06-05','DOC001','PROD001','T001',140,14000,'Valid'),


-- JULY SPIKE

('S007','2026-07-05','DOC001','PROD001','T001',900,90000,'Valid'),



-- REP001 SECOND DOCTOR

('S008','2026-01-10','DOC002','PROD002','T001',80,8000,'Valid'),
('S009','2026-02-10','DOC002','PROD002','T001',90,9000,'Valid'),
('S010','2026-03-10','DOC002','PROD002','T001',100,10000,'Valid'),
('S011','2026-04-10','DOC002','PROD002','T001',110,11000,'Valid'),
('S012','2026-05-10','DOC002','PROD002','T001',120,12000,'Valid'),
('S013','2026-06-10','DOC002','PROD002','T001',130,13000,'Valid'),
('S014','2026-07-10','DOC002','PROD002','T001',700,70000,'Valid'),



-- =====================================================
-- REP002 NORMAL PERFORMANCE
-- =====================================================


('S015','2026-01-05','DOC011','PROD003','T002',200,20000,'Valid'),
('S016','2026-02-05','DOC011','PROD003','T002',210,21000,'Valid'),
('S017','2026-03-05','DOC011','PROD003','T002',205,20500,'Valid'),
('S018','2026-04-05','DOC011','PROD003','T002',215,21500,'Valid'),
('S019','2026-05-05','DOC011','PROD003','T002',220,22000,'Valid'),
('S020','2026-06-05','DOC011','PROD003','T002',225,22500,'Valid'),
('S021','2026-07-05','DOC011','PROD003','T002',230,23000,'Valid'),


('S022','2026-07-12','DOC012','PROD004','T002',150,15000,'Valid'),



-- =====================================================
-- REP003 CROSS TERRITORY
-- =====================================================


('S023','2026-07-01','DOC021','PROD005','T006',500,50000,'Valid'),
('S024','2026-07-02','DOC022','PROD005','T006',400,40000,'Valid'),
('S025','2026-07-03','DOC023','PROD006','T007',350,35000,'Valid'),
('S026','2026-07-04','DOC024','PROD006','T008',300,30000,'Valid'),


-- history

('S027','2026-01-05','DOC021','PROD005','T003',100,10000,'Valid'),
('S028','2026-02-05','DOC021','PROD005','T003',110,11000,'Valid'),
('S029','2026-03-05','DOC021','PROD005','T003',120,12000,'Valid'),



-- =====================================================
-- REP004 DOCTOR CONCENTRATION
-- =====================================================


-- dominant doctor

('S030','2026-07-01','DOC031','PROD007','T004',1500,150000,'Valid'),


-- other doctors low

('S031','2026-07-02','DOC032','PROD007','T004',50,5000,'Valid'),
('S032','2026-07-03','DOC033','PROD007','T004',40,4000,'Valid'),
('S033','2026-07-04','DOC034','PROD007','T004',30,3000,'Valid'),
('S034','2026-07-05','DOC035','PROD007','T004',20,2000,'Valid'),



-- =====================================================
-- REP005 CLEAN BASELINE
-- =====================================================


('S035','2026-01-05','DOC041','PROD009','T005',100,10000,'Valid'),
('S036','2026-02-05','DOC041','PROD009','T005',110,11000,'Valid'),
('S037','2026-03-05','DOC041','PROD009','T005',105,10500,'Valid'),
('S038','2026-04-05','DOC041','PROD009','T005',115,11500,'Valid'),
('S039','2026-05-05','DOC041','PROD009','T005',120,12000,'Valid'),
('S040','2026-06-05','DOC041','PROD009','T005',125,12500,'Valid'),
('S041','2026-07-05','DOC041','PROD009','T005',130,13000,'Valid');



-- =====================================================
-- PRESCRIPTIONS
-- =====================================================


INSERT INTO prescriptions
(
prescription_id,
prescription_date,
doctor_id,
product_id,
quantity,
status
)
VALUES


-- REP001 RX LOW AGAINST SALES

('RX001','2026-01-10','DOC001','PROD001',90,'Valid'),
('RX002','2026-02-10','DOC001','PROD001',95,'Valid'),
('RX003','2026-03-10','DOC001','PROD001',100,'Valid'),
('RX004','2026-04-10','DOC001','PROD001',105,'Valid'),
('RX005','2026-05-10','DOC001','PROD001',110,'Valid'),
('RX006','2026-06-10','DOC001','PROD001',120,'Valid'),

-- July sales huge but RX low

('RX007','2026-07-10','DOC001','PROD001',130,'Valid'),



-- NORMAL REP002

('RX008','2026-07-10','DOC011','PROD003',220,'Valid'),



-- REP004

('RX009','2026-07-10','DOC031','PROD007',300,'Valid');



-- =====================================================
-- INCENTIVE PROGRAM
-- =====================================================


INSERT INTO incentive_programs
(
program_id,
program_name,
effective_from
)
VALUES

(
'PG001',
'2026 Monthly Incentive Program',
'2026-01-01'
);



-- =====================================================
-- PAYOUT DATA
-- =====================================================


INSERT INTO incentive_payouts
(
payout_id,
representative_id,
product_id,
program_id,
payout_month,
sales_target,
actual_sales,
sales_achievement,
base_incentive,
achievement_multiplier,
calculated_payout,
maximum_payout,
expected_payout,
actual_payout,
payout_difference,
status
)

VALUES


-- REP001 WRONG PAYOUT

(
'PAY001',
'REP001',
'PROD001',
'PG001',
'2026-07-01',
50000,
160000,
320,
10000,
125,
10000,
15000,
10000,
30000,
20000,
'Completed'
),


-- REP002 NORMAL

(
'PAY002',
'REP002',
'PROD003',
'PG001',
'2026-07-01',
25000,
23000,
92,
5000,
100,
5000,
10000,
5000,
5000,
0,
'Completed'
),


-- REP003 VARIANCE

(
'PAY003',
'REP003',
'PROD005',
'PG001',
'2026-07-01',
50000,
90000,
180,
8000,
125,
8000,
12000,
8000,
15000,
7000,
'Completed'
),


-- REP004

(
'PAY004',
'REP004',
'PROD007',
'PG001',
'2026-07-01',
100000,
164000,
164,
12000,
125,
12000,
18000,
12000,
18000,
6000,
'Completed'
),


-- REP005 CLEAN

(
'PAY005',
'REP005',
'PROD009',
'PG001',
'2026-07-01',
15000,
13000,
86,
4000,
100,
4000,
6000,
4000,
4000,
0,
'Completed'
);



-- =====================================================
-- VALIDATION
-- =====================================================


SELECT
representative_id,
COUNT(*)
FROM incentive_payouts
GROUP BY representative_id;



SELECT
r.representative_id,
COUNT(s.sale_id) AS sales_count,
SUM(s.sales_amount) AS total_sales

FROM representatives r

JOIN representative_doctor_assignments rda
ON rda.representative_id=r.representative_id

JOIN sales s
ON s.doctor_id=rda.doctor_id

GROUP BY
r.representative_id

ORDER BY
r.representative_id;