import React from 'react';
import { X, Printer } from 'lucide-react';
import PrintableDesignSpecificationsSheet from './PrintableDesignSpecificationsSheet';

export function formatYarnName(yarn) {
  if (!yarn) return '';
  if (typeof yarn === 'string') return yarn;
  return [yarn.count_value, yarn.spec, yarn.spec1].filter(Boolean).join(' ');
}

export function formatYarnFull(yarn) {
  if (!yarn) return '';
  if (typeof yarn === 'string') return yarn;
  return [yarn.count_value, yarn.spec, yarn.spec1, yarn.product_type].filter(Boolean).join(' - ');
}

export default function PrintableOrderConfirmationModal({ order, yarnCounts = [], brands = [], partners = [], onClose }) {
  if (!order) return null;

  const buyerName = brands.find(b => b.id === order.buyer_id)?.brand_name || order.master_brands?.brand_name || order.buyer_name || '—';
  const vendorName = partners.find(p => p.id === order.vendor_id)?.partner_name || order.master_partners?.partner_name || order.vendor_name || '—';
  const techSpecs = order.technical_specs || {};
  const warpSelections = techSpecs.warp_selections || [];
  const weftSelections = techSpecs.weft_selections || [];
  const yarnMappings = order.yarn_requirements || order.yarn_mappings || [];

  const hasDesignDetails = Boolean(
    techSpecs.design_details?.warp_designs?.some(wd => (wd.sequence || []).length > 0) ||
    (techSpecs.design_details?.weft_design?.sequence || []).length > 0
  );

  // Filter active mappings
  const activeMappings = yarnMappings.filter(m => {
    if (m.type === 'warp') {
      const wIdx = m.warpIdx || 0;
      return (warpSelections[wIdx] || []).includes(m.countId);
    }
    if (m.type === 'weft') {
      return (weftSelections[0] || []).includes(m.countId);
    }
    return false;
  });

  const totalYarnKg = activeMappings.reduce((sum, m) => sum + (parseFloat(m.kg) || 0), 0);
  const totalBundles = activeMappings.reduce((sum, m) => sum + (parseFloat(m.bundles) || 0), 0);
  const totalKnots = activeMappings.reduce((sum, m) => sum + (parseFloat(m.knots) || 0), 0);

  const countMap = activeMappings.reduce((acc, curr) => {
    const yc = yarnCounts.find(y => y.id === curr.countId);
    const countName = formatYarnName(yc) || curr.count_name || 'Unknown';
    if (!acc[countName]) {
      acc[countName] = { kg: 0, bundles: 0, knots: 0 };
    }
    acc[countName].kg += parseFloat(curr.kg || 0);
    acc[countName].bundles += parseFloat(curr.bundles || 0);
    acc[countName].knots += parseFloat(curr.knots || 0);
    return acc;
  }, {});

  const designImageUrl = order.design_image_url || order.design_image || '';

  const getFormattedCounts = (countIds) => {
    if (!countIds || !Array.isArray(countIds)) return '—';
    return countIds
      .map(id => formatYarnName(yarnCounts.find(y => y.id === id)))
      .filter(Boolean)
      .join(' + ') || '—';
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(3px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '860px',
        maxHeight: '94vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Screen Action Bar */}
        <div className="no-print" style={{
          position: 'sticky',
          top: 0,
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: '800', color: '#800000' }}>
              Order Confirmation:
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', fontFamily: 'monospace' }}>
              {order.order_number || 'DRAFT'}
            </span>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              color: '#800000',
              backgroundColor: '#fee2e2',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>
              {order.order_type || 'BULK'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: '#800000',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.45rem 1rem',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <Printer size={16} /> Print Confirmation ({hasDesignDetails ? '2 Pages' : '1 A4 Page'})
            </button>
            <button
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#e2e8f0',
                color: '#334155',
                border: 'none',
                borderRadius: '6px',
                padding: '0.45rem 0.75rem',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <X size={16} /> Close
            </button>
          </div>
        </div>

        {/* Printable Confirmation Sheet */}
        <div className="printable-order-sheet" style={{
          padding: '1.5rem 1.75rem',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          lineHeight: '1.3',
          minHeight: '265mm',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box'
        }}>
          {/* Print CSS */}
          <style>{`
            @media print {
              body, html, #root, .app-layout-container, .main-content-wrapper, main, .main-content {
                background: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
                height: 100% !important;
                min-height: 100% !important;
                overflow: visible !important;
                width: 100% !important;
                font-size: 9.5pt !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print, .no-print * {
                display: none !important;
              }
              @page {
                size: A4 portrait;
                margin: 8mm 10mm;
              }
              .printable-order-sheet {
                padding: 0 !important;
                width: 100% !important;
                min-height: 265mm !important;
                height: 265mm !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                box-sizing: border-box !important;
                page-break-inside: avoid !important;
              }
              .printable-order-sheet:not(.printable-design-sheet) {
                ${hasDesignDetails ? 'page-break-after: always !important; break-after: page !important;' : 'page-break-after: avoid !important;'}
              }
              .printable-design-sheet {
                page-break-before: always !important;
                break-before: page !important;
                page-break-inside: avoid !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
                page-break-inside: avoid !important;
              }
              th, td {
                border: 1px solid #334155 !important;
                padding: 5.5px 8px !important;
                font-size: 9pt !important;
                line-height: 1.25 !important;
                color: #000000 !important;
              }
              th {
                background-color: #f1f5f9 !important;
                font-weight: 700 !important;
                color: #000000 !important;
              }
            }
          `}</style>

          {/* TOP SECTION: Header, Specs & Yarn Breakdown */}
          <div>
            {/* 1. COMPANY HEADER & ORDER TITLE */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '3px solid #800000',
              paddingBottom: '0.75rem',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <img
                  src="/logo.png"
                  alt="Ashok Textiles"
                  style={{ maxHeight: '56px', maxWidth: '150px', objectFit: 'contain' }}
                  onError={e => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div style={{
                  display: 'none',
                  width: '46px',
                  height: '46px',
                  backgroundColor: '#800000',
                  borderRadius: '6px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: '900',
                  fontSize: '1.15rem'
                }}>
                  AT
                </div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#800000', letterSpacing: '-0.3px', lineHeight: '1.15' }}>
                    ASHOK TEXTILES
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: '1.3', marginTop: '2px' }}>
                    6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#0f172a', marginTop: '1px' }}>
                    GSTIN: 33AAZFA60686D1Z6
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1.15' }}>
                  ORDER CONFIRMATION
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: '800', fontFamily: 'monospace', color: '#0f172a', marginTop: '3px' }}>
                  {order.order_number || 'DRAFT'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px' }}>
                  Date: <strong style={{ color: '#0f172a' }}>{order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong> | Type: <span style={{ fontWeight: '800', textTransform: 'uppercase', color: '#800000', backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fecaca' }}>{order.order_type || 'BULK'}</span>
                </div>
              </div>
            </div>

            {/* 2. ORDER & TECHNICAL SPECIFICATIONS TABLE */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: '800',
                color: '#800000',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '5px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Order & Fabric Technical Specifications</span>
                <span style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'none', fontWeight: 'normal' }}>
                  Merchandiser: <strong style={{ color: '#0f172a' }}>{order.merchandiser_name || '—'}</strong>
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '0.82rem' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '5.5px 8px', fontWeight: '700', backgroundColor: '#f8fafc', width: '16%', border: '1px solid #94a3b8', color: '#334155' }}>Buyer</td>
                    <td style={{ padding: '5.5px 8px', width: '34%', border: '1px solid #94a3b8', fontWeight: '700', color: '#0f172a' }}>{buyerName}</td>
                    <td style={{ padding: '5.5px 8px', fontWeight: '700', backgroundColor: '#f8fafc', width: '16%', border: '1px solid #94a3b8', color: '#334155' }}>Vendor / Unit</td>
                    <td style={{ padding: '5.5px 8px', width: '34%', border: '1px solid #94a3b8', color: '#0f172a' }}>{vendorName}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '5.5px 8px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Design No & Name</td>
                    <td style={{ padding: '5.5px 8px', border: '1px solid #94a3b8', fontWeight: '600' }}>{order.design_no || '—'} {order.design_name ? `(${order.design_name})` : ''}</td>
                    <td style={{ padding: '5.5px 8px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Season / Category</td>
                    <td style={{ padding: '5.5px 8px', border: '1px solid #94a3b8' }}>{order.season || '—'} {techSpecs.order_category ? `• ${techSpecs.order_category}` : ''}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '5.5px 8px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Order Reed / Pick</td>
                    <td style={{ padding: '5.5px 8px', border: '1px solid #94a3b8' }}><strong>{techSpecs.order_reed || '—'}</strong> / <strong>{techSpecs.order_pick || '—'}</strong></td>
                    <td style={{ padding: '5.5px 8px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Loom Reed / Pick</td>
                    <td style={{ padding: '5.5px 8px', border: '1px solid #94a3b8' }}>{techSpecs.on_loom_reed || '—'} / {techSpecs.on_loom_pick || '—'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '5.5px 8px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Warp Counts</td>
                    <td style={{ padding: '5.5px 8px', border: '1px solid #94a3b8', color: '#0369a1', fontWeight: '700' }}>
                      {warpSelections.length > 0 ? (
                        warpSelections.map((w, idx) => (
                          <div key={idx}>{techSpecs.num_warps > 1 ? `W${idx + 1}: ` : ''}{getFormattedCounts(w)}</div>
                        ))
                      ) : '—'}
                    </td>
                    <td style={{ padding: '5.5px 8px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Weft Counts</td>
                    <td style={{ padding: '5.5px 8px', border: '1px solid #94a3b8', color: '#92400e', fontWeight: '700' }}>
                      {getFormattedCounts(weftSelections[0] || []) || '—'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '5.5px 8px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Finished / Order Width</td>
                    <td style={{ padding: '5.5px 8px', border: '1px solid #94a3b8' }}>{techSpecs.finished_width || '—'} / {techSpecs.order_width || '—'}</td>
                    <td style={{ padding: '5.5px 8px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Weave / GSM</td>
                    <td style={{ padding: '5.5px 8px', border: '1px solid #94a3b8' }}>{techSpecs.weave_type || '—'} {techSpecs.gsm ? `• ${techSpecs.gsm} GSM` : ''}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '5.5px 8px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Order Qty / Prod Qty</td>
                    <td style={{ padding: '5.5px 8px', border: '1px solid #94a3b8' }}>
                      <strong style={{ color: '#800000', fontSize: '0.88rem' }}>{order.total_quantity ? `${Number(order.total_quantity).toLocaleString()} Mtrs` : '0 Mtrs'}</strong>
                      {techSpecs.production_quantity ? ` (Prod: ${Number(techSpecs.production_quantity).toLocaleString()} Mtrs)` : ''}
                    </td>
                    <td style={{ padding: '5.5px 8px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>FOB / Dispatch Date</td>
                    <td style={{ padding: '5.5px 8px', border: '1px solid #94a3b8' }}>{order.fob_date || '—'} {order.dispatch_date ? ` / ${order.dispatch_date}` : ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 3. FULL-WIDTH YARN REQUIREMENT (COLOR WISE) */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.86rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Yarn Requirement (Color Wise)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '0.82rem', boxSizing: 'border-box' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <th style={{ padding: '5px 8px', textAlign: 'left', border: '1px solid #94a3b8', width: '14%' }}>Position</th>
                    <th style={{ padding: '5px 8px', textAlign: 'left', border: '1px solid #94a3b8', width: '38%' }}>Count & Spec</th>
                    <th style={{ padding: '5px 8px', textAlign: 'left', border: '1px solid #94a3b8', width: '22%' }}>Color / Shade</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #94a3b8', width: '13%' }}>Bundles & Knots</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #94a3b8', width: '13%' }}>Req (KG)</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMappings.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '8px', textAlign: 'center', color: '#64748b', border: '1px solid #94a3b8' }}>No yarn requirements specified.</td>
                    </tr>
                  ) : (
                    activeMappings.map((m, i) => {
                      const yc = yarnCounts.find(y => y.id === m.countId);
                      const hasBdlKnt = (m.bundles || m.knots) && (parseFloat(m.bundles || 0) > 0 || parseFloat(m.knots || 0) > 0);
                      return (
                        <tr key={i}>
                          <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8', textTransform: 'capitalize', fontWeight: '600' }}>
                            {m.type === 'warp' ? `Warp ${techSpecs.num_warps > 1 ? ((m.warpIdx || 0) + 1) : ''}` : 'Weft'}
                          </td>
                          <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8' }}>{formatYarnName(yc) || m.count_name || '—'}</td>
                          <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8', fontWeight: '700' }}>{m.color || '—'}</td>
                          <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontSize: '0.78rem', color: '#475569' }}>
                            {hasBdlKnt ? `${m.bundles || 0}b ${m.knots || 0}k` : '—'}
                          </td>
                          <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                            {parseFloat(m.kg || 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {activeMappings.length > 0 && (
                    <tr style={{ backgroundColor: '#f8fafc', fontWeight: '800' }}>
                      <td colSpan="3" style={{ padding: '5px 8px', border: '1px solid #94a3b8', textAlign: 'right' }}>Total Warp + Weft:</td>
                      <td style={{ padding: '5px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontSize: '0.8rem' }}>
                        {totalBundles > 0 || totalKnots > 0 ? `${totalBundles}b ${totalKnots}k` : ''}
                      </td>
                      <td style={{ padding: '5px 8px', border: '1px solid #94a3b8', textAlign: 'right', color: '#800000', fontSize: '0.88rem' }}>
                        {Math.round(totalYarnKg)} kg
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 4. COUNT WISE SUMMARY & OPTIONAL DESIGN THUMBNAIL (BELOW) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: designImageUrl ? '1fr 200px' : '1fr',
              gap: '0.75rem',
              alignItems: 'start',
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: '0.85rem'
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Count Wise Summary
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '0.82rem', boxSizing: 'border-box' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                      <th style={{ padding: '5px 8px', textAlign: 'left', border: '1px solid #94a3b8', width: '50%' }}>Yarn Description</th>
                      <th style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #94a3b8', width: '25%' }}>Bundles & Knots</th>
                      <th style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #94a3b8', width: '25%' }}>Total Weight (KG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(countMap).map(([count, totals], i) => (
                      <tr key={i}>
                        <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8', fontWeight: '600' }}>{count}</td>
                        <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontSize: '0.78rem', color: '#475569' }}>
                          {totals.bundles > 0 || totals.knots > 0 ? `${totals.bundles}b ${totals.knots}k` : '—'}
                        </td>
                        <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontWeight: '700', color: '#800000' }}>
                          {Math.round(totals.kg)} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Design Image Thumbnail */}
              {designImageUrl && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '6px 8px',
                  border: '1px solid #94a3b8',
                  borderRadius: '6px',
                  backgroundColor: '#f8fafc',
                  boxSizing: 'border-box'
                }}>
                  <img 
                    src={designImageUrl} 
                    alt="Design Preview" 
                    style={{ width: '55px', height: '55px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} 
                  />
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0f172a' }}>Fabric Pattern Sample</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Design attached to order</div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. MANUFACTURING GUIDELINES & QUALITY STANDARDS */}
            <div style={{
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '7px 10px',
              backgroundColor: '#fcfcfd',
              marginBottom: '0.85rem'
            }}>
              <div style={{ fontSize: '0.76rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                Standard Quality & Production Instructions
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '0.72rem', color: '#475569', lineHeight: '1.3' }}>
                <div>• Fabric width tolerance: ±0.5" | GSM tolerance: ±5%</div>
                <div>• Pre-production shade matching required before dyeing</div>
                <div>• Ashok Textiles 4-Point Greige Quality Standard applicable</div>
                <div>• Dispatch strictly adhering to agreed FOB/Delivery schedule</div>
              </div>
            </div>
          </div>

          {/* 5. FOOTER & SIGNATURES (Anchored cleanly at bottom of A4 page) */}
          <div style={{
            marginTop: 'auto',
            paddingTop: '0.85rem',
            borderTop: '1.5px solid #94a3b8',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingBottom: '0.25rem'
          }}>
            <div style={{ textAlign: 'center', width: '180px' }}>
              <div style={{ borderBottom: '1.5px solid #0f172a', height: '45px', marginBottom: '5px' }}></div>
              <div style={{ fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a' }}>
                Prepared By
              </div>
              <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '2px' }}>
                {order.merchandiser_name || 'Merchandiser'}
              </div>
            </div>

            <div style={{ textAlign: 'center', width: '180px' }}>
              <div style={{ borderBottom: '1.5px solid #0f172a', height: '45px', marginBottom: '5px' }}></div>
              <div style={{ fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a' }}>
                Authorized Signatory
              </div>
              <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '2px' }}>
                Ashok Textiles
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '0.68rem', color: '#94a3b8', marginTop: '6px' }}>
            Ashok Textiles ERP • System Generated Order Confirmation • {new Date().toLocaleDateString('en-IN')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>

        </div>

        {/* Visual Page 2 Divider on Screen */}
        {hasDesignDetails && (
          <div className="no-print" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            margin: '2rem 1.75rem 1rem 1.75rem',
            color: '#64748b'
          }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#cbd5e1' }} />
            <span style={{
              fontSize: '0.82rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              backgroundColor: '#f1f5f9',
              padding: '4px 14px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              color: '#800000',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              📄 Page 2 of 2: Weaving Design Specifications & Pattern Breakdown
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#cbd5e1' }} />
          </div>
        )}

        {/* Page 2: Design Specifications & Weaving Pattern Breakdown */}
        {hasDesignDetails && (
          <div style={{ padding: '0 1.75rem 1.5rem 1.75rem' }}>
            <PrintableDesignSpecificationsSheet
              order={order}
              yarnCounts={yarnCounts}
              formatCountFn={id => formatYarnName(yarnCounts.find(y => y.id === id))}
            />
          </div>
        )}

      </div>
    </div>
  );
}
