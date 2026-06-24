import React, { useState, useEffect } from 'react';
import { X, Printer, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function GYDRPrintModal({ receipt, dof, orders, onClose }) {
  const [items, setItems] = useState([]);
  const [dofData, setDofData] = useState(dof || null);
  const [ordersData, setOrdersData] = useState(orders || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (receipt?.id) {
      fetchDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt?.id]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      // 1. Fetch items with relationships
      const { data: itemsData, error: itemsErr } = await supabase
        .from('greige_yarn_delivery_items')
        .select(`
          *,
          master_yarn_counts (*),
          spinning_mill:master_partners!spinning_mill_id (*),
          master_locations (*)
        `)
        .eq('receipt_id', receipt.id);
      
      if (itemsErr) throw itemsErr;
      setItems(itemsData || []);

      // 2. Fetch DOF & dyeing unit if not passed
      let currentDof = dof;
      if (!currentDof && (receipt.dof_id || receipt.dof_number)) {
        let dofQuery = supabase.from('dyeing_order_forms').select(`
          *,
          dyeing_unit:master_partners(partner_name)
        `);
        
        if (receipt.dof_id) {
          dofQuery = dofQuery.eq('id', receipt.dof_id);
        } else {
          dofQuery = dofQuery.eq('dof_number', receipt.dof_number);
        }
        
        const { data: dofRes } = await dofQuery.maybeSingle();
        currentDof = dofRes;
      }
      setDofData(currentDof);

      // 3. Fetch linked orders if not passed
      let currentOrders = orders;
      if (!currentOrders && currentDof?.order_ids?.length > 0) {
        const { data: ordersRes } = await supabase
          .from('orders')
          .select('id, order_number, design_no, design_name')
          .in('id', currentDof.order_ids);
        currentOrders = ordersRes || [];
      }
      setOrdersData(currentOrders || []);
    } catch (err) {
      console.error('Error loading GYDR print details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalQty = items.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);

  return (
    <div className="print-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div 
        className="print-modal-container"
        style={{ 
          backgroundColor: '#fff', 
          borderRadius: '12px', 
          width: '100%', 
          maxWidth: '800px', 
          maxHeight: '95vh', 
          overflowY: 'auto', 
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header (Hidden on Print) */}
        <div className="no-print" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '1.25rem 2rem', 
          backgroundColor: '#f8fafc', 
          borderBottom: '1px solid #e2e8f0',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#1e293b' }}>
            Greige Yarn Delivery Receipt — {receipt.gydr_number}
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', backgroundColor: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}
            >
              <Printer size={18} /> Print Receipt
            </button>
            <button 
              onClick={onClose} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div id="printable-gydr" className="printable-content" style={{ padding: '3.5rem', color: '#000', backgroundColor: '#fff', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <Loader size={24} className="spin" style={{ margin: '0 auto 1rem', display: 'block' }} color="var(--color-primary)" />
              Loading receipt details...
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #7f1d1d', paddingBottom: '1.25rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <img src="/logo.png" alt="Logo" style={{ maxHeight: '64px', objectFit: 'contain' }}
                    onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                  <div>
                    <h2 style={{ margin: 0, color: '#1a1a1a', fontSize: '2rem', fontWeight: '900', letterSpacing: '1px', lineHeight: '1.1' }}>ASHOK TEXTILES</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#7f1d1d', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>Greige Yarn Material Delivery</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: '#7f1d1d' }}>DELIVERY RECEIPT</h1>
                  <p style={{ margin: '4px 0 0 0', fontSize: '1.05rem', fontWeight: '700', color: '#111' }}>{receipt.gydr_number}</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#666' }}>
                    Date: {new Date(receipt.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Meta Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: '#fff' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', fontWeight: '900', color: '#6b7280', letterSpacing: '1.2px', textTransform: 'uppercase' }}>Delivery Details</p>
                  {[
                    ['DOF Number', dofData?.dof_number || receipt.dof_number],
                    ['Dyeing Unit', dofData?.dyeing_unit?.partner_name || '-'],
                    ['Delivered By', receipt.delivered_by],
                    ['Vehicle No', receipt.vehicle_no || '-'],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', gap: '0.5rem', fontSize: '12px' }}>
                      <span style={{ color: '#555', minWidth: '110px', flexShrink: 0 }}>{label}:</span>
                      <span style={{ fontWeight: '600' }}>{val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: '#fff' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', fontWeight: '900', color: '#6b7280', letterSpacing: '1.2px', textTransform: 'uppercase' }}>Linked Orders</p>
                  {ordersData.length > 0 ? ordersData.map(o => (
                    <div key={o.id} style={{ fontSize: '12px' }}>
                      <span style={{ fontWeight: '700', color: '#7f1d1d' }}>{o.order_number}</span>
                      {o.design_no && <span style={{ color: '#555' }}> — {o.design_no}</span>}
                      {o.design_name && <span style={{ color: '#666', fontSize: '11px' }}> ({o.design_name})</span>}
                    </div>
                  )) : <span style={{ fontSize: '12px', color: '#888' }}>No linked orders</span>}
                </div>
              </div>

              {/* Delivery Items Table */}
              <h3 style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', color: '#7f1d1d', borderBottom: '1px solid #7f1d1d', paddingBottom: '4px', marginBottom: '0.75rem' }}>
                Yarn Delivery Details
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>S.No</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Yarn Count</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Colour</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Spinning Mill</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Location</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700' }}>Quantity (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id || i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '8px 10px', fontSize: '12px' }}>{i + 1}</td>
                      <td style={{ padding: '8px 10px', fontSize: '12px', fontWeight: '600' }}>
                        {item.master_yarn_counts
                          ? `${item.master_yarn_counts.count_value} - ${item.master_yarn_counts.material} - ${item.master_yarn_counts.product_type}`
                          : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '12px' }}>{item.colour}</td>
                      <td style={{ padding: '8px 10px', fontSize: '12px' }}>
                        {item.spinning_mill?.partner_name || (item.spinning_mill_id ? 'Unknown Mill' : 'Production Returns')}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '12px' }}>{item.master_locations?.location_name || '-'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', fontSize: '12px' }}>{parseFloat(item.quantity_kg).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #7f1d1d' }}>
                    <td colSpan={5} style={{ padding: '10px', textAlign: 'right', fontWeight: '800', fontSize: '12px' }}>TOTAL:</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#7f1d1d', fontSize: '13px' }}>{totalQty.toFixed(2)} kg</td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '180px', borderTop: '1px solid #000', paddingTop: '8px', marginTop: '40px' }}>
                    <p style={{ margin: 0, fontWeight: '600', fontSize: '12px' }}>{receipt.delivered_by}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#666' }}>Delivered By</p>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '180px', borderTop: '1px solid #000', paddingTop: '8px', marginTop: '40px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>Received By</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#888' }}>Signature</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <style>{`
          @media print {
            @page { margin: 10mm; }
            html, body, #root, .app-layout-container, .main-content-wrapper, .main-content {
              height: auto !important;
              overflow: visible !important;
              display: block !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            body * {
              visibility: hidden;
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
              visibility: visible;
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
            }
          }
        `}</style>
      </div>
    </div>
  );
}
