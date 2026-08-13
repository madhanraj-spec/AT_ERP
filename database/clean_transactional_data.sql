-- Clean Transactional Data from ERP Database (Safe Execution)
-- This script checks table existence before truncating, preventing relation 42P01 errors.
--
-- Master data (Partners, Machines, Brands, Yarn Counts, Departments, Beams, Workers, Profiles, Roles) WILL BE PRESERVED.

DO $$
DECLARE
    tbl text;
    tbls text[] := ARRAY[
      'dispatch_package_slips',
      'dispatch_bills',
      'proforma_invoices',
      'production_finance_bills',
      'processing_finance_bills',
      'dof_bills',
      'fabric_inspection_reports',
      'fabric_movements',
      'fabric_stock_inventory',
      'fabric_stock_orders',
      'processing_reprocess_orders',
      'processing_orders',
      'weaving_orders',
      'sizing_order_forms',
      'warping_order_forms',
      'warping_orders',
      'dyeing_order_forms',
      'dyed_yarn_delivery_items',
      'dyed_yarn_deliveries',
      'dyed_yarn_receipt_items',
      'dyed_yarn_receipts',
      'greige_yarn_delivery_items',
      'greige_yarn_delivery_receipts',
      'greige_yarn_receipts',
      'inspections',
      'production_jobs',
      'production_forms',
      'inventory_items',
      'orders'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbls LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            EXECUTE 'TRUNCATE TABLE public.' || quote_ident(tbl) || ' RESTART IDENTITY CASCADE;';
            RAISE NOTICE 'Truncated table: public.%', tbl;
        END IF;
    END LOOP;
END $$;

-- Verification query: check remaining row counts for tables that exist in the database
DO $$
DECLARE
    rec RECORD;
    cnt bigint;
BEGIN
    FOR rec IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
          'orders', 'greige_yarn_receipts', 'greige_yarn_delivery_receipts',
          'dyeing_order_forms', 'dof_bills', 'dyed_yarn_receipts', 'dyed_yarn_deliveries',
          'warping_order_forms', 'sizing_order_forms', 'weaving_orders',
          'production_finance_bills', 'processing_orders', 'processing_finance_bills',
          'fabric_stock_inventory', 'fabric_inspection_reports', 'dispatch_package_slips',
          'dispatch_bills', 'proforma_invoices'
        )
        ORDER BY table_name
    LOOP
        EXECUTE format('SELECT count(*) FROM public.%I', rec.table_name) INTO cnt;
        RAISE NOTICE 'Table public.%: % rows remaining', rec.table_name, cnt;
    END LOOP;
END $$;
