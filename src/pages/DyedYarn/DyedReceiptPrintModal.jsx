import React from 'react';
import { X, Printer } from 'lucide-react';

export default function DyedReceiptPrintModal({ receipt, onClose }) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const receiptNumber = receipt.receiptNumber || receipt.dyrr_number || receipt.receipt_no || '—';
  
  const formatDate = (dateVal) => {
    if (!dateVal) return '—';
    try {
      return new Date(dateVal).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return String(dateVal);
    }
  };

  const formatTime = (dateVal) => {
    if (!dateVal) return '';
    try {
      return new Date(dateVal).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const receiptDate = formatDate(receipt.date || receipt.received_date || receipt.created_at);
  const receiptTime = formatTime(receipt.created_at || receipt.date || receipt.received_date);

  const isProd = receipt.source === 'production' || receipt.source_type === 'production' || receipt.source_type === 'production_return';
  const sourceTypeLabel = isProd ? 'Production Return' : 'Partner Receipt';
  const partnerName = receipt.partner_name || receipt.dyeing_unit?.partner_name || receipt.partnerName || (isProd ? 'In-House' : 'N/A');
  const dofNo = receipt.dof_number || receipt.dofNo || receipt.dof?.dof_number || '—';
  const dcNo = receipt.logistics?.dc_number || receipt.dc_number || receipt.delivery_challan_no || '—';
  const vehicleNo = receipt.logistics?.vehicle_no || receipt.vehicle_no || '—';
  const receivedBy = receipt.logistics?.received_by || receipt.received_by || '—';
  const remarks = receipt.remarks || receipt.logistics?.remarks || '';

  const items = receipt.items || [];
  const totalWeight = items.reduce((sum, it) => sum + Number(it.weight ?? it.quantity_kg ?? 0), 0);

  const renderReceiptCopy = (copyType, copyBadge) => (
    <div className="dyrr-single-copy" style={{
      padding: '0.85rem 1.25rem',
      backgroundColor: '#fff',
      color: '#000',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative'
    }}>
      {/* Top Header Row */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '2px solid #7f1d1d',
          paddingBottom: '0.45rem',
          marginBottom: '0.5rem'
        }}>
          {/* Company Brand & Details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img 
              src="/logo.png" 
              alt="Ashok Textiles" 
              style={{ 
                height: '38px', 
                objectFit: 'contain'
              }} 
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div>
              <div style={{ 
                fontSize: '1.2rem', 
                fontWeight: '900', 
                letterSpacing: '0.5px', 
                margin: 0, 
                color: '#1a1a1a', 
                lineHeight: '1.1' 
              }}>
                ASHOK TEXTILES
              </div>
              <div style={{ fontSize: '0.68rem', color: '#4b5563', fontWeight: '500', marginTop: '1px', lineHeight: '1.2' }}>
                6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33
              </div>
              <div style={{ fontSize: '0.68rem', color: '#111827', fontWeight: '700', marginTop: '1px' }}>
                GSTIN: <span style={{ fontFamily: 'monospace' }}>33AAZFA60686D1Z6</span>
              </div>
            </div>
          </div>

          {/* Title & Copy Badge */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ 
              fontSize: '0.85rem', 
              color: '#7f1d1d', 
              fontWeight: '900', 
              letterSpacing: '0.5px', 
              textTransform: 'uppercase' 
            }}>
              DYED YARN RECEIPT (DYRR)
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.4rem', marginTop: '2px' }}>
              <span style={{
                fontSize: '0.62rem',
                fontWeight: '800',
                padding: '1px 6px',
                borderRadius: '3px',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                border: '1px solid #fecaca',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {copyBadge}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#374151', marginTop: '2px', fontWeight: '600' }}>
              Receipt: <strong style={{ color: '#7f1d1d', fontFamily: 'monospace', fontSize: '0.8rem' }}>{receiptNumber}</strong>
            </div>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.5rem',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '0.45rem 0.65rem',
          marginBottom: '0.5rem',
          fontSize: '0.7rem'
        }}>
          <div>
            <div style={metaLabelStyle}>RECEIPT INFO</div>
            <div style={metaValStyle}><strong>Date:</strong> {receiptDate}</div>
            {receiptTime && <div style={metaValStyle}><strong>Time:</strong> {receiptTime}</div>}
          </div>
          <div>
            <div style={metaLabelStyle}>SOURCE DETAILS</div>
            <div style={metaValStyle}><strong>Type:</strong> <span style={{ textTransform: 'capitalize', fontWeight: '600' }}>{sourceTypeLabel}</span></div>
            <div style={metaValStyle} title={partnerName}><strong>Partner:</strong> {partnerName}</div>
          </div>
          <div>
            <div style={metaLabelStyle}>REFERENCES</div>
            <div style={metaValStyle}><strong>Ref DOF:</strong> <span style={{ fontWeight: '700', color: '#7f1d1d' }}>{dofNo}</span></div>
            <div style={metaValStyle}><strong>DC No:</strong> {dcNo}</div>
          </div>
          <div>
            <div style={metaLabelStyle}>LOGISTICS</div>
            <div style={metaValStyle}><strong>Vehicle:</strong> {vehicleNo}</div>
            <div style={metaValStyle}><strong>Received By:</strong> {receivedBy}</div>
          </div>
        </div>

        {/* Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.4rem', fontSize: '0.72rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', borderTop: '1.5px solid #334155', borderBottom: '1.5px solid #334155' }}>
              <th style={{ ...compactThStyle, width: '4%', textAlign: 'center' }}>#</th>
              <th style={{ ...compactThStyle, width: '22%' }}>Order / Design</th>
              <th style={{ ...compactThStyle, width: '24%' }}>Yarn Description</th>
              <th style={{ ...compactThStyle, width: '13%' }}>Colour</th>
              <th style={{ ...compactThStyle, width: '9%', textAlign: 'center' }}>Type</th>
              <th style={{ ...compactThStyle, width: '10%', textAlign: 'center' }}>Lot No</th>
              <th style={{ ...compactThStyle, width: '8%' }}>Location</th>
              <th style={{ ...compactThStyle, width: '10%', textAlign: 'right' }}>Qty (kg)</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ ...compactTdStyle, textAlign: 'center', color: '#6b7280', padding: '0.5rem' }}>
                  No yarn items found in receipt.
                </td>
              </tr>
            ) : (
              items.map((it, i) => {
                const orderNum = it.orderNo || it.orders?.order_number || it.order_number || '—';
                const designNum = it.design || (it.orders ? [it.orders.design_no, it.orders.design_name].filter(Boolean).join(' / ') : '') || '—';
                const yarnCount = it.master_yarn_counts
                  ? [it.master_yarn_counts.count_value, it.master_yarn_counts.spec, it.master_yarn_counts.spec1, it.master_yarn_counts.product_type].filter(Boolean).join(' ')
                  : (it.yarn_count
                    ? [it.yarn_count.count_value, it.yarn_count.spec, it.yarn_count.spec1, it.yarn_count.product_type].filter(Boolean).join(' ')
                    : (it.count || '—'));
                const colour = it.colour || it.color || '—';
                const yarnType = it.type || it.yarn_type || '—';
                const lotNo = it.lot_number || it.lot_no || '—';
                const locationName = typeof it.location === 'object' 
                  ? it.location?.location_name 
                  : (it.location || it.master_locations?.location_name || '—');
                const qtyKg = Number(it.weight ?? it.quantity_kg ?? 0).toFixed(2);

                return (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ ...compactTdStyle, textAlign: 'center', color: '#64748b', fontSize: '0.65rem' }}>{i + 1}</td>
                    <td style={compactTdStyle}>
                      <div style={{ fontWeight: '800', color: '#0f172a' }}>{orderNum}</div>
                      <div style={{ fontSize: '0.62rem', color: '#64748b', lineHeight: '1.1' }}>{designNum}</div>
                    </td>
                    <td style={{ ...compactTdStyle, fontWeight: '600', color: '#1e293b' }}>
                      {yarnCount}
                    </td>
                    <td style={{ ...compactTdStyle, fontWeight: '700', color: '#7f1d1d', textTransform: 'uppercase' }}>
                      {colour}
                    </td>
                    <td style={{ ...compactTdStyle, textAlign: 'center' }}>
                      <span style={{ 
                        padding: '1px 5px', 
                        borderRadius: '3px', 
                        fontSize: '0.62rem', 
                        fontWeight: '800', 
                        backgroundColor: yarnType.toLowerCase() === 'warp' ? '#eff6ff' : '#ecfdf5',
                        color: yarnType.toLowerCase() === 'warp' ? '#1e40af' : '#047857',
                        border: `1px solid ${yarnType.toLowerCase() === 'warp' ? '#bfdbfe' : '#a7f3d0'}`,
                        textTransform: 'uppercase'
                      }}>
                        {yarnType}
                      </span>
                    </td>
                    <td style={{ ...compactTdStyle, textAlign: 'center', fontWeight: '700', fontFamily: 'monospace' }}>
                      {lotNo}
                    </td>
                    <td style={{ ...compactTdStyle, color: '#334155' }}>
                      {locationName}
                    </td>
                    <td style={{ ...compactTdStyle, textAlign: 'right', fontWeight: '900', color: '#0f172a', fontSize: '0.78rem' }}>
                      {qtyKg}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f8fafc', borderTop: '1.5px solid #334155' }}>
              <td colSpan="6" style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: '800', color: '#334155', fontSize: '0.72rem' }}>
                TOTAL RECEIVED WEIGHT:
              </td>
              <td colSpan="2" style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: '900', fontSize: '0.9rem', color: '#0f172a', borderBottom: '3px double #0f172a' }}>
                {totalWeight.toFixed(2)} <span style={{ fontSize: '0.72rem', fontWeight: '700' }}>kg</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer / Signatures Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingTop: '0.4rem',
        marginTop: '0.2rem',
        borderTop: '1px solid #e2e8f0',
        fontSize: '0.68rem'
      }}>
        {/* Left: Receiver Sign */}
        <div style={{ minWidth: '160px', textAlign: 'left' }}>
          <div style={{ color: '#64748b', fontSize: '0.62rem', marginBottom: '1.25rem' }}>
            Material Received & Verified By: <strong>{receivedBy !== '—' ? receivedBy : ''}</strong>
          </div>
          <div style={{ borderTop: '1.5px dashed #475569', paddingTop: '2px', fontWeight: '700', color: '#1e293b' }}>
            Receiver / Driver Signature
          </div>
        </div>

        {/* Center: Remarks if available */}
        {remarks ? (
          <div style={{ maxWidth: '220px', textAlign: 'center', color: '#4b5563', fontSize: '0.62rem', fontStyle: 'italic' }}>
            <strong>Remarks:</strong> {remarks}
          </div>
        ) : <div />}

        {/* Right: Company Signature */}
        <div style={{ minWidth: '180px', textAlign: 'right' }}>
          <div style={{ fontWeight: '800', color: '#1a1a1a', marginBottom: '1.25rem', fontSize: '0.72rem' }}>
            For ASHOK TEXTILES
          </div>
          <div style={{ borderTop: '1.5px solid #1a1a1a', paddingTop: '2px', fontWeight: '700', color: '#1e293b', textAlign: 'center' }}>
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="print-overlay" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2500,
      padding: '1rem'
    }}>
      <div 
        className="print-modal-container"
        style={{
          backgroundColor: '#fff',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '96vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Top Control Bar (Hidden on Print) */}
        <div className="no-print" style={{ 
          padding: '0.85rem 1.5rem', 
          borderBottom: '1px solid #e2e8f0', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: '10px',
          borderTopRightRadius: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>
              Dyed Yarn Receipt: {receiptNumber}
            </h2>
            <span style={{
              fontSize: '0.7rem',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: '700'
            }}>
              2 Copies / A4 Sheet
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button 
              onClick={handlePrint} 
              className="btn btn-primary" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                padding: '0.45rem 1rem', 
                backgroundColor: '#7f1d1d',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              <Printer size={16} /> Print 2 Copies (A4)
            </button>
            <button 
              onClick={onClose} 
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable 2-Copies Container */}
        <div id="printable-dyrr" className="printable-content" style={{ backgroundColor: '#fff' }}>
          
          {/* Top Half: Original Copy */}
          {renderReceiptCopy('original', 'Original / Office Copy')}

          {/* Divider between copies */}
          <div className="print-divider" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 1.25rem',
            color: '#64748b',
            fontSize: '0.65rem',
            fontWeight: '700',
            letterSpacing: '1px',
            userSelect: 'none'
          }}>
            <div style={{ flex: 1, borderBottom: '1.5px dashed #94a3b8' }} />
            <span style={{ padding: '0 10px', display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
              ✂ CUT HERE ✂
            </span>
            <div style={{ flex: 1, borderBottom: '1.5px dashed #94a3b8' }} />
          </div>

          {/* Bottom Half: Duplicate Copy */}
          {renderReceiptCopy('duplicate', 'Duplicate / Mill Copy')}

        </div>
      </div>
      
      <style>{`
        @media screen {
          .dyrr-single-copy {
            border: 1px solid #e2e8f0;
            margin: 0.5rem 1rem;
            border-radius: 6px;
          }
        }
        @media print {
          @page { 
            size: A4 portrait;
            margin: 5mm 8mm; 
          }
          html, body, #root, .app-layout-container, .main-content-wrapper, .main-content {
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          body * {
            visibility: hidden !important;
          }
          .print-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            background: transparent !important;
          }
          .print-modal-container, .print-modal-container * {
            visibility: visible !important;
          }
          .print-modal-container {
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .printable-content {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: 282mm !important;
            display: flex !important;
            flex-direction: column !important;
            justifyContent: space-between !important;
            box-sizing: border-box !important;
          }
          .dyrr-single-copy {
            height: 136mm !important;
            max-height: 136mm !important;
            padding: 2mm 3mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            border: none !important;
            margin: 0 !important;
          }
          .print-divider {
            height: 5mm !important;
            margin: 0 !important;
            padding: 0 3mm !important;
          }
        }
      `}</style>
    </div>
  );
}

const metaLabelStyle = {
  fontSize: '0.58rem',
  fontWeight: '900',
  color: '#64748b',
  letterSpacing: '0.5px',
  marginBottom: '2px',
  textTransform: 'uppercase'
};

const metaValStyle = {
  fontSize: '0.68rem',
  color: '#0f172a',
  lineHeight: '1.3'
};

const compactThStyle = {
  padding: '3px 5px',
  textAlign: 'left',
  fontSize: '0.64rem',
  textTransform: 'uppercase',
  fontWeight: '800',
  color: '#1e293b',
  borderBottom: '1.5px solid #cbd5e1'
};

const compactTdStyle = {
  padding: '3px 5px',
  fontSize: '0.7rem',
  color: '#1e293b',
  verticalAlign: 'middle',
  lineHeight: '1.2'
};
