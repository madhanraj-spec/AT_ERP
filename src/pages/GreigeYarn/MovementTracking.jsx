import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ReceiptPrintModal from './ReceiptPrintModal';

export default function MovementTracking() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('input_mill'); // 'input_mill' | 'input_prod' | 'output'
  const [loading, setLoading] = useState(true);

  // Arrays
  const [spinningReceipts, setSpinningReceipts] = useState([]);
  const [productionReceipts, setProductionReceipts] = useState([]);
  const [deliveries, setDeliveries] = useState([]); // GYDR receipts with items

  // Modals
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedGYDR, setSelectedGYDR] = useState(null);

  useEffect(() => {
    fetchMovements();
  }, [activeTab]);

  const fetchMovements = async () => {
    setLoading(true);

    // Fetch Receipts
    const { data: recData } = await supabase
      .from('greige_yarn_receipts')
      .select(`
        *,
        master_yarn_counts (count_value, material, product_type),
        master_partners (partner_name),
        master_locations (location_name)
      `)
      .order('created_at', { ascending: false });

    // Fetch GYDR Delivery Receipts with line items
    const { data: gydrData, error: gydrError } = await supabase
      .from('greige_yarn_delivery_receipts')
      .select(`
        *,
        dyeing_order_forms(
          master_partners(partner_name)
        ),
        greige_yarn_delivery_items(
          *,
          orders(order_number, design_no, design_name),
          master_yarn_counts(count_value, material, product_type),
          master_locations(location_name)
        )
      `)
      .order('created_at', { ascending: false });

    if (recData) {
      setSpinningReceipts(recData.filter(r => r.receipt_type === 'spinning_mill'));
      setProductionReceipts(recData.filter(r => r.receipt_type === 'production'));
    }

    if (gydrData) {
      setDeliveries(gydrData);
    } else if (gydrError && gydrError.code === '42P01') {
      setDeliveries([]);
    }

    setLoading(false);
  };

  // Flatten GYDR receipts to individual line item rows for table display
  const flatDeliveryRows = React.useMemo(() => {
    return deliveries.flatMap(r => {
      const items = r.greige_yarn_delivery_items || [];
      if (items.length === 0) {
        return [{
          id: r.id, gydr_number: r.gydr_number, dof_number: r.dof_number,
          delivered_by: r.delivered_by, vehicle_no: r.vehicle_no, created_at: r.created_at,
          yarn_label: '-', colour: '-', quantity_kg: 0, location_name: '-',
          isFirstItem: true, receiptObj: r,
        }];
      }
      return items.map((item, idx) => ({
        id: `${r.id}-${idx}`, gydr_number: r.gydr_number, dof_number: r.dof_number,
        delivered_by: r.delivered_by, vehicle_no: r.vehicle_no, created_at: r.created_at,
        yarn_label: item.master_yarn_counts
          ? `${item.master_yarn_counts.count_value} - ${item.master_yarn_counts.material} - ${item.master_yarn_counts.product_type}`
          : '-',
        colour: item.colour,
        quantity_kg: parseFloat(item.quantity_kg || 0),
        location_name: item.master_locations?.location_name || '-',
        partner_name: r.dyeing_order_forms?.master_partners?.partner_name || '-',
        order_info: item.orders ? `${item.orders.order_number} (${item.orders.design_no})` : '-',
        isFirstItem: idx === 0,
        receiptObj: r,
      }));
    });
  }, [deliveries]);

  return (
    <div style={{ width: '100%', padding: '1rem' }} className="fade-in">

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/greige-yarn')}
          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', padding: '0', marginBottom: '0.5rem' }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
        <h1 style={{ fontSize: '1.75rem', margin: '0', color: 'var(--text-current)', fontWeight: 'bold' }}>
          Track Yarn Movement
        </h1>
        <p style={{ color: 'var(--text-muted-current)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
          View all greige yarn receipts and deliveries
        </p>
      </div>

      <div className="glass-panel" style={{ padding: 0 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-current)', padding: '0 1.5rem', gap: '2rem' }}>
          {[
            { key: 'input_mill', label: `Greige Input (${spinningReceipts.length})` },
            { key: 'input_prod', label: `Greige Input from Production (${productionReceipts.length})` },
            { key: 'output', label: `Greige Output (${deliveries.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none', border: 'none', padding: '1.25rem 0', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
                color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--text-muted-current)',
                borderBottom: activeTab === tab.key ? '3px solid var(--color-primary)' : '3px solid transparent',
                transition: 'all 0.2s', whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}><Loader size={24} className="spin" /></div>
          ) : (
            <table className="table" style={{ fontSize: '0.85rem', width: '100%' }}>
              <thead>
                <tr>
                  {activeTab === 'input_mill' && (<>
                    <th>Receipt No</th><th>Date & Time</th><th>Invoice No</th><th>Invoice Date</th>
                    <th>Mill Name</th><th>Count</th><th>Bags</th><th>Cones</th>
                    <th>Wt/Bag (kg)</th><th>Wt/Cone (kg)</th>
                    <th style={{ color: '#16a34a', textAlign: 'center' }}>Total (kg)</th>
                    <th>Rate/KG (₹)</th><th>Location</th><th style={{ textAlign: 'right' }}>Action</th>
                  </>)}
                  {activeTab === 'input_prod' && (<>
                    <th>Receipt No</th><th>Date & Time</th><th>Order Form No</th><th>Count</th>
                    <th>Bags</th><th>Cones</th><th>Wt/Bag (kg)</th><th>Wt/Cone (kg)</th>
                    <th style={{ color: '#16a34a', textAlign: 'center' }}>Total (kg)</th>
                    <th>Location</th><th style={{ textAlign: 'right' }}>Action</th>
                  </>)}
                  {activeTab === 'output' && (<>
                    <th>GYDR Number</th><th>Date & Time</th><th>Partner / Unit</th><th>DOF #</th>
                    <th>Order & Design</th><th>Count</th><th>Colour</th>
                    <th style={{ color: '#dc2626', textAlign: 'right' }}>Qty Issued (kg)</th>
                    <th>Location</th><th style={{ textAlign: 'center' }}>Receipt</th>
                  </>)}
                </tr>
              </thead>
              <tbody>
                {/* ── Spinning Mill Input ── */}
                {activeTab === 'input_mill' && (
                  spinningReceipts.length === 0
                    ? <tr><td colSpan={14} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>No incoming mill receipts found</td></tr>
                    : spinningReceipts.map(row => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 'bold' }}>{row.receipt_no}</td>
                        <td>{new Date(row.created_at).toLocaleString()}</td>
                        <td>{row.invoice_no || '-'}</td>
                        <td>{row.invoice_date || '-'}</td>
                        <td>{row.master_partners?.partner_name || '-'}</td>
                        <td>{row.master_yarn_counts ? `${row.master_yarn_counts.count_value} - ${row.master_yarn_counts.material} - ${row.master_yarn_counts.product_type}` : '-'}</td>
                        <td>{row.bag_count || 0}</td>
                        <td>{row.cone_count || 0}</td>
                        <td>{Number(row.bag_weight || 0).toFixed(2)}</td>
                        <td>{Number(row.cone_weight || 0).toFixed(2)}</td>
                        <td style={{ fontWeight: 'bold', color: '#16a34a', textAlign: 'center' }}>{Number(row.total_weight).toFixed(2)}</td>
                        <td>₹{Number(row.rate_per_kg || 0).toFixed(2)}</td>
                        <td>{row.master_locations?.location_name || '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => setSelectedReceipt(row)} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', padding: 0 }}>View</button>
                        </td>
                      </tr>
                    ))
                )}

                {/* ── Production Input ── */}
                {activeTab === 'input_prod' && (
                  productionReceipts.length === 0
                    ? <tr><td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>No incoming production receipts found</td></tr>
                    : productionReceipts.map(row => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 'bold' }}>{row.receipt_no}</td>
                        <td>{new Date(row.created_at).toLocaleString()}</td>
                        <td>{row.order_form_no || '-'}</td>
                        <td>{row.master_yarn_counts ? `${row.master_yarn_counts.count_value} - ${row.master_yarn_counts.material} - ${row.master_yarn_counts.product_type}` : '-'}</td>
                        <td>{row.bag_count || 0}</td>
                        <td>{row.cone_count || 0}</td>
                        <td>{Number(row.bag_weight || 0).toFixed(2)}</td>
                        <td>{Number(row.cone_weight || 0).toFixed(2)}</td>
                        <td style={{ fontWeight: 'bold', color: '#16a34a', textAlign: 'center' }}>{Number(row.total_weight).toFixed(2)}</td>
                        <td>{row.master_locations?.location_name || '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => setSelectedReceipt(row)} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', padding: 0 }}>View</button>
                        </td>
                      </tr>
                    ))
                )}

                {/* ── GYDR Output ── */}
                {activeTab === 'output' && (
                  flatDeliveryRows.length === 0
                    ? <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>No greige yarn deliveries logged yet. Run the DB setup SQL first.</td></tr>
                    : flatDeliveryRows.map(row => (
                      <tr key={row.id} style={{ backgroundColor: !row.isFirstItem ? '#fafafa' : undefined }}>
                        <td style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                          {row.isFirstItem ? row.gydr_number : <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>↳</span>}
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>{row.isFirstItem ? new Date(row.created_at).toLocaleString() : ''}</td>
                        <td style={{ fontWeight: row.isFirstItem ? '700' : '400' }}>{row.isFirstItem ? row.partner_name : ''}</td>
                        <td style={{ fontWeight: row.isFirstItem ? '700' : '400' }}>{row.isFirstItem ? row.dof_number : ''}</td>
                        <td style={{ fontSize: '0.8rem' }}>{row.order_info}</td>
                        <td style={{ fontSize: '0.8rem' }}>{row.yarn_label}</td>
                        <td>{row.colour}</td>
                        <td style={{ fontWeight: 'bold', color: '#dc2626', textAlign: 'right' }}>{row.quantity_kg.toFixed(2)}</td>
                        <td>{row.location_name}</td>
                        <td style={{ textAlign: 'center' }}>
                          {row.isFirstItem && (
                            <button
                              onClick={() => setSelectedGYDR(row.receiptObj)}
                              style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}
                            >
                              View Receipt
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Greige Yarn Receipt Modal */}
      {selectedReceipt && (
        <ReceiptPrintModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}

      {/* GYDR Quick View Modal */}
      {selectedGYDR && (
        <GYDRQuickView receipt={selectedGYDR} onClose={() => setSelectedGYDR(null)} />
      )}
    </div>
  );
}

// ── Inline GYDR Quick View Modal ──
function GYDRQuickView({ receipt, onClose }) {
  const items = receipt.greige_yarn_delivery_items || [];
  const total = items.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
          <div>
            <span style={{ fontWeight: '800', color: '#7f1d1d', fontSize: '1rem' }}>{receipt.gydr_number}</span>
            <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: '#64748b' }}>DOF: {receipt.dof_number}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => window.print()} style={{ padding: '5px 12px', backgroundColor: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}>🖨 Print</button>
            <button onClick={onClose} style={{ padding: '5px 12px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '4px', fontSize: '0.78rem', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <div><strong>Delivered By:</strong> {receipt.delivered_by}</div>
            <div><strong>Vehicle:</strong> {receipt.vehicle_no || '—'}</div>
            <div><strong>Date:</strong> {new Date(receipt.created_at).toLocaleString('en-IN')}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px' }}>Count</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px' }}>Colour</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px' }}>Location</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px' }}>Qty (kg)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>
                    {item.master_yarn_counts
                      ? `${item.master_yarn_counts.count_value} - ${item.master_yarn_counts.material} - ${item.master_yarn_counts.product_type}`
                      : '-'}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{item.colour}</td>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{item.master_locations?.location_name || '-'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', fontSize: '12px' }}>{parseFloat(item.quantity_kg).toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #7f1d1d' }}>
                <td colSpan={3} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', fontSize: '12px' }}>TOTAL:</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#7f1d1d' }}>{total.toFixed(2)} kg</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
