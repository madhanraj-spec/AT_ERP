import React, { useState, useEffect, useCallback } from 'react';
import { Loader, ChevronDown, ChevronRight, Eye, Calculator, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PrintableWOF from '../Production/PrintableWOF';
import PrintableWOFDC from '../Production/PrintableWOFDC';
import DYDRDetail from '../../components/DYDRDetail';
import DYRRDetail from '../../components/DYRRDetail';
import DyedReceiptPrintModal from '../DyedYarn/DyedReceiptPrintModal';
import { printDydr } from '../../utils/printDydr';

function getLocalDateString(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWofStatusBadge(wof) {
  const todayStr = getLocalDateString(new Date());
  const isFinished = wof.status === 'completed' || (wof.status === 'stopped' && !!wof.wofdc_number);

  if (isFinished) {
    const actualEndStr = wof.process_completed_at
      ? getLocalDateString(wof.process_completed_at)
      : (getLocalDateString(wof.updated_at) || todayStr);
    if (wof.end_date && actualEndStr > wof.end_date) {
      return { label: wof.status === 'completed' ? 'Completed Late' : 'Stopped Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return wof.status === 'completed'
      ? { label: 'Completed', bg: '#dcfce7', color: '#166534', border: '#86efac' }
      : { label: 'Stopped', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
  }
  if (wof.status === 'stopped') {
    return { label: 'Stopped', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
  }
  if (wof.status === 'on_process') {
    if (wof.end_date && todayStr > wof.end_date) {
      return { label: 'Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return { label: 'On Process', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' };
  }
  if (wof.status === 'created') {
    if (wof.end_date && todayStr > wof.end_date) {
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
  const [printWof, setPrintWof] = useState(null);
  const [expandedWofdcId, setExpandedWofdcId] = useState(null);
  const [dyri, setDyri] = useState([]);
  const [dydi, setDydi] = useState([]);
  const [expandedYarnKeys, setExpandedYarnKeys] = useState(new Set());
  const [expandedFormKeys, setExpandedFormKeys] = useState(new Set());
  const [printDyrr, setPrintDyrr] = useState(null);

  const handleToggleYarnExpand = (key) => {
    const next = new Set(expandedYarnKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedYarnKeys(next);
  };

  const handleToggleFormExpand = (key) => {
    const next = new Set(expandedFormKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedFormKeys(next);
  };

  const overallWarpSummary = React.useMemo(() => {
    const summary = {};
    const warpReqs = (order.yarn_requirements || []).filter(y => y.type === 'warp');

    const findWarpKey = (countId, color) => {
      const cleanColor = String(color || '').trim().toLowerCase();
      const match = warpReqs.find(yr => {
        const yrCountId = yr.countId || yr.count_id || '';
        const yrColor = yr.color || yr.colour || '';
        return String(yrCountId) === String(countId) && 
               String(yrColor).trim().toLowerCase() === cleanColor;
      });
      if (match) {
        const matchCountId = match.countId || match.count_id || '';
        const matchColor = match.color || match.colour || '';
        return `${matchCountId}-${matchColor}`;
      }
      return null;
    };

    // 1. Initialize with order's warp requirements
    warpReqs.forEach(yr => {
      const countId = yr.countId || yr.count_id || '';
      const color = yr.color || yr.colour || '';
      const key = `${countId}-${color}`;
      if (!summary[key]) {
        summary[key] = {
          countId,
          countValue: yr.countValue || '',
          colour: color,
          required: 0,
          received: 0,
          delivered: 0,
          returned: 0
        };
      }
      summary[key].required += parseFloat(yr.kg || 0);
    });

    // 2. Add dyed receipts matching warp colours/counts (exclude excess/production returns)
    dyri.forEach(item => {
      const isExcess = item.is_excess || item.receipt?.source_type === 'production';
      if (isExcess) return;

      const countId = item.yarn_count_id || '';
      const color = item.colour || '';
      const key = findWarpKey(countId, color);
      if (key) {
        summary[key].received += parseFloat(item.quantity_kg || 0);
      }
    });

    // 3. Add dyed deliveries matching count/colour (exclude redyeing and subtract from received)
    dydi.forEach(item => {
      const isRedyeing = item.process_type === 'redyeing' || item.delivery?.delivery_type === 'redyeing';
      const countId = item.yarn_count_id || '';
      const color = item.colour || '';
      const key = findWarpKey(countId, color);

      if (key) {
        if (isRedyeing) {
          summary[key].received = Math.max(0, summary[key].received - parseFloat(item.quantity_kg || 0));
        } else if (item.process_type === 'warping' || item.yarn_type === 'warp') {
          summary[key].delivered += parseFloat(item.quantity_kg || 0);
        }
      }
    });

    // 4. Add returns from dyed receipts matching count/colour (isExcess is true)
    dyri.forEach(item => {
      const isExcess = item.is_excess || item.receipt?.source_type === 'production';
      if (isExcess && item.yarn_type === 'warp') {
        const countId = item.yarn_count_id || '';
        const color = item.colour || '';
        const key = findWarpKey(countId, color);
        if (key) {
          summary[key].returned += parseFloat(item.quantity_kg || 0);
        }
      }
    });

    return Object.values(summary);
  }, [order.yarn_requirements, dyri, dydi]);

  const fetchWofs = useCallback(async () => {
    Promise.resolve().then(() => setLoading(true));
    
    // 1. Fetch Receipts (dyed_yarn_receipt_items) with receipt relation for source_type filtering
    const { data: receiptData } = await supabase
      .from('dyed_yarn_receipt_items')
      .select('*, yarn_count:master_yarn_counts(count_value, material, product_type), location:master_locations(location_name), receipt:dyed_yarn_receipts(id, dyrr_number, dof_id, dof_number, received_date, vehicle_no, dc_number, received_by, remarks, source_type)')
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
  }, [order.id]);

  const fetchYarnCounts = useCallback(async () => {
    const { data } = await supabase.from('master_yarn_counts').select('*');
    setYarnCounts(data || []);
  }, []);

  useEffect(() => {
    if (order?.id) {
      Promise.resolve().then(() => {
        fetchWofs();
        fetchYarnCounts();
      });
    }
  }, [order?.id, fetchWofs, fetchYarnCounts]);

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
              <div className="stats-grid-3" style={{ marginBottom: '2rem' }}>
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
                    <th style={{ width: '40px', padding: '0.75rem 1rem' }}></th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'left' }}>Count</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'left' }}>Colour</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Required (kg)</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Received from Dyeing (kg)</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Used (kg)</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Available (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {overallWarpSummary.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                        No warp yarn requirements specified for this order.
                      </td>
                    </tr>
                  ) : (
                    overallWarpSummary.map((row, idx) => {
                      const yc = yarnCounts.find(y => y.id === row.countId);
                      const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (row.countValue || '—');
                      const used = row.delivered - row.returned;
                      const available = Math.max(0, row.received - used);
                      const yarnKey = `${row.countId}-${row.colour}`;
                      const isYarnExpanded = expandedYarnKeys.has(yarnKey);

                      return (
                        <React.Fragment key={idx}>
                          <tr 
                            onClick={() => handleToggleYarnExpand(yarnKey)} 
                            style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-current)', transition: 'background-color 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>
                              {isYarnExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>{countDisplay}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '700', color: 'var(--color-primary)' }}>{row.colour}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600' }}>{row.required.toFixed(2)}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: '#1d4ed8' }}>{row.received.toFixed(2)}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: '#047857' }}>{used.toFixed(2)}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: available > 0.01 ? '#b45309' : '#047857' }}>{available.toFixed(2)}</td>
                          </tr>
                          {isYarnExpanded && (
                            <tr style={{ backgroundColor: '#fafafa' }}>
                              <td colSpan="7" style={{ padding: '1rem 1.5rem', borderLeft: '3px solid #800000', borderBottom: '1px solid var(--border-current)' }}>
                                {(() => {
                                  const matchingWofs = wofs.filter(wof => {
                                    const hasAllotment = (wof.colour_allotments || []).some(a => a.countId === row.countId && a.colour === row.colour);
                                    const wofDeliveries = dydrsByWof[wof.id] || [];
                                    const hasDelivery = wofDeliveries.some(dItem => 
                                      dItem.yarn_count_id === row.countId && 
                                      dItem.colour === row.colour
                                    );
                                    return hasAllotment || hasDelivery;
                                  });

                                  if (matchingWofs.length === 0) {
                                    return (
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                        No warping order forms associated with this yarn count and colour.
                                      </div>
                                    );
                                  }

                                  return (
                                    <div>
                                      <h6 style={{ margin: '0 0 0.8rem 0', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
                                        Warping Order Forms for {row.colour}
                                      </h6>
                                      <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                          <thead>
                                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                                              <th style={{ width: '32px' }}></th>
                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '750', color: 'var(--text-muted-current)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Date</th>
                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '750', color: 'var(--text-muted-current)', fontSize: '0.65rem', textTransform: 'uppercase' }}>WOF</th>
                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '750', color: 'var(--text-muted-current)', fontSize: '0.65rem', textTransform: 'uppercase' }}>In House or Job Work</th>
                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '750', color: 'var(--text-muted-current)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Partner Name</th>
                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '750', color: 'var(--text-muted-current)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Machine</th>
                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '750', color: 'var(--text-muted-current)', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'right' }}>Allotted Qty (kg)</th>
                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '750', color: 'var(--text-muted-current)', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'right' }}>Delivered (kg)</th>
                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '750', color: 'var(--text-muted-current)', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'right' }}>Used (kg)</th>
                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '750', color: 'var(--text-muted-current)', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'right' }}>Returned Qty (kg)</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {matchingWofs.map((wof) => {
                                              const allottedQty = (wof.colour_allotments || [])
                                                .filter(a => a.countId === row.countId && a.colour === row.colour)
                                                .reduce((sum, a) => sum + parseFloat(a.allotted_qty || a.kg || a.allottedQty || 0), 0);

                                              const wofDeliveries = dydrsByWof[wof.id] || [];
                                              const deliveredQty = wofDeliveries
                                                .filter(d => d.yarn_count_id === row.countId && d.colour === row.colour)
                                                .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

                                              const returnedQty = wof.yarn_returns
                                                ? (wof.yarn_returns || [])
                                                    .filter(r => (r.yarn_count_id === row.countId || r.countId === row.countId) && r.colour === row.colour)
                                                    .reduce((sum, r) => sum + parseFloat(r.quantity_returned || 0), 0)
                                                : 0;

                                              const usedQty = deliveredQty - returnedQty;

                                              const inHouseOrJobWorkLabel = wof.wof_type === 'in_house' ? 'In-House' : 'Job Work';
                                              const partnerNameDisplay = wof.partner?.partner_name || (wof.wof_type === 'in_house' ? '—' : wof.partner_name || '—');
                                              const machineNameDisplay = wof.machine?.machine_name || wof.machine_name || '—';
                                              const formattedDate = wof.created_at 
                                                ? new Date(wof.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                : '—';

                                              const formKey = `${row.countId}-${row.colour}-warp-${wof.id}`;
                                              const isFormExpanded = expandedFormKeys.has(formKey);

                                              return (
                                                <React.Fragment key={wof.id}>
                                                  <tr 
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleToggleFormExpand(formKey);
                                                    }} 
                                                    style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer', backgroundColor: isFormExpanded ? '#fdf8f8' : '#fff' }}
                                                  >
                                                    <td style={{ textAlign: 'center', padding: '0.5rem 0.75rem', color: '#94a3b8' }}>
                                                      {isFormExpanded ? <ChevronDown size={13} style={{ color: 'var(--color-primary)' }} /> : <ChevronRight size={13} style={{ color: 'var(--text-muted-current)' }} />}
                                                    </td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-current)' }}>{formattedDate}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: '#800000', fontWeight: '700', fontFamily: 'monospace' }}>{wof.wof_number}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-current)' }}>{inHouseOrJobWorkLabel}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-current)' }}>{partnerNameDisplay}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-current)' }}>{machineNameDisplay}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-current)', textAlign: 'right', fontWeight: '600' }}>{allottedQty.toFixed(2)}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-current)', textAlign: 'right', fontWeight: '600' }}>{deliveredQty.toFixed(2)}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-current)', textAlign: 'right', fontWeight: '600' }}>{usedQty.toFixed(2)}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-current)', textAlign: 'right', fontWeight: '600' }}>{returnedQty.toFixed(2)}</td>
                                                  </tr>
                                                  {isFormExpanded && (
                                                    <tr style={{ backgroundColor: '#fffdfd' }}>
                                                      <td colSpan="10" style={{ padding: '0.75rem 1.25rem', borderLeft: '3px dashed var(--color-primary)', borderBottom: '1px solid #e2e8f0' }}>
                                                        <div style={{ maxWidth: '850px' }}>
                                                          <h6 style={{ margin: '0 0 0.5rem 0', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                            <Calculator size={13} />
                                                            Lot & Delivery Details (Level 2 Breakdown)
                                                          </h6>
                                                          <div style={{ border: '1px solid #fca5a5', borderRadius: '6px', overflow: 'hidden' }}>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                                                              <thead>
                                                                <tr style={{ backgroundColor: '#fef2f2', borderBottom: '1px solid #fca5a5', textAlign: 'left' }}>
                                                                  <th style={{ padding: '0.3rem 0.4rem', fontWeight: '700', color: '#7f1d1d', fontSize: '0.68rem' }}>DYDR</th>
                                                                  <th style={{ padding: '0.3rem 0.4rem', fontWeight: '700', color: '#7f1d1d', fontSize: '0.68rem' }}>Colour</th>
                                                                  <th style={{ padding: '0.3rem 0.4rem', fontWeight: '700', color: '#7f1d1d', fontSize: '0.68rem' }}>Count</th>
                                                                  <th style={{ padding: '0.3rem 0.4rem', fontWeight: '700', color: '#7f1d1d', fontSize: '0.68rem' }}>Lot</th>
                                                                  <th style={{ padding: '0.3rem 0.4rem', fontWeight: '700', color: '#7f1d1d', fontSize: '0.68rem', textAlign: 'right' }}>Allotted</th>
                                                                  <th style={{ padding: '0.3rem 0.4rem', fontWeight: '700', color: '#7f1d1d', fontSize: '0.68rem', textAlign: 'right' }}>Delivered</th>
                                                                  <th style={{ padding: '0.3rem 0.4rem', fontWeight: '700', color: '#7f1d1d', fontSize: '0.68rem', textAlign: 'right' }}>Used</th>
                                                                  <th style={{ padding: '0.3rem 0.4rem', fontWeight: '700', color: '#7f1d1d', fontSize: '0.68rem', textAlign: 'right' }}>Returned</th>
                                                                </tr>
                                                              </thead>
                                                              <tbody>
                                                                {(() => {
                                                                  const matchingDydi = wofDeliveries.filter(d => 
                                                                    d.yarn_count_id === row.countId && 
                                                                    d.colour === row.colour
                                                                  );

                                                                  const formatCount = (countId) => {
                                                                    const yc = yarnCounts.find(y => y.id === countId);
                                                                    return yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : '—';
                                                                  };

                                                                  const level2TdStyle = { padding: '0.3rem 0.4rem', color: '#451a03', fontSize: '0.68rem' };
                                                                  const level2NumericTdStyle = { ...level2TdStyle, textAlign: 'right', fontWeight: '600' };

                                                                  if (matchingDydi.length === 0) {
                                                                    return (
                                                                      <tr>
                                                                        <td style={level2TdStyle}>—</td>
                                                                        <td style={{ ...level2TdStyle, fontWeight: '700', color: 'var(--color-primary)' }}>{row.colour}</td>
                                                                        <td style={level2TdStyle}>{formatCount(row.countId)}</td>
                                                                        <td style={level2TdStyle}>—</td>
                                                                        <td style={level2NumericTdStyle}>{allottedQty.toFixed(2)}</td>
                                                                        <td style={level2NumericTdStyle}>0.00</td>
                                                                        <td style={level2NumericTdStyle}>0.00</td>
                                                                        <td style={level2NumericTdStyle}>0.00</td>
                                                                      </tr>
                                                                    );
                                                                  }

                                                                  // Build rows for matching deliveries
                                                                  const rows = matchingDydi.map((item, dIdx) => {
                                                                    const lotReturn = wof.yarn_returns 
                                                                      ? (wof.yarn_returns || []).find(r => 
                                                                          (r.yarn_count_id === item.yarn_count_id || r.countId === item.yarn_count_id) && 
                                                                          r.colour === item.colour && 
                                                                          (r.lot_number || '—') === (item.lot_number || '—')
                                                                        )
                                                                      : null;

                                                                    const retVal = lotReturn ? parseFloat(lotReturn.quantity_returned || 0) : 0;
                                                                    const delVal = parseFloat(item.quantity_kg || 0);
                                                                    const usdVal = wof.yarn_returns ? (delVal - retVal) : delVal;

                                                                    return (
                                                                      <tr key={item.id} style={{ borderBottom: '1px solid #fee2e2', backgroundColor: '#fff' }}>
                                                                        <td style={{ ...level2TdStyle, fontWeight: '700', color: '#800000' }}>{item.delivery?.dydr_number || '—'}</td>
                                                                        <td style={level2TdStyle}>{item.colour}</td>
                                                                        <td style={level2TdStyle}>{formatCount(item.yarn_count_id)}</td>
                                                                        <td style={{ ...level2TdStyle, fontWeight: '600' }}>{item.lot_number || '—'}</td>
                                                                        <td style={level2NumericTdStyle}>{delVal.toFixed(2)}</td>
                                                                        <td style={level2NumericTdStyle}>{delVal.toFixed(2)}</td>
                                                                        <td style={level2NumericTdStyle}>{usdVal.toFixed(2)}</td>
                                                                        <td style={{ ...level2NumericTdStyle, color: retVal > 0 ? '#b91c1c' : '#451a03' }}>{retVal.toFixed(2)}</td>
                                                                      </tr>
                                                                    );
                                                                  });

                                                                  // Append unmatched returns if any
                                                                  const unmatchedReturns = wof.yarn_returns
                                                                    ? (wof.yarn_returns || []).filter(r => 
                                                                        (r.yarn_count_id === row.countId || r.countId === row.countId) && 
                                                                        r.colour === row.colour &&
                                                                        !matchingDydi.some(d => (d.lot_number || '—') === r.lot_number)
                                                                      )
                                                                    : [];

                                                                  unmatchedReturns.forEach((r, uIdx) => {
                                                                    const retVal = parseFloat(r.quantity_returned || 0);
                                                                    rows.push(
                                                                      <tr key={`unmatched-${uIdx}`} style={{ borderBottom: '1px solid #fee2e2', backgroundColor: '#fff' }}>
                                                                        <td style={level2TdStyle}>— (Return Only)</td>
                                                                        <td style={level2TdStyle}>{r.colour}</td>
                                                                        <td style={level2TdStyle}>{r.count_display || formatCount(row.countId)}</td>
                                                                        <td style={{ ...level2TdStyle, fontWeight: '600' }}>{r.lot_number || '—'}</td>
                                                                        <td style={level2NumericTdStyle}>—</td>
                                                                        <td style={level2NumericTdStyle}>0.00</td>
                                                                        <td style={level2NumericTdStyle}>{(-retVal).toFixed(2)}</td>
                                                                        <td style={{ ...level2NumericTdStyle, color: '#b91c1c' }}>{retVal.toFixed(2)}</td>
                                                                      </tr>
                                                                    );
                                                                  });

                                                                  return rows;
                                                                })()}
                                                              </tbody>
                                                            </table>
                                                          </div>
                                                        </div>
                                                      </td>
                                                    </tr>
                                                  )}
                                                </React.Fragment>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
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
                    const associatedDyrrs = dyri.filter(item => {
                      const isProdReturn = item.is_excess || item.receipt?.source_type === 'production';
                      const isMatchingWof = item.receipt?.dof_number === wof.wof_number;
                      return isProdReturn && isMatchingWof;
                    });
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
                          <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>
                            {wof.machine?.machine_name || wof.machine_name || '—'}
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
                                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Used (kg)</th>
                                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Returned (kg)</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {allotments.map((a, i) => {
                                            const yc = yarnCounts.find(y => y.id === a.countId);
                                            const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (a.countValue || '—');
                                            
                                            const allottedQty = parseFloat(a.allotted_qty || a.kg || a.allottedQty || 0);
                                            
                                            // Order total dyed receipts matching count/colour (exclude excess/production returns)
                                            const receivedItems = dyri.filter(item => {
                                              const isExcess = item.is_excess || item.receipt?.source_type === 'production';
                                              if (isExcess) return false;
                                              const matchCount = (item.yarn_count_id && a.countId && item.yarn_count_id === a.countId) || 
                                                                 (item.yarn_count?.count_value === a.countValue);
                                              const matchColour = (item.colour === a.colour);
                                              return matchCount && matchColour;
                                            });
                                            
                                            // Subtract redyeing delivery items
                                            const redyeingItems = dydi.filter(item => {
                                              const isRedyeing = item.process_type === 'redyeing' || item.delivery?.delivery_type === 'redyeing';
                                              if (!isRedyeing) return false;
                                              const matchCount = (item.yarn_count_id && a.countId && item.yarn_count_id === a.countId) || 
                                                                 (item.yarn_count?.count_value === a.countValue);
                                              const matchColour = (item.colour === a.colour);
                                              return matchCount && matchColour;
                                            });
                                            const redyeingQty = redyeingItems.reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);
                                            const receivedQty = Math.max(0, receivedItems.reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0) - redyeingQty);

                                            // Deliveries to this specific WOF
                                            const deliveredItems = associatedDydrs.filter(d => {
                                              const matchCount = (d.yarn_count_id && a.countId && d.yarn_count_id === a.countId) || 
                                                                 (d.yarn_count?.count_value === a.countValue);
                                              const matchColour = (d.colour === a.colour);
                                              return matchCount && matchColour;
                                            });
                                            const deliveredQty = deliveredItems.reduce((s, it) => s + parseFloat(it.quantity_kg || 0), 0);
                                            const balance = Math.max(0, allottedQty - deliveredQty);

                                            // Return & Used calculations
                                            const isWofdcGenerated = wof.status === 'completed' || (wof.status === 'stopped' && !!wof.wofdc_number);
                                            const returnedQty = isWofdcGenerated && wof.yarn_returns
                                              ? (wof.yarn_returns || []).filter(r => (r.yarn_count_id === a.countId || r.countId === a.countId) && r.colour === a.colour).reduce((sum, r) => sum + parseFloat(r.quantity_returned || 0), 0)
                                              : 0;
                                            const usedQty = isWofdcGenerated ? Math.max(0, deliveredQty - returnedQty) : deliveredQty;

                                            return (
                                              <tr key={i} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', color: 'var(--color-primary)' }}>{a.colour || '—'}</td>
                                                <td style={{ padding: '0.6rem 0.75rem' }}>{countDisplay}</td>
                                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#800000', textAlign: 'right' }}>{allottedQty.toFixed(2)}</td>
                                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', color: '#1d4ed8', textAlign: 'right' }}>{receivedQty.toFixed(2)}</td>
                                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{deliveredQty.toFixed(2)}</td>
                                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: balance > 0.01 ? '#b45309' : '#047857', textAlign: 'right' }}>{balance.toFixed(2)}</td>
                                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#111827', textAlign: 'right' }}>{isWofdcGenerated ? usedQty.toFixed(2) : '—'}</td>
                                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#7f1d1d', textAlign: 'right' }}>{isWofdcGenerated ? returnedQty.toFixed(2) : '—'}</td>
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
                                {associatedDydrs.length === 0 ? (
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
                                            partner_name: wof.partner?.partner_name || wof.partner_name,
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

                              <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Associated Dyed Yarn Return Receipts (DYRR)
                                </h4>
                                {associatedDyrrs.length === 0 ? (
                                  <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                    No DYRR return receipts have been created for this warping order form yet.
                                  </p>
                                ) : (
                                  <div>
                                    {(() => {
                                      const groupedDyrrMap = {};
                                      associatedDyrrs.forEach(item => {
                                        const rec = item.receipt;
                                        if (!rec) return;
                                        if (!groupedDyrrMap[rec.id]) {
                                          groupedDyrrMap[rec.id] = {
                                            id: rec.id,
                                            dyrr_number: rec.dyrr_number,
                                            received_date: rec.received_date,
                                            received_by: rec.received_by,
                                            vehicle_no: rec.vehicle_no,
                                            dc_number: rec.dc_number,
                                            remarks: rec.remarks,
                                            source_type: rec.source_type,
                                            dof_number: rec.dof_number,
                                            items: []
                                          };
                                        }
                                        groupedDyrrMap[rec.id].items.push(item);
                                      });
                                      const groupedDyrrList = Object.values(groupedDyrrMap);
                                      return groupedDyrrList.map(gDyrr => (
                                        <DYRRDetail 
                                          key={gDyrr.id} 
                                          dyrr={gDyrr} 
                                          onPrint={(d) => {
                                            const printObj = {
                                              receiptNumber: d.dyrr_number,
                                              dyrr_number: d.dyrr_number,
                                              created_at: d.received_date,
                                              date: d.received_date ? new Date(d.received_date).toLocaleDateString() : '',
                                              source: 'production',
                                              source_type: 'production_return',
                                              partner_name: 'N/A',
                                              dof_number: d.dof_number,
                                              dc_number: d.dc_number,
                                              vehicle_no: d.vehicle_no,
                                              received_by: d.received_by,
                                              remarks: d.remarks,
                                              items: d.items.map(item => ({
                                                orderNo: order.order_number,
                                                design: `${order.design_no} / ${order.design_name || ''}`,
                                                count: item.yarn_count?.count_value,
                                                colour: item.colour,
                                                yarn_type: item.yarn_type || 'warp',
                                                lot_number: item.lot_number,
                                                location: item.location?.location_name || '—',
                                                quantity_kg: item.quantity_kg
                                              }))
                                            };
                                            setPrintDyrr(printObj);
                                          }} 
                                        />
                                      ));
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {activeDetailTab === 'warping' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem 0' }}>
                              {/* Production details card */}
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                gap: '1.5rem',
                                backgroundColor: 'var(--surface-current)',
                                padding: '1.25rem',
                                borderRadius: '10px',
                                border: '1px solid var(--border-current)'
                              }}>
                                <div>
                                  <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Warper Name</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: wof.warper_name ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                    {wof.warper_name || 'Not Assigned'}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Actual Start Date</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: wof.process_started_at ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                    {wof.process_started_at
                                      ? new Date(wof.process_started_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                      : '—'}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Actual End Date</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: wof.process_completed_at ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                    {wof.process_completed_at
                                      ? new Date(wof.process_completed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                      : '—'}
                                  </span>
                                </div>
                              </div>

                              {/* Forwarding & Warp Split configuration section */}
                              <div>
                                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Forwarding & Warp Split Configuration
                                </h4>
                                {wof.forwarded_to ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', backgroundColor: 'var(--surface-current)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-current)', fontSize: '0.825rem' }}>
                                      <div>
                                        <span style={{ color: 'var(--text-muted-current)', marginRight: '0.5rem', fontWeight: '500' }}>Forwarded To:</span>
                                        <span style={{
                                          fontWeight: '800',
                                          textTransform: 'uppercase',
                                          color: wof.forwarded_to === 'sizing' ? '#0284c7' : '#059669',
                                          backgroundColor: wof.forwarded_to === 'sizing' ? 'rgba(14,165,233,0.1)' : 'rgba(16,185,129,0.1)',
                                          padding: '0.2rem 0.5rem',
                                          borderRadius: '4px',
                                          fontSize: '0.75rem'
                                        }}>
                                          {wof.forwarded_to}
                                        </span>
                                      </div>
                                      {wof.forwarded_to === 'sizing' && (
                                        <div>
                                          <span style={{ color: 'var(--text-muted-current)', marginRight: '0.5rem', fontWeight: '500' }}>Sizing Type:</span>
                                          <span style={{ fontWeight: '700', textTransform: 'capitalize', color: 'var(--text-current)' }}>
                                            {wof.sizing_type === 'in_house' ? 'In-House' : 'Job Work'}
                                          </span>
                                        </div>
                                      )}
                                      {wof.warp_splits_count > 0 && (
                                        <div>
                                          <span style={{ color: 'var(--text-muted-current)', marginRight: '0.5rem', fontWeight: '500' }}>Number of Splits:</span>
                                          <span style={{ fontWeight: '800', backgroundColor: 'rgba(128,0,0,0.05)', color: '#800000', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                                            {wof.warp_splits_count}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {wof.warp_splits && wof.warp_splits.length > 0 && (
                                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                          <thead>
                                            <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                              {['Warp / SOF Number', 'Quantity (Mtrs)', 'Scheduled Start Date', 'Scheduled End Date'].map(h => (
                                                <th key={h} style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>{h}</th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {wof.warp_splits.map((split, sIdx) => (
                                              <tr key={sIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', fontFamily: 'monospace', color: '#0ea5e9' }}>
                                                  {split.warp_no} {split.beam_name ? `(Beam: ${split.beam_name})` : ''}
                                                </td>
                                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>{parseFloat(split.qty || 0).toLocaleString('en-IN')} m</td>
                                                <td style={{ padding: '0.6rem 0.75rem' }}>
                                                  {split.start_date ? new Date(split.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                </td>
                                                <td style={{ padding: '0.6rem 0.75rem' }}>
                                                  {split.end_date ? new Date(split.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  !(wof.status === 'stopped' && !!wof.wofdc_number) && (
                                    <div style={{ padding: '1.5rem', border: '1px dashed var(--border-current)', borderRadius: '8px', backgroundColor: 'var(--surface-current)', textAlign: 'center', color: 'var(--text-muted-current)', fontSize: '0.85rem' }}>
                                      No forwarding configurations set. WOF forwarding scheduling will appear here once configured.
                                    </div>
                                  )
                                )}

                                {/* Collapsible WOFDC Delivery Receipt */}
                                {(wof.status === 'completed' || (wof.status === 'stopped' && !!wof.wofdc_number)) && (
                                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-current)', paddingTop: '1.25rem' }}>
                                    <div 
                                      onClick={() => setExpandedWofdcId(expandedWofdcId === wof.id ? null : wof.id)}
                                      style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center', 
                                        backgroundColor: 'rgba(128,0,0,0.04)', 
                                        padding: '0.75rem 1rem', 
                                        borderRadius: '8px', 
                                        border: '1px solid #800000', 
                                        cursor: 'pointer',
                                        userSelect: 'none'
                                      }}
                                    >
                                      <span style={{ fontWeight: '800', color: '#800000', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        📄 Delivery Receipt (WOFDC): {wof.wofdc_number || '—'}
                                      </span>
                                      <span style={{ fontSize: '0.75rem', fontWeight: '750', color: '#800000', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        {expandedWofdcId === wof.id ? 'Collapse Details ▲' : 'Expand Details ▼'}
                                      </span>
                                    </div>
                                    
                                    {expandedWofdcId === wof.id && (
                                      <div style={{ marginTop: '1rem' }}>
                                        <PrintableWOFDC 
                                          wof={wof} 
                                          order={wof.order} 
                                          splits={wof.warp_splits || []} 
                                          yarnReturns={wof.yarn_returns || []} 
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
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

      {/* Print DYRR Modal */}
      {printDyrr && (
        <DyedReceiptPrintModal 
          receipt={printDyrr} 
          onClose={() => setPrintDyrr(null)} 
        />
      )}
    </div>
  );
}

export default OrderWarpingTab;
