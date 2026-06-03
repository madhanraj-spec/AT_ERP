import React from 'react';
import { X, Printer } from 'lucide-react';

export default function DyedReceiptPrintModal({ receipt, onClose }) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    }}>
      <div 
        className="print-modal-container"
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '95vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header (Hidden on Print) */}
        <div className="no-print" style={{ 
          padding: '1.25rem 2rem', 
          borderBottom: '1px solid #eee', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#1e293b' }}>
              Dyed Yarn Receipt: {receipt.receiptNumber || receipt.dyrr_number}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={handlePrint} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', backgroundColor: '#7f1d1d' }}>
              <Printer size={18} /> Print Invoice
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div id="printable-dyrr" style={{ padding: '3.5rem', color: '#000', backgroundColor: '#fff', minHeight: '100%' }}>
          
          {/* Company Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', borderBottom: '3px solid #7f1d1d', paddingBottom: '1.5rem' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
               <img 
                 src="/logo.png" 
                 alt="Ashok Textiles" 
                 style={{ 
                   height: '64px', 
                   objectFit: 'contain'
                 }} 
               />
               <div>
                 <div style={{ fontSize: '2.5rem', fontWeight: '900', letterSpacing: '1px', margin: 0, color: '#1a1a1a', lineHeight: '1.1' }}>ASHOK TEXTILES</div>
                 <div style={{ fontSize: '0.875rem', color: '#7f1d1d', fontWeight: '700', marginTop: '0.25rem', letterSpacing: '2px', textTransform: 'uppercase' }}>Dyed Yarn Material Receipt</div>
               </div>
             </div>
          </div>

          {/* Document Header Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
            <div style={infoBoxStyle}>
              <div style={infoLabelStyle}>RECEIPT INFORMATION</div>
              <div style={{ ...dataLineStyle, color: '#7f1d1d', fontWeight: '900', fontSize: '1.1rem' }}>{receipt.receiptNumber || receipt.dyrr_number}</div>
              <div style={dataLineStyle}><strong>Date:</strong> {receipt.date || new Date(receipt.created_at).toLocaleDateString()}</div>
              <div style={dataLineStyle}><strong>Time:</strong> {new Date(receipt.created_at).toLocaleTimeString()}</div>
            </div>
            
            <div style={infoBoxStyle}>
              <div style={infoLabelStyle}>SOURCE DETAILS</div>
              <div style={dataLineStyle}><strong>Type:</strong> <span style={{ textTransform: 'uppercase', fontWeight: '700' }}>{receipt.source === 'production' || receipt.source_type === 'production_return' ? 'Production Return' : 'Partner Receipt'}</span></div>
              <div style={dataLineStyle}><strong>Partner:</strong> {receipt.partner_name || receipt.dyeing_unit?.partner_name || 'N/A'}</div>
              <div style={dataLineStyle}><strong>Ref DOF:</strong> {receipt.dof_number}</div>
            </div>

            <div style={{ ...infoBoxStyle, backgroundColor: '#fcfcfc', border: '1px solid #7f1d1d' }}>
              <div style={{ ...infoLabelStyle, color: '#7f1d1d' }}>LOGISTICS & TRACKING</div>
              <div style={dataLineStyle}><strong>DC No:</strong> {receipt.logistics?.dc_number || receipt.dc_number || 'N/A'}</div>
              <div style={dataLineStyle}><strong>Vehicle:</strong> {receipt.logistics?.vehicle_no || receipt.vehicle_no || 'N/A'}</div>
              <div style={dataLineStyle}><strong>Receiver:</strong> {receipt.logistics?.received_by || receipt.received_by || 'N/A'}</div>
            </div>
          </div>

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '3rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderTop: '2px solid #1a1a1a', borderBottom: '2px solid #1a1a1a' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Order / Design</th>
                <th style={thStyle}>Yarn Description</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Type</th>
                <th style={thStyle}>Location</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Quantity (kg)</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((it, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ ...tdStyle, color: '#6b7280', fontSize: '0.75rem' }}>{String(i + 1).padStart(2, '0')}</td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: '900', color: '#111827', fontSize: '1rem' }}>{it.orderNo || it.orders?.order_number || '-'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>{it.design || (it.orders ? `${it.orders.design_no} / ${it.orders.design_name}` : '-')}</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: '700', color: '#111827' }}>{it.count || it.master_yarn_counts?.count_value}</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '900', color: '#7f1d1d' }}>{it.colour}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ 
                      padding: '0.25rem 0.6rem', 
                      borderRadius: '6px', 
                      fontSize: '0.75rem', 
                      fontWeight: '900', 
                      backgroundColor: (it.type || it.yarn_type) === 'warp' ? '#eff6ff' : '#ecfdf5',
                      color: (it.type || it.yarn_type) === 'warp' ? '#1e40af' : '#047857',
                      border: `1px solid ${(it.type || it.yarn_type) === 'warp' ? '#bfdbfe' : '#a7f3d0'}`,
                      textTransform: 'uppercase'
                    }}>
                      {it.type || it.yarn_type || '-'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: '600' }}>{it.location || it.master_locations?.location_name || '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '900', fontSize: '1.25rem', color: '#111827' }}>
                    {Number(it.weight ?? it.quantity_kg ?? 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="5" style={{ padding: '2.5rem 1rem', textAlign: 'right', fontWeight: '900', color: '#4b5563', fontSize: '1rem' }}>GRAND TOTAL RECEIVED WEIGHT:</td>
                <td style={{ padding: '2.5rem 1rem', textAlign: 'right', fontWeight: '900', fontSize: '2.25rem', borderBottom: '6px double #1a1a1a', color: '#111827' }}>
                  {receipt.items.reduce((sum, it) => sum + Number(it.weight ?? it.quantity_kg ?? 0), 0).toFixed(2)} <span style={{ fontSize: '1.1rem' }}>kg</span>
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Terms and Signatures */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '4rem', marginTop: '2rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#4b5563', lineHeight: '1.8', backgroundColor: '#f9fafb', padding: '1.5rem', borderRadius: '12px', border: '1px dashed #d1d5db' }}>
              <div style={{ fontWeight: '900', color: '#1a1a1a', marginBottom: '0.75rem', fontSize: '0.9rem', letterSpacing: '0.5px' }}>DOCUMENTS & TERMS:</div>
              <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                <li>This document serves as primary proof of material handover.</li>
                <li>Weight is subject to final verification at our weighing bridge.</li>
                <li>Material must match quality standards approved in the DOF.</li>
                <li>Discrepancies must be noted on this receipt before departure.</li>
              </ul>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
               <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#1a1a1a' }}>For ASHOK TEXTILES</div>
               <div style={{ marginTop: 'auto' }}>
                 <div style={{ borderTop: '2.5px solid #1a1a1a', display: 'inline-block', minWidth: '250px', paddingTop: '1rem', fontSize: '0.9rem', fontWeight: '900', textAlign: 'center', color: '#1a1a1a' }}>
                   Authorized Signatory
                 </div>
               </div>
            </div>
          </div>
          
        </div>
      </div>
      
      <style>{`
        @media print {
          @page { margin: 15mm; }
          body * { visibility: hidden; }
          #printable-dyrr, #printable-dyrr * { visibility: visible; }
          #printable-dyrr {
            position: absolute; left: 0; top: 0; width: 100%; padding: 0;
          }
          .no-print { display: none !important; }
          .print-modal-container {
            box-shadow: none !important; border: none !important; position: absolute; left: 0; top: 0; width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

const infoBoxStyle = {
  padding: '1.25rem',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  backgroundColor: '#fff'
};

const infoLabelStyle = {
  fontSize: '0.75rem',
  fontWeight: '900',
  color: '#6b7280',
  letterSpacing: '1.2px',
  marginBottom: '0.4rem'
};

const dataLineStyle = {
  fontSize: '0.9rem',
  color: '#111827',
  fontWeight: '500'
};

const thStyle = {
  padding: '1.5rem 1rem',
  textAlign: 'left',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  fontWeight: '900',
  color: '#111827'
};

const tdStyle = {
  padding: '1.5rem 1rem',
  fontSize: '0.95rem',
  color: '#1f2937'
};
