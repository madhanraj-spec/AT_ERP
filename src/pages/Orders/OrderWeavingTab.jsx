import React, { useState, useEffect, useCallback } from 'react';
import { Loader, ChevronDown, ChevronRight, Eye, Printer, Calendar, Grid, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PrintableWVOF from '../Production/PrintableWVOF';
import DyedDeliveryPrintModal from '../DyedYarn/DyedDeliveryPrintModal';
import PrintableWVOFDC from '../Production/PrintableWVOFDC';

function getLocalDateString(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDatesInRange(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
  const current = new Date(start);
  let safety = 0;
  while (current <= end && safety < 100) {
    dates.push(getLocalDateString(current));
    current.setDate(current.getDate() + 1);
    safety++;
  }
  return dates;
}

function resolveWvofStatusValue(wvof) {
  if (!wvof) return 'pending';
  const todayStr = getLocalDateString(new Date());
  
  // 1. Completed state
  if (wvof.status === 'completed' || wvof.status === 'late_complete') {
    const actualEndStr = wvof.process_completed_at
      ? getLocalDateString(wvof.process_completed_at)
      : (getLocalDateString(wvof.updated_at) || todayStr);
    
    if (wvof.end_date && actualEndStr > wvof.end_date) {
      return 'late_complete';
    }
    return 'completed';
  }
  
  // 2. Stopped state
  if (wvof.status === 'stopped') {
    return 'stopped';
  }
  
  // 3. Exceeded planned end date (Late)
  if (wvof.end_date && todayStr > wvof.end_date) {
    return 'late';
  }
  
  // 4. Start date exceeded (Not started yet, but today is after start_date)
  const isStarted = !!wvof.process_started_at || wvof.status === 'on_process';
  if (!isStarted && wvof.start_date && todayStr > wvof.start_date) {
    return 'start_date_exceeded';
  }
  
  return wvof.status || 'pending';
}

function getWvofStatusBadge(wvofOrStatus) {
  let status = typeof wvofOrStatus === 'string' ? wvofOrStatus : '';
  if (wvofOrStatus && typeof wvofOrStatus === 'object') {
    status = resolveWvofStatusValue(wvofOrStatus);
  }

  switch (status) {
    case 'completed':
      return { label: 'Completed', bg: '#dcfce7', color: '#166534', border: '#86efac' };
    case 'late_completed':
    case 'late_complete':
      return { label: 'Late Completed', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    case 'late':
      return { label: 'Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    case 'start_date_exceeded':
      return { label: 'Start Date Exceeded', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    case 'stopped':
      return { label: 'Stopped', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
    case 'on_process':
      return { label: 'On Process', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' };
    case 'weft_yarn_allotted':
      return { label: 'Weft Yarn Allotted', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
    case 'weft_yarn_partially_delivered':
      return { label: 'Weft Yarn Partially Delivered', bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' };
    case 'weft_yarn_delivered':
      return { label: 'Weft Yarn Delivered', bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
    case 'pending':
    default:
      return { label: 'Pending', bg: '#fef3c7', color: '#d97706', border: '#fde68a' };
  }
}

function getWeftYarnStatus(wvof, deliveries) {
  if (wvof.status === 'pending' || !wvof.weft_allotments || wvof.weft_allotments.length === 0) {
    return { label: 'Not Allotted', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' };
  }
  const totalAllotted = (wvof.weft_allotments || []).reduce((sum, a) => sum + Number(a.allotted_qty || 0), 0);
  const formDeliveries = (deliveries || []).filter(d => d.production_form_id === wvof.id);
  const totalDelivered = formDeliveries.reduce((sum, d) => sum + Number(d.quantity_kg || 0), 0);

  if (totalDelivered === 0) {
    return { label: 'Yarn Allotted', color: '#854d0e', bg: '#fef9c3', border: '#fef08a' };
  } else if (totalDelivered < totalAllotted - 0.05) {
    return { label: 'Partially Delivered', color: '#b45309', bg: '#fffbeb', border: '#fde68a' };
  } else {
    return { label: 'Delivered', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' };
  }
}



function OrderWeavingTab({ order }) {
  const [wvofs, setWvofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [expandedWvofId, setExpandedWvofId] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState('yarn');
  const [dydi, setDydi] = useState([]);
  const [dyri, setDyri] = useState([]);
  const [printWvof, setPrintWvof] = useState(null);
  const [expandedDates, setExpandedDates] = useState({});
  const [selectedDydr, setSelectedDydr] = useState(null);
  
  const [activeMainTab, setActiveMainTab] = useState('weaving_module');
  const [activeProductionSubTab, setActiveProductionSubTab] = useState('gantt');
  const [expandedGanttId, setExpandedGanttId] = useState(null);
  const [expandedGanttDates, setExpandedGanttDates] = useState({});

  const overallWeftSummary = React.useMemo(() => {
    if (!order) return [];
    const summary = {};
    const weftReqs = (order?.yarn_requirements || []).filter(y => y.type === 'weft');

    const findWeftKey = (countId, color) => {
      const cleanColor = String(color || '').trim().toLowerCase();
      const match = weftReqs.find(yr => {
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

    // 1. Initialize with order's weft requirements
    weftReqs.forEach(yr => {
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

    // 2. Add dyed receipts matching weft colors/counts (exclude excess)
    (dyri || []).forEach(item => {
      const isExcess = item.is_excess || item.receipt?.source_type === 'production';
      if (isExcess) return;

      const countId = item.yarn_count_id || '';
      const color = item.colour || '';
      const key = findWeftKey(countId, color);
      if (key) {
        summary[key].received += parseFloat(item.quantity_kg || 0);
      }
    });

    // 3. Add dyed deliveries matching count/colour (exclude redyeing and subtract from received)
    (dydi || []).forEach(item => {
      const isRedyeing = item.process_type === 'redyeing' || item.delivery?.delivery_type === 'redyeing';
      const countId = item.yarn_count_id || '';
      const color = item.colour || '';
      const key = findWeftKey(countId, color);

      if (key) {
        if (isRedyeing) {
          summary[key].received = Math.max(0, summary[key].received - parseFloat(item.quantity_kg || 0));
        } else if (item.process_type === 'weaving' || item.yarn_type === 'weft') {
          summary[key].delivered += parseFloat(item.quantity_kg || 0);
        }
      }
    });

    // 4. Add returns from dyed receipts matching count/colour (isExcess is true)
    (dyri || []).forEach(item => {
      const isExcess = item.is_excess || item.receipt?.source_type === 'production';
      if (isExcess && item.yarn_type === 'weft') {
        const countId = item.yarn_count_id || '';
        const color = item.colour || '';
        const key = findWeftKey(countId, color);
        if (key) {
          summary[key].returned += parseFloat(item.quantity_kg || 0);
        }
      }
    });

    return Object.values(summary);
  }, [order, dyri, dydi]);

  const totalWeavedQty = React.useMemo(() => {
    return wvofs.reduce((sum, wv) => {
      const logs = Array.isArray(wv.production_logs) ? wv.production_logs : [];
      const wvSum = logs.reduce((logSum, log) => logSum + (parseFloat(log.qty) || 0), 0);
      return sum + wvSum;
    }, 0);
  }, [wvofs]);

  const totalGreigeInputQty = React.useMemo(() => {
    return wvofs.reduce((sum, wv) => {
      const rolls = Array.isArray(wv.fabric_rolls) ? wv.fabric_rolls : [];
      const greigeRolls = rolls.filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing');
      const rollsSum = greigeRolls.reduce((rollSum, r) => rollSum + (parseFloat(r.qty) || 0), 0);
      return sum + rollsSum;
    }, 0);
  }, [wvofs]);

  const minMaxDates = React.useMemo(() => {
    if (wvofs.length === 0) return { start: null, end: null, dates: [] };
    let minDateStr = null;
    let maxDateStr = null;
    wvofs.forEach(wv => {
      if (wv.start_date) {
        if (!minDateStr || wv.start_date < minDateStr) minDateStr = wv.start_date;
      }
      if (wv.end_date) {
        if (!maxDateStr || wv.end_date > maxDateStr) maxDateStr = wv.end_date;
      }
      if (wv.process_started_at) {
        const dStr = getLocalDateString(wv.process_started_at);
        if (!minDateStr || dStr < minDateStr) minDateStr = dStr;
      }
      if (wv.process_completed_at) {
        const dStr = getLocalDateString(wv.process_completed_at);
        if (!maxDateStr || dStr > maxDateStr) maxDateStr = dStr;
      }
    });

    if (!minDateStr) minDateStr = getLocalDateString(new Date());
    if (!maxDateStr) {
      const d = new Date(minDateStr);
      d.setDate(d.getDate() + 14);
      maxDateStr = getLocalDateString(d);
    }
    
    // Add margin days: 2 days before, 2 days after
    const dStart = new Date(minDateStr);
    dStart.setDate(dStart.getDate() - 2);
    const dEnd = new Date(maxDateStr);
    dEnd.setDate(dEnd.getDate() + 2);

    const dates = getDatesInRange(dStart, dEnd);
    
    // Exact timeline boundaries matching the generated date range
    const start = new Date(dates[0] + 'T00:00:00');
    const end = new Date(dates[dates.length - 1] + 'T23:59:59');
    
    return { start, end, dates };
  }, [wvofs]);

  const calculateBarPosition = (barStartInput, barEndInput) => {
    if (!barStartInput || !barEndInput || !minMaxDates.start || !minMaxDates.dates || minMaxDates.dates.length === 0) {
      return { left: 0, width: 0, visible: false };
    }
    
    const startStr = getLocalDateString(barStartInput);
    const endStr = getLocalDateString(barEndInput);
    
    const startIndex = minMaxDates.dates.indexOf(startStr);
    const endIndex = minMaxDates.dates.indexOf(endStr);
    
    if (startIndex === -1 && endIndex === -1) {
      return { left: 0, width: 0, visible: false };
    }
    
    const safeStartIdx = startIndex !== -1 ? startIndex : 0;
    const safeEndIdx = endIndex !== -1 ? endIndex : minMaxDates.dates.length - 1;
    
    const totalDays = minMaxDates.dates.length;
    const leftPercent = (safeStartIdx / totalDays) * 100;
    const widthPercent = ((safeEndIdx - safeStartIdx + 1) / totalDays) * 100;
    
    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      visible: true
    };
  };
  const excelTotals = React.useMemo(() => {
    const totals = {};
    wvofs.forEach(form => {
      let plannedSum = 0;
      let actualSum = 0;
      if (minMaxDates.dates) {
        minMaxDates.dates.forEach(dateStr => {
          const plannedObj = (form.planned_daily_production || []).find(p => p.date === dateStr);
          plannedSum += plannedObj ? (parseFloat(plannedObj.qty) || 0) : 0;
          
          const actualLogs = (form.production_logs || []).filter(log => getLocalDateString(log.timestamp) === dateStr);
          actualSum += actualLogs.reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
        });
      }
      totals[form.id] = { planned: plannedSum, actual: actualSum };
    });
    return totals;
  }, [wvofs, minMaxDates.dates]);

  const excelOverallTotals = React.useMemo(() => {
    let planned = 0;
    let actual = 0;
    Object.values(excelTotals).forEach(t => {
      planned += t.planned;
      actual += t.actual;
    });
    return { planned, actual };
  }, [excelTotals]);

  const fetchWeavingData = useCallback(async () => {
    Promise.resolve().then(() => setLoading(true));
    try {
      // 1. Fetch Receipts (dyed_yarn_receipt_items)
      const { data: receiptData } = await supabase
        .from('dyed_yarn_receipt_items')
        .select('*, receipt:dyed_yarn_receipts(source_type, received_date)')
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

      // 3. Fetch Weaving Order Forms (weaving_orders)
      const { data: weavingData, error: wvError } = await supabase
        .from('weaving_orders')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name, total_quantity, yarn_requirements, technical_specs),
          machine:master_machines(machine_name),
          partner:master_partners(partner_name)
        `)
        .eq('order_id', order.id)
        .order('created_at', { ascending: false });

      if (!wvError && weavingData) {
        setWvofs(weavingData);
      }
    } catch (err) {
      console.error('Error fetching Weaving tab data:', err);
    } finally {
      setLoading(false);
    }
  }, [order?.id]);

  const fetchYarnCounts = useCallback(async () => {
    const { data } = await supabase.from('master_yarn_counts').select('*');
    setYarnCounts(data || []);
  }, []);

  useEffect(() => {
    if (order?.id) {
      Promise.resolve().then(() => {
        fetchWeavingData();
        fetchYarnCounts();
      });
    }
  }, [order?.id, fetchWeavingData, fetchYarnCounts]);

  const handleToggleExpand = (wvofId) => {
    if (expandedWvofId === wvofId) {
      setExpandedWvofId(null);
    } else {
      setExpandedWvofId(wvofId);
      setActiveDetailTab('yarn');
    }
  };

  if (!order) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted-current)', alignItems: 'center', gap: '0.5rem' }}>
        <Loader size={20} className="spin" /> Loading Weaving Data...
      </div>
    );
  }

  const numWvofs = wvofs.length;
  const dateWidth = numWvofs > 4 ? '85px' : numWvofs > 3 ? '100px' : '120px';
  const totalWidth = numWvofs > 4 ? '75px' : numWvofs > 3 ? '85px' : '100px';
  const tableFontSize = numWvofs > 4 ? '0.55rem' : numWvofs > 3 ? '0.65rem' : '0.72rem';
  const headerFontSize = numWvofs > 4 ? '0.6rem' : numWvofs > 3 ? '0.7rem' : '0.78rem';
  const subHeaderFontSize = numWvofs > 4 ? '0.5rem' : numWvofs > 3 ? '0.58rem' : '0.65rem';
  const cellPadding = numWvofs > 4 ? '0.2rem 0.3rem' : numWvofs > 3 ? '0.3rem 0.4rem' : '0.4rem 0.5rem';
  const headerPadding = numWvofs > 4 ? '0.3rem 0.4rem' : numWvofs > 3 ? '0.4rem 0.5rem' : '0.5rem';
  const subHeaderPadding = numWvofs > 4 ? '0.2rem' : numWvofs > 3 ? '0.25rem' : '0.3rem';

  return (
    <div className="excel-print-container" style={{
      '--date-width': dateWidth,
      '--total-width': totalWidth,
      '--table-font-size': tableFontSize,
      '--header-font-size': headerFontSize,
      '--sub-header-font-size': subHeaderFontSize,
      '--cell-padding': cellPadding,
      '--header-padding': headerPadding,
      '--sub-header-padding': subHeaderPadding
    }}>
      {/* Main Tab Navigation */}
      <div className="no-print" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-current)', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveMainTab('weaving_module')}
          style={{
            padding: '0.6rem 1.25rem',
            border: 'none',
            background: 'none',
            color: activeMainTab === 'weaving_module' ? '#800000' : 'var(--text-muted-current)',
            borderBottom: activeMainTab === 'weaving_module' ? '2.5px solid #800000' : '2.5px solid transparent',
            fontWeight: '700',
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Weaving Module
        </button>
        <button
          onClick={() => setActiveMainTab('overall_production')}
          style={{
            padding: '0.6rem 1.25rem',
            border: 'none',
            background: 'none',
            color: activeMainTab === 'overall_production' ? '#800000' : 'var(--text-muted-current)',
            borderBottom: activeMainTab === 'overall_production' ? '2.5px solid #800000' : '2.5px solid transparent',
            fontWeight: '700',
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Overall Production
        </button>
      </div>

      {activeMainTab === 'weaving_module' ? (
        <div>
          <h4 className="no-print" style={{ margin: '0 0 0.75rem 0', fontWeight: '800', fontSize: '0.95rem', color: '#800000', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Weaving Modules
          </h4>

          {/* WVOF Status & Info Card Overview at Top */}
          {!loading && wvofs.length > 0 && (
            <div className="no-print" style={{
              display: 'flex', flexWrap: 'wrap', gap: '0.75rem',
              marginBottom: '1.5rem', padding: '0.75rem 1rem',
              backgroundColor: '#fafafa',
              border: '1px solid var(--border-current)',
              borderRadius: '10px'
            }}>
              {wvofs.map(wv => {
                const badge = getWvofStatusBadge(wv);
                const allocation = wv.weaving_type === 'in_house' 
                  ? `Loom: ${wv.machine?.machine_name || wv.machine_name || '—'}` 
                  : `Job: ${wv.partner?.partner_name || wv.partner_name || '—'}`;
                const yarnBadge = getWeftYarnStatus(wv, dydi);
                const actualQty = (wv.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
                const rolls = Array.isArray(wv.fabric_rolls) ? wv.fabric_rolls : [];
                const greigeRolls = rolls.filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing');
                const greigeQty = greigeRolls.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0);
                return (
                  <div
                    key={wv.id}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: '0.35rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: '#fff',
                      border: '1px solid var(--border-current)',
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      minWidth: '180px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: '700', color: '#800000', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                        {wv.weaving_number}
                      </span>
                      <span style={{
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '0.58rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em'
                      }}>
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted-current)', fontSize: '0.65rem' }}>Yarn:</span>
                      <span style={{
                        backgroundColor: yarnBadge.bg,
                        color: yarnBadge.color,
                        border: `1px solid ${yarnBadge.border}`,
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '0.58rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em'
                      }}>
                        {yarnBadge.label}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted-current)', display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
                      <span>Target: <strong>{wv.qty ? `${wv.qty.toLocaleString()} m` : '—'}</strong></span>
                      <span style={{ color: '#047857' }}>Weaved: <strong>{actualQty.toLocaleString()} m</strong></span>
                    </div>
                    <div style={{ color: 'var(--text-muted-current)', display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
                      <span>Greige Recd: <strong style={{ color: '#0284c7' }}>{greigeQty.toLocaleString()} m</strong></span>
                    </div>
                    <div style={{ fontSize: '0.68rem', fontWeight: '600', color: 'var(--text-current)' }}>
                      {allocation}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted-current)', alignItems: 'center', gap: '0.5rem' }}>
              <Loader size={20} className="spin" /> Loading Weaving Order Forms…
            </div>
          ) : (
            <div>
              {/* Big Text Stats Cards */}
              {(() => {
                const totalWeavingQty = wvofs.reduce((sum, w) => sum + parseFloat(w.qty || 0), 0);
                const orderQty = order.total_quantity || 0;
                const productionQty = order.technical_specs?.production_quantity || '—';
                return (
                  <div className="no-print stats-grid-5" style={{ marginBottom: '2.5rem' }}>
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
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: '#800000' }}>Weaving Qty (Planned)</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: '850', color: '#800000' }}>
                        {Number(totalWeavingQty).toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#a3a3a3' }}>Mtrs</span>
                      </span>
                    </div>
                    <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Weaved Qty</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: '850', color: 'var(--text-current)' }}>
                        {totalWeavedQty.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>Mtrs</span>
                      </span>
                    </div>
                    <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Greige Input Qty</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: '850', color: 'var(--text-current)' }}>
                        {totalGreigeInputQty.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>Mtrs</span>
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Overall Weft Yarn Status Table */}
              <div className="no-print" style={{ marginBottom: '2.5rem' }}>
                <h5 style={{ margin: '0 0 0.75rem 0', fontWeight: '800', fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Overall Weft Yarn Status
                </h5>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-current)' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'left' }}>Count</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'left' }}>Colour</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Required (kg)</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Received from Dyeing (kg)</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Used (kg)</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Available (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {(overallWeftSummary || []).length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                        No weft yarn requirements specified for this order.
                      </td>
                    </tr>
                  ) : (
                    (overallWeftSummary || []).map((row, idx) => {
                      const yc = yarnCounts.find(y => y.id === row.countId);
                      const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (row.countValue || '—');
                      const used = row.delivered - row.returned;
                      const available = Math.max(0, row.received - used);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>{countDisplay}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '700', color: 'var(--color-primary)' }}>{row.colour}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600' }}>{row.required.toFixed(2)}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: '#1d4ed8' }}>{row.received.toFixed(2)}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: '#047857' }}>{used.toFixed(2)}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: available > 0.01 ? '#b45309' : '#047857' }}>{available.toFixed(2)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                  </table>
                </div>
              </div>

              {/* Weaving Order Forms Table */}
              <div className="no-print">
                <h5 style={{ margin: '0 0 0.75rem 0', fontWeight: '800', fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Weaving Order Forms
                </h5>
                {wvofs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', fontStyle: 'italic' }}>No Weaving Order Forms found for this order.</p>
                ) : (
                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '2px solid var(--border-current)', textAlign: 'left' }}>
                          <th style={{ width: '40px', padding: '0.75rem 0.5rem' }}></th>
                          {['WVOF Number', 'Target Qty', 'Weaved Qty', 'Greige Received', 'Machine', 'Partner or Type', 'Start Date', 'End Date', 'Status', 'Yarn Status', 'Action'].map(h => (
                            <th key={h} style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {wvofs.map(wvof => {
                          const badge = getWvofStatusBadge(wvof);
                          const yarnBadge = getWeftYarnStatus(wvof, dydi);
                          const isExpanded = expandedWvofId === wvof.id;
                          const actualQtyVal = (wvof.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
                          const rollsVal = Array.isArray(wvof.fabric_rolls) ? wvof.fabric_rolls : [];
                          const greigeRollsVal = rollsVal.filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing');
                          const greigeQtyVal = greigeRollsVal.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0);

                          return (
                            <React.Fragment key={wvof.id}>
                              <tr onClick={() => handleToggleExpand(wvof.id)} style={{ cursor: 'pointer', backgroundColor: '#fafafa', borderBottom: '1px solid var(--border-current)' }}>
                                <td onClick={e => { e.stopPropagation(); handleToggleExpand(wvof.id); }} style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: '#800000', fontFamily: 'monospace' }}>{wvof.weaving_number}</td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>{wvof.qty ? `${wvof.qty.toLocaleString()} m` : '—'}</td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: '#047857' }}>{actualQtyVal.toLocaleString()} m</td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: '#0284c7' }}>{greigeQtyVal.toLocaleString()} m</td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  {wvof.weaving_type === 'in_house' ? (wvof.machine?.machine_name || wvof.machine_name || '—') : '—'}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  {wvof.weaving_type === 'job_work' ? (
                                    <span style={{ color: '#059669', fontWeight: '600' }}>
                                      Job Work ({wvof.partner?.partner_name || wvof.partner_name || '—'})
                                    </span>
                                  ) : (
                                    <span style={{ color: '#800000', fontWeight: '600' }}>In-House</span>
                                  )}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  {wvof.start_date ? new Date(wvof.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  {wvof.end_date ? new Date(wvof.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
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
                                  <button onClick={() => setPrintWvof(wvof)} style={{ background: 'transparent', border: '1px solid var(--border-current)', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: '#800000', fontWeight: '600', cursor: 'pointer' }}>
                                    <Eye size={12} style={{ marginRight: '0.2rem', display: 'inline' }} /> View
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr style={{ backgroundColor: '#fff' }}>
                                  <td colSpan={12} style={{ padding: '1.5rem', borderLeft: '3px solid #800000' }}>
                                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-current)', marginBottom: '1.25rem', gap: '1rem' }}>
                                      <button onClick={() => setActiveDetailTab('yarn')} style={{ padding: '0.5rem 1rem', border: 'none', background: 'none', color: activeDetailTab === 'yarn' ? '#800000' : 'var(--text-muted-current)', borderBottom: activeDetailTab === 'yarn' ? '2.5px solid #800000' : '2.5px solid transparent', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer' }}>
                                        Yarn Requirements & DYDR
                                      </button>
                                      <button onClick={() => setActiveDetailTab('weaving_details')} style={{ padding: '0.5rem 1rem', border: 'none', background: 'none', color: activeDetailTab === 'weaving_details' ? '#800000' : 'var(--text-muted-current)', borderBottom: activeDetailTab === 'weaving_details' ? '2.5px solid #800000' : '2.5px solid transparent', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer' }}>
                                        Weaving Details
                                      </button>
                                      <button onClick={() => setActiveDetailTab('delivery_receipt')} style={{ padding: '0.5rem 1rem', border: 'none', background: 'none', color: activeDetailTab === 'delivery_receipt' ? '#800000' : 'var(--text-muted-current)', borderBottom: activeDetailTab === 'delivery_receipt' ? '2.5px solid #800000' : '2.5px solid transparent', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer' }}>
                                        DC
                                      </button>
                                    </div>

                                    {activeDetailTab === 'yarn' && (
                                      <div>
                                        <div style={{ marginBottom: '1.5rem' }}>
                                          <h6 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Weft Yarn Allotments
                                          </h6>
                                          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                              <thead>
                                                <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                                  <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Colour</th>
                                                  <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Yarn Count</th>
                                                  <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Allotted Qty (kg)</th>
                                                  <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Delivered Qty (kg)</th>
                                                  <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Balance Qty (kg)</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {(!wvof.weft_allotments || wvof.weft_allotments.length === 0) ? (
                                                  <tr>
                                                    <td colSpan="5" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                                      No allotments added to this weaving order form yet.
                                                    </td>
                                                  </tr>
                                                ) : (
                                                  wvof.weft_allotments.map((allot, aIdx) => {
                                                    const yc = yarnCounts.find(y => y.id === (allot.countId || allot.yarn_count_id));
                                                    const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (allot.countValue || '—');
                                                    
                                                    const matchingDel = dydi.filter(d => 
                                                      d.production_form_id === wvof.id && 
                                                      d.colour === allot.colour && 
                                                      (d.yarn_count_id === allot.countId || d.yarn_count_id === allot.yarn_count_id)
                                                    );
                                                    const deliveredQty = matchingDel.reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);
                                                    const balance = Math.max(0, parseFloat(allot.allotted_qty || 0) - deliveredQty);

                                                    return (
                                                      <tr key={aIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', color: 'var(--color-primary)' }}>{allot.colour || '—'}</td>
                                                        <td style={{ padding: '0.6rem 0.75rem' }}>{countDisplay}</td>
                                                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#800000', textAlign: 'right' }}>{parseFloat(allot.allotted_qty || 0).toFixed(2)}</td>
                                                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{deliveredQty.toFixed(2)}</td>
                                                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: balance > 0.01 ? '#b45309' : '#047857', textAlign: 'right' }}>{balance.toFixed(2)}</td>
                                                      </tr>
                                                    );
                                                  })
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>

                                        <div>
                                          <h6 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Associated DYDRs (Dyed Yarn Delivery Receipts)
                                          </h6>
                                          {dydi.filter(d => d.production_form_id === wvof.id).length === 0 ? (
                                            <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                                              No DYDR delivery receipts have been created for this weaving order form yet.
                                            </p>
                                          ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                              {(() => {
                                                const formDydis = dydi.filter(d => d.production_form_id === wvof.id);
                                                const uniqueDydrs = {};
                                                formDydis.forEach(item => {
                                                  if (item.delivery) {
                                                    uniqueDydrs[item.delivery.id] = item.delivery;
                                                  }
                                                });
                                                return Object.values(uniqueDydrs).map((del, dIdx) => {
                                                  const weight = formDydis.filter(item => item.delivery?.id === del.id).reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);
                                                  return (
                                                    <div 
                                                      key={dIdx} 
                                                      onClick={() => {
                                                        const items = formDydis.filter(item => item.delivery?.id === del.id);
                                                        setSelectedDydr({
                                                          ...del,
                                                          weaving: wvof,
                                                          items: items.map(it => ({ ...it, orders: order }))
                                                        });
                                                      }}
                                                      style={{
                                                        padding: '0.6rem 1rem',
                                                        backgroundColor: '#f8fafc',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        fontSize: '0.78rem',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s'
                                                      }}
                                                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                    >
                                                      <div>
                                                        <span style={{ fontWeight: '800', color: '#800000', fontFamily: 'monospace' }}>{del.dydr_number}</span>
                                                        <span style={{ color: 'var(--text-muted-current)', marginLeft: '1rem' }}>
                                                          Date: {del.delivered_date ? new Date(del.delivered_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                        </span>
                                                        <span style={{ color: 'var(--text-muted-current)', marginLeft: '1rem' }}>
                                                          Delivered By: {del.delivered_by || '—'}
                                                        </span>
                                                      </div>
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <span style={{ fontWeight: '700', color: '#047857' }}>
                                                          {weight.toFixed(2)} kg
                                                        </span>
                                                        <span style={{ color: '#800000', fontSize: '0.7rem', fontWeight: '700' }}>
                                                          View Receipt
                                                        </span>
                                                      </div>
                                                    </div>
                                                  );
                                                });
                                              })()}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {activeDetailTab === 'weaving_details' && (
                                      <div>
                                        <div className="grid-4-to-2" style={{ width: '100%', marginBottom: '1.5rem' }}>
                                          <div>
                                            <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Loom Allocation</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: wvof.machine?.machine_name || wvof.machine_name ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                              {wvof.machine?.machine_name || wvof.machine_name || 'Not Assigned'}
                                            </span>
                                          </div>
                                          <div>
                                            <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Beam Number</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: wvof.beam_number ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                              {wvof.beam_number || '—'}
                                            </span>
                                          </div>
                                          <div>
                                            <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Planned Start Date</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: wvof.start_date ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                              {wvof.start_date ? new Date(wvof.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </span>
                                          </div>
                                          <div>
                                            <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Planned End Date</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: wvof.end_date ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                              {wvof.end_date ? new Date(wvof.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </span>
                                          </div>
                                          <div>
                                            <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Actual Start Date</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: wvof.process_started_at ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                              {wvof.process_started_at ? new Date(wvof.process_started_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </span>
                                          </div>
                                          <div>
                                            <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Actual End Date</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: wvof.process_completed_at ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                              {wvof.process_completed_at ? new Date(wvof.process_completed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Unified Daily Production Schedule & Logs */}
                                        <div style={{ marginTop: '1rem' }}>
                                          <h6 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span style={{ width: '4px', height: '14px', backgroundColor: '#800000', borderRadius: '2px', display: 'inline-block' }}></span>
                                            Daily Production Schedule & Logs
                                          </h6>
                                          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                              <thead>
                                                <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                                  <th style={{ width: '40px', padding: '0.6rem 0.75rem' }}></th>
                                                  <th style={{ padding: '0.6rem 0.75rem', fontWeight: '750', color: '#475569' }}>Date</th>
                                                  <th style={{ padding: '0.6rem 0.75rem', fontWeight: '750', color: '#475569', textAlign: 'right' }}>Planned Production (Mtrs)</th>
                                                  <th style={{ padding: '0.6rem 0.75rem', fontWeight: '750', color: '#475569', textAlign: 'right' }}>Daily Production (Mtrs)</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {(() => {
                                                  const uniqueDates = new Set();
                                                  (wvof.planned_daily_production || []).forEach(p => { if (p.date) uniqueDates.add(p.date); });
                                                  (wvof.production_logs || []).forEach(log => {
                                                    const dateStr = getLocalDateString(log.timestamp);
                                                    if (dateStr) uniqueDates.add(dateStr);
                                                  });
                                                  const sortedDates = Array.from(uniqueDates).sort();
 
                                                  if (sortedDates.length === 0) {
                                                    return (
                                                      <tr>
                                                        <td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontStyle: 'italic' }}>
                                                          No planned daily production or actual production logs entered yet.
                                                        </td>
                                                      </tr>
                                                    );
                                                  }
 
                                                  let totalPlannedSum = 0;
                                                  let totalActualSum = 0;
                                                  const rows = [];
 
                                                  sortedDates.forEach(dateStr => {
                                                    const d = new Date(dateStr + 'T00:00:00');
                                                    const formattedDate = !isNaN(d.getTime()) 
                                                      ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                      : dateStr;
 
                                                    const plannedObj = (wvof.planned_daily_production || []).find(p => p.date === dateStr);
                                                    const plannedQty = plannedObj ? (parseFloat(plannedObj.qty) || 0) : 0;
 
                                                    const actualLogs = (wvof.production_logs || [])
                                                      .filter(log => getLocalDateString(log.timestamp) === dateStr)
                                                      .map(log => {
                                                        const logDate = new Date(log.timestamp);
                                                        const timeStr = !isNaN(logDate.getTime())
                                                          ? logDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                                                          : '';
                                                        return {
                                                          time: timeStr,
                                                          weaver: log.weaver,
                                                          qty: parseFloat(log.qty) || 0
                                                        };
                                                      });
                                                    
                                                    const sumActual = actualLogs.reduce((sum, log) => sum + log.qty, 0);
 
                                                    totalPlannedSum += plannedQty;
                                                    totalActualSum += sumActual;
 
                                                    const isDateExpanded = expandedDates[`${wvof.id}-${dateStr}`];
 
                                                    rows.push(
                                                      <tr 
                                                        key={`row-${dateStr}`}
                                                        onClick={() => {
                                                          const key = `${wvof.id}-${dateStr}`;
                                                          setExpandedDates(prev => ({ ...prev, [key]: !prev[key] }));
                                                        }}
                                                        style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer', backgroundColor: isDateExpanded ? '#fafafa' : 'transparent', transition: 'background-color 0.15s' }}
                                                        onMouseEnter={e => {
                                                          if (!isDateExpanded) e.currentTarget.style.backgroundColor = '#fafafa';
                                                        }}
                                                        onMouseLeave={e => {
                                                          if (!isDateExpanded) e.currentTarget.style.backgroundColor = 'transparent';
                                                        }}
                                                      >
                                                        <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem' }}>
                                                          {isDateExpanded ? <ChevronDown size={12} style={{ color: '#800000' }} /> : <ChevronRight size={12} style={{ color: '#64748b' }} />}
                                                        </td>
                                                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>{formattedDate}</td>
                                                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#800000', textAlign: 'right' }}>
                                                          {plannedQty > 0 ? `${Number(plannedQty).toLocaleString()} m` : '—'}
                                                        </td>
                                                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>
                                                          {sumActual > 0 ? `${Number(sumActual).toLocaleString()} m` : '—'}
                                                        </td>
                                                      </tr>
                                                    );
 
                                                    if (isDateExpanded) {
                                                      rows.push(
                                                        <tr key={`details-${dateStr}`} style={{ backgroundColor: '#fcfcfc', borderBottom: '1px solid #e2e8f0' }}>
                                                          <td colSpan="4" style={{ padding: '0.75rem 1.5rem 0.75rem 2.5rem' }}>
                                                            <div style={{ border: '1px solid #fecdd3', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                                                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                                                                <thead>
                                                                  <tr style={{ backgroundColor: '#ffe4e6', borderBottom: '1px solid #fecdd3', textAlign: 'left' }}>
                                                                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#be123c' }}>Time</th>
                                                                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#be123c' }}>Weaver Name</th>
                                                                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#be123c', textAlign: 'right' }}>Qty Produced (Mtrs)</th>
                                                                  </tr>
                                                                </thead>
                                                                <tbody>
                                                                  {actualLogs.length === 0 ? (
                                                                    <tr>
                                                                      <td colSpan="3" style={{ textAlign: 'center', padding: '0.6rem', color: '#64748b', fontStyle: 'italic', backgroundColor: '#fff' }}>
                                                                        No production records.
                                                                      </td>
                                                                    </tr>
                                                                  ) : (
                                                                    actualLogs.map((log, lIdx) => (
                                                                      <tr key={lIdx} style={{ backgroundColor: '#fff', borderBottom: lIdx !== actualLogs.length - 1 ? '1px solid #ffe4e6' : 'none', transition: 'background-color 0.1s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff1f2'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
                                                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '500', color: '#334155' }}>{log.time}</td>
                                                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', color: '#1e293b' }}>{log.weaver}</td>
                                                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{log.qty.toLocaleString()} m</td>
                                                                      </tr>
                                                                    ))
                                                                  )}
                                                                </tbody>
                                                              </table>
                                                            </div>
                                                          </td>
                                                        </tr>
                                                      );
                                                    }
                                                  });

                                                  rows.push(
                                                    <tr key="totals" style={{ backgroundColor: '#fafafa', fontWeight: '800' }}>
                                                      <td></td>
                                                      <td style={{ padding: '0.6rem 0.75rem' }}>Total</td>
                                                      <td style={{ padding: '0.6rem 0.75rem', color: '#800000', textAlign: 'right' }}>{totalPlannedSum.toLocaleString()} m</td>
                                                      <td style={{ padding: '0.6rem 0.75rem', color: '#047857', textAlign: 'right' }}>{totalActualSum.toLocaleString()} m</td>
                                                    </tr>
                                                  );

                                                  return rows;
                                                })()}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>

                                        {/* Greige Fabric Input Table placed below Daily Production Schedule & Logs */}
                                        <div style={{ marginTop: '1.5rem' }}>
                                          <h6 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span style={{ width: '4px', height: '14px', backgroundColor: '#800000', borderRadius: '2px', display: 'inline-block' }}></span>
                                            Greige Fabric Input
                                          </h6>
                                          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                              <thead>
                                                <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                                  <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Received Date & Time</th>
                                                  <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Fabric Roll ID</th>
                                                  <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty (Mtrs)</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {(() => {
                                                  const rolls = (wvof.fabric_rolls || []).filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing');
                                                  if (rolls.length === 0) {
                                                    return (
                                                      <tr>
                                                        <td colSpan="3" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                                          No received greige fabric rolls found for this order form.
                                                        </td>
                                                      </tr>
                                                    );
                                                  }
                                                  const totalQty = rolls.reduce((sum, roll) => sum + (parseFloat(roll.qty) || 0), 0);
                                                  return (
                                                    <>
                                                      {rolls
                                                        .sort((a, b) => new Date(b.received_at || 0) - new Date(a.received_at || 0))
                                                        .map((roll, rIdx) => (
                                                          <tr key={roll.id || rIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                            <td style={{ padding: '0.6rem 0.75rem' }}>
                                                              {roll.received_at ? new Date(roll.received_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                            </td>
                                                            <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', fontFamily: 'monospace' }}>{roll.id}</td>
                                                            <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{Number(roll.qty).toLocaleString()} m</td>
                                                          </tr>
                                                        ))}
                                                      <tr style={{ backgroundColor: '#fafafa', fontWeight: '800' }}>
                                                        <td colSpan="2" style={{ padding: '0.6rem 0.75rem' }}>Total Greige Fabric Input Qty</td>
                                                        <td style={{ padding: '0.6rem 0.75rem', color: '#047857', textAlign: 'right' }}>{totalQty.toLocaleString()} m</td>
                                                      </tr>
                                                    </>
                                                  );
                                                })()}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {activeDetailTab === 'delivery_receipt' && (
                                      <PrintableWVOFDC
                                        wvof={wvof}
                                        order={order}
                                        producedQty={(wvof.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0)}
                                      />
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
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header Row (no-print) */}
          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontWeight: '800', fontSize: '1rem', color: '#800000', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Overall Production Dashboard
            </h4>
            
            {/* Sub-tabs Selector */}
            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '30px', padding: '3px', border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setActiveProductionSubTab('gantt')}
                style={{
                  padding: '0.5rem 1.25rem',
                  border: 'none',
                  borderRadius: '20px',
                  backgroundColor: activeProductionSubTab === 'gantt' ? '#800000' : 'transparent',
                  color: activeProductionSubTab === 'gantt' ? 'white' : '#64748b',
                  fontWeight: '700',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.2s ease',
                  boxShadow: activeProductionSubTab === 'gantt' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <Calendar size={14} />
                Timeline (Gantt)
              </button>
              <button
                onClick={() => setActiveProductionSubTab('excel')}
                style={{
                  padding: '0.5rem 1.25rem',
                  border: 'none',
                  borderRadius: '20px',
                  backgroundColor: activeProductionSubTab === 'excel' ? '#800000' : 'transparent',
                  color: activeProductionSubTab === 'excel' ? 'white' : '#64748b',
                  fontWeight: '700',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.2s ease',
                  boxShadow: activeProductionSubTab === 'excel' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <Grid size={14} />
                Daily Sheet (Excel)
              </button>
            </div>
          </div>

          {activeProductionSubTab === 'gantt' ? (
            /* GANTT TIMELINE CHART VIEW */
            <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {wvofs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed var(--border-current)', borderRadius: '8px', color: 'var(--text-muted-current)' }}>
                  No Weaving Order Forms found to display timeline.
                </div>
              ) : (
                <div style={{
                  backgroundColor: '#fff',
                  border: '1px solid var(--border-current)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                  padding: '1.25rem',
                  overflowX: 'auto'
                }}>
                  <div style={{ display: 'flex', width: '100%', minWidth: '900px', flexDirection: 'column' }}>
                    
                    {/* Gantt Header */}
                    <div style={{
                      display: 'flex',
                      borderBottom: '2px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      fontWeight: '800',
                      fontSize: '0.7rem',
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderTopLeftRadius: '8px',
                      borderTopRightRadius: '8px'
                    }}>
                      <div style={{
                        width: '360px',
                        minWidth: '360px',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        borderRight: '1px solid #cbd5e1',
                        fontWeight: '800'
                      }}>
                        WEAVING ORDER FORM
                      </div>
                      
                      {/* Timeline dates header */}
                      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                        {minMaxDates.dates.map((d, i) => {
                          const dateObj = new Date(d + 'T00:00:00');
                          const dayNum = dateObj.getDate();
                          const monthStr = dateObj.toLocaleDateString('en-IN', { month: 'short' });
                          const dayOfWeek = dateObj.getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                          return (
                            <div 
                              key={i} 
                              style={{ 
                                flex: 1,
                                textAlign: 'center', 
                                padding: '0.5rem 0',
                                borderRight: '1px solid #cbd5e1',
                                backgroundColor: isWeekend ? '#fef2f2' : 'transparent',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center'
                              }}
                            >
                              <span style={{ fontSize: '0.75rem', fontWeight: '750', color: isWeekend ? '#ef4444' : '#1e293b' }}>{dayNum}</span>
                              <span style={{ fontSize: '0.55rem', textTransform: 'uppercase', opacity: 0.8, color: isWeekend ? '#ef4444' : '#64748b' }}>{monthStr}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
 
                    {/* Gantt Timeline rows */}
                    <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                      {/* Grid background vertical lines */}
                      <div style={{ display: 'flex', position: 'absolute', top: 0, bottom: 0, left: 360, right: 0, pointerEvents: 'none', zIndex: 1 }}>
                        {minMaxDates.dates.map((d, i) => {
                          const dateObj = new Date(d + 'T00:00:00');
                          const dayOfWeek = dateObj.getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                          return (
                            <div 
                              key={i} 
                              style={{ 
                                flex: 1,
                                borderRight: '1px solid #f1f5f9', 
                                backgroundColor: isWeekend ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                                height: '100%' 
                              }} 
                            />
                          );
                        })}
                      </div>
 
                      {/* Weaving Form Rows */}
                      {wvofs.map(wv => {
                        const isGanttExpanded = expandedGanttId === wv.id;
                        const allocation = wv.weaving_type === 'in_house' 
                          ? `Loom: ${wv.machine?.machine_name || wv.machine_name || '—'}` 
                          : `Job: ${wv.partner?.partner_name || wv.partner_name || '—'}`;
                        
                        const actualQty = Array.isArray(wv.production_logs)
                          ? wv.production_logs.reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0)
                          : 0;

                        const ganttFabricRolls = Array.isArray(wv.fabric_rolls) ? wv.fabric_rolls : [];
                        const ganttGreigeRolls = wv.weaving_type === 'in_house'
                          ? ganttFabricRolls.filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing')
                          : ganttFabricRolls.filter(r => r.gfrr_no);
                        const ganttGreigeInputQty = ganttGreigeRolls.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0);
 
                        const plannedPos = calculateBarPosition(wv.start_date, wv.end_date);
                        const actualPos = calculateBarPosition(wv.process_started_at, wv.process_completed_at || (wv.process_started_at ? new Date().toISOString() : null));
 
                        const tooltipText = `Weaving Order Form: ${wv.weaving_number}
Planned Date: ${wv.start_date ? new Date(wv.start_date).toLocaleDateString('en-IN') : '—'} to ${wv.end_date ? new Date(wv.end_date).toLocaleDateString('en-IN') : '—'}
Actual Start Date: ${wv.process_started_at ? new Date(wv.process_started_at).toLocaleDateString('en-IN') : '—'}
Actual End Date: ${wv.process_completed_at ? new Date(wv.process_completed_at).toLocaleDateString('en-IN') : 'Active'}
Status: ${getWvofStatusBadge(wv).label}
Yarn Status: ${getWeftYarnStatus(wv, dydi).label}`;
 
                        return (
                          <React.Fragment key={wv.id}>
                            <div 
                              style={{ 
                                display: 'flex', 
                                borderBottom: '1px solid #e2e8f0', 
                                minHeight: '68px', 
                                position: 'relative',
                                backgroundColor: isGanttExpanded ? '#f8fafc' : 'transparent',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => {
                                if (!isGanttExpanded) {
                                  e.currentTarget.style.backgroundColor = '#f8fafc';
                                }
                              }}
                              onMouseLeave={e => {
                                if (!isGanttExpanded) {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                            >
                              {/* Left Info Panel */}
                              <div 
                                onClick={() => setExpandedGanttId(isGanttExpanded ? null : wv.id)}
                                style={{ 
                                  width: '360px', 
                                  minWidth: '360px', 
                                  padding: '0.5rem 1rem', 
                                  borderRight: '1px solid #cbd5e1', 
                                  backgroundColor: '#f8fafc', 
                                  zIndex: 2, 
                                  display: 'flex', 
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  overflow: 'hidden'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', overflow: 'hidden' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px' }}>
                                    {isGanttExpanded ? <ChevronDown size={14} style={{ color: '#800000', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#64748b', flexShrink: 0 }} />}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', overflow: 'hidden', flex: 1 }}>
                                    <span 
                                      style={{ 
                                        fontWeight: '750', 
                                        color: '#800000', 
                                        fontFamily: 'monospace', 
                                        fontSize: '0.78rem',
                                        whiteSpace: 'nowrap',
                                        textOverflow: 'ellipsis',
                                        overflow: 'hidden',
                                        display: 'block'
                                      }} 
                                      title={wv.weaving_number}
                                    >
                                      {wv.weaving_number}
                                    </span>
                                    <span 
                                      style={{ 
                                        fontSize: '0.68rem', 
                                        color: 'var(--text-muted-current)', 
                                        fontWeight: '600',
                                        whiteSpace: 'nowrap',
                                        textOverflow: 'ellipsis',
                                        overflow: 'hidden',
                                        display: 'block'
                                      }} 
                                      title={allocation}
                                    >
                                      {allocation}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.63rem', color: 'var(--text-muted-current)', flexWrap: 'wrap' }}>
                                      <span>Target: <strong style={{ color: 'var(--text-current)' }}>{wv.qty?.toLocaleString()}m</strong></span>
                                      <span>•</span>
                                      <span style={{ color: '#15803d' }}>Weaved: <strong>{actualQty?.toLocaleString()}m</strong></span>
                                      <span>•</span>
                                      <span style={{ color: '#0369a1' }}>Greige In: <strong>{ganttGreigeInputQty.toLocaleString()}m</strong></span>
                                    </div>
                                  </div>
                                </div>
                              </div>
 
                              {/* Right Gantt Chart Panel */}
                              <div style={{ flex: 1, position: 'relative', height: '64px', overflow: 'visible', zIndex: 2 }}>
                                {/* Planned Bar */}
                                {plannedPos.visible && (
                                  <div 
                                    onClick={() => setExpandedGanttId(isGanttExpanded ? null : wv.id)}
                                    style={{ 
                                      position: 'absolute', 
                                      left: plannedPos.left, 
                                      width: plannedPos.width, 
                                      top: '8px', 
                                      height: '20px', 
                                      background: 'linear-gradient(90deg, #e0f2fe, #bae6fd)', 
                                      border: '1px solid #7dd3fc', 
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '0 6px',
                                      fontSize: '0.62rem',
                                      color: '#0369a1',
                                      fontWeight: '800',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={e => {
                                      e.currentTarget.style.transform = 'scaleY(1.08)';
                                      e.currentTarget.style.filter = 'brightness(0.98)';
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.transform = 'none';
                                      e.currentTarget.style.filter = 'none';
                                    }}
                                    title={tooltipText}
                                  >
                                    Planned: {wv.qty?.toLocaleString()} m
                                  </div>
                                )}
 
                                {/* Actual Bar */}
                                {actualPos.visible && (
                                  <div 
                                    onClick={() => setExpandedGanttId(isGanttExpanded ? null : wv.id)}
                                    style={{ 
                                      position: 'absolute', 
                                      left: actualPos.left, 
                                      width: actualPos.width, 
                                      top: '34px', 
                                      height: '20px', 
                                      background: 'linear-gradient(90deg, #dcfce7, #bbf7d0)', 
                                      border: '1px solid #86efac', 
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '0 6px',
                                      fontSize: '0.62rem',
                                      color: '#15803d',
                                      fontWeight: '800',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={e => {
                                      e.currentTarget.style.transform = 'scaleY(1.08)';
                                      e.currentTarget.style.filter = 'brightness(0.98)';
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.transform = 'none';
                                      e.currentTarget.style.filter = 'none';
                                    }}
                                    title={tooltipText}
                                  >
                                    Actual: {actualQty?.toLocaleString()} m
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Expanded details container */}
                            {isGanttExpanded && (
                              <div style={{ backgroundColor: '#fdfdfd', borderBottom: '2px solid var(--border-current)', zIndex: 10, position: 'relative' }}>
                                <div style={{ padding: '1.5rem', borderLeft: '4px solid #800000', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                                  
                                  {/* Row 1: Weft Yarn Allotments and DYDRs */}
                                  <div className="grid-2-to-1" style={{ gap: '1.5rem' }}>
                                    
                                    {/* Allotments */}
                                    <div style={{ 
                                      backgroundColor: '#fff', 
                                      borderRadius: '12px', 
                                      border: '1px solid #e2e8f0', 
                                      padding: '1.25rem', 
                                      boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)',
                                      display: 'flex',
                                      flexDirection: 'column'
                                    }}>
                                      <h6 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span style={{ width: '4px', height: '14px', backgroundColor: '#800000', borderRadius: '2px', display: 'inline-block' }}></span>
                                        Weft Yarn Requirements
                                      </h6>
                                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                          <thead>
                                            <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#475569' }}>Colour</th>
                                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#475569' }}>Count</th>
                                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#475569', textAlign: 'right' }}>Allotted (kg)</th>
                                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#475569', textAlign: 'right' }}>Delivered (kg)</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(!wv.weft_allotments || wv.weft_allotments.length === 0) ? (
                                              <tr>
                                                <td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontStyle: 'italic' }}>No requirements.</td>
                                              </tr>
                                            ) : (
                                              wv.weft_allotments.map((allot, aIdx) => {
                                                const yc = yarnCounts.find(y => y.id === (allot.countId || allot.yarn_count_id));
                                                const countDisplay = yc ? `${yc.count_value} ${yc.material}` : (allot.countValue || '—');
                                                
                                                const matchingDel = dydi.filter(d => 
                                                  d.production_form_id === wv.id && 
                                                  d.colour === allot.colour && 
                                                  (d.yarn_count_id === allot.countId || d.yarn_count_id === allot.yarn_count_id)
                                                );
                                                const deliveredQty = matchingDel.reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);
                                                
                                                return (
                                                  <tr key={aIdx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafafa'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>{allot.colour}</td>
                                                    <td style={{ padding: '0.6rem 0.75rem', color: '#475569' }}>{countDisplay}</td>
                                                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', textAlign: 'right' }}>{parseFloat(allot.allotted_qty || 0).toFixed(1)}</td>
                                                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{deliveredQty.toFixed(1)}</td>
                                                  </tr>
                                                );
                                              })
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
 
                                    {/* Associated DYDRs */}
                                    <div style={{ 
                                      backgroundColor: '#fff', 
                                      borderRadius: '12px', 
                                      border: '1px solid #e2e8f0', 
                                      padding: '1.25rem', 
                                      boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)',
                                      display: 'flex',
                                      flexDirection: 'column'
                                    }}>
                                      <h6 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span style={{ width: '4px', height: '14px', backgroundColor: '#800000', borderRadius: '2px', display: 'inline-block' }}></span>
                                        Dyed Delivery Receipts (DYDR)
                                      </h6>
                                      {dydi.filter(d => d.production_form_id === wv.id).length === 0 ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '80px', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic' }}>
                                          No receipts found.
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                                          {(() => {
                                            const formDydis = dydi.filter(d => d.production_form_id === wv.id);
                                            const uniqueDydrs = {};
                                            formDydis.forEach(item => {
                                              if (item.delivery) {
                                                uniqueDydrs[item.delivery.id] = item.delivery;
                                              }
                                            });
                                            return Object.values(uniqueDydrs).map((del, dIdx) => {
                                              const weight = formDydis.filter(item => item.delivery?.id === del.id).reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);
                                              return (
                                                <div 
                                                  key={dIdx} 
                                                  onClick={() => {
                                                    const items = formDydis.filter(item => item.delivery?.id === del.id);
                                                    setSelectedDydr({
                                                      ...del,
                                                      weaving: wv,
                                                      items: items.map(it => ({ ...it, orders: order }))
                                                    });
                                                  }}
                                                  style={{
                                                    padding: '0.5rem 0.8rem',
                                                    backgroundColor: '#fff',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                                  }}
                                                  onMouseEnter={e => {
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                    e.currentTarget.style.borderColor = '#800000';
                                                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(128, 0, 0, 0.08)';
                                                  }}
                                                  onMouseLeave={e => {
                                                    e.currentTarget.style.transform = 'none';
                                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)';
                                                  }}
                                                >
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <FileText size={14} style={{ color: '#800000' }} />
                                                    <span style={{ fontWeight: '700', fontFamily: 'monospace', color: '#1e293b' }}>{del.dydr_number}</span>
                                                  </div>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                    <span style={{ padding: '0.15rem 0.4rem', backgroundColor: '#e8f5e9', color: '#1b5e20', borderRadius: '4px', fontWeight: '800', fontSize: '0.68rem' }}>
                                                      {weight.toFixed(1)} kg
                                                    </span>
                                                    <span style={{ color: '#800000', fontWeight: '700', fontSize: '0.68rem', opacity: 0.85 }}>View</span>
                                                  </div>
                                                </div>
                                              );
                                            });
                                          })()}
                                        </div>
                                      )}
                                    </div>
                                  </div>
 
                                  {/* Row 2: Daily production schedule and logs */}
                                  <div style={{ 
                                    backgroundColor: '#fff', 
                                    borderRadius: '12px', 
                                    border: '1px solid #e2e8f0', 
                                    padding: '1.25rem', 
                                    boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)'
                                  }}>
                                    <h6 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <span style={{ width: '4px', height: '14px', backgroundColor: '#800000', borderRadius: '2px', display: 'inline-block' }}></span>
                                      Daily Production Logs & Planned Data
                                    </h6>
                                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                        <thead>
                                          <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                            <th style={{ width: '40px', padding: '0.6rem 0.75rem' }}></th>
                                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: '750', color: '#475569' }}>Date</th>
                                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: '750', color: '#475569', textAlign: 'right' }}>Planned Production (Mtrs)</th>
                                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: '750', color: '#475569', textAlign: 'right' }}>Daily Production (Mtrs)</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(() => {
                                            const uniqueDates = new Set();
                                            (wv.planned_daily_production || []).forEach(p => { if (p.date) uniqueDates.add(p.date); });
                                            (wv.production_logs || []).forEach(log => {
                                              const dateStr = getLocalDateString(log.timestamp);
                                              if (dateStr) uniqueDates.add(dateStr);
                                            });
                                            const sortedDates = Array.from(uniqueDates).sort();
 
                                            if (sortedDates.length === 0) {
                                              return (
                                                <tr>
                                                  <td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontStyle: 'italic' }}>No production records entered yet.</td>
                                                </tr>
                                              );
                                            }
 
                                            let totalPlannedSum = 0;
                                            let totalActualSum = 0;
                                            const rows = [];
 
                                            sortedDates.forEach(dateStr => {
                                              const d = new Date(dateStr + 'T00:00:00');
                                              const formattedDate = !isNaN(d.getTime()) 
                                                ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                : dateStr;
 
                                              const plannedObj = (wv.planned_daily_production || []).find(p => p.date === dateStr);
                                              const plannedQty = plannedObj ? (parseFloat(plannedObj.qty) || 0) : 0;
 
                                              const actualLogs = (wv.production_logs || [])
                                                .filter(log => getLocalDateString(log.timestamp) === dateStr);
                                              const sumActual = actualLogs.reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
 
                                              totalPlannedSum += plannedQty;
                                              totalActualSum += sumActual;
 
                                              const isDateExpanded = expandedGanttDates[`${wv.id}-${dateStr}`];
 
                                              rows.push(
                                                <tr 
                                                  key={`row-${dateStr}`}
                                                  onClick={() => {
                                                    const key = `${wv.id}-${dateStr}`;
                                                    setExpandedGanttDates(prev => ({ ...prev, [key]: !prev[key] }));
                                                  }}
                                                  style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer', backgroundColor: isDateExpanded ? '#fafafa' : 'transparent', transition: 'background-color 0.15s' }}
                                                  onMouseEnter={e => {
                                                    if (!isDateExpanded) e.currentTarget.style.backgroundColor = '#fafafa';
                                                  }}
                                                  onMouseLeave={e => {
                                                    if (!isDateExpanded) e.currentTarget.style.backgroundColor = 'transparent';
                                                  }}
                                                >
                                                  <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem' }}>
                                                    {isDateExpanded ? <ChevronDown size={12} style={{ color: '#800000' }} /> : <ChevronRight size={12} style={{ color: '#64748b' }} />}
                                                  </td>
                                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>{formattedDate}</td>
                                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#800000' }}>{plannedQty > 0 ? `${plannedQty.toLocaleString()} m` : '—'}</td>
                                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#047857' }}>{sumActual > 0 ? `${sumActual.toLocaleString()} m` : '—'}</td>
                                                </tr>
                                              );
 
                                              if (isDateExpanded) {
                                                rows.push(
                                                  <tr key={`details-${dateStr}`} style={{ backgroundColor: '#fcfcfc', borderBottom: '1px solid #e2e8f0' }}>
                                                    <td colSpan="4" style={{ padding: '0.75rem 1.5rem 0.75rem 2.5rem' }}>
                                                      <div style={{ border: '1px solid #fecdd3', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                                                          <thead>
                                                            <tr style={{ backgroundColor: '#ffe4e6', borderBottom: '1px solid #fecdd3', textAlign: 'left' }}>
                                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#be123c' }}>Date</th>
                                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#be123c' }}>Time</th>
                                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#be123c' }}>WVOF Number</th>
                                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#be123c' }}>Weaver Name</th>
                                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#be123c', textAlign: 'right' }}>Qty Produced (Mtrs)</th>
                                                            </tr>
                                                          </thead>
                                                          <tbody>
                                                            {actualLogs.length === 0 ? (
                                                              <tr>
                                                                <td colSpan="5" style={{ textAlign: 'center', padding: '0.6rem', color: '#64748b', fontStyle: 'italic', backgroundColor: '#fff' }}>
                                                                  No production records.
                                                                </td>
                                                              </tr>
                                                            ) : (
                                                              actualLogs.map((log, lIdx) => {
                                                                const logDate = new Date(log.timestamp);
                                                                const timeStr = !isNaN(logDate.getTime())
                                                                  ? logDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                                                                  : '';
                                                                return (
                                                                  <tr key={lIdx} style={{ backgroundColor: '#fff', borderBottom: lIdx !== actualLogs.length - 1 ? '1px solid #ffe4e6' : 'none', transition: 'background-color 0.1s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff1f2'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
                                                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: '500', color: '#334155' }}>{formattedDate}</td>
                                                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: '500', color: '#334155' }}>{timeStr}</td>
                                                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', fontFamily: 'monospace', color: '#800000' }}>{wv.weaving_number}</td>
                                                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', color: '#1e293b' }}>{log.weaver}</td>
                                                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{parseFloat(log.qty || 0).toLocaleString()} m</td>
                                                                  </tr>
                                                                );
                                                              })
                                                            )}
                                                          </tbody>
                                                        </table>
                                                      </div>
                                                    </td>
                                                  </tr>
                                                );
                                              }
                                            });
 
                                            rows.push(
                                              <tr key="totals" style={{ backgroundColor: '#fafafa', fontWeight: '800' }}>
                                                <td></td>
                                                <td style={{ padding: '0.6rem 0.75rem' }}>Total</td>
                                                <td style={{ padding: '0.6rem 0.75rem', color: '#800000', textAlign: 'right' }}>{totalPlannedSum.toLocaleString()} m</td>
                                                <td style={{ padding: '0.6rem 0.75rem', color: '#047857', textAlign: 'right' }}>{totalActualSum.toLocaleString()} m</td>
                                              </tr>
                                            );
 
                                            return rows;
                                          })()}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
 
                                  {/* Row 3: Greige Fabric Input */}
                                  <div style={{ 
                                    backgroundColor: '#fff', 
                                    borderRadius: '12px', 
                                    border: '1px solid #e2e8f0', 
                                    padding: '1.25rem', 
                                    boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)',
                                    display: 'flex',
                                    flexDirection: 'column'
                                  }}>
                                    <h6 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <span style={{ width: '4px', height: '14px', backgroundColor: '#800000', borderRadius: '2px', display: 'inline-block' }}></span>
                                      Greige Fabric Input
                                    </h6>
                                    {(() => {
                                      const rolls = (wv.fabric_rolls || []).filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing');
                                      if (rolls.length === 0) {
                                        return (
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80px', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic' }}>
                                            No received rolls.
                                          </div>
                                        );
                                      }
                                      const totalQty = rolls.reduce((sum, roll) => sum + (parseFloat(roll.qty) || 0), 0);
                                      return (
                                        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                            <thead>
                                              <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                                <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#475569' }}>Received Date & Time</th>
                                                <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#475569' }}>Fabric Roll ID</th>
                                                <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#475569', textAlign: 'right' }}>Qty (Mtrs)</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {rolls
                                                .sort((a, b) => new Date(b.received_at || 0) - new Date(a.received_at || 0))
                                                .map((roll, rIdx) => (
                                                  <tr key={roll.id || rIdx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafafa'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                    <td style={{ padding: '0.6rem 0.75rem', color: '#334155' }}>
                                                      {roll.received_at ? new Date(roll.received_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    </td>
                                                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', fontFamily: 'monospace', color: '#1e293b' }}>{roll.id}</td>
                                                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{Number(roll.qty).toLocaleString()} m</td>
                                                  </tr>
                                                ))}
                                              <tr style={{ backgroundColor: '#fafafa', fontWeight: '800', borderTop: '1px solid #cbd5e1' }}>
                                                <td colSpan="2" style={{ padding: '0.6rem 0.75rem' }}>Total Greige Fabric Input Qty</td>
                                                <td style={{ padding: '0.6rem 0.75rem', color: '#047857', textAlign: 'right' }}>{totalQty.toLocaleString()} m</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      );
                                    })()}
                                  </div>
 
                                </div>
                              </div>
                            )}

                          </React.Fragment>
                        );
                      })}
                    </div>

                  </div>
                </div>
              )}
            </div>
          ) : (
            /* EXCEL VIEW */
            <div>
              {/* Sheet Action Bar (hidden in print) */}
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                  Interactive Daily Sheet grid. Highlights Planned (P) and Actual (A) quantities for each Weaving Order Form.
                </div>
                <button
                  onClick={() => window.print()}
                  style={{
                    backgroundColor: '#800000',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.45rem 1rem',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#600000'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#800000'}
                >
                  <Printer size={14} />
                  Print Production Sheet
                </button>
              </div>

              {/* Printable Header Info (only visible in print) */}
              <div className="visible-print-only" style={{ display: 'none', borderBottom: '2px solid #000', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                <h2 style={{ margin: '0 0 0.25rem 0', color: '#800000', fontSize: '1.3rem', fontWeight: '850' }}>ASHOK TEXTILES</h2>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: '750' }}>DAILY WEAVING PRODUCTION SHEET</h3>
                <div style={{ fontSize: '0.78rem', display: 'flex', gap: '2rem' }}>
                  <span>Order Number: <strong>{order.order_number}</strong></span>
                  <span>Design: <strong>{order.design_no} / {order.design_name}</strong></span>
                  <span>Print Date: {new Date().toLocaleDateString('en-IN')}</span>
                </div>
              </div>

              {/* Spreadsheet Grid Table */}
              <div className="excel-table-wrapper" style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#fff' }}>
                <table className="excel-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: tableFontSize, fontFamily: 'monospace' }}>
                  <thead>
                    {/* Row 1: WVOF Column numbers */}
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th className="date-column" style={{ padding: headerPadding, borderRight: '1px solid #cbd5e1', width: dateWidth, minWidth: dateWidth, textAlign: 'left', fontWeight: '800' }}>
                        DATE
                      </th>
                      <th className="total-column" style={{ padding: headerPadding, borderRight: '1px solid #cbd5e1', width: totalWidth, minWidth: totalWidth, textAlign: 'center', fontWeight: '800', color: '#b45309', fontSize: headerFontSize }}>
                        TOTAL PLANNED
                      </th>
                      <th className="total-column" style={{ padding: headerPadding, borderRight: '2px solid #cbd5e1', width: totalWidth, minWidth: totalWidth, textAlign: 'center', fontWeight: '800', color: '#15803d', fontSize: headerFontSize }}>
                        TOTAL ACTUAL
                      </th>
                      {wvofs.map(form => (
                        <th 
                          key={form.id} 
                          colSpan={2}
                          className="wrap-header"
                          style={{ 
                            padding: headerPadding, 
                            borderRight: '1px solid #cbd5e1', 
                            textAlign: 'center', 
                            fontWeight: '800', 
                            color: '#800000', 
                            fontSize: headerFontSize,
                            wordBreak: 'break-all',
                            whiteSpace: 'normal'
                          }}
                        >
                          {form.weaving_number ? (
                            form.weaving_number.split('/').map((part, pIdx, arr) => (
                              <React.Fragment key={pIdx}>
                                {part}
                                {pIdx < arr.length - 1 && <>/<wbr /></>}
                              </React.Fragment>
                            ))
                          ) : '—'}
                        </th>
                      ))}
                    </tr>
                    {/* Row 2: Loom / Job info */}
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      <td style={{ padding: cellPadding, borderRight: '1px solid #cbd5e1', fontWeight: '700', color: '#475569' }}>
                        LOOM / JOB
                      </td>
                      <td style={{ padding: cellPadding, borderRight: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '700', color: '#cbd5e1', fontSize: subHeaderFontSize }}>
                        —
                      </td>
                      <td style={{ padding: cellPadding, borderRight: '2px solid #cbd5e1', textAlign: 'center', fontWeight: '700', color: '#cbd5e1', fontSize: subHeaderFontSize }}>
                        —
                      </td>
                      {wvofs.map(form => {
                        const allocation = form.weaving_type === 'in_house'
                          ? form.machine?.machine_name || form.machine_name || 'In-house'
                          : form.partner?.partner_name || form.partner_name || 'Job Work';
                        return (
                          <td 
                            key={form.id} 
                            colSpan={2}
                            className="wrap-cell"
                            style={{ 
                              padding: cellPadding, 
                              borderRight: '1px solid #cbd5e1', 
                              textAlign: 'center', 
                              fontWeight: '600', 
                              color: '#475569',
                              fontSize: subHeaderFontSize,
                              wordBreak: 'break-all',
                              whiteSpace: 'normal'
                            }}
                          >
                            {allocation ? (
                              allocation.split('/').map((part, pIdx, arr) => (
                                <React.Fragment key={pIdx}>
                                  {part}
                                  {pIdx < arr.length - 1 && <>/<wbr /></>}
                                </React.Fragment>
                              ))
                            ) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                    {/* Row 3: Target Qty */}
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      <td style={{ padding: cellPadding, borderRight: '1px solid #cbd5e1', fontWeight: '700', color: '#475569' }}>
                        TARGET (M)
                      </td>
                      <td className="total-column" style={{ padding: cellPadding, borderRight: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '750', color: '#b45309', fontSize: headerFontSize }}>
                        {wvofs.reduce((sum, f) => sum + (parseFloat(f.qty) || 0), 0).toLocaleString()} m
                      </td>
                      <td className="total-column" style={{ padding: cellPadding, borderRight: '2px solid #cbd5e1', textAlign: 'center', fontWeight: '750', color: '#15803d', fontSize: headerFontSize }}>
                        {totalWeavedQty.toLocaleString()} m
                      </td>
                      {wvofs.map(form => (
                        <td 
                          key={form.id} 
                          colSpan={2}
                          style={{ 
                            padding: cellPadding, 
                            borderRight: '1px solid #cbd5e1', 
                            textAlign: 'center', 
                            fontWeight: '750', 
                            color: 'var(--text-current)',
                            fontSize: headerFontSize
                          }}
                        >
                          {form.qty?.toLocaleString()} m
                        </td>
                      ))}
                    </tr>
                    {/* Row 4: Total Planned Qty */}
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      <td style={{ padding: cellPadding, borderRight: '1px solid #cbd5e1', fontWeight: '700', color: '#b45309' }}>
                        PLANNED (M)
                      </td>
                      <td className="total-column" style={{ padding: cellPadding, borderRight: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '750', color: '#b45309', fontSize: headerFontSize }}>
                        {excelOverallTotals.planned.toLocaleString()} m
                      </td>
                      <td className="total-column" style={{ padding: cellPadding, borderRight: '2px solid #cbd5e1', textAlign: 'center', fontWeight: '700', color: '#cbd5e1', fontSize: subHeaderFontSize }}>
                        —
                      </td>
                      {wvofs.map(form => {
                        const formTotals = excelTotals[form.id] || { planned: 0, actual: 0 };
                        return (
                          <td 
                            key={form.id} 
                            colSpan={2}
                            style={{ 
                              padding: cellPadding, 
                              borderRight: '1px solid #cbd5e1', 
                              textAlign: 'center', 
                              fontWeight: '750', 
                              color: '#b45309',
                              fontSize: headerFontSize
                            }}
                          >
                            {formTotals.planned.toLocaleString()} m
                          </td>
                        );
                      })}
                    </tr>
                    {/* Row 5: Total Actual Qty */}
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      <td rowSpan={2} style={{ padding: cellPadding, borderRight: '1px solid #cbd5e1', fontWeight: '700', color: '#15803d', verticalAlign: 'middle' }}>
                        ACTUAL (M)
                      </td>
                      <td rowSpan={2} style={{ padding: cellPadding, borderRight: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '700', color: '#cbd5e1', fontSize: subHeaderFontSize, verticalAlign: 'middle' }}>
                        —
                      </td>
                      <td rowSpan={2} style={{ padding: cellPadding, borderRight: '2px solid #cbd5e1', textAlign: 'center', fontWeight: '750', color: '#15803d', fontSize: headerFontSize, verticalAlign: 'middle' }}>
                        {excelOverallTotals.actual.toLocaleString()} m
                      </td>
                      {wvofs.map(form => {
                        const formTotals = excelTotals[form.id] || { planned: 0, actual: 0 };
                        return (
                          <td 
                            key={form.id} 
                            colSpan={2}
                            style={{ 
                              padding: cellPadding, 
                              borderRight: '1px solid #cbd5e1', 
                              textAlign: 'center', 
                              fontWeight: '750', 
                              color: '#15803d',
                              fontSize: headerFontSize
                            }}
                          >
                            {formTotals.actual.toLocaleString()} m
                          </td>
                        );
                      })}
                    </tr>
                    {/* Row 6: Planned & Actual Subheaders */}
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #94a3b8' }}>
                      {wvofs.map(form => (
                        <React.Fragment key={form.id}>
                          <th className="excel-sub-header" style={{ padding: subHeaderPadding, borderRight: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '800', color: '#b45309', fontSize: subHeaderFontSize }}>
                            PLANNED
                          </th>
                          <th className="excel-sub-header" style={{ padding: subHeaderPadding, borderRight: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '800', color: '#15803d', fontSize: subHeaderFontSize }}>
                            ACTUAL
                          </th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {minMaxDates.dates.map(dateStr => {
                      const dateObj = new Date(dateStr + 'T00:00:00');
                      const formattedDate = !isNaN(dateObj.getTime())
                        ? dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : dateStr;
                      
                      const dayOfWeek = dateObj.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                      // Calculate dynamic totals for this date
                      let dayTotalPlanned = 0;
                      let dayTotalActual = 0;
                      wvofs.forEach(form => {
                        const plannedObj = (form.planned_daily_production || []).find(p => p.date === dateStr);
                        dayTotalPlanned += plannedObj ? (parseFloat(plannedObj.qty) || 0) : 0;
                        
                        const actualLogs = (form.production_logs || []).filter(log => getLocalDateString(log.timestamp) === dateStr);
                        dayTotalActual += actualLogs.reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
                      });

                      return (
                        <tr 
                          key={dateStr} 
                          style={{ 
                            borderBottom: '1px solid #cbd5e1', 
                            backgroundColor: isWeekend ? '#f8fafc' : 'transparent' 
                          }}
                        >
                          {/* Vertical date header */}
                          <td 
                            className="date-column"
                            style={{ 
                              padding: cellPadding, 
                              borderRight: '2px solid #cbd5e1', 
                              fontWeight: '700', 
                              backgroundColor: '#f1f5f9',
                              color: isWeekend ? '#ef4444' : 'var(--text-current)'
                            }}
                          >
                            {formattedDate}
                          </td>
                          {/* Total Planned Cell */}
                          <td 
                            className="total-column"
                            style={{ 
                              padding: cellPadding, 
                              borderRight: '1px solid #cbd5e1', 
                              textAlign: 'center',
                              fontWeight: '750',
                              color: '#b45309',
                              backgroundColor: dayTotalPlanned > 0 ? '#fffbeb' : '#fafafa'
                            }}
                          >
                            {dayTotalPlanned > 0 ? `${dayTotalPlanned.toLocaleString()} m` : '—'}
                          </td>
                          {/* Total Actual Cell */}
                          <td 
                            className="total-column"
                            style={{ 
                              padding: cellPadding, 
                              borderRight: '2px solid #cbd5e1', 
                              textAlign: 'center',
                              fontWeight: '800',
                              color: '#15803d',
                              backgroundColor: dayTotalActual > 0 ? '#f0fdf4' : '#fafafa'
                            }}
                          >
                            {dayTotalActual > 0 ? `${dayTotalActual.toLocaleString()} m` : '—'}
                          </td>
                          {/* Grid cells */}
                          {wvofs.map(form => {
                            const plannedObj = (form.planned_daily_production || []).find(p => p.date === dateStr);
                            const plannedQty = plannedObj ? (parseFloat(plannedObj.qty) || 0) : 0;
                            
                            const actualLogs = (form.production_logs || []).filter(log => getLocalDateString(log.timestamp) === dateStr);
                            const actualQty = actualLogs.reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);

                            return (
                              <React.Fragment key={form.id}>
                                <td 
                                  style={{ 
                                    padding: cellPadding, 
                                    borderRight: '1px solid #cbd5e1', 
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    fontWeight: '600',
                                    color: '#b45309',
                                    backgroundColor: plannedQty > 0 ? '#fffbeb' : '#fafafa'
                                  }}
                                >
                                  {plannedQty > 0 ? `${plannedQty} m` : '—'}
                                </td>
                                <td 
                                  style={{ 
                                    padding: cellPadding, 
                                    borderRight: '1px solid #cbd5e1', 
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    fontWeight: '750',
                                    color: '#15803d',
                                    backgroundColor: actualQty > 0 ? '#f0fdf4' : '#fafafa'
                                  }}
                                >
                                  {actualQty > 0 ? `${actualQty} m` : '—'}
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {/* Totals Row */}
                    <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #94a3b8', fontWeight: '800' }}>
                      <td 
                        className="date-column"
                        style={{ padding: cellPadding, borderRight: '2px solid #cbd5e1', textTransform: 'uppercase' }}
                      >
                        TOTALS
                      </td>
                      {/* Overall Total Planned */}
                      <td 
                        className="total-column"
                        style={{ 
                          padding: cellPadding, 
                          borderRight: '1px solid #cbd5e1', 
                          textAlign: 'center',
                          fontSize: headerFontSize,
                          color: '#b45309',
                          fontWeight: '850'
                        }}
                      >
                        {excelOverallTotals.planned.toLocaleString()} m
                      </td>
                      {/* Overall Total Actual */}
                      <td 
                        className="total-column"
                        style={{ 
                          padding: cellPadding, 
                          borderRight: '2px solid #cbd5e1', 
                          textAlign: 'center',
                          fontSize: headerFontSize,
                          color: '#047857',
                          fontWeight: '850'
                        }}
                      >
                        {excelOverallTotals.actual.toLocaleString()} m
                      </td>
                      {wvofs.map(form => {
                        const formTotals = excelTotals[form.id] || { planned: 0, actual: 0 };
                        return (
                          <React.Fragment key={form.id}>
                            <td 
                              style={{ 
                                padding: cellPadding, 
                                borderRight: '1px solid #cbd5e1', 
                                textAlign: 'center',
                                fontSize: subHeaderFontSize,
                                color: '#b45309',
                                fontWeight: '800'
                              }}
                            >
                              {formTotals.planned.toLocaleString()} m
                            </td>
                            <td 
                              style={{ 
                                padding: cellPadding, 
                                borderRight: '1px solid #cbd5e1', 
                                textAlign: 'center',
                                fontSize: subHeaderFontSize,
                                color: '#047857',
                                fontWeight: '800'
                              }}
                            >
                              {formTotals.actual.toLocaleString()} m
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Print / Detail View Modal */}
      {printWvof && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', maxWidth: '850px', width: '100%', maxHeight: '90vh', overflow: 'auto', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <button onClick={() => setPrintWvof(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted-current)' }}>&times;</button>
            <PrintableWVOF 
              wvof={printWvof} 
              order={order} 
              machineName={printWvof.machine?.machine_name || printWvof.machine_name} 
              partnerName={printWvof.partner?.partner_name || printWvof.partner_name} 
              yarnCounts={yarnCounts} 
              weftYarnStatus={getWeftYarnStatus(printWvof, dydi)}
              deliveries={dydi}
            />
          </div>
        </div>
      )}

      {selectedDydr && (
        <DyedDeliveryPrintModal
          delivery={selectedDydr}
          weaving={selectedDydr.weaving}
          onClose={() => setSelectedDydr(null)}
          getFormatCount={(countId) => {
            const yc = yarnCounts.find(y => y.id === countId);
            return yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : '—';
          }}
        />
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .excel-print-container, .excel-print-container * {
            visibility: visible !important;
          }
          .excel-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .visible-print-only {
            display: block !important;
          }
          .excel-table-wrapper {
            overflow: visible !important;
            border: none !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .excel-table {
            width: 100% !important;
            border: 1px solid #000 !important;
            font-size: var(--table-font-size, 0.72rem) !important;
          }
          .excel-table th, .excel-table td {
            border: 1px solid #000 !important;
            padding: var(--cell-padding, 6px) !important;
            white-space: nowrap !important;
          }
          .excel-table th {
            font-size: var(--header-font-size, 0.78rem) !important;
            padding: var(--header-padding, 0.5rem) !important;
          }
          .excel-table th.excel-sub-header {
            font-size: var(--sub-header-font-size, 0.6rem) !important;
            padding: var(--sub-header-padding, 0.3rem) !important;
          }
          .excel-table td.excel-sub-header {
            font-size: var(--sub-header-font-size, 0.65rem) !important;
          }
          .excel-table th.wrap-header, .excel-table td.wrap-cell {
            white-space: normal !important;
            word-break: break-all !important;
          }
          .excel-table th.date-column, .excel-table td.date-column {
            width: var(--date-width, 120px) !important;
            min-width: var(--date-width, 120px) !important;
            max-width: var(--date-width, 120px) !important;
          }
          .excel-table th.total-column, .excel-table td.total-column {
            width: var(--total-width, 100px) !important;
            min-width: var(--total-width, 100px) !important;
            max-width: var(--total-width, 100px) !important;
          }
          @page {
            size: landscape;
            margin: 0.5cm;
          }
        }
      `}</style>
    </div>
  );
}

export default OrderWeavingTab;
