import React from 'react';
import { X, Printer } from 'lucide-react';

export default function DyedDeliveryPrintModal({ delivery, wof, weaving, onClose, getFormatCount }) {
  if (!delivery) return null;

  const handlePrint = () => {
    window.print();
  };

  const firstItem = delivery.items?.[0] || {};
  const linkedOrder = firstItem.orders || {};

  // Resolve source details
  let typeLabel = 'In House';
  let partnerLabel = 'N/A';
  let orderFormNumber = '—';
  let machineName = '—';

  if (firstItem.process_type === 'warping' && wof) {
    typeLabel = wof.wof_type === 'job_work' ? 'Job Work' : 'In House';
    partnerLabel = wof.partner_name || wof.partner?.partner_name || 'N/A';
    orderFormNumber = wof.wof_number;
    machineName = wof.machine_name || '—';
  } else if (firstItem.process_type === 'weaving' && weaving) {
    typeLabel = 'In House'; // Weaving orders are default in house
    partnerLabel = 'N/A';
    orderFormNumber = weaving.weaving_number;
  }

  const orderNumber = linkedOrder.order_number || '—';
  const designNumber = linkedOrder.design_no || '—';
  const designName = linkedOrder.design_name || '';

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
              Dyed Yarn Delivery Details: {delivery.dydr_number}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={handlePrint} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', backgroundColor: '#7f1d1d' }}>
              <Printer size={18} /> Print Delivery Note
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div id="printable-dydr" style={{ padding: '3.5rem', color: '#000', backgroundColor: '#fff', minHeight: '100%' }}>
          
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
                 <div style={{ fontSize: '0.875rem', color: '#7f1d1d', fontWeight: '700', marginTop: '0.25rem', letterSpacing: '2px', textTransform: 'uppercase' }}>Dyed Yarn Material Delivery Note</div>
               </div>
             </div>
          </div>

          {/* Document Header Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
            <div style={infoBoxStyle}>
              <div style={infoLabelStyle}>DELIVERY INFORMATION</div>
              <div style={{ ...dataLineStyle, color: '#7f1d1d', fontWeight: '900', fontSize: '1.1rem' }}>{delivery.dydr_number}</div>
              <div style={dataLineStyle}><strong>Date:</strong> {delivery.delivered_date ? new Date(delivery.delivered_date).toLocaleDateString() : new Date(delivery.created_at).toLocaleDateString()}</div>
              <div style={dataLineStyle}><strong>Time:</strong> {new Date(delivery.created_at).toLocaleTimeString()}</div>
            </div>
            
            <div style={infoBoxStyle}>
              <div style={infoLabelStyle}>SOURCE DETAILS</div>
              <div style={dataLineStyle}><strong>Type:</strong> {typeLabel}</div>
              {typeLabel === 'Job Work' && (
                <div style={dataLineStyle}><strong>Partner:</strong> {partnerLabel}</div>
              )}
              <div style={dataLineStyle}><strong>Order Form No:</strong> {orderFormNumber}</div>
              {machineName && machineName !== '—' && (
                <div style={dataLineStyle}><strong>Machine:</strong> {machineName}</div>
              )}
            </div>

            <div style={{ ...infoBoxStyle, backgroundColor: '#fcfcfc', border: '1px solid #7f1d1d' }}>
              <div style={{ ...infoLabelStyle, color: '#7f1d1d' }}>DELIVERY DESTINATION</div>
              <div style={dataLineStyle}><strong>Order No:</strong> {orderNumber}</div>
              <div style={dataLineStyle}><strong>Design No:</strong> {designNumber}</div>
              {designName && <div style={dataLineStyle}><strong>Design Name:</strong> {designName}</div>}
            </div>
          </div>

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '3rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderTop: '2px solid #1a1a1a', borderBottom: '2px solid #1a1a1a' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Colour</th>
                <th style={thStyle}>Yarn Count</th>
                <th style={thStyle}>Lot Number</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Quantity (kg)</th>
              </tr>
            </thead>
            <tbody>
              {delivery.items.map((it, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ ...tdStyle, color: '#6b7280', fontSize: '0.75rem' }}>{String(i + 1).padStart(2, '0')}</td>
                  <td style={{ ...tdStyle, fontWeight: '900', color: '#7f1d1d' }}>{it.colour}</td>
                  <td style={tdStyle}>{getFormatCount(it.yarn_count_id)}</td>
                  <td style={{ ...tdStyle, fontWeight: '750', fontFamily: 'monospace' }}>{it.lot_number || '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '900', fontSize: '1.25rem', color: '#111827' }}>
                    {Number(it.quantity_kg || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="4" style={{ padding: '2.5rem 1rem', textAlign: 'right', fontWeight: '900', color: '#4b5563', fontSize: '1rem' }}>GRAND TOTAL DELIVERED WEIGHT:</td>
                <td style={{ padding: '2.5rem 1rem', textAlign: 'right', fontWeight: '900', fontSize: '2.25rem', borderBottom: '6px double #1a1a1a', color: '#111827' }}>
                  {delivery.items.reduce((sum, it) => sum + Number(it.quantity_kg || 0), 0).toFixed(2)} <span style={{ fontSize: '1.1rem' }}>kg</span>
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Terms and Signatures */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '3rem', marginTop: '4rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#4b5563', lineHeight: '1.8', backgroundColor: '#f9fafb', padding: '1.5rem', borderRadius: '12px', border: '1px dashed #d1d5db' }}>
              <div style={{ fontWeight: '900', color: '#1a1a1a', marginBottom: '0.75rem', fontSize: '0.9rem', letterSpacing: '0.5px' }}>DELIVERY NOTES:</div>
              <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                <li>Handed over to production unit for warping/weaving.</li>
                <li>Verify lot numbers and yarn counts before issuing to machines.</li>
              </ul>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'end' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '3.5rem' }}>
                  <strong>Delivered By:</strong>
                  <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#1a1a1a', marginTop: '0.25rem' }}>{delivery.delivered_by || '—'}</div>
                </div>
                <div style={{ borderTop: '2px solid #1a1a1a', paddingTop: '0.5rem', fontSize: '0.8rem', fontWeight: '900', color: '#1a1a1a' }}>
                  Sender Signature
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '4.5rem' }}></div>
                <div style={{ borderTop: '2px solid #1a1a1a', paddingTop: '0.5rem', fontSize: '0.8rem', fontWeight: '900', color: '#1a1a1a' }}>
                  Receiver Signature
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
          #printable-dydr, #printable-dydr * { visibility: visible; }
          #printable-dydr {
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
