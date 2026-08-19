-- =====================================================
-- CLEAR ALL INCENTIVE AUDITOR DATA
-- =====================================================

BEGIN;


TRUNCATE TABLE
    incentive_payouts,

    product_incentive_rates,

    sales_targets,

    sales,

    prescriptions,

    representative_doctor_assignments,

    incentive_tiers,

    incentive_programs,

    doctors,

    products,

    representatives,

    territories

RESTART IDENTITY
CASCADE;


COMMIT;


-- =====================================================
-- VERIFY EMPTY
-- =====================================================

SELECT 'territories' AS table_name, COUNT(*) FROM territories
UNION ALL

SELECT 'representatives', COUNT(*) FROM representatives
UNION ALL

SELECT 'products', COUNT(*) FROM products
UNION ALL

SELECT 'doctors', COUNT(*) FROM doctors
UNION ALL

SELECT 'sales', COUNT(*) FROM sales
UNION ALL

SELECT 'prescriptions', COUNT(*) FROM prescriptions
UNION ALL

SELECT 'incentive_payouts', COUNT(*) FROM incentive_payouts;