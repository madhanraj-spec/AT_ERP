import React, { useState, useEffect } from 'react';
import { X, Printer, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function ReceiptPrintModal({ receipt, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (receipt?.receipt_no) {
      fetchReceiptItems();
    }
  }, [receipt?.receipt_no]);

  const fetchReceiptItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('greige_yarn_receipts')
      .select(`
        *,
        master_yarn_counts (count_value, material, product_type),
        master_partners (partner_name),
        master_locations (location_name),
        orders (order_number)
      `)
      .eq('receipt_no', receipt.receipt_no);

    if (!error && data && data.length > 0) {
      setItems(data);
    } else {
      setItems([receipt]);
    }
    setLoading(false);
  };

  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const isSpinning = receipt.receipt_type === 'spinning_mill';

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    }}>
      <div 
        className="print-container"
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '800px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header (Hidden on Print) */}
        <div className="no-print" style={{ 
          padding: '1rem 1.5rem', 
          borderBottom: '1px solid #e5e7eb', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          backgroundColor: '#f9fafb',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>
            {receipt.receipt_no?.includes('GYPRR') ? 'AT/GYPRR Digital Receipt' : 'AT/GYRR Digital Receipt'}
          </h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={handlePrint} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
              <Printer size={16} /> Print Receipt
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div style={{ padding: '3rem', color: '#000', backgroundColor: '#fff', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <Loader size={24} className="spin" style={{ margin: '0 auto 1rem', display: 'block' }} color="var(--color-primary)" />
              Loading receipt details...
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid #000', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <img src="/logo.png" alt="Ashok Textiles" style={{ maxHeight: '64px', objectFit: 'contain' }} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                  <div style={{ display: 'none' }}>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Ashok Textiles</h1>
                  </div>
                  <div>
                    <div style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '1px', margin: 0, color: '#1a1a1a', lineHeight: '1.1' }}>ASHOK TEXTILES</div>
                    <div style={{ fontSize: '0.8rem', color: '#7f1d1d', fontWeight: '750', marginTop: '0.25rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Greige Yarn Material Receipt</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: '#7f1d1d' }}>MATERIAL RECEIPT</h2>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                  <p style={{ margin: '0 0 0.25rem 0' }}><strong>Receipt No:</strong> {receipt.receipt_no}</p>
                  <p style={{ margin: '0 0 0.25rem 0' }}><strong>Date & Time:</strong> {new Date(receipt.created_at).toLocaleString()}</p>
                  <p style={{ margin: '0 0 0.25rem 0' }}><strong>Type:</strong> {isSpinning ? 'Incoming from Spinning Mill' : 'Production Return'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {isSpinning ? (
                    <>
                      <p style={{ margin: '0 0 0.25rem 0' }}><strong>Mill Name:</strong> {receipt.master_partners?.partner_name || 'N/A'}</p>
                      <p style={{ margin: '0 0 0.25rem 0' }}><strong>Invoice No:</strong> {receipt.invoice_no}</p>
                      <p style={{ margin: '0 0 0.25rem 0' }}><strong>Invoice Date:</strong> {receipt.invoice_date}</p>
                    </>
                  ) : (
                    <p style={{ margin: '0 0 0.25rem 0' }}><strong>Order Form No:</strong> {receipt.order_form_no}</p>
                  )}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Weight (kg)</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Count</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total Computed (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const detailsStr = [item.yarn_type, item.colour, item.orders?.order_number].filter(Boolean).join(' • ');
                    const countLabel = item.master_yarn_counts
                      ? `${item.master_yarn_counts.count_value} ${item.master_yarn_counts.material} (${item.master_yarn_counts.product_type || ''})${detailsStr ? ` [ ${detailsStr} ]` : ''}`
                      : 'Unknown Count';
                    const locationLabel = item.master_locations?.location_name || 'Greige Warehouse';
                    
                    return (
                      <React.Fragment key={item.id || index}>
                        {/* Bags Row */}
                        {item.bag_count > 0 && (
                          <tr style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '0.5rem' }}>
                              <strong>{countLabel}</strong> {isSpinning && ` @ ₹${Number(item.rate_per_kg || 0).toFixed(2)}/kg`}
                              <div style={{ fontSize: '0.85rem', color: '#555' }}>Bags Received (Stored in: {locationLabel})</div>
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(item.bag_weight || 0).toFixed(2)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.bag_count || 0}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{((item.bag_weight || 0) * (item.bag_count || 0)).toFixed(2)}</td>
                          </tr>
                        )}
                        {/* Cones Row */}
                        {item.cone_count > 0 && (
                          <tr style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '0.5rem' }}>
                              {item.bag_count === 0 && <strong>{countLabel}</strong>}
                              <div style={{ fontSize: '0.85rem', color: '#555' }}>Cones Received (Stored in: {locationLabel})</div>
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(item.cone_weight || 0).toFixed(2)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.cone_count || 0}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{((item.cone_weight || 0) * (item.cone_count || 0)).toFixed(2)}</td>
                          </tr>
                        )}
                        {/* If both are 0 or empty (as in production returns) */}
                        {(!item.bag_count || item.bag_count === 0) && (!item.cone_count || item.cone_count === 0) && (
                          <tr style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '0.5rem' }}>
                              <strong>{countLabel}</strong>
                              <div style={{ fontSize: '0.85rem', color: '#555' }}>Production Return (Stored in: {locationLabel})</div>
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>-</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>-</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(item.total_weight || 0).toFixed(2)}</td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="3" style={{ padding: '1rem 0.5rem', textAlign: 'right', fontWeight: 'bold' }}>GRAND TOTAL WEIGHT (KG):</td>
                    <td style={{ padding: '1rem 0.5rem', textAlign: 'right', fontWeight: 'bold', fontSize: '1.2rem' }}>
                      {items.reduce((sum, item) => sum + parseFloat(item.total_weight || 0), 0).toFixed(2)}
                    </td>
                  </tr>
                  {isSpinning && (
                    <tr>
                      <td colSpan="3" style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold' }}>INVOICE AMOUNT:</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold' }}>₹{Number(receipt.invoice_amount || 0).toFixed(2)}</td>
                    </tr>
                  )}
                </tfoot>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #000', paddingTop: '1rem', fontSize: '0.9rem' }}>
                <div>
                  <p style={{ margin: '0 0 0.5rem 0' }}><strong>Vehicle No:</strong> {receipt.vehicle_no || 'N/A'}</p>
                  <p style={{ margin: '0 0 0.5rem 0' }}>
                    <strong>Storage Location:</strong> {
                      items
                        .map(i => i.master_locations?.location_name || i.location_name)
                        .filter((val, idx, self) => val && self.indexOf(val) === idx)
                        .join(', ') || 'Greige Warehouse'
                    }
                  </p>
                </div>
                <div>
                  <p style={{ margin: '0 0 2rem 0' }}><strong>Received By:</strong> {receipt.received_by || 'N/A'}</p>
                  <div style={{ borderTop: '1px dashed #000', width: '150px', textAlign: 'center', paddingTop: '0.5rem' }}>
                    Authorized Signature
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Global CSS injected just for print to hide non-print elements */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: visible;
            box-shadow: none;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
