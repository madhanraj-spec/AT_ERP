import React, { useState, useEffect } from 'react';
import { Loader, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PrintableWOF from '../Production/PrintableWOF';
import DYDRDetail from '../../components/DYDRDetail';
import { printDydr } from '../../utils/printDydr';

function getWofStatusBadge(wof) {
  const today = new Date().toISOString().split('T')[0];
  if (wof.status === 'completed') {
    if (wof.end_date && wof.end_date < today) {
      return { label: 'Completed Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return { label: 'Completed', bg: '#dcfce7', color: '#166534', border: '#86efac' };
  }
  if (wof.status === 'stopped') {
    return { label: 'Stopped', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
  }
  if (wof.status === 'on_process') {
    if (wof.end_date && wof.end_date < today) {
      return { label: 'Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return { label: 'On Process', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' };
  }
  if (wof.status === 'created') {
    if (wof.end_date && wof.end_date < today) {
      return { label: 'Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return { label: 'Created', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
  }
  return { label: wof.status, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
}

function getYarnStatusBadge(allotments, associatedDydrs) {
  const totalAllotted = (allotments || []).reduce((sum, a) => sum + parseFloat(a.allotted_qty || a.kg || a.allottedQty || 0), 0);
  const totalDelivered = (associatedDydrs || []).reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

  if (totalAllotted === 0) {
    return { label: 'Not Required', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
  }
  if (totalDelivered === 0) {
    return { label: 'Not Delivered', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
  }
  if (totalDelivered < totalAllotted - 0.05) {
    return { label: 'Partially Delivered', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
  }
  return { label: 'Delivered', bg: '#dcfce7', color: '#166534', border: '#86efac' };
}

function OrderWarpingTab({ order }) {
  const [wofs, setWofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [expandedWofId, setExpandedWofId] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState('yarn');
  const [dydrsByWof, setDydrsByWof] = useState({});
  const [loadingDydrs, setLoadingDydrs] = useState(false);
  const [printWof, setPrintWof] = useState(null);
  const [dyri, setDyri] = useState([]);
  const [dydi, setDydi] = useState([]);

  const overallWarpSummary = React.useMemo(() => {
    const summary = {};

    // 1. Initialize with order's warp requirements
    const warpReqs = (order.yarn_requirements || []).filter(y => y.type === 'warp');
    warpReqs.forEach(yr => {
      const countId = yr.countId || yr.count_id || '';
      const color = yr.color || yr.colour || '';
      const key = `${countId}-${color}`;
      summary[key] = {
        countId,
        countValue: yr.countValue || '',
        colour: color,
        required: parseFloat(yr.kg || 0),
        received: 0,
        delivered: 0
      };
    });

    // 2. Add dyed receipts matching warp colours/counts
    dyri.forEach(item => {
      const countId = item.yarn_count_id || '';
      const color = item.colour || '';
      const key = `${countId}-${color}`;
      
      if (summary[key]) {
        summary[key].received += parseFloat(item.quantity_kg || 0);
      }
    });

    // 3. Add dyed deliveries for warping
    dydi.forEach(item => {
      if (item.process_type === 'warping') {
        const countId = item.yarn_count_id || '';
        const color = item.colour || '';
        const key = `${countId}-${color}`;
        if (summary[key]) {
          summary[key].delivered += parseFloat(item.quantity_kg || 0);
        }
      }
    });

    return Object.values(summary);
  }, [order.yarn_requirements, dyri, dydi]);

  const fetchWofs = async () => {
    setLoading(true);
    
    // 1. Fetch Receipts (dyed_yarn_receipt_items)
    const { data: receiptData } = await supabase
      .from('dyed_yarn_receipt_items')
      .select('*, yarn_count:master_yarn_counts(count_value, material, product_type)')
      .eq('order_id', order.id);
    setDyri(receiptData || []);

    // 2. Fetch Deliveries (dyed_yarn_delivery_items)
    const { data: deliveryData } = await supabase
      .from('dyed_yarn_delivery_items')
      .select(`
        id,
        production_form_id,
        yarn_count_id,
        quantity_kg,
        no_of_bags,
        cone_weight,
        colour,
        lot_number,
        process_type,
        yarn_count:master_yarn_counts(count_value, material, product_type),
        delivery:dyed_yarn_deliveries(
          id,
          dydr_number,
          delivered_date,
          delivered_by,
          vehicle_no,
          remarks
        )
      `)
      .eq('order_id', order.id);
    setDydi(deliveryData || []);

    // 3. Fetch WOFs
    const { data: wofData, error } = await supabase
      .from('warping_order_forms')
      .select(`
        *,
        order:orders(id, order_number, design_no, design_name, total_quantity, yarn_requirements, technical_specs),
        machine:master_machines(machine_name),
        partner:master_partners(partner_name)
      `)
      .eq('order_id', order.id)
      .order('created_at', { ascending: false });

    if (!error && wofData) {
      setWofs(wofData);
      
      const wofIds = wofData.map(w => w.id);
      const grouped = {};
      wofIds.forEach(id => { grouped[id] = []; });
      if (deliveryData) {
        deliveryData.forEach(item => {
          if (item.production_form_id && grouped[item.production_form_id]) {
            grouped[item.production_form_id].push(item);
          }
        });
      }
      setDydrsByWof(grouped);
    }
    setLoading(false);
  };

  const fetchYarnCounts = async () => {
    const { data } = await supabase.from('master_yarn_counts').select('*');
    setYarnCounts(data || []);
  };

  useEffect(() => {
    fetchWofs();
    fetchYarnCounts();
  }, [order.id]);

  const handleToggleExpand = (wofId) => {
    if (expandedWofId === wofId) {
      setExpandedWofId(null);
    } else {
      setExpandedWofId(wofId);
      setActiveDetailTab('yarn');
    }
  };

  return (
    <div>
      <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: '800', fontSize: '0.95rem', color: '#800000', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        Warping Modules
      </h4>

      {/* WOF Status Overview */}
      {!loading && wofs.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
          marginBottom: '1.25rem', padding: '0.75rem 1rem',
          backgroundColor: '#fafafa',
          border: '1px solid var(--border-current)',
          borderRadius: '10px'
        }}>
          {wofs.map(w => {
            const badge = getWofStatusBadge(w);
            return (
              <div
                key={w.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.35rem 0.7rem',
                  backgroundColor: '#fff',
                  border: '1px solid var(--border-current)',
                  borderRadius: '8px',
                  fontSize: '0.72rem'
                }}
              >
                <span style={{ fontWeight: '700', color: '#800000', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                  {w.wof_number}
                </span>
                <span style={{
                  backgroundColor: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                  padding: '1px 8px',
                  borderRadius: '12px',
                  fontSize: '0.58rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em'
                }}>
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted-current)', alignItems: 'center', gap: '0.5rem' }}>
          <Loader size={20} className="spin" /> Loading Warping Order Forms…
        </div>
      ) : (
        <div>
          {/* Big Text Stats Cards */}
          {(() => {
            const totalWofQty = wofs.reduce((sum, w) => sum + parseFloat(w.qty || 0), 0);
            const orderQty = order.total_quantity || 0;
            const productionQty = order.technical_specs?.production_quantity || '—';
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Order Qty</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '850', color: 'var(--text-current)' }}>
                    {Number(orderQty).toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>Mtrs</span>
                  </span>
                </div>
                <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Production Qty</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '850', color: 'var(--text-current)' }}>
                    {productionQty !== '—' ? `${Number(productionQty).toLocaleString()}` : '—'} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>{productionQty !== '—' ? 'Mtrs' : ''}</span>
                  </span>
                </div>
                <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: '#800000' }}>Warped Qty</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '850', color: '#800000' }}>
                    {Number(totalWofQty).toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#a3a3a3' }}>Mtrs</span>
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Overall Warp Yarn Status Table */}
          <div style={{ marginBottom: '2rem' }}>
            <h5 style={{ margin: '0 0 0.75rem 0', fontWeight: '800', fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Overall Warp Yarn Status
            </h5>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-current)' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'left' }}>Count</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'left' }}>Colour</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Required (kg)</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Received from Dyeing (kg)</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Delivered for Warping (kg)</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Balance Qty (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {overallWarpSummary.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                        No warp yarn requirements specified for this order.
                      </td>
                    </tr>
                  ) : (
                    overallWarpSummary.map((row, idx) => {
                      const yc = yarnCounts.find(y => y.id === row.countId);
                      const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (row.countValue || '—');
                      const balance = Math.max(0, row.required - row.delivered);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>{countDisplay}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '700', color: 'var(--color-primary)' }}>{row.colour}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600' }}>{row.required.toFixed(2)}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: '#1d4ed8' }}>{row.received.toFixed(2)}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: '#047857' }}>{row.delivered.toFixed(2)}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: balance > 0.01 ? '#b45309' : '#047857' }}>{balance.toFixed(2)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <h5 style={{ margin: '0 0 0.75rem 0', fontWeight: '800', fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Warping Order Forms
          </h5>
          
          {wofs.length === 0 ? (
            <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', fontStyle: 'italic' }}>No Warping Order Forms found for this order.</p>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '2px solid var(--border-current)', textAlign: 'left' }}>
                    <th style={{ width: '40px', padding: '0.75rem 0.5rem' }}></th>
                    {['WOF Number', 'Qty (Mtrs)', 'Machine', 'Type & Partner', 'Start Date', 'End Date', 'Status', 'Yarn Status', 'Action'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wofs.map(wof => {
                    const badge = getWofStatusBadge(wof);
                    const allotments = wof.colour_allotments || [];
                    const associatedDydrs = dydrsByWof[wof.id] || [];
                    const yarnBadge = getYarnStatusBadge(allotments, associatedDydrs);
                    const isExpanded = expandedWofId === wof.id;

                    return (
                      <React.Fragment key={wof.id}>
                        <tr onClick={() => handleToggleExpand(wof.id)} style={{ cursor: 'pointer', backgroundColor: '#fafafa', borderBottom: '1px solid var(--border-current)' }}>
                          <td onClick={e => { e.stopPropagation(); handleToggleExpand(wof.id); }} style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: '#800000', fontFamily: 'monospace' }}>{wof.wof_number}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>{wof.qty ? `${wof.qty} m` : '—'}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {wof.wof_type === 'in_house' ? (wof.machine?.machine_name || wof.machine_name || '—') : '—'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {wof.wof_type === 'job_work' ? (
                              <span style={{ color: '#059669', fontWeight: '600' }}>
                                Job Work ({wof.partner?.partner_name || wof.partner_name || '—'})
                              </span>
                            ) : (
                              <span style={{ color: '#800000', fontWeight: '600' }}>In-House</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {wof.start_date ? new Date(wof.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {wof.end_date ? new Date(wof.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '700' }}>
                              {badge.label}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ backgroundColor: yarnBadge.bg, color: yarnBadge.color, border: `1px solid ${yarnBadge.border}`, padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '700' }}>
                              {yarnBadge.label}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => setPrintWof(wof)} style={{ background: 'transparent', border: '1px solid var(--border-current)', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: '#800000', fontWeight: '600', cursor: 'pointer' }}>
                              <Eye size={12} style={{ marginRight: '0.2rem', display: 'inline' }} /> View
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ backgroundColor: '#fff' }}>
                            <td colSpan={10} style={{ padding: '1.5rem', borderLeft: '3px solid #800000' }}>
                              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-current)', marginBottom: '1.25rem', gap: '1rem' }}>
                                <button onClick={() => setActiveDetailTab('yarn')} style={{ padding: '0.5rem 1rem', border: 'none', background: 'none', color: activeDetailTab === 'yarn' ? '#800000' : 'var(--text-muted-current)', borderBottom: activeDetailTab === 'yarn' ? '2.5px solid #800000' : '2.5px solid transparent', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer' }}>
                                  Yarn Requirements & DYDR
                                </button>
                                <button onClick={() => setActiveDetailTab('warping')} style={{ padding: '0.5rem 1rem', border: 'none', background: 'none', color: activeDetailTab === 'warping' ? '#800000' : 'var(--text-muted-current)', borderBottom: activeDetailTab === 'warping' ? '2.5px solid #800000' : '2.5px solid transparent', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer' }}>
                                  Warping
                                </button>
                              </div>

                              {activeDetailTab === 'yarn' && (
                                <div>
                                  <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                      Yarn Allotments for Warping Order Form
                                    </h4>
                                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                        <thead>
                                          <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Colour</th>
                                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Count</th>
                                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Allotted for this WOF (kg)</th>
                                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Received (kg)</th>
                                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Delivered (kg)</th>
                                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Balance (kg)</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {allotments.map((a, i) => {
                                            const yc = yarnCounts.find(y => y.id === a.countId);
                                            const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (a.countValue || '—');
                                            
                                            const allottedQty = parseFloat(a.allotted_qty || a.kg || a.allottedQty || 0);
                                            
                                            // Order total dyed receipts matching count/colour
                                            const receivedItems = dyri.filter(item => {
                                              const matchCount = (item.yarn_count_id && a.countId && item.yarn_count_id === a.countId) || 
                                                                 (item.yarn_count?.count_value === a.countValue);
                                              const matchColour = (item.colour === a.colour);
                                              return matchCount && matchColour;
                                            });
                                            const receivedQty = receivedItems.reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);

                                            // Deliveries to this specific WOF
                                            const deliveredItems = associatedDydrs.filter(d => {
                                              const matchCount = (d.yarn_count_id && a.countId && d.yarn_count_id === a.countId) || 
                                                                 (d.yarn_count?.count_value === a.countValue);
                                              const matchColour = (d.colour === a.colour);
                                              return matchCount && matchColour;
                                            });
                                            const deliveredQty = deliveredItems.reduce((s, it) => s + parseFloat(it.quantity_kg || 0), 0);
                                            const balance = Math.max(0, allottedQty - deliveredQty);

                                            return (
                                              <tr key={i} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', color: 'var(--color-primary)' }}>{a.colour || '—'}</td>
                                                <td style={{ padding: '0.6rem 0.75rem' }}>{countDisplay}</td>
                                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#800000', textAlign: 'right' }}>{allottedQty.toFixed(2)}</td>
                                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', color: '#1d4ed8', textAlign: 'right' }}>{receivedQty.toFixed(2)}</td>
                                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{deliveredQty.toFixed(2)}</td>
                                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: balance > 0.01 ? '#b45309' : '#047857', textAlign: 'right' }}>{balance.toFixed(2)}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                  </table>
                                </div>
                              </div>

                              <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Associated Dyed Yarn Delivery Receipts (DYDR)
                                </h4>
                                {loadingDydrs ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>
                                    <Loader size={14} className="spin" /> Loading associated deliveries…
                                  </div>
                                ) : associatedDydrs.length === 0 ? (
                                  <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                    No DYDR delivery receipts have been created for this warping order form yet.
                                  </p>
                                ) : (
                                  <div>
                                    {(() => {
                                      const groupedMap = {};
                                      associatedDydrs.forEach(item => {
                                        const del = item.delivery;
                                        if (!del) return;
                                        if (!groupedMap[del.id]) {
                                          groupedMap[del.id] = {
                                            id: del.id,
                                            dydr_number: del.dydr_number,
                                            delivered_date: del.delivered_date,
                                            delivered_by: del.delivered_by,
                                            vehicle_no: del.vehicle_no,
                                            remarks: del.remarks,
                                            target_process: 'warping',
                                            doc_no: wof.wof_number,
                                            machine_name: wof.machine?.machine_name || wof.machine_name || '—',
                                            order_no: wof.order?.order_number || order.order_number || '—',
                                            design_no: wof.order?.design_no || order.design_no || '—',
                                            design_name: wof.order?.design_name || order.design_name || '',
                                            items: []
                                          };
                                        }
                                        groupedMap[del.id].items.push(item);
                                      });
                                      const groupedList = Object.values(groupedMap);
                                      return groupedList.map(gDydr => (
                                        <DYDRDetail 
                                          key={gDydr.id} 
                                          dydr={gDydr} 
                                          onPrint={(d) => printDydr(d, yarnCounts)} 
                                        />
                                      ));
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {activeDetailTab === 'warping' && (
                            <div style={{ padding: '1.5rem', border: '1.5px dashed var(--border-current)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted-current)' }}>
                              <p style={{ margin: 0, fontSize: '0.85rem' }}>Warping production tracking will be available soon.</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
      )}

      {/* Print Modal */}
      {printWof && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', maxWidth: '850px', width: '100%', maxHeight: '90vh', overflow: 'auto', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <button onClick={() => setPrintWof(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted-current)' }}>&times;</button>
            <PrintableWOF wof={printWof} order={printWof.order} machineName={printWof.machine?.machine_name || printWof.machine_name} partnerName={printWof.partner?.partner_name || printWof.partner_name} yarnCounts={yarnCounts} />
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderWarpingTab;
