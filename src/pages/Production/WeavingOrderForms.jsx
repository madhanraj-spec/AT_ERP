import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Loader, Package, Search, RefreshCw, ChevronDown, ChevronRight, Eye, Settings, Calendar, User, ArrowRight, SlidersHorizontal, ChevronUp, X, CheckCircle, AlertCircle, Inbox, Truck, Layers, ChevronLeft
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { generateWeavingNumbersBulk } from '../../utils/weaving';
import PrintableWVOF from './PrintableWVOF';
import PrintableWVOFDC from './PrintableWVOFDC';
import DyedDeliveryPrintModal from '../DyedYarn/DyedDeliveryPrintModal';

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
      return { label: 'Stopped', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
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

function getDatesInRange(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return [];
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];
  
  const dates = [];
  const temp = new Date(start);
  while (temp <= end) {
    const y = temp.getFullYear();
    const m = String(temp.getMonth() + 1).padStart(2, '0');
    const d = String(temp.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    temp.setDate(temp.getDate() + 1);
  }
  return dates;
}



function getLocalDateOnly(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getUnifiedProductionDates(wvof) {
  const datesSet = new Set();
  
  // Add planned dates
  if (wvof.planned_daily_production && Array.isArray(wvof.planned_daily_production)) {
    wvof.planned_daily_production.forEach(p => {
      if (p.date) datesSet.add(p.date);
    });
  }
  
  // Add actual log dates
  if (wvof.production_logs && Array.isArray(wvof.production_logs)) {
    wvof.production_logs.forEach(log => {
      const dStr = getLocalDateOnly(log.timestamp);
      if (dStr) datesSet.add(dStr);
    });
  }
  
  // Sort dates chronologically ascending
  return Array.from(datesSet).sort();
}

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

function hasExceededPlannedEnd(wvof) {
  if (!wvof.end_date) return false;
  const todayStr = getLocalDateString(new Date());
  const plannedEndStr = wvof.end_date;
  if (wvof.status === 'completed' || wvof.status === 'late_complete') {
    const actualEndStr = wvof.process_completed_at
      ? getLocalDateString(wvof.process_completed_at)
      : (getLocalDateString(wvof.updated_at) || todayStr);
    return actualEndStr > plannedEndStr;
  }
  return todayStr > plannedEndStr;
}

function allocateLanes(items) {
  if (!items || items.length === 0) {
    return { itemLanes: {}, totalLanes: 1 };
  }

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

  const lanes = [];
  const itemLanes = {};

  sorted.forEach(item => {
    const itemStart = item.start_date || '';
    const itemEnd = item.end_date || '';
    
    let assignedLane = -1;
    for (let i = 0; i < lanes.length; i++) {
      let overlaps = false;
      for (const placed of lanes[i]) {
        const pStart = placed.start_date || '';
        const pEnd = placed.end_date || '';
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

function getStatusColorForWeaving(wvofOrStatus) {
  let status = typeof wvofOrStatus === 'string' ? wvofOrStatus : '';
  if (wvofOrStatus && typeof wvofOrStatus === 'object') {
    status = resolveWvofStatusValue(wvofOrStatus);
  }

  switch (status) {
    case 'completed':
      return { bg: '#dcfce7', border: '#22c55e', text: '#166534', label: 'Completed' };
    case 'late_completed':
    case 'late_complete':
      return { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c', label: 'Late Completed' };
    case 'late':
      return { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c', label: 'Late' };
    case 'start_date_exceeded':
      return { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c', label: 'Start Date Exceeded' };
    case 'stopped':
      return { bg: '#f1f5f9', border: '#94a3b8', text: '#475569', label: 'Stopped' };
    case 'on_process':
      return { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8', label: 'On Process' };
    case 'weft_yarn_allotted':
      return { bg: '#fef9c3', border: '#eab308', text: '#854d0e', label: 'Weft Yarn Allotted' };
    case 'weft_yarn_partially_delivered':
      return { bg: '#ffedd5', border: '#f97316', text: '#c2410c', label: 'Partially Delivered' };
    case 'weft_yarn_delivered':
      return { bg: '#e0f2fe', border: '#bae6fd', text: '#0369a1', label: 'Weft Yarn Delivered' };
    case 'pending':
    default:
      return { bg: '#fef3c7', border: '#fde68a', text: '#d97706', label: 'Pending' };
  }
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_COL_WIDTH = 44;
const LABEL_COL_WIDTH = 320;
const TOTAL_DAYS = 30;

function calcBarPositionForDates(startDateStr, endDateStr, days) {
  if (!startDateStr && !endDateStr) return null;

  const windowStartKey = formatDateKey(days[0]);
  const windowEndKey = formatDateKey(days[days.length - 1]);

  const startKey = startDateStr || endDateStr;
  const endKey = endDateStr || startDateStr;

  if (endKey < windowStartKey || startKey > windowEndKey) return null;

  let startIdx = 0;
  if (startKey > windowStartKey) {
    startIdx = days.findIndex(d => formatDateKey(d) === startKey);
    if (startIdx < 0) {
      startIdx = days.findIndex(d => formatDateKey(d) >= startKey);
      if (startIdx < 0) return null;
    }
  }

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

function GanttBar({ wof, bar, compact, onWofClick, customBg, customBorder, customTextColor, customLabel, topOffset, customHeight, tooltipType, deliveries }) {
  const [hovered, setHovered] = useState(false);
  const sc = getStatusColorForWeaving(wof);

  const handleClick = (e) => {
    e.stopPropagation();
    if (onWofClick) onWofClick(wof);
  };

  const bg = customBg || sc.bg;
  const border = customBorder || sc.border;
  const textColor = customTextColor || sc.text;
  const label = customLabel !== undefined ? customLabel : wof.weaving_number;

  const barTop = topOffset !== undefined ? topOffset : (compact ? '6px' : '5px');
  const barHeight = customHeight !== undefined ? customHeight : (compact ? 'calc(100% - 12px)' : 'calc(100% - 10px)');

  const weftBadge = getWeftYarnStatus(wof, deliveries);

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
            <span>{wof.weaving_number}</span>
            <span style={{ fontSize: '0.62rem', opacity: 0.8, backgroundColor: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
              {tooltipType === 'planned' ? 'Planned Schedule' : tooltipType === 'actual' ? 'Actual Progress' : 'Details'}
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
            <div>
              <span style={{ color: '#94a3b8', fontWeight: '600' }}>Produced Qty: </span>
              <span style={{ fontWeight: '700', color: '#10b981' }}>
                {(() => {
                  const totalProduced = (wof.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
                  return `${totalProduced.toLocaleString()} m`;
                })()}
              </span>
            </div>
            {wof.beam_number && (
              <div>
                <span style={{ color: '#94a3b8', fontWeight: '600' }}>Beam No: </span>
                <span style={{ fontWeight: '700' }}>{wof.beam_number}</span>
              </div>
            )}
            <div>
              <span style={{ color: '#94a3b8', fontWeight: '600' }}>Weft Yarn: </span>
              <span style={{ fontWeight: '750', color: weftBadge.color }}>{weftBadge.label}</span>
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
                    {wof.status === 'completed' || wof.status === 'late_complete'
                      ? (wof.process_completed_at
                          ? new Date(wof.process_completed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                          : 'Completed'
                        )
                      : 'Running (Today)'
                    }
                  </span>
                </div>
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
                {tooltipType === 'planned' ? 'Planned' : tooltipType === 'actual' ? (['completed', 'late_complete'].includes(wof.status) ? 'Completed' : 'On Process') : sc.label}
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

const getLooms = (dbMachines, type) => {
  const prefix = type === 'airjet' ? 'AJ' : 'AR';
  const mockList = type === 'airjet' ? MOCK_AIRJET_LOOMS : MOCK_RAPIER_LOOMS;
  
  const dbMatch = dbMachines.filter(m => m.machine_name && m.machine_name.trim().toUpperCase().startsWith(prefix));
  
  const finalMachines = [...dbMatch];
  mockList.forEach(mock => {
    const exists = finalMachines.some(m => m.machine_name.trim().toUpperCase() === mock.machine_name.toUpperCase());
    if (!exists) {
      finalMachines.push(mock);
    }
  });
  
  return finalMachines.sort((a, b) => a.machine_name.localeCompare(b.machine_name, undefined, { numeric: true, sensitivity: 'base' }));
};

const getOrdersForMachine = (machine, allOrders) => {
  return allOrders.filter(w => {
    if (w.weaving_type !== 'in_house') return false;
    
    if (w.machine_id && !machine.id.startsWith('mock-') && w.machine_id === machine.id) {
      return true;
    }
    if (w.machine_name && machine.machine_name && w.machine_name.trim().toUpperCase() === machine.machine_name.trim().toUpperCase()) {
      return true;
    }
    return false;
  });
};

const STATUS_OPTIONS = [
  'all', 'pending', 'weft_yarn_allotted', 'weft_yarn_partially_delivered',
  'weft_yarn_delivered', 'on_process', 'completed', 'late_complete', 'stopped'
];

export default function WeavingOrderForms() {
  const navigate = useNavigate();
  const location = useLocation();
  const isProductionView = location.pathname.includes('/production');
  useAuth();

  const [weavingOrders, setWeavingOrders] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [expandedDates, setExpandedDates] = useState({});
  // Expandable filters state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedWvofs, setSelectedWvofs] = useState([]);
  const [selectedDesigns, setSelectedDesigns] = useState([]);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [activeTypeTab, setActiveTypeTab] = useState('in_house'); // 'in_house' | 'job_work'
  const [expandedWvofId, setExpandedWvofId] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState(isProductionView ? 'yarn' : 'production_record');
  const [roundDateTime, setRoundDateTime] = useState('');
  const [roundWeaver, setRoundWeaver] = useState('');
  const [roundQty, setRoundQty] = useState('');
  const [recordingRound, setRecordingRound] = useState(false);
  const [weavingWorkers, setWeavingWorkers] = useState([]);

  // Gantt sliding window and expanded machines
  const getInitialWindowStart = () => {
    const d = new Date();
    d.setDate(d.getDate() - 3); // Starts 3 days before today
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const [windowStart, setWindowStart] = useState(getInitialWindowStart());
  const [expandedMachines, setExpandedMachines] = useState({});
  const [expandedPartners, setExpandedPartners] = useState({});
  const [selectedWvof, setSelectedWvof] = useState(null);
  const [currentTab, setCurrentTab] = useState(isProductionView ? 'in_house_list' : 'airjet'); // 'airjet' | 'rapier' | 'job_work' | 'in_house_list'
  const [jobWorkViewMode, setJobWorkViewMode] = useState(isProductionView ? 'list' : 'gantt'); // 'gantt' | 'list'

  useEffect(() => {
    const getLocalISODateTime = () => {
      const now = new Date();
      const tzoffset = now.getTimezoneOffset() * 60000;
      return (new Date(now - tzoffset)).toISOString().slice(0, 16);
    };
    setRoundDateTime(getLocalISODateTime());
    setRoundWeaver('');
    setRoundQty('');

    if (selectedWvof) {
      setActiveDetailTab(isProductionView ? 'yarn' : (selectedWvof.process_started_at ? 'production_record' : 'yarn'));
    } else if (expandedWvofId) {
      const wof = weavingOrders.find(w => w.id === expandedWvofId);
      if (wof) {
        setActiveDetailTab(isProductionView ? 'yarn' : (wof.process_started_at ? 'production_record' : 'yarn'));
      }
    }
  }, [expandedWvofId, selectedWvof, isProductionView, weavingOrders]);

  useEffect(() => {
    setCurrentTab(isProductionView ? 'in_house_list' : 'airjet');
  }, [isProductionView]);
  const [inHouseMachines, setInHouseMachines] = useState([]);

  // Edit states
  const [editWvof, setEditWvof] = useState(null);
  const [editWeavingType, setEditWeavingType] = useState('in_house');
  const [editPartnerId, setEditPartnerId] = useState('');
  const [editMachineId, setEditMachineId] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editStatus, setEditStatus] = useState('pending');
  const [editBeamNumber, setEditBeamNumber] = useState('');

  const [editPlannedProduction, setEditPlannedProduction] = useState([]); // [{date: 'YYYY-MM-DD', qty: ''}]
  const [_weftAllotments, setWeftAllotments] = useState([]);

  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  const [machines, setMachines] = useState([]);
  const [partners, setPartners] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [loadingEditModalData, setLoadingEditModalData] = useState(false);

  // Synchronize planned daily production when start or end date changes in the edit modal
  useEffect(() => {
    if (!editWvof) return;
    if (!editStartDate || !editEndDate) {
      setEditPlannedProduction([]);
      return;
    }
    const dates = getDatesInRange(editStartDate, editEndDate);
    setEditPlannedProduction(prev => {
      const prevDates = prev.map(p => p.date);
      const isSame = dates.length === prevDates.length && dates.every((d, i) => d === prevDates[i]);
      if (isSame) {
        return prev;
      }
      return dates.map(dt => {
        const existing = prev.find(p => p.date === dt);
        return {
          date: dt,
          qty: existing && existing.qty !== undefined ? existing.qty.toString() : ''
        };
      });
    });
  }, [editStartDate, editEndDate, editWvof]);

  // Allot Dyed Yarn States
  const [allotWvof, setAllotWvof] = useState(null);
  const [allotRows, setAllotRows] = useState([]); // [{yarn_count_id, countValue, colour, required_qty, lot_number, location_id, location_name, available_stock, allotted_qty}]
  const [loadingAllotData, setLoadingAllotData] = useState(false);
  const [allotSubmitting, setAllotSubmitting] = useState(false);
  const [allotError, setAllotError] = useState('');
  const [allotStartDate, setAllotStartDate] = useState('');
  const [allotEndDate, setAllotEndDate] = useState('');
  const [allotPlannedProduction, setAllotPlannedProduction] = useState([]);

  // Synchronize planned daily production when start or end date changes in the allot modal
  useEffect(() => {
    if (!allotWvof) return;
    if (!allotStartDate || !allotEndDate) {
      setAllotPlannedProduction([]);
      return;
    }
    const dates = getDatesInRange(allotStartDate, allotEndDate);
    setAllotPlannedProduction(prev => {
      const prevDates = prev.map(p => p.date);
      const isSame = dates.length === prevDates.length && dates.every((d, i) => d === prevDates[i]);
      if (isSame) {
        return prev;
      }
      return dates.map(dt => {
        const existing = prev.find(p => p.date === dt);
        return {
          date: dt,
          qty: existing && existing.qty !== undefined ? existing.qty.toString() : ''
        };
      });
    });
  }, [allotStartDate, allotEndDate, allotWvof]);

  const [printWvof, setPrintWvof] = useState(null);
  const [printWvofdc, setPrintWvofdc] = useState(null);
  const [showCompleteWvofForm, setShowCompleteWvofForm] = useState(null);
  const [completeWvofDate, setCompleteWvofDate] = useState(new Date().toISOString().slice(0, 16));
  const [weftYarnReturns, setWeftYarnReturns] = useState([]);
  const [savingCompleteWvof, setSavingCompleteWvof] = useState(false);
  const [selectedDydr, setSelectedDydr] = useState(null);

  const handlePrintGfrrReceipt = (reportData) => {
    try {
      // Find the first non-empty received_at date, fallback to now
      const rawDate = reportData.find(section => section.received_at)?.received_at || new Date().toISOString();
      const todayDate = new Date(rawDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      
      const win = window.open('', '_blank');
      if (!win) {
        alert('Popup blocker prevented receipt from opening. Please allow popups for this site.');
        return;
      }

      // Generate HTML for each section
      let sectionsHtml = '';
      let overallTotalQty = 0;
      let overallTotalRolls = 0;

      reportData.forEach((section) => {
        const sectionQty = section.rolls.reduce((sum, r) => sum + Number(r.qty || 0), 0);
        overallTotalQty += sectionQty;
        overallTotalRolls += section.rolls.length;

        const rollsRows = section.rolls.map((r, rIdx) => `
          <tr>
            <td style="padding: 0.6rem 0.75rem; border-bottom: 1px solid #edf2f7; text-align: center; font-weight: 600; color: #475569;">${rIdx + 1}</td>
            <td style="padding: 0.6rem 0.75rem; border-bottom: 1px solid #edf2f7; font-family: monospace; font-weight: 700; color: #1e293b;">${r.id}</td>
            <td style="padding: 0.6rem 0.75rem; border-bottom: 1px solid #edf2f7; text-align: right; font-weight: 800; color: #800000; font-size: 0.9rem;">${Number(r.qty).toLocaleString()} m</td>
          </tr>
        `).join('');

        sectionsHtml += `
          <div class="section" style="border: 1px solid #cbd5e1; border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; background-color: #f8fafc; page-break-inside: avoid;">
            <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
              <h3 class="section-title" style="font-size: 1.05rem; font-weight: 850; color: #1e293b; margin: 0;">📦 Order Form: ${section.weaving_number}</h3>
              <span style="font-size: 0.85rem; font-weight: 800; color: #800000;">GFRR Receipt No: ${section.gfrr_no}</span>
            </div>
            
            <div class="section-meta" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; font-size: 0.8rem; margin-bottom: 1rem; background-color: #fff; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div class="meta-item">
                <strong style="color: #64748b; font-size: 0.7rem; text-transform: uppercase; display: block; margin-bottom: 0.15rem; letter-spacing: 0.02em;">Job Work Partner</strong>
                <span style="font-weight: 750; color: #1e293b;">${section.partner_name}</span>
              </div>
              <div class="meta-item">
                <strong style="color: #64748b; font-size: 0.7rem; text-transform: uppercase; display: block; margin-bottom: 0.15rem; letter-spacing: 0.02em;">Machine / Loom</strong>
                <span style="font-weight: 750; color: #1e293b;">${section.machine_name}</span>
              </div>
              <div class="meta-item">
                <strong style="color: #64748b; font-size: 0.7rem; text-transform: uppercase; display: block; margin-bottom: 0.15rem; letter-spacing: 0.02em;">Order Number</strong>
                <span style="font-weight: 750; color: #1e293b;">${section.order_number}</span>
              </div>
              <div class="meta-item">
                <strong style="color: #64748b; font-size: 0.7rem; text-transform: uppercase; display: block; margin-bottom: 0.15rem; letter-spacing: 0.02em;">Design / Pattern</strong>
                <span style="font-weight: 750; color: #1e293b;">${section.design_no} ${section.design_name ? `/ ${section.design_name}` : ''}</span>
              </div>
            </div>
            
            <table class="rolls-table" style="width: 100%; border-collapse: collapse; font-size: 0.825rem; background-color: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
              <thead>
                <tr>
                  <th style="width: 80px; text-align: center; background-color: #f1f5f9; color: #475569; font-weight: 750; padding: 0.5rem 0.75rem; text-align: left; font-size: 0.72rem; text-transform: uppercase; border-bottom: 1px solid #cbd5e1;">Roll S.No</th>
                  <th style="background-color: #f1f5f9; color: #475569; font-weight: 750; padding: 0.5rem 0.75rem; text-align: left; font-size: 0.72rem; text-transform: uppercase; border-bottom: 1px solid #cbd5e1;">Fabric Roll ID</th>
                  <th style="text-align: right; width: 180px; background-color: #f1f5f9; color: #475569; font-weight: 750; padding: 0.5rem 0.75rem; font-size: 0.72rem; text-transform: uppercase; border-bottom: 1px solid #cbd5e1;">Roll Qty (Meters)</th>
                </tr>
              </thead>
              <tbody>
                ${rollsRows}
                <tr style="background-color: #fcfcfc; font-weight: 800; border-top: 1.5px solid #cbd5e1;">
                  <td colspan="2" style="padding: 0.75rem; color: #475569; text-align: right; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.02em;">WVOF Subtotal (${section.rolls.length} rolls)</td>
                  <td style="padding: 0.75rem; text-align: right; color: #800000; font-size: 0.95rem;">${sectionQty.toLocaleString()} m</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      });

      let summaryRows = reportData.map(section => {
        const sectionQty = section.rolls.reduce((sum, r) => sum + Number(r.qty || 0), 0);
        return `
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 0.65rem 0.75rem; font-weight: 700; color: #059669;">${section.weaving_number}</td>
            <td style="padding: 0.65rem 0.75rem; text-align: center; font-weight: 700;">${section.rolls.length}</td>
            <td style="padding: 0.65rem 0.75rem; text-align: right; font-weight: 800; color: #800000;">${sectionQty.toLocaleString()} m</td>
          </tr>
        `;
      }).join('');

      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>GFRR - Greige Fabric Receiving Receipt</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Inter', -apple-system, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 2.5rem;
              background-color: #fff;
              line-height: 1.5;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 3px solid #800000;
              padding-bottom: 1.25rem;
              margin-bottom: 2rem;
            }
            .logo-container {
              display: flex;
              align-items: center;
              gap: 0.75rem;
            }
            .logo-icon {
              width: 42px;
              height: 42px;
              background-color: #800000;
              border-radius: 10px;
              color: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 900;
              font-size: 1.4rem;
            }
            .logo-text {
              font-size: 1.6rem;
              font-weight: 900;
              color: #800000;
              letter-spacing: -0.04em;
              margin: 0;
            }
            .receipt-title-container {
              text-align: right;
            }
            .receipt-title {
              font-size: 1.6rem;
              font-weight: 900;
              color: #1e293b;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: -0.02em;
            }
            .receipt-subtitle {
              font-size: 0.825rem;
              color: #64748b;
              margin: 0.2rem 0 0 0;
              font-weight: 700;
            }
            .summary-box {
              margin-top: 2rem;
              border: 2px solid #800000;
              border-radius: 12px;
              padding: 1.5rem;
              background-color: #fff;
              page-break-inside: avoid;
            }
            .summary-title {
              font-size: 1.15rem;
              font-weight: 900;
              color: #800000;
              margin: 0 0 1rem 0;
              border-bottom: 1.5px solid #fee2e2;
              padding-bottom: 0.4rem;
              text-transform: uppercase;
              letter-spacing: 0.02em;
            }
            .summary-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 0.85rem;
              margin-bottom: 1.25rem;
            }
            .summary-table th {
              padding: 0.5rem 0.75rem;
              font-weight: 750;
              color: #475569;
              border-bottom: 2px solid #e2e8f0;
              font-size: 0.72rem;
              text-transform: uppercase;
            }
            .summary-card-container {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 1rem;
              text-align: center;
              border-top: 1.5px dashed #cbd5e1;
              padding-top: 1rem;
            }
            .summary-card {
              background-color: #fdfafb;
              border: 1px solid #f9ebeb;
              border-radius: 8px;
              padding: 0.6rem;
            }
            .summary-card strong {
              font-size: 0.7rem;
              color: #991b1b;
              text-transform: uppercase;
              display: block;
              margin-bottom: 0.2rem;
            }
            .summary-card span {
              font-size: 1.35rem;
              font-weight: 900;
              color: #800000;
            }
            .footer-sigs {
              margin-top: 3.5rem;
              display: flex;
              justify-content: space-between;
              page-break-inside: avoid;
            }
            .sig-line {
              width: 200px;
              border-top: 1.5px solid #cbd5e1;
              text-align: center;
              padding-top: 0.4rem;
              font-size: 0.78rem;
              font-weight: 700;
              color: #475569;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-container">
              <img src="/logo.png" alt="Company Logo" style="max-height: 55px; max-width: 180px; object-fit: contain;" onerror="this.style.display='none'; document.getElementById('fallback-logo').style.display='flex';" />
              <div id="fallback-logo" style="display: none; align-items: center; gap: 0.6rem;">
                <div class="logo-icon">AT</div>
                <h1 class="logo-text">AT FABRICS</h1>
              </div>
            </div>
            <div class="receipt-title-container">
              <h2 class="receipt-title">Greige Fabric Receiving Receipt</h2>
              <p class="receipt-subtitle">Received Date: ${todayDate}</p>
            </div>
          </div>
          
          ${sectionsHtml}
          
          <div class="summary-box">
            <h3 class="summary-title">📈 Consolidated Transaction Summary</h3>
            <table class="summary-table">
              <thead>
                <tr>
                  <th style="text-align: left;">Weaving Order Form</th>
                  <th style="text-align: center; width: 150px;">Rolls Received</th>
                  <th style="text-align: right; width: 180px;">Total Qty (m)</th>
                </tr>
              </thead>
              <tbody>
                ${summaryRows}
              </tbody>
            </table>
            
            <div class="summary-card-container">
              <div class="summary-card">
                <strong>Grand Total Rolls Received</strong>
                <span>${overallTotalRolls} Rolls</span>
              </div>
              <div class="summary-card">
                <strong>Grand Total Quantity Received</strong>
                <span>${overallTotalQty.toLocaleString()} Meters</span>
              </div>
            </div>
          </div>
          
          <div class="footer-sigs">
            <div class="sig-line">Inspected & Received By</div>
            <div class="sig-line">Job Work Representative</div>
            <div class="sig-line">Authorized Signatory</div>
          </div>

          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
        </html>
      `);
      win.document.close();
    } catch (err) {
      console.error('Error opening GFRR print window:', err);
      alert('Failed to print GFRR: ' + err.message);
    }
  };

  const handleReprintGfrrReceipt = (clickedGfrrNo, clickedRolls, currentWv) => {
    try {
      const sampleRoll = clickedRolls[0];
      if (!sampleRoll || !sampleRoll.received_at) {
        // Fallback to printing just this order's rolls if no timestamp exists
        const printData = [{
          weaving_number: currentWv.weaving_number,
          gfrr_no: clickedGfrrNo,
          partner_name: currentWv.partner_name || (currentWv.weaving_type === 'in_house' ? 'In-House Loom Shed' : 'Job Work Partner'),
          machine_name: currentWv.machine_name || 'Job Work Loom',
          order_number: currentWv.order?.order_number || '—',
          design_no: currentWv.order?.design_no || currentWv.design_no || '—',
          design_name: currentWv.order?.design_name || '—',
          rolls: clickedRolls.map(r => ({ id: r.id, qty: r.qty })),
          received_at: sampleRoll?.received_at
        }];
        handlePrintGfrrReceipt(printData);
        return;
      }

      const targetTime = new Date(sampleRoll.received_at).getTime();
      const matchedRollsByOrder = {};

      // Search all weaving orders for rolls received at the same time
      weavingOrders.forEach(wo => {
        const rolls = wo.fabric_rolls || [];
        rolls.forEach(r => {
          if ((r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing') && r.received_at && r.gfrr_no) {
            const rTime = new Date(r.received_at).getTime();
            // If received within 5 seconds of the target time
            if (Math.abs(rTime - targetTime) < 5000) {
              if (!matchedRollsByOrder[wo.id]) {
                matchedRollsByOrder[wo.id] = {
                  weavingOrder: wo,
                  gfrr_no: r.gfrr_no, // Use the actual GFRR number stored on the roll
                  rolls: []
                };
              }
              matchedRollsByOrder[wo.id].rolls.push(r);
            }
          }
        });
      });

      const printData = Object.values(matchedRollsByOrder).map(group => {
        const wo = group.weavingOrder;
        return {
          weaving_number: wo.weaving_number,
          gfrr_no: group.gfrr_no,
          partner_name: wo.partner_name || (wo.weaving_type === 'in_house' ? 'In-House Loom Shed' : 'Job Work Partner'),
          machine_name: wo.machine_name || 'Job Work Loom',
          order_number: wo.order?.order_number || '—',
          design_no: wo.order?.design_no || wo.design_no || '—',
          design_name: wo.order?.design_name || '—',
          rolls: group.rolls.map(r => ({ id: r.id, qty: r.qty })),
          received_at: group.rolls[0]?.received_at
        };
      });

      handlePrintGfrrReceipt(printData);
    } catch (err) {
      console.error('Error reprinting GFRR:', err);
      alert('Failed to reprint GFRR: ' + err.message);
    }
  };

  const fetchWeavingOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('weaving_orders')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name, total_quantity, yarn_requirements, technical_specs)
        `)
        .order('created_at', { ascending: false });

      if (!error) {
        setWeavingOrders(data || []);
        if (data && data.length > 0) {
          const { data: delData, error: delError } = await supabase
            .from('dyed_yarn_delivery_items')
            .select(`
              id,
              production_form_id,
              yarn_count_id,
              quantity_kg,
              colour,
              lot_number,
              process_type,
              delivery:dyed_yarn_deliveries(
                id,
                dydr_number,
                delivered_date,
                delivered_by,
                vehicle_no,
                remarks
              )
            `)
            .in('production_form_id', data.map(w => w.id));
          if (!delError) {
            setDeliveries(delData || []);
          }
        } else {
          setDeliveries([]);
        }
      } else {
        console.error('Error fetching Weaving Orders:', error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchYarnCounts = async () => {
    const { data } = await supabase.from('master_yarn_counts').select('*');
    setYarnCounts(data || []);
  };

  const fetchInHouseMachines = async () => {
    try {
      const { data: deptData } = await supabase
        .from('master_departments')
        .select('id')
        .ilike('department_name', '%weaving%');
        
      const weavingDeptIds = (deptData || []).map(d => d.id);
      
      let machineData = [];
      if (weavingDeptIds.length > 0) {
        const { data } = await supabase
          .from('master_machines')
          .select('*, master_departments(department_name)')
          .in('department_id', weavingDeptIds)
          .eq('scope', 'in_house');
        machineData = data || [];
      }
      
      if (machineData.length === 0) {
        const { data } = await supabase
          .from('master_machines')
          .select('*, master_departments(department_name)')
          .eq('scope', 'in_house');
        machineData = data || [];
      }
      setInHouseMachines(machineData);
    } catch (err) {
      console.error('Error fetching in-house weaving machines:', err);
    }
  };

  const fetchWeavingWorkers = async () => {
    try {
      const { data: deptData } = await supabase
        .from('master_departments')
        .select('id')
        .ilike('department_name', '%weaving%');
        
      const weavingDeptIds = (deptData || []).map(d => d.id);
      
      if (weavingDeptIds.length > 0) {
        const { data: workersData } = await supabase
          .from('master_workers')
          .select('*')
          .in('department_id', weavingDeptIds)
          .order('worker_name', { ascending: true });
        setWeavingWorkers(workersData || []);
      }
    } catch (err) {
      console.error('Error fetching weaving workers:', err);
    }
  };

  const fetchPartners = async () => {
    try {
      const { data } = await supabase
        .from('master_partners')
        .select('*')
        .ilike('partner_type', '%weaving%');
      setPartners(data || []);
    } catch (err) {
      console.error('Error fetching partners:', err);
    }
  };

  useEffect(() => {
    fetchWeavingOrders();
    fetchYarnCounts();
    fetchInHouseMachines();
    fetchWeavingWorkers();
    fetchPartners();
  }, []);

  const handleToggleExpand = (wvofId) => {
    if (expandedWvofId === wvofId) {
      setExpandedWvofId(null);
    } else {
      setExpandedWvofId(wvofId);
    }
  };

  // Load Weaving Machine/Partner options for editing modal
  useEffect(() => {
    if (!editWvof) return;

    const loadWeavingOptions = async () => {
      setLoadingEditModalData(true);
      try {
        if (editWeavingType === 'in_house') {
          // Fetch weaving department machines
          const { data: deptData } = await supabase
            .from('master_departments')
            .select('id')
            .ilike('department_name', '%weaving%');
            
          const weavingDeptIds = (deptData || []).map(d => d.id);
          
          let machineData = [];
          if (weavingDeptIds.length > 0) {
            const { data } = await supabase
              .from('master_machines')
              .select('*, master_departments(department_name)')
              .in('department_id', weavingDeptIds)
              .eq('scope', 'in_house');
            machineData = data || [];
          }
          
          if (machineData.length === 0) {
            const { data } = await supabase
              .from('master_machines')
              .select('*, master_departments(department_name)')
              .eq('scope', 'in_house');
            machineData = data || [];
          }
          setMachines(machineData);
          setPartners([]);
        } else {
          // Job Work
          const { data: partnerData } = await supabase
            .from('master_partners')
            .select('*')
            .ilike('partner_type', '%weaving%');
          setPartners(partnerData || []);
          
          if (editPartnerId) {
            const { data: machineData } = await supabase
              .from('master_machines')
              .select('*')
              .eq('scope', 'job_work')
              .eq('partner_id', editPartnerId);
            setMachines(machineData || []);
          } else {
            setMachines([]);
          }
        }
      } catch (err) {
        console.error('Error loading weaving edit options:', err);
      } finally {
        setLoadingEditModalData(false);
      }
    };

    loadWeavingOptions();
  }, [editWvof, editWeavingType, editPartnerId]);

  // Handle building weft allotments when edit modal is opened
  const handleOpenEdit = async (order) => {
    setEditWvof(order);
    setEditWeavingType(order.weaving_type || 'in_house');
    setEditPartnerId(order.partner_id || '');
    setEditMachineId(order.machine_id || '');
    setEditStartDate(order.start_date || '');
    setEditEndDate(order.end_date || '');
    setEditQty(order.qty ? order.qty.toString() : '');
    setEditStatus(order.status || 'pending');
    setEditBeamNumber(order.beam_number || '');
    setEditPlannedProduction(order.planned_daily_production || []);
    setEditError('');

    // Load weft yarn requirements for the linked order
    const linkedOrder = order.order;
    if (linkedOrder && linkedOrder.yarn_requirements) {
      const weftRequirements = (linkedOrder.yarn_requirements || []).filter(y => y.type === 'weft');
      
      // Fetch all weaving orders for this order to compute already allotted weft quantities
      const { data: otherWeavings } = await supabase
        .from('weaving_orders')
        .select('id, weft_allotments')
        .eq('order_id', linkedOrder.id)
        .neq('id', order.id);

      const builtAllotments = weftRequirements.map(req => {
        const countId = req.countId || req.count_id || '';
        const colour = req.color || req.colour || '';
        
        // Sum up quantities from other orders' weft_allotments matching count & colour
        const alreadyAllotted = (otherWeavings || []).reduce((sum, w) => {
          const match = (w.weft_allotments || []).find(
            a => (a.countId === countId || a.yarn_count_id === countId || a.count_id === countId || a.countValue === req.countValue) && a.colour === colour
          );
          return sum + parseFloat(match?.allotted_qty || 0);
        }, 0);

        // Find current order form's weft_allotment value if exists
        const currentMatch = (order.weft_allotments || []).find(
          a => (a.countId === countId || a.yarn_count_id === countId || a.count_id === countId || a.countValue === req.countValue) && a.colour === colour
        );

        return {
          countId,
          countValue: req.countValue || '',
          colour,
          required_qty: parseFloat(req.kg || 0),
          already_allotted: alreadyAllotted,
          allotted_qty: currentMatch?.allotted_qty ? currentMatch.allotted_qty.toString() : ''
        };
      });
      setWeftAllotments(builtAllotments);
    } else {
      setWeftAllotments([]);
    }
  };

  const handleEditSubmit = async () => {
    setEditSubmitting(true);
    setEditError('');
    try {
      const selectedMachine = machines.find(m => m.id === editMachineId);
      const selectedPartner = partners.find(p => p.id === editPartnerId);

      // Validate dates
      if (!editStartDate || !editEndDate) {
        throw new Error('Please select both start and end dates.');
      }
      
      // Validate quantities
      const numericQty = parseFloat(editQty);
      if (isNaN(numericQty) || numericQty <= 0) {
        throw new Error('Please enter a valid quantity.');
      }

      // Validate daily production plans
      const totalPlanned = editPlannedProduction.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0);
      if (editPlannedProduction.some(p => p.qty === '' || isNaN(parseFloat(p.qty)) || parseFloat(p.qty) < 0)) {
        throw new Error('Please enter a valid planned quantity for every date.');
      }
      if (Math.abs(totalPlanned - numericQty) > 0.01) {
        throw new Error(`The sum of daily planned production (${totalPlanned.toLocaleString()} Mtrs) must match the total weaving quantity (${numericQty.toLocaleString()} Mtrs) exactly.`);
      }

      // Sequence Number updates dynamically if allocation fields change for Job Work or if type switched
      let finalWeavingNumber = editWvof.weaving_number;
      
      const allocationChanged = 
        editWeavingType !== editWvof.weaving_type ||
        editPartnerId !== (editWvof.partner_id || '') ||
        editMachineId !== (editWvof.machine_id || '');

      if (allocationChanged) {
        const [generatedNo] = await generateWeavingNumbersBulk(
          editWeavingType,
          selectedPartner?.partner_name || null,
          selectedMachine?.machine_name || null,
          editWvof.order?.order_number || '',
          1
        );
        if (generatedNo) {
          finalWeavingNumber = generatedNo;
        }
      }

      const updates = {
        weaving_number: finalWeavingNumber,
        weaving_type: editWeavingType,
        machine_id: editMachineId || null,
        machine_name: selectedMachine?.machine_name || null,
        partner_id: editPartnerId || null,
        partner_name: selectedPartner?.partner_name || null,
        start_date: editStartDate,
        end_date: editEndDate,
        qty: numericQty,
        beam_number: editBeamNumber || null,
        planned_daily_production: editPlannedProduction.map(p => ({
          date: p.date,
          qty: parseFloat(p.qty) || 0
        })),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('weaving_orders')
        .update(updates)
        .eq('id', editWvof.id);

      if (error) throw error;

      setEditWvof(null);
      await fetchWeavingOrders();
    } catch (err) {
      setEditError(err.message || 'Failed to update Weaving Order Form.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleUpdateStatus = async (orderId, currentStatus, newStatus, plannedEndDate) => {
    try {
      if (newStatus === 'on_process' && currentStatus !== 'stopped') {
        const wvofObj = weavingOrders.find(w => w.id === orderId);
        if (wvofObj) {
          const weftBadge = getWeftYarnStatus(wvofObj, deliveries);
          const hasDydr = deliveries.some(d => d.production_form_id === orderId);
          if (!(weftBadge.label === 'Partially Delivered' || weftBadge.label === 'Delivered') || !hasDydr) {
            alert('Cannot start loom: Weft yarn must be partially/fully delivered (at least one DYDR is required).');
            return;
          }
        }
      }

      let finalStatus = newStatus;
      const updates = {
        updated_at: new Date().toISOString()
      };
      
      if (newStatus === 'on_process') {
        updates.process_started_at = new Date().toISOString();
      }
      
      if (newStatus === 'completed') {
        const todayStr = new Date().toISOString().split('T')[0];
        const isLate = plannedEndDate && todayStr > plannedEndDate;
        finalStatus = isLate ? 'late_complete' : 'completed';
        updates.process_completed_at = new Date().toISOString();
      }

      updates.status = finalStatus;

      const { error } = await supabase
        .from('weaving_orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;
      await fetchWeavingOrders();
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update status: ' + err.message);
    }
  };

  const openCompleteWvofForm = async (wvof) => {
    setSavingCompleteWvof(true);
    setShowCompleteWvofForm(wvof);
    setCompleteWvofDate(new Date().toISOString().slice(0, 16));
    try {
      // Fetch dyed yarn delivery items for this weaving order form
      const { data: dydi, error: delError } = await supabase
        .from('dyed_yarn_delivery_items')
        .select(`
          id,
          yarn_count_id,
          colour,
          lot_number,
          quantity_kg,
          yarn_count:master_yarn_counts(count_value, material, product_type)
        `)
        .eq('production_form_id', wvof.id);

      if (delError) throw delError;

      // Group delivered weft yarn items colour, count and lot wise
      const groupedDelivered = {};
      (dydi || []).forEach(item => {
        const key = `${item.colour || ''}_${item.yarn_count_id || ''}_${item.lot_number || ''}`;
        if (!groupedDelivered[key]) {
          const countDisplay = item.yarn_count
            ? `${item.yarn_count.count_value} ${item.yarn_count.material} ${item.yarn_count.product_type}`
            : '—';
          groupedDelivered[key] = {
            colour: item.colour || '—',
            yarn_count_id: item.yarn_count_id,
            count_display: countDisplay,
            lot_number: item.lot_number || '—',
            quantity_received: 0,
            quantity_returned: '0'
          };
        }
        groupedDelivered[key].quantity_received += parseFloat(item.quantity_kg || 0);
      });

      setWeftYarnReturns(Object.values(groupedDelivered));
    } catch (err) {
      console.error('Error loading complete form data:', err);
      alert('Failed to load complete form data: ' + err.message);
    } finally {
      setSavingCompleteWvof(false);
    }
  };

  const handleCompleteWvofProcess = async () => {
    if (!completeWvofDate) {
      alert('Please select the completion date and time');
      return;
    }
    const actualEndStr = completeWvofDate.slice(0, 10);
    const plannedEndDate = showCompleteWvofForm.end_date;
    const isLate = plannedEndDate && actualEndStr > plannedEndDate;
    const finalStatus = isLate ? 'late_complete' : 'completed';

    // Validate returns
    for (let i = 0; i < weftYarnReturns.length; i++) {
      const ret = weftYarnReturns[i];
      const retQty = parseFloat(ret.quantity_returned || 0);
      if (isNaN(retQty) || retQty < 0) {
        alert(`Please enter a valid return quantity for Colour ${ret.colour}, Lot ${ret.lot_number}`);
        return;
      }
      if (retQty > ret.quantity_received) {
        alert(`Return quantity (${retQty} kg) cannot exceed delivered quantity (${ret.quantity_received} kg) for Colour ${ret.colour}, Lot ${ret.lot_number}`);
        return;
      }
    }

    setSavingCompleteWvof(true);
    try {
      const wvof = showCompleteWvofForm;
      const wvofdcNumber = (wvof.weaving_number || 'WVOF') + '/DC';

      const updates = {
        status: finalStatus,
        process_completed_at: new Date(completeWvofDate).toISOString(),
        yarn_returns: weftYarnReturns.map(r => ({
          colour: r.colour,
          yarn_count_id: r.yarn_count_id,
          count_display: r.count_display,
          lot_number: r.lot_number,
          quantity_received: r.quantity_received,
          quantity_returned: parseFloat(r.quantity_returned || 0)
        })),
        wvofdc_number: wvofdcNumber,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('weaving_orders')
        .update(updates)
        .eq('id', wvof.id);

      if (error) throw error;

      setShowCompleteWvofForm(null);
      await fetchWeavingOrders();

      const updatedWvof = {
        ...wvof,
        ...updates
      };
      
      // Update selectedWvof if open
      if (selectedWvof && selectedWvof.id === wvof.id) {
        setSelectedWvof(updatedWvof);
      }

      setPrintWvofdc(updatedWvof);
    } catch (err) {
      console.error('Error completing weaving process:', err);
      alert('Failed to complete weaving process: ' + err.message);
    } finally {
      setSavingCompleteWvof(false);
    }
  };

  const handleSaveProductionRound = async (wvof) => {
    if (wvof.status === 'completed' || wvof.status === 'late_complete') {
      alert('Production is already completed. No further production rounds can be recorded.');
      return;
    }
    const isJobWork = wvof.weaving_type === 'job_work';
    if (!isJobWork && !roundWeaver.trim()) {
      alert('Please enter a Weaver Name.');
      return;
    }
    if (!roundQty || isNaN(parseFloat(roundQty)) || parseFloat(roundQty) <= 0) {
      alert('Please enter a valid Produced Quantity greater than 0.');
      return;
    }
    if (!roundDateTime) {
      alert('Please select a Date & Time.');
      return;
    }

    setRecordingRound(true);
    try {
      const newLog = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2, 9)),
        timestamp: new Date(roundDateTime).toISOString(),
        weaver: isJobWork ? 'Job Work' : roundWeaver.trim(),
        qty: parseFloat(roundQty)
      };

      const currentLogs = Array.isArray(wvof.production_logs) ? wvof.production_logs : [];
      const updatedLogs = [...currentLogs, newLog];

      const { error } = await supabase
        .from('weaving_orders')
        .update({ production_logs: updatedLogs })
        .eq('id', wvof.id);

      if (error) throw error;

      // Reset inputs
      setRoundWeaver('');
      setRoundQty('');
      // Re-initialize time to now
      const now = new Date();
      const tzoffset = now.getTimezoneOffset() * 60000;
      setRoundDateTime((new Date(now - tzoffset)).toISOString().slice(0, 16));

      // Refresh list
      await fetchWeavingOrders();
      
      // Update selectedWvof state if open in modal
      if (selectedWvof && selectedWvof.id === wvof.id) {
        setSelectedWvof(prev => ({ ...prev, production_logs: updatedLogs }));
      }
    } catch (err) {
      console.error('Error saving production round:', err);
      alert('Failed to save production round: ' + err.message);
    } finally {
      setRecordingRound(false);
    }
  };

  const handleOpenAllot = (wvof) => {
    setAllotWvof(wvof);
    setAllotRows([]);
    setAllotError('');
    setAllotStartDate(wvof.start_date || '');
    setAllotEndDate(wvof.end_date || '');

    // Load existing planned production or generate from dates
    const existing = wvof.planned_daily_production || [];
    if (existing.length > 0) {
      setAllotPlannedProduction(existing.map(p => ({
        date: p.date,
        qty: p.qty !== undefined ? p.qty.toString() : ''
      })));
    } else if (wvof.start_date && wvof.end_date) {
      const dates = getDatesInRange(wvof.start_date, wvof.end_date);
      setAllotPlannedProduction(dates.map(dt => ({
        date: dt,
        qty: ''
      })));
    } else {
      setAllotPlannedProduction([]);
    }

    loadAllotData(wvof);
  };

  const loadAllotData = async (wvof) => {
    setLoadingAllotData(true);
    setAllotError('');
    try {
      // 1. Fetch dyed yarn receipts for this order
      const { data: receipts, error: recErr } = await supabase
        .from('dyed_yarn_receipt_items')
        .select(`
          *,
          receipt:dyed_yarn_receipts(dof_id, dof_number),
          location:master_locations(location_name)
        `)
        .eq('order_id', wvof.order_id);

      if (recErr) throw recErr;

      // 2. Fetch dyed yarn deliveries already made for this order
      const { data: deliveries, error: delErr } = await supabase
        .from('dyed_yarn_delivery_items')
        .select(`
          yarn_count_id, colour, lot_number, location_id, quantity_kg, production_form_id
        `)
        .eq('order_id', wvof.order_id);

      if (delErr) throw delErr;

      // Fetch all existing warping and weaving forms for this order to filter out orphaned deliveries
      const [{ data: activeWarping }, { data: activeWeaving }] = await Promise.all([
        supabase.from('warping_order_forms').select('id').eq('order_id', wvof.order_id),
        supabase.from('weaving_orders').select('id').eq('order_id', wvof.order_id)
      ]);

      const activeFormIds = new Set([
        ...(activeWarping || []).map(w => w.id),
        ...(activeWeaving || []).map(w => w.id)
      ]);

      const validDeliveries = (deliveries || []).filter(d => 
        !d.production_form_id || activeFormIds.has(d.production_form_id)
      );

      // 3. Summarize stock in hand grouped by count, colour, lot, and location
      const stockMap = {};
      receipts?.forEach(r => {
        const key = `${r.yarn_count_id}|${r.colour}|${r.lot_number || ''}|${r.location_id || ''}`;
        if (!stockMap[key]) {
          stockMap[key] = {
            yarn_count_id: r.yarn_count_id,
            colour: r.colour,
            lot_number: r.lot_number || '—',
            location_id: r.location_id,
            location_name: r.location?.location_name || '—',
            available: 0
          };
        }
        stockMap[key].available += parseFloat(r.quantity_kg || 0);
      });

      validDeliveries?.forEach(d => {
        const key = `${d.yarn_count_id}|${d.colour}|${d.lot_number || ''}|${d.location_id || ''}`;
        if (stockMap[key]) {
          stockMap[key].available -= parseFloat(d.quantity_kg || 0);
        }
      });

      // Fetch all weaving orders allotments for this order
      const { data: allWeavings, error: allErr } = await supabase
        .from('weaving_orders')
        .select('id, weft_allotments')
        .eq('order_id', wvof.order_id);

      if (allErr) throw allErr;

      // Map allotments from other weaving orders and current weaving order
      const otherAllotmentsMap = {};
      const currentAllotmentsMap = {};

      allWeavings?.forEach(w => {
        w.weft_allotments?.forEach(a => {
          const key = `${a.yarn_count_id || a.countId}|${a.colour}|${a.lot_number || ''}|${a.location_id || ''}`;
          const qty = parseFloat(a.allotted_qty || 0);
          if (w.id === wvof.id) {
            currentAllotmentsMap[key] = (currentAllotmentsMap[key] || 0) + qty;
          } else {
            otherAllotmentsMap[key] = (otherAllotmentsMap[key] || 0) + qty;
          }
        });
      });

      // Now build the list of weft requirements for this order
      const requirements = (wvof.order?.yarn_requirements || []).filter(y => y.type === 'weft');

      const builtRows = [];
      requirements.forEach(req => {
        const countId = req.countId || req.count_id;
        const colour = req.color || req.colour;
        const requiredQty = parseFloat(req.kg || 0);

        // Fetch display text for this count
        const yc = yarnCounts.find(y => y.id === countId);
        const countValueDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (req.countValue || req.count_value || '—');

        // Identify all unique lot & location keys that have stock or allotments for this count & colour
        const keys = new Set();
        Object.keys(stockMap).forEach(k => {
          const s = stockMap[k];
          if (s.yarn_count_id === countId && s.colour === colour) {
            keys.add(k);
          }
        });

        // Add keys from other allotments matching this count & colour
        allWeavings?.forEach(w => {
          w.weft_allotments?.forEach(a => {
            const aCountId = a.yarn_count_id || a.countId;
            if (aCountId === countId && a.colour === colour) {
              const key = `${countId}|${colour}|${a.lot_number || ''}|${a.location_id || ''}`;
              keys.add(key);
            }
          });
        });

        const currentAllotments = wvof.weft_allotments || [];

        if (keys.size > 0) {
          keys.forEach(key => {
            const parts = key.split('|');
            const lot = parts[2] || '—';
            const locId = parts[3] || null;

            const warehouseStock = stockMap[key]?.available || 0;
            const otherAllotted = otherAllotmentsMap[key] || 0;
            
            // Find existing allotment in current order form
            const currentMatch = currentAllotments.find(a => 
              (a.yarn_count_id === countId || a.countId === countId) &&
              a.colour === colour &&
              (a.lot_number || '') === (lot === '—' ? '' : lot) &&
              (a.location_id || '') === (locId || '')
            );

            builtRows.push({
              yarn_count_id: countId,
              countValue: countValueDisplay,
              colour: colour,
              required_qty: requiredQty,
              lot_number: lot,
              location_id: locId,
              location_name: stockMap[key]?.location_name || (currentMatch?.location_name || '—'),
              available_qty: warehouseStock,
              other_allotted: otherAllotted,
              allotted_qty: currentMatch ? currentMatch.allotted_qty.toString() : ''
            });
          });
        } else {
          // No stock in warehouse and no prior allotments
          builtRows.push({
            yarn_count_id: countId,
            countValue: countValueDisplay,
            colour: colour,
            required_qty: requiredQty,
            lot_number: '—',
            location_id: null,
            location_name: 'No stock in warehouse',
            available_qty: 0,
            other_allotted: 0,
            allotted_qty: ''
          });
        }
      });

      setAllotRows(builtRows);
    } catch (err) {
      console.error('Error loading allotment stock details:', err);
      setAllotError('Failed to load dyed yarn stock details.');
    } finally {
      setLoadingAllotData(false);
    }
  };

  const handleAllotSubmit = async () => {
    setAllotSubmitting(true);
    setAllotError('');
    try {
      // Validate start/end dates
      if (!allotStartDate || !allotEndDate) {
        throw new Error('Please select both start and end dates.');
      }

      // Validate daily production plans
      const totalPlanned = allotPlannedProduction.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0);
      if (allotPlannedProduction.some(p => p.qty === '' || isNaN(parseFloat(p.qty)) || parseFloat(p.qty) < 0)) {
        throw new Error('Please enter a valid planned quantity for every date.');
      }

      const orderQty = parseFloat(allotWvof.qty) || 0;
      if (Math.abs(totalPlanned - orderQty) > 0.01) {
        throw new Error(`The sum of daily planned production (${totalPlanned.toLocaleString()} Mtrs) must match the total weaving quantity (${orderQty.toLocaleString()} Mtrs) exactly.`);
      }

      // Filter rows that have an entered quantity greater than 0
      const allotmentsToSave = allotRows
        .filter(r => r.allotted_qty && parseFloat(r.allotted_qty) > 0)
        .map(r => ({
          countId: r.yarn_count_id,
          yarn_count_id: r.yarn_count_id,
          countValue: r.countValue,
          colour: r.colour,
          required_qty: r.required_qty,
          lot_number: r.lot_number !== '—' ? r.lot_number : null,
          location_id: r.location_id,
          location_name: r.location_name,
          allotted_qty: parseFloat(r.allotted_qty)
        }));

      // Keep status as is if it is already partially delivered or delivered
      const nextStatus = ['weft_yarn_partially_delivered', 'weft_yarn_delivered'].includes(allotWvof.status)
        ? allotWvof.status
        : 'weft_yarn_allotted';

      const plannedProductionToSave = allotPlannedProduction.map(p => ({
        date: p.date,
        qty: parseFloat(p.qty) || 0
      }));

      const { error } = await supabase
        .from('weaving_orders')
        .update({
          weft_allotments: allotmentsToSave,
          start_date: allotStartDate,
          end_date: allotEndDate,
          planned_daily_production: plannedProductionToSave,
          status: nextStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', allotWvof.id);

      if (error) throw error;

      setAllotWvof(null);
      await fetchWeavingOrders();
    } catch (err) {
      setAllotError(err.message || 'Failed to save Dyed Yarn Allotment.');
    } finally {
      setAllotSubmitting(false);
    }
  };

  // 1. WVOF Dropdown options
  const wvofOptions = useMemo(() => {
    const matching = weavingOrders.filter(w => {
      const matchDesign = selectedDesigns.length === 0 || selectedDesigns.includes(`${w.order?.design_no || '—'} / ${w.order?.design_name || '—'}`);
      const matchMachine = selectedMachines.length === 0 || selectedMachines.includes(w.weaving_type === 'in_house' ? (w.machine_name || '—') : (w.partner_name || '—'));
      const matchType = w.weaving_type === activeTypeTab;
      return matchDesign && matchMachine && matchType;
    });
    return Array.from(new Set(matching.map(w => w.weaving_number).filter(Boolean))).sort();
  }, [weavingOrders, selectedDesigns, selectedMachines, activeTypeTab]);

  // 2. Design Options
  const designOptions = useMemo(() => {
    const matching = weavingOrders.filter(w => {
      const matchWvof = selectedWvofs.length === 0 || selectedWvofs.includes(w.weaving_number);
      const matchMachine = selectedMachines.length === 0 || selectedMachines.includes(w.weaving_type === 'in_house' ? (w.machine_name || '—') : (w.partner_name || '—'));
      const matchType = w.weaving_type === activeTypeTab;
      return matchWvof && matchMachine && matchType;
    });
    return Array.from(new Set(matching.map(w => `${w.order?.design_no || '—'} / ${w.order?.design_name || '—'}`))).sort();
  }, [weavingOrders, selectedWvofs, selectedMachines, activeTypeTab]);

  // 3. Machine Options
  const machineOptions = useMemo(() => {
    const matching = weavingOrders.filter(w => {
      const matchWvof = selectedWvofs.length === 0 || selectedWvofs.includes(w.weaving_number);
      const matchDesign = selectedDesigns.length === 0 || selectedDesigns.includes(`${w.order?.design_no || '—'} / ${w.order?.design_name || '—'}`);
      const matchType = w.weaving_type === activeTypeTab;
      return matchWvof && matchDesign && matchType;
    });
    return Array.from(new Set(matching.map(w => w.weaving_type === 'in_house' ? (w.machine_name || '—') : (w.partner_name || '—')).filter(Boolean))).sort();
  }, [weavingOrders, selectedWvofs, selectedDesigns, activeTypeTab]);

  const baseFiltered = useMemo(() => {
    return weavingOrders.filter(w => {
      const matchSearch = !searchText ||
        w.weaving_number?.toLowerCase().includes(searchText.toLowerCase()) ||
        w.order?.order_number?.toLowerCase().includes(searchText.toLowerCase()) ||
        w.sof_number?.toLowerCase().includes(searchText.toLowerCase()) ||
        w.wof_number?.toLowerCase().includes(searchText.toLowerCase());

      const matchWvof = selectedWvofs.length === 0 || selectedWvofs.includes(w.weaving_number);
      const matchDesign = selectedDesigns.length === 0 || selectedDesigns.includes(`${w.order?.design_no || '—'} / ${w.order?.design_name || '—'}`);
      const matchMachine = selectedMachines.length === 0 || selectedMachines.includes(w.weaving_type === 'in_house' ? (w.machine_name || '—') : (w.partner_name || '—'));
      const matchType = w.weaving_type === activeTypeTab;

      return matchSearch && matchWvof && matchDesign && matchMachine && matchType;
    });
  }, [weavingOrders, searchText, selectedWvofs, selectedDesigns, selectedMachines, activeTypeTab]);

  const filtered = useMemo(() => {
    return baseFiltered.filter(w => statusFilter === 'all' || w.status === statusFilter);
  }, [baseFiltered, statusFilter]);

  const counts = useMemo(() => {
    const res = { all: baseFiltered.length };
    STATUS_OPTIONS.slice(1).forEach(s => {
      res[s] = baseFiltered.filter(w => w.status === s).length;
    });
    return res;
  }, [baseFiltered]);

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

  const slideWindow = (direction) => {
    const d = new Date(windowStart);
    d.setDate(d.getDate() + direction * 7);
    setWindowStart(d);
  };

  const goToToday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    d.setHours(0, 0, 0, 0);
    setWindowStart(d);
  };

  const toggleMachine = (machineId) => {
    setExpandedMachines(prev => ({
      ...prev,
      [machineId]: !prev[machineId]
    }));
  };

  const displayedLooms = useMemo(() => {
    if (currentTab === 'job_work' || currentTab === 'in_house_list') return [];
    return getLooms(inHouseMachines, currentTab);
  }, [inHouseMachines, currentTab]);

  const wofsByMachine = useMemo(() => {
    const map = {};
    displayedLooms.forEach(m => {
      const wofs = getOrdersForMachine(m, weavingOrders);
      // Sort so that earlier start dates appear first (ascending)
      wofs.sort((a, b) => {
        const dateA = a.start_date || '9999-12-31';
        const dateB = b.start_date || '9999-12-31';
        return dateA.localeCompare(dateB);
      });
      map[m.id] = wofs;
    });
    return map;
  }, [displayedLooms, weavingOrders]);

  const togglePartner = (partnerId) => {
    setExpandedPartners(prev => ({
      ...prev,
      [partnerId]: !prev[partnerId]
    }));
  };

  const displayedPartners = useMemo(() => {
    if (currentTab !== 'job_work') return [];
    
    const jobWofs = filtered.filter(w => w.weaving_type === 'job_work');
    const uniquePartnerNames = Array.from(new Set(jobWofs.map(w => w.partner_name).filter(Boolean)));
    
    const list = uniquePartnerNames.map((name, idx) => {
      const matchedPartner = partners.find(p => p.partner_name === name);
      return {
        id: matchedPartner?.id || `temp-partner-${idx}`,
        partner_name: name,
        is_mock: !matchedPartner
      };
    });
    
    const unassignedWofs = jobWofs.filter(w => !w.partner_name);
    if (unassignedWofs.length > 0) {
      list.push({
        id: 'unassigned-partner',
        partner_name: 'Unassigned Partners',
        is_unassigned: true
      });
    }
    
    list.sort((a, b) => {
      if (a.is_unassigned) return 1;
      if (b.is_unassigned) return -1;
      return a.partner_name.localeCompare(b.partner_name);
    });
    
    return list;
  }, [filtered, partners, currentTab]);

  const wofsByPartner = useMemo(() => {
    const map = {};
    if (currentTab !== 'job_work') return map;
    
    const jobWofs = filtered.filter(w => w.weaving_type === 'job_work');
    
    displayedPartners.forEach(p => {
      let wofs;
      if (p.is_unassigned) {
        wofs = jobWofs.filter(w => !w.partner_name);
      } else {
        wofs = jobWofs.filter(w => w.partner_name === p.partner_name);
      }
      
      wofs.sort((a, b) => {
        const dateA = a.start_date || '9999-12-31';
        const dateB = b.start_date || '9999-12-31';
        return dateA.localeCompare(dateB);
      });
      map[p.id] = wofs;
    });
    return map;
  }, [displayedPartners, filtered, currentTab]);

  useEffect(() => {
    if (currentTab === 'job_work') {
      setActiveTypeTab('job_work');
    } else {
      setActiveTypeTab('in_house');
    }
  }, [currentTab]);  const actionBtnOutline = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.25rem',
    padding: '4px 6px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-current)',
    borderRadius: '6px',
    color: '#800000',
    fontWeight: '700',
    fontSize: '0.68rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
    width: '100%',
    minHeight: '28px',
    boxSizing: 'border-box',
    textAlign: 'center'
  };

  const actionBtnSolid = (bg, color = 'white', isDisabled = false) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.25rem',
    padding: '4px 6px',
    backgroundColor: isDisabled ? '#cbd5e1' : bg,
    border: isDisabled ? '1px solid #cbd5e1' : `1px solid ${bg}`,
    borderRadius: '6px',
    color: isDisabled ? '#64748b' : color,
    fontWeight: '700',
    fontSize: '0.68rem',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
    width: '100%',
    minHeight: '28px',
    boxSizing: 'border-box',
    textAlign: 'center'
  });

  return (
    <div style={{ width: '100%', padding: '1.5rem', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => navigate('/production')}
          style={{ background: 'none', border: 'none', color: '#800000', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', padding: 0, marginBottom: '0.75rem' }}
        >
          <ArrowLeft size={15} /> Back to Production
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg,#800000,#4d0000)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} color="white" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-current)' }}>Weaving Order Forms</h1>
              <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>{weavingOrders.length} total weaving orders</p>
            </div>
          </div>
          <button onClick={fetchWeavingOrders} style={{ background: 'none', border: '1px solid var(--border-current)', borderRadius: '8px', padding: '0.5rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Type Tabs: Airjet / Rapier / Job Work */}
      {isProductionView ? (
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border-current)', marginBottom: '1.5rem', gap: '2rem' }}>
          <button
            onClick={() => {
              setCurrentTab('in_house_list');
            }}
            style={{
              padding: '0.75rem 0.5rem',
              background: 'none',
              border: 'none',
              borderBottom: currentTab === 'in_house_list' ? '3px solid #800000' : '3px solid transparent',
              color: currentTab === 'in_house_list' ? '#800000' : 'var(--text-muted-current)',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            In-House Weaving ({weavingOrders.filter(w => w.weaving_type === 'in_house').length})
          </button>
          <button
            onClick={() => {
              setCurrentTab('job_work');
              setSelectedWvofs([]);
              setSelectedDesigns([]);
              setSelectedMachines([]);
              setSearchText('');
              setStatusFilter('all');
            }}
            style={{
              padding: '0.75rem 0.5rem',
              background: 'none',
              border: 'none',
              borderBottom: currentTab === 'job_work' ? '3px solid #800000' : '3px solid transparent',
              color: currentTab === 'job_work' ? '#800000' : 'var(--text-muted-current)',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            Job Work Weaving ({weavingOrders.filter(w => w.weaving_type === 'job_work').length})
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border-current)', marginBottom: '1.5rem', gap: '2rem' }}>
          <button
            onClick={() => {
              setCurrentTab('airjet');
            }}
            style={{
              padding: '0.75rem 0.5rem',
              background: 'none',
              border: 'none',
              borderBottom: currentTab === 'airjet' ? '3px solid #800000' : '3px solid transparent',
              color: currentTab === 'airjet' ? '#800000' : 'var(--text-muted-current)',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            Airjet Looms ({getLooms(inHouseMachines, 'airjet').length})
          </button>
          <button
            onClick={() => {
              setCurrentTab('rapier');
            }}
            style={{
              padding: '0.75rem 0.5rem',
              background: 'none',
              border: 'none',
              borderBottom: currentTab === 'rapier' ? '3px solid #800000' : '3px solid transparent',
              color: currentTab === 'rapier' ? '#800000' : 'var(--text-muted-current)',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            Rapier Looms ({getLooms(inHouseMachines, 'rapier').length})
          </button>
          <button
            onClick={() => {
              setCurrentTab('job_work');
              setSelectedWvofs([]);
              setSelectedDesigns([]);
              setSelectedMachines([]);
              setSearchText('');
              setStatusFilter('all');
            }}
            style={{
              padding: '0.75rem 0.5rem',
              background: 'none',
              border: 'none',
              borderBottom: currentTab === 'job_work' ? '3px solid #800000' : '3px solid transparent',
              color: currentTab === 'job_work' ? '#800000' : 'var(--text-muted-current)',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            Job Work ({weavingOrders.filter(w => w.weaving_type === 'job_work').length})
          </button>
        </div>
      )}
      {((currentTab === 'job_work') || currentTab === 'in_house_list') && (
        <>
          {/* Status Filter Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '0.35rem 1rem',
                  borderRadius: '20px',
                  border: `1.5px solid ${statusFilter === s ? '#800000' : 'var(--border-current)'}`,
                  background: statusFilter === s ? '#800000' : 'var(--surface-current)',
                  color: statusFilter === s ? 'white' : 'var(--text-muted-current)',
                  fontWeight: '700',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ')} ({counts[s] ?? 0})
              </button>
            ))}
          </div>

          {/* Search & Advanced Filters Button & View Mode Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)' }} />
              <input
                type="text"
                placeholder="Search WVOF, order, sizing, warping reference..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '0.75rem', paddingTop: '0.6rem', paddingBottom: '0.6rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', background: 'var(--surface-current)', color: 'var(--text-current)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {currentTab === 'job_work' && (
                <div style={{ display: 'inline-flex', padding: '3px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                  <button
                    onClick={() => setJobWorkViewMode('gantt')}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: jobWorkViewMode === 'gantt' ? '#800000' : 'transparent',
                      color: jobWorkViewMode === 'gantt' ? 'white' : 'var(--text-muted-current)',
                      fontWeight: '700',
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    📊 Gantt Chart
                  </button>
                  <button
                    onClick={() => setJobWorkViewMode('list')}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: jobWorkViewMode === 'list' ? '#800000' : 'transparent',
                      color: jobWorkViewMode === 'list' ? 'white' : 'var(--text-muted-current)',
                      fontWeight: '700',
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    📝 Order List
                  </button>
                </div>
              )}

              <button 
                onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  padding: '0.6rem 1.25rem', 
                  border: '1px solid var(--border-current)', 
                  borderRadius: '8px', 
                  background: isFilterExpanded ? 'rgba(128,0,0,0.08)' : 'var(--surface-current)', 
                  color: '#800000', 
                  fontWeight: '700', 
                  fontSize: '0.85rem', 
                  cursor: 'pointer' 
                }}
              >
                <SlidersHorizontal size={15} />
                Advanced Filters
                {isFilterExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>
          </div>

          {/* Expandable Advanced Filters Panel */}
          {isFilterExpanded && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '1rem', 
              padding: '1.25rem', 
              backgroundColor: '#fff', 
              border: '1px solid var(--border-current)', 
              borderRadius: '8px', 
              marginBottom: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <MultiSelectDropdown 
                label="WVOF Number" 
                options={wvofOptions} 
                selectedValues={selectedWvofs} 
                onChange={setSelectedWvofs} 
                placeholder="All WVOFs"
              />
              <MultiSelectDropdown 
                label="Design (No / Name)" 
                options={designOptions} 
                selectedValues={selectedDesigns} 
                onChange={setSelectedDesigns} 
                placeholder="All Designs"
              />
              <MultiSelectDropdown 
                label="Allocation / Machine" 
                options={machineOptions} 
                selectedValues={selectedMachines} 
                onChange={setSelectedMachines} 
                placeholder="All Machines"
              />
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  onClick={() => {
                    setSelectedWvofs([]);
                    setSelectedDesigns([]);
                    setSelectedMachines([]);
                  }}
                  style={{ 
                    padding: '0.4rem 1rem', 
                    fontSize: '0.8rem', 
                    fontWeight: '700', 
                    color: '#64748b', 
                    background: 'none', 
                    border: '1px solid #cbd5e1', 
                    borderRadius: '6px', 
                    cursor: 'pointer' 
                  }}
                >
                  Reset Filters
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {((currentTab === 'job_work' && jobWorkViewMode === 'list') || currentTab === 'in_house_list') ? (
        <>
          {/* Table */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: 'var(--text-muted-current)', gap: '0.75rem' }}>
              <Loader size={20} className="spin" /> Loading weaving order forms…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--surface-current)', borderRadius: '12px', border: '1px dashed var(--border-current)' }}>
              <Package size={48} style={{ color: 'var(--text-muted-current)', opacity: 0.3, marginBottom: '1rem' }} />
              <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-muted-current)' }}>No weaving order forms found</h3>
              <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>Forward sizing/warping beams to weaving to populate this portal.</p>
            </div>
          ) : (
            <div style={{ borderRadius: '12px', border: '1px solid var(--border-current)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '2px solid var(--border-current)', textAlign: 'left' }}>
                    <th style={{ width: '40px', padding: '0.65rem 0.5rem' }}></th>
                    {[
                      { name: 'WVOF & Status', minWidth: '130px' },
                      { name: 'Order & Design', minWidth: '150px' },
                      { name: 'Allocation / Scope', minWidth: '140px' },
                      { name: 'Qty (Mtrs)', minWidth: '85px' },
                      { name: 'Timeline', minWidth: '95px' },
                      { name: 'Actions', minWidth: '200px' }
                    ].map(col => (
                      <th key={col.name} style={{ padding: '0.65rem 0.5rem', fontWeight: '800', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted-current)', whiteSpace: 'nowrap', minWidth: col.minWidth }}>{col.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((wvof, idx) => {
                    const badge = getWvofStatusBadge(wvof);
                    const isExpanded = expandedWvofId === wvof.id;
                    
                    return (
                      <React.Fragment key={wvof.id}>
                        <tr
                          onClick={() => handleToggleExpand(wvof.id)}
                          style={{
                            borderBottom: '1px solid var(--border-current)',
                            backgroundColor: idx % 2 === 0 ? 'var(--surface-current)' : 'transparent',
                            transition: 'background-color 0.2s',
                            cursor: 'pointer'
                          }}
                        >
                          <td onClick={e => { e.stopPropagation(); handleToggleExpand(wvof.id); }} style={{ textAlign: 'center', padding: '0.65rem 0.5rem' }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '700', color: '#800000', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                {wvof.weaving_number}
                              </span>
                              <span style={{ 
                                backgroundColor: badge.bg, 
                                color: badge.color, 
                                border: `1px solid ${badge.border}`, 
                                padding: '2px 8px', 
                                borderRadius: '12px', 
                                fontSize: '0.68rem', 
                                fontWeight: '800', 
                                whiteSpace: 'nowrap' 
                              }}>
                                {badge.label}
                              </span>
                              {(() => {
                                const weftBadge = getWeftYarnStatus(wvof, deliveries);
                                return (
                                  <span style={{ 
                                    backgroundColor: weftBadge.bg, 
                                    color: weftBadge.color, 
                                    border: `1px solid ${weftBadge.border}`, 
                                    padding: '2px 8px', 
                                    borderRadius: '12px', 
                                    fontSize: '0.68rem', 
                                    fontWeight: '800', 
                                    whiteSpace: 'nowrap' 
                                  }}>
                                    Weft: {weftBadge.label}
                                  </span>
                                );
                              })()}
                            </div>
                            {wvof.sof_number ? (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', fontFamily: 'monospace', fontWeight: '600', marginTop: '4px' }}>Sizing Ref: {wvof.sof_number}</div>
                            ) : (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', fontFamily: 'monospace', fontWeight: '600', marginTop: '4px' }}>Warping Ref: {wvof.wof_number}</div>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <div style={{ fontWeight: '600', fontSize: '0.8rem' }}>{wvof.order?.order_number || '—'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                              {wvof.order?.design_no || wvof.design_no} {wvof.order?.design_name ? `/ ${wvof.order.design_name}` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                              <span style={{ backgroundColor: wvof.weaving_type === 'in_house' ? 'rgba(128,0,0,0.08)' : 'rgba(14,165,233,0.08)', color: wvof.weaving_type === 'in_house' ? '#800000' : '#0284c7', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '700' }}>
                                {wvof.weaving_type === 'in_house' ? 'In-House' : 'Job Work'}
                              </span>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
                                {wvof.partner_name ? (
                                  <div>
                                    <div style={{ fontWeight: '700', color: 'var(--text-current)' }}>{wvof.partner_name}</div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: '500' }}>{wvof.machine_name || 'Loom Unassigned'}</div>
                                  </div>
                                ) : wvof.machine_name ? (
                                   <span style={{ fontWeight: '700', color: 'var(--text-current)' }}>{wvof.machine_name}</span>
                                ) : (
                                  <span style={{ color: '#d97706', fontStyle: 'italic', fontWeight: '600', fontSize: '0.75rem' }}>⚠️ Loom Unassigned</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{Number(wvof.qty).toLocaleString()} m</div>
                            {(() => {
                              const totalProduced = (wvof.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
                              const totalGreige = (wvof.fabric_rolls || [])
                                .filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing')
                                .reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0);
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                                  {totalProduced > 0 && (
                                    <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: '700' }}>
                                      Prod: {totalProduced.toLocaleString()} m
                                    </div>
                                  )}
                                  <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: '700' }}>
                                    Greige Recd: {totalGreige.toLocaleString()} m
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: '600' }}>{wvof.start_date || '—'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>to {wvof.end_date || '—'}</div>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem' }} onClick={e => e.stopPropagation()}>
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(2, 1fr)', 
                              gap: '0.35rem', 
                              width: '180px',
                              boxSizing: 'border-box'
                            }}>
                              <button
                                onClick={() => setPrintWvof(wvof)}
                                style={actionBtnOutline}
                              >
                                <Eye size={12} /> View
                              </button>
                              {!['completed', 'late_completed', 'late_complete'].includes(wvof.status) && (
                              <button
                                onClick={() => handleOpenEdit(wvof)}
                                style={actionBtnOutline}
                              >
                                <Settings size={12} /> Edit
                              </button>
                              )}

                              {['pending', 'weft_yarn_allotted', 'weft_yarn_partially_delivered', 'weft_yarn_delivered'].includes(wvof.status) && (
                                <button
                                  onClick={() => handleOpenAllot(wvof)}
                                  style={actionBtnSolid('#800000')}
                                >
                                  Allot Yarn
                                </button>
                              )}

                              {(() => {
                                if (!['pending', 'weft_yarn_allotted', 'weft_yarn_partially_delivered', 'weft_yarn_delivered', 'stopped'].includes(wvof.status)) return null;
                                const weftBadge = getWeftYarnStatus(wvof, deliveries);
                                const hasDydr = deliveries.some(d => d.production_form_id === wvof.id);
                                const canStart = (weftBadge.label === 'Partially Delivered' || weftBadge.label === 'Delivered') && hasDydr;
                                const isDisabled = wvof.status !== 'stopped' && !canStart;

                                return (
                                  <button
                                    disabled={isDisabled}
                                    onClick={() => handleUpdateStatus(wvof.id, wvof.status, 'on_process', wvof.end_date)}
                                    title={isDisabled ? "Cannot start loom: Weft yarn must be partially/fully delivered (at least one DYDR is required)." : ""}
                                    style={actionBtnSolid('#800000', 'white', isDisabled)}
                                  >
                                    {wvof.status === 'stopped' ? 'Resume' : 'Start Loom'}
                                  </button>
                                );
                              })()}

                              {wvof.status === 'on_process' && (
                                <button
                                  onClick={() => openCompleteWvofForm(wvof)}
                                  style={actionBtnSolid('#4d0000')}
                                >
                                  Complete
                                </button>
                              )}
                              
                              {wvof.status === 'on_process' && (
                                <button
                                  onClick={() => handleUpdateStatus(wvof.id, 'on_process', 'stopped')}
                                  style={actionBtnSolid('#64748b')}
                                >
                                  Stop
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ backgroundColor: '#fff' }}>
                            <td colSpan={7} style={{ padding: '1.5rem', borderLeft: '3px solid #800000' }}>
                              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-current)', marginBottom: '1.25rem', gap: '1rem' }}>
                                {!isProductionView && (
                                  <button
                                    onClick={() => setActiveDetailTab('production_record')}
                                    disabled={!wvof.process_started_at}
                                    style={{
                                      padding: '0.5rem 1rem', border: 'none', background: 'none',
                                      color: !wvof.process_started_at 
                                        ? 'var(--text-muted-current)' 
                                        : (activeDetailTab === 'production_record' ? '#800000' : 'var(--text-muted-current)'),
                                      borderBottom: activeDetailTab === 'production_record' && wvof.process_started_at ? '2.5px solid #800000' : '2.5px solid transparent',
                                      fontWeight: '700', fontSize: '0.825rem',
                                      cursor: wvof.process_started_at ? 'pointer' : 'not-allowed',
                                      opacity: wvof.process_started_at ? 1 : 0.5
                                    }}
                                    title={!wvof.process_started_at ? "Please start the loom first" : ""}
                                  >
                                    Record Production
                                  </button>
                                )}
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

                              {!isProductionView && activeDetailTab === 'production_record' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                  <div style={{ backgroundColor: 'var(--surface-current)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-current)' }}>
                                    <h6 style={{ margin: '0 0 1rem', fontSize: '0.82rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                      Record Production Round
                                    </h6>
                                    {['completed', 'late_complete'].includes(wvof.status) ? (
                                      <div style={{
                                        backgroundColor: 'rgba(16,185,129,0.06)',
                                        border: '1px solid rgba(16,185,129,0.2)',
                                        borderRadius: '10px',
                                        padding: '1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        color: '#047857'
                                      }}>
                                        <CheckCircle size={18} style={{ flexShrink: 0 }} />
                                        <span style={{ fontSize: '0.825rem', fontWeight: '600' }}>
                                          Production completed. No further production rounds can be recorded.
                                        </span>
                                      </div>
                                    ) : (
                                      <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                          <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '750', marginBottom: '0.35rem', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Date & Time</label>
                                            <input
                                              type="datetime-local"
                                              value={roundDateTime}
                                              onChange={e => setRoundDateTime(e.target.value)}
                                              style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                            />
                                          </div>
                                          {wvof.weaving_type !== 'job_work' ? (
                                            <div>
                                              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '750', marginBottom: '0.35rem', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Weaver Name</label>
                                              <select
                                                value={roundWeaver}
                                                onChange={e => setRoundWeaver(e.target.value)}
                                                style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                              >
                                                <option value="">Select Weaver...</option>
                                                {weavingWorkers.map(w => (
                                                  <option key={w.id} value={w.worker_name}>{w.worker_name}</option>
                                                ))}
                                              </select>
                                            </div>
                                          ) : (
                                            <div>
                                              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '750', marginBottom: '0.35rem', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Weaver Name</label>
                                              <input
                                                type="text"
                                                value="N/A (Job Work)"
                                                disabled
                                                style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', backgroundColor: '#f1f5f9', color: '#64748b', boxSizing: 'border-box', cursor: 'not-allowed' }}
                                              />
                                            </div>
                                          )}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '1rem', alignItems: 'flex-end' }}>
                                          <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '750', marginBottom: '0.35rem', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Now Produced (Mtrs)</label>
                                            <input
                                              type="number"
                                              step="any"
                                              placeholder="Meters produced"
                                              value={roundQty}
                                              onChange={e => setRoundQty(e.target.value)}
                                              style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                            />
                                          </div>
                                          <button
                                            onClick={() => handleSaveProductionRound(wvof)}
                                            disabled={recordingRound}
                                            style={{ padding: '0.45rem 1rem', backgroundColor: '#800000', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
                                          >
                                            {recordingRound ? 'Saving...' : 'Record'}
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>

                                  <div>
                                    <h6 style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                      Logged Production History ({((wvof.production_logs) || []).length} rounds)
                                    </h6>
                                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                        <thead>
                                          <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                            <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Date & Time</th>
                                            <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Weaver</th>
                                            <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Produced Qty (Mtrs)</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {!wvof.production_logs || wvof.production_logs.length === 0 ? (
                                            <tr>
                                              <td colSpan="3" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                                No production rounds recorded yet.
                                              </td>
                                            </tr>
                                          ) : (
                                            [...wvof.production_logs]
                                              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                                              .map((log, lIdx) => (
                                                <tr key={log.id || lIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                                    {new Date(log.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                  </td>
                                                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>{log.weaver}</td>
                                                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{Number(log.qty).toLocaleString()} m</td>
                                                </tr>
                                              ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              )}

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
                                              
                                              // Deliveries matching this allotment count/colour on this WVOF
                                              const matchingDel = deliveries.filter(d => 
                                                d.production_form_id === wvof.id && 
                                                d.colour === allot.colour && 
                                                (d.yarn_count_id === allot.countId || d.yarn_count_id === allot.yarn_count_id)
                                              );
                                              const deliveredQty = matchingDel.reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);
                                              const balance = Math.max(0, parseFloat(allot.allotted_qty || allot.qty || 0) - deliveredQty);

                                              return (
                                                <tr key={aIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', color: 'var(--color-primary)' }}>{allot.colour || '—'}</td>
                                                  <td style={{ padding: '0.6rem 0.75rem' }}>{countDisplay}</td>
                                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#800000', textAlign: 'right' }}>{parseFloat(allot.allotted_qty || allot.qty || 0).toFixed(2)}</td>
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
                                    {deliveries.filter(d => d.production_form_id === wvof.id).length === 0 ? (
                                      <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                                        No DYDR delivery receipts have been created for this weaving order form yet.
                                      </p>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {(() => {
                                          const formDydis = deliveries.filter(d => d.production_form_id === wvof.id);
                                          const uniqueDydrs = {};
                                          formDydis.forEach(item => {
                                            if (item.delivery) {
                                              uniqueDydrs[item.delivery.id] = item.delivery;
                                            }
                                          });
                                          const uniqueDydrList = Object.values(uniqueDydrs);
                                          if (uniqueDydrList.length === 0) {
                                            const totalFormDelivered = formDydis.reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);
                                            return (
                                              <div style={{
                                                padding: '0.6rem 1rem',
                                                backgroundColor: '#f8fafc',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                fontSize: '0.78rem'
                                              }}>
                                                <span style={{ fontWeight: '850', color: '#1e293b' }}>Total Delivered Qty</span>
                                                <span style={{ fontWeight: '700', color: '#047857' }}>{totalFormDelivered.toFixed(2)} kg</span>
                                              </div>
                                            );
                                          }
                                          return uniqueDydrList.map((del, dIdx) => {
                                            const weight = formDydis.filter(item => item.delivery?.id === del.id).reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);
                                            return (
                                              <div 
                                                key={dIdx} 
                                                onClick={() => {
                                                  const items = formDydis.filter(item => item.delivery?.id === del.id);
                                                  setSelectedDydr({
                                                    ...del,
                                                    weaving: wvof,
                                                    items: items.map(it => ({
                                                      ...it,
                                                      orders: wvof.order
                                                    }))
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
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', width: '100%', marginBottom: '1.5rem' }}>
                                    <div>
                                      <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Design Details</span>
                                      <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>
                                        {wvof.order?.design_no || wvof.design_no} {wvof.order?.design_name ? `/ ${wvof.order.design_name}` : ''}
                                      </span>
                                    </div>
                                    <div>
                                      <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Weaving Unit / Loom Partner</span>
                                      <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>
                                        {wvof.partner_name || (wvof.weaving_type === 'in_house' ? 'In-House Loom Shed' : 'Not Assigned')}
                                      </span>
                                    </div>
                                    <div>
                                      <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Loom Allocation</span>
                                      <span style={{ fontSize: '0.9rem', fontWeight: '700', color: wvof.machine_name ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                        {wvof.machine_name || 'Not Assigned'}
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
                                        {wvof.start_date || '—'}
                                      </span>
                                    </div>
                                    <div>
                                      <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Planned End Date</span>
                                      <span style={{ fontSize: '0.9rem', fontWeight: '700', color: wvof.end_date ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                        {wvof.end_date || '—'}
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
                                  <div>
                                    <h6 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                      Daily Production Schedule & Logs
                                    </h6>
                                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                        <thead>
                                          <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                            <th style={{ width: '40px', padding: '0.6rem 0.5rem' }}></th>
                                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Date</th>
                                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Planned Production (Mtrs)</th>
                                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Daily Production (Mtrs)</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(() => {
                                            let totalPlannedSum = 0;
                                            let totalActualSum = 0;
                                            
                                            const unifiedDates = getUnifiedProductionDates(wvof);
                                            const rows = [];
                                            
                                            if (unifiedDates.length === 0) {
                                              return (
                                                <tr>
                                                  <td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                                    No production log entries found.
                                                  </td>
                                                </tr>
                                              );
                                            }

                                            unifiedDates.forEach((dateStr) => {
                                              const d = new Date(dateStr + 'T00:00:00');
                                              const formattedDate = !isNaN(d.getTime()) 
                                                ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                : dateStr;
                                                
                                              const plannedObj = (wvof.planned_daily_production || []).find(p => p.date === dateStr);
                                              const plannedQty = plannedObj ? parseFloat(plannedObj.qty) || 0 : 0;
                                              
                                              const actualLogs = (wvof.production_logs || []).filter(log => getLocalDateOnly(log.timestamp) === dateStr);
                                              const sumActual = actualLogs.reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
                                              
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
                                                  style={{ borderBottom: '1px solid var(--border-current)', cursor: 'pointer', backgroundColor: isDateExpanded ? '#fbf7f7' : 'transparent', transition: 'background-color 0.15s' }}
                                                >
                                                  <td style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>
                                                    {isDateExpanded ? <ChevronDown size={12} style={{ color: '#800000' }} /> : <ChevronRight size={12} />}
                                                  </td>
                                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>{formattedDate}</td>
                                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#800000', textAlign: 'right' }}>{plannedQty > 0 ? `${plannedQty.toLocaleString()} m` : '—'}</td>
                                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{sumActual > 0 ? `${sumActual.toLocaleString()} m` : '—'}</td>
                                                </tr>
                                              );
                                              
                                              if (isDateExpanded) {
                                                rows.push(
                                                  <tr key={`details-${dateStr}`} style={{ backgroundColor: '#fffdfd', borderBottom: '1px solid var(--border-current)' }}>
                                                    <td colSpan="4" style={{ padding: '0.75rem 1.5rem 0.75rem 2.5rem' }}>
                                                      <div style={{ border: '1px solid #fecdd3', borderRadius: '6px', overflow: 'hidden' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                                                          <thead>
                                                            <tr style={{ backgroundColor: '#ffe4e6', borderBottom: '1px solid #fecdd3', textAlign: 'left' }}>
                                                              <th style={{ padding: '0.4rem 0.6rem', fontWeight: '700', color: '#be123c' }}>Time</th>
                                                              <th style={{ padding: '0.4rem 0.6rem', fontWeight: '700', color: '#be123c' }}>Weaver Name</th>
                                                              <th style={{ padding: '0.4rem 0.6rem', fontWeight: '700', color: '#be123c', textAlign: 'right' }}>Qty Produced (Mtrs)</th>
                                                            </tr>
                                                          </thead>
                                                          <tbody>
                                                            {actualLogs.length === 0 ? (
                                                              <tr>
                                                                <td colSpan="3" style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                                                  No production records.
                                                                </td>
                                                              </tr>
                                                            ) : (
                                                              actualLogs.map((log, lIdx) => (
                                                                <tr key={log.id || lIdx} style={{ borderBottom: lIdx !== actualLogs.length - 1 ? '1px solid #fecdd3' : 'none' }}>
                                                                  <td style={{ padding: '0.4rem 0.6rem', fontWeight: '500' }}>
                                                                    {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                  </td>
                                                                  <td style={{ padding: '0.4rem 0.6rem', fontWeight: '600' }}>{log.weaver}</td>
                                                                  <td style={{ padding: '0.4rem 0.6rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{Number(log.qty).toLocaleString()} m</td>
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
                                            
                                            // Add total row at the end
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

                                    {/* Greige Fabric / GFRR Section placed below Daily Production Schedule & Logs */}
                                    {wvof.weaving_type === 'in_house' ? (
                                      <div style={{ marginTop: '1.5rem' }}>
                                        <h6 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                          Greige Fabric Rolls
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
                                                        No received greige fabric rolls found for this order.
                                                      </td>
                                                    </tr>
                                                  );
                                                }
                                                return rolls
                                                  .sort((a, b) => new Date(b.received_at || 0) - new Date(a.received_at || 0))
                                                  .map((roll, rIdx) => (
                                                    <tr key={roll.id || rIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                      <td style={{ padding: '0.6rem 0.75rem' }}>
                                                        {roll.received_at ? new Date(roll.received_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                      </td>
                                                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', fontFamily: 'monospace' }}>{roll.id}</td>
                                                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{Number(roll.qty).toLocaleString()} m</td>
                                                    </tr>
                                                  ));
                                              })()}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
                                        <div>
                                          <h6 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Greige Fabric Receiving Receipts (GFRR) - Fabric Rolls
                                          </h6>
                                          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                              <thead>
                                                <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                                  <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Received Date & Time</th>
                                                  <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Greige Fabric Roll Number</th>
                                                  <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty (Mtrs)</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {(() => {
                                                  const rolls = (wvof.fabric_rolls || []).filter(r => r.gfrr_no);
                                                  if (rolls.length === 0) {
                                                    return (
                                                      <tr>
                                                        <td colSpan="3" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                                          No received greige fabric rolls with GFRR found for this order.
                                                        </td>
                                                      </tr>
                                                    );
                                                  }
                                                  return rolls
                                                    .sort((a, b) => new Date(b.received_at || 0) - new Date(a.received_at || 0))
                                                    .map((roll, rIdx) => (
                                                      <tr key={roll.id || rIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                        <td style={{ padding: '0.6rem 0.75rem' }}>
                                                          {roll.received_at ? new Date(roll.received_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                        </td>
                                                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', fontFamily: 'monospace' }}>{roll.id}</td>
                                                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{Number(roll.qty).toLocaleString()} m</td>
                                                      </tr>
                                                    ));
                                                })()}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>

                                        {(() => {
                                          const gfrrGroups = {};
                                          (wvof.fabric_rolls || []).forEach(roll => {
                                            if (roll.gfrr_no) {
                                              if (!gfrrGroups[roll.gfrr_no]) {
                                                gfrrGroups[roll.gfrr_no] = [];
                                              }
                                              gfrrGroups[roll.gfrr_no].push(roll);
                                            }
                                          });

                                          const gfrrNos = Object.keys(gfrrGroups);
                                          if (gfrrNos.length === 0) return null;

                                          return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                                              <h6 style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Associated GFRR Receipts
                                              </h6>
                                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                                                {gfrrNos.map(gfrrNo => {
                                                  const rolls = gfrrGroups[gfrrNo];
                                                  const totalQty = rolls.reduce((sum, r) => sum + Number(r.qty || 0), 0);
                                                  const rawDate = rolls.find(r => r.received_at)?.received_at;
                                                  const formattedDate = rawDate ? new Date(rawDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                                                  return (
                                                    <div 
                                                      key={gfrrNo} 
                                                      onClick={() => handleReprintGfrrReceipt(gfrrNo, rolls, wvof)}
                                                      style={{ 
                                                        display: 'flex', 
                                                        flexDirection: 'column',
                                                        gap: '0.5rem', 
                                                        backgroundColor: 'var(--surface-current)', 
                                                        padding: '1rem', 
                                                        borderRadius: '10px', 
                                                        border: '1px solid var(--border-current)', 
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        boxShadow: 'var(--shadow-sm)'
                                                      }}
                                                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#800000'; e.currentTarget.style.boxShadow = '0 6px 12px -2px rgba(0,0,0,0.08)'; }}
                                                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-current)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                                                    >
                                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receipt</span>
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>Date: {formattedDate}</span>
                                                      </div>
                                                      <div style={{ fontFamily: 'monospace', fontWeight: '800', color: '#800000', fontSize: '0.825rem', wordBreak: 'break-all' }}>
                                                        {gfrrNo}
                                                      </div>
                                                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-current)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                                                        <span style={{ fontWeight: '700', fontSize: '0.78rem', color: 'var(--text-current)' }}>{rolls.length} Rolls Received</span>
                                                        <span style={{ fontWeight: '800', color: '#047857', fontSize: '0.825rem' }}>{totalQty.toLocaleString()} m</span>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </div>
                              )}

                              {activeDetailTab === 'delivery_receipt' && (
                                <PrintableWVOFDC
                                  wvof={wvof}
                                  order={wvof.order}
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
        </>
      ) : (
        <>
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
            display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap',
            fontSize: '0.72rem', fontWeight: '700', padding: '0.5rem 1rem',
            backgroundColor: 'var(--surface-current)', borderRadius: '8px', border: '1px solid var(--border-current)'
          }}>
            {['pending', 'weft_yarn_allotted', 'weft_yarn_partially_delivered', 'weft_yarn_delivered', 'on_process', 'completed', 'stopped'].map(s => {
              const c = getStatusColorForWeaving(s);
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
            marginBottom: '2rem'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: `${LABEL_COL_WIDTH + (DAY_COL_WIDTH * TOTAL_DAYS)}px` }}>

                {/* Header: Month Row */}
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
                    {currentTab === 'job_work' ? '🏢 Partner Name' : '⚙️ Loom Machine'}
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

                {/* Header: Day Row */}
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

                {/* Rows: Machine or Partner depending on Tab */}
                {currentTab === 'job_work' ? (
                  displayedPartners.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
                      <AlertCircle size={24} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
                      No weaving partners found.
                    </div>
                  ) : (
                    displayedPartners.map(partner => {
                      const isExpanded = expandedPartners[partner.id];
                      const partnerWofs = wofsByPartner[partner.id] || [];

                      return (
                        <div key={partner.id} style={{ borderBottom: '1px solid var(--border-current)' }}>
                          {/* Partner Header Row */}
                          <div
                            onClick={() => togglePartner(partner.id)}
                            style={{
                              display: 'flex',
                              cursor: 'pointer',
                              backgroundColor: isExpanded ? '#fdf8f7' : '#fafafa',
                              transition: 'background-color 0.15s'
                            }}
                          >
                            {/* Partner label */}
                            <div style={{
                              width: `${LABEL_COL_WIDTH}px`, minWidth: `${LABEL_COL_WIDTH}px`,
                              padding: '0.65rem 1rem',
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              borderRight: '1px solid var(--border-current)',
                              fontWeight: '700', fontSize: '0.82rem',
                              color: 'var(--text-current)',
                              boxSizing: 'border-box'
                            }}>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <span>🏢</span>
                              <div style={{ flex: 1 }}>
                                <div>{partner.partner_name}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', fontWeight: '600', marginTop: '1px' }}>
                                  Weaving Partner
                                </div>
                              </div>
                              <span style={{
                                backgroundColor: partnerWofs.length > 0 ? 'rgba(128,0,0,0.1)' : '#f1f5f9',
                                color: partnerWofs.length > 0 ? '#800000' : '#94a3b8',
                                padding: '2px 8px', borderRadius: '12px',
                                fontSize: '0.65rem', fontWeight: '800'
                              }}>
                                {partnerWofs.length} Form{partnerWofs.length !== 1 ? 's' : ''}
                              </span>
                            </div>

                            {/* Aggregated Gantt bars for the partner row */}
                            {(() => {
                              const { itemLanes, totalLanes } = allocateLanes(partnerWofs);
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
                                  {/* Overlay bars for each WO */}
                                  {partnerWofs.map(wof => {
                                    const bar = calcBarPosition(wof, days);
                                    if (!bar) return null;
                                    const laneIdx = itemLanes[wof.id] || 0;
                                    return (
                                      <GanttBar
                                        key={wof.id}
                                        wof={wof}
                                        bar={bar}
                                        compact
                                        onWofClick={(w) => setSelectedWvof(w)}
                                        topOffset={`${6 + laneIdx * LANE_HEIGHT}px`}
                                        customHeight={`${LANE_HEIGHT - 6}px`}
                                        deliveries={deliveries}
                                      />
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Expanded Partner Rows: Show Planned vs Actual scheduling bars */}
                          {isExpanded && (
                            <div style={{ borderTop: '1px solid #f1f5f9' }}>
                              {partnerWofs.length === 0 ? (
                                <div style={{
                                  padding: '1rem 2rem',
                                  color: 'var(--text-muted-current)',
                                  fontSize: '0.75rem',
                                  fontStyle: 'italic',
                                  borderLeft: '3px solid #800000',
                                  backgroundColor: '#fff'
                                }}>
                                  No orders scheduled for {partner.partner_name} in this time range.
                                </div>
                              ) : (
                                partnerWofs.map(wof => {
                                  const sc = getWvofStatusBadge(wof);
                                  const todayStr = getLocalDateString(new Date());

                                  return (
                                    <div key={wof.id} style={{
                                      display: 'flex',
                                      borderBottom: '1px solid #f3f3f3',
                                      backgroundColor: '#fff',
                                      transition: 'background-color 0.15s',
                                      minHeight: '60px'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef7f5'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                                    >
                                      {/* Partner order detail label */}
                                      <div
                                        onClick={() => setSelectedWvof(wof)}
                                        style={{
                                          width: `${LABEL_COL_WIDTH}px`, minWidth: `${LABEL_COL_WIDTH}px`,
                                          padding: '0.55rem 1rem 0.55rem 2.25rem',
                                          borderRight: '1px solid var(--border-current)',
                                          borderLeft: '3px solid #800000',
                                          fontSize: '0.75rem',
                                          cursor: 'pointer',
                                          boxSizing: 'border-box'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                                          <span style={{
                                            fontWeight: '800', color: '#800000',
                                            fontFamily: 'monospace', fontSize: '0.72rem'
                                          }}>
                                            {wof.weaving_number}
                                          </span>
                                          <span style={{
                                            backgroundColor: sc.bg, color: sc.color,
                                            border: `1px solid ${sc.border}`,
                                            padding: '1px 6px', borderRadius: '10px',
                                            fontSize: '0.55rem', fontWeight: '800'
                                          }}>
                                            {sc.label}
                                          </span>
                                          {(() => {
                                            const weftBadge = getWeftYarnStatus(wof, deliveries);
                                            return (
                                              <span style={{
                                                backgroundColor: weftBadge.bg, color: weftBadge.color,
                                                border: `1px solid ${weftBadge.border}`,
                                                padding: '1px 6px', borderRadius: '10px',
                                                fontSize: '0.55rem', fontWeight: '800'
                                              }}>
                                                Weft: {weftBadge.label}
                                              </span>
                                            );
                                          })()}
                                        </div>
                                        <div style={{ color: 'var(--text-muted-current)', fontSize: '0.68rem', lineHeight: '1.45' }}>
                                          <span style={{ fontWeight: '600' }}>Order:</span> {wof.order?.order_number || '—'}
                                          {' · '}
                                          <span style={{ fontWeight: '600' }}>Design:</span> {wof.order?.design_no || '—'}
                                        </div>
                                        {(() => {
                                          const totalProduced = (wof.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
                                          return (
                                            <div style={{ color: '#800000', fontWeight: '750', fontSize: '0.68rem', marginTop: '1px', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                              <span>Qty: {wof.qty ? `${Number(wof.qty).toLocaleString()} m` : '—'}</span>
                                              <span style={{ color: '#047857' }}>Prod Qty: {totalProduced.toLocaleString()} m</span>
                                            </div>
                                          );
                                        })()}
                                      </div>

                                      {/* Partner order Gantt bar planned/actual */}
                                      <div style={{ display: 'flex', position: 'relative', flex: 1, minHeight: '60px' }}>
                                        {days.map((d, i) => (
                                          <div key={i} style={{
                                            width: `${DAY_COL_WIDTH}px`, minWidth: `${DAY_COL_WIDTH}px`,
                                            borderRight: '1px solid #fafafa',
                                            backgroundColor: isToday(d) ? 'rgba(128,0,0,0.03)' : d.getDay() === 0 ? '#fefcfc' : 'transparent'
                                          }} />
                                        ))}
                                        {(() => {
                                          // 1. Planned Bar
                                          const plannedBar = calcBarPositionForDates(wof.start_date, wof.end_date, days);
                                          const pBg = '#fef9c3';
                                          const pBorder = '#eab308';
                                          const pText = '#854d0e';

                                          // 2. Actual Bar
                                          const showActual = !!wof.process_started_at || wof.status === 'on_process' || wof.status === 'completed' || wof.status === 'late_complete';
                                          let actualBar = null;
                                          let aBg = '';
                                          let aBorder = '';
                                          let aText = '';

                                          if (showActual) {
                                            const actualStartStr = getLocalDateString(wof.process_started_at) || wof.start_date || todayStr;
                                            const actualEndStr = ['completed', 'late_complete'].includes(wof.status)
                                              ? (getLocalDateString(wof.process_completed_at) || getLocalDateString(wof.updated_at) || todayStr)
                                              : todayStr;

                                            actualBar = calcBarPositionForDates(actualStartStr, actualEndStr, days);
                                            
                                            const statusVal = resolveWvofStatusValue(wof);
                                            if (statusVal === 'completed') {
                                              aBg = '#dcfce7';
                                              aBorder = '#22c55e';
                                              aText = '#166534';
                                            } else if (statusVal === 'late_complete' || statusVal === 'late' || statusVal === 'start_date_exceeded') {
                                              aBg = '#fee2e2';
                                              aBorder = '#ef4444';
                                              aText = '#b91c1c';
                                            } else {
                                              aBg = '#dbeafe';
                                              aBorder = '#3b82f6';
                                              aText = '#1d4ed8';
                                            }
                                          }

                                          return (
                                            <>
                                              {plannedBar && (
                                                <GanttBar
                                                  key={`${wof.id}-planned`}
                                                  wof={wof}
                                                  bar={plannedBar}
                                                  onWofClick={(w) => setSelectedWvof(w)}
                                                  customBg={pBg}
                                                  customBorder={pBorder}
                                                  customTextColor={pText}
                                                  customLabel={`${wof.weaving_number} (Plan)`}
                                                  topOffset="6px"
                                                  customHeight="20px"
                                                  tooltipType="planned"
                                                  deliveries={deliveries}
                                                />
                                              )}
                                              {showActual && actualBar && (
                                                <GanttBar
                                                  key={`${wof.id}-actual`}
                                                  wof={wof}
                                                  bar={actualBar}
                                                  onWofClick={(w) => setSelectedWvof(w)}
                                                  customBg={aBg}
                                                  customBorder={aBorder}
                                                  customTextColor={aText}
                                                  customLabel={`${wof.weaving_number} (Actual)`}
                                                  topOffset="32px"
                                                  customHeight="20px"
                                                  tooltipType="actual"
                                                  deliveries={deliveries}
                                                />
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )
                ) : (
                  displayedLooms.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
                      <AlertCircle size={24} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
                      No weaving machines found for {currentTab === 'airjet' ? 'Airjet' : 'Rapier'} looms.
                    </div>
                  ) : (
                    displayedLooms.map(machine => {
                      const isExpanded = expandedMachines[machine.id];
                      const machineWofs = wofsByMachine[machine.id] || [];
                      const deptName = machine.master_departments?.department_name || (machine.id.startsWith('mock-') ? 'In-House Weaving' : '');

                      return (
                        <div key={machine.id} style={{ borderBottom: '1px solid var(--border-current)' }}>
                          {/* Machine Header Row */}
                          <div
                            onClick={() => toggleMachine(machine.id)}
                            style={{
                              display: 'flex',
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
                              color: 'var(--text-current)',
                              boxSizing: 'border-box'
                            }}>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <span>⚙️</span>
                              <div style={{ flex: 1 }}>
                                <div>Loom {machine.machine_name}</div>
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
                                {machineWofs.length} Form{machineWofs.length !== 1 ? 's' : ''}
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
                                  {/* Overlay bars for each WO */}
                                  {machineWofs.map(wof => {
                                    const bar = calcBarPosition(wof, days);
                                    if (!bar) return null;
                                    const laneIdx = itemLanes[wof.id] || 0;
                                    return (
                                      <GanttBar
                                        key={wof.id}
                                        wof={wof}
                                        bar={bar}
                                        compact
                                        onWofClick={(w) => setSelectedWvof(w)}
                                        topOffset={`${6 + laneIdx * LANE_HEIGHT}px`}
                                        customHeight={`${LANE_HEIGHT - 6}px`}
                                        deliveries={deliveries}
                                      />
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Expanded Loom Rows: Show Planned vs Actual scheduling bars */}
                          {isExpanded && (
                            <div style={{ borderTop: '1px solid #f1f5f9' }}>
                              {machineWofs.length === 0 ? (
                                <div style={{
                                  padding: '1rem 2rem',
                                  color: 'var(--text-muted-current)',
                                  fontSize: '0.75rem',
                                  fontStyle: 'italic',
                                  borderLeft: '3px solid #800000',
                                  backgroundColor: '#fff'
                                }}>
                                  No orders scheduled on Loom {machine.machine_name} in this time range.
                                </div>
                              ) : (
                                machineWofs.map(wof => {
                                  const sc = getWvofStatusBadge(wof);
                                  const todayStr = getLocalDateString(new Date());

                                  return (
                                    <div key={wof.id} style={{
                                      display: 'flex',
                                      borderBottom: '1px solid #f3f3f3',
                                      backgroundColor: '#fff',
                                      transition: 'background-color 0.15s',
                                      minHeight: '60px'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef7f5'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                                    >
                                      {/* Loom detail label */}
                                      <div
                                        onClick={() => setSelectedWvof(wof)}
                                        style={{
                                          width: `${LABEL_COL_WIDTH}px`, minWidth: `${LABEL_COL_WIDTH}px`,
                                          padding: '0.55rem 1rem 0.55rem 2.25rem',
                                          borderRight: '1px solid var(--border-current)',
                                          borderLeft: '3px solid #800000',
                                          fontSize: '0.75rem',
                                          cursor: 'pointer',
                                          boxSizing: 'border-box'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                                          <span style={{
                                            fontWeight: '800', color: '#800000',
                                            fontFamily: 'monospace', fontSize: '0.72rem'
                                          }}>
                                            {wof.weaving_number}
                                          </span>
                                          <span style={{
                                            backgroundColor: sc.bg, color: sc.color,
                                            border: `1px solid ${sc.border}`,
                                            padding: '1px 6px', borderRadius: '10px',
                                            fontSize: '0.55rem', fontWeight: '800'
                                          }}>
                                            {sc.label}
                                          </span>
                                          {(() => {
                                            const weftBadge = getWeftYarnStatus(wof, deliveries);
                                            return (
                                              <span style={{
                                                backgroundColor: weftBadge.bg, color: weftBadge.color,
                                                border: `1px solid ${weftBadge.border}`,
                                                padding: '1px 6px', borderRadius: '10px',
                                                fontSize: '0.55rem', fontWeight: '800'
                                              }}>
                                                Weft: {weftBadge.label}
                                              </span>
                                            );
                                          })()}
                                        </div>
                                        <div style={{ color: 'var(--text-muted-current)', fontSize: '0.68rem', lineHeight: '1.45' }}>
                                          <span style={{ fontWeight: '600' }}>Order:</span> {wof.order?.order_number || '—'}
                                          {' · '}
                                          <span style={{ fontWeight: '600' }}>Design:</span> {wof.order?.design_no || '—'}
                                        </div>
                                        {(() => {
                                          const totalProduced = (wof.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
                                          return (
                                            <div style={{ color: '#800000', fontWeight: '750', fontSize: '0.68rem', marginTop: '1px', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                              <span>Qty: {wof.qty ? `${Number(wof.qty).toLocaleString()} m` : '—'}</span>
                                              <span style={{ color: '#047857' }}>Prod Qty: {totalProduced.toLocaleString()} m</span>
                                            </div>
                                          );
                                        })()}
                                      </div>

                                      {/* Loom Gantt bar planned/actual */}
                                      <div style={{ display: 'flex', position: 'relative', flex: 1, minHeight: '60px' }}>
                                        {days.map((d, i) => (
                                          <div key={i} style={{
                                            width: `${DAY_COL_WIDTH}px`, minWidth: `${DAY_COL_WIDTH}px`,
                                            borderRight: '1px solid #fafafa',
                                            backgroundColor: isToday(d) ? 'rgba(128,0,0,0.03)' : d.getDay() === 0 ? '#fefcfc' : 'transparent'
                                          }} />
                                        ))}
                                        {(() => {
                                          // 1. Planned Bar
                                          const plannedBar = calcBarPositionForDates(wof.start_date, wof.end_date, days);
                                          const pBg = '#fef9c3';
                                          const pBorder = '#eab308';
                                          const pText = '#854d0e';

                                          // 2. Actual Bar
                                          const showActual = !!wof.process_started_at || wof.status === 'on_process' || wof.status === 'completed' || wof.status === 'late_complete';
                                          let actualBar = null;
                                          let aBg = '';
                                          let aBorder = '';
                                          let aText = '';

                                          if (showActual) {
                                            const actualStartStr = getLocalDateString(wof.process_started_at) || wof.start_date || todayStr;
                                            const actualEndStr = ['completed', 'late_complete'].includes(wof.status)
                                              ? (getLocalDateString(wof.process_completed_at) || getLocalDateString(wof.updated_at) || todayStr)
                                              : todayStr;

                                            actualBar = calcBarPositionForDates(actualStartStr, actualEndStr, days);
                                            
                                            const statusVal = resolveWvofStatusValue(wof);
                                            if (statusVal === 'completed') {
                                              aBg = '#dcfce7';
                                              aBorder = '#22c55e';
                                              aText = '#166534';
                                            } else if (statusVal === 'late_complete' || statusVal === 'late' || statusVal === 'start_date_exceeded') {
                                              aBg = '#fee2e2';
                                              aBorder = '#ef4444';
                                              aText = '#b91c1c';
                                            } else {
                                              aBg = '#dbeafe';
                                              aBorder = '#3b82f6';
                                              aText = '#1d4ed8';
                                            }
                                          }

                                          return (
                                            <>
                                              {plannedBar && (
                                                <GanttBar
                                                  key={`${wof.id}-planned`}
                                                  wof={wof}
                                                  bar={plannedBar}
                                                  onWofClick={(w) => setSelectedWvof(w)}
                                                  customBg={pBg}
                                                  customBorder={pBorder}
                                                  customTextColor={pText}
                                                  customLabel={`${wof.weaving_number} (Plan)`}
                                                  topOffset="6px"
                                                  customHeight="20px"
                                                  tooltipType="planned"
                                                  deliveries={deliveries}
                                                />
                                              )}
                                              {showActual && actualBar && (
                                                <GanttBar
                                                  key={`${wof.id}-actual`}
                                                  wof={wof}
                                                  bar={actualBar}
                                                  onWofClick={(w) => setSelectedWvof(w)}
                                                  customBg={aBg}
                                                  customBorder={aBorder}
                                                  customTextColor={aText}
                                                  customLabel={`${wof.weaving_number} (Actual)`}
                                                  topOffset="32px"
                                                  customHeight="20px"
                                                  tooltipType="actual"
                                                  deliveries={deliveries}
                                                />
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Weaving Detail Modal Overlay */}
      {selectedWvof && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 900,
          padding: '2rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: 'var(--surface-current)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
            overflow: 'hidden',
            border: '1px solid var(--border-current)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-current)',
              backgroundColor: '#800000',
              color: 'white'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>
                  Weaving Order Form Details
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>
                  WVOF: <strong style={{ fontFamily: 'monospace' }}>{selectedWvof.weaving_number}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedWvof(null)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '1.5rem', fontWeight: '300' }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', backgroundColor: 'var(--bg-current)' }}>
              {/* Left Column - Metadata & Status Triggers */}
              <div style={{ width: '300px', borderRight: '1px solid var(--border-current)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxSizing: 'border-box' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Status</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {(() => {
                      const sc = getWvofStatusBadge(selectedWvof);
                      return (
                        <span style={{
                          backgroundColor: sc.bg, color: sc.color,
                          border: `1px solid ${sc.border}`,
                          padding: '2px 10px', borderRadius: '12px',
                          fontSize: '0.75rem', fontWeight: '800', textTransform: 'capitalize'
                        }}>
                          {sc.label}
                        </span>
                      );
                    })()}
                    {(() => {
                      const weftBadge = getWeftYarnStatus(selectedWvof, deliveries);
                      return (
                        <span style={{
                          backgroundColor: weftBadge.bg, color: weftBadge.color,
                          border: `1px solid ${weftBadge.border}`,
                          padding: '2px 10px', borderRadius: '12px',
                          fontSize: '0.75rem', fontWeight: '800'
                        }}>
                          Weft: {weftBadge.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Order Number</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{selectedWvof.order?.order_number || '—'}</span>
                </div>

                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Design</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                    {selectedWvof.order?.design_no || selectedWvof.design_no} {selectedWvof.order?.design_name ? `/ ${selectedWvof.order.design_name}` : ''}
                  </span>
                </div>

                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Loom / Machine</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{selectedWvof.machine_name || 'Unassigned'}</span>
                </div>

                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Weaving Qty Details</span>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#800000' }}>
                        {Number(selectedWvof.qty).toLocaleString()} m
                      </div>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted-current)', fontWeight: '600', display: 'block', marginTop: '1px' }}>Target Qty</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#047857' }}>
                        {(() => {
                          const totalProduced = (selectedWvof.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
                          return totalProduced.toLocaleString();
                        })()} m
                      </div>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted-current)', fontWeight: '600', display: 'block', marginTop: '1px' }}>Qty Produced</span>
                    </div>
                    {(() => {
                      const totalGreige = (selectedWvof.fabric_rolls || [])
                        .filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing')
                        .reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0);
                      return (
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0284c7' }}>
                            {totalGreige.toLocaleString()} m
                          </div>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted-current)', fontWeight: '600', display: 'block', marginTop: '1px' }}>Greige Received</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Beam Number</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{selectedWvof.beam_number || '—'}</span>
                </div>

                {/* Quick Actions / Status controls */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase' }}>Loom Controls</span>
                  
                  {/* Status change actions */}
                  {(() => {
                    if (!['pending', 'weft_yarn_allotted', 'weft_yarn_partially_delivered', 'weft_yarn_delivered', 'stopped'].includes(selectedWvof.status)) return null;
                    const weftBadge = getWeftYarnStatus(selectedWvof, deliveries);
                    const hasDydr = deliveries.some(d => d.production_form_id === selectedWvof.id);
                    const canStart = (weftBadge.label === 'Partially Delivered' || weftBadge.label === 'Delivered') && hasDydr;
                    const isDisabled = selectedWvof.status !== 'stopped' && !canStart;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                        <button
                          disabled={isDisabled}
                          onClick={async () => {
                            await handleUpdateStatus(selectedWvof.id, selectedWvof.status, 'on_process', selectedWvof.end_date);
                            setSelectedWvof(prev => ({ ...prev, status: 'on_process', process_started_at: new Date().toISOString() }));
                          }}
                          style={{
                            width: '100%', padding: '0.5rem',
                            backgroundColor: isDisabled ? '#cbd5e1' : '#800000',
                            color: isDisabled ? '#64748b' : 'white',
                            border: 'none', borderRadius: '6px',
                            fontWeight: '700', fontSize: '0.8rem',
                            cursor: isDisabled ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {selectedWvof.status === 'stopped' ? '▶ Resume Loom' : '▶ Start Loom'}
                        </button>
                        {isDisabled && (
                          <div style={{ color: '#b91c1c', fontSize: '0.68rem', fontWeight: '600', lineHeight: '1.3', display: 'flex', gap: '0.25rem', alignItems: 'flex-start' }}>
                            <span style={{ flexShrink: 0 }}>⚠️</span>
                            <span>Cannot start loom: Weft yarn must be partially/fully delivered (at least one DYDR is required).</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {selectedWvof.status === 'on_process' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => openCompleteWvofForm(selectedWvof)}
                        style={{
                          flex: 1, padding: '0.5rem',
                          backgroundColor: '#16a34a', color: 'white',
                          border: 'none', borderRadius: '6px',
                          fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
                        }}
                      >
                        ✓ Complete
                      </button>
                      <button
                        onClick={async () => {
                          await handleUpdateStatus(selectedWvof.id, 'on_process', 'stopped');
                          setSelectedWvof(prev => ({ ...prev, status: 'stopped' }));
                        }}
                        style={{
                          flex: 1, padding: '0.5rem',
                          backgroundColor: '#64748b', color: 'white',
                          border: 'none', borderRadius: '6px',
                          fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
                        }}
                      >
                        🛑 Stop
                      </button>
                    </div>
                  )}

                  {/* Print button */}
                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      onClick={() => { setPrintWvof(selectedWvof); setSelectedWvof(null); }}
                      style={{
                        width: '100%', padding: '0.5rem',
                        backgroundColor: 'transparent', border: '1px solid var(--border-current)',
                        borderRadius: '6px', color: 'var(--text-current)',
                        fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
                      }}
                    >
                      🖨 Print
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column - Subtabs for Yarn Allotments and Production Log */}
              <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-current)', marginBottom: '1.25rem', gap: '1.5rem' }}>
                  {!isProductionView && (
                    <button
                      onClick={() => setActiveDetailTab('production_record')}
                      disabled={!selectedWvof.process_started_at}
                      style={{
                        padding: '0.5rem 0', border: 'none', background: 'none',
                        color: !selectedWvof.process_started_at
                          ? 'var(--text-muted-current)'
                          : (activeDetailTab === 'production_record' ? '#800000' : 'var(--text-muted-current)'),
                        borderBottom: activeDetailTab === 'production_record' && selectedWvof.process_started_at ? '3px solid #800000' : '3px solid transparent',
                        fontWeight: '800', fontSize: '0.85rem',
                        cursor: selectedWvof.process_started_at ? 'pointer' : 'not-allowed',
                        opacity: selectedWvof.process_started_at ? 1 : 0.5
                      }}
                      title={!selectedWvof.process_started_at ? "Please start the loom first" : ""}
                    >
                      Record Production
                    </button>
                  )}
                  <button
                    onClick={() => setActiveDetailTab('yarn')}
                    style={{
                      padding: '0.5rem 0', border: 'none', background: 'none',
                      color: activeDetailTab === 'yarn' ? '#800000' : 'var(--text-muted-current)',
                      borderBottom: activeDetailTab === 'yarn' ? '3px solid #800000' : '3px solid transparent',
                      fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer'
                    }}
                  >
                    Yarn Requirements & DYDR
                  </button>
                  <button
                    onClick={() => setActiveDetailTab('weaving_details')}
                    style={{
                      padding: '0.5rem 0', border: 'none', background: 'none',
                      color: activeDetailTab === 'weaving_details' ? '#800000' : 'var(--text-muted-current)',
                      borderBottom: activeDetailTab === 'weaving_details' ? '3px solid #800000' : '3px solid transparent',
                      fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer'
                    }}
                  >
                    Production Schedule & Log
                  </button>
                  {(selectedWvof.status === 'completed' || selectedWvof.status === 'late_complete') && (
                    <button
                      onClick={() => setActiveDetailTab('delivery_receipt')}
                      style={{
                        padding: '0.5rem 0', border: 'none', background: 'none',
                        color: activeDetailTab === 'delivery_receipt' ? '#800000' : 'var(--text-muted-current)',
                        borderBottom: activeDetailTab === 'delivery_receipt' ? '3px solid #800000' : '3px solid transparent',
                        fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer'
                      }}
                    >
                      Delivery Challan (DC)
                    </button>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {!isProductionView && activeDetailTab === 'production_record' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div style={{ backgroundColor: 'var(--surface-current)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-current)' }}>
                        <h6 style={{ margin: '0 0 1rem', fontSize: '0.82rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Record Production Round
                        </h6>
                        {['completed', 'late_complete'].includes(selectedWvof.status) ? (
                          <div style={{
                            backgroundColor: 'rgba(16,185,129,0.06)',
                            border: '1px solid rgba(16,185,129,0.2)',
                            borderRadius: '10px',
                            padding: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            color: '#047857'
                          }}>
                            <CheckCircle size={18} style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: '0.825rem', fontWeight: '600' }}>
                              Production completed. No further production rounds can be recorded.
                            </span>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '750', marginBottom: '0.35rem', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Date & Time</label>
                                <input
                                  type="datetime-local"
                                  value={roundDateTime}
                                  onChange={e => setRoundDateTime(e.target.value)}
                                  style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                />
                              </div>
                              {selectedWvof.weaving_type !== 'job_work' ? (
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '750', marginBottom: '0.35rem', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Weaver Name</label>
                                  <select
                                    value={roundWeaver}
                                    onChange={e => setRoundWeaver(e.target.value)}
                                    style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                  >
                                    <option value="">Select Weaver...</option>
                                    {weavingWorkers.map(w => (
                                      <option key={w.id} value={w.worker_name}>{w.worker_name}</option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '750', marginBottom: '0.35rem', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Weaver Name</label>
                                  <input
                                    type="text"
                                    value="N/A (Job Work)"
                                    disabled
                                    style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', backgroundColor: '#f1f5f9', color: '#64748b', boxSizing: 'border-box', cursor: 'not-allowed' }}
                                  />
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '1rem', alignItems: 'flex-end' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '750', marginBottom: '0.35rem', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Now Produced (Mtrs)</label>
                                <input
                                  type="number"
                                  step="any"
                                  placeholder="Meters produced"
                                  value={roundQty}
                                  onChange={e => setRoundQty(e.target.value)}
                                  style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                />
                              </div>
                              <button
                                onClick={() => handleSaveProductionRound(selectedWvof)}
                                disabled={recordingRound}
                                style={{ padding: '0.45rem 1rem', backgroundColor: '#800000', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
                              >
                                {recordingRound ? 'Saving...' : 'Record'}
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      <div>
                        <h6 style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Logged Production History ({((selectedWvof.production_logs) || []).length} rounds)
                        </h6>
                        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Date & Time</th>
                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Weaver</th>
                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Produced Qty (Mtrs)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {!selectedWvof.production_logs || selectedWvof.production_logs.length === 0 ? (
                                <tr>
                                  <td colSpan="3" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                    No production rounds recorded yet.
                                  </td>
                                </tr>
                              ) : (
                                [...selectedWvof.production_logs]
                                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                                  .map((log, lIdx) => (
                                    <tr key={log.id || lIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                      <td style={{ padding: '0.5rem 0.75rem' }}>
                                        {new Date(log.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </td>
                                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>{log.weaver}</td>
                                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{Number(log.qty).toLocaleString()} m</td>
                                    </tr>
                                  ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeDetailTab === 'yarn' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div>
                        <h6 style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Weft Yarn Allotments
                        </h6>
                        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Colour</th>
                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Yarn Count</th>
                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Allotted (kg)</th>
                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Delivered (kg)</th>
                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Balance (kg)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(!selectedWvof.weft_allotments || selectedWvof.weft_allotments.length === 0) ? (
                                <tr>
                                  <td colSpan="5" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                    No allotments added to this weaving order form yet.
                                  </td>
                                </tr>
                              ) : (
                                selectedWvof.weft_allotments.map((allot, aIdx) => {
                                  const yc = yarnCounts.find(y => y.id === (allot.countId || allot.yarn_count_id));
                                  const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (allot.countValue || '—');
                                  
                                  const matchingDel = deliveries.filter(d => 
                                    d.production_form_id === selectedWvof.id && 
                                    d.colour === allot.colour && 
                                    (d.yarn_count_id === allot.countId || d.yarn_count_id === allot.yarn_count_id)
                                  );
                                  const deliveredQty = matchingDel.reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);
                                  const balance = Math.max(0, parseFloat(allot.allotted_qty || allot.qty || 0) - deliveredQty);

                                  return (
                                    <tr key={aIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', color: '#800000' }}>{allot.colour || '—'}</td>
                                      <td style={{ padding: '0.5rem 0.75rem' }}>{countDisplay}</td>
                                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#800000', textAlign: 'right' }}>{parseFloat(allot.allotted_qty || allot.qty || 0).toFixed(2)}</td>
                                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{deliveredQty.toFixed(2)}</td>
                                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: balance > 0.01 ? '#b45309' : '#047857', textAlign: 'right' }}>{balance.toFixed(2)}</td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <h6 style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Associated DYDRs
                        </h6>
                        {deliveries.filter(d => d.production_form_id === selectedWvof.id).length === 0 ? (
                          <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                            No DYDR delivery receipts have been created for this weaving order form yet.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {(() => {
                              const formDydis = deliveries.filter(d => d.production_form_id === selectedWvof.id);
                              const uniqueDydrs = {};
                              formDydis.forEach(item => {
                                  if (item.delivery) {
                                    uniqueDydrs[item.delivery.id] = item.delivery;
                                  }
                              });
                              const uniqueDydrList = Object.values(uniqueDydrs);
                              return uniqueDydrList.map((del, dIdx) => {
                                const weight = formDydis.filter(item => item.delivery?.id === del.id).reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);
                                return (
                                  <div 
                                    key={dIdx} 
                                    onClick={() => {
                                      const items = formDydis.filter(item => item.delivery?.id === del.id);
                                      setSelectedDydr({
                                        ...del,
                                        weaving: selectedWvof,
                                        items: items.map(it => ({
                                          ...it,
                                          orders: selectedWvof.order
                                        }))
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
                                        Date: {del.delivered_date ? new Date(del.delivered_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <span style={{ fontWeight: '700', color: '#047857' }}>{weight.toFixed(2)} kg</span>
                                      <span style={{ color: '#800000', fontSize: '0.7rem', fontWeight: '700' }}>View</span>
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
                      <h6 style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Daily Production Schedule & Logs
                      </h6>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', backgroundColor: '#fafafa', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                        <div>
                          <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase' }}>Planned Duration</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                            {selectedWvof.start_date || '—'} to {selectedWvof.end_date || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase' }}>Actual Run</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                            {selectedWvof.process_started_at ? new Date(selectedWvof.process_started_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Not Started'}
                            {selectedWvof.process_completed_at ? ` to ${new Date(selectedWvof.process_completed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}
                          </span>
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                              <th style={{ width: '30px', padding: '0.5rem' }}></th>
                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Date</th>
                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Planned (Mtrs)</th>
                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Actual (Mtrs)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              let totalPlannedSum = 0;
                              let totalActualSum = 0;
                              
                              const unifiedDates = getUnifiedProductionDates(selectedWvof);
                              const rows = [];
                              
                              if (unifiedDates.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                      No production log entries found.
                                    </td>
                                  </tr>
                                );
                              }

                              unifiedDates.forEach((dateStr) => {
                                const d = new Date(dateStr + 'T00:00:00');
                                const formattedDate = !isNaN(d.getTime()) 
                                  ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                                  : dateStr;
                                  
                                const plannedObj = (selectedWvof.planned_daily_production || []).find(p => p.date === dateStr);
                                const plannedQty = plannedObj ? parseFloat(plannedObj.qty) || 0 : 0;
                                
                                const actualLogs = (selectedWvof.production_logs || []).filter(log => getLocalDateOnly(log.timestamp) === dateStr);
                                const sumActual = actualLogs.reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
                                
                                totalPlannedSum += plannedQty;
                                totalActualSum += sumActual;
                                
                                const isDateExpanded = expandedDates[`${selectedWvof.id}-${dateStr}`];
                                
                                rows.push(
                                  <tr 
                                    key={`row-${dateStr}`}
                                    onClick={() => {
                                      const key = `${selectedWvof.id}-${dateStr}`;
                                      setExpandedDates(prev => ({ ...prev, [key]: !prev[key] }));
                                    }}
                                    style={{ borderBottom: '1px solid var(--border-current)', cursor: 'pointer', backgroundColor: isDateExpanded ? '#fbf7f7' : 'transparent' }}
                                  >
                                    <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                      {isDateExpanded ? <ChevronDown size={12} style={{ color: '#800000' }} /> : <ChevronRight size={12} />}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>{formattedDate}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#800000', textAlign: 'right' }}>{plannedQty > 0 ? `${plannedQty.toLocaleString()} m` : '—'}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{sumActual > 0 ? `${sumActual.toLocaleString()} m` : '—'}</td>
                                  </tr>
                                );
                                
                                if (isDateExpanded) {
                                  rows.push(
                                    <tr key={`details-${dateStr}`} style={{ backgroundColor: '#fffdfd', borderBottom: '1px solid var(--border-current)' }}>
                                      <td colSpan="4" style={{ padding: '0.5rem 1rem 0.5rem 2rem' }}>
                                        <div style={{ border: '1px solid #fecdd3', borderRadius: '6px', overflow: 'hidden' }}>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                                            <thead>
                                              <tr style={{ backgroundColor: '#ffe4e6', borderBottom: '1px solid #fecdd3', textAlign: 'left' }}>
                                                <th style={{ padding: '0.3rem 0.5rem', fontWeight: '700', color: '#be123c' }}>Time</th>
                                                <th style={{ padding: '0.3rem 0.5rem', fontWeight: '700', color: '#be123c' }}>Weaver</th>
                                                <th style={{ padding: '0.3rem 0.5rem', fontWeight: '700', color: '#be123c', textAlign: 'right' }}>Qty (Mtrs)</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {actualLogs.length === 0 ? (
                                                <tr>
                                                  <td colSpan="3" style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                                    No production records.
                                                  </td>
                                                </tr>
                                              ) : (
                                                actualLogs.map((log, lIdx) => (
                                                  <tr key={log.id || lIdx} style={{ borderBottom: lIdx !== actualLogs.length - 1 ? '1px solid #fecdd3' : 'none' }}>
                                                    <td style={{ padding: '0.3rem 0.5rem' }}>
                                                      {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td style={{ padding: '0.3rem 0.5rem', fontWeight: '600' }}>{log.weaver}</td>
                                                    <td style={{ padding: '0.3rem 0.5rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{Number(log.qty).toLocaleString()} m</td>
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
                              
                              // Add total row at the end
                              rows.push(
                                <tr key="totals" style={{ backgroundColor: '#fafafa', fontWeight: '800' }}>
                                  <td></td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>Total</td>
                                  <td style={{ padding: '0.5rem 0.75rem', color: '#800000', textAlign: 'right' }}>{totalPlannedSum.toLocaleString()} m</td>
                                  <td style={{ padding: '0.5rem 0.75rem', color: '#047857', textAlign: 'right' }}>{totalActualSum.toLocaleString()} m</td>
                                </tr>
                              );
                              
                              return rows;
                            })()}
                          </tbody>
                        </table>
                      </div>

                      {/* Greige Fabric / GFRR Section placed below Daily Production logs inside Modal */}
                      {selectedWvof.weaving_type === 'in_house' ? (
                        <div style={{ marginTop: '1.5rem' }}>
                          <h6 style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Received Greige Fabric Rolls
                          </h6>
                          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                  <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Received Date</th>
                                  <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Fabric Roll ID</th>
                                  <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty (Mtrs)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const rolls = (selectedWvof.fabric_rolls || []).filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing');
                                  if (rolls.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan="3" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                          No received greige fabric rolls found for this order.
                                        </td>
                                      </tr>
                                    );
                                  }
                                  return rolls
                                    .sort((a, b) => new Date(b.received_at || 0) - new Date(a.received_at || 0))
                                    .map((roll, rIdx) => (
                                      <tr key={roll.id || rIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                          {roll.received_at ? new Date(roll.received_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', fontFamily: 'monospace' }}>{roll.id}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{Number(roll.qty).toLocaleString()} m</td>
                                      </tr>
                                    ));
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
                          <div>
                            <h6 style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Greige Fabric Receiving Receipts (GFRR) - Fabric Rolls
                            </h6>
                            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Received Date</th>
                                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Fabric Roll ID</th>
                                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty (Mtrs)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const rolls = (selectedWvof.fabric_rolls || []).filter(r => r.gfrr_no);
                                    if (rolls.length === 0) {
                                      return (
                                        <tr>
                                          <td colSpan="3" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                            No received greige fabric rolls with GFRR found for this order.
                                          </td>
                                        </tr>
                                      );
                                    }
                                    return rolls
                                      .sort((a, b) => new Date(b.received_at || 0) - new Date(a.received_at || 0))
                                      .map((roll, rIdx) => (
                                        <tr key={roll.id || rIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                          <td style={{ padding: '0.5rem 0.75rem' }}>
                                            {roll.received_at ? new Date(roll.received_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                          </td>
                                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', fontFamily: 'monospace' }}>{roll.id}</td>
                                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{Number(roll.qty).toLocaleString()} m</td>
                                        </tr>
                                      ));
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {(() => {
                            const gfrrGroups = {};
                            (selectedWvof.fabric_rolls || []).forEach(roll => {
                              if (roll.gfrr_no) {
                                if (!gfrrGroups[roll.gfrr_no]) {
                                  gfrrGroups[roll.gfrr_no] = [];
                                }
                                gfrrGroups[roll.gfrr_no].push(roll);
                              }
                            });

                            const gfrrNos = Object.keys(gfrrGroups);
                            if (gfrrNos.length === 0) return null;

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <h6 style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  📜 Associated GFRR Receipts
                                </h6>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                                  {gfrrNos.map(gfrrNo => {
                                    const rolls = gfrrGroups[gfrrNo];
                                    const totalQty = rolls.reduce((sum, r) => sum + Number(r.qty || 0), 0);
                                    const rawDate = rolls.find(r => r.received_at)?.received_at;
                                    const formattedDate = rawDate ? new Date(rawDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                                    return (
                                      <div 
                                        key={gfrrNo} 
                                        onClick={() => handleReprintGfrrReceipt(gfrrNo, rolls, selectedWvof)}
                                        style={{ 
                                          display: 'flex', 
                                          flexDirection: 'column',
                                          gap: '0.5rem', 
                                          backgroundColor: 'var(--surface-current)', 
                                          padding: '1rem', 
                                          borderRadius: '10px', 
                                          border: '1px solid var(--border-current)', 
                                          cursor: 'pointer',
                                          transition: 'all 0.2s ease',
                                          boxShadow: 'var(--shadow-sm)'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#800000'; e.currentTarget.style.boxShadow = '0 6px 12px -2px rgba(0,0,0,0.08)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-current)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receipt</span>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>Date: {formattedDate}</span>
                                        </div>
                                        <div style={{ fontFamily: 'monospace', fontWeight: '800', color: '#800000', fontSize: '0.825rem', wordBreak: 'break-all' }}>
                                          {gfrrNo}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-current)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                                          <span style={{ fontWeight: '700', fontSize: '0.78rem', color: 'var(--text-current)' }}>{rolls.length} Rolls Received</span>
                                          <span style={{ fontWeight: '800', color: '#047857', fontSize: '0.825rem' }}>{totalQty.toLocaleString()} m</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {activeDetailTab === 'delivery_receipt' && (
                    <div>
                      <h6 style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Weaving Delivery Challan (WVOFDC)
                      </h6>
                      <PrintableWVOFDC
                        wvof={selectedWvof}
                        order={selectedWvof.order}
                        producedQty={(selectedWvof.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-current)', backgroundColor: 'var(--surface-current)' }}>
              <button
                onClick={() => setSelectedWvof(null)}
                style={{ border: '1px solid var(--border-current)', backgroundColor: 'transparent', color: 'var(--text-current)', padding: '0.55rem 1.5rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editWvof && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: 'var(--surface-current)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            border: '1px solid var(--border-current)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-current)',
              backgroundColor: 'var(--surface-current)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-current)' }}>
                  Edit Weaving Order Form
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                  WVOF: <strong style={{ color: '#800000', fontFamily: 'monospace' }}>{editWvof.weaving_number}</strong>
                </p>
              </div>
              <button
                onClick={() => setEditWvof(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted-current)', cursor: 'pointer', fontSize: '1.5rem', fontWeight: '300', lineHeight: 1, padding: '4px' }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              backgroundColor: 'var(--bg-current)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              {editError && (
                <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem 1rem', color: '#b91c1c', fontSize: '0.825rem' }}>
                  {editError}
                </div>
              )}

              {/* Weaving Type Select */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '800', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted-current)' }}>
                  Weaving Scope
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {[
                    { id: 'in_house', label: 'In-House Weaving', sub: 'Process in-house loom sheds' },
                    { id: 'job_work', label: 'Job Work Weaving', sub: 'Send to outsource weaving partner' }
                  ].map(opt => (
                    <div
                      key={opt.id}
                      onClick={() => { setEditWeavingType(opt.id); setEditMachineId(''); setEditPartnerId(''); }}
                      style={{
                        border: `2px solid ${editWeavingType === opt.id ? '#800000' : 'var(--border-current)'}`,
                        borderRadius: '10px',
                        padding: '1rem',
                        cursor: 'pointer',
                        backgroundColor: editWeavingType === opt.id ? 'rgba(128,0,0,0.04)' : 'var(--surface-current)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', color: editWeavingType === opt.id ? '#800000' : 'var(--text-current)' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>{opt.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Allocation */}
              <div style={{
                backgroundColor: 'rgba(128,0,0,0.02)',
                border: '1px solid var(--border-current)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.85rem', fontWeight: '800', color: '#800000' }}>
                  Loom & Schedule Allocation
                </h4>

                {loadingEditModalData ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                    <Loader size={14} className="spin" /> Loading weaving options...
                  </div>
                ) : (
                  <>
                    {editWeavingType === 'job_work' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-current)' }}>
                          Weaving Partner (Optional)
                        </label>
                        <select
                          value={editPartnerId}
                          onChange={e => { setEditPartnerId(e.target.value); setEditMachineId(''); }}
                          style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', background: 'var(--surface-current)', color: 'var(--text-current)', cursor: 'pointer' }}
                        >
                          <option value="">— Select Weaving Partner —</option>
                          {partners.map(p => <option key={p.id} value={p.id}>{p.partner_name}</option>)}
                        </select>
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-current)' }}>
                        {editWeavingType === 'in_house' ? 'In-House Weaving Loom (Optional)' : 'Loom at Partner (Optional)'}
                      </label>
                      <select
                        value={editMachineId}
                        onChange={e => setEditMachineId(e.target.value)}
                        disabled={editWeavingType === 'job_work' && !editPartnerId}
                        style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', background: 'var(--surface-current)', color: 'var(--text-current)', cursor: 'pointer', opacity: (editWeavingType === 'job_work' && !editPartnerId) ? 0.5 : 1 }}
                      >
                        <option value="">— Select Loom —</option>
                        {machines.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.machine_name} {m.master_departments?.department_name ? `(${m.master_departments.department_name})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Quantity and Dates */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-current)' }}>Weaving Qty (Mtrs) *</label>
                    <input
                      type="number"
                      value={editQty}
                      onChange={e => setEditQty(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', background: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-current)' }}>Current Status</label>
                    <div style={{ padding: '0.55rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', background: 'var(--surface-current)', color: 'var(--text-muted-current)', fontWeight: '600', textTransform: 'capitalize' }}>
                      {editStatus.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>

                {/* Beam Number */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-current)' }}>Beam Number</label>
                  <input
                    type="text"
                    placeholder="e.g. BM-001"
                    value={editBeamNumber}
                    onChange={e => setEditBeamNumber(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', background: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-current)' }}>Start Date *</label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={e => setEditStartDate(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', background: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-current)' }}>End Date *</label>
                    <input
                      type="date"
                      value={editEndDate}
                      min={editStartDate}
                      onChange={e => setEditEndDate(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', background: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* Planned Daily Production Schedule */}
                {editStartDate && editEndDate && editPlannedProduction.length > 0 && (
                  <div style={{
                    border: '1px solid var(--border-current)',
                    borderRadius: '10px',
                    padding: '1rem',
                    backgroundColor: 'rgba(128,0,0,0.01)',
                    marginTop: '0.5rem'
                  }}>
                    <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.825rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Planned Daily Production Qty
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem', marginBottom: '0.75rem' }}>
                      {editPlannedProduction.map((item, idx) => {
                        const d = new Date(item.date + 'T00:00:00');
                        const formattedDate = !isNaN(d.getTime()) 
                          ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : item.date;

                        return (
                          <div key={item.date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-current)' }}>
                              {formattedDate}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '130px' }}>
                              <input
                                type="number"
                                placeholder="0"
                                value={item.qty}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEditPlannedProduction(prev => prev.map((p, i) => i === idx ? { ...p, qty: val } : p));
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.35rem 0.5rem',
                                  border: '1px solid var(--border-current)',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  background: 'var(--surface-current)',
                                  color: 'var(--text-current)',
                                  textAlign: 'right',
                                  boxSizing: 'border-box'
                                }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>m</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Status/Validation Summary */}
                    {(() => {
                      const totalPlanned = editPlannedProduction.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0);
                      const target = parseFloat(editQty) || 0;
                      const diff = totalPlanned - target;
                      const isMatched = Math.abs(diff) < 0.01;
                      return (
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          borderTop: '1px solid var(--border-current)', 
                          paddingTop: '0.6rem', 
                          fontSize: '0.78rem',
                          fontWeight: '700'
                        }}>
                          <span style={{ color: 'var(--text-muted-current)' }}>Total Planned:</span>
                          <span style={{ color: isMatched ? '#16a34a' : '#d97706' }}>
                            {totalPlanned.toLocaleString()} / {target.toLocaleString()} m
                            {isMatched ? ' ✓' : ` (${diff > 0 ? '+' : ''}${diff.toLocaleString()} m)`}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-current)', backgroundColor: 'var(--surface-current)' }}>
              <button
                onClick={() => setEditWvof(null)}
                style={{ border: '1px solid var(--border-current)', backgroundColor: 'transparent', color: 'var(--text-current)', padding: '0.55rem 1.25rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={editSubmitting}
                style={{
                  backgroundColor: '#800000',
                  border: 'none',
                  color: 'white',
                  padding: '0.55rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: editSubmitting ? 0.7 : 1
                }}
              >
                {editSubmitting ? <Loader size={14} className="spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Printable Modal Overlay */}
      {printWvof && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: 'var(--surface-current)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            border: '1px solid var(--border-current)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--border-current)',
              backgroundColor: 'var(--surface-current)'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-current)' }}>
                Print Weaving Order Form
              </h3>
              <button
                onClick={() => setPrintWvof(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted-current)', cursor: 'pointer', fontSize: '1.5rem', fontWeight: '300', lineHeight: 1, padding: '4px' }}
              >
                &times;
              </button>
            </div>
            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-current)' }}>
              <PrintableWVOF
                wvof={printWvof}
                order={printWvof.order}
                machineName={printWvof.machine_name}
                partnerName={printWvof.partner_name}
                yarnCounts={yarnCounts}
                weftYarnStatus={getWeftYarnStatus(printWvof, deliveries)}
                deliveries={deliveries}
              />
            </div>
          </div>
        </div>
      )}

      {/* Complete Weaving Process Modal */}
      {showCompleteWvofForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '2rem', boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: 'var(--surface-current)', borderRadius: '16px',
            width: '100%', maxWidth: '750px', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
            overflow: 'hidden', border: '1px solid var(--border-current)'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-current)',
              background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>Complete Weaving Process</h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', opacity: 0.85 }}>
                  WVOF: <strong style={{ fontFamily: 'monospace' }}>{showCompleteWvofForm.weaving_number}</strong>
                </p>
              </div>
              <button onClick={() => setShowCompleteWvofForm(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '1.3rem' }}>
                &times;
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-current)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Info summary */}
              <div style={{ backgroundColor: 'var(--surface-current)', border: '1px solid var(--border-current)', borderRadius: '10px', padding: '1rem', fontSize: '0.825rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Weaving Order Summary</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', lineHeight: '1.4' }}>
                  <div><strong>Order:</strong> {showCompleteWvofForm.order?.order_number || '—'}</div>
                  <div><strong>Design No:</strong> {showCompleteWvofForm.order?.design_no || showCompleteWvofForm.design_no}</div>
                  <div><strong>Design Name:</strong> {showCompleteWvofForm.order?.design_name || '—'}</div>
                  <div><strong>Target Qty:</strong> {Number(showCompleteWvofForm.qty).toLocaleString()} m</div>
                  <div><strong>Produced Qty:</strong> {((showCompleteWvofForm.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0)).toLocaleString()} m</div>
                  <div><strong>Planned Timeline:</strong> {showCompleteWvofForm.start_date || '—'} to {showCompleteWvofForm.end_date || '—'}</div>
                  <div><strong>Actual Start:</strong> {showCompleteWvofForm.process_started_at ? new Date(showCompleteWvofForm.process_started_at).toLocaleDateString('en-IN') : '—'}</div>
                  <div>
                    <strong>Status will be:</strong>{' '}
                    {(() => {
                      const actualEndStr = completeWvofDate.slice(0, 10);
                      const isL = showCompleteWvofForm.end_date && actualEndStr > showCompleteWvofForm.end_date;
                      return (
                        <span style={{ fontWeight: '800', color: isL ? '#b91c1c' : '#166534' }}>
                          {isL ? 'Late Completed' : 'Completed'}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Completion Date */}
              <div style={{ maxWidth: '300px' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                  Actual End Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={completeWvofDate}
                  onChange={e => setCompleteWvofDate(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Weft Yarn Returns */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Weft Yarn Return Details
                </h4>
                {weftYarnReturns.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted-current)', border: '1px dashed var(--border-current)', borderRadius: '8px', backgroundColor: 'var(--surface-current)' }}>
                    No weft yarn delivered for this process.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--surface-current)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Colour</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Count</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Lot Number</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Received (kg)</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', width: '140px' }}>Return Qty (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weftYarnReturns.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: idx < weftYarnReturns.length - 1 ? '1px solid var(--border-current)' : 'none' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>{item.colour}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{item.count_display}</td>
                            <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace' }}>{item.lot_number}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>{Number(item.quantity_received).toFixed(2)}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <input
                                type="number"
                                step="0.01"
                                value={item.quantity_returned}
                                onChange={e => {
                                  const updated = [...weftYarnReturns];
                                  updated[idx].quantity_returned = e.target.value;
                                  setWeftYarnReturns(updated);
                                }}
                                style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1.5px solid var(--border-current)', fontSize: '0.78rem', width: '100%', boxSizing: 'border-box', outline: 'none', background: 'var(--bg-current)', color: 'var(--text-current)' }}
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
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-current)', backgroundColor: 'var(--surface-current)' }}>
              <button onClick={() => setShowCompleteWvofForm(null)} disabled={savingCompleteWvof} style={{ border: '1px solid var(--border-current)', backgroundColor: 'transparent', color: 'var(--text-current)', padding: '0.55rem 1.25rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleCompleteWvofProcess} disabled={savingCompleteWvof} style={{ backgroundColor: '#059669', border: 'none', color: 'white', padding: '0.55rem 1.5rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: savingCompleteWvof ? 0.7 : 1 }}>
                {savingCompleteWvof ? <Loader size={14} className="spin" /> : <CheckCircle size={14} />}
                {savingCompleteWvof ? 'Completing...' : 'Confirm & Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Printable Weaving DC Modal Overlay */}
      {printWvofdc && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: 'var(--surface-current)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            border: '1px solid var(--border-current)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--border-current)',
              backgroundColor: 'var(--surface-current)'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-current)' }}>
                Print Weaving Delivery Challan (WVOFDC)
              </h3>
              <button
                onClick={() => setPrintWvofdc(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted-current)', cursor: 'pointer', fontSize: '1.5rem', fontWeight: '300', lineHeight: 1, padding: '4px' }}
              >
                &times;
              </button>
            </div>
            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-current)' }}>
              <PrintableWVOFDC
                wvof={printWvofdc}
                order={printWvofdc.order}
                producedQty={(printWvofdc.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Allot Dyed Yarn Modal Overlay */}
      {allotWvof && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: 'var(--surface-current)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            border: '1px solid var(--border-current)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-current)',
              backgroundColor: 'var(--surface-current)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-current)' }}>
                  Allot Dyed Yarn (Weft)
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                  WVOF: <strong style={{ color: '#800000', fontFamily: 'monospace' }}>{allotWvof.weaving_number}</strong>
                </p>
              </div>
              <button
                onClick={() => setAllotWvof(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted-current)', cursor: 'pointer', fontSize: '1.5rem', fontWeight: '300', padding: '4px' }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              backgroundColor: 'var(--bg-current)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              {allotError && (
                <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem 1rem', color: '#b91c1c', fontSize: '0.825rem' }}>
                  {allotError}
                </div>
              )}

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', backgroundColor: 'rgba(128,0,0,0.02)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-current)' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase' }}>Scope / Partner</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '700' }}>
                    {allotWvof.weaving_type === 'in_house' ? 'In-House Loom Shed' : `${allotWvof.partner_name || 'Not Assigned'}`}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase' }}>Loom Allocation</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '700' }}>{allotWvof.machine_name || 'Unassigned'}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase' }}>Design Spec</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '700' }}>
                    {allotWvof.order?.design_no || allotWvof.design_no} {allotWvof.order?.design_name ? `/ ${allotWvof.order.design_name}` : ''}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase' }}>Order Number</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '700' }}>{allotWvof.order?.order_number || '—'}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase' }}>Order Qty</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '700' }}>
                    {allotWvof.order?.total_quantity ? `${Number(allotWvof.order.total_quantity).toLocaleString()} Mtrs` : '—'}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase' }}>Production Qty</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '700' }}>
                    {allotWvof.order?.technical_specs?.production_quantity ? `${allotWvof.order.technical_specs.production_quantity} Mtrs` : '—'}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase' }}>Timeline</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '700' }}>{allotWvof.start_date || '—'} to {allotWvof.end_date || '—'}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase' }}>Weaving Qty</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '700' }}>{Number(allotWvof.qty).toLocaleString()} Mtrs</span>
                </div>
              </div>

              {/* Table 1: Order Weft Requirements */}
              {allotWvof && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: '800', color: '#800000' }}>
                    Order Weft Yarn Requirements
                  </h4>
                  <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '1px solid var(--border-current)' }}>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Colour</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Yarn Count</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Order Requirement (kg)</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Weaving Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {((allotWvof.order?.yarn_requirements || []).filter(y => y.type === 'weft')).map((req, idx) => {
                          const countId = req.countId || req.count_id;
                          const yc = yarnCounts.find(y => y.id === countId);
                          const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (req.countValue || req.count_value || '—');
                          return (
                            <tr key={idx} style={{ borderBottom: idx !== ((allotWvof.order?.yarn_requirements || []).filter(y => y.type === 'weft')).length - 1 ? '1px solid var(--border-current)' : 'none' }}>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>{req.color || req.colour}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{countDisplay}</td>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>{Number(req.kg).toFixed(2)} kg</td>
                              <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted-current)' }}>{Number(allotWvof.qty).toLocaleString()} Mtrs</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Table of weft colours and counts */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: '800', color: '#800000', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Truck size={14} /> Weft Stock & Allotments
                </h4>
                {loadingAllotData ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted-current)', gap: '0.5rem' }}>
                    <Loader size={16} className="spin" /> Fetching dyed yarn stock...
                  </div>
                ) : allotRows.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--border-current)', borderRadius: '8px', color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>
                    No weft dyed yarn requirements defined for this order.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '1px solid var(--border-current)' }}>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Colour & Count</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Lot Number</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Location</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Available Qty (Stock)</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Allotted in Other WVOFs</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', width: '120px' }}>Allot Qty (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allotRows.map((row, index) => {
                          const ycDisplay = row.countValue || '—';
                          return (
                            <tr key={index} style={{ borderBottom: '1px solid var(--border-current)' }}>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>
                                <div>{row.colour}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '500' }}>{ycDisplay}</div>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace' }}>{row.lot_number}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{row.location_name}</td>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: row.available_qty > 0 ? '#16a34a' : 'var(--text-muted-current)' }}>
                                {row.available_qty.toFixed(2)} kg
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', color: row.other_allotted > 0 ? '#c2410c' : 'var(--text-muted-current)' }}>
                                {row.other_allotted.toFixed(2)} kg
                              </td>
                              <td style={{ padding: '0.4rem 0.75rem' }}>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  value={row.allotted_qty}
                                  onChange={e => setAllotRows(prev => prev.map((r, idx) => idx === index ? { ...r, allotted_qty: e.target.value } : r))}
                                  style={{
                                    width: '100%',
                                    padding: '0.3rem 0.5rem',
                                    border: '1px solid var(--border-current)',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    background: 'var(--surface-current)',
                                    color: 'var(--text-current)',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Timeline & Daily Production Plan */}
              <div style={{
                border: '1px solid var(--border-current)',
                borderRadius: '10px',
                padding: '1.25rem',
                backgroundColor: 'rgba(128,0,0,0.01)',
                marginTop: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <h4 style={{ margin: '0', fontSize: '0.85rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Timeline & Daily Production Plan
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.3rem', color: 'var(--text-muted-current)' }}>Start Date</label>
                    <input
                      type="date"
                      value={allotStartDate}
                      onChange={e => setAllotStartDate(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', background: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.3rem', color: 'var(--text-muted-current)' }}>End Date</label>
                    <input
                      type="date"
                      value={allotEndDate}
                      min={allotStartDate}
                      onChange={e => setAllotEndDate(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', background: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {allotStartDate && allotEndDate && allotPlannedProduction.length > 0 && (
                  <div>
                    <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Planned Daily Qty (Mtrs)
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                      {allotPlannedProduction.map((item, idx) => {
                        const d = new Date(item.date + 'T00:00:00');
                        const formattedDate = !isNaN(d.getTime()) 
                          ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                          : item.date;

                        return (
                          <div key={item.date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.5rem', border: '1px solid var(--border-current)', borderRadius: '6px', backgroundColor: 'var(--surface-current)' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-current)' }}>
                              {formattedDate}
                            </span>
                            <input
                              type="number"
                              placeholder="0"
                              value={item.qty}
                              onChange={e => {
                                const val = e.target.value;
                                setAllotPlannedProduction(prev => prev.map((p, i) => i === idx ? { ...p, qty: val } : p));
                              }}
                              style={{
                                width: '80px',
                                padding: '0.25rem 0.4rem',
                                border: '1px solid var(--border-current)',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                background: 'var(--surface-current)',
                                color: 'var(--text-current)',
                                boxSizing: 'border-box',
                                textAlign: 'right'
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-current)', backgroundColor: 'var(--surface-current)' }}>
              <button
                onClick={() => setAllotWvof(null)}
                style={{ border: '1px solid var(--border-current)', backgroundColor: 'transparent', color: 'var(--text-current)', padding: '0.55rem 1.25rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAllotSubmit}
                disabled={allotSubmitting || loadingAllotData}
                style={{
                  backgroundColor: '#800000',
                  border: 'none',
                  color: 'white',
                  padding: '0.55rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: (allotSubmitting || loadingAllotData) ? 0.7 : 1
                }}
              >
                {allotSubmitting ? <Loader size={14} className="spin" /> : null}
                Allot Order
              </button>
            </div>
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
    </div>
  );
}

// ── MultiSelectDropdown Helper ──────────────────────────────────────────────
function MultiSelectDropdown({ label, options, selectedValues, onChange, placeholder = "Select options..." }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', position: 'relative' }}>
      <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          minHeight: '38px',
          padding: '0.4rem 2rem 0.4rem 0.75rem', 
          border: '1px solid var(--border-current)', 
          borderRadius: '8px', 
          fontSize: '0.825rem', 
          background: 'var(--surface-current)', 
          color: selectedValues.length === 0 ? 'var(--text-muted-current)' : 'var(--text-current)', 
          cursor: 'pointer',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.25rem',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        {selectedValues.length === 0 ? placeholder : (
          selectedValues.map(val => (
            <span key={val} style={{ 
              backgroundColor: 'rgba(128,0,0,0.08)', 
              color: '#800000', 
              padding: '2px 8px', 
              borderRadius: '12px', 
              fontSize: '0.7rem', 
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              {val}
              <span onClick={(e) => { e.stopPropagation(); onChange(selectedValues.filter(v => v !== val)); }} style={{ cursor: 'pointer', fontWeight: '900' }}>×</span>
            </span>
          ))
        )}
        <ChevronDown size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)', pointerEvents: 'none' }} />
      </div>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setIsOpen(false)} />
          <div style={{ 
            position: 'absolute', 
            top: '100%', 
            left: 0, 
            right: 0, 
            backgroundColor: '#fff', 
            border: '1px solid #e2e8f0', 
            borderRadius: '8px', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
            maxHeight: '200px', 
            overflowY: 'auto', 
            zIndex: 999,
            marginTop: '4px'
          }}>
            {options.map(opt => {
              const isChecked = selectedValues.includes(opt);
              return (
                <div 
                  key={opt}
                  onClick={() => {
                    if (isChecked) {
                      onChange(selectedValues.filter(v => v !== opt));
                    } else {
                      onChange([...selectedValues, opt]);
                    }
                  }}
                  style={{ 
                    padding: '0.5rem 0.75rem', 
                    fontSize: '0.8rem', 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    backgroundColor: isChecked ? 'rgba(128,0,0,0.02)' : 'transparent',
                    color: isChecked ? '#800000' : 'var(--text-current)',
                    fontWeight: isChecked ? '600' : '500',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  <input 
                    type="checkbox" 
                    checked={isChecked} 
                    onChange={() => {}} 
                    style={{ accentColor: '#800000', cursor: 'pointer' }}
                  />
                  <span>{opt}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
