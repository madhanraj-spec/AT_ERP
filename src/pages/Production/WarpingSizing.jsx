import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Layers, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Loader, Calendar,
  Package, Zap, AlertCircle, Clock, X, Play,
  CheckCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

import DYDRDetail from '../../components/DYDRDetail';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDaysArray(startDate, count) {
  const days = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isToday(date) {
  const t = new Date();
  return date.getFullYear() === t.getFullYear() &&
    date.getMonth() === t.getMonth() &&
    date.getDate() === t.getDate();
}

function getLocalDateString(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hasExceededPlannedEnd(wof) {
  if (!wof.end_date) return false;
  const todayStr = getLocalDateString(new Date());
  const plannedEndStr = wof.end_date;
  if (wof.status === 'completed') {
    const actualEndStr = wof.process_completed_at
      ? getLocalDateString(wof.process_completed_at)
      : (getLocalDateString(wof.updated_at) || todayStr);
    return actualEndStr > plannedEndStr;
  }
  return todayStr > plannedEndStr;
}

function getStatusColor(status) {
  switch (status) {
    case 'created': return { bg: '#fef9c3', border: '#eab308', text: '#854d0e', label: 'Created' };
    case 'on_process': return { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8', label: 'On Process' };
    case 'completed': return { bg: '#dcfce7', border: '#22c55e', text: '#166534', label: 'Completed' };
    case 'stopped': return { bg: '#fff7ed', border: '#f97316', text: '#c2410c', label: 'Stopped' };
    default: return { bg: '#f1f5f9', border: '#94a3b8', text: '#475569', label: status || 'Unknown' };
  }
}

function getWofStatusBadge(wof) {
  const todayStr = getLocalDateString(new Date());
  const sc = getStatusColor(wof.status);

  if (wof.status === 'completed') {
    const actualEndStr = wof.process_completed_at
      ? getLocalDateString(wof.process_completed_at)
      : (getLocalDateString(wof.updated_at) || todayStr);

    if (wof.end_date && actualEndStr > wof.end_date) {
      return { label: 'Late Completed', bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' };
    }
    return { label: 'Completed', bg: '#dcfce7', border: '#22c55e', text: '#166534' };
  }

  if (wof.status === 'on_process') {
    if (wof.end_date && todayStr > wof.end_date) {
      return { label: 'Running Late', bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' };
    }
    return { label: 'On Process', bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' };
  }

  if (wof.status === 'created') {
    if (wof.end_date && todayStr > wof.end_date) {
      return { label: 'Late', bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' };
    }
    return { label: 'Created', bg: '#fef9c3', border: '#eab308', text: '#854d0e' };
  }

  return sc;
}


const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_COL_WIDTH = 44;
const LABEL_COL_WIDTH = 320;
const TOTAL_DAYS = 30;

// ─── Gantt Bar with Hover Tooltip ────────────────────────────────────────────

function GanttBar({ wof, bar, compact, onWofClick, customBg, customBorder, customTextColor, customLabel, topOffset, customHeight, tooltipType }) {
  const [hovered, setHovered] = useState(false);
  const sc = getStatusColor(wof.status);

  const handleClick = (e) => {
    e.stopPropagation();
    if (onWofClick) onWofClick(wof);
  };

  const bg = customBg || sc.bg;
  const border = customBorder || sc.border;
  const textColor = customTextColor || sc.text;
  const label = customLabel !== undefined ? customLabel : wof.wof_number;

  const barTop = topOffset !== undefined ? topOffset : (compact ? '6px' : '5px');
  const barHeight = customHeight !== undefined ? customHeight : (compact ? 'calc(100% - 12px)' : 'calc(100% - 10px)');

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      style={{
        position: 'absolute',
        left: `${bar.left}px`,
        width: `${bar.width}px`,
        top: barTop,
        height: barHeight,
        backgroundColor: bg,
        border: `1.5px solid ${border}`,
        borderRadius: '4px',
        zIndex: 2,
        overflow: 'visible',
        display: 'flex', alignItems: 'center',
        paddingLeft: compact ? '4px' : '6px',
        justifyContent: 'flex-start',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.15s',
        boxShadow: hovered ? '0 4px 10px rgba(0,0,0,0.12)' : 'none',
        transform: hovered ? 'scaleY(1.03)' : 'none'
      }}
    >
      {/* Bar label */}
      {bar.width > 35 && (
        <span style={{
          fontSize: '0.6rem', fontWeight: '800',
          color: textColor, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
          paddingRight: '4px'
        }}>
          {label}
        </span>
      )}

      {/* Hover Tooltip */}
      {hovered && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1e293b',
            color: '#fff',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            minWidth: '240px',
            maxWidth: '320px',
            zIndex: 100,
            boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
            pointerEvents: 'none',
            fontSize: '0.72rem',
            lineHeight: '1.6',
            textAlign: 'left'
          }}
        >
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid #1e293b'
          }} />

          <div style={{ fontWeight: '800', fontSize: '0.78rem', color: '#fbbf24', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{wof.wof_number}</span>
            <span style={{ fontSize: '0.62rem', opacity: 0.8, backgroundColor: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
              {tooltipType === 'planned' ? 'Planned Schedule' : tooltipType === 'actual' ? 'Actual Progress' : 'WOF Details'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div>
              <span style={{ color: '#94a3b8', fontWeight: '600' }}>Order: </span>
              <span style={{ fontWeight: '700' }}>{wof.order?.order_number || '—'}</span>
            </div>
            <div>
              <span style={{ color: '#94a3b8', fontWeight: '600' }}>Design: </span>
              <span style={{ fontWeight: '700' }}>
                {wof.order?.design_no || '—'}{wof.order?.design_name ? ` / ${wof.order.design_name}` : ''}
              </span>
            </div>
            <div>
              <span style={{ color: '#94a3b8', fontWeight: '600' }}>Qty: </span>
              <span style={{ fontWeight: '700', color: '#fbbf24' }}>
                {wof.qty ? `${Number(wof.qty).toLocaleString()} m` : '—'}
              </span>
            </div>

            {tooltipType === 'planned' ? (
              <div>
                <span style={{ color: '#94a3b8', fontWeight: '600' }}>Planned Dates: </span>
                <span style={{ fontWeight: '700', color: '#fef08a' }}>
                  {wof.start_date
                    ? new Date(wof.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                    : '?'
                  }
                  {' → '}
                  {wof.end_date
                    ? new Date(wof.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                    : '?'
                  }
                </span>
              </div>
            ) : tooltipType === 'actual' ? (
              <>
                <div>
                  <span style={{ color: '#94a3b8', fontWeight: '600' }}>Actual Dates: </span>
                  <span style={{ fontWeight: '700', color: '#bfdbfe' }}>
                    {wof.process_started_at
                      ? new Date(wof.process_started_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                      : '?'
                    }
                    {' → '}
                    {wof.status === 'completed'
                      ? (wof.process_completed_at
                          ? new Date(wof.process_completed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                          : 'Completed'
                        )
                      : 'Running (Today)'
                    }
                  </span>
                </div>
                {wof.warper_name && (
                  <div>
                    <span style={{ color: '#94a3b8', fontWeight: '600' }}>Warper: </span>
                    <span style={{ fontWeight: '700' }}>{wof.warper_name}</span>
                  </div>
                )}
                {wof.beam_name && (
                  <div>
                    <span style={{ color: '#94a3b8', fontWeight: '600' }}>Beam: </span>
                    <span style={{ fontWeight: '700' }}>{wof.beam_name}</span>
                  </div>
                )}
              </>
            ) : (
              <div>
                <span style={{ color: '#94a3b8', fontWeight: '600' }}>Schedule: </span>
                <span style={{ fontWeight: '700' }}>
                  {wof.start_date
                    ? new Date(wof.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                    : '?'
                  }
                  {' → '}
                  {wof.end_date
                    ? new Date(wof.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                    : '?'
                  }
                </span>
              </div>
            )}

            <div style={{ marginTop: '0.15rem' }}>
              <span style={{
                backgroundColor: bg, color: textColor,
                border: `1px solid ${border}`,
                padding: '1px 8px', borderRadius: '10px',
                fontSize: '0.6rem', fontWeight: '700'
              }}>
                {tooltipType === 'planned' ? 'Planned' : tooltipType === 'actual' ? (wof.status === 'completed' ? 'Completed' : 'On Process') : sc.label}
              </span>
              {hasExceededPlannedEnd(wof) && (
                <span style={{
                  backgroundColor: '#fee2e2', color: '#991b1b',
                  border: '1px solid #ef4444',
                  padding: '1px 8px', borderRadius: '10px',
                  fontSize: '0.6rem', fontWeight: '700', marginLeft: '0.4rem'
                }}>
                  Exceeded Planned End Date
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Main Component ──────────────────────────────────────────────────────────

export default function WarpingSizing() {
  const navigate = useNavigate();

  // Primary tab: 'warping' | 'sizing'
  const [primaryTab, setPrimaryTab] = useState('warping');
  // Warping sub-tab: 'in_house' | 'job_work'
  const [warpingSubTab, setWarpingSubTab] = useState('in_house');

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem' }} className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'none', border: 'none', color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer',
            padding: '0', marginBottom: '0.75rem'
          }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #800000, #4d0000)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Layers size={22} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-current)' }}>
              Warping & Sizing
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.85rem' }}>
              Production scheduling and machine allocation
            </p>
          </div>
        </div>
      </div>

      {/* ── Primary Tabs ── */}
      <div style={{
        display: 'flex', gap: '0',
        borderBottom: '2px solid var(--border-current)',
        marginBottom: '1.5rem'
      }}>
        {[
          { id: 'warping', label: 'Warping', icon: <Layers size={17} /> },
          { id: 'sizing', label: 'Sizing', icon: <Package size={17} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setPrimaryTab(tab.id)}
            style={{
              padding: '0.85rem 1.75rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '700',
              color: primaryTab === tab.id ? '#800000' : 'var(--text-muted-current)',
              borderBottom: primaryTab === tab.id ? '3px solid #800000' : '3px solid transparent',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              transition: 'all 0.2s ease',
              marginBottom: '-2px'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {primaryTab === 'warping' && (
        <div>
          {/* Warping Sub-tabs */}
          <div style={{
            display: 'flex', gap: '0.5rem', marginBottom: '1.5rem'
          }}>
            {[
              { id: 'in_house', label: 'In-House', icon: '🏭' },
              { id: 'job_work', label: 'Job Work', icon: '🤝' },
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => setWarpingSubTab(sub.id)}
                style={{
                  padding: '0.6rem 1.5rem',
                  borderRadius: '8px',
                  border: warpingSubTab === sub.id ? '2px solid #800000' : '2px solid var(--border-current)',
                  background: warpingSubTab === sub.id ? 'rgba(128,0,0,0.05)' : 'var(--surface-current)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  color: warpingSubTab === sub.id ? '#800000' : 'var(--text-muted-current)',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  transition: 'all 0.2s ease',
                  boxShadow: warpingSubTab === sub.id ? '0 2px 8px rgba(128,0,0,0.1)' : 'none'
                }}
              >
                <span>{sub.icon}</span>
                {sub.label}
              </button>
            ))}
          </div>

          {warpingSubTab === 'in_house' && <InHouseGantt />}
          {warpingSubTab === 'job_work' && <JobWorkTable />}
        </div>
      )}

      {primaryTab === 'sizing' && <SizingTab />}
    </div>
  );
}

// ─── In-House Gantt Chart ────────────────────────────────────────────────────

function InHouseGantt() {
  const [machines, setMachines] = useState([]);
  const [wofs, setWofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedMachines, setExpandedMachines] = useState({});
  const [selectedWof, setSelectedWof] = useState(null);

  const handleWofClick = (wof) => {
    setSelectedWof(wof);
  };

  // Date window: starts 3 days before today
  const [windowStart, setWindowStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const days = useMemo(() => getDaysArray(windowStart, TOTAL_DAYS), [windowStart]);

  // Group days by month for the top header
  const monthGroups = useMemo(() => {
    const groups = [];
    let current = null;
    days.forEach(d => {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!current || current.key !== key) {
        current = { key, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, count: 1 };
        groups.push(current);
      } else {
        current.count++;
      }
    });
    return groups;
  }, [days]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch warping department machines (in-house)
      const { data: deptData } = await supabase
        .from('master_departments')
        .select('id')
        .ilike('department_name', '%warping%');

      const warpingDeptIds = (deptData || []).map(d => d.id);

      let machineData = [];
      if (warpingDeptIds.length > 0) {
        const { data } = await supabase
          .from('master_machines')
          .select('*, master_departments(department_name)')
          .in('department_id', warpingDeptIds)
          .eq('scope', 'in_house')
          .order('machine_name');
        machineData = data || [];
      }

      // Fallback: if no warping department found, fetch all in-house machines
      if (machineData.length === 0) {
        const { data } = await supabase
          .from('master_machines')
          .select('*, master_departments(department_name)')
          .eq('scope', 'in_house')
          .order('machine_name');
        machineData = data || [];
      }

      setMachines(machineData);

      // Fetch all in-house WOFs with order details
      const { data: wofData } = await supabase
        .from('warping_order_forms')
        .select(`
          *,
          order:orders(order_number, design_no, design_name)
        `)
        .eq('wof_type', 'in_house')
        .order('start_date', { ascending: true });

      setWofs(wofData || []);
    } catch (err) {
      console.error('Error fetching Gantt data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group WOFs by machine_id
  const wofsByMachine = useMemo(() => {
    const map = {};
    wofs.forEach(w => {
      if (!w.machine_id) return;
      if (!map[w.machine_id]) map[w.machine_id] = [];
      map[w.machine_id].push(w);
    });
    return map;
  }, [wofs]);

  const toggleMachine = (machineId) => {
    setExpandedMachines(prev => ({ ...prev, [machineId]: !prev[machineId] }));
  };

  const slideWindow = (direction) => {
    setWindowStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + (direction * 7));
      return d;
    });
  };

  const goToToday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    d.setHours(0, 0, 0, 0);
    setWindowStart(d);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: 'var(--text-muted-current)', alignItems: 'center', gap: '0.75rem' }}>
        <Loader size={22} className="spin" /> Loading Gantt chart...
      </div>
    );
  }

  return (
    <div>
      {/* Date Navigation Controls */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1rem', padding: '0.75rem 1rem',
        backgroundColor: 'var(--surface-current)',
        border: '1px solid var(--border-current)',
        borderRadius: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={16} color="#800000" />
          <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-current)' }}>
            {MONTH_NAMES[windowStart.getMonth()]} {windowStart.getDate()} – {(() => {
              const end = new Date(windowStart);
              end.setDate(end.getDate() + TOTAL_DAYS - 1);
              return `${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
            })()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => slideWindow(-1)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '8px',
              border: '1px solid var(--border-current)', background: 'var(--surface-current)',
              cursor: 'pointer', color: 'var(--text-current)',
              transition: 'all 0.15s'
            }}
            title="Previous 7 days"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToToday}
            style={{
              padding: '0.35rem 0.85rem', borderRadius: '8px',
              border: '1px solid #800000', background: 'rgba(128,0,0,0.06)',
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700',
              color: '#800000', transition: 'all 0.15s'
            }}
          >
            Today
          </button>
          <button
            onClick={() => slideWindow(1)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '8px',
              border: '1px solid var(--border-current)', background: 'var(--surface-current)',
              cursor: 'pointer', color: 'var(--text-current)',
              transition: 'all 0.15s'
            }}
            title="Next 7 days"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap',
        fontSize: '0.72rem', fontWeight: '700'
      }}>
        {['created', 'on_process', 'completed', 'stopped'].map(s => {
          const c = getStatusColor(s);
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '3px', backgroundColor: c.bg, border: `1.5px solid ${c.border}` }} />
              <span style={{ color: c.text }}>{c.label}</span>
            </div>
          );
        })}
      </div>

      {/* Gantt Chart Container */}
      <div style={{
        border: '1px solid var(--border-current)',
        borderRadius: '12px',
        overflow: 'hidden',
        backgroundColor: '#fff'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: `${LABEL_COL_WIDTH + (DAY_COL_WIDTH * TOTAL_DAYS)}px` }}>

            {/* ── Header: Month Row ── */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-current)',
              backgroundColor: '#800000'
            }}>
              <div style={{
                width: `${LABEL_COL_WIDTH}px`, minWidth: `${LABEL_COL_WIDTH}px`,
                padding: '0.5rem 1rem', fontWeight: '800',
                fontSize: '0.72rem', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.9)',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                borderRight: '1px solid rgba(255,255,255,0.15)'
              }}>
                ⚙️ Machine
              </div>
              {monthGroups.map((mg, i) => (
                <div key={i} style={{
                  width: `${mg.count * DAY_COL_WIDTH}px`,
                  minWidth: `${mg.count * DAY_COL_WIDTH}px`,
                  padding: '0.5rem 0.5rem',
                  fontWeight: '800', fontSize: '0.7rem',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: 'rgba(255,255,255,0.9)',
                  textAlign: 'center',
                  borderRight: '1px solid rgba(255,255,255,0.1)'
                }}>
                  {mg.label}
                </div>
              ))}
            </div>

            {/* ── Header: Day Row ── */}
            <div style={{
              display: 'flex',
              borderBottom: '2px solid var(--border-current)',
              backgroundColor: '#faf7f7'
            }}>
              <div style={{
                width: `${LABEL_COL_WIDTH}px`, minWidth: `${LABEL_COL_WIDTH}px`,
                borderRight: '1px solid var(--border-current)'
              }} />
              {days.map((d, i) => {
                const today = isToday(d);
                const isSunday = d.getDay() === 0;
                return (
                  <div key={i} style={{
                    width: `${DAY_COL_WIDTH}px`, minWidth: `${DAY_COL_WIDTH}px`,
                    textAlign: 'center', padding: '0.4rem 0',
                    fontSize: '0.62rem', fontWeight: '700',
                    borderRight: '1px solid #f0f0f0',
                    backgroundColor: today ? 'rgba(128,0,0,0.08)' : isSunday ? '#fef2f2' : 'transparent',
                    color: today ? '#800000' : isSunday ? '#dc2626' : 'var(--text-muted-current)'
                  }}>
                    <div style={{ fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {DAY_NAMES[d.getDay()]}
                    </div>
                    <div style={{ fontWeight: '800', fontSize: '0.78rem', marginTop: '1px' }}>
                      {d.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Machine Rows ── */}
            {machines.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
                <AlertCircle size={24} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
                No in-house warping machines found. Please add machines in the Masters section and assign them to a Warping department.
              </div>
            ) : (
              machines.map(machine => {
                const isExpanded = expandedMachines[machine.id];
                const machineWofs = wofsByMachine[machine.id] || [];
                const deptName = machine.master_departments?.department_name || '';

                return (
                  <div key={machine.id}>
                    {/* Machine Header Row */}
                    <div
                      onClick={() => toggleMachine(machine.id)}
                      style={{
                        display: 'flex',
                        borderBottom: '1px solid var(--border-current)',
                        cursor: 'pointer',
                        backgroundColor: isExpanded ? '#fdf8f7' : '#fafafa',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      {/* Machine label */}
                      <div style={{
                        width: `${LABEL_COL_WIDTH}px`, minWidth: `${LABEL_COL_WIDTH}px`,
                        padding: '0.65rem 1rem',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        borderRight: '1px solid var(--border-current)',
                        fontWeight: '700', fontSize: '0.82rem',
                        color: 'var(--text-current)'
                      }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} style={{ transform: 'rotate(90deg)' }} />}
                        <span>⚙️</span>
                        <div style={{ flex: 1 }}>
                          <div>{machine.machine_name}</div>
                          {deptName && (
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', fontWeight: '600', marginTop: '1px' }}>
                              {deptName}
                            </div>
                          )}
                        </div>
                        <span style={{
                          backgroundColor: machineWofs.length > 0 ? 'rgba(128,0,0,0.1)' : '#f1f5f9',
                          color: machineWofs.length > 0 ? '#800000' : '#94a3b8',
                          padding: '2px 8px', borderRadius: '12px',
                          fontSize: '0.65rem', fontWeight: '800'
                        }}>
                          {machineWofs.length} WOF{machineWofs.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Aggregated Gantt bars for the machine row */}
                      <div style={{ display: 'flex', position: 'relative', flex: 1 }}>
                        {days.map((d, i) => (
                          <div key={i} style={{
                            width: `${DAY_COL_WIDTH}px`, minWidth: `${DAY_COL_WIDTH}px`,
                            borderRight: '1px solid #f5f5f5',
                            backgroundColor: isToday(d) ? 'rgba(128,0,0,0.03)' : d.getDay() === 0 ? '#fefafa' : 'transparent'
                          }} />
                        ))}
                        {/* Overlay bars for each WOF */}
                        {machineWofs.map(wof => {
                          const bar = calcBarPosition(wof, days);
                          if (!bar) return null;
                          return (
                            <GanttBar key={wof.id} wof={wof} bar={bar} compact onWofClick={handleWofClick} />
                          );
                        })}
                      </div>
                    </div>

                    {/* Expanded WOF Rows */}
                    {isExpanded && machineWofs.map(wof => {
                      const sc = getWofStatusBadge(wof);
                      const todayStr = getLocalDateString(new Date());

                      return (
                        <div key={wof.id} style={{
                          display: 'flex',
                          borderBottom: '1px solid #f3f3f3',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                          minHeight: '60px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef7f5'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                        >
                          {/* WOF detail label */}
                          <div
                            onClick={(e) => { e.stopPropagation(); handleWofClick(wof); }}
                            style={{
                            width: `${LABEL_COL_WIDTH}px`, minWidth: `${LABEL_COL_WIDTH}px`,
                            padding: '0.55rem 1rem 0.55rem 2.25rem',
                            borderRight: '1px solid var(--border-current)',
                            borderLeft: '3px solid #800000',
                            fontSize: '0.75rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                              <span style={{
                                fontWeight: '800', color: '#800000',
                                fontFamily: 'monospace', fontSize: '0.72rem'
                              }}>
                                {wof.wof_number}
                              </span>
                              <span style={{
                                backgroundColor: sc.bg, color: sc.text,
                                border: `1px solid ${sc.border}`,
                                padding: '1px 6px', borderRadius: '10px',
                                fontSize: '0.55rem', fontWeight: '700'
                              }}>
                                {sc.label}
                              </span>
                            </div>
                            <div style={{ color: 'var(--text-muted-current)', fontSize: '0.68rem', lineHeight: '1.45' }}>
                              <span style={{ fontWeight: '600' }}>Order:</span> {wof.order?.order_number || '—'}
                              {' · '}
                              <span style={{ fontWeight: '600' }}>Design:</span> {wof.order?.design_no || '—'}
                              {wof.order?.design_name ? ` / ${wof.order.design_name}` : ''}
                            </div>
                            <div style={{ color: '#800000', fontWeight: '700', fontSize: '0.68rem', marginTop: '1px' }}>
                              Qty: {wof.qty ? `${Number(wof.qty).toLocaleString()} m` : '—'}
                            </div>
                          </div>

                          {/* WOF Gantt bar */}
                          <div style={{ display: 'flex', position: 'relative', flex: 1, minHeight: '60px' }}>
                            {days.map((d, i) => (
                              <div key={i} style={{
                                width: `${DAY_COL_WIDTH}px`, minWidth: `${DAY_COL_WIDTH}px`,
                                borderRight: '1px solid #fafafa',
                                backgroundColor: isToday(d) ? 'rgba(128,0,0,0.03)' : d.getDay() === 0 ? '#fefcfc' : 'transparent'
                              }} />
                            ))}
                            {(() => {
                              const exceeded = hasExceededPlannedEnd(wof);

                              // 1. Planned Bar
                              const plannedBar = calcBarPositionForDates(wof.start_date, wof.end_date, days);
                              const pBg = exceeded ? '#fecaca' : '#fef9c3';
                              const pBorder = exceeded ? '#ef4444' : '#eab308';
                              const pText = exceeded ? '#991b1b' : '#854d0e';

                              // 2. Actual Bar
                              const showActual = !!wof.process_started_at || wof.status === 'on_process' || wof.status === 'completed';
                              let actualBar = null;
                              let aBg = '';
                              let aBorder = '';
                              let aText = '';

                              if (showActual) {
                                const actualStartStr = getLocalDateString(wof.process_started_at) || wof.start_date || todayStr;
                                const actualEndStr = wof.status === 'completed'
                                  ? (getLocalDateString(wof.process_completed_at) || getLocalDateString(wof.updated_at) || todayStr)
                                  : todayStr;

                                actualBar = calcBarPositionForDates(actualStartStr, actualEndStr, days);
                                aBg = exceeded ? '#fecaca' : '#dbeafe';
                                aBorder = exceeded ? '#ef4444' : '#3b82f6';
                                aText = exceeded ? '#991b1b' : '#1d4ed8';
                              }

                              return (
                                <>
                                  {plannedBar && (
                                    <GanttBar
                                      key={`${wof.id}-planned`}
                                      wof={wof}
                                      bar={plannedBar}
                                      onWofClick={handleWofClick}
                                      customBg={pBg}
                                      customBorder={pBorder}
                                      customTextColor={pText}
                                      customLabel={`${wof.wof_number} (Plan)`}
                                      topOffset="6px"
                                      customHeight="20px"
                                      tooltipType="planned"
                                    />
                                  )}
                                  {showActual && actualBar && (
                                    <GanttBar
                                      key={`${wof.id}-actual`}
                                      wof={wof}
                                      bar={actualBar}
                                      onWofClick={handleWofClick}
                                      customBg={aBg}
                                      customBorder={aBorder}
                                      customTextColor={aText}
                                      customLabel={`${wof.wof_number} (Actual)`}
                                      topOffset="32px"
                                      customHeight="20px"
                                      tooltipType="actual"
                                    />
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}


                    {/* Empty expanded state */}
                    {isExpanded && machineWofs.length === 0 && (
                      <div style={{
                        display: 'flex',
                        borderBottom: '1px solid #f3f3f3',
                        backgroundColor: '#fff'
                      }}>
                        <div style={{
                          width: `${LABEL_COL_WIDTH}px`, minWidth: `${LABEL_COL_WIDTH}px`,
                          padding: '0.75rem 1rem 0.75rem 2.25rem',
                          borderRight: '1px solid var(--border-current)',
                          borderLeft: '3px solid #e5e7eb',
                          color: 'var(--text-muted-current)',
                          fontSize: '0.78rem', fontStyle: 'italic'
                        }}>
                          No warping order forms scheduled for this machine.
                        </div>
                        <div style={{ flex: 1 }} />
                      </div>
                    )}
                  </div>
                );
              })
            )}


          </div>
        </div>
      </div>

      {/* Summary Info */}
      <div style={{
        marginTop: '1rem', padding: '0.75rem 1rem',
        backgroundColor: 'rgba(128,0,0,0.04)',
        border: '1px solid rgba(128,0,0,0.12)',
        borderRadius: '8px',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        fontSize: '0.78rem', color: 'var(--text-muted-current)'
      }}>
        <AlertCircle size={14} color="#800000" />
        Showing <strong style={{ color: '#800000' }}>{machines.length}</strong> in-house machine{machines.length !== 1 ? 's' : ''} with <strong style={{ color: '#800000' }}>{wofs.length}</strong> warping order form{wofs.length !== 1 ? 's' : ''}.
        Click on a machine row to expand and view WOF details.
      </div>

      {/* WOF Detail Modal */}
      {selectedWof && (
        <WofDetailModal
          wof={selectedWof}
          onClose={() => setSelectedWof(null)}
          onStatusChanged={() => {
            setSelectedWof(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
// ─── WOF Detail Modal ────────────────────────────────────────────────────────

function WofDetailModal({ wof, onClose, onStatusChanged }) {
  const [loading, setLoading] = useState(true);
  const [wofDetail, setWofDetail] = useState(null);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [deliveryItems, setDeliveryItems] = useState([]);
  const [beams, setBeams] = useState([]);
  const [showStartForm, setShowStartForm] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Start Process form fields
  const [warperName, setWarperName] = useState('');
  const [selectedBeamId, setSelectedBeamId] = useState('');
  const [processDate, setProcessDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
  });

  const [completeDate, setCompleteDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
  });

  useEffect(() => {
    fetchDetails();
  }, [wof.id]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      // 1. Fetch full WOF details with order
      const { data: wofData } = await supabase
        .from('warping_order_forms')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name, total_quantity, yarn_requirements),
          machine:master_machines(machine_name),
          partner:master_partners(partner_name)
        `)
        .eq('id', wof.id)
        .single();
      setWofDetail(wofData);

      // 2. Fetch yarn counts for display
      const { data: ycData } = await supabase
        .from('master_yarn_counts')
        .select('*');
      setYarnCounts(ycData || []);

      // 3. Fetch delivery items linked to this WOF
      const { data: diData } = await supabase
        .from('dyed_yarn_delivery_items')
        .select(`
          *,
          yarn_count:master_yarn_counts(count_value, material, product_type),
          delivery:dyed_yarn_deliveries(
            id, dydr_number, delivered_date, delivered_by, vehicle_no, remarks
          )
        `)
        .eq('production_form_id', wof.id);
      setDeliveryItems(diData || []);

      // 4. Fetch beams
      const { data: beamData } = await supabase
        .from('master_beams')
        .select('*')
        .order('beam_name');
      setBeams(beamData || []);
    } catch (err) {
      console.error('Error fetching WOF detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCountDisplay = (countId) => {
    const yc = yarnCounts.find(y => y.id === countId);
    return yc ? `${yc.count_value} ${yc.material || ''} ${yc.product_type || ''}`.trim() : countId || '—';
  };

  // Calculate received qty per colour+count from delivery items
  const getDeliveredQty = (countId, colour) => {
    return deliveryItems
      .filter(d => d.yarn_count_id === countId && d.colour === colour)
      .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);
  };

  // Group delivery items by delivery for DYDR display
  const groupedDydrs = useMemo(() => {
    const map = {};
    deliveryItems.forEach(item => {
      const del = item.delivery;
      if (!del) return;
      if (!map[del.id]) {
        map[del.id] = {
          id: del.id,
          dydr_number: del.dydr_number,
          delivered_date: del.delivered_date,
          delivered_by: del.delivered_by,
          vehicle_no: del.vehicle_no,
          remarks: del.remarks,
          items: []
        };
      }
      map[del.id].items.push(item);
    });
    return Object.values(map);
  }, [deliveryItems]);

  const handleStartProcess = async () => {
    if (!warperName.trim()) {
      alert('Please enter the Warper Name');
      return;
    }
    if (!selectedBeamId) {
      alert('Please select a Beam Number');
      return;
    }

    setSaving(true);
    try {
      const selectedBeam = beams.find(b => b.id === selectedBeamId);
      const { error } = await supabase
        .from('warping_order_forms')
        .update({
          status: 'on_process',
          warper_name: warperName.trim(),
          beam_id: selectedBeamId,
          beam_name: selectedBeam?.beam_name || '',
          process_started_at: new Date(processDate).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', wof.id);

      if (error) throw error;
      onStatusChanged();
    } catch (err) {
      console.error('Error starting process:', err);
      alert('Failed to start process: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteProcess = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('warping_order_forms')
        .update({
          status: 'completed',
          process_completed_at: new Date(completeDate).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', wof.id);

      if (error) throw error;
      onStatusChanged();
    } catch (err) {
      console.error('Error completing process:', err);
      alert('Failed to complete process: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStopProcess = async () => {
    if (!confirm('Are you sure you want to stop this process?')) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('warping_order_forms')
        .update({
          status: 'stopped',
          updated_at: new Date().toISOString()
        })
        .eq('id', wof.id);

      if (error) throw error;
      onStatusChanged();
    } catch (err) {
      console.error('Error stopping process:', err);
      alert('Failed to stop process: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResumeProcess = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('warping_order_forms')
        .update({
          status: 'on_process',
          updated_at: new Date().toISOString()
        })
        .eq('id', wof.id);

      if (error) throw error;
      onStatusChanged();
    } catch (err) {
      console.error('Error resuming process:', err);
      alert('Failed to resume process: ' + err.message);
    } finally {
      setSaving(false);
    }
  };



  const detail = wofDetail || wof;
  const allotments = detail.colour_allotments || [];
  const sc = getWofStatusBadge(detail);


  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        paddingTop: '3vh',
        overflowY: 'auto'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '860px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.2s ease'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-current)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(135deg, #800000, #4d0000)',
          borderRadius: '16px 16px 0 0',
          color: '#fff'
        }}>
          <div>
            <div style={{ fontWeight: '800', fontSize: '1.1rem', fontFamily: 'monospace' }}>
              {detail.wof_number}
            </div>
            <div style={{ fontSize: '0.78rem', opacity: 0.8, marginTop: '2px' }}>
              Warping Order Form Details
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none', borderRadius: '8px',
              width: '34px', height: '34px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
              transition: 'background 0.15s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted-current)', alignItems: 'center', gap: '0.5rem' }}>
            <Loader size={20} className="spin" /> Loading WOF details...
          </div>
        ) : (
          <div style={{ padding: '1.5rem' }}>
            {/* ── WOF Info Grid ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: '#fafafa',
              borderRadius: '10px',
              border: '1px solid var(--border-current)'
            }}>
              <InfoField label="WOF Number" value={detail.wof_number} highlight />
              <InfoField label="Order Number" value={detail.order?.order_number} />
              <InfoField label="Design Number" value={detail.order?.design_no} />
              <InfoField label="Design Name" value={detail.order?.design_name} />
              <InfoField label="Quantity" value={detail.qty ? `${Number(detail.qty).toLocaleString()} m` : '—'} highlight />
              <InfoField label="Machine" value={detail.machine?.machine_name || detail.machine_name} />
              <InfoField label="Start Date" value={detail.start_date ? new Date(detail.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
              <InfoField label="End Date" value={detail.end_date ? new Date(detail.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: '600', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>Status</div>
                <span style={{
                  backgroundColor: sc.bg, color: sc.text,
                  border: `1px solid ${sc.border}`,
                  padding: '3px 12px', borderRadius: '20px',
                  fontSize: '0.7rem', fontWeight: '700'
                }}>
                  {sc.label}
                </span>
              </div>
              {detail.warper_name && <InfoField label="Warper" value={detail.warper_name} />}
              {detail.beam_name && <InfoField label="Beam" value={detail.beam_name} />}
              {detail.process_started_at && <InfoField label="Process Started" value={new Date(detail.process_started_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />}
              {detail.process_completed_at && <InfoField label="Process Completed" value={new Date(detail.process_completed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />}

            </div>

            {/* ── Colour / Count Allotment Table ── */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '800', color: '#800000', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🧶 Yarn Allotments
              </h3>
              {allotments.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted-current)', fontSize: '0.82rem', border: '1px dashed var(--border-current)', borderRadius: '8px' }}>
                  No colour/count allotments found for this WOF.
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border-current)', borderRadius: '10px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '2px solid var(--border-current)' }}>
                        <th style={thStyle}>Colour</th>
                        <th style={thStyle}>Count</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Qty Required (kg)</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Qty Received (kg)</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Balance (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allotments.map((a, idx) => {
                        const allottedQty = parseFloat(a.allotted_qty || a.kg || a.allottedQty || 0);
                        const deliveredQty = getDeliveredQty(a.countId, a.colour);
                        const balance = Math.max(0, allottedQty - deliveredQty);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <div style={{
                                  width: '12px', height: '12px', borderRadius: '3px',
                                  backgroundColor: a.colour?.toLowerCase() || '#ccc',
                                  border: '1px solid rgba(0,0,0,0.15)'
                                }} />
                                <span style={{ fontWeight: '600' }}>{a.colour || '—'}</span>
                              </div>
                            </td>
                            <td style={tdStyle}>{getCountDisplay(a.countId) || a.countValue || '—'}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600' }}>{allottedQty.toFixed(2)}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', color: deliveredQty > 0 ? '#059669' : '#94a3b8' }}>
                              {deliveredQty.toFixed(2)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: balance > 0 ? '#dc2626' : '#059669' }}>
                              {balance.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Associated DYDR Details ── */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '800', color: '#800000', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                📦 Dyed Yarn Delivery Receipts
              </h3>
              {groupedDydrs.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted-current)', fontSize: '0.82rem', border: '1px dashed var(--border-current)', borderRadius: '8px' }}>
                  No dyed yarn deliveries associated with this WOF yet.
                </div>
              ) : (
                groupedDydrs.map(gDydr => (
                  <DYDRDetail key={gDydr.id} dydr={gDydr} />
                ))
              )}
            </div>

            {/* ── Start Process Section ── */}
            {detail.status === 'created' && (
              <div style={{
                borderTop: '1px solid var(--border-current)',
                paddingTop: '1.25rem'
              }}>
                {!showStartForm ? (
                  <button
                    onClick={() => setShowStartForm(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#800000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '0.88rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: '0 4px 12px rgba(128,0,0,0.2)'
                    }}
                  >
                    <Play size={16} />
                    Start Process
                  </button>
                ) : (
                  <div style={{
                    padding: '1.25rem',
                    backgroundColor: '#fafafa',
                    borderRadius: '12px',
                    border: '1px solid var(--border-current)'
                  }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', fontWeight: '800', color: '#800000', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Play size={16} />
                      Start Process
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      {/* Warper Name */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                          Warper Name *
                        </label>
                        <input
                          type="text"
                          value={warperName}
                          onChange={e => setWarperName(e.target.value)}
                          placeholder="Enter warper name"
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            border: '1.5px solid var(--border-current)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            outline: 'none',
                            transition: 'border-color 0.15s',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      {/* Beam Number */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                          Beam Number *
                        </label>
                        <select
                          value={selectedBeamId}
                          onChange={e => setSelectedBeamId(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            border: '1.5px solid var(--border-current)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            outline: 'none',
                            cursor: 'pointer',
                            backgroundColor: '#fff',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="">Select a beam...</option>
                          {beams.map(beam => (
                            <option key={beam.id} value={beam.id}>{beam.beam_name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Date and Time */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                          Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={processDate}
                          onChange={e => setProcessDate(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            border: '1.5px solid var(--border-current)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setShowStartForm(false)}
                        disabled={saving}
                        style={{
                          padding: '0.6rem 1.25rem',
                          border: '1.5px solid var(--border-current)',
                          borderRadius: '8px',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: '600',
                          color: 'var(--text-muted-current)'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleStartProcess}
                        disabled={saving}
                        style={{
                          padding: '0.6rem 1.5rem',
                          border: 'none',
                          borderRadius: '8px',
                          backgroundColor: '#800000',
                          color: '#fff',
                          cursor: saving ? 'wait' : 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: '700',
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          boxShadow: '0 3px 10px rgba(128,0,0,0.2)',
                          opacity: saving ? 0.7 : 1
                        }}
                      >
                        {saving ? <Loader size={14} className="spin" /> : <Play size={14} />}
                        {saving ? 'Saving...' : 'Confirm & Start'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Complete & Stop Process Section ── */}
            {detail.status === 'on_process' && (
              <div style={{
                borderTop: '1px solid var(--border-current)',
                paddingTop: '1.25rem',
                marginTop: '1rem'
              }}>
                {!showCompleteForm ? (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      onClick={() => setShowCompleteForm(true)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#059669',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '0.88rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        boxShadow: '0 4px 12px rgba(5,150,105,0.2)'
                      }}
                    >
                      <CheckCircle size={16} />
                      Complete Process
                    </button>
                    <button
                      onClick={handleStopProcess}
                      disabled={saving}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#ea580c', // orange/red
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '0.88rem',
                        fontWeight: '700',
                        cursor: saving ? 'wait' : 'pointer',
                        transition: 'all 0.15s',
                        boxShadow: '0 4px 12px rgba(234,88,12,0.2)',
                        opacity: saving ? 0.7 : 1
                      }}
                    >
                      <X size={16} />
                      Stop Process
                    </button>
                  </div>
                ) : (
                  <div style={{
                    padding: '1.25rem',
                    backgroundColor: '#fafafa',
                    borderRadius: '12px',
                    border: '1px solid var(--border-current)'
                  }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', fontWeight: '800', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckCircle size={16} />
                      Complete Process
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1rem', maxWidth: '300px' }}>
                      {/* Date and Time */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                          Completion Date & Time *
                        </label>
                        <input
                          type="datetime-local"
                          value={completeDate}
                          onChange={e => setCompleteDate(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            border: '1.5px solid var(--border-current)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setShowCompleteForm(false)}
                        disabled={saving}
                        style={{
                          padding: '0.6rem 1.25rem',
                          border: '1.5px solid var(--border-current)',
                          borderRadius: '8px',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: '600',
                          color: 'var(--text-muted-current)'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCompleteProcess}
                        disabled={saving}
                        style={{
                          padding: '0.6rem 1.5rem',
                          border: 'none',
                          borderRadius: '8px',
                          backgroundColor: '#059669',
                          color: '#fff',
                          cursor: saving ? 'wait' : 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: '700',
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          boxShadow: '0 3px 10px rgba(5,150,105,0.2)',
                          opacity: saving ? 0.7 : 1
                        }}
                      >
                        {saving ? <Loader size={14} className="spin" /> : <CheckCircle size={14} />}
                        {saving ? 'Completing...' : 'Confirm & Complete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Stopped / Resume Process Section ── */}
            {detail.status === 'stopped' && (
              <div style={{
                borderTop: '1px solid var(--border-current)',
                paddingTop: '1.25rem',
                marginTop: '1rem'
              }}>
                <button
                  onClick={handleResumeProcess}
                  disabled={saving}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#800000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '0.88rem',
                    fontWeight: '700',
                    cursor: saving ? 'wait' : 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: '0 4px 12px rgba(128,0,0,0.2)',
                    opacity: saving ? 0.7 : 1
                  }}
                >
                  <Play size={16} />
                  Resume Process
                </button>
              </div>
            )}


            {/* Show warper info if already on process or completed */}
            {(detail.status === 'on_process' || detail.status === 'completed') && detail.warper_name && (
              <div style={{
                borderTop: '1px solid var(--border-current)',
                paddingTop: '1rem',
                display: 'flex', alignItems: 'center', gap: '1rem',
                fontSize: '0.82rem', color: 'var(--text-current)',
                flexWrap: 'wrap',
                marginTop: '1rem'
              }}>
                <div style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: detail.status === 'completed' ? '#dcfce7' : '#dbeafe',
                  border: detail.status === 'completed' ? '1px solid #86efac' : '1px solid #93c5fd',
                  borderRadius: '8px',
                  display: 'flex', alignItems: 'center', gap: '0.4rem'
                }}>
                  {detail.status === 'completed' ? <CheckCircle size={14} color="#166534" /> : <Play size={14} color="#1d4ed8" />}
                  <span style={{ fontWeight: '700', color: detail.status === 'completed' ? '#166534' : '#1d4ed8' }}>
                    {detail.status === 'completed' ? 'Process Completed' : 'Process Started'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Warper:</span>{' '}
                  <strong>{detail.warper_name}</strong>
                </div>
                {detail.beam_name && (
                  <div>
                    <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Beam:</span>{' '}
                    <strong>{detail.beam_name}</strong>
                  </div>
                )}
                {detail.process_started_at && (
                  <div>
                    <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Started:</span>{' '}
                    <strong>{new Date(detail.process_started_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                  </div>
                )}
                {detail.process_completed_at && (
                  <div>
                    <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Completed:</span>{' '}
                    <strong>{new Date(detail.process_completed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper: Info Field ──────────────────────────────────────────────────────

function InfoField({ label, value, highlight }) {
  return (
    <div>
      <div style={{ fontSize: '0.65rem', fontWeight: '600', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.85rem', fontWeight: highlight ? '800' : '600', color: highlight ? '#800000' : 'var(--text-current)' }}>
        {value || '—'}
      </div>
    </div>
  );
}

const thStyle = {
  padding: '0.6rem 0.75rem',
  fontWeight: '700',
  textAlign: 'left',
  color: '#800000',
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em'
};

const tdStyle = {
  padding: '0.55rem 0.75rem'
};

function calcBarPositionForDates(startDateStr, endDateStr, days) {
  if (!startDateStr && !endDateStr) return null;

  const windowStartKey = formatDateKey(days[0]);
  const windowEndKey = formatDateKey(days[days.length - 1]);

  const startKey = startDateStr || endDateStr;
  const endKey = endDateStr || startDateStr;

  // If completely outside the window, skip
  if (endKey < windowStartKey || startKey > windowEndKey) return null;

  // Calculate start index
  let startIdx = 0;
  if (startKey > windowStartKey) {
    startIdx = days.findIndex(d => formatDateKey(d) === startKey);
    if (startIdx < 0) {
      // Start is between days (partial), find nearest
      startIdx = days.findIndex(d => formatDateKey(d) >= startKey);
      if (startIdx < 0) return null;
    }
  }

  // Calculate end index
  let endIdx = days.length - 1;
  if (endKey < windowEndKey) {
    endIdx = days.findIndex(d => formatDateKey(d) === endKey);
    if (endIdx < 0) {
      endIdx = days.length - 1;
    }
  }

  const left = startIdx * DAY_COL_WIDTH + 2;
  const width = Math.max((endIdx - startIdx + 1) * DAY_COL_WIDTH - 4, 8);

  return { left, width };
}

function calcBarPosition(wof, days) {
  return calcBarPositionForDates(wof.start_date, wof.end_date, days);
}


// ─── Job Work Table ──────────────────────────────────────────────────────────

function JobWorkTable() {
  const [wofs, setWofs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobWorkWofs();
  }, []);

  const fetchJobWorkWofs = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('warping_order_forms')
        .select(`
          *,
          order:orders(order_number, design_no, design_name),
          partner:master_partners(partner_name)
        `)
        .eq('wof_type', 'job_work')
        .order('created_at', { ascending: false });
      setWofs(data || []);
    } catch (err) {
      console.error('Error fetching job work WOFs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted-current)', alignItems: 'center', gap: '0.5rem' }}>
        <Loader size={20} className="spin" /> Loading job work orders...
      </div>
    );
  }

  if (wofs.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '4rem',
        backgroundColor: 'var(--surface-current)',
        border: '1px solid var(--border-current)',
        borderRadius: '12px', color: 'var(--text-muted-current)'
      }}>
        <Package size={40} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
        <p style={{ margin: 0, fontWeight: '600' }}>No job work warping orders found.</p>
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--border-current)',
      borderRadius: '12px', overflow: 'hidden'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{
              backgroundColor: '#800000',
              color: 'rgba(255,255,255,0.92)'
            }}>
              {['WOF Number', 'Order Number', 'Design', 'Partner', 'Qty (m)', 'Start Date', 'End Date', 'Status'].map(h => (
                <th key={h} style={{
                  padding: '0.75rem 1rem', fontWeight: '800',
                  fontSize: '0.65rem', textTransform: 'uppercase',
                  letterSpacing: '0.05em', textAlign: 'left'
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {wofs.map(wof => {
              const sc = getStatusColor(wof.status);
              return (
                <tr key={wof.id} style={{ borderBottom: '1px solid var(--border-current)', backgroundColor: '#fff' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: '#800000', fontFamily: 'monospace' }}>
                    {wof.wof_number}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>
                    {wof.order?.order_number || '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {wof.order?.design_no || '—'}{wof.order?.design_name ? ` / ${wof.order.design_name}` : ''}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: '600', color: '#059669' }}>
                    {wof.partner?.partner_name || wof.partner_name || '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>
                    {wof.qty ? Number(wof.qty).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {wof.start_date ? new Date(wof.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {wof.end_date ? new Date(wof.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      backgroundColor: sc.bg, color: sc.text,
                      border: `1px solid ${sc.border}`,
                      padding: '2px 10px', borderRadius: '20px',
                      fontSize: '0.65rem', fontWeight: '700',
                      textTransform: 'uppercase'
                    }}>
                      {sc.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sizing Tab (Premium Placeholder) ────────────────────────────────────────

function SizingTab() {
  return (
    <div style={{
      padding: '4rem 2rem',
      textAlign: 'center',
      backgroundColor: 'var(--surface-current)',
      border: '1px solid var(--border-current)',
      borderRadius: '16px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative gradient */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '200px', height: '200px',
        borderRadius: '0 16px 0 200px',
        background: 'rgba(14,165,233,0.06)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        width: '150px', height: '150px',
        borderRadius: '0 150px 0 16px',
        background: 'rgba(14,165,233,0.04)',
        pointerEvents: 'none'
      }} />

      <div style={{
        width: '72px', height: '72px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(14,165,233,0.04))',
        border: '1.5px solid rgba(14,165,233,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 1.5rem'
      }}>
        <Package size={34} color="#0ea5e9" />
      </div>

      <h2 style={{
        margin: '0 0 0.75rem 0', fontSize: '1.35rem',
        fontWeight: '800', color: 'var(--text-current)'
      }}>
        Sizing Module
      </h2>
      <p style={{
        margin: '0 auto', maxWidth: '460px',
        color: 'var(--text-muted-current)',
        fontSize: '0.9rem', lineHeight: '1.6'
      }}>
        Manage sizing processes for warp beams — track starch recipes, machine allocations, and beam handover records. This module is currently being developed and will be available soon.
      </p>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        marginTop: '2rem', padding: '0.5rem 1.25rem',
        borderRadius: '20px',
        backgroundColor: 'rgba(14,165,233,0.08)',
        border: '1px solid rgba(14,165,233,0.2)',
        color: '#0284c7',
        fontSize: '0.78rem', fontWeight: '700'
      }}>
        <Clock size={14} />
        Coming Soon
      </div>
    </div>
  );
}
