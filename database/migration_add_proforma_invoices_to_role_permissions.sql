-- ============================================================
-- Migration: Add Proforma Invoice links to role_permissions
-- ============================================================

-- Update admin sidebar links
UPDATE public.role_permissions
SET sidebar_links = '["/dashboard", "/admin/orders", "/admin/dyeing-forms", "/admin/proforma-invoices", "/admin/approvals", "/admin/finances", "/greige-yarn", "/dyed-yarn", "/production", "/warping-sizing", "/weaving", "/inspection/four-point", "/inspection/unwashed", "/inspection/washed", "/inspection/report", "/processing", "/masters", "/admin/users"]'
WHERE role_name = 'admin';

-- Update merchandiser sidebar links
UPDATE public.role_permissions
SET sidebar_links = '["/merchandiser/orders", "/merchandiser/dyeing-forms", "/merchandiser/proforma-invoices", "/masters"]'
WHERE role_name = 'merchandiser';
