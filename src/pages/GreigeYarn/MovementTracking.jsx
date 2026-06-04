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
        master_locations (location_name),
        orders (order_number)
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
          master_locations(location_name),
          spinning_mill:master_partners(partner_name)
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

  const [expandedOutputs, setExpandedOutputs] = useState({});

  const toggleExpandOutput = (key) => {
    setExpandedOutputs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Group spinning receipts by receipt_no
  const groupedSpinningReceipts = React.useMemo(() => {
    const groups = {};
    spinningReceipts.forEach(r => {
      const key = r.receipt_no;
      if (!groups[key]) {
        groups[key] = {
          receipt_no: r.receipt_no,
          created_at: r.created_at,
          invoice_no: r.invoice_no,
          invoice_date: r.invoice_date,
          partner_name: r.master_partners?.partner_name || '-',
          items: [],
          rawReceipts: []
        };
      }
      groups[key].items.push({
        yarn_label: r.master_yarn_counts ? `${r.master_yarn_counts.count_value} - ${r.master_yarn_counts.material} - ${r.master_yarn_counts.product_type}` : '-',
        bag_count: r.bag_count || 0,
        cone_count: r.cone_count || 0,
        bag_weight: Number(r.bag_weight || 0).toFixed(2),
        cone_weight: Number(r.cone_weight || 0).toFixed(2),
        total_weight: Number(r.total_weight || 0).toFixed(2),
        rate_per_kg: Number(r.rate_per_kg || 0).toFixed(2),
        location_name: r.master_locations?.location_name || '-'
      });
      groups[key].rawReceipts.push(r);
    });
    return Object.values(groups);
  }, [spinningReceipts]);

  // Group production receipts by receipt_no
  const groupedProductionReceipts = React.useMemo(() => {
    const groups = {};
    productionReceipts.forEach(r => {
      const key = r.receipt_no;
      if (!groups[key]) {
        groups[key] = {
          receipt_no: r.receipt_no,
          created_at: r.created_at,
          order_form_no: r.order_form_no || '-',
          items: [],
          rawReceipts: []
        };
      }
      groups[key].items.push({
        yarn_label: r.master_yarn_counts ? `${r.master_yarn_counts.count_value} - ${r.master_yarn_counts.material} - ${r.master_yarn_counts.product_type}` : '-',
        yarn_type: r.yarn_type || '',
        colour: r.colour || '',
        order_no: r.orders?.order_number || '',
        bag_count: r.bag_count || 0,
        cone_count: r.cone_count || 0,
        bag_weight: Number(r.bag_weight || 0).toFixed(2),
        cone_weight: Number(r.cone_weight || 0).toFixed(2),
        total_weight: Number(r.total_weight || 0).toFixed(2),
        location_name: r.master_locations?.location_name || '-'
      });
      groups[key].rawReceipts.push(r);
    });
    return Object.values(groups);
  }, [productionReceipts]);

  // Group deliveries (greige yarn output) by receipt and countId
  const groupedDeliveries = React.useMemo(() => {
    const list = [];
    deliveries.forEach(r => {
      const countGroups = {};
      (r.greige_yarn_delivery_items || []).forEach(item => {
        const countId = item.yarn_count_id;
        if (!countGroups[countId]) {
          countGroups[countId] = {
            countId,
            yarn_label: item.master_yarn_counts
              ? `${item.master_yarn_counts.count_value} - ${item.master_yarn_counts.material} - ${item.master_yarn_counts.product_type}`
              : '-',
            total_qty: 0,
            locations: [],
            items: []
          };
        }
        countGroups[countId].total_qty += parseFloat(item.quantity_kg || 0);
        const loc = item.master_locations?.location_name || '-';
        if (loc !== '-' && !countGroups[countId].locations.includes(loc)) {
          countGroups[countId].locations.push(loc);
        }
        countGroups[countId].items.push(item);
      });

      if (Object.keys(countGroups).length === 0) {
        list.push({
          receiptId: r.id,
          gydr_number: r.gydr_number,
          dof_number: r.dof_number,
          partner_name: r.dyeing_order_forms?.master_partners?.partner_name || '-',
          created_at: r.created_at,
          countId: 'empty',
          yarn_label: '-',
          total_qty: 0,
          locations_str: '-',
          items: [],
          receiptObj: r
        });
      } else {
        Object.values(countGroups).forEach(g => {
          list.push({
            receiptId: r.id,
            gydr_number: r.gydr_number,
            dof_number: r.dof_number,
            partner_name: r.dyeing_order_forms?.master_partners?.partner_name || '-',
            created_at: r.created_at,
            countId: g.countId,
            yarn_label: g.yarn_label,
            total_qty: g.total_qty,
            locations_str: g.locations.join(', ') || '-',
            items: g.items,
            receiptObj: r
          });
        });
      }
    });
    return list;
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
                    <th>Count</th><th style={{ color: '#dc2626', textAlign: 'right' }}>Qty Issued (kg)</th>
                    <th>Location</th><th style={{ textAlign: 'center' }}>Details</th><th style={{ textAlign: 'center' }}>Receipt</th>
                  </>)}
                </tr>
              </thead>
              <tbody>
                {/* ── Spinning Mill Input ── */}
                {activeTab === 'input_mill' && (
                  groupedSpinningReceipts.length === 0
                    ? <tr><td colSpan={14} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>No incoming mill receipts found</td></tr>
                    : groupedSpinningReceipts.map(group => {
                        return group.items.map((item, idx) => (
                          <tr key={`${group.receipt_no}-${idx}`} style={{ borderBottom: idx === group.items.length - 1 ? '1px solid var(--border-current)' : 'none' }}>
                            {idx === 0 && (
                              <>
                                <td rowSpan={group.items.length} style={{ fontWeight: 'bold', verticalAlign: 'middle' }}>{group.receipt_no}</td>
                                <td rowSpan={group.items.length} style={{ verticalAlign: 'middle' }}>{new Date(group.created_at).toLocaleString()}</td>
                                <td rowSpan={group.items.length} style={{ verticalAlign: 'middle' }}>{group.invoice_no || '-'}</td>
                                <td rowSpan={group.items.length} style={{ verticalAlign: 'middle' }}>{group.invoice_date || '-'}</td>
                                <td rowSpan={group.items.length} style={{ verticalAlign: 'middle' }}>{group.partner_name}</td>
                              </>
                            )}
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.yarn_label}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.bag_count}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.cone_count}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.bag_weight}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.cone_weight}</td>
                            <td style={{ fontWeight: 'bold', color: '#16a34a', textAlign: 'center', borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.total_weight}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>₹{item.rate_per_kg}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.location_name}</td>
                            {idx === 0 && (
                              <td rowSpan={group.items.length} style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                                <button onClick={() => setSelectedReceipt(group.rawReceipts[0])} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', padding: 0 }}>View</button>
                              </td>
                            )}
                          </tr>
                        ));
                      })
                )}

                {/* ── Production Input ── */}
                {activeTab === 'input_prod' && (
                  groupedProductionReceipts.length === 0
                    ? <tr><td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>No incoming production receipts found</td></tr>
                    : groupedProductionReceipts.map(group => {
                        return group.items.map((item, idx) => (
                          <tr key={`${group.receipt_no}-${idx}`} style={{ borderBottom: idx === group.items.length - 1 ? '1px solid var(--border-current)' : 'none' }}>
                            {idx === 0 && (
                              <>
                                <td rowSpan={group.items.length} style={{ fontWeight: 'bold', verticalAlign: 'middle' }}>{group.receipt_no}</td>
                                <td rowSpan={group.items.length} style={{ verticalAlign: 'middle' }}>{new Date(group.created_at).toLocaleString()}</td>
                                <td rowSpan={group.items.length} style={{ verticalAlign: 'middle' }}>{group.order_form_no}</td>
                              </>
                            )}
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>
                              <div>{item.yarn_label}</div>
                              {(item.colour || item.yarn_type || item.order_no) && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                  {[item.yarn_type, item.colour, item.order_no].filter(Boolean).join(' • ')}
                                </div>
                              )}
                            </td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.bag_count}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.cone_count}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.bag_weight}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.cone_weight}</td>
                            <td style={{ fontWeight: 'bold', color: '#16a34a', textAlign: 'center', borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.total_weight}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.location_name}</td>
                            {idx === 0 && (
                              <td rowSpan={group.items.length} style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                                <button onClick={() => setSelectedReceipt(group.rawReceipts[0])} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', padding: 0 }}>View</button>
                              </td>
                            )}
                          </tr>
                        ));
                      })
                )}

                {/* ── GYDR Output ── */}
                {activeTab === 'output' && (
                  groupedDeliveries.length === 0
                    ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>No greige yarn deliveries logged yet.</td></tr>
                    : groupedDeliveries.map(row => {
                        const expandKey = `${row.receiptId}-${row.countId}`;
                        const isExpanded = !!expandedOutputs[expandKey];
                        
                        return (
                          <React.Fragment key={expandKey}>
                            <tr style={{ backgroundColor: isExpanded ? 'rgba(var(--color-primary-rgb, 128,0,0), 0.02)' : undefined, borderBottom: '1px solid var(--border-current)' }}>
                              <td style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{row.gydr_number}</td>
                              <td>{new Date(row.created_at).toLocaleString()}</td>
                              <td>{row.partner_name}</td>
                              <td>{row.dof_number}</td>
                              <td style={{ fontWeight: '600' }}>{row.yarn_label}</td>
                              <td style={{ fontWeight: 'bold', color: '#dc2626', textAlign: 'right' }}>{row.total_qty.toFixed(2)}</td>
                              <td>{row.locations_str}</td>
                              <td style={{ textAlign: 'center' }}>
                                {row.items.length > 0 ? (
                                  <button
                                    onClick={() => toggleExpandOutput(expandKey)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: '700' }}
                                  >
                                    {isExpanded ? 'Hide Details' : 'Show Details'} ({row.items.length})
                                  </button>
                                ) : '-'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  onClick={() => setSelectedGYDR(row.receiptObj)}
                                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}
                                >
                                  View Receipt
                                </button>
                              </td>
                            </tr>
                            
                            {isExpanded && row.items.length > 0 && (
                              <tr>
                                <td colSpan={9} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#fcfaf9' }}>
                                  <div style={{
                                    padding: '0.5rem 1rem',
                                    border: '1px solid var(--border-current)',
                                    borderRadius: 'var(--radius-md)',
                                    backgroundColor: 'var(--surface-current)'
                                  }}>
                                    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-current)', color: 'var(--text-muted-current)', textAlign: 'left' }}>
                                          <th style={{ padding: '6px 8px' }}>Order & Design</th>
                                          <th style={{ padding: '6px 8px' }}>Colour</th>
                                          <th style={{ padding: '6px 8px' }}>Issued From Location</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty Issued (kg)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {row.items.map((item, i) => (
                                          <tr key={item.id || i} style={{ borderBottom: i === row.items.length - 1 ? 'none' : '1px solid var(--border-current)' }}>
                                            <td style={{ padding: '6px 8px' }}>{item.orders ? `${item.orders.order_number} (${item.orders.design_no} / ${item.orders.design_name})` : '-'}</td>
                                            <td style={{ padding: '6px 8px', fontWeight: '700', color: 'var(--color-primary)' }}>{item.colour}</td>
                                            <td style={{ padding: '6px 8px' }}>{item.master_locations?.location_name || '-'}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>{parseFloat(item.quantity_kg).toFixed(2)} kg</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
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
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px' }}>Spinning Mill</th>
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
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>
                    {item.spinning_mill?.partner_name || (item.spinning_mill_id ? 'Unknown Mill' : 'Production Returns')}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{item.master_locations?.location_name || '-'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', fontSize: '12px' }}>{parseFloat(item.quantity_kg).toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #7f1d1d' }}>
                <td colSpan={4} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', fontSize: '12px' }}>TOTAL:</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#7f1d1d' }}>{total.toFixed(2)} kg</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
