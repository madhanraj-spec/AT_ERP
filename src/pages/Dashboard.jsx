import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, ShoppingCart, Droplet, Layers, Scissors,
  ArrowRight, Loader, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, Activity, Box, CircleDot,
  ArrowUpRight, BarChart3, Zap, ArrowDownRight, Settings
} from 'lucide-react';
import { supabase } from '../lib/supabase';

function getLocalDateStr(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TODAY_STR = getLocalDateStr(new Date());

function isLate(endDate, completedAt, updatedAt, status) {
  if (!endDate) return false;
  const finishedStatuses = ['completed', 'stopped', 'received', 'late_complete', 'late_completed'];
  if (finishedStatuses.includes(status)) {
    const actualEnd = completedAt
      ? getLocalDateStr(completedAt)
      : (updatedAt ? getLocalDateStr(updatedAt) : '');
    return actualEnd > endDate;
  }
  return TODAY_STR > endDate;
}

const SECTION_COLORS = {
  orders: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', accent: '#3b82f6', light: '#dbeafe' },
  greige: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', accent: '#f59e0b', light: '#fef3c7' },
  dyeing: { bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6', accent: '#8b5cf6', light: '#ede9fe' },
  warping: { bg: '#f0fdfa', border: '#99f6e4', text: '#115e59', accent: '#14b8a6', light: '#ccfbf1' },
  weaving: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', accent: '#10b981', light: '#d1fae5' },
  processing: { bg: '#fff1f2', border: '#fecdd3', text: '#9f1239', accent: '#f43f5e', light: '#ffe4e6' },
};

function SectionCard({ section, children, style = {} }) {
  const c = SECTION_COLORS[section];
  return (
    <div style={{
      backgroundColor: 'var(--surface-current)',
      border: '1px solid var(--border-current)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        padding: '1rem 1.25rem',
        borderBottom: `1px solid var(--border-current)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: c.accent,
          }} />
          <h3 style={{
            margin: 0, fontSize: '0.9rem', fontWeight: 700,
            color: 'var(--text-current)', letterSpacing: '0.01em',
          }}>
            {section.charAt(0).toUpperCase() + section.slice(1)}
          </h3>
        </div>
      </div>
      <div style={{ padding: '1.25rem' }}>
        {children}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color, icon: Icon, navigateTo }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigateTo && navigate(navigateTo)}
      style={{
        backgroundColor: 'var(--surface-current)',
        border: '1px solid var(--border-current)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        cursor: navigateTo ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      className="hover-lift"
    >
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
        background: `linear-gradient(135deg, ${color}15, ${color}05)`,
        borderRadius: '0 var(--radius-lg) 0 50%',
      }} />
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: '0.75rem', position: 'relative',
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
          backgroundColor: `${color}12`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: color,
        }}>
          <Icon size={20} />
        </div>
        {navigateTo && (
          <ArrowUpRight size={14} style={{ color: 'var(--text-muted-current)', opacity: 0.5 }} />
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{
          fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-current)',
          lineHeight: 1, marginBottom: '0.25rem',
        }}>
          {value}
        </div>
        <div style={{
          fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted-current)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {label}
        </div>
        {sub && (
          <div style={{
            fontSize: '0.7rem', color: color, fontWeight: 600, marginTop: '0.35rem',
          }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function BarStat({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: '0.3rem',
      }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted-current)', fontWeight: 500 }}>
          {label}
        </span>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-current)' }}>
          {value.toLocaleString()}
        </span>
      </div>
      <div style={{
        height: '6px', borderRadius: '3px', backgroundColor: `${color}18`,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: '3px', backgroundColor: color,
          width: `${pct}%`, transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  );
}

function StatusPill({ count, label, color, icon: Icon }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)',
      backgroundColor: `${color}10`, border: `1px solid ${color}25`,
    }}>
      <Icon size={14} style={{ color }} />
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color }}>{count}</span>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>{label}</span>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{
      textAlign: 'center', padding: '2rem 1rem',
      color: 'var(--text-muted-current)', fontSize: '0.8rem',
    }}>
      <Package size={28} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
      <p>{message}</p>
    </div>
  );
}

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    orders: [],
    dyeingForms: [],
    warpingForms: [],
    sizingForms: [],
    weavingOrders: [],
    processingOrders: [],
    greigeReceipts: [],
    greigeDeliveryItems: [],
    dyedReceipts: [],
    machines: [],
  });

  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);
        const [ordersRes, dyeRes, warpRes, sizeRes, weaveRes, processRes, greigeRecRes, greigeDelRes, dyedRecRes, machinesRes] = await Promise.all([
          supabase.from('orders').select('*'),
          supabase.from('dyeing_order_forms').select('*'),
          supabase.from('warping_order_forms').select('*'),
          supabase.from('sizing_order_forms').select('*'),
          supabase.from('weaving_orders').select('*'),
          supabase.from('processing_orders').select('*'),
          supabase.from('greige_yarn_receipts').select(`
            id, yarn_count_id, total_weight, spinning_mill_id, location_id, created_at,
            master_yarn_counts(count_value, material)
          `),
          supabase.from('greige_yarn_delivery_items').select('yarn_count_id, quantity_kg, spinning_mill_id, location_id'),
          supabase.from('dyed_yarn_receipts').select('*'),
          supabase.from('master_machines').select('*, master_departments(department_name)'),
        ]);

        setData({
          orders: ordersRes.data || [],
          dyeingForms: dyeRes.data || [],
          warpingForms: warpRes.data || [],
          sizingForms: sizeRes.data || [],
          weavingOrders: weaveRes.data || [],
          processingOrders: processRes.data || [],
          greigeReceipts: greigeRecRes.data || [],
          greigeDeliveryItems: greigeDelRes.data || [],
          dyedReceipts: dyedRecRes.data || [],
          machines: machinesRes.data || [],
        });
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const greigeStock = useMemo(() => {
    // Clone receipts and initialize available_weight
    const receiptsClone = (data.greigeReceipts || []).map(r => ({
      ...r,
      available_weight: parseFloat(r.total_weight || 0)
    }));

    // Run FIFO stock deduction per combination of count + mill + location
    const comboKeys = {};
    receiptsClone.forEach(r => {
      const key = `${r.yarn_count_id}_${r.spinning_mill_id || 'null'}_${r.location_id}`;
      comboKeys[key] = {
        yarn_count_id: r.yarn_count_id,
        spinning_mill_id: r.spinning_mill_id,
        location_id: r.location_id
      };
    });

    Object.values(comboKeys).forEach(({ yarn_count_id, spinning_mill_id, location_id }) => {
      const comboReceipts = receiptsClone
        .filter(r => r.yarn_count_id === yarn_count_id && r.spinning_mill_id === spinning_mill_id && r.location_id === location_id)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      let totalDeliveredForCombo = (data.greigeDeliveryItems || [])
        .filter(d => d.yarn_count_id === yarn_count_id && d.spinning_mill_id === spinning_mill_id && d.location_id === location_id)
        .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

      for (const rec of comboReceipts) {
        if (totalDeliveredForCombo <= 0) break;
        const deduct = Math.min(rec.available_weight, totalDeliveredForCombo);
        rec.available_weight -= deduct;
        totalDeliveredForCombo -= deduct;
      }
    });

    // Group by count ID
    const groups = {};
    receiptsClone.forEach(r => {
      const cid = r.yarn_count_id || 'unknown';
      if (!groups[cid]) {
        const yc = r.master_yarn_counts;
        groups[cid] = {
          id: cid,
          label: yc ? `${yc.count_value}` : 'Unknown',
          material: yc?.material || '',
          total: 0,
        };
      }
      groups[cid].total += r.available_weight;
    });

    return Object.values(groups)
      .filter(g => g.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [data.greigeReceipts, data.greigeDeliveryItems]);

  const totalGreigeStock = useMemo(() =>
    greigeStock.reduce((s, i) => s + i.total, 0), [greigeStock]
  );

  const orderStats = useMemo(() => {
    const total = data.orders.length;
    const onProcess = data.orders.filter(o =>
      o.status === 'approved' && (!o.delivery_date || getLocalDateStr(o.delivery_date) >= TODAY_STR)
    ).length;
    const late = data.orders.filter(o =>
      o.status !== 'completed' && o.status !== 'cancelled' && o.delivery_date && getLocalDateStr(o.delivery_date) < TODAY_STR
    ).length;
    return { total, onProcess, late };
  }, [data.orders]);

  const dyeingStats = useMemo(() => {
    const total = data.dyeingForms.length;
    const onProcess = data.dyeingForms.filter(d =>
      d.status === 'approved' && (!d.expected_delivery_date || getLocalDateStr(d.expected_delivery_date) >= TODAY_STR)
    ).length;
    const late = data.dyeingForms.filter(d =>
      d.status !== 'rejected' && d.expected_delivery_date && getLocalDateStr(d.expected_delivery_date) < TODAY_STR
    ).length;
    return { total, onProcess, late };
  }, [data.dyeingForms]);

  const warpingStats = useMemo(() => {
    const dbInHouseMachines = (data.machines || []).filter(m => m.scope === 'in_house');
    const inHouseWarpingMachines = dbInHouseMachines.filter(m => {
      const deptName = m.master_departments?.department_name || '';
      return deptName.toLowerCase().includes('warping');
    });
    
    const finalInHouseWarpingMachines = inHouseWarpingMachines.length > 0 
      ? inHouseWarpingMachines 
      : dbInHouseMachines;
      
    const totalMachines = finalInHouseWarpingMachines.length;
    const finishedStatuses = ['completed', 'stopped', 'received', 'late_complete', 'late_completed'];

    const onProcessCount = data.warpingForms.filter(w => w.status === 'on_process').length;
    const lateCount = data.warpingForms.filter(w =>
      !finishedStatuses.includes(w.status) &&
      isLate(w.end_date, w.process_completed_at, w.updated_at, w.status)
    ).length;

    const allottedCount = finalInHouseWarpingMachines.filter(m => {
      return data.warpingForms.some(w => {
        if (finishedStatuses.includes(w.status)) return false;
        return w.machine_id && w.machine_id === m.id;
      });
    }).length;

    const idleCount = Math.max(0, totalMachines - allottedCount);

    return {
      total: data.warpingForms.length,
      totalMachines,
      onProcess: onProcessCount,
      late: lateCount,
      allotted: allottedCount,
      idle: idleCount
    };
  }, [data.warpingForms, data.machines]);

  const sizingStats = useMemo(() => {
    const dbInHouseMachines = (data.machines || []).filter(m => m.scope === 'in_house');
    const inHouseSizingMachines = dbInHouseMachines.filter(m => {
      const deptName = m.master_departments?.department_name || '';
      return deptName.toLowerCase().includes('sizing');
    });
    
    const finalInHouseSizingMachines = inHouseSizingMachines.length > 0 
      ? inHouseSizingMachines 
      : dbInHouseMachines;
      
    const totalMachines = finalInHouseSizingMachines.length;
    const finishedStatuses = ['completed', 'stopped', 'received', 'late_complete', 'late_completed'];

    const onProcessCount = data.sizingForms.filter(s => s.status === 'on_process').length;
    const lateCount = data.sizingForms.filter(s =>
      !finishedStatuses.includes(s.status) &&
      isLate(s.end_date, s.process_completed_at, s.updated_at, s.status)
    ).length;

    const allottedCount = finalInHouseSizingMachines.filter(m => {
      return data.sizingForms.some(s => {
        if (finishedStatuses.includes(s.status)) return false;
        return s.machine_id && s.machine_id === m.id;
      });
    }).length;

    const idleCount = Math.max(0, totalMachines - allottedCount);

    return {
      total: data.sizingForms.length,
      totalMachines,
      onProcess: onProcessCount,
      late: lateCount,
      allotted: allottedCount,
      idle: idleCount
    };
  }, [data.sizingForms, data.machines]);

  const weavingStats = useMemo(() => {
    const dbInHouseMachines = (data.machines || []).filter(m => m.scope === 'in_house');
    
    const MOCK_AIRJET_LOOMS = [
      { id: 'mock-aj1', machine_name: 'AJ1', scope: 'in_house' },
      { id: 'mock-aj2', machine_name: 'AJ2', scope: 'in_house' },
      { id: 'mock-aj3', machine_name: 'AJ3', scope: 'in_house' },
      { id: 'mock-aj4', machine_name: 'AJ4', scope: 'in_house' },
      { id: 'mock-aj5', machine_name: 'AJ5', scope: 'in_house' },
    ];

    const MOCK_RAPIER_LOOMS = [
      { id: 'mock-ar1', machine_name: 'AR1', scope: 'in_house' },
      { id: 'mock-ar2', machine_name: 'AR2', scope: 'in_house' },
      { id: 'mock-ar3', machine_name: 'AR3', scope: 'in_house' },
    ];

    const getLooms = (dbMachines, prefix, mockList) => {
      const dbMatch = dbMachines.filter(m => m.machine_name && m.machine_name.trim().toUpperCase().startsWith(prefix));
      const finalMachines = [...dbMatch];
      mockList.forEach(mock => {
        const exists = finalMachines.some(m => m.machine_name.trim().toUpperCase() === mock.machine_name.toUpperCase());
        if (!exists) {
          finalMachines.push(mock);
        }
      });
      return finalMachines;
    };

    const airjetLooms = getLooms(dbInHouseMachines, 'AJ', MOCK_AIRJET_LOOMS);
    const rapierLooms = getLooms(dbInHouseMachines, 'AR', MOCK_RAPIER_LOOMS);
    const finalInHouseMachines = [...airjetLooms, ...rapierLooms];
    const totalMachines = finalInHouseMachines.length;

    const finishedStatuses = ['completed', 'stopped', 'received', 'late_complete', 'late_completed'];

    const onProcessCount = data.weavingOrders.filter(w => w.status === 'on_process').length;
    const lateCount = data.weavingOrders.filter(w =>
      !finishedStatuses.includes(w.status) &&
      isLate(w.end_date, w.process_completed_at, w.updated_at, w.status)
    ).length;

    const allottedCount = finalInHouseMachines.filter(m => {
      return data.weavingOrders.some(w => {
        if (w.weaving_type !== 'in_house') return false;
        if (finishedStatuses.includes(w.status)) return false;
        
        if (w.machine_id && !m.id.startsWith('mock-') && w.machine_id === m.id) {
          return true;
        }
        if (w.machine_name && m.machine_name && w.machine_name.trim().toUpperCase() === m.machine_name.trim().toUpperCase()) {
          return true;
        }
        return false;
      });
    }).length;

    const idleCount = Math.max(0, totalMachines - allottedCount);

    const todaysProductionQty = data.weavingOrders.reduce((sum, w) => {
      if (w.weaving_type !== 'in_house') return sum;
      
      const logs = Array.isArray(w.production_logs) ? w.production_logs : [];
      const todayLogs = logs.filter(log => {
        if (!log.timestamp) return false;
        return getLocalDateStr(log.timestamp) === TODAY_STR;
      });
      
      return sum + todayLogs.reduce((acc, log) => acc + (parseFloat(log.qty) || 0), 0);
    }, 0);

    return {
      total: data.weavingOrders.length,
      totalMachines,
      onProcess: onProcessCount,
      late: lateCount,
      allotted: allottedCount,
      idle: idleCount,
      todaysProductionQty
    };
  }, [data.weavingOrders, data.machines]);

  const processingStats = useMemo(() => {
    const total = data.processingOrders.length;
    const onProcess = data.processingOrders.filter(p => p.status === 'sent_to_processing').length;
    const late = data.processingOrders.filter(p =>
      isLate(p.expected_delivery_date, p.received_at, p.updated_at, p.status)
    ).length;
    return { total, onProcess, late };
  }, [data.processingOrders]);

  const topYarnCounts = useMemo(() => greigeStock.slice(0, 5), [greigeStock]);
  const maxYarnKg = useMemo(() => Math.max(...topYarnCounts.map(y => y.total), 1), [topYarnCounts]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', flexDirection: 'column', gap: '1rem',
      }}>
        <Loader size={28} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-muted-current)', fontSize: '0.85rem' }}>Loading company overview...</p>
      </div>
    );
  }

  const sc = SECTION_COLORS;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '2rem', padding: '0 0.25rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-full)',
          backgroundColor: '#80000008', border: '1px solid #80000018',
          marginBottom: '0.75rem',
        }}>
          <Activity size={12} style={{ color: '#800000' }} />
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, color: '#800000',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            Live Telemetry
          </span>
        </div>
        <h1 style={{
          fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-current)',
          margin: '0 0 0.35rem 0', lineHeight: 1.2,
        }}>
          Enterprise Operations Overview
        </h1>
        <p style={{
          margin: 0, fontSize: '0.82rem', color: 'var(--text-muted-current)',
          maxWidth: '600px',
        }}>
          Real-time visibility into yarn inventory, production pipeline, and processing status across all departments.
        </p>
      </div>

      {/* ── Executive KPI Row ─────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem', marginBottom: '1.5rem',
      }}>
        <MetricCard
          label="Total Orders"
          value={orderStats.total}
          sub={orderStats.late > 0 ? `${orderStats.late} overdue` : `${orderStats.onProcess} on process`}
          color={orderStats.late > 0 ? '#ef4444' : sc.orders.accent}
          icon={ShoppingCart}
          navigateTo="/admin/orders"
        />
        <MetricCard
          label="Greige Yarn Stock"
          value={`${totalGreigeStock.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`}
          sub="across all counts"
          color={sc.greige.accent}
          icon={Package}
          navigateTo="/greige-yarn/stock"
        />
        <MetricCard
          label="Dyeing Orders"
          value={dyeingStats.total}
          sub={dyeingStats.late > 0 ? `${dyeingStats.late} overdue` : `${dyeingStats.onProcess} on process`}
          color={dyeingStats.late > 0 ? '#ef4444' : sc.dyeing.accent}
          icon={Droplet}
          navigateTo="/admin/dyeing-forms"
        />
        <MetricCard
          label="Processing Jobs"
          value={processingStats.total}
          sub={processingStats.late > 0 ? `${processingStats.late} overdue` : `${processingStats.onProcess} on process`}
          color={processingStats.late > 0 ? '#ef4444' : sc.processing.accent}
          icon={Settings}
          navigateTo="/processing"
        />
      </div>

      {/* ── Main 3-Column Bento Grid ──────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>

        {/* ── Greige Yarn Inventory ──────────────────────── */}
        <div
          style={{
            backgroundColor: 'var(--surface-current)',
            border: '1px solid var(--border-current)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '0.85rem 1.15rem',
            borderBottom: '1px solid var(--border-current)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/greige-yarn/stock')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: sc.greige.accent,
              }} />
              <h3 style={{
                margin: 0, fontSize: '0.85rem', fontWeight: 700,
                color: 'var(--text-current)',
              }}>
                Greige Yarn Inventory
              </h3>
            </div>
            <ArrowUpRight size={14} style={{ color: 'var(--text-muted-current)', opacity: 0.4 }} />
          </div>
          <div style={{ padding: '1.15rem' }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: '0.4rem',
              marginBottom: '1rem',
            }}>
              <span style={{
                fontSize: '1.5rem', fontWeight: 800, color: sc.greige.text,
              }}>
                {totalGreigeStock.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontWeight: 500 }}>
                kg total
              </span>
            </div>
            {topYarnCounts.length > 0 ? (
              <>
                <div style={{
                  fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted-current)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.65rem',
                }}>
                  Top Yarn Counts
                </div>
                {topYarnCounts.map((y, i) => (
                  <BarStat
                    key={i}
                    label={`${y.label} ${y.material}`}
                    value={y.total}
                    max={maxYarnKg}
                    color={sc.greige.accent}
                  />
                ))}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginTop: '0.75rem', paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-current)',
                }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>
                    Unique counts
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-current)' }}>
                    {greigeStock.length}
                  </span>
                </div>
              </>
            ) : (
              <EmptyState message="No greige yarn stock found" />
            )}
          </div>
        </div>

        {/* ── Orders Detail ───────────────────────────────── */}
        <div
          style={{
            backgroundColor: 'var(--surface-current)',
            border: '1px solid var(--border-current)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '0.85rem 1.15rem',
            borderBottom: '1px solid var(--border-current)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/admin/orders')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: sc.orders.accent,
              }} />
              <h3 style={{
                margin: 0, fontSize: '0.85rem', fontWeight: 700,
                color: 'var(--text-current)',
              }}>
                Order Pipeline
              </h3>
            </div>
            <ArrowUpRight size={14} style={{ color: 'var(--text-muted-current)', opacity: 0.4 }} />
          </div>
          <div style={{ padding: '1.15rem' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem', marginBottom: '1rem',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#3b82f610', border: '1px solid #3b82f625',
              }}>
                <Zap size={14} style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#3b82f6' }}>{orderStats.onProcess}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>On Process</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#ef444410', border: '1px solid #ef444425',
              }}>
                <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>{orderStats.late}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>Late</span>
              </div>
            </div>

            <div style={{
              backgroundColor: `${sc.orders.accent}08`,
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem', marginBottom: '0.85rem',
              border: `1px solid ${sc.orders.accent}12`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Fulfillment Progress
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: sc.orders.accent }}>
                  {orderStats.total > 0 ? Math.round((orderStats.onProcess / orderStats.total) * 100) : 0}%
                </span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: `${sc.orders.accent}15`, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '4px', backgroundColor: sc.orders.accent,
                  width: `${orderStats.total > 0 ? (orderStats.onProcess / orderStats.total) * 100 : 0}%`,
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem',
            }}>
              {[
                { label: 'Total', value: orderStats.total, color: 'var(--text-current)' },
                { label: 'On Process', value: orderStats.onProcess, color: '#3b82f6' },
                { label: 'Late', value: orderStats.late, color: '#ef4444' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Dyeing Details ──────────────────────────────── */}
        <div
          style={{
            backgroundColor: 'var(--surface-current)',
            border: '1px solid var(--border-current)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '0.85rem 1.15rem',
            borderBottom: '1px solid var(--border-current)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/admin/dyeing-forms')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: sc.dyeing.accent,
              }} />
              <h3 style={{
                margin: 0, fontSize: '0.85rem', fontWeight: 700,
                color: 'var(--text-current)',
              }}>
                Dyeing Pipeline
              </h3>
            </div>
            <ArrowUpRight size={14} style={{ color: 'var(--text-muted-current)', opacity: 0.4 }} />
          </div>
          <div style={{ padding: '1.15rem' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem', marginBottom: '1rem',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#3b82f610', border: '1px solid #3b82f625',
              }}>
                <Zap size={14} style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#3b82f6' }}>{dyeingStats.onProcess}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>On Process</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#ef444410', border: '1px solid #ef444425',
              }}>
                <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>{dyeingStats.late}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>Late</span>
              </div>
            </div>

            <div style={{
              backgroundColor: `${sc.dyeing.accent}08`,
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem', marginBottom: '0.85rem',
              border: `1px solid ${sc.dyeing.accent}12`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Dyeing Completion
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: sc.dyeing.accent }}>
                  {dyeingStats.total > 0 ? Math.round((dyeingStats.onProcess / dyeingStats.total) * 100) : 0}%
                </span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: `${sc.dyeing.accent}15`, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '4px', backgroundColor: sc.dyeing.accent,
                  width: `${dyeingStats.total > 0 ? (dyeingStats.onProcess / dyeingStats.total) * 100 : 0}%`,
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem',
            }}>
              {[
                { label: 'Total', value: dyeingStats.total, color: 'var(--text-current)' },
                { label: 'On Process', value: dyeingStats.onProcess, color: '#3b82f6' },
                { label: 'Late', value: dyeingStats.late, color: '#ef4444' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Second Row: Warping, Sizing, Weaving, Processing ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>

        {/* ── Warping Status ──────────────────────────────── */}
        <div
          style={{
            backgroundColor: 'var(--surface-current)',
            border: '1px solid var(--border-current)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '0.85rem 1.15rem',
            borderBottom: '1px solid var(--border-current)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/warping-sizing')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: sc.warping.accent,
              }} />
              <h3 style={{
                margin: 0, fontSize: '0.85rem', fontWeight: 700,
                color: 'var(--text-current)',
              }}>
                Warping Status
              </h3>
            </div>
            <ArrowUpRight size={14} style={{ color: 'var(--text-muted-current)', opacity: 0.4 }} />
          </div>
          <div style={{ padding: '1.15rem' }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: '0.4rem',
              marginBottom: '1rem',
            }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: sc.warping.text }}>{warpingStats.totalMachines}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>total machines</span>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem', marginBottom: '0.75rem',
            }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.6rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#3b82f610', border: '1px solid #3b82f625',
              }}>
                <Zap size={13} style={{ color: '#3b82f6', marginBottom: '0.2rem' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#3b82f6' }}>{warpingStats.onProcess}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)' }}>On Process</span>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.6rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#ef444410', border: '1px solid #ef444425',
              }}>
                <AlertTriangle size={13} style={{ color: '#ef4444', marginBottom: '0.2rem' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ef4444' }}>{warpingStats.late}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)' }}>Late</span>
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
            }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.6rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#10b98110', border: '1px solid #10b98125',
              }}>
                <Settings size={13} style={{ color: '#10b981', marginBottom: '0.2rem' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>{warpingStats.allotted}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', textAlign: 'center' }}>Allotted</span>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.6rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#64748b10', border: '1px solid #64748b25',
              }}>
                <CircleDot size={13} style={{ color: '#64748b', marginBottom: '0.2rem' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#64748b' }}>{warpingStats.idle}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', textAlign: 'center' }}>Idle</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sizing Status ────────────────────────────────── */}
        <div
          style={{
            backgroundColor: 'var(--surface-current)',
            border: '1px solid var(--border-current)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '0.85rem 1.15rem',
            borderBottom: '1px solid var(--border-current)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/warping-sizing')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: sc.warping.accent,
              }} />
              <h3 style={{
                margin: 0, fontSize: '0.85rem', fontWeight: 700,
                color: 'var(--text-current)',
              }}>
                Sizing Status
              </h3>
            </div>
            <ArrowUpRight size={14} style={{ color: 'var(--text-muted-current)', opacity: 0.4 }} />
          </div>
          <div style={{ padding: '1.15rem' }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: '0.4rem',
              marginBottom: '1rem',
            }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: sc.warping.text }}>{sizingStats.totalMachines}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>total machines</span>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem', marginBottom: '0.75rem',
            }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.6rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#3b82f610', border: '1px solid #3b82f625',
              }}>
                <Zap size={13} style={{ color: '#3b82f6', marginBottom: '0.2rem' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#3b82f6' }}>{sizingStats.onProcess}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)' }}>On Process</span>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.6rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#ef444410', border: '1px solid #ef444425',
              }}>
                <AlertTriangle size={13} style={{ color: '#ef4444', marginBottom: '0.2rem' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ef4444' }}>{sizingStats.late}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)' }}>Late</span>
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
            }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.6rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#10b98110', border: '1px solid #10b98125',
              }}>
                <Settings size={13} style={{ color: '#10b981', marginBottom: '0.2rem' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>{sizingStats.allotted}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', textAlign: 'center' }}>Allotted</span>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.6rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#64748b10', border: '1px solid #64748b25',
              }}>
                <CircleDot size={13} style={{ color: '#64748b', marginBottom: '0.2rem' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#64748b' }}>{sizingStats.idle}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', textAlign: 'center' }}>Idle</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Weaving ─────────────────────────────────────── */}
        <div
          style={{
            backgroundColor: 'var(--surface-current)',
            border: '1px solid var(--border-current)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '0.85rem 1.15rem',
            borderBottom: '1px solid var(--border-current)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/weaving')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: sc.weaving.accent,
              }} />
              <h3 style={{
                margin: 0, fontSize: '0.85rem', fontWeight: 700,
                color: 'var(--text-current)',
              }}>
                Weaving Status
              </h3>
            </div>
            <ArrowUpRight size={14} style={{ color: 'var(--text-muted-current)', opacity: 0.4 }} />
          </div>
          <div style={{ padding: '1.15rem' }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: '0.4rem',
              marginBottom: '1rem',
            }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: sc.weaving.text }}>{weavingStats.totalMachines}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>total machines</span>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem', marginBottom: '0.75rem',
            }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.6rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#3b82f610', border: '1px solid #3b82f625',
              }}>
                <Zap size={13} style={{ color: '#3b82f6', marginBottom: '0.2rem' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#3b82f6' }}>{weavingStats.onProcess}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)' }}>On Process</span>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.6rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#ef444410', border: '1px solid #ef444425',
              }}>
                <AlertTriangle size={13} style={{ color: '#ef4444', marginBottom: '0.2rem' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ef4444' }}>{weavingStats.late}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)' }}>Late</span>
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem', marginBottom: '1.25rem',
            }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.6rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#10b98110', border: '1px solid #10b98125',
              }}>
                <Settings size={13} style={{ color: '#10b981', marginBottom: '0.2rem' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>{weavingStats.allotted}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', textAlign: 'center' }}>Allotted</span>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.6rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#64748b10', border: '1px solid #64748b25',
              }}>
                <CircleDot size={13} style={{ color: '#64748b', marginBottom: '0.2rem' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#64748b' }}>{weavingStats.idle}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', textAlign: 'center' }}>Idle</span>
              </div>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.5rem 0.65rem', borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-current)', border: '1px solid var(--border-current)',
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Today's Production
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: sc.weaving.text }}>
                {weavingStats.todaysProductionQty.toLocaleString()} m
              </span>
            </div>
          </div>
        </div>

        {/* ── Processing ──────────────────────────────────── */}
        <div
          style={{
            backgroundColor: 'var(--surface-current)',
            border: '1px solid var(--border-current)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '0.85rem 1.15rem',
            borderBottom: '1px solid var(--border-current)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/processing')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: sc.processing.accent,
              }} />
              <h3 style={{
                margin: 0, fontSize: '0.85rem', fontWeight: 700,
                color: 'var(--text-current)',
              }}>
                Processing Detail
              </h3>
            </div>
            <ArrowUpRight size={14} style={{ color: 'var(--text-muted-current)', opacity: 0.4 }} />
          </div>
          <div style={{ padding: '1.15rem' }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: '0.4rem',
              marginBottom: '1rem',
            }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: sc.processing.text }}>{processingStats.total}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>total jobs</span>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem', marginBottom: '1rem',
            }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.6rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#3b82f610', border: '1px solid #3b82f625',
              }}>
                <Zap size={13} style={{ color: '#3b82f6', marginBottom: '0.2rem' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#3b82f6' }}>{processingStats.onProcess}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)' }}>On Process</span>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.6rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#ef444410', border: '1px solid #ef444425',
              }}>
                <AlertTriangle size={13} style={{ color: '#ef4444', marginBottom: '0.2rem' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ef4444' }}>{processingStats.late}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)' }}>Late</span>
              </div>
            </div>

            <div style={{ marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Completion Rate
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: sc.processing.accent }}>
                  {processingStats.total > 0 ? Math.round((processingStats.onProcess / processingStats.total) * 100) : 0}%
                </span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: `${sc.processing.accent}15`, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '4px', backgroundColor: sc.processing.accent,
                  width: `${processingStats.total > 0 ? (processingStats.onProcess / processingStats.total) * 100 : 0}%`,
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Production Pipeline Summary ────────────────────── */}
      <div style={{
        backgroundColor: 'var(--surface-current)',
        border: '1px solid var(--border-current)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        marginBottom: '1.5rem',
      }}>
        <div style={{
          padding: '0.85rem 1.25rem',
          borderBottom: '1px solid var(--border-current)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: '#800000',
          }} />
          <h3 style={{
            margin: 0, fontSize: '0.85rem', fontWeight: 700,
            color: 'var(--text-current)',
          }}>
            End-to-End Production Pipeline
          </h3>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            overflowX: 'auto', paddingBottom: '0.5rem',
          }}>
            {[
              { label: 'Orders', value: orderStats.total, color: sc.orders.accent, count: orderStats.total },
              { label: 'Dyeing', value: dyeingStats.total, color: sc.dyeing.accent, count: dyeingStats.total },
              { label: 'Warping', value: warpingStats.total, color: sc.warping.accent, count: warpingStats.total },
              { label: 'Sizing', value: sizingStats.total, color: sc.warping.accent, count: sizingStats.total },
              { label: 'Weaving', value: weavingStats.total, color: sc.weaving.accent, count: weavingStats.total },
              { label: 'Processing', value: processingStats.total, color: sc.processing.accent, count: processingStats.total },
            ].map((stage, i, arr) => (
              <React.Fragment key={stage.label}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: '0.4rem', minWidth: '90px', flex: 1,
                }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: 'var(--radius-full)',
                    backgroundColor: `${stage.color}12`, border: `2px solid ${stage.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{
                      fontSize: '0.85rem', fontWeight: 800, color: stage.color,
                    }}>
                      {stage.count}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted-current)',
                  }}>
                    {stage.label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight size={16} style={{ color: 'var(--text-muted-current)', opacity: 0.3, flexShrink: 0 }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.75rem',
      }}>
        {[
          { label: 'Orders', path: '/admin/orders', color: sc.orders.accent },
          { label: 'Greige Yarn', path: '/greige-yarn', color: sc.greige.accent },
          { label: 'Dyeing Forms', path: '/admin/dyeing-forms', color: sc.dyeing.accent },
          { label: 'Warping & Sizing', path: '/warping-sizing', color: sc.warping.accent },
          { label: 'Weaving', path: '/weaving', color: sc.weaving.accent },
          { label: 'Processing', path: '/processing', color: sc.processing.accent },
        ].map(a => (
          <button
            key={a.path}
            onClick={() => navigate(a.path)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem', padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--surface-current)',
              border: '1px solid var(--border-current)',
              color: a.color, fontWeight: 600, fontSize: '0.8rem',
              cursor: 'pointer', transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
            className="hover-lift"
          >
            {a.label} <ArrowRight size={14} />
          </button>
        ))}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 1024px) {
          div[style*="grid-template-columns: 1fr 1fr 1fr"] {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="grid-template-columns: repeat(auto-fit, minmax(220px"] {
            grid-template-columns: 1fr 1fr !important;
          }
          div[style*="grid-template-columns: repeat(auto-fit, minmax(180px"] {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 480px) {
          div[style*="grid-template-columns: repeat(auto-fit, minmax(220px"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="grid-template-columns: repeat(auto-fit, minmax(180px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
