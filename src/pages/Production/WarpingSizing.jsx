import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Layers, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Loader, Calendar,
  Package, Zap, AlertCircle, Clock, X, Play,
  CheckCircle, Printer, AlertTriangle, StopCircle, RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PrintableWOFDC from './PrintableWOFDC';
import PrintableSOFDC from './PrintableSOFDC';

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
  const isFinished = wof.status === 'completed' || (wof.status === 'stopped' && (!!wof.wofdc_number || !!wof.sofdc_number));
  if (isFinished) {
    const actualEndStr = wof.process_completed_at
      ? getLocalDateString(wof.process_completed_at)
      : (getLocalDateString(wof.updated_at) || todayStr);
    return actualEndStr > plannedEndStr;
  }
  return todayStr > plannedEndStr;
}

function allocateLanes(items) {
  if (!items || items.length === 0) {
    return { itemLanes: {}, totalLanes: 1 };
  }

  // Sort items by start_date ascending
  const sorted = [...items].sort((a, b) => {
    const aStart = a.start_date || '';
    const bStart = b.start_date || '';
    if (aStart !== bStart) {
      return aStart.localeCompare(bStart);
    }
    const aEnd = a.end_date || '';
    const bEnd = b.end_date || '';
    return aEnd.localeCompare(bEnd);
  });

  const lanes = []; // Array of arrays: lanes[laneIndex] = [item1, item2, ...]
  const itemLanes = {}; // Map of item.id -> laneIndex

  sorted.forEach(item => {
    const itemStart = item.start_date || '';
    const itemEnd = item.end_date || '';
    
    // Find the first lane where this item does not overlap with any item in that lane
    let assignedLane = -1;
    for (let i = 0; i < lanes.length; i++) {
      let overlaps = false;
      for (const placed of lanes[i]) {
        const pStart = placed.start_date || '';
        const pEnd = placed.end_date || '';
        // Overlap condition: intervals [itemStart, itemEnd] and [pStart, pEnd] overlap
        if (itemStart <= pEnd && itemEnd >= pStart) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        assignedLane = i;
        break;
      }
    }

    if (assignedLane === -1) {
      lanes.push([item]);
      itemLanes[item.id] = lanes.length - 1;
    } else {
      lanes[assignedLane].push(item);
      itemLanes[item.id] = assignedLane;
    }
  });

  return {
    itemLanes,
    totalLanes: Math.max(lanes.length, 1)
  };
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

  const isFinished = wof.status === 'completed' || (wof.status === 'stopped' && !!wof.wofdc_number);

  if (isFinished) {
    const actualEndStr = wof.process_completed_at
      ? getLocalDateString(wof.process_completed_at)
      : (getLocalDateString(wof.updated_at) || todayStr);
    if (wof.end_date && actualEndStr > wof.end_date) {
      return { label: wof.status === 'completed' ? 'Late Completed' : 'Stopped Late', bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' };
    }
    return wof.status === 'completed'
      ? { label: 'Completed', bg: '#dcfce7', border: '#22c55e', text: '#166534' }
      : { label: 'Stopped', bg: '#fff7ed', border: '#f97316', text: '#c2410c' };
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
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const barRef = useRef(null);
  const sc = getStatusColor(wof.status);

  const handleClick = (e) => {
    e.stopPropagation();
    if (onWofClick) onWofClick(wof);
  };

  const updateCoords = () => {
    if (barRef.current) {
      const rect = barRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (hovered) {
      updateCoords();
      // Listen to scroll and resize events in capture phase to catch scroll on Gantt container
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
      return () => {
        window.removeEventListener('scroll', updateCoords, true);
        window.removeEventListener('resize', updateCoords);
      };
    }
  }, [hovered]);

  const bg = customBg || sc.bg;
  const border = customBorder || sc.border;
  const textColor = customTextColor || sc.text;
  const label = customLabel !== undefined ? customLabel : wof.wof_number;

  const barTop = topOffset !== undefined ? topOffset : (compact ? '6px' : '5px');
  const barHeight = customHeight !== undefined ? customHeight : (compact ? 'calc(100% - 12px)' : 'calc(100% - 10px)');

  return (
    <div
      ref={barRef}
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
        transition: 'box-shadow 0.15s',
        boxShadow: hovered ? '0 4px 10px rgba(0,0,0,0.12)' : 'none'
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

      {/* Hover Tooltip rendered via Portal to avoid overflow clipping */}
      {hovered && createPortal(
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: `${coords.top - 8}px`,
            left: `${coords.left + coords.width / 2}px`,
            transform: 'translate(-50%, -100%)',
            backgroundColor: '#1e293b',
            color: '#fff',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            minWidth: '240px',
            maxWidth: '320px',
            zIndex: 99999,
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
                      : wof.status === 'stopped'
                        ? 'Stopped'
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
                {tooltipType === 'planned' ? 'Planned' : tooltipType === 'actual' ? (wof.status === 'completed' ? 'Completed' : wof.status === 'stopped' ? 'Stopped' : 'On Process') : sc.label}
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
        </div>,
        document.body
      )}
    </div>
  );
}


// ─── Main Component ──────────────────────────────────────────────────────────

export default function WarpingSizing() {
  const navigate = useNavigate();

  // Primary tab: 'warping' | 'sizing'
  const [primaryTab, setPrimaryTab] = useState('warping');

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
      {primaryTab === 'warping' && <InHouseGantt />}

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

  // Group WOFs by machine_id, filtered to only those overlapping the visible date window
  const wofsByMachine = useMemo(() => {
    const windowStartKey = formatDateKey(days[0]);
    const windowEndKey = formatDateKey(days[days.length - 1]);
    const map = {};
    wofs.forEach(w => {
      if (!w.machine_id) return;
      // Determine the effective date range for this WOF
      const wStart = w.start_date || '';
      const wEnd = w.end_date || '';
      // If the WOF has no dates at all but is on_process, still show it
      if (!wStart && !wEnd) {
        if (w.status !== 'on_process') return;
      } else {
        // Skip if completely outside the visible window
        const effectiveStart = wStart || wEnd;
        const effectiveEnd = wEnd || wStart;
        if (effectiveEnd < windowStartKey || effectiveStart > windowEndKey) return;
      }
      if (!map[w.machine_id]) map[w.machine_id] = [];
      map[w.machine_id].push(w);
    });
    return map;
  }, [wofs, days]);

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
        backgroundColor: '#fff',
        minHeight: '450px'
      }}>
        <div className="gantt-scroll-container" style={{ overflowX: 'auto' }}>
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
                      {(() => {
                        const { itemLanes, totalLanes } = allocateLanes(machineWofs);
                        const LANE_HEIGHT = 28;
                        const ROW_PADDING = 12;
                        const rowHeight = totalLanes * LANE_HEIGHT + ROW_PADDING;

                        return (
                          <div style={{ display: 'flex', position: 'relative', flex: 1 }}>
                            {days.map((d, i) => (
                              <div key={i} style={{
                                width: `${DAY_COL_WIDTH}px`, minWidth: `${DAY_COL_WIDTH}px`,
                                borderRight: '1px solid #f5f5f5',
                                backgroundColor: isToday(d) ? 'rgba(128,0,0,0.03)' : d.getDay() === 0 ? '#fefafa' : 'transparent',
                                height: `${rowHeight}px`
                              }} />
                            ))}
                            {/* Overlay bars for each WOF */}
                            {machineWofs.map(wof => {
                              const bar = calcBarPosition(wof, days);
                              if (!bar) return null;
                              const laneIdx = itemLanes[wof.id] || 0;
                              return (
                                <GanttBar
                                  key={wof.id}
                                  wof={{ ...wof, wof_number: wof.beam_name ? `${wof.wof_number} (${wof.beam_name})` : wof.wof_number }}
                                  bar={bar}
                                  compact
                                  onWofClick={handleWofClick}
                                  topOffset={`${6 + laneIdx * LANE_HEIGHT}px`}
                                  customHeight={`${LANE_HEIGHT - 6}px`}
                                />
                              );
                            })}
                          </div>
                        );
                      })()}
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
                              const pBg = '#fef9c3';
                              const pBorder = '#eab308';
                              const pText = '#854d0e';

                              // 2. Actual Bar
                              const isFinished = wof.status === 'completed' || (wof.status === 'stopped' && !!wof.wofdc_number);
                              const showActual = !!wof.process_started_at || wof.status === 'on_process' || isFinished;
                              let actualBar = null;
                              let aBg = '';
                              let aBorder = '';
                              let aText = '';

                              if (showActual) {
                                const actualStartStr = getLocalDateString(wof.process_started_at) || wof.start_date || todayStr;
                                const actualEndStr = isFinished
                                  ? (getLocalDateString(wof.process_completed_at) || getLocalDateString(wof.updated_at) || todayStr)
                                  : todayStr;

                                actualBar = calcBarPositionForDates(actualStartStr, actualEndStr, days);
                                
                                if (wof.status === 'on_process') {
                                  if (exceeded) {
                                    aBg = '#fee2e2';
                                    aBorder = '#ef4444';
                                    aText = '#b91c1c';
                                  } else {
                                    aBg = '#dbeafe';
                                    aBorder = '#3b82f6';
                                    aText = '#1d4ed8';
                                  }
                                } else if (isFinished) {
                                  if (exceeded) {
                                    aBg = '#fee2e2';
                                    aBorder = '#ef4444';
                                    aText = '#b91c1c';
                                  } else {
                                    aBg = wof.status === 'completed' ? '#dcfce7' : '#fff7ed';
                                    aBorder = wof.status === 'completed' ? '#22c55e' : '#f97316';
                                    aText = wof.status === 'completed' ? '#166534' : '#c2410c';
                                  }
                                } else {
                                  const statusColor = getStatusColor(wof.status);
                                  aBg = statusColor.bg;
                                  aBorder = statusColor.border;
                                  aText = statusColor.text;
                                }
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
          onStatusChanged={(keepOpen) => {
            if (keepOpen !== true) {
              setSelectedWof(null);
            }
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

  // Stop process wizard states
  const [stopStep, setStopStep] = useState(null);
  const [stopIsPermanent, setStopIsPermanent] = useState(false);
  const [stopHasSplits, setStopHasSplits] = useState(false);
  const [stopSplits, setStopSplits] = useState([]);
  const [loadingStopSplits, setLoadingStopSplits] = useState(false);

  // Start Process form fields
  const [warperName, setWarperName] = useState('');
  const [warpingWorkers, setWarpingWorkers] = useState([]);
  const [selectedBeamId, setSelectedBeamId] = useState('');
  const [processDate, setProcessDate] = useState(() => {
    const now = new Date();
    const tzoffset = now.getTimezoneOffset() * 60000;
    return new Date(now - tzoffset).toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm (local)
  });

  const [completeDate, setCompleteDate] = useState(() => {
    const now = new Date();
    const tzoffset = now.getTimezoneOffset() * 60000;
    return new Date(now - tzoffset).toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm (local)
  });

  const [completeSplits, setCompleteSplits] = useState([]);
  const [yarnReturns, setYarnReturns] = useState([]);
  const [showWofdcReceipt, setShowWofdcReceipt] = useState(false);

  useEffect(() => {
    if ((showCompleteForm || stopStep) && wofDetail) {
      // Initialize splits if not initialized yet
      if (completeSplits.length === 0) {
        const initialSplits = (wofDetail.warp_splits && wofDetail.warp_splits.length > 0)
          ? wofDetail.warp_splits.map(s => ({
              warp_no: s.warp_no,
              qty: s.qty !== undefined ? s.qty : wofDetail.qty,
              beam_id: s.beam_id || wofDetail.beam_id || '',
              beam_name: s.beam_name || wofDetail.beam_name || '',
              start_date: s.start_date || wofDetail.start_date || '',
              end_date: s.end_date || wofDetail.end_date || ''
            }))
          : [{
              warp_no: `${wofDetail.wof_number}/1`,
              qty: wofDetail.qty,
              beam_id: wofDetail.beam_id || '',
              beam_name: wofDetail.beam_name || '',
              start_date: wofDetail.start_date || '',
              end_date: wofDetail.end_date || ''
            }];
        setCompleteSplits(initialSplits);
      }

      // Initialize yarn returns by grouping deliveryItems by count, colour, and lot number
      if (yarnReturns.length === 0) {
        const initialReturns = [];
        const seen = new Set();
        deliveryItems.forEach(item => {
          const key = `${item.yarn_count_id}_${item.colour}_${item.lot_number || '—'}`;
          if (!seen.has(key)) {
            seen.add(key);
            const countVal = item.yarn_count ? [item.yarn_count.count_value, item.yarn_count.spec, item.yarn_count.spec1].filter(Boolean).join(' ') : item.yarn_count_id || '—';
            
            const totalReceived = deliveryItems
              .filter(d => d.yarn_count_id === item.yarn_count_id && d.colour === item.colour && (d.lot_number || '—') === (item.lot_number || '—'))
              .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

            initialReturns.push({
              yarn_count_id: item.yarn_count_id,
              count_display: countVal,
              colour: item.colour,
              lot_number: item.lot_number || '—',
              quantity_received: totalReceived,
              quantity_returned: 0
            });
          }
        });
        setYarnReturns(initialReturns);
      }
    }
  }, [showCompleteForm, stopStep, wofDetail, deliveryItems]);

  useEffect(() => {
    fetchDetails();
    setShowWofdcReceipt(false);
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
          yarn_count:master_yarn_counts(count_value, material, product_type, spec, spec1),
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

      // 5. Fetch warping workers
      try {
        const { data: deptData } = await supabase
          .from('master_departments')
          .select('id')
          .ilike('department_name', '%warping%');
          
        const warpingDeptIds = (deptData || []).map(d => d.id);
        
        if (warpingDeptIds.length > 0) {
          const { data: workersData } = await supabase
            .from('master_workers')
            .select('*')
            .in('department_id', warpingDeptIds)
            .order('worker_name', { ascending: true });
          setWarpingWorkers(workersData || []);
        }
      } catch (err) {
        console.error('Error fetching warping workers:', err);
      }
    } catch (err) {
      console.error('Error fetching WOF detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCountDisplay = (countId) => {
    const yc = yarnCounts.find(y => y.id === countId);
    return yc ? [yc.count_value, yc.spec, yc.spec1].filter(Boolean).join(' ') : countId || '—';
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
    // 1. Validation
    for (let i = 0; i < completeSplits.length; i++) {
      const split = completeSplits[i];
      if (!split.beam_id) {
        alert(`Please select a Beam Number for Split ${split.warp_no}`);
        return;
      }
      const parsedQty = parseFloat(split.qty);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        alert(`Please enter a valid Quantity for Split ${split.warp_no}`);
        return;
      }
    }

    for (let i = 0; i < yarnReturns.length; i++) {
      const ret = yarnReturns[i];
      const retQty = parseFloat(ret.quantity_returned || 0);
      if (isNaN(retQty) || retQty < 0) {
        alert(`Please enter a valid return quantity for Colour ${ret.colour}, Lot ${ret.lot_number}`);
        return;
      }
      if (retQty > ret.quantity_received) {
        alert(`Return quantity (${retQty} kg) cannot exceed received quantity (${ret.quantity_received} kg) for Colour ${ret.colour}, Lot ${ret.lot_number}`);
        return;
      }
    }

    setSaving(true);
    try {
      const wofdcNumber = wofDetail.wof_number.replace('/WOF/', '/WOFDC/') + '/1';

      const updatedSplits = completeSplits.map(s => {
        const beam = beams.find(b => b.id === s.beam_id);
        return {
          ...s,
          qty: parseFloat(s.qty),
          beam_name: beam ? beam.beam_name : s.beam_name
        };
      });

      // Update Warping Order Form
      const { error } = await supabase
        .from('warping_order_forms')
        .update({
          status: 'completed',
          process_completed_at: new Date(completeDate).toISOString(),
          warp_splits: updatedSplits,
          yarn_returns: yarnReturns,
          wofdc_number: wofdcNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', wof.id);

      if (error) throw error;

      // Update corresponding Sizing Order Forms
      const { data: siblingSofs, error: sofFetchError } = await supabase
        .from('sizing_order_forms')
        .select('id, sof_number')
        .eq('wof_id', wof.id);

      if (sofFetchError) throw sofFetchError;

      if (siblingSofs && siblingSofs.length > 0) {
        const sortedSiblings = [...siblingSofs].sort((a, b) => a.sof_number.localeCompare(b.sof_number));
        for (let i = 0; i < sortedSiblings.length; i++) {
          const splitData = updatedSplits[i];
          if (splitData) {
            const { error: sofUpdateErr } = await supabase
              .from('sizing_order_forms')
              .update({
                qty: parseFloat(splitData.qty),
                beam_id: splitData.beam_id || null,
                beam_name: splitData.beam_name || null,
                updated_at: new Date().toISOString()
              })
              .eq('id', sortedSiblings[i].id);
            if (sofUpdateErr) throw sofUpdateErr;
          }
        }
      }

      await fetchDetails();
      onStatusChanged(true);
      setShowCompleteForm(false);
      setShowWofdcReceipt(true);
    } catch (err) {
      console.error('Error completing process:', err);
      alert('Failed to complete process: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadStopSplits = async () => {
    setLoadingStopSplits(true);
    try {
      if (wofDetail?.forwarded_to === 'sizing') {
        const { data, error } = await supabase
          .from('sizing_order_forms')
          .select('*')
          .eq('wof_id', wofDetail.id)
          .order('sof_number', { ascending: true });
        if (error) throw error;
        const parentSplits = wofDetail.warp_splits || [];
        setStopSplits((data || []).map((item, idx) => ({
          ...item,
          warp_no: item.warp_no || parentSplits[idx]?.warp_no || `${wofDetail.wof_number}/${idx + 1}`,
          completedQty: item.qty ? item.qty.toString() : '0'
        })));
      } else if (wofDetail?.forwarded_to === 'weaving') {
        const { data, error } = await supabase
          .from('weaving_orders')
          .select('*')
          .eq('wof_id', wofDetail.id)
          .order('weaving_number', { ascending: true });
        if (error) throw error;
        const parentSplits = wofDetail.warp_splits || [];
        setStopSplits((data || []).map((item, idx) => ({
          ...item,
          warp_no: item.warp_no || parentSplits[idx]?.warp_no || `${wofDetail.wof_number}/${idx + 1}`,
          completedQty: item.qty ? item.qty.toString() : '0'
        })));
      } else {
        setStopSplits([]);
      }
    } catch (err) {
      console.error('Error fetching sibling splits:', err);
      alert('Error fetching splits: ' + err.message);
    } finally {
      setLoadingStopSplits(false);
    }
  };

  const handleTemporaryStop = async () => {
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
      setStopStep(null);
      onStatusChanged();
    } catch (err) {
      console.error('Error stopping process temporarily:', err);
      alert('Failed to stop process temporarily: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePermanentStop = async () => {
    for (let i = 0; i < yarnReturns.length; i++) {
      const ret = yarnReturns[i];
      const retQty = parseFloat(ret.quantity_returned || 0);
      if (isNaN(retQty) || retQty < 0) {
        alert(`Please enter a valid return quantity for Colour ${ret.colour}, Lot ${ret.lot_number}`);
        return;
      }
      if (retQty > ret.quantity_received) {
        alert(`Return quantity (${retQty} kg) cannot exceed received quantity (${ret.quantity_received} kg) for Colour ${ret.colour}, Lot ${ret.lot_number}`);
        return;
      }
    }

    setSaving(true);
    try {
      const wofdcNumber = wofDetail.wof_number.replace('/WOF/', '/WOFDC/') + '/1';
      let finalWarpSplits = [];

      if (stopHasSplits) {
        for (const split of stopSplits) {
          const completedQty = parseFloat(split.completedQty || 0);
          if (completedQty <= 0) {
            if (wofDetail.forwarded_to === 'sizing') {
              const { error: delErr } = await supabase
                .from('sizing_order_forms')
                .delete()
                .eq('id', split.id);
              if (delErr) throw delErr;
            } else if (wofDetail.forwarded_to === 'weaving') {
              const { error: delErr } = await supabase
                .from('weaving_orders')
                .delete()
                .eq('id', split.id);
              if (delErr) throw delErr;
            }
          } else {
            if (wofDetail.forwarded_to === 'sizing') {
              const { error: updErr } = await supabase
                .from('sizing_order_forms')
                .update({
                  qty: completedQty,
                  original_qty: completedQty,
                  updated_at: new Date().toISOString()
                })
                .eq('id', split.id);
              if (updErr) throw updErr;
            } else if (wofDetail.forwarded_to === 'weaving') {
              const { error: updErr } = await supabase
                .from('weaving_orders')
                .update({
                  qty: completedQty,
                  original_qty: completedQty,
                  updated_at: new Date().toISOString()
                })
                .eq('id', split.id);
              if (updErr) throw updErr;
            }

            finalWarpSplits.push({
              warp_no: split.sof_number || split.weaving_number || split.warp_no,
              qty: completedQty,
              beam_id: split.beam_id || null,
              beam_name: split.beam_name || split.beam_number || '',
              start_date: split.start_date || '',
              end_date: split.end_date || '',
              sizing_type: split.sizing_type || null,
              weaving_type: split.weaving_type || null,
              partner_id: split.partner_id || null,
              partner_name: split.partner_name || null,
              machine_id: split.machine_id || null,
              machine_name: split.machine_name || null
            });
          }
        }
      } else {
        if (wofDetail.forwarded_to === 'sizing') {
          const { error: delAllErr } = await supabase
            .from('sizing_order_forms')
            .delete()
            .eq('wof_id', wofDetail.id);
          if (delAllErr) throw delAllErr;
        } else if (wofDetail.forwarded_to === 'weaving') {
          const { error: delAllErr } = await supabase
            .from('weaving_orders')
            .delete()
            .eq('wof_id', wofDetail.id);
          if (delAllErr) throw delAllErr;
        }
        finalWarpSplits = [];
      }

      const isForwardedCleared = finalWarpSplits.length === 0;
      const finalWofQty = stopHasSplits
        ? finalWarpSplits.reduce((sum, s) => sum + parseFloat(s.qty || 0), 0)
        : 0;
      const originalQty = Number(wofDetail.original_qty || wofDetail.qty);

      const { error: wofUpdateErr } = await supabase
        .from('warping_order_forms')
        .update({
          status: 'stopped',
          qty: finalWofQty,
          original_qty: originalQty,
          process_completed_at: new Date().toISOString(),
          wofdc_number: wofdcNumber,
          warp_splits: finalWarpSplits,
          warp_splits_count: finalWarpSplits.length,
          forwarded_to: isForwardedCleared ? null : wofDetail.forwarded_to,
          sizing_type: isForwardedCleared ? null : (wofDetail.sizing_type || null),
          yarn_returns: yarnReturns,
          updated_at: new Date().toISOString()
        })
        .eq('id', wofDetail.id);

      if (wofUpdateErr) throw wofUpdateErr;

      setStopStep(null);
      await fetchDetails();
      onStatusChanged(true);
    } catch (err) {
      console.error('Error stopping process permanently:', err);
      alert('Failed to stop process permanently: ' + err.message);
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

            {/* ── Forwarded Details & Split Configuration ── */}
            {detail.forwarded_to && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '1.25rem',
                backgroundColor: 'rgba(14,165,233,0.02)',
                border: '1px solid rgba(14,165,233,0.2)',
                borderRadius: '12px'
              }}>
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '800', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  ✈️ Forwarding & Split Configuration
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <InfoField label="Forwarded Process" value={detail.forwarded_to.toUpperCase()} highlight />
                  {detail.forwarded_to === 'sizing' && (
                    <InfoField label="Sizing Type" value={detail.sizing_type === 'in_house' ? 'In-House' : 'Job Work'} />
                  )}
                  <InfoField label="Number of Splits" value={detail.warp_splits_count} />
                </div>

                <div style={{ border: '1px solid var(--border-current)', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f0f9ff', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                        {['Warp / SOF Number', 'Quantity (Mtrs)', 'Start Date', 'End Date'].map(h => (
                          <th key={h} style={{ padding: '0.55rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.warp_splits || []).map((split, sIdx) => (
                        <tr key={sIdx} style={{ borderBottom: sIdx < (detail.warp_splits.length - 1) ? '1px solid var(--border-current)' : 'none' }}>
                          <td style={{ padding: '0.55rem 0.75rem', fontWeight: '700', fontFamily: 'monospace', color: '#0ea5e9' }}>
                            {split.warp_no}
                          </td>
                          <td style={{ padding: '0.55rem 0.75rem', fontWeight: '600' }}>
                            {Number(split.qty).toLocaleString()}
                          </td>
                          <td style={{ padding: '0.55rem 0.75rem' }}>
                            {split.start_date ? new Date(split.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '0.55rem 0.75rem' }}>
                            {split.end_date ? new Date(split.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
                        <select
                          value={warperName}
                          onChange={e => setWarperName(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            border: '1.5px solid var(--border-current)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            outline: 'none',
                            transition: 'border-color 0.15s',
                            boxSizing: 'border-box',
                            backgroundColor: '#fff',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">Select warper...</option>
                          {warpingWorkers.map(w => (
                            <option key={w.id} value={w.worker_name}>{w.worker_name}</option>
                          ))}
                        </select>
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
                      onClick={() => setStopStep('confirm_type')}
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

                    {/* Date and Time */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.25rem', maxWidth: '300px' }}>
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

                    {/* Warp Splits Configuration */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Warp Split Configurations
                      </h4>
                      <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Warp Split</th>
                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Beam Number *</th>
                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Actual Quantity (Mtrs) *</th>
                            </tr>
                          </thead>
                          <tbody>
                            {completeSplits.map((split, index) => (
                              <tr key={index} style={{ borderBottom: index < (completeSplits.length - 1) ? '1px solid var(--border-current)' : 'none' }}>
                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', fontFamily: 'monospace', color: '#800000' }}>
                                  {split.warp_no}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                  <select
                                    value={split.beam_id}
                                    onChange={e => {
                                      const updated = [...completeSplits];
                                      updated[index].beam_id = e.target.value;
                                      setCompleteSplits(updated);
                                    }}
                                    style={{
                                      padding: '0.4rem 0.5rem',
                                      borderRadius: '6px',
                                      border: '1.5px solid var(--border-current)',
                                      fontSize: '0.78rem',
                                      width: '100%',
                                      outline: 'none'
                                    }}
                                  >
                                    <option value="">Select Beam</option>
                                    {beams.map(b => (
                                      <option key={b.id} value={b.id}>{b.beam_name}</option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                  <input
                                    type="number"
                                    value={split.qty}
                                    onChange={e => {
                                      const updated = [...completeSplits];
                                      updated[index].qty = e.target.value;
                                      setCompleteSplits(updated);
                                    }}
                                    style={{
                                      padding: '0.4rem 0.5rem',
                                      borderRadius: '6px',
                                      border: '1.5px solid var(--border-current)',
                                      fontSize: '0.78rem',
                                      width: '100%',
                                      boxSizing: 'border-box',
                                      outline: 'none'
                                    }}
                                    placeholder="Enter Quantity"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Dyed Yarn Return Details */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Dyed Yarn Return Details (Excess Returns)
                      </h4>
                      {yarnReturns.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted-current)', border: '1px dashed var(--border-current)', borderRadius: '8px', backgroundColor: '#fff' }}>
                          No dyed yarn received for this process.
                        </div>
                      ) : (
                        <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Colour</th>
                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Count</th>
                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Lot Number</th>
                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Received (kg)</th>
                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', width: '130px' }}>Return Qty (kg)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {yarnReturns.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: idx < (yarnReturns.length - 1) ? '1px solid var(--border-current)' : 'none' }}>
                                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>
                                    {item.colour}
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    {item.count_display}
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace' }}>
                                    {item.lot_number}
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>
                                    {Number(item.quantity_received).toFixed(2)}
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.quantity_returned}
                                      onChange={e => {
                                        const updated = [...yarnReturns];
                                        updated[idx].quantity_returned = e.target.value;
                                        setYarnReturns(updated);
                                      }}
                                      style={{
                                        padding: '0.4rem 0.5rem',
                                        borderRadius: '6px',
                                        border: '1.5px solid var(--border-current)',
                                        fontSize: '0.78rem',
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        outline: 'none'
                                      }}
                                      placeholder="0.00"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
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
                {detail.wofdc_number ? (
                  <div style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#fff7ed',
                    border: '1.5px solid #fed7aa',
                    borderRadius: '8px',
                    color: '#c2410c',
                    fontSize: '0.825rem',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    🛑 Process Stopped Permanently (WOFDC Generated)
                  </div>
                ) : (
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
                )}
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

            {/* Show Printable WOFDC Delivery Receipt if completed */}
            {(detail.status === 'completed' || (detail.status === 'stopped' && detail.wofdc_number)) && (
              <PrintableWOFDC 
                wof={detail} 
                order={detail.order} 
                splits={detail.warp_splits || []} 
                yarnReturns={detail.yarn_returns || []} 
              />
            )}

            {/* Custom Stop Process Wizard Overlay */}
            {stopStep && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                backdropFilter: 'blur(8px)',
                zIndex: 2000,
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                padding: '1.5rem',
                boxSizing: 'border-box',
                animation: 'fadeIn 0.25s ease-out'
              }}>
                <div style={{
                  backgroundColor: '#fff',
                  borderRadius: '24px',
                  width: '100%',
                  maxWidth: stopStep === 'splits_table' ? '1150px' : stopStep === 'yarn_returns' ? '800px' : '680px',
                  maxHeight: '85vh',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)',
                  overflow: 'hidden',
                  border: '1px solid rgba(128, 0, 0, 0.08)',
                  transition: 'max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                  {/* Modal Header */}
                  <div style={{
                    padding: '1.75rem 2.25rem',
                    borderBottom: '1px solid #f3f4f6',
                    background: 'linear-gradient(135deg, #800000, #4d0000)',
                    color: '#fff',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em' }}>Stop Warping Process</h3>
                      <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.825rem', opacity: 0.85, fontWeight: '500' }}>
                        WOF: <strong style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{wofDetail?.wof_number || wof.wof_number}</strong>
                      </p>
                    </div>
                    <button 
                      onClick={() => setStopStep(null)} 
                      style={{ 
                        background: 'rgba(255,255,255,0.12)', 
                        border: 'none', 
                        borderRadius: '50%', 
                        width: '36px', 
                        height: '36px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        cursor: 'pointer', 
                        color: '#fff', 
                        fontSize: '1.25rem', 
                        transition: 'all 0.2s' 
                      }} 
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.22)'} 
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
                    >
                      &times;
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem 2.25rem', backgroundColor: '#fcfcfc', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {stopStep === 'confirm_type' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{ textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', letterSpacing: '-0.02em' }}>
                            Choose Stop Mode
                          </div>
                          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
                            Would you like to temporarily pause the warping run or permanently stop the process?
                          </p>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '0.5rem' }}>
                          {/* Option 1: Temporary Pause */}
                          <div style={{
                            border: '1.5px solid #e5e7eb',
                            borderRadius: '18px',
                            padding: '2.25rem 1.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: '1.25rem',
                            backgroundColor: '#fff',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
                          }}
                          onMouseEnter={e => { 
                            e.currentTarget.style.transform = 'translateY(-5px)'; 
                            e.currentTarget.style.borderColor = '#800000'; 
                            e.currentTarget.style.boxShadow = '0 16px 28px -10px rgba(128, 0, 0, 0.12)'; 
                          }}
                          onMouseLeave={e => { 
                            e.currentTarget.style.transform = 'translateY(0)'; 
                            e.currentTarget.style.borderColor = '#e5e7eb'; 
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.02)'; 
                          }}
                          onClick={handleTemporaryStop}
                          >
                            <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#fff5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#800000', boxShadow: '0 4px 10px rgba(128, 0, 0, 0.06)' }}>
                              <Clock size={24} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', fontSize: '1.05rem', color: '#111827' }}>Pause Process</h4>
                              <p style={{ margin: 0, fontSize: '0.825rem', color: '#6b7280', lineHeight: '1.5' }}>
                                Temporarily pause the run. You can resume this same process later without losing any configuration.
                              </p>
                            </div>
                            <button style={{
                              width: '100%',
                              padding: '0.65rem 1rem',
                              border: '1.5px solid #800000',
                              borderRadius: '10px',
                              backgroundColor: '#fff',
                              color: '#800000',
                              fontWeight: '700',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = '#800000';
                              e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = '#fff';
                              e.currentTarget.style.color = '#800000';
                            }}
                            >
                              Pause Process
                            </button>
                          </div>

                          {/* Option 2: Permanent Stop */}
                          <div style={{
                            border: '1.5px solid #e5e7eb',
                            borderRadius: '18px',
                            padding: '2.25rem 1.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: '1.25rem',
                            backgroundColor: '#fff',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
                          }}
                          onMouseEnter={e => { 
                            e.currentTarget.style.transform = 'translateY(-5px)'; 
                            e.currentTarget.style.borderColor = '#800000'; 
                            e.currentTarget.style.boxShadow = '0 16px 28px -10px rgba(128, 0, 0, 0.12)'; 
                          }}
                          onMouseLeave={e => { 
                            e.currentTarget.style.transform = 'translateY(0)'; 
                            e.currentTarget.style.borderColor = '#e5e7eb'; 
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.02)'; 
                          }}
                          onClick={() => {
                            setStopIsPermanent(true);
                            if (!wofDetail?.forwarded_to) {
                              setStopHasSplits(false);
                              const updatedReturns = yarnReturns.map(r => ({
                                ...r,
                                quantity_returned: r.quantity_received.toString()
                              }));
                              setYarnReturns(updatedReturns);
                              setStopStep('yarn_returns');
                            } else {
                              setStopStep('ask_splits');
                            }
                          }}
                          >
                            <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48', boxShadow: '0 4px 10px rgba(225, 29, 72, 0.06)' }}>
                              <StopCircle size={24} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', fontSize: '1.05rem', color: '#e11d48' }}>Stop Permanently</h4>
                              <p style={{ margin: 0, fontSize: '0.825rem', color: '#6b7280', lineHeight: '1.5' }}>
                                Stop the process completely. Generates WOFDC delivery receipt and returns dyed yarn. Cannot be resumed.
                              </p>
                            </div>
                            <button style={{
                              width: '100%',
                              padding: '0.65rem 1rem',
                              border: 'none',
                              borderRadius: '10px',
                              backgroundColor: '#800000',
                              color: '#fff',
                              fontWeight: '700',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              boxShadow: '0 4px 12px rgba(128, 0, 0, 0.15)',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#600000'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#800000'}
                            >
                              Stop Permanently
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {stopStep === 'ask_splits' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{ textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', letterSpacing: '-0.02em' }}>
                            Are there any splits?
                          </div>
                          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
                            Choose whether you want to record completed quantities for the forwarded warp split configurations.
                          </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '0.5rem' }}>
                          {/* Option 1: No Splits */}
                          <div style={{
                            border: '1.5px solid #e5e7eb',
                            borderRadius: '18px',
                            padding: '2.25rem 1.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: '1.25rem',
                            backgroundColor: '#fff',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
                          }}
                          onMouseEnter={e => { 
                            e.currentTarget.style.transform = 'translateY(-5px)'; 
                            e.currentTarget.style.borderColor = '#800000'; 
                            e.currentTarget.style.boxShadow = '0 16px 28px -10px rgba(128, 0, 0, 0.12)'; 
                          }}
                          onMouseLeave={e => { 
                            e.currentTarget.style.transform = 'translateY(0)'; 
                            e.currentTarget.style.borderColor = '#e5e7eb'; 
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.02)'; 
                          }}
                          onClick={() => {
                            setStopHasSplits(false);
                            const updatedReturns = yarnReturns.map(r => ({
                              ...r,
                              quantity_returned: r.quantity_received.toString()
                            }));
                            setYarnReturns(updatedReturns);
                            setStopStep('yarn_returns');
                          }}
                          >
                            <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', boxShadow: '0 4px 10px rgba(75, 85, 99, 0.06)' }}>
                              <X size={24} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', fontSize: '1.05rem', color: '#111827' }}>No splits</h4>
                              <p style={{ margin: 0, fontSize: '0.825rem', color: '#6b7280', lineHeight: '1.5' }}>
                                Clear all split configurations from the database and return the total received warp dyed yarn.
                              </p>
                            </div>
                            <button style={{
                              width: '100%',
                              padding: '0.65rem 1rem',
                              border: '1.5px solid #800000',
                              borderRadius: '10px',
                              backgroundColor: '#fff',
                              color: '#800000',
                              fontWeight: '700',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = '#800000';
                              e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = '#fff';
                              e.currentTarget.style.color = '#800000';
                            }}
                            >
                              No splits, delete configs
                            </button>
                          </div>

                          {/* Option 2: Yes splits */}
                          <div style={{
                            border: '1.5px solid #e5e7eb',
                            borderRadius: '18px',
                            padding: '2.25rem 1.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: '1.25rem',
                            backgroundColor: '#fff',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
                          }}
                          onMouseEnter={e => { 
                            e.currentTarget.style.transform = 'translateY(-5px)'; 
                            e.currentTarget.style.borderColor = '#800000'; 
                            e.currentTarget.style.boxShadow = '0 16px 28px -10px rgba(128, 0, 0, 0.12)'; 
                          }}
                          onMouseLeave={e => { 
                            e.currentTarget.style.transform = 'translateY(0)'; 
                            e.currentTarget.style.borderColor = '#e5e7eb'; 
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.02)'; 
                          }}
                          onClick={async () => {
                            setStopHasSplits(true);
                            await loadStopSplits();
                            setStopStep('splits_table');
                          }}
                          >
                            <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#fff5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#800000', boxShadow: '0 4px 10px rgba(128, 0, 0, 0.06)' }}>
                              <Layers size={24} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', fontSize: '1.05rem', color: '#800000' }}>Yes, splits exist</h4>
                              <p style={{ margin: 0, fontSize: '0.825rem', color: '#6b7280', lineHeight: '1.5' }}>
                                Record completed quantities for each configuration. Entering 0 will delete that split midway.
                              </p>
                            </div>
                            <button style={{
                              width: '100%',
                              padding: '0.65rem 1rem',
                              border: 'none',
                              borderRadius: '10px',
                              backgroundColor: '#800000',
                              color: '#fff',
                              fontWeight: '700',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              boxShadow: '0 4px 12px rgba(128, 0, 0, 0.15)',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#600000'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#800000'}
                            >
                              Yes, record splits
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {stopStep === 'splits_table' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#800000', letterSpacing: '-0.01em' }}>
                            Warp Split Configurations Completed Quantities
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: '600' }}>* Required</span>
                        </div>
                        
                        {loadingStopSplits ? (
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: '#6b7280', gap: '0.75rem', fontSize: '0.9rem', fontWeight: '500' }}>
                            <Loader size={20} className="spin" color="#800000" /> Loading splits configurations...
                          </div>
                        ) : stopSplits.length === 0 ? (
                          <div style={{ padding: '3rem 2rem', textAlign: 'center', fontSize: '0.9rem', color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: '16px', backgroundColor: '#fff' }}>
                            No splits found in the database.
                          </div>
                        ) : (
                          <div style={{ border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)' }}>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#fff5f5', borderBottom: '2px solid #fee2e2', textAlign: 'left' }}>
                                  <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Config Number</th>
                                  <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>SOF/WVOF Number</th>
                                  <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Scope</th>
                                  <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Partner Name</th>
                                  <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Machine</th>
                                  <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Beam Number</th>
                                  <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000', width: '150px' }}>Completed Qty (m)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {stopSplits.map((split, index) => {
                                  const isSizing = wofDetail?.forwarded_to === 'sizing';
                                  const configNo = split.warp_no || '';
                                  const targetNo = split.sof_number || split.weaving_number || '';
                                  const typeLabel = isSizing ? 'SOF' : 'WVOF';
                                  const scopeLabel = isSizing ? split.sizing_type : split.weaving_type;
                                  const partner = split.partner_name || '—';
                                  const machine = split.machine_name || '—';
                                  const beam = split.beam_name || split.beam_number || '—';
                                  return (
                                    <tr key={index} style={{ borderBottom: index < stopSplits.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background-color 0.15s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff9f9'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                      <td style={{ padding: '1rem 1.25rem', fontWeight: '700', fontFamily: 'monospace', color: '#111827' }}>{configNo}</td>
                                      <td style={{ padding: '1rem 1.25rem' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                          <span style={{ backgroundColor: isSizing ? '#e0f2fe' : '#dcfce7', color: isSizing ? '#0369a1' : '#15803d', padding: '4px 10px', borderRadius: '8px', fontSize: '0.725rem', fontWeight: '800' }}>
                                            {typeLabel}
                                          </span>
                                          {targetNo && (
                                            <span style={{ fontWeight: '600', fontFamily: 'monospace', color: '#4b5563' }}>
                                              {targetNo}
                                            </span>
                                          )}
                                        </span>
                                      </td>
                                      <td style={{ padding: '1rem 1.25rem', textTransform: 'capitalize', fontWeight: '600', color: '#374151' }}>{scopeLabel ? scopeLabel.replace('_', ' ') : '—'}</td>
                                      <td style={{ padding: '1rem 1.25rem', color: '#4b5563', fontWeight: '500' }}>{partner}</td>
                                      <td style={{ padding: '1rem 1.25rem', color: '#4b5563', fontWeight: '500' }}>{machine}</td>
                                      <td style={{ padding: '1rem 1.25rem', color: '#4b5563', fontWeight: '500' }}>{beam}</td>
                                      <td style={{ padding: '0.75rem 1.25rem' }}>
                                        <input
                                          type="number"
                                          value={split.completedQty}
                                          onChange={e => {
                                            const updated = [...stopSplits];
                                            updated[index].completedQty = e.target.value;
                                            setStopSplits(updated);
                                          }}
                                          style={{ 
                                            padding: '0.55rem 0.8rem', 
                                            borderRadius: '10px', 
                                            border: '1.5px solid #e5e7eb', 
                                            fontSize: '0.85rem', 
                                            width: '100%', 
                                            boxSizing: 'border-box', 
                                            outline: 'none', 
                                            transition: 'all 0.2s', 
                                            fontWeight: '600',
                                            color: '#111827'
                                          }}
                                          onFocus={e => {
                                            e.target.style.borderColor = '#800000';
                                            e.target.style.boxShadow = '0 0 0 4px rgba(128, 0, 0, 0.12)';
                                          }}
                                          onBlur={e => {
                                            e.target.style.borderColor = '#e5e7eb';
                                            e.target.style.boxShadow = 'none';
                                          }}
                                          placeholder="0"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        )}
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.8rem', color: '#991b1b', backgroundColor: '#fff5f5', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #fee2e2', lineHeight: '1.4' }}>
                          <AlertCircle size={16} color="#b91c1c" style={{ flexShrink: 0 }} />
                          <span><strong>Note:</strong> Entering 0 for any splits quantity is allowed. That configuration will be deleted (i.e. stopped midway).</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '1.5rem', borderTop: '1px solid #f3f4f6' }}>
                          <button
                            onClick={() => setStopStep('ask_splits')}
                            style={{
                              padding: '0.7rem 1.5rem',
                              border: '1.5px solid #d1d5db',
                              borderRadius: '10px',
                              backgroundColor: '#fff',
                              color: '#4b5563',
                              fontWeight: '600',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                          >
                            Back
                          </button>
                          <button
                            onClick={() => {
                              for (const s of stopSplits) {
                                const q = parseFloat(s.completedQty || 0);
                                if (isNaN(q) || q < 0) {
                                  alert('Please enter valid completed quantities (0 or more).');
                                  return;
                                }
                              }
                              setStopStep('yarn_returns');
                            }}
                            style={{
                              padding: '0.7rem 1.75rem',
                              border: 'none',
                              borderRadius: '10px',
                              backgroundColor: '#800000',
                              color: '#fff',
                              fontWeight: '700',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              transition: 'all 0.2s',
                              boxShadow: '0 4px 12px rgba(128, 0, 0, 0.15)'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#600000'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#800000'}
                          >
                            Next: Yarn Returns
                          </button>
                        </div>
                      </div>
                    )}

                    {stopStep === 'yarn_returns' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#800000', letterSpacing: '-0.01em' }}>
                            Warp Dyed Yarn Return Details
                          </h4>
                        </div>
                        
                        {yarnReturns.length === 0 ? (
                          <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem', border: '2px dashed #e5e7eb', borderRadius: '16px', backgroundColor: '#fff' }}>
                            No dyed yarn received for this process yet.
                          </div>
                        ) : (
                          <div style={{ border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)' }}>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#fff5f5', borderBottom: '2px solid #fee2e2', textAlign: 'left' }}>
                                  <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Colour</th>
                                  <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Count</th>
                                  <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Lot Number</th>
                                  <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000', textAlign: 'right' }}>Received (kg)</th>
                                  <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000', width: '160px' }}>Return Qty (kg)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {yarnReturns.map((item, idx) => (
                                  <tr key={idx} style={{ borderBottom: idx < yarnReturns.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background-color 0.15s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff9f9'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <td style={{ padding: '1rem 1.25rem', fontWeight: '750', color: '#111827' }}>{item.colour}</td>
                                    <td style={{ padding: '1rem 1.25rem', color: '#4b5563', fontWeight: '600' }}>{item.count_display}</td>
                                    <td style={{ padding: '1rem 1.25rem', fontFamily: 'monospace', color: '#6b7280', fontWeight: '500' }}>{item.lot_number}</td>
                                    <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: '750', color: '#111827' }}>{Number(item.quantity_received).toFixed(2)}</td>
                                    <td style={{ padding: '0.75rem 1.25rem' }}>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={item.quantity_returned}
                                        onChange={e => {
                                          const updated = [...yarnReturns];
                                          updated[idx].quantity_returned = e.target.value;
                                          setYarnReturns(updated);
                                        }}
                                        style={{ 
                                          padding: '0.55rem 0.8rem', 
                                          borderRadius: '10px', 
                                          border: '1.5px solid #e5e7eb', 
                                          fontSize: '0.85rem', 
                                          width: '100%', 
                                          boxSizing: 'border-box', 
                                          outline: 'none', 
                                          transition: 'all 0.2s', 
                                          fontWeight: '600',
                                          color: '#111827'
                                        }}
                                        onFocus={e => {
                                          e.target.style.borderColor = '#800000';
                                          e.target.style.boxShadow = '0 0 0 4px rgba(128, 0, 0, 0.12)';
                                        }}
                                        onBlur={e => {
                                          e.target.style.borderColor = '#e5e7eb';
                                          e.target.style.boxShadow = 'none';
                                        }}
                                        placeholder="0.00"
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        )}
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '1.5rem', borderTop: '1px solid #f3f4f6' }}>
                          <button
                            onClick={() => {
                              if (!wofDetail?.forwarded_to) {
                                setStopStep('confirm_type');
                              } else {
                                setStopStep(stopHasSplits ? 'splits_table' : 'ask_splits');
                              }
                            }}
                            style={{
                              padding: '0.7rem 1.5rem',
                              border: '1.5px solid #d1d5db',
                              borderRadius: '10px',
                              backgroundColor: '#fff',
                              color: '#4b5563',
                              fontWeight: '600',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                          >
                            Back
                          </button>
                          <button
                            onClick={handlePermanentStop}
                            disabled={saving}
                            style={{
                              padding: '0.7rem 1.75rem',
                              border: 'none',
                              borderRadius: '10px',
                              backgroundColor: '#800000',
                              color: '#fff',
                              fontWeight: '700',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              transition: 'all 0.2s',
                              boxShadow: '0 4px 12px rgba(128, 0, 0, 0.15)',
                              opacity: saving ? 0.75 : 1
                            }}
                            onMouseEnter={e => { if (!saving) e.currentTarget.style.backgroundColor = '#600000'; }}
                            onMouseLeave={e => { if (!saving) e.currentTarget.style.backgroundColor = '#800000'; }}
                          >
                            {saving ? <Loader size={14} className="spin" /> : <StopCircle size={14} />}
                            Confirm & Stop Permanently
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
  const [selectedWof, setSelectedWof] = useState(null);

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
              {['WOF Number', 'Order Number', 'Design', 'Partner', 'Qty (m)', 'Completed Qty (m)', 'Start Date', 'End Date', 'Status'].map(h => (
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
                <tr
                  key={wof.id}
                  onClick={() => setSelectedWof(wof)}
                  style={{
                    borderBottom: '1px solid var(--border-current)',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s'
                  }}
                >
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
                    {Number(wof.original_qty || wof.qty || 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: (wof.status === 'completed' || wof.status === 'stopped') ? 'inherit' : 'var(--text-muted-current)' }}>
                    {wof.status === 'completed' || wof.status === 'stopped' ? Number(wof.qty || 0).toLocaleString() : '—'}
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

      {selectedWof && (
        <WofDetailModal
          wof={selectedWof}
          onClose={() => setSelectedWof(null)}
          onStatusChanged={(keepOpen) => {
            if (keepOpen !== true) {
              setSelectedWof(null);
            }
            fetchJobWorkWofs();
          }}
        />
      )}
    </div>
  );
}

// ─── Sizing Tab helpers ──────────────────────────────────────────────────────

function getSofStatusBadge(sof) {
  const todayStr = getLocalDateString(new Date());
  const sc = getStatusColor(sof.status);

  const isFinished = sof.status === 'completed' || (sof.status === 'stopped' && !!sof.sofdc_number);

  if (isFinished) {
    const actualEndStr = sof.process_completed_at
      ? getLocalDateString(sof.process_completed_at)
      : (getLocalDateString(sof.updated_at) || todayStr);
    if (sof.end_date && actualEndStr > sof.end_date) {
      return { label: sof.status === 'completed' ? 'Late Completed' : 'Stopped Late', bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' };
    }
    return sof.status === 'completed'
      ? { label: 'Completed', bg: '#dcfce7', border: '#22c55e', text: '#166534' }
      : { label: 'Stopped', bg: '#fff7ed', border: '#f97316', text: '#c2410c' };
  }

  if (sof.status === 'on_process') {
    if (sof.end_date && todayStr > sof.end_date) {
      return { label: 'Running Late', bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' };
    }
    return { label: 'On Process', bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' };
  }

  if (sof.status === 'created') {
    if (sof.end_date && todayStr > sof.end_date) {
      return { label: 'Late', bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' };
    }
    return { label: 'Created', bg: '#fef9c3', border: '#eab308', text: '#854d0e' };
  }

  return sc;
}

function SofDetailModal({ sof, onClose, onStatusChanged }) {
  const [loading, setLoading] = useState(true);
  const [sofDetail, setSofDetail] = useState(null);
  const [sizerName, setSizerName] = useState('');
  const [sizingWorkers, setSizingWorkers] = useState([]);
  const [processDate, setProcessDate] = useState(() => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  });
  const [saving, setSaving] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [completeDate, setCompleteDate] = useState(() => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
  });

  // Wizard states
  const [stopStep, setStopStep] = useState(null); // 'confirm_type' | 'ask_splits' | 'splits_table' | 'reallocate' | 'confirm_stop' | null
  const [stopHasSplits, setStopHasSplits] = useState(null);
  const [stopSplits, setStopSplits] = useState([]);
  const [loadingStopSplits, setLoadingStopSplits] = useState(false);
  const [reallocWhen, setReallocWhen] = useState(null); // 'now' | 'later' | null
  const [reallocQty, setReallocQty] = useState('');
  const [isReallocated, setIsReallocated] = useState(false);
  const [showReallocateModal, setShowReallocateModal] = useState(false);
  const [reallocSaving, setReallocSaving] = useState(false);
  const [reallocSplitsCount, setReallocSplitsCount] = useState(1);
  const [reallocSplits, setReallocSplits] = useState([]);
  const [stopCompletedQty, setStopCompletedQty] = useState('');

  const getRemainingQty = () => {
    if (!sofDetail) return 0;
    if (stopStep) {
      const originalQty = Number(sofDetail.original_qty || sofDetail.qty || 0);
      const completedQty = parseFloat(stopCompletedQty || 0);
      return Math.max(0, originalQty - completedQty);
    }
    const originalQty = Number(sofDetail.original_qty || sofDetail.qty || 0);
    const completedQty = sofDetail.status === 'stopped' ? Number(sofDetail.qty || 0) : 0;
    return Math.max(0, originalQty - completedQty);
  };

  // Reallocation states
  const [reallocType, setReallocType] = useState('in_house');
  const [reallocMachineId, setReallocMachineId] = useState('');
  const [reallocMachineName, setReallocMachineName] = useState('');
  const [reallocPartnerId, setReallocPartnerId] = useState('');
  const [reallocPartnerName, setReallocPartnerName] = useState('');
  const [reallocStartDate, setReallocStartDate] = useState('');
  const [reallocEndDate, setReallocEndDate] = useState('');
  const [reallocBeamName, setReallocBeamName] = useState('');

  const [sizingMachines, setSizingMachines] = useState([]);
  const [sizingPartners, setSizingPartners] = useState([]);

  useEffect(() => {
    fetchDetails();
  }, [sof.id]);

  useEffect(() => {
    if (sofDetail) {
      setReallocType(sofDetail.sizing_type || 'in_house');
      setReallocBeamName(sofDetail.beam_name || '');
      const defaultQty = sofDetail.qty > 0 
        ? (Number(sofDetail.original_qty || sofDetail.qty) - sofDetail.qty)
        : (sofDetail.original_qty || sofDetail.qty || 0);
      setReallocQty(defaultQty.toString());
      
      setReallocSplitsCount(1);
      setReallocSplits([{
        sizing_type: sofDetail.sizing_type || 'in_house',
        qty: defaultQty.toString(),
        machine_id: '',
        machine_name: '',
        partner_id: '',
        partner_name: '',
        start_date: '',
        end_date: '',
        beam_name: sofDetail.beam_name || ''
      }]);
      
      setStopCompletedQty((sofDetail.original_qty || sofDetail.qty || 0).toString());
    }
  }, [sofDetail]);

  const getBalanceQty = () => {
    const oQty = Number(sofDetail?.original_qty || sofDetail?.qty || 0);
    if (stopHasSplits && stopSplits.length > 0) {
      const completedSum = stopSplits.reduce((sum, s) => sum + (parseFloat(s.completedQty) || 0), 0);
      return Math.max(0, Math.round((oQty - completedSum) * 100) / 100);
    }
    return oQty;
  };

  const handleSplitsCountChange = (count) => {
    setReallocSplitsCount(count);
    const remaining = getRemainingQty();
    const evenQty = Math.round((remaining / count) * 100) / 100;

    setReallocSplits(prev => {
      const next = [...prev];
      if (count > next.length) {
        for (let i = next.length; i < count; i++) {
          next.push({
            sizing_type: sofDetail.sizing_type || 'in_house',
            qty: evenQty.toString(),
            machine_id: '',
            machine_name: '',
            partner_id: '',
            partner_name: '',
            start_date: '',
            end_date: '',
            beam_name: sofDetail.beam_name || ''
          });
        }
      } else if (count < next.length) {
        next.splice(count);
      }
      
      // Distribute balance evenly, last split gets remainder
      for (let i = 0; i < next.length; i++) {
        if (i === next.length - 1) {
          const otherSum = next.slice(0, i).reduce((s, x) => s + (parseFloat(x.qty) || 0), 0);
          next[i] = { ...next[i], qty: Math.max(0, Math.round((balanceQty - otherSum) * 100) / 100).toString() };
        } else {
          next[i] = { ...next[i], qty: evenQty.toString() };
        }
      }
      return next;
    });
  };

  const updateReallocSplit = (index, field, value) => {
    setReallocSplits(prev => prev.map((item, idx) => {
      if (idx === index) {
        const updated = { ...item, [field]: value };
        if (field === 'sizing_type') {
          updated.machine_id = '';
          updated.machine_name = '';
          updated.partner_id = '';
          updated.partner_name = '';
        } else if (field === 'partner_id') {
          const partner = sizingPartners.find(p => p.id === value || p.id.toString() === value);
          updated.partner_name = partner ? partner.partner_name : '';
          updated.machine_id = '';
          updated.machine_name = '';
        } else if (field === 'machine_id') {
          const machine = sizingMachines.find(m => m.id === value || m.id.toString() === value);
          updated.machine_name = machine ? machine.machine_name : '';
        }
        return updated;
      }
      return item;
    }));
  };

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sizing_order_forms')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name, total_quantity),
          machine:master_machines!sizing_order_forms_machine_id_fkey(machine_name),
          partner:master_partners!sizing_order_forms_partner_id_fkey(partner_name),
          wof:warping_order_forms(id, wof_number, warp_splits_count, warp_splits)
        `)
        .eq('id', sof.id)
        .single();
      if (error) throw error;
      setSofDetail(data);

      // Check if reallocated
      const warpNoToLook = data.warp_no || data.sof_number;
      if (warpNoToLook && data.wof_id) {
        const { data: siblings, error: sibErr } = await supabase
          .from('sizing_order_forms')
          .select('id')
          .eq('wof_id', data.wof_id)
          .ilike('warp_no', `${warpNoToLook}/R%`);
        if (!sibErr) {
          setIsReallocated(siblings && siblings.length > 0);
        }
      }

      // Fetch sizing workers
      try {
        const { data: deptData } = await supabase
          .from('master_departments')
          .select('id')
          .ilike('department_name', '%sizing%');
          
        const sizingDeptIds = (deptData || []).map(d => d.id);
        
        if (sizingDeptIds.length > 0) {
          const { data: workersData } = await supabase
            .from('master_workers')
            .select('*')
            .in('department_id', sizingDeptIds)
            .order('worker_name', { ascending: true });
          setSizingWorkers(workersData || []);
        }
      } catch (err) {
        console.error('Error fetching sizing workers:', err);
      }

      // Fetch sizing machines and partners for reallocation
      try {
        // Get sizing department IDs for machine filtering
        const { data: sizingDeptData } = await supabase
          .from('master_departments')
          .select('id')
          .ilike('department_name', '%sizing%');
        const sizingMachineDeptIds = (sizingDeptData || []).map(d => d.id);

        // Fetch sizing machines filtered by department
        let machineData = [];
        if (sizingMachineDeptIds.length > 0) {
          const { data } = await supabase
            .from('master_machines')
            .select('*, master_departments(department_name)')
            .in('department_id', sizingMachineDeptIds);
          machineData = data || [];
        }
        // Fallback: if no sizing dept machines found, fetch all
        if (machineData.length === 0) {
          const { data } = await supabase
            .from('master_machines')
            .select('*, master_departments(department_name)');
          machineData = data || [];
        }
        setSizingMachines(machineData);

        // Fetch only sizing partners
        const { data: partnerData } = await supabase
          .from('master_partners')
          .select('*')
          .ilike('partner_type', '%sizing%');
        setSizingPartners(partnerData || []);
      } catch (err) {
        console.error('Error fetching sizing machines/partners:', err);
      }
    } catch (err) {
      console.error('Error fetching SOF details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartProcess = async () => {
    if (!sizerName.trim()) {
      alert('Please enter the Sizer Name');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('sizing_order_forms')
        .update({
          status: 'on_process',
          sizer_name: sizerName.trim(),
          process_started_at: new Date(processDate).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sof.id);

      if (error) throw error;
      await fetchDetails();
      onStatusChanged();
    } catch (err) {
      console.error('Error starting sizing process:', err);
      alert('Failed to start process: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteProcess = async () => {
    if (!completeDate) {
      alert('Please enter the completion date and time');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('sizing_order_forms')
        .update({
          status: 'completed',
          process_completed_at: new Date(completeDate).toISOString(),
          sofdc_number: sof.sof_number.replace('/SOF/', '/SOFDC/') + '/1',
          updated_at: new Date().toISOString()
        })
        .eq('id', sof.id);

      if (error) throw error;
      await fetchDetails();
      onStatusChanged();
      setShowCompleteForm(false);
    } catch (err) {
      console.error('Error completing sizing process:', err);
      alert('Failed to complete process: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadStopSplits = async () => {
    setLoadingStopSplits(true);
    try {
      const { data, error } = await supabase
        .from('weaving_orders')
        .select('*')
        .eq('sof_id', sofDetail.id)
        .order('weaving_number', { ascending: true });
      if (error) throw error;
      setStopSplits((data || []).map((item) => ({
        ...item,
        completedQty: item.qty ? item.qty.toString() : '0'
      })));
    } catch (err) {
      console.error('Error fetching sibling splits:', err);
      alert('Error fetching splits: ' + err.message);
    } finally {
      setLoadingStopSplits(false);
    }
  };

  const handleSelectSplitsYes = async () => {
    setStopHasSplits(true);
    setStopStep('splits_table');
    setStopCompletedQty((sofDetail.original_qty || sofDetail.qty || 0).toString());
    await loadStopSplits();
  };

  const handleTemporaryStop = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('sizing_order_forms')
        .update({
          status: 'stopped',
          updated_at: new Date().toISOString()
        })
        .eq('id', sof.id);

      if (error) throw error;
      setStopStep(null);
      await fetchDetails();
      onStatusChanged();
    } catch (err) {
      console.error('Error pausing sizing process:', err);
      alert('Failed to pause process: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmStop = async () => {
    setSaving(true);
    try {
      const originalQty = Number(sofDetail.original_qty || sofDetail.qty);
      const completedSum = parseFloat(stopCompletedQty || 0);
      
      const sofdcNumber = sofDetail.sof_number.replace('/SOF/', '/SOFDC/') + '/1';

      // 1. Fetch parent WOF to sync splits
      let updatedSplits = [];
      let parentWof = null;
      if (sofDetail.wof_id) {
        const { data, error: wofFetchError } = await supabase
          .from('warping_order_forms')
          .select('*')
          .eq('id', sofDetail.wof_id)
          .single();
        
        if (wofFetchError) throw wofFetchError;
        parentWof = data;
      }

      if (parentWof) {
        const parentSplits = parentWof.warp_splits || [];
        updatedSplits = parentSplits.map(split => {
          if (split.warp_no === sofDetail.warp_no || (sofDetail.warp_no && split.warp_no === sofDetail.warp_no)) {
            return {
              ...split,
              qty: completedSum
            };
          }
          return split;
        });
      }

      // 2. Generate new SOFs if there is remaining quantity & reallocWhen is now
      const year = new Date().getFullYear();
      if (reallocWhen === 'now' && reallocSplits.length > 0) {
        let baseInHouseSeq = null;
        const baseJobWorkSeqs = {};

        for (let idx = 0; idx < reallocSplits.length; idx++) {
          const split = reallocSplits[idx];
          const splitQty = parseFloat(split.qty);

          let newSofNumber = '';
          if (split.sizing_type === 'in_house') {
            if (baseInHouseSeq === null) {
              const { count } = await supabase
                .from('sizing_order_forms')
                .select('id', { count: 'exact', head: true })
                .eq('sizing_type', 'in_house')
                .gte('created_at', `${year}-01-01`)
                .lt('created_at', `${year + 1}-01-01`);
              baseInHouseSeq = count || 0;
            }
            baseInHouseSeq++;
            const seqStr = String(baseInHouseSeq).padStart(5, '0');
            newSofNumber = `AT/${year}/SOF/${seqStr}`;
          } else {
            const pId = split.partner_id;
            const slug = (split.partner_name || 'PARTNER').replace(/\s+/g, '').toUpperCase();
            const prefix = `AT/${year}/SOF/JB/${slug}/`;
            if (baseJobWorkSeqs[pId] === undefined) {
              const { count } = await supabase
                .from('sizing_order_forms')
                .select('id', { count: 'exact', head: true })
                .eq('sizing_type', 'job_work')
                .eq('partner_id', pId)
                .ilike('sof_number', `${prefix}%`);
              baseJobWorkSeqs[pId] = count || 0;
            }
            baseJobWorkSeqs[pId]++;
            const seqStr = String(baseJobWorkSeqs[pId]).padStart(5, '0');
            newSofNumber = `AT/${year}/SOF/JB/${slug}/${seqStr}`;
          }

          const baseWarpNo = sofDetail.warp_no || sofDetail.sof_number;
          const newWarpNo = reallocSplits.length > 1
            ? `${baseWarpNo}/R/${idx + 1}`
            : `${baseWarpNo}/R`;

          const newSofPayload = {
            sof_number: newSofNumber,
            wof_id: sofDetail.wof_id,
            order_id: sofDetail.order_id,
            sizing_type: split.sizing_type,
            qty: splitQty,
            original_qty: splitQty,
            start_date: split.start_date,
            end_date: split.end_date,
            status: 'created',
            machine_id: split.machine_id || null,
            machine_name: split.machine_name || null,
            partner_id: split.partner_id || null,
            partner_name: split.partner_name || null,
            beam_name: split.beam_name || null,
            warp_no: newWarpNo,
            created_by: sofDetail.created_by
          };

          const { error: newSofErr } = await supabase
            .from('sizing_order_forms')
            .insert(newSofPayload);

          if (newSofErr) throw newSofErr;

          updatedSplits.push({
            warp_no: newWarpNo,
            qty: splitQty,
            start_date: split.start_date,
            end_date: split.end_date,
            sizing_type: split.sizing_type,
            partner_id: split.partner_id || null,
            partner_name: split.partner_name || null,
            machine_id: split.machine_id || null,
            machine_name: split.machine_name || null,
            beam_name: split.beam_name || null
          });
        }
      }

      // Update parent WOF splits array if parent WOF exists
      if (parentWof) {
        const { error: parentWofUpdateErr } = await supabase
          .from('warping_order_forms')
          .update({
            warp_splits: updatedSplits,
            warp_splits_count: updatedSplits.length,
            updated_at: new Date().toISOString()
          })
          .eq('id', parentWof.id);

        if (parentWofUpdateErr) throw parentWofUpdateErr;
      }

      // 4. Update weaving orders if splits exist
      let updatedWeavingSplits = [];
      if (stopHasSplits && stopSplits.length > 0) {
        for (const split of stopSplits) {
          const splitCompletedQty = parseFloat(split.completedQty || 0);
          if (splitCompletedQty <= 0) {
            const { error: delErr } = await supabase
              .from('weaving_orders')
              .delete()
              .eq('id', split.id);
            if (delErr) throw delErr;
          } else {
            const { error: updErr } = await supabase
              .from('weaving_orders')
              .update({
                qty: splitCompletedQty,
                original_qty: splitCompletedQty,
                updated_at: new Date().toISOString()
              })
              .eq('id', split.id);
            if (updErr) throw updErr;

            updatedWeavingSplits.push({
              split_no: split.weaving_number || split.split_no,
              qty: splitCompletedQty,
              start_date: split.start_date || '',
              end_date: split.end_date || '',
              weaving_type: split.weaving_type || null,
              partner_id: split.partner_id || null,
              partner_name: split.partner_name || null,
              machine_id: split.machine_id || null,
              machine_name: split.machine_name || null,
              beam_name: split.beam_name || split.beam_number || ''
            });
          }
        }
      } else {
        // If the user says there are no completed weaving splits (or there's only 1 weaving order),
        // we update or delete it based on the Sizing completed sum.
        let wvs = [];
        const { data: dataById, error: fetchWvErr } = await supabase
          .from('weaving_orders')
          .select('*')
          .eq('sof_id', sofDetail.id);
        
        if (fetchWvErr) throw fetchWvErr;
        wvs = dataById || [];

        if (wvs.length === 0 && sofDetail.sof_number) {
          const { data: dataByNum, error: fetchWvErrNum } = await supabase
            .from('weaving_orders')
            .select('*')
            .eq('sof_number', sofDetail.sof_number);
          
          if (fetchWvErrNum) throw fetchWvErrNum;
          wvs = dataByNum || [];
        }

        if (wvs && wvs.length > 0) {
          if (completedSum <= 0) {
            const { error: delErr } = await supabase
              .from('weaving_orders')
              .delete()
              .eq('sof_id', sofDetail.id);
            if (delErr) throw delErr;

            if (sofDetail.sof_number) {
              const { error: delErrNum } = await supabase
                .from('weaving_orders')
                .delete()
                .eq('sof_number', sofDetail.sof_number);
              if (delErrNum) throw delErrNum;
            }
          } else {
            // Update the first one to completedSum, delete the rest if any
            const { error: updErr } = await supabase
              .from('weaving_orders')
              .update({
                qty: completedSum,
                original_qty: completedSum,
                updated_at: new Date().toISOString()
              })
              .eq('id', wvs[0].id);
            if (updErr) throw updErr;

            if (wvs.length > 1) {
              const otherIds = wvs.slice(1).map(w => w.id);
              const { error: delErr } = await supabase
                .from('weaving_orders')
                .delete()
                .in('id', otherIds);
              if (delErr) throw delErr;
            }

            updatedWeavingSplits.push({
              split_no: wvs[0].weaving_number || wvs[0].split_no,
              qty: completedSum,
              start_date: wvs[0].start_date || '',
              end_date: wvs[0].end_date || '',
              weaving_type: wvs[0].weaving_type || null,
              partner_id: wvs[0].partner_id || null,
              partner_name: wvs[0].partner_name || null,
              machine_id: wvs[0].machine_id || null,
              machine_name: wvs[0].machine_name || null,
              beam_name: wvs[0].beam_name || wvs[0].beam_number || ''
            });
          }
        }
      }

      // 5. Update current SOF
      const sofUpdates = {
        status: 'stopped',
        qty: completedSum,
        original_qty: originalQty,
        process_completed_at: new Date().toISOString(),
        sofdc_number: sofdcNumber,
        weaving_splits: updatedWeavingSplits,
        weaving_splits_count: updatedWeavingSplits.length,
        forwarded_to: updatedWeavingSplits.length > 0 ? 'weaving' : null,
        updated_at: new Date().toISOString()
      };

      const { error: sofUpdateErr } = await supabase
        .from('sizing_order_forms')
        .update(sofUpdates)
        .eq('id', sofDetail.id);

      if (sofUpdateErr) throw sofUpdateErr;

      setStopStep(null);
      await fetchDetails();
      onStatusChanged();
    } catch (err) {
      console.error('Error stopping sizing process:', err);
      alert('Failed to stop sizing process: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResumeProcess = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('sizing_order_forms')
        .update({
          status: 'on_process',
          updated_at: new Date().toISOString()
        })
        .eq('id', sofDetail.id);

      if (error) throw error;
      await fetchDetails();
      onStatusChanged();
    } catch (err) {
      console.error('Error resuming process:', err);
      alert('Failed to resume process: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePostStopReallocate = async () => {
    const parentRemainingQty = getRemainingQty();

    let totalSplitQty = 0;
    for (let idx = 0; idx < reallocSplits.length; idx++) {
      const split = reallocSplits[idx];
      const prefix = reallocSplits.length > 1 ? `Split #${idx + 1}: ` : '';
      
      if (split.sizing_type === 'in_house') {
        if (!split.machine_id) {
          alert(`${prefix}Please select a sizing machine/loom.`);
          return;
        }
      } else {
        if (!split.partner_id) {
          alert(`${prefix}Please select a sizing partner.`);
          return;
        }
        if (!split.machine_id) {
          alert(`${prefix}Please select a sizing machine.`);
          return;
        }
      }
      if (!split.start_date || !split.end_date) {
        alert(`${prefix}Please enter planned start and end dates.`);
        return;
      }
      const qVal = parseFloat(split.qty);
      if (isNaN(qVal) || qVal <= 0) {
        alert(`${prefix}Please enter a valid positive quantity.`);
        return;
      }
      totalSplitQty += qVal;
    }

    if (totalSplitQty > parentRemainingQty) {
      alert(`Total reallocated quantity (${totalSplitQty} m) cannot exceed the parent Sizing Order Form's remaining quantity (${parentRemainingQty} m).`);
      return;
    }

    setReallocSaving(true);
    try {
      const year = new Date().getFullYear();
      let baseInHouseSeq = null;
      const baseJobWorkSeqs = {};
      const updatedSplits = [];

      // Fetch parent WOF first if it exists
      let parentWof = null;
      if (sofDetail.wof_id) {
        const { data, error: wofFetchError } = await supabase
          .from('warping_order_forms')
          .select('*')
          .eq('id', sofDetail.wof_id)
          .single();
        if (!wofFetchError) {
          parentWof = data;
        }
      }

      for (let idx = 0; idx < reallocSplits.length; idx++) {
        const split = reallocSplits[idx];
        const splitQty = parseFloat(split.qty);

        let newSofNumber = '';
        if (split.sizing_type === 'in_house') {
          if (baseInHouseSeq === null) {
            const { count } = await supabase
              .from('sizing_order_forms')
              .select('id', { count: 'exact', head: true })
              .eq('sizing_type', 'in_house')
              .gte('created_at', `${year}-01-01`)
              .lt('created_at', `${year + 1}-01-01`);
            baseInHouseSeq = count || 0;
          }
          baseInHouseSeq++;
          const seqStr = String(baseInHouseSeq).padStart(5, '0');
          newSofNumber = `AT/${year}/SOF/${seqStr}`;
        } else {
          const pId = split.partner_id;
          const slug = (split.partner_name || 'PARTNER').replace(/\s+/g, '').toUpperCase();
          const prefix = `AT/${year}/SOF/JB/${slug}/`;
          if (baseJobWorkSeqs[pId] === undefined) {
            const { count } = await supabase
              .from('sizing_order_forms')
              .select('id', { count: 'exact', head: true })
              .eq('sizing_type', 'job_work')
              .eq('partner_id', pId)
              .ilike('sof_number', `${prefix}%`);
            baseJobWorkSeqs[pId] = count || 0;
          }
          baseJobWorkSeqs[pId]++;
          const seqStr = String(baseJobWorkSeqs[pId]).padStart(5, '0');
          newSofNumber = `AT/${year}/SOF/JB/${slug}/${seqStr}`;
        }

        const baseWarpNo = sofDetail.warp_no || sofDetail.sof_number;
        const newWarpNo = reallocSplits.length > 1
          ? `${baseWarpNo}/R/${idx + 1}`
          : `${baseWarpNo}/R`;

        const newSofPayload = {
          sof_number: newSofNumber,
          wof_id: sofDetail.wof_id,
          order_id: sofDetail.order_id,
          sizing_type: split.sizing_type,
          qty: splitQty,
          original_qty: splitQty,
          start_date: split.start_date,
          end_date: split.end_date,
          status: 'created',
          machine_id: split.machine_id || null,
          machine_name: split.machine_name || null,
          partner_id: split.partner_id || null,
          partner_name: split.partner_name || null,
          beam_name: split.beam_name || null,
          warp_no: newWarpNo,
          created_by: sofDetail.created_by
        };

        const { error: newSofErr } = await supabase
          .from('sizing_order_forms')
          .insert(newSofPayload);

        if (newSofErr) throw newSofErr;

        updatedSplits.push({
          warp_no: newWarpNo,
          qty: splitQty,
          start_date: split.start_date,
          end_date: split.end_date,
          sizing_type: split.sizing_type,
          partner_id: split.partner_id || null,
          partner_name: split.partner_name || null,
          machine_id: split.machine_id || null,
          machine_name: split.machine_name || null,
          beam_name: split.beam_name || null
        });
      }

      // Update parent WOF splits array if parent WOF exists
      if (parentWof) {
        const parentSplits = parentWof.warp_splits || [];
        const mergedSplits = [...parentSplits, ...updatedSplits];

        const { error: parentWofUpdateErr } = await supabase
          .from('warping_order_forms')
          .update({
            warp_splits: mergedSplits,
            warp_splits_count: mergedSplits.length,
            updated_at: new Date().toISOString()
          })
          .eq('id', parentWof.id);

        if (parentWofUpdateErr) throw parentWofUpdateErr;
      }

      setShowReallocateModal(false);
      await fetchDetails();
      onStatusChanged();
      alert('Sizing Order Form reallocated successfully!');
    } catch (err) {
      console.error('Error reallocating stopped SOF:', err);
      alert('Failed to reallocate: ' + err.message);
    } finally {
      setReallocSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(15,23,42,0.3)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '600' }}>
          <Loader className="spin" size={18} /> Loading details...
        </div>
      </div>
    );
  }

  if (!sofDetail) return null;

  const sc = getSofStatusBadge(sofDetail);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      backgroundColor: 'rgba(15,23,42,0.3)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '860px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        border: '1px solid var(--border-current)',
        padding: '1.5rem'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#800000', margin: 0, fontFamily: 'monospace' }}>
              {sofDetail.sof_number} {sofDetail.beam_name ? `(Beam: ${sofDetail.beam_name})` : ''}
            </h2>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', marginTop: '2px', fontWeight: '600' }}>
              Sizing Order Form Details
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted-current)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <InfoField label="Status" value={
            <span style={{
              backgroundColor: sc.bg, color: sc.text,
              border: `1px solid ${sc.border}`,
              padding: '2px 8px', borderRadius: '12px',
              fontSize: '0.68rem', fontWeight: '800'
            }}>
              {sc.label}
            </span>
          } />
          <InfoField label="Sizing Type" value={sofDetail.sizing_type === 'in_house' ? 'In-House' : 'Job Work'} />
          <InfoField label="Warping Reference (WOF)" value={<span style={{ fontFamily: 'monospace', fontWeight: '700' }}>{sofDetail.wof?.wof_number || '—'}</span>} />
          <InfoField label="Order Number" value={<span style={{ fontFamily: 'monospace', fontWeight: '700' }}>{sofDetail.order?.order_number || '—'}</span>} />
          <InfoField label="Design Number" value={sofDetail.order?.design_no || '—'} />
          <InfoField label="Design Name" value={sofDetail.order?.design_name || '—'} />
          <InfoField label="Quantity (Mtrs)" value={Number(sofDetail.qty).toLocaleString()} highlight />
          <InfoField label="Timeline" value={`${sofDetail.start_date || '—'} to ${sofDetail.end_date || '—'}`} />
          {sofDetail.sizing_type === 'in_house' ? (
            <InfoField label="Machine" value={sofDetail.machine_name || '—'} />
          ) : (
            <InfoField label="Partner" value={sofDetail.partner_name || '—'} />
          )}
          <InfoField label="Beam Number" value={<span style={{ fontWeight: '700' }}>{sofDetail.beam_name || '—'}</span>} />
        </div>

        {/* Weaving Forwarding Section */}
        {sofDetail.forwarded_to === 'weaving' && (
          <div style={{
            borderTop: '1px solid var(--border-current)',
            paddingTop: '1.25rem',
            marginTop: '1rem',
            marginBottom: '1.25rem'
          }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: '800', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>→</span> Forwarded to Weaving
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
              <InfoField label="Weaving Type" value={sofDetail.weaving_type === 'in_house' ? 'In-House Weaving' : 'Job Work Weaving'} />
              <InfoField
                label={sofDetail.weaving_type === 'in_house' ? 'Weaving Loom' : 'Weaving Partner'}
                value={sofDetail.weaving_type === 'in_house' ? (sofDetail.weaving_machine_name || '—') : (sofDetail.weaving_partner_name || '—')}
              />
            </div>

            {sofDetail.weaving_splits && sofDetail.weaving_splits.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                  Weaving Splits ({sofDetail.weaving_splits_count})
                </label>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', textAlign: 'left', border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-current)' }}>
                      <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Split Number</th>
                      <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Qty (Mtrs)</th>
                      <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Schedule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sofDetail.weaving_splits.map((ws, idx) => (
                      <tr key={idx} style={{ borderBottom: idx !== sofDetail.weaving_splits.length - 1 ? '1px solid var(--border-current)' : 'none' }}>
                        <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontWeight: '700' }}>{ws.split_no}</td>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>{Number(ws.qty).toLocaleString()} m</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted-current)' }}>
                          {ws.start_date ? new Date(ws.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'} to{' '}
                          {ws.end_date ? new Date(ws.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Start Process Actions Section ── */}
        {sofDetail.status === 'created' && (
          <div style={{
            borderTop: '1px solid var(--border-current)',
            paddingTop: '1.25rem',
            marginTop: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              padding: '1.25rem',
              backgroundColor: '#fafafa',
              borderRadius: '12px',
              border: '1px solid var(--border-current)'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', fontWeight: '800', color: '#800000', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Play size={16} />
                Start Sizing Process
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                {/* Sizer Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                    Sizer Name *
                  </label>
                  <select
                    value={sizerName}
                    onChange={e => setSizerName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      border: '1.5px solid var(--border-current)',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      outline: 'none',
                      boxSizing: 'border-box',
                      backgroundColor: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Select sizer...</option>
                    {sizingWorkers.map(w => (
                      <option key={w.id} value={w.worker_name}>{w.worker_name}</option>
                    ))}
                  </select>
                </div>

                {/* Start Date and Time */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                    Actual Start Date & Time *
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
                  onClick={onClose}
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
                  {saving ? 'Starting...' : 'Confirm & Start'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Show sizer info if already on process or completed */}
        {(sofDetail.status === 'on_process' || sofDetail.status === 'completed') && sofDetail.sizer_name && (
          <div style={{
            borderTop: '1px solid var(--border-current)',
            paddingTop: '1rem',
            display: 'flex', alignItems: 'center', gap: '1rem',
            fontSize: '0.82rem', color: 'var(--text-current)',
            flexWrap: 'wrap',
            marginTop: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              padding: '0.5rem 1rem',
              backgroundColor: sofDetail.status === 'completed' ? '#dcfce7' : '#dbeafe',
              border: sofDetail.status === 'completed' ? '1px solid #86efac' : '1px solid #93c5fd',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}>
              {sofDetail.status === 'completed' ? <CheckCircle size={14} color="#166534" /> : <Play size={14} color="#1d4ed8" />}
              <span style={{ fontWeight: '700', color: sofDetail.status === 'completed' ? '#166534' : '#1d4ed8' }}>
                {sofDetail.status === 'completed' ? 'Sizing Completed' : 'Sizing Started'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Sizer:</span>{' '}
              <strong>{sofDetail.sizer_name}</strong>
            </div>
            {sofDetail.process_started_at && (
              <div>
                <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Started:</span>{' '}
                <strong>{new Date(sofDetail.process_started_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
              </div>
            )}
            {sofDetail.process_completed_at && (
              <div>
                <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Completed:</span>{' '}
                <strong>{new Date(sofDetail.process_completed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
              </div>
            )}
          </div>
        )}

        {/* Sizing process is on_process - show Complete / Stop actions */}
        {sofDetail.status === 'on_process' && (
          <div style={{
            borderTop: '1px solid var(--border-current)',
            paddingTop: '1.25rem',
            marginTop: '1rem',
            marginBottom: '1rem'
          }}>
            {!showCompleteForm && !stopStep ? (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowCompleteForm(true)}
                  style={{
                    flex: 1,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    padding: '0.65rem 1.25rem',
                    backgroundColor: '#166534',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: '0 4px 10px rgba(22,101,52,0.15)'
                  }}
                >
                  <CheckCircle size={15} />
                  Complete Process
                </button>
                <button
                  onClick={() => setStopStep('confirm_type')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    padding: '0.65rem 1.25rem',
                    backgroundColor: '#fff',
                    color: '#c2410c',
                    border: '1.5px solid #fdba74',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <AlertTriangle size={15} />
                  Stop Process
                </button>
              </div>
            ) : showCompleteForm ? (
              <div style={{
                padding: '1.25rem',
                backgroundColor: '#f6fdf9',
                borderRadius: '12px',
                border: '1px solid #bbf7d0'
              }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', fontWeight: '800', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle size={16} />
                  Complete Sizing Process
                </h3>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                    Actual Completion Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={completeDate}
                    onChange={e => setCompleteDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      border: '1.5px solid #bbf7d0',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowCompleteForm(false)}
                    disabled={saving}
                    style={{
                      padding: '0.6rem 1.25rem',
                      border: '1.5px solid #bbf7d0',
                      borderRadius: '8px',
                      backgroundColor: '#fff',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: '600',
                      color: '#166534'
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
                      backgroundColor: '#166534',
                      color: '#fff',
                      cursor: saving ? 'wait' : 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: '700',
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      boxShadow: '0 3px 10px rgba(22,101,52,0.2)',
                      opacity: saving ? 0.7 : 1
                    }}
                  >
                    {saving ? <Loader size={14} className="spin" /> : <CheckCircle size={14} />}
                    {saving ? 'Completing...' : 'Confirm & Complete'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '1.25rem',
                backgroundColor: '#fff7ed',
                borderRadius: '12px',
                border: '1px solid #fed7aa',
                color: 'var(--text-current)'
              }}>
                {/* STEP 1: Pause vs Stop Permanently */}
                {stopStep === 'confirm_type' && (
                  <div>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', fontWeight: '800', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={16} /> Stop Sizing Process
                    </h3>
                    <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem', color: '#9a3412', fontWeight: '500', lineHeight: '1.5' }}>
                      Do you want to <strong>Pause</strong> the process temporarily (so you can resume it later) or <strong>Stop Permanently</strong>?
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setStopStep(null)}
                        style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleTemporaryStop}
                        disabled={saving}
                        style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', backgroundColor: '#1d4ed8', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700' }}
                      >
                        Pause Process (Temporary)
                      </button>
                      <button
                        onClick={() => setStopStep('ask_splits')}
                        style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', backgroundColor: '#ea580c', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700' }}
                      >
                        Stop Permanently
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: Ask splits */}
                {stopStep === 'ask_splits' && (
                  <div>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', fontWeight: '800', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={16} /> Stop Permanently: Weaving Splits
                    </h3>
                    <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem', color: '#9a3412', fontWeight: '500', lineHeight: '1.5' }}>
                      Are there any weaving splits configured/completed for this Sizing Order Form?
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setStopStep('confirm_type')}
                        style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          setStopHasSplits(false);
                          setStopStep('confirm_qty_no_splits');
                          setStopCompletedQty('0');
                        }}
                        style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', backgroundColor: '#ea580c', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700' }}
                      >
                        No, No Splits
                      </button>
                      <button
                        onClick={handleSelectSplitsYes}
                        style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', backgroundColor: '#10b981', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700' }}
                      >
                        Yes, Splits Configured
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2.2: Confirm quantity for no splits (New) */}
                {stopStep === 'confirm_qty_no_splits' && (
                  <div>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', fontWeight: '800', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={16} /> Stop Permanently: Confirm Completed Quantity
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                          Total SOF Quantity
                        </label>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700', padding: '0.5rem 0' }}>
                          {Number(sofDetail.original_qty || sofDetail.qty).toLocaleString()} m
                        </div>
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                          Remaining Quantity (to Reallocate)
                        </label>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ea580c', padding: '0.5rem 0' }}>
                          {Number(getRemainingQty()).toLocaleString()} m
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                        Completed Quantity (Mtrs) *
                      </label>
                      <input
                        type="number"
                        value={stopCompletedQty}
                        onChange={e => setStopCompletedQty(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '0.85rem', fontWeight: '700', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setStopStep('ask_splits')}
                        style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          const originalQty = Number(sofDetail.original_qty || sofDetail.qty);
                          const completedQty = parseFloat(stopCompletedQty || 0);
                          if (isNaN(completedQty) || completedQty < 0 || completedQty > originalQty) {
                            alert(`Please enter a valid completed quantity between 0 and ${originalQty} m.`);
                            return;
                          }
                          const remainingQty = originalQty - completedQty;
                          if (remainingQty > 0) {
                            setReallocQty(remainingQty.toString());
                            setReallocSplitsCount(1);
                            setReallocSplits([{
                              sizing_type: sofDetail.sizing_type || 'in_house',
                              qty: remainingQty.toString(),
                              machine_id: '',
                              machine_name: '',
                              partner_id: '',
                              partner_name: '',
                              start_date: '',
                              end_date: '',
                              beam_name: sofDetail.beam_name || ''
                            }]);
                            setStopStep('ask_realloc_now_later');
                          } else {
                            setReallocWhen(null);
                            setStopStep('confirm_stop');
                          }
                        }}
                        style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', backgroundColor: '#ea580c', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700' }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2.5: Ask reallocate now or later */}
                {stopStep === 'ask_realloc_now_later' && (
                  <div>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', fontWeight: '800', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={16} /> Reallocate Sizing Order Form
                    </h3>
                    <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem', color: '#9a3412', fontWeight: '500', lineHeight: '1.5' }}>
                      Do you want to reallocate this Sizing Order Form <strong>Now</strong> or <strong>Later</strong>?
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => {
                          if (stopHasSplits) {
                            setStopStep('splits_table');
                          } else {
                            setStopStep('confirm_qty_no_splits');
                          }
                        }}
                        style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          setReallocWhen('later');
                          setStopStep('confirm_stop');
                        }}
                        style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', backgroundColor: '#ea580c', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700' }}
                      >
                        Reallocate Later
                      </button>
                      <button
                        onClick={() => {
                          setReallocWhen('now');
                          const balanceQty = getBalanceQty();
                          setReallocQty(balanceQty.toString());
                          setReallocSplitsCount(1);
                          setReallocSplits([{
                            sizing_type: sofDetail.sizing_type || 'in_house',
                            qty: balanceQty.toString(),
                            machine_id: '',
                            machine_name: '',
                            partner_id: '',
                            partner_name: '',
                            start_date: '',
                            end_date: '',
                            beam_name: sofDetail.beam_name || ''
                          }]);
                          setStopStep('reallocate');
                        }}
                        style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', backgroundColor: '#10b981', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700' }}
                      >
                        Reallocate Now
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Splits table */}
                {stopStep === 'splits_table' && (
                  <div>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', fontWeight: '800', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={16} /> Enter Completed Quantities for Splits
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                          Total SOF Quantity
                        </label>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700', padding: '0.5rem 0' }}>
                          {Number(sofDetail.original_qty || sofDetail.qty).toLocaleString()} m
                        </div>
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                          Remaining Quantity (to Reallocate)
                        </label>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ea580c', padding: '0.5rem 0' }}>
                          {Number(getRemainingQty()).toLocaleString()} m
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                        Total Completed Quantity (Mtrs) *
                      </label>
                      <input
                        type="number"
                        value={stopCompletedQty}
                        onChange={e => setStopCompletedQty(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '0.85rem', fontWeight: '700', boxSizing: 'border-box' }}
                      />
                    </div>

                    {loadingStopSplits ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 0' }}>
                        <Loader className="spin" size={16} /> Loading configured splits...
                      </div>
                    ) : stopSplits.length === 0 ? (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <p style={{ fontSize: '0.82rem', color: '#9a3412', fontStyle: 'italic' }}>
                           No weaving splits configured for this Sizing Order Form.
                        </p>
                      </div>
                    ) : (
                      <div style={{ marginBottom: '1.25rem', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #fed7aa', color: '#9a3412', fontWeight: '700' }}>
                              <th style={{ padding: '0.4rem' }}>Split Number (WVOF)</th>
                              <th style={{ padding: '0.4rem' }}>Type</th>
                              <th style={{ padding: '0.4rem' }}>Partner / Loom</th>
                              <th style={{ padding: '0.4rem' }}>Planned Qty</th>
                              <th style={{ padding: '0.4rem' }}>Completed Qty *</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stopSplits.map((split, sIdx) => (
                              <tr key={split.id || sIdx} style={{ borderBottom: '1px solid #fed7aa' }}>
                                <td style={{ padding: '0.4rem', fontFamily: 'monospace', fontWeight: '700' }}>{split.weaving_number}</td>
                                <td style={{ padding: '0.4rem' }}>{split.weaving_type === 'in_house' ? 'In House' : 'Job Work'}</td>
                                <td style={{ padding: '0.4rem' }}>{split.partner_name || split.machine_name || '—'}</td>
                                <td style={{ padding: '0.4rem', fontWeight: '600' }}>{split.qty} m</td>
                                <td style={{ padding: '0.4rem' }}>
                                  <input
                                    type="number"
                                    value={split.completedQty}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setStopSplits(prev => prev.map((s, idx) => idx === sIdx ? { ...s, completedQty: val } : s));
                                    }}
                                    style={{
                                      width: '80px',
                                      padding: '2px 6px',
                                      border: '1px solid #fed7aa',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      fontWeight: '700'
                                    }}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setStopStep('ask_splits')}
                        style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          const originalQty = Number(sofDetail.original_qty || sofDetail.qty);
                          const totalCompleted = parseFloat(stopCompletedQty || 0);
                          if (isNaN(totalCompleted) || totalCompleted < 0 || totalCompleted > originalQty) {
                            alert(`Please enter a valid completed quantity between 0 and ${originalQty} m.`);
                            return;
                          }

                          let sum = 0;
                          for (const split of stopSplits) {
                            const completedQty = parseFloat(split.completedQty || 0);
                            if (isNaN(completedQty) || completedQty < 0) {
                              alert('Please enter a valid non-negative completed quantity for all splits.');
                              return;
                            }
                            sum += completedQty;
                          }

                          if (Math.abs(sum - totalCompleted) > 0.1) {
                            alert(`The sum of completed quantities for splits (${sum} m) must exactly match the entered Total Completed Quantity (${totalCompleted} m).`);
                            return;
                          }

                          const remainingQty = originalQty - totalCompleted;
                          if (remainingQty > 0) {
                            setReallocQty(remainingQty.toString());
                            setReallocSplitsCount(1);
                            setReallocSplits([{
                              sizing_type: sofDetail.sizing_type || 'in_house',
                              qty: remainingQty.toString(),
                              machine_id: '',
                              machine_name: '',
                              partner_id: '',
                              partner_name: '',
                              start_date: '',
                              end_date: '',
                              beam_name: sofDetail.beam_name || ''
                            }]);
                            setStopStep('ask_realloc_now_later');
                          } else {
                            setReallocWhen(null);
                            setStopStep('confirm_stop');
                          }
                        }}
                        style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', backgroundColor: '#ea580c', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700' }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: Reallocate Remaining Qty */}
                {stopStep === 'reallocate' && (
                  <div>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', fontWeight: '800', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={16} /> Reallocate Sizing Order Form
                    </h3>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: '#9a3412', fontWeight: '600' }}>
                      Configure reallocation for the unfinished quantity ({getRemainingQty()} m).
                    </p>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                        Number of Splits *
                      </label>
                      <select
                        value={reallocSplitsCount}
                        onChange={e => handleSplitsCountChange(parseInt(e.target.value))}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '0.85rem', fontWeight: '700' }}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                          <option key={n} value={n}>{n} {n === 1 ? 'Split' : 'Splits'}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '1.25rem', border: '1px solid #fed7aa', borderRadius: '8px', padding: '0.5rem', backgroundColor: '#fafafa' }}>
                      {reallocSplits.map((split, idx) => (
                        <div key={idx} style={{ padding: '0.75rem', border: '1px solid #fed7aa', borderRadius: '6px', marginBottom: '0.75rem', backgroundColor: '#fff' }}>
                          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: '800', color: '#ea580c' }}>
                            Split #{idx + 1}
                          </h4>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                            {/* Quantity */}
                            <div style={{ gridColumn: 'span 2' }}>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                                Quantity (Mtrs) *
                              </label>
                              <input
                                type="number"
                                value={split.qty}
                                onChange={e => updateReallocSplit(idx, 'qty', e.target.value)}
                                style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '0.8rem', fontWeight: '700', boxSizing: 'border-box' }}
                              />
                            </div>

                            {/* Sizing Type */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Sizing Type</label>
                              <select
                                value={split.sizing_type}
                                onChange={e => updateReallocSplit(idx, 'sizing_type', e.target.value)}
                                style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '0.8rem', fontWeight: '600' }}
                              >
                                <option value="in_house">In House</option>
                                <option value="job_work">Job Work</option>
                              </select>
                            </div>

                            {/* Machine / Partner */}
                            {split.sizing_type === 'in_house' ? (
                              <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Sizing Loom / Machine *</label>
                                <select
                                  value={split.machine_id}
                                  onChange={e => updateReallocSplit(idx, 'machine_id', e.target.value)}
                                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '0.8rem', fontWeight: '600' }}
                                >
                                  <option value="">Select machine...</option>
                                  {sizingMachines.filter(m => m.scope === 'in_house').map(m => (
                                    <option key={m.id} value={m.id}>{m.machine_name}</option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Sizing Partner *</label>
                                  <select
                                    value={split.partner_id}
                                    onChange={e => updateReallocSplit(idx, 'partner_id', e.target.value)}
                                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '0.8rem', fontWeight: '600' }}
                                  >
                                    <option value="">Select partner...</option>
                                    {sizingPartners.map(p => (
                                      <option key={p.id} value={p.id}>{p.partner_name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Sizing Loom / Machine *</label>
                                  <select
                                    value={split.machine_id}
                                    onChange={e => updateReallocSplit(idx, 'machine_id', e.target.value)}
                                    disabled={!split.partner_id}
                                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '0.8rem', fontWeight: '600' }}
                                  >
                                    <option value="">Select machine...</option>
                                    {sizingMachines.filter(m => m.scope === 'job_work' && m.partner_id?.toString() === split.partner_id?.toString()).map(m => (
                                      <option key={m.id} value={m.id}>{m.machine_name}</option>
                                    ))}
                                  </select>
                                </div>
                              </>
                            )}

                            {/* Start Date */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Start Date *</label>
                              <input
                                type="date"
                                value={split.start_date}
                                onChange={e => updateReallocSplit(idx, 'start_date', e.target.value)}
                                style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '0.8rem', fontWeight: '600' }}
                              />
                            </div>

                            {/* End Date */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>End Date *</label>
                              <input
                                type="date"
                                value={split.end_date}
                                onChange={e => updateReallocSplit(idx, 'end_date', e.target.value)}
                                style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '0.8rem', fontWeight: '600' }}
                              />
                            </div>

                            {/* Beam Name */}
                            <div style={{ gridColumn: 'span 2' }}>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Beam Name</label>
                              <input
                                type="text"
                                value={split.beam_name}
                                onChange={e => updateReallocSplit(idx, 'beam_name', e.target.value)}
                                style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '0.8rem', fontWeight: '600', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => {
                          setStopStep('ask_realloc_now_later');
                        }}
                        style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          const parentRemainingQty = getRemainingQty();

                          let totalSplitQty = 0;
                          for (let idx = 0; idx < reallocSplits.length; idx++) {
                            const split = reallocSplits[idx];
                            const prefix = reallocSplits.length > 1 ? `Split #${idx + 1}: ` : '';
                            
                            if (split.sizing_type === 'in_house') {
                              if (!split.machine_id) {
                                alert(`${prefix}Please select a sizing machine/loom.`);
                                return;
                              }
                            } else {
                              if (!split.partner_id) {
                                alert(`${prefix}Please select a sizing partner.`);
                                return;
                              }
                              if (!split.machine_id) {
                                alert(`${prefix}Please select a sizing machine.`);
                                return;
                              }
                            }
                            if (!split.start_date || !split.end_date) {
                              alert(`${prefix}Please enter planned start and end dates.`);
                              return;
                            }
                            const qVal = parseFloat(split.qty);
                            if (isNaN(qVal) || qVal <= 0) {
                              alert(`${prefix}Please enter a valid positive quantity.`);
                              return;
                            }
                            totalSplitQty += qVal;
                          }

                          if (Math.abs(totalSplitQty - parentRemainingQty) > 0.01) {
                            alert(`Total reallocated quantity (${totalSplitQty} m) must exactly match the remaining quantity (${parentRemainingQty} m).`);
                            return;
                          }
                          setStopStep('confirm_stop');
                        }}
                        style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', backgroundColor: '#ea580c', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700' }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 5: Confirm Stop */}
                {stopStep === 'confirm_stop' && (
                  <div>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', fontWeight: '800', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={16} /> Confirm Sizing Order Form Permanent Stop
                    </h3>
                    <div style={{ backgroundColor: 'rgba(254,215,170,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid #fed7aa', marginBottom: '1.25rem', fontSize: '0.8rem', lineHeight: '1.5' }}>
                      <div><strong>Form to Stop:</strong> {sofDetail.sof_number}</div>
                      <div><strong>Original Qty:</strong> {Number(sofDetail.original_qty || sofDetail.qty).toLocaleString()} m</div>
                      <div><strong>Completed Qty:</strong> {parseFloat(stopCompletedQty || 0).toLocaleString()} m</div>
                      <div><strong>Remaining Qty:</strong> {getRemainingQty().toLocaleString()} m</div>
                      
                      {getRemainingQty() === 0 ? (
                        <div style={{ marginTop: '0.75rem', borderTop: '1px dashed #fed7aa', paddingTop: '0.5rem', color: '#166534', fontWeight: '700' }}>
                          Process fully completed. No remaining quantity to reallocate.
                        </div>
                      ) : reallocWhen === 'later' ? (
                        <div style={{ marginTop: '0.75rem', borderTop: '1px dashed #fed7aa', paddingTop: '0.5rem', color: '#ea580c', fontWeight: '700' }}>
                          Reallocation will be performed later.
                        </div>
                      ) : (
                        reallocSplits.reduce((sum, s) => sum + parseFloat(s.qty || 0), 0) > 0 && (
                          <div style={{ marginTop: '0.75rem', borderTop: '1px dashed #fed7aa', paddingTop: '0.5rem' }}>
                            <span style={{ fontWeight: '700', color: '#ea580c', display: 'block', marginBottom: '4px' }}>New Reallocated Sizing Order Form Details:</span>
                            {reallocSplits.map((split, sIdx) => (
                              <div key={sIdx} style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: sIdx < reallocSplits.length - 1 ? '1px dotted #fed7aa' : 'none' }}>
                                <strong>Split #{sIdx + 1}:</strong> {split.qty} m ({split.sizing_type === 'in_house' ? 'In House' : 'Job Work'} - {split.sizing_type === 'in_house' ? split.machine_name : `${split.partner_name} / ${split.machine_name}`})
                                <div>Dates: {split.start_date} to {split.end_date} {split.beam_name ? `(Beam: ${split.beam_name})` : ''}</div>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => {
                          const originalQty = Number(sofDetail.original_qty || sofDetail.qty);
                          const completedQtyVal = parseFloat(stopCompletedQty || 0);
                          const remainingQtyVal = originalQty - completedQtyVal;

                          if (remainingQtyVal === 0) {
                            if (stopHasSplits) {
                              setStopStep('splits_table');
                            } else {
                              setStopStep('confirm_qty_no_splits');
                            }
                          } else {
                            if (reallocWhen === 'now') {
                              setStopStep('reallocate');
                            } else {
                              setStopStep('ask_realloc_now_later');
                            }
                          }
                        }}
                        style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}
                      >
                        Back
                      </button>
                      <button
                        onClick={handleConfirmStop}
                        disabled={saving}
                        style={{
                          padding: '0.5rem 1.5rem',
                          border: 'none',
                          borderRadius: '8px',
                          backgroundColor: '#ea580c',
                          color: '#fff',
                          cursor: saving ? 'wait' : 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: '700',
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          boxShadow: '0 3px 10px rgba(234,88,12,0.2)',
                          opacity: saving ? 0.7 : 1
                        }}
                      >
                        {saving ? <Loader size={14} className="spin" /> : <AlertTriangle size={14} />}
                        {saving ? 'Stopping...' : 'Confirm & Stop Process'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Resuming stopped process if it was paused (sofdc_number is empty) */}
        {sofDetail.status === 'stopped' && !sofDetail.sofdc_number && (
          <div style={{
            borderTop: '1px solid var(--border-current)',
            paddingTop: '1.25rem',
            marginTop: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'flex-start'
          }}>
            <button
              onClick={handleResumeProcess}
              disabled={saving}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.6rem 1.5rem',
                backgroundColor: '#1d4ed8',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(29,78,216,0.2)'
              }}
            >
              {saving ? <Loader size={14} className="spin" /> : <Play size={14} />}
              Resume Process
            </button>
          </div>
        )}

        {(sofDetail.status === 'completed' || (sofDetail.status === 'stopped' && !!sofDetail.sofdc_number)) && (
          <PrintableSOFDC 
            sof={sofDetail} 
            order={sofDetail.order} 
            machineName={sofDetail.machine?.machine_name || sofDetail.machine_name} 
            partnerName={sofDetail.partner?.partner_name || sofDetail.partner_name}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-current)', paddingTop: '1rem' }}>
          {sofDetail.status === 'stopped' && !!sofDetail.sofdc_number && !isReallocated && (
            <button
              onClick={() => {
                setReallocType(sofDetail.sizing_type || 'in_house');
                setReallocBeamName(sofDetail.beam_name || '');
                setReallocQty(sofDetail.original_qty || sofDetail.qty || '');
                setShowReallocateModal(true);
              }}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: '#ea580c',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(234,88,12,0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <RefreshCw size={14} /> Reallocate
            </button>
          )}
          <button onClick={onClose} style={{
            padding: '0.5rem 1.5rem',
            backgroundColor: '#800000',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: '700',
            cursor: 'pointer'
          }}>
            Close
          </button>
        </div>

        {showReallocateModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 110,
            backgroundColor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem'
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '700px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.04)',
              border: '1px solid var(--border-current)',
              padding: '1.5rem',
              color: 'var(--text-current)'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '800', color: '#800000', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <RefreshCw size={18} /> Reallocate Sizing Order Form
              </h3>
              
              <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
                Create new Sizing Order Forms to reallocate the unfinished quantity.
              </p>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                  Number of Splits *
                </label>
                <select
                  value={reallocSplitsCount}
                  onChange={e => handleSplitsCountChange(parseInt(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.85rem', fontWeight: '700' }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'Split' : 'Splits'}</option>
                  ))}
                </select>
              </div>

              <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '1.5rem', border: '1px solid var(--border-current)', borderRadius: '8px', padding: '0.5rem', backgroundColor: '#fafafa' }}>
                {reallocSplits.map((split, idx) => (
                  <div key={idx} style={{ padding: '0.75rem', border: '1px solid var(--border-current)', borderRadius: '6px', marginBottom: '0.75rem', backgroundColor: '#fff' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: '800', color: '#800000' }}>
                      Split #{idx + 1}
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                      {/* Quantity */}
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                          Quantity (Mtrs) *
                        </label>
                        <input
                          type="number"
                          value={split.qty}
                          onChange={e => updateReallocSplit(idx, 'qty', e.target.value)}
                          style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '700', boxSizing: 'border-box' }}
                        />
                      </div>

                      {/* Sizing Type */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Sizing Type</label>
                        <select
                          value={split.sizing_type}
                          onChange={e => updateReallocSplit(idx, 'sizing_type', e.target.value)}
                          style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600' }}
                        >
                          <option value="in_house">In House</option>
                          <option value="job_work">Job Work</option>
                        </select>
                      </div>

                      {/* Machine / Partner */}
                      {split.sizing_type === 'in_house' ? (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Sizing Loom / Machine *</label>
                          <select
                            value={split.machine_id}
                            onChange={e => updateReallocSplit(idx, 'machine_id', e.target.value)}
                            style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600' }}
                          >
                            <option value="">Select machine...</option>
                            {sizingMachines.filter(m => m.scope === 'in_house').map(m => (
                              <option key={m.id} value={m.id}>{m.machine_name}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Sizing Partner *</label>
                            <select
                              value={split.partner_id}
                              onChange={e => updateReallocSplit(idx, 'partner_id', e.target.value)}
                              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600' }}
                            >
                              <option value="">Select partner...</option>
                              {sizingPartners.map(p => (
                                <option key={p.id} value={p.id}>{p.partner_name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Sizing Loom / Machine *</label>
                            <select
                              value={split.machine_id}
                              onChange={e => updateReallocSplit(idx, 'machine_id', e.target.value)}
                              disabled={!split.partner_id}
                              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600' }}
                            >
                              <option value="">Select machine...</option>
                              {sizingMachines.filter(m => m.scope === 'job_work' && m.partner_id?.toString() === split.partner_id?.toString()).map(m => (
                                      <option key={m.id} value={m.id}>{m.machine_name}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}

                      {/* Start Date */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Start Date *</label>
                        <input
                          type="date"
                          value={split.start_date}
                          onChange={e => updateReallocSplit(idx, 'start_date', e.target.value)}
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600' }}
                        />
                      </div>

                      {/* End Date */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>End Date *</label>
                        <input
                          type="date"
                          value={split.end_date}
                          onChange={e => updateReallocSplit(idx, 'end_date', e.target.value)}
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600' }}
                        />
                      </div>

                      {/* Beam Name */}
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Beam Name</label>
                        <input
                          type="text"
                          value={split.beam_name}
                          onChange={e => updateReallocSplit(idx, 'beam_name', e.target.value)}
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  disabled={reallocSaving}
                  onClick={() => setShowReallocateModal(false)}
                  style={{ padding: '0.5rem 1.25rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  disabled={reallocSaving}
                  onClick={handlePostStopReallocate}
                  style={{
                    padding: '0.5rem 1.5rem',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: '#ea580c',
                    color: '#fff',
                    cursor: reallocSaving ? 'wait' : 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    boxShadow: '0 3px 10px rgba(234,88,12,0.2)',
                    opacity: reallocSaving ? 0.7 : 1
                  }}
                >
                  {reallocSaving ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />}
                  {reallocSaving ? 'Reallocating...' : 'Confirm Reallocate'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sizing Tab ──────────────────────────────────────────────────────────────

function SizingTab() {
  return <InHouseSizingGantt />;
}

function InHouseSizingGantt() {
  const [machines, setMachines] = useState([]);
  const [sofs, setSofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSof, setSelectedSof] = useState(null);
  const [expandedMachines, setExpandedMachines] = useState({});

  // Date window: starts 3 days before today
  const [windowStart, setWindowStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const days = useMemo(() => getDaysArray(windowStart, TOTAL_DAYS), [windowStart]);

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
      // Fetch sizing department machines (in-house)
      const { data: deptData } = await supabase
        .from('master_departments')
        .select('id')
        .ilike('department_name', '%sizing%');

      const sizingDeptIds = (deptData || []).map(d => d.id);

      let machineData = [];
      if (sizingDeptIds.length > 0) {
        const { data } = await supabase
          .from('master_machines')
          .select('*, master_departments(department_name)')
          .in('department_id', sizingDeptIds)
          .eq('scope', 'in_house')
          .order('machine_name');
        machineData = data || [];
      }

      // Fallback
      if (machineData.length === 0) {
        const { data } = await supabase
          .from('master_machines')
          .select('*, master_departments(department_name)')
          .eq('scope', 'in_house')
          .order('machine_name');
        machineData = data || [];
      }

      setMachines(machineData);

      // Fetch all in-house SOFs
      const { data: sofData } = await supabase
        .from('sizing_order_forms')
        .select(`
          *,
          order:orders(order_number, design_no, design_name)
        `)
        .eq('sizing_type', 'in_house')
        .order('start_date', { ascending: true });

      setSofs(sofData || []);
    } catch (err) {
      console.error('Error fetching Gantt data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group SOFs by machine_id, filtered to only those overlapping the visible date window
  const sofsByMachine = useMemo(() => {
    const windowStartKey = formatDateKey(days[0]);
    const windowEndKey = formatDateKey(days[days.length - 1]);
    const map = {};
    sofs.forEach(s => {
      if (!s.machine_id) return;
      const sStart = s.start_date || '';
      const sEnd = s.end_date || '';
      if (!sStart && !sEnd) {
        if (s.status !== 'on_process') return;
      } else {
        const effectiveStart = sStart || sEnd;
        const effectiveEnd = sEnd || sStart;
        if (effectiveEnd < windowStartKey || effectiveStart > windowEndKey) return;
      }
      if (!map[s.machine_id]) map[s.machine_id] = [];
      map[s.machine_id].push(s);
    });
    return map;
  }, [sofs, days]);

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

  const toggleMachine = (machineId) => {
    setExpandedMachines(prev => ({ ...prev, [machineId]: !prev[machineId] }));
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
        backgroundColor: '#fff',
        minHeight: '450px'
      }}>
        <div className="gantt-scroll-container" style={{ overflowX: 'auto' }}>
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
                ⚙️ Sizing Machine
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
                No in-house sizing machines found. Please add machines in the Masters section and assign them to a Sizing department.
              </div>
            ) : (
              machines.map(machine => {
                const isExpanded = expandedMachines[machine.id];
                const machineSofs = sofsByMachine[machine.id] || [];
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
                        backgroundColor: isExpanded ? 'rgba(128,0,0,0.02)' : '#fafafa',
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
                          backgroundColor: machineSofs.length > 0 ? 'rgba(128,0,0,0.1)' : '#f1f5f9',
                          color: machineSofs.length > 0 ? '#800000' : '#94a3b8',
                          padding: '2px 8px', borderRadius: '12px',
                          fontSize: '0.65rem', fontWeight: '800'
                        }}>
                          {machineSofs.length} SOF{machineSofs.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Aggregated Gantt bars for the machine row */}
                      {(() => {
                        const { itemLanes, totalLanes } = allocateLanes(machineSofs);
                        const LANE_HEIGHT = 28;
                        const ROW_PADDING = 12;
                        const rowHeight = totalLanes * LANE_HEIGHT + ROW_PADDING;

                        return (
                          <div style={{ display: 'flex', position: 'relative', flex: 1 }}>
                            {days.map((d, i) => (
                              <div key={i} style={{
                                width: `${DAY_COL_WIDTH}px`, minWidth: `${DAY_COL_WIDTH}px`,
                                borderRight: '1px solid #f5f5f5',
                                backgroundColor: isToday(d) ? 'rgba(128,0,0,0.03)' : d.getDay() === 0 ? '#fefafa' : 'transparent',
                                height: `${rowHeight}px`
                              }} />
                            ))}
                            {/* Overlay bars for each SOF */}
                            {machineSofs.map(sof => {
                              const bar = calcBarPosition(sof, days);
                              if (!bar) return null;
                              const laneIdx = itemLanes[sof.id] || 0;
                              return (
                                <GanttBar
                                  key={sof.id}
                                  wof={{ ...sof, wof_number: sof.beam_name ? `${sof.sof_number} (${sof.beam_name})` : sof.sof_number }}
                                  bar={bar}
                                  compact
                                  onWofClick={(s) => setSelectedSof(s)}
                                  topOffset={`${6 + laneIdx * LANE_HEIGHT}px`}
                                  customHeight={`${LANE_HEIGHT - 6}px`}
                                />
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Expanded SOF Rows */}
                    {isExpanded && machineSofs.map(sof => {
                      const sc = getSofStatusBadge(sof);
                      const todayStr = getLocalDateString(new Date());

                      return (
                        <div key={sof.id} style={{
                          display: 'flex',
                          borderBottom: '1px solid #f3f3f3',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                          minHeight: '60px'
                        }}
                        onClick={() => setSelectedSof(sof)}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(128,0,0,0.01)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                        >
                          {/* SOF detail label */}
                          <div
                            onClick={(e) => { e.stopPropagation(); setSelectedSof(sof); }}
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
                                {sof.sof_number} {sof.beam_name ? `(${sof.beam_name})` : ''}
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
                              <span style={{ fontWeight: '600' }}>Order:</span> {sof.order?.order_number || '—'}
                              {' · '}
                              <span style={{ fontWeight: '600' }}>Design:</span> {sof.order?.design_no || '—'}
                              {sof.order?.design_name ? ` / ${sof.order.design_name}` : ''}
                            </div>
                            <div style={{ color: '#800000', fontWeight: '700', fontSize: '0.68rem', marginTop: '1px' }}>
                              Qty: {sof.qty ? `${Number(sof.qty).toLocaleString()} m` : '—'}
                            </div>
                          </div>

                          {/* SOF Gantt bar */}
                          <div style={{ display: 'flex', position: 'relative', flex: 1, minHeight: '60px' }}>
                            {days.map((d, i) => (
                              <div key={i} style={{
                                width: `${DAY_COL_WIDTH}px`, minWidth: `${DAY_COL_WIDTH}px`,
                                borderRight: '1px solid #fafafa',
                                backgroundColor: isToday(d) ? 'rgba(128,0,0,0.03)' : d.getDay() === 0 ? '#fefcfc' : 'transparent'
                              }} />
                            ))}
                            {(() => {
                              const isFinished = sof.status === 'completed' || (sof.status === 'stopped' && !!sof.sofdc_number);
                              const actualEndStr = isFinished
                                ? (getLocalDateString(sof.process_completed_at) || getLocalDateString(sof.updated_at) || todayStr)
                                : todayStr;
                              const exceeded = sof.end_date && actualEndStr > sof.end_date;

                              // 1. Planned Bar
                              const plannedBar = calcBarPositionForDates(sof.start_date, sof.end_date, days);
                              const pBg = '#fef9c3';
                              const pBorder = '#eab308';
                              const pText = '#854d0e';

                              // 2. Actual Bar
                              const showActual = !!sof.process_started_at || sof.status === 'on_process' || isFinished;
                              let actualBar = null;
                              let aBg = '';
                              let aBorder = '';
                              let aText = '';

                              if (showActual) {
                                const actualStartStr = getLocalDateString(sof.process_started_at) || sof.start_date || todayStr;
                                actualBar = calcBarPositionForDates(actualStartStr, actualEndStr, days);
                                
                                if (sof.status === 'on_process') {
                                  if (exceeded) {
                                    aBg = '#fee2e2';
                                    aBorder = '#ef4444';
                                    aText = '#b91c1c';
                                  } else {
                                    aBg = '#dbeafe';
                                    aBorder = '#3b82f6';
                                    aText = '#1d4ed8';
                                  }
                                } else if (isFinished) {
                                  if (exceeded) {
                                    aBg = '#fee2e2';
                                    aBorder = '#ef4444';
                                    aText = '#b91c1c';
                                  } else {
                                    aBg = sof.status === 'completed' ? '#dcfce7' : '#fff7ed';
                                    aBorder = sof.status === 'completed' ? '#22c55e' : '#f97316';
                                    aText = sof.status === 'completed' ? '#166534' : '#c2410c';
                                  }
                                } else {
                                  const statusColor = getStatusColor(sof.status);
                                  aBg = statusColor.bg;
                                  aBorder = statusColor.border;
                                  aText = statusColor.text;
                                }
                              }

                              return (
                                <>
                                  {plannedBar && (
                                    <GanttBar
                                      key={`${sof.id}-planned`}
                                      wof={{ ...sof, wof_number: sof.sof_number }}
                                      bar={plannedBar}
                                      onWofClick={(s) => setSelectedSof(s)}
                                      customBg={pBg}
                                      customBorder={pBorder}
                                      customTextColor={pText}
                                      customLabel={sof.beam_name ? `${sof.sof_number} (Plan) (${sof.beam_name})` : `${sof.sof_number} (Plan)`}
                                      topOffset="6px"
                                      customHeight="20px"
                                      tooltipType="planned"
                                    />
                                  )}
                                  {showActual && actualBar && (
                                    <GanttBar
                                      key={`${sof.id}-actual`}
                                      wof={{ ...sof, wof_number: sof.sof_number }}
                                      bar={actualBar}
                                      onWofClick={(s) => setSelectedSof(s)}
                                      customBg={aBg}
                                      customBorder={aBorder}
                                      customTextColor={aText}
                                      customLabel={sof.beam_name ? `${sof.sof_number} (Actual) (${sof.beam_name})` : `${sof.sof_number} (Actual)`}
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
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* SOF Details Modal */}
      {selectedSof && (
        <SofDetailModal
          sof={selectedSof}
          onClose={() => setSelectedSof(null)}
          onStatusChanged={() => {
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function JobWorkSizingTable() {
  const [sofs, setSofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSof, setSelectedSof] = useState(null);

  useEffect(() => {
    fetchJobWorkSofs();
  }, []);

  const fetchJobWorkSofs = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('sizing_order_forms')
        .select(`
          *,
          order:orders(order_number, design_no, design_name),
          wof:warping_order_forms(wof_number)
        `)
        .eq('sizing_type', 'job_work')
        .order('created_at', { ascending: false });
      setSofs(data || []);
    } catch (err) {
      console.error('Error fetching job work SOFs:', err);
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

  if (sofs.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '4rem',
        backgroundColor: 'var(--surface-current)',
        border: '1px solid var(--border-current)',
        borderRadius: '12px', color: 'var(--text-muted-current)'
      }}>
        <Package size={40} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
        <p style={{ margin: 0, fontWeight: '600' }}>No job work sizing orders found.</p>
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
              {['SOF Number', 'Warping Ref', 'Order Number', 'Design', 'Partner', 'Qty (m)', 'Start Date', 'End Date', 'Status'].map(h => (
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
            {sofs.map(sof => {
              const sc = getSofStatusBadge(sof);
              return (
                <tr key={sof.id} onClick={() => setSelectedSof(sof)} style={{ borderBottom: '1px solid var(--border-current)', backgroundColor: '#fff', cursor: 'pointer', transition: 'background-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(128,0,0,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: '#800000', fontFamily: 'monospace' }}>
                    {sof.sof_number} {sof.beam_name ? `(${sof.beam_name})` : ''}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {sof.wof?.wof_number || '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>
                    {sof.order?.order_number || '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {sof.order?.design_no || '—'}{sof.order?.design_name ? ` / ${sof.order.design_name}` : ''}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: '600', color: '#059669' }}>
                    {sof.partner_name || '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>
                    {sof.qty ? Number(sof.qty).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {sof.start_date ? new Date(sof.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {sof.end_date ? new Date(sof.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
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

      {/* SOF Details Modal */}
      {selectedSof && (
        <SofDetailModal
          sof={selectedSof}
          onClose={() => setSelectedSof(null)}
          onStatusChanged={() => {
            fetchJobWorkSofs();
          }}
        />
      )}
    </div>
  );
}
