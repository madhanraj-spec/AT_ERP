import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader, Search, RefreshCw, ChevronDown, ChevronRight, Calendar, AlertCircle, Layers, ChevronLeft, CheckCircle, Info, QrCode, ClipboardList, Droplet, Plus, Trash2, Play, Printer, X
} from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import EwayBillModal from '../../components/EwayBillModal';
import EwayBillPrintModal from '../../components/EwayBillPrintModal';

// --- Styling Constants ---
const DAY_COL_WIDTH = 44;
const LABEL_COL_WIDTH = 320;
const TOTAL_DAYS = 30;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// --- Barcode / QR Scanner Input Helper ---
function cleanScannerInput(str) {
  if (!str) return '';
  // Strip non-printable ASCII characters (handles barcode/QR scanner control codes)
  return str.replace(/[^\x20-\x7E]/g, '').trim();
}

// --- Date Helper Functions ---
function getLocalDateString(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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


// --- Custom Reusable MultiSelectDropdown Component ---
function MultiSelectDropdown({ label, options, selectedValues, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef(null);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleOption = (val) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  return (
    <div ref={containerRef} className="input-group" style={{ margin: 0, position: 'relative' }}>
      <label className="input-label" style={{ fontSize: '0.75rem', fontWeight: '700' }}>{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          minHeight: '38px',
          border: '1px solid var(--border-current)',
          borderRadius: 'var(--radius-md)',
          padding: '0.4rem 2rem 0.4rem 0.75rem',
          backgroundColor: 'white',
          fontSize: '0.78rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '4px',
          position: 'relative'
        }}
      >
        {selectedValues.length === 0 ? (
          <span style={{ color: 'var(--text-muted-current)', fontSize: '0.75rem' }}>{placeholder}</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '100%', overflow: 'hidden' }}>
            {selectedValues.length <= 1 ? (
              selectedValues.map(v => (
                <span 
                  key={v}
                  style={{
                    backgroundColor: 'rgba(5, 150, 105, 0.08)',
                    color: '#059669',
                    border: '1px solid rgba(5, 150, 105, 0.15)',
                    borderRadius: '4px',
                    padding: '1px 6px',
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    maxWidth: '100%',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden'
                  }}
                  title={v}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(v);
                  }}
                >
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{v}</span>
                  <X size={10} style={{ flexShrink: 0 }} />
                </span>
              ))
            ) : (
              <span 
                style={{
                  backgroundColor: 'rgba(5, 150, 105, 0.08)',
                  color: '#059669',
                  border: '1px solid rgba(5, 150, 105, 0.15)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {selectedValues.length} Selected
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange([]);
                  }}
                  style={{
                    border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                    color: '#059669', display: 'flex', alignItems: 'center'
                  }}
                >
                  <X size={10} />
                </button>
              </span>
            )}
          </div>
        )}
        <ChevronDown 
          size={14} 
          style={{ 
            position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted-current)',
            pointerEvents: 'none'
          }} 
        />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid var(--border-current)',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
          zIndex: 100,
          marginTop: '4px',
          maxHeight: '200px',
          overflowY: 'auto',
          padding: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          minWidth: 'max(100%, 280px)'
        }}>
          {options.length === 0 ? (
            <div style={{ color: 'var(--text-muted-current)', padding: '0.5rem', fontSize: '0.75rem', textAlign: 'center', fontStyle: 'italic' }}>
              No options available
            </div>
          ) : (
            options.map(opt => {
              const isChecked = selectedValues.includes(opt);
              return (
                <label 
                  key={opt}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.4rem 0.5rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    backgroundColor: isChecked ? 'rgba(5, 150, 105, 0.04)' : 'transparent',
                    transition: 'background-color 0.15s',
                    userSelect: 'none'
                  }}
                >
                  <input 
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOption(opt)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: isChecked ? '700' : '500', color: 'var(--text-current)' }}>{opt}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// --- Layout Lane Packing Algorithm ---
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

// --- Status Styles & Converters ---
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
      return { bg: '#fff7ed', border: '#f97316', text: '#c2410c', label: 'Stopped' };
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

function getUnifiedProductionDates(wvof) {
  const datesSet = new Set();
  
  if (wvof.planned_daily_production && Array.isArray(wvof.planned_daily_production)) {
    wvof.planned_daily_production.forEach(p => {
      if (p.date) datesSet.add(p.date);
    });
  }
  
  if (wvof.production_logs && Array.isArray(wvof.production_logs)) {
    wvof.production_logs.forEach(log => {
      const dStr = getLocalDateOnly(log.timestamp);
      if (dStr) datesSet.add(dStr);
    });
  }
  
  return Array.from(datesSet).sort();
}

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

// --- Mock Looms Fallback List ---
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


// --- Tooltip components for Greige Rolls details ---
function RollQRTooltip({ rollId, align = 'center', children }) {
  const [hovered, setHovered] = useState(false);
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (hovered && !qrUrl) {
      QRCode.toDataURL(rollId, { margin: 1, width: 120 }, (err, url) => {
        if (!err) {
          setQrUrl(url);
        }
      });
    }
  }, [hovered, rollId, qrUrl]);

  const tooltipStyle = {
    position: 'absolute',
    right: '105%',
    backgroundColor: '#1e293b',
    color: '#fff',
    borderRadius: '8px',
    padding: '0.75rem',
    boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    pointerEvents: 'none',
    border: '1px solid #334155',
    minWidth: '136px',
    ...(align === 'top' ? { top: '0px', transform: 'none' } :
       align === 'bottom' ? { bottom: '0px', transform: 'none' } :
       { top: '50%', transform: 'translateY(-50%)' })
  };

  const arrowStyle = {
    position: 'absolute',
    right: '-6px',
    width: 0, height: 0,
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    borderLeft: '6px solid #1e293b',
    ...(align === 'top' ? { top: '8px', transform: 'none' } :
       align === 'bottom' ? { bottom: '8px', transform: 'none' } :
       { top: '50%', transform: 'translateY(-50%)' })
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'inline-block', cursor: 'pointer', overflow: 'visible' }}
    >
      {children}
      {hovered && (
        <div style={tooltipStyle}>
          <div style={arrowStyle} />
          {qrUrl ? (
            <img src={qrUrl} alt="QR Code" style={{ width: '110px', height: '110px', display: 'block', borderRadius: '4px' }} />
          ) : (
            <div style={{ width: '110px', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader size={20} className="animate-spin" style={{ color: '#fbbf24' }} />
            </div>
          )}
          <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: '700', color: '#fbbf24', wordBreak: 'break-all', textAlign: 'center', maxWidth: '120px' }}>
            {rollId}
          </span>
        </div>
      )}
    </div>
  );
}

function RollScanTooltip({ roll, isReceived, align = 'center', children }) {
  const [hovered, setHovered] = useState(false);

  const formattedDateTime = () => {
    if (!roll.received_at) return '—';
    const d = new Date(roll.received_at);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const tooltipStyle = {
    position: 'absolute',
    right: '105%',
    backgroundColor: '#1e293b',
    color: '#fff',
    borderRadius: '8px',
    padding: '0.6rem 0.8rem',
    boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    pointerEvents: 'none',
    border: '1px solid #334155',
    minWidth: '180px',
    fontSize: '0.7rem',
    textAlign: 'left',
    lineHeight: '1.4',
    ...(align === 'top' ? { top: '0px', transform: 'none' } :
       align === 'bottom' ? { bottom: '0px', transform: 'none' } :
       { top: '50%', transform: 'translateY(-50%)' })
  };

  const arrowStyle = {
    position: 'absolute',
    right: '-6px',
    width: 0, height: 0,
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    borderLeft: '6px solid #1e293b',
    ...(align === 'top' ? { top: '8px', transform: 'none' } :
       align === 'bottom' ? { bottom: '8px', transform: 'none' } :
       { top: '50%', transform: 'translateY(-50%)' })
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
      {hovered && (
        <div style={tooltipStyle}>
          <div style={arrowStyle} />
          <div style={{ fontWeight: '800', borderBottom: '1px solid #334155', paddingBottom: '3px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>📥 Scan Status</span>
          </div>
          {isReceived ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div>
                <span style={{ color: '#94a3b8', fontWeight: '600' }}>Scanned At: </span>
                <span style={{ color: '#fff', fontWeight: '700' }}>{formattedDateTime()}</span>
              </div>
              {roll.location_name && (
                <div>
                  <span style={{ color: '#94a3b8', fontWeight: '600' }}>Location: </span>
                  <span style={{ color: '#fff', fontWeight: '700' }}>{roll.location_name}</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#f87171', fontWeight: '700' }}>
              Pending Input Scan
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RollProcessingTooltip({ roll, processingOrders, align = 'center', children }) {
  const [hovered, setHovered] = useState(false);

  const pof = useMemo(() => {
    if (!roll.isProcessed && !roll.isSentToProcessing) return null;
    return processingOrders.find(po => {
      const fabricRolls = Array.isArray(po.fabric_rolls) ? po.fabric_rolls : [];
      if (fabricRolls.some(r => r.id === roll.id || r.id === roll.greige_roll_id)) {
        return true;
      }
      const receivedRolls = Array.isArray(po.received_rolls) ? po.received_rolls : [];
      if (receivedRolls.some(r => r.id === roll.id || r.greige_roll_id === roll.id)) {
        return true;
      }
      return false;
    });
  }, [roll.id, roll.greige_roll_id, roll.isProcessed, roll.isSentToProcessing, processingOrders]);

  const tooltipStyle = {
    position: 'absolute',
    right: '105%',
    backgroundColor: '#1e293b',
    color: '#fff',
    borderRadius: '8px',
    padding: '0.6rem 0.8rem',
    boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    pointerEvents: 'none',
    border: '1px solid #334155',
    minWidth: '220px',
    fontSize: '0.7rem',
    textAlign: 'left',
    lineHeight: '1.4',
    ...(align === 'top' ? { top: '0px', transform: 'none' } :
       align === 'bottom' ? { bottom: '0px', transform: 'none' } :
       { top: '50%', transform: 'translateY(-50%)' })
  };

  const arrowStyle = {
    position: 'absolute',
    right: '-6px',
    width: 0, height: 0,
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    borderLeft: '6px solid #1e293b',
    ...(align === 'top' ? { top: '8px', transform: 'none' } :
       align === 'bottom' ? { bottom: '8px', transform: 'none' } :
       { top: '50%', transform: 'translateY(-50%)' })
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
      {hovered && (
        <div style={tooltipStyle}>
          <div style={arrowStyle} />
          <div style={{ fontWeight: '800', borderBottom: '1px solid #334155', paddingBottom: '3px', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>⚙️ Processing Info</span>
          </div>
          {pof ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div>
                <span style={{ color: '#94a3b8', fontWeight: '600' }}>POF No: </span>
                <span style={{ color: '#fff', fontWeight: '700' }}>{pof.pof_number}</span>
              </div>
              <div>
                <span style={{ color: '#94a3b8', fontWeight: '600' }}>Partner: </span>
                <span style={{ color: '#fff', fontWeight: '700' }}>{pof.partner_name}</span>
              </div>
              <div>
                <span style={{ color: '#94a3b8', fontWeight: '600' }}>Processes: </span>
                <span style={{ color: '#fbbf24', fontWeight: '700' }}>
                  {Array.isArray(pof.processes) ? pof.processes.join(', ') : (pof.processes || '—')}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: '#9ca3af', fontWeight: '700' }}>
              Not Sent to Processing / Pending Allocation
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- GanttBar Overlay Render Component ---
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
              <div>
                <span style={{ color: '#94a3b8', fontWeight: '600' }}>Actual Dates: </span>
                <span style={{ fontWeight: '700', color: '#bfdbfe' }}>
                  {wof.process_started_at
                    ? new Date(wof.process_started_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                    : '?'
                  }
                  {' → '}
                  {['completed', 'late_complete', 'stopped'].includes(wof.status)
                    ? (wof.process_completed_at
                        ? new Date(wof.process_completed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                        : (wof.status === 'stopped' ? 'Stopped' : 'Completed')
                      )
                    : 'Running (Today)'
                  }
                </span>
              </div>
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
                {tooltipType === 'planned' 
                  ? 'Planned' 
                  : tooltipType === 'actual' 
                    ? (['completed', 'late_complete'].includes(wof.status) 
                        ? 'Completed' 
                        : wof.status === 'stopped' 
                          ? (wof.wvofdc_number ? 'Stopped (Permanent)' : 'Stopped (Temporary)')
                          : 'On Process'
                      ) 
                    : sc.label
                }
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

// --- Main FabricInput Module Component ---
export default function FabricInput({ defaultView = 'menu' }) {
  const navigate = useNavigate();
  useAuth();

  const [viewMode, setViewMode] = useState(defaultView); // 'menu' | 'gantt' | 'greige_input' | 'washing_input'

  // Weaving Roll Label Generator states
  const [isGeneratingRolls, setIsGeneratingRolls] = useState(false);
  const [rollCountInput, setRollCountInput] = useState('');
  const [rollQuantities, setRollQuantities] = useState([]);
  const [isSavingRolls, setIsSavingRolls] = useState(false);

  // Data States
  const [weavingOrders, setWeavingOrders] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [inHouseMachines, setInHouseMachines] = useState([]);
  const [partners, setPartners] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter/Layout States
  const [currentTab, setCurrentTab] = useState('airjet'); // 'airjet' | 'rapier' | 'job_work' | 'wvof'
  const [searchText, setSearchText] = useState('');
  
  // Date sliding window
  const getInitialWindowStart = () => {
    const d = new Date();
    d.setDate(d.getDate() - 3); // Starts 3 days before today
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const [windowStart, setWindowStart] = useState(getInitialWindowStart());
  
  // Expandable list items states
  const [expandedMachines, setExpandedMachines] = useState({});
  const [expandedPartners, setExpandedPartners] = useState({});
  const [expandedWvofs, setExpandedWvofs] = useState({});
  const [expandedDates, setExpandedDates] = useState({});
  const [expandedChallans, setExpandedChallans] = useState({});
  
  // Selected WVOF for Modal overlay
  const [selectedWvof, setSelectedWvof] = useState(null);

  // --- New States for landing menu & inputs ---
  const [selectedWvofForLog, setSelectedWvofForLog] = useState('');
  const [logWeaver, setLogWeaver] = useState('');
  const [logQty, setLogQty] = useState('');
  const getTodayDateTimeString = () => {
    const now = new Date();
    const tzoffset = now.getTimezoneOffset() * 60000;
    return (new Date(now - tzoffset)).toISOString().slice(0, 16);
  };
  const [logDateTime, setLogDateTime] = useState(getTodayDateTimeString());
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [weavingWorkers, setWeavingWorkers] = useState([]);
  
  // Washing mock states
  const [washingLogs, setWashingLogs] = useState([
    { id: 'w-1', date: '2026-06-11', batch_no: 'WB-1049', order_no: 'AT/2026/ORD-001', design_no: 'DS-402', wash_type: 'Silicon Wash', input_qty: 450, output_qty: 432, shrinkage: '4.0%', status: 'Approved' },
    { id: 'w-2', date: '2026-06-10', batch_no: 'WB-1048', order_no: 'AT/2026/ORD-002', design_no: 'DS-322', wash_type: 'Enzyme Wash', input_qty: 300, output_qty: 285, shrinkage: '5.0%', status: 'Approved' }
  ]);
  const [newWashBatch, setNewWashBatch] = useState({
    order_id: '',
    batch_no: '',
    wash_type: 'Enzyme Wash',
    input_qty: '',
    output_qty: '',
    temp: '40',
    remarks: ''
  });

  // Loom Greige Input custom states
  const [greigeTab, setGreigeTab] = useState('scan'); // 'scan' | 'movement'
  const [scanInput, setScanInput] = useState('');
  const [scannedRolls, setScannedRolls] = useState([]);
  const [isReceivingRolls, setIsReceivingRolls] = useState(false);
  const [movementSelectedWvofId, setMovementSelectedWvofId] = useState('');
  const [isMovementFiltersExpanded, setIsMovementFiltersExpanded] = useState(false);

  // Greige Rolls Details custom states
  const [processingOrders, setProcessingOrders] = useState([]);
  const [selectedFilterRollIds, setSelectedFilterRollIds] = useState([]);
  const [selectedFilterTypes, setSelectedFilterTypes] = useState([]);
  const [selectedFilterPartners, setSelectedFilterPartners] = useState([]);
  const [selectedFilterWvofs, setSelectedFilterWvofs] = useState([]);
  const [selectedFilterOrderNumbers, setSelectedFilterOrderNumbers] = useState([]);
  const [selectedFilterDesignNames, setSelectedFilterDesignNames] = useState([]);
  const [selectedFilterDesignNos, setSelectedFilterDesignNos] = useState([]);
  const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState(false);
  const [isAirjetExpanded, setIsAirjetExpanded] = useState(true);
  const [isRapierExpanded, setIsRapierExpanded] = useState(true);
  const [isJobWorkExpanded, setIsJobWorkExpanded] = useState(true);
  const [expandedSubgroups, setExpandedSubgroups] = useState({});

  // Fabric Movement filters
  const [movFilterStatus, setMovFilterStatus] = useState('all'); // 'all' | 'pending' | 'on_process' | 'completed' | 'stopped'
  const [movFilterSelectedWvofs, setMovFilterSelectedWvofs] = useState([]); // array of WVOF numbers
  const [movFilterSelectedOrders, setMovFilterSelectedOrders] = useState([]); // array of order numbers
  const [movFilterSelectedPartners, setMovFilterSelectedPartners] = useState([]); // array of partner names
  const [movFilterSelectedMachines, setMovFilterSelectedMachines] = useState([]); // array of machine names
  const [movFilterScope, setMovFilterScope] = useState('all'); // 'all' | 'in_house' | 'job_work'
  const [movFilterDate, setMovFilterDate] = useState('');

  // Fabric Movement tracking states
  const [fabricMovements, setFabricMovements] = useState([]);
  const [showMoveFabricModal, setShowMoveFabricModal] = useState(false);
  const [movingRolls, setMovingRolls] = useState([]);
  const [fromLocation, setFromLocation] = useState('Factory');
  const [toLocation, setToLocation] = useState('Office');
  const [sentBy, setSentBy] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [showPrintChallanModal, setShowPrintChallanModal] = useState(false);
  const [activeChallan, setActiveChallan] = useState(null);
  const [showEwayModal, setShowEwayModal] = useState(false);
  const [showEwayPrintModal, setShowEwayPrintModal] = useState(false);
  const [fabricMovementTab, setFabricMovementTab] = useState('rolls');
  const [searchMoveRollId, setSearchMoveRollId] = useState('');

  const handleSaveGreigeLog = async (e) => {
    e.preventDefault();
    if (!selectedWvofForLog) {
      alert('Please select a Loom / Weaving Order Form.');
      return;
    }
    const selectedWv = weavingOrders.find(w => w.id === selectedWvofForLog);
    if (!selectedWv) {
      alert('Weaving order not found.');
      return;
    }
    const isJobWork = selectedWv?.weaving_type === 'job_work';

    if (!isJobWork && !logWeaver.trim()) {
      alert('Please enter or select a Weaver Name.');
      return;
    }
    if (!logQty || isNaN(parseFloat(logQty)) || parseFloat(logQty) <= 0) {
      alert('Please enter a valid Produced Quantity greater than 0.');
      return;
    }
    if (!logDateTime) {
      alert('Please select a Date & Time.');
      return;
    }

    setIsSavingLog(true);
    try {
      const newLog = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2, 9)),
        timestamp: new Date(logDateTime).toISOString(),
        weaver: isJobWork ? 'Job Work' : logWeaver.trim(),
        qty: parseFloat(logQty)
      };

      const currentLogs = Array.isArray(selectedWv.production_logs) ? selectedWv.production_logs : [];
      const updatedLogs = [...currentLogs, newLog];

      const { error } = await supabase
        .from('weaving_orders')
        .update({ production_logs: updatedLogs })
        .eq('id', selectedWv.id);

      if (error) throw error;

      alert(`✅ Loom Greige Input Logged successfully!\nLoom: ${selectedWv.machine_name || 'Job Work'}\nQty: ${logQty} m`);

      // Reset fields
      setLogWeaver('');
      setLogQty('');
      setLogDateTime(getTodayDateTimeString());
      setSelectedWvofForLog('');

      // Refresh data
      await fetchData();
    } catch (err) {
      console.error('Error saving production log:', err);
      alert('Failed to save log: ' + err.message);
    } finally {
      setIsSavingLog(false);
    }
  };

  const handleManualAdd = (e) => {
    if (e) e.preventDefault();
    const cleanedInput = cleanScannerInput(scanInput).toLowerCase();
    if (!cleanedInput) return;

    const match = allAvailableRolls.find(
      r => cleanScannerInput(r.id).toLowerCase() === cleanedInput
    );
    if (match) {
      const isAlreadyReceived = match.status === 'greige received' || match.status === '4_point_inspected' || match.status === 'sent_to_processing' || match.status === 'received_from_processing';
      if (isAlreadyReceived) {
        alert(`Roll ID "${scanInput}" is already greige input scanned.`);
        setScanInput('');
        return;
      }

      const alreadyScanned = scannedRolls.some(r => r.id === match.id);
      if (!alreadyScanned) {
        const factoryLoc = locations.find(l => l.location_name && l.location_name.trim().toLowerCase() === 'factory');
        const defaultLocId = factoryLoc?.id || locations[0]?.id || null;
        const defaultLocName = factoryLoc?.location_name || locations[0]?.location_name || '';

        setScannedRolls(prev => [...prev, {
          ...match,
          location_id: defaultLocId,
          location_name: defaultLocName
        }]);
      }
      setScanInput('');
    } else {
      alert(`Roll ID "${scanInput}" not found in any weaving order!`);
    }
  };

  const getNextGfrrNumber = (weavingOrder) => {
    const rolls = weavingOrder.fabric_rolls || [];
    const existingNumbers = rolls
      .map(r => r.gfrr_no)
      .filter(Boolean);
      
    if (existingNumbers.length === 0) {
      return `AT/2026/GFRR/${weavingOrder.weaving_number}/001`;
    }
    
    // Find the maximum sequence number
    let maxSeq = 0;
    existingNumbers.forEach(gfrr => {
      const parts = gfrr.split('/');
      const lastPart = parts[parts.length - 1];
      const seq = parseInt(lastPart, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    });
    
    const nextSeq = maxSeq + 1;
    const seqStr = String(nextSeq).padStart(3, '0');
    return `AT/2026/GFRR/${weavingOrder.weaving_number}/${seqStr}`;
  };

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

      reportData.forEach((section, sIdx) => {
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

  const handleReceiveScannedRolls = async () => {
    if (scannedRolls.length === 0) {
      alert('No fabric rolls scanned yet.');
      return;
    }
    
    setIsReceivingRolls(true);
    try {
      // Group scanned rolls by weaving order ID
      const groupedByOrder = {};
      scannedRolls.forEach(roll => {
        const orderId = roll.weavingOrder.id;
        if (!groupedByOrder[orderId]) {
          groupedByOrder[orderId] = [];
        }
        groupedByOrder[orderId].push(roll);
      });
      
      const receiptReportData = [];
      const receivedAtStr = new Date().toISOString();

      // Update each order in Supabase
      for (const orderId of Object.keys(groupedByOrder)) {
        const rollsToReceive = groupedByOrder[orderId];
        const rollIdsToReceive = rollsToReceive.map(r => r.id);
        
        // Fetch current fabric_rolls
        const { data: woData, error: fetchErr } = await supabase
          .from('weaving_orders')
          .select(`
            *,
            order:orders(id, order_number, design_no, design_name, total_quantity, yarn_requirements, technical_specs)
          `)
          .eq('id', orderId)
          .single();
          
        if (fetchErr) throw fetchErr;

        const isJobWork = woData.weaving_type === 'job_work';
        const gfrrNo = isJobWork ? getNextGfrrNumber(woData) : null;
        
        const currentRolls = Array.isArray(woData.fabric_rolls) ? woData.fabric_rolls : [];
        const updatedRolls = currentRolls.map(r => {
          const matchScanned = rollsToReceive.find(sr => sr.id === r.id);
          if (matchScanned) {
            const updatedRoll = {
              ...r,
              status: 'greige received',
              received_at: receivedAtStr,
              location_id: matchScanned.location_id,
              location_name: matchScanned.location_name
            };
            if (isJobWork) {
              updatedRoll.gfrr_no = gfrrNo;
            }
            return updatedRoll;
          }
          return r;
        });
        
        const { error: updateErr } = await supabase
          .from('weaving_orders')
          .update({ fabric_rolls: updatedRolls })
          .eq('id', orderId);
          
        if (updateErr) throw updateErr;

        if (isJobWork) {
          receiptReportData.push({
            weaving_number: woData.weaving_number,
            gfrr_no: gfrrNo,
            partner_name: woData.partner_name || 'Job Work Partner',
            machine_name: woData.machine_name || 'Job Work Loom',
            order_number: woData.order?.order_number || '—',
            design_no: woData.order?.design_no || woData.design_no || '—',
            design_name: woData.order?.design_name || '—',
            rolls: rollsToReceive.map(r => ({
              id: r.id,
              qty: r.qty
            })),
            received_at: receivedAtStr
          });
        }
      }
      
      alert(`✅ Successfully received ${scannedRolls.length} fabric rolls! Status updated to "greige received".`);
      setScannedRolls([]);
      await fetchData();
      
      // Trigger receipt print ONLY if there are job work rolls
      if (receiptReportData.length > 0) {
        handlePrintGfrrReceipt(receiptReportData);
      }
    } catch (err) {
      console.error('Error receiving fabric rolls:', err);
      alert('Failed to receive fabric rolls: ' + err.message);
    } finally {
      setIsReceivingRolls(false);
    }
  };

  // Time navigation calculations
  const days = useMemo(() => getDaysArray(windowStart, TOTAL_DAYS), [windowStart]);

  const monthGroups = useMemo(() => {
    const groups = [];
    let currentGroup = null;

    days.forEach(d => {
      const monthLabel = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      if (!currentGroup || currentGroup.label !== monthLabel) {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = { label: monthLabel, count: 1 };
      } else {
        currentGroup.count++;
      }
    });
    if (currentGroup) {
      groups.push(currentGroup);
    }
    return groups;
  }, [days]);

  const slideWindow = (dir) => {
    setWindowStart(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + dir * 7); // Slide by 7 days
      return next;
    });
  };

  const goToToday = () => {
    setWindowStart(getInitialWindowStart());
  };

  // --- Fetching Logic ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch weaving orders
      const { data: ordersData, error: ordersErr } = await supabase
        .from('weaving_orders')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name, total_quantity, yarn_requirements, technical_specs)
        `)
        .order('created_at', { ascending: false });

      if (ordersErr) throw ordersErr;
      const loadedOrders = ordersData || [];
      setWeavingOrders(loadedOrders);

      // 2. Fetch deliveries for Weft status
      if (loadedOrders.length > 0) {
        const { data: delData, error: delErr } = await supabase
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
          .in('production_form_id', loadedOrders.map(w => w.id));

        if (!delErr) setDeliveries(delData || []);
      } else {
        setDeliveries([]);
      }

      // 3. Fetch Master Departments
      const { data: deptData } = await supabase
        .from('master_departments')
        .select('id')
        .ilike('department_name', '%weaving%');
      const weavingDeptIds = (deptData || []).map(d => d.id);

      // 4. Fetch In-House Machines
      let inHouseData = [];
      if (weavingDeptIds.length > 0) {
        const { data } = await supabase
          .from('master_machines')
          .select('*, master_departments(department_name)')
          .in('department_id', weavingDeptIds)
          .eq('scope', 'in_house');
        inHouseData = data || [];
      }
      if (inHouseData.length === 0) {
        const { data } = await supabase
          .from('master_machines')
          .select('*, master_departments(department_name)')
          .eq('scope', 'in_house');
        inHouseData = data || [];
      }
      setInHouseMachines(inHouseData);

      // 5. Fetch Partners
      const { data: partnerData } = await supabase
        .from('master_partners')
        .select('*')
        .ilike('partner_type', '%weaving%');
      setPartners(partnerData || []);

      // Fetch Locations
      const { data: locData } = await supabase
        .from('master_locations')
        .select('*');
      
      const filteredLocs = (locData || []).filter(l => {
        const name = (l.location_name || '').trim().toLowerCase();
        return name === 'factory' || name === 'office';
      });
      
      // Fallback fallback if Factory or Office aren't present in DB
      if (!filteredLocs.some(l => l.location_name.trim().toLowerCase() === 'factory')) {
        filteredLocs.push({ id: 'factory-fallback', location_name: 'Factory', warehouse_type: 'Fabric Warehouse' });
      }
      if (!filteredLocs.some(l => l.location_name.trim().toLowerCase() === 'office')) {
        filteredLocs.push({ id: 'office-fallback', location_name: 'Office', warehouse_type: 'Fabric Warehouse' });
      }
      
      setLocations(filteredLocs);

      // 5b. Fetch Weaving Workers
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
      } catch (workerErr) {
        console.error('Error fetching weaving workers:', workerErr);
      }

      // 6. Fetch Job Work Machines (Grouped dynamically from active orders)

      // 7. Fetch Processing Orders for tracking processing status
      let poData = [];
      try {
        const { data, error: poErr } = await supabase
          .from('processing_orders')
          .select('id, pof_number, partner_name, processes, fabric_rolls, received_rolls, received_place');
        if (!poErr) {
          poData = data || [];
          setProcessingOrders(poData);
        }
      } catch (poErr) {
        console.error('Error fetching processing orders:', poErr);
      }

      // 8. Fetch Fabric Movements
      let fmData = [];
      try {
        const { data, error: fmErr } = await supabase
          .from('fabric_movements')
          .select('*')
          .order('created_at', { ascending: false });
        if (!fmErr) {
          fmData = data || [];
          setFabricMovements(fmData);
        } else {
          console.warn('Fabric movements table not loaded:', fmErr.message);
        }
      } catch (fmErr) {
        console.error('Error fetching fabric movements:', fmErr);
      }

      // 9. Reconcile and self-heal roll locations for all fabric movements
      if (fmData.length > 0) {
        let localWeavingOrders = [...loadedOrders];
        let localProcessingOrders = [...poData];
        let wasWeavingUpdated = false;
        let wasProcessingUpdated = false;

        // Process from oldest to newest so latest movement wins
        const sortedMovements = [...fmData].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

        for (const challan of sortedMovements) {
          const weavingUpdates = {};
          const processingUpdates = {};

          for (const roll of (challan.rolls || [])) {
            if (roll.isProcessed) {
              const po = localProcessingOrders.find(p =>
                Array.isArray(p.received_rolls) &&
                p.received_rolls.some(rx => (rx.id === roll.id || rx.greige_roll_id === roll.id) && rx.location_name !== challan.to_location)
              );
              if (po) {
                if (!processingUpdates[po.id]) {
                  processingUpdates[po.id] = [];
                }
                processingUpdates[po.id].push(roll.id);
              }
            } else {
              const wo = localWeavingOrders.find(w =>
                Array.isArray(w.fabric_rolls) &&
                w.fabric_rolls.some(r => r.id === roll.id && r.location_name !== challan.to_location)
              );
              if (wo) {
                if (!weavingUpdates[wo.id]) {
                  weavingUpdates[wo.id] = [];
                }
                weavingUpdates[wo.id].push(roll.id);
              }
            }
          }

          // Apply updates to Weaving Orders
          for (const woId of Object.keys(weavingUpdates)) {
            const wo = localWeavingOrders.find(w => w.id === woId);
            if (wo) {
              const rollIdsToUpdate = weavingUpdates[woId];
              const updatedFabricRolls = wo.fabric_rolls.map(r => {
                if (rollIdsToUpdate.includes(r.id)) {
                  return { ...r, location_name: challan.to_location };
                }
                return r;
              });

              await supabase
                .from('weaving_orders')
                .update({ fabric_rolls: updatedFabricRolls })
                .eq('id', woId);

              wo.fabric_rolls = updatedFabricRolls;
              wasWeavingUpdated = true;
            }
          }

          // Apply updates to Processing Orders
          for (const poId of Object.keys(processingUpdates)) {
            const po = localProcessingOrders.find(p => p.id === poId);
            if (po) {
              const rollIdsToUpdate = processingUpdates[poId];
              const updatedReceivedRolls = po.received_rolls.map(rx => {
                if (rollIdsToUpdate.includes(rx.id) || rollIdsToUpdate.includes(rx.greige_roll_id)) {
                  return { ...rx, location_name: challan.to_location };
                }
                return rx;
              });

              await supabase
                .from('processing_orders')
                .update({ received_rolls: updatedReceivedRolls })
                .eq('id', poId);

              po.received_rolls = updatedReceivedRolls;
              wasProcessingUpdated = true;
            }
          }
        }

        if (wasWeavingUpdated) {
          setWeavingOrders([...localWeavingOrders]);
        }
        if (wasProcessingUpdated) {
          setProcessingOrders([...localProcessingOrders]);
        }
      }

    } catch (err) {
      console.error('Error fetching Fabric Input data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [viewMode, greigeTab]);

  useEffect(() => {
    if (!selectedWvof) {
      setIsGeneratingRolls(false);
      setRollCountInput('');
      setRollQuantities([]);
    }
  }, [selectedWvof]);

  const allAvailableRolls = useMemo(() => {
    const rolls = [];
    weavingOrders.forEach(wo => {
      if (wo.fabric_rolls && Array.isArray(wo.fabric_rolls)) {
        wo.fabric_rolls.forEach(r => {
          rolls.push({
            ...r,
            weavingOrder: wo
          });
        });
      }
    });
    return rolls;
  }, [weavingOrders]);

  const processingRollIds = useMemo(() => {
    const ids = new Set();
    processingOrders.forEach(po => {
      const rolls = Array.isArray(po.fabric_rolls) ? po.fabric_rolls : [];
      rolls.forEach(r => {
        if (r && r.id) {
          ids.add(r.id);
        }
      });
    });
    return ids;
  }, [processingOrders]);

  useEffect(() => {
    const cleanedInput = cleanScannerInput(scanInput).toLowerCase();
    if (!cleanedInput) return;
    
    // Find matching roll in allAvailableRolls
    const match = allAvailableRolls.find(
      r => cleanScannerInput(r.id).toLowerCase() === cleanedInput
    );
    
    if (match) {
      // Check if it's already scanned/received in the database
      const isAlreadyReceived = match.status === 'greige received' || match.status === '4_point_inspected' || match.status === 'sent_to_processing' || match.status === 'received_from_processing';
      if (isAlreadyReceived) {
        alert(`Roll ID "${scanInput}" is already greige input scanned.`);
        setScanInput('');
        return;
      }

      // Check if it's already in scannedRolls
      const alreadyScanned = scannedRolls.some(r => r.id === match.id);
      if (!alreadyScanned) {
        const factoryLoc = locations.find(l => l.location_name && l.location_name.trim().toLowerCase() === 'factory');
        const defaultLocId = factoryLoc?.id || locations[0]?.id || null;
        const defaultLocName = factoryLoc?.location_name || locations[0]?.location_name || '';

        setScannedRolls(prev => [...prev, {
          ...match,
          location_id: defaultLocId,
          location_name: defaultLocName
        }]);
      }
      setScanInput(''); // Clear input for next scan
    }
  }, [scanInput, allAvailableRolls, scannedRolls, locations]);

  const handleUpdateStatus = async (orderId, currentStatus, newStatus, plannedEndDate) => {
    try {
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
      
      // Update local state details if open
      if (selectedWvof && selectedWvof.id === orderId) {
        setSelectedWvof(prev => ({
          ...prev,
          status: finalStatus,
          process_started_at: newStatus === 'on_process' ? updates.process_started_at : prev.process_started_at,
          process_completed_at: newStatus === 'completed' ? updates.process_completed_at : prev.process_completed_at
        }));
      }

      await fetchData();
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update status: ' + err.message);
    }
  };

  const handlePrintRollLabels = async (rollsToPrint) => {
    // Open print window synchronously to bypass browser popup blocker
    const win = window.open('', '_blank');
    if (!win) {
      alert('Failed to print: Popup blocker is active. Please allow popups for this site.');
      return;
    }

    // Write loading text
    win.document.write('<html><body><div style="font-family:sans-serif;padding:20px;text-align:center;color:#666;">Generating QR Code labels, please wait...</div></body></html>');
    win.document.close();

    try {
      const rollsWithQr = await Promise.all(rollsToPrint.map(async (roll) => {
        return new Promise((resolve) => {
          QRCode.toDataURL(roll.id, { margin: 1, width: 120 }, (err, url) => {
            if (err) {
              console.error('QR generation error:', err);
              resolve({ ...roll, qrCodeUrl: '' });
            } else {
              resolve({ ...roll, qrCodeUrl: url });
            }
          });
        });
      }));

      // Clear the loading text and write actual labels HTML
      win.document.open();
      const labelsHtml = rollsWithQr.map(roll => {
        const weavingNum = roll.weaving_number || selectedWvof?.weaving_number || '—';
        const orderNo = roll.order_number || selectedWvof?.order?.order_number || '—';
        const designNo = roll.design_no || selectedWvof?.order?.design_no || selectedWvof?.design_no || '—';
        const designName = roll.design_name || selectedWvof?.order?.design_name || '—';
        const rollNum = roll.roll_no ? String(roll.roll_no).padStart(2, '0') : String(roll.id).slice(-2);
        return `
        <div class="label-container">
          <div class="label-left">
            <div class="field-row">
              <span class="field-label">ROLL ID:</span>
              <span class="field-value roll-id">${roll.id}</span>
            </div>
            <div class="field-row">
              <span class="field-label">ORDER FORM:</span>
              <span class="field-value">${weavingNum}</span>
            </div>
            <div class="field-row">
              <span class="field-label">ORDER NO:</span>
              <span class="field-value">${orderNo}</span>
            </div>
            <div class="field-row">
              <span class="field-label">DESIGN NO:</span>
              <span class="field-value">${designNo}</span>
            </div>
            <div class="field-row">
              <span class="field-label">DESIGN NAME:</span>
              <span class="field-value">${designName}</span>
            </div>
            <div class="field-row" style="margin-top: 2px;">
              <span class="field-label" style="font-size: 8px;">QUANTITY:</span>
              <span class="field-value qty-val">${roll.qty} Mtrs</span>
            </div>
          </div>
          <div class="label-right">
            ${roll.qrCodeUrl ? `<img class="qr-code" src="${roll.qrCodeUrl}" alt="QR" />` : '<div class="qr-placeholder">No QR</div>'}
            <div class="roll-number">Roll #${rollNum}</div>
          </div>
        </div>
        `;
      }).join('');

      win.document.write(`
        <html>
          <head>
            <title>Fabric Roll Labels - ${rollsToPrint[0]?.weaving_number || selectedWvof?.weaving_number || 'Labels'}</title>
            <style>
              @page {
                size: 9cm 5cm;
                margin: 0;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                background: white;
                color: #000;
                width: 9cm;
                height: 5cm;
              }
              .label-container {
                width: 9cm;
                height: 5cm;
                padding: 0.3cm;
                display: flex;
                border: 1px dashed #ccc;
                page-break-after: always;
                position: relative;
                overflow: hidden;
              }
              @media print {
                .label-container {
                  border: none;
                }
              }
              .label-left {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                padding-right: 0.2cm;
              }
              .label-right {
                width: 2.8cm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-left: 1px dashed #ddd;
                padding-left: 0.15cm;
              }
              .field-row {
                display: flex;
                align-items: baseline;
                margin-bottom: 1px;
                line-height: 1.1;
              }
              .field-label {
                font-size: 6.5px;
                font-weight: 800;
                color: #555;
                width: 1.8cm;
                flex-shrink: 0;
                letter-spacing: 0.02em;
              }
              .field-value {
                font-size: 8px;
                font-weight: 700;
                color: #000;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .field-value.roll-id {
                font-family: monospace;
                font-size: 8.5px;
                font-weight: 900;
              }
              .field-value.qty-val {
                font-size: 12px;
                font-weight: 900;
                color: #000;
              }
              .qr-code {
                width: 2.2cm;
                height: 2.2cm;
                object-fit: contain;
              }
              .qr-placeholder {
                width: 2.2cm;
                height: 2.2cm;
                border: 1px solid #ccc;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 8px;
              }
              .roll-number {
                font-size: 8px;
                font-weight: 800;
                margin-top: 4px;
                background: #000;
                color: #fff;
                padding: 1px 6px;
                border-radius: 3px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              }
            </style>
          </head>
          <body>
            ${labelsHtml}
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
    } catch (printErr) {
      console.error('Error opening print window:', printErr);
      alert('Failed to print labels: ' + printErr.message);
    }
  };

  const handleRollCountChange = (val) => {
    setRollCountInput(val);
    const count = parseInt(val) || 0;
    if (count <= 0) {
      setRollQuantities([]);
      return;
    }

    const currentRolls = selectedWvof.fabric_rolls || [];
    const prefix = `${selectedWvof.weaving_number}/`;
    const maxRollNo = currentRolls.reduce((max, r) => {
      if (r.id && r.id.startsWith(prefix)) {
        const relativePart = r.id.slice(prefix.length);
        const firstSegment = relativePart.split('/')[0];
        const num = parseInt(firstSegment, 10);
        return !isNaN(num) ? Math.max(max, num) : max;
      }
      const rollNoNum = Number(r.roll_no);
      if (rollNoNum && rollNoNum < 100) {
        return Math.max(max, rollNoNum);
      }
      return max;
    }, 0);
    const startSeq = maxRollNo + 1;
    const list = [];
    for (let i = 0; i < count; i++) {
      const seqNo = startSeq + i;
      const seqStr = String(seqNo).padStart(3, '0');
      const rollId = `${selectedWvof.weaving_number}/${seqStr}`;
      list.push({
        id: rollId,
        roll_no: seqNo,
        qty: ''
      });
    }
    setRollQuantities(list);
  };

  const handleSaveRollLabels = async (e) => {
    e.preventDefault();
    if (rollQuantities.length === 0) return;

    for (let i = 0; i < rollQuantities.length; i++) {
      const q = rollQuantities[i].qty;
      if (q === '' || isNaN(parseFloat(q)) || parseFloat(q) <= 0) {
        alert(`Please enter a valid quantity for Roll ${rollQuantities[i].id}`);
        return;
      }
    }

    const totalProduced = (selectedWvof.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
    const alreadyGenerated = (selectedWvof.fabric_rolls || []).reduce((sum, roll) => sum + (parseFloat(roll.qty) || 0), 0);
    const newQty = rollQuantities.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0);

    if (alreadyGenerated + newQty > totalProduced) {
      alert(`Cannot generate QR: Total QR quantity (${(alreadyGenerated + newQty).toFixed(2)} m) exceeds Weaving Production Logs (${totalProduced.toFixed(2)} m). Remaining quantity allowed: ${(totalProduced - alreadyGenerated).toFixed(2)} m.`);
      return;
    }

    setIsSavingRolls(true);
    try {
      const newRollsToInsert = rollQuantities.map((r) => ({
        id: r.id,
        roll_no: r.roll_no,
        qty: parseFloat(r.qty),
        created_at: new Date().toISOString()
      }));

      const currentRolls = Array.isArray(selectedWvof.fabric_rolls) ? selectedWvof.fabric_rolls : [];
      const updatedRolls = [...currentRolls, ...newRollsToInsert];

      const { error } = await supabase
        .from('weaving_orders')
        .update({ fabric_rolls: updatedRolls })
        .eq('id', selectedWvof.id);

      if (error) throw error;

      alert(`✅ Successfully registered ${newRollsToInsert.length} fabric rolls!`);

      const updatedWvof = { ...selectedWvof, fabric_rolls: updatedRolls };
      setSelectedWvof(updatedWvof);
      setIsGeneratingRolls(false);
      setRollCountInput('');
      setRollQuantities([]);

      await fetchData();

      await handlePrintRollLabels(newRollsToInsert);
    } catch (err) {
      console.error('Error saving fabric rolls:', err);
      alert('Failed to register fabric rolls: ' + err.message);
    } finally {
      setIsSavingRolls(false);
    }
  };

  const handleDeleteRoll = async (rollId) => {
    if (!window.confirm(`Are you sure you want to delete fabric roll ${rollId}?`)) {
      return;
    }

    try {
      const currentRolls = Array.isArray(selectedWvof.fabric_rolls) ? selectedWvof.fabric_rolls : [];
      const updatedRolls = currentRolls.filter(r => r.id !== rollId);

      const { error } = await supabase
        .from('weaving_orders')
        .update({ fabric_rolls: updatedRolls })
        .eq('id', selectedWvof.id);

      if (error) throw error;

      alert(`✅ Fabric roll ${rollId} deleted successfully!`);

      // Update local state details
      setSelectedWvof(prev => ({ ...prev, fabric_rolls: updatedRolls }));

      // Refresh dashboard data
      await fetchData();

    } catch (err) {
      console.error('Error deleting fabric roll:', err);
      alert('Failed to delete fabric roll: ' + err.message);
    }
  };

  // Expand togglers
  const toggleMachine = (id) => {
    setExpandedMachines(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const togglePartner = (id) => {
    setExpandedPartners(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleWvof = (id) => {
    setExpandedWvofs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filters data based on Search Text and sorts by start_date ascending (earliest first)
  const filteredOrders = useMemo(() => {
    let res = weavingOrders;
    if (searchText.trim()) {
      const s = searchText.toLowerCase();
      res = weavingOrders.filter(o => 
        (o.weaving_number && o.weaving_number.toLowerCase().includes(s)) ||
        (o.design_no && o.design_no.toLowerCase().includes(s)) ||
        (o.machine_name && o.machine_name.toLowerCase().includes(s)) ||
        (o.partner_name && o.partner_name.toLowerCase().includes(s)) ||
        (o.order?.order_number && o.order.order_number.toLowerCase().includes(s))
      );
    }
    return [...res].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || '') || (a.end_date || '').localeCompare(b.end_date || ''));
  }, [weavingOrders, searchText]);

  // Grouping / Mapping for Airjet looms
  const airjetLooms = useMemo(() => getLooms(inHouseMachines, 'airjet'), [inHouseMachines]);
  const airjetOrdersByMachine = useMemo(() => {
    const map = {};
    airjetLooms.forEach(l => {
      const orders = getOrdersForMachine(l, filteredOrders);
      orders.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || '') || (a.end_date || '').localeCompare(b.end_date || ''));
      map[l.id] = orders;
    });
    return map;
  }, [airjetLooms, filteredOrders]);

  // Grouping / Mapping for Rapier looms
  const rapierLooms = useMemo(() => getLooms(inHouseMachines, 'rapier'), [inHouseMachines]);
  const rapierOrdersByMachine = useMemo(() => {
    const map = {};
    rapierLooms.forEach(l => {
      const orders = getOrdersForMachine(l, filteredOrders);
      orders.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || '') || (a.end_date || '').localeCompare(b.end_date || ''));
      map[l.id] = orders;
    });
    return map;
  }, [rapierLooms, filteredOrders]);

  // Grouping / Mapping for Job Work tab: grouped by Partner
  const jobWorkData = useMemo(() => {
    const jwOrders = filteredOrders.filter(o => o.weaving_type === 'job_work');
    
    // Group active orders by partner_id or name
    const grouped = {};
    
    // Map partners from master list first to populate empty partners if needed
    partners.forEach(p => {
      grouped[p.id] = {
        partnerId: p.id,
        partnerName: p.partner_name,
        machines: [],
        ordersWithoutMachine: []
      };
    });

    jwOrders.forEach(o => {
      const pId = o.partner_id || 'unassigned';
      const pName = o.partner_name || 'Unassigned Partner';

      if (!grouped[pId]) {
        grouped[pId] = {
          partnerId: pId,
          partnerName: pName,
          machines: [],
          ordersWithoutMachine: []
        };
      }

      if (o.machine_id || o.machine_name) {
        const mKey = o.machine_id || o.machine_name;
        // Check if machine is already inside partner.machines
        let mObj = grouped[pId].machines.find(m => m.id === mKey || m.name === o.machine_name);
        if (!mObj) {
          mObj = {
            id: o.machine_id || `jw-m-${o.machine_name}`,
            name: o.machine_name || 'Loom Machine',
            orders: []
          };
          grouped[pId].machines.push(mObj);
        }
        mObj.orders.push(o);
      } else {
        grouped[pId].ordersWithoutMachine.push(o);
      }
    });

    // Sort orders inside each machine and orders without machine by start_date ascending (earliest first)
    Object.values(grouped).forEach(g => {
      g.machines.forEach(m => {
        m.orders.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || '') || (a.end_date || '').localeCompare(b.end_date || ''));
      });
      g.ordersWithoutMachine.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || '') || (a.end_date || '').localeCompare(b.end_date || ''));
    });

    // Clean up empty partners that have no orders and no predefined machines (or we can show all partners)
    return Object.values(grouped).filter(g => 
      g.ordersWithoutMachine.length > 0 || 
      g.machines.length > 0 || 
      partners.some(p => p.id === g.partnerId)
    );
  }, [partners, filteredOrders]);

  // ── Landing Menu Page ──
  const renderLandingMenu = () => {
    return (
      <div style={{ width: '100%', padding: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
          <button
            onClick={() => navigate('/production')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', borderRadius: '10px',
              border: '1px solid var(--border-current)', background: 'var(--surface-current)',
              cursor: 'pointer', color: 'var(--text-current)', transition: 'all 0.15s'
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-current)' }}>
              <Layers size={22} color="#059669" />
              Fabric Input
            </h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted-current)' }}>
              Restructured workflow options for loom QR scans, greige logging, and fabric washing
            </p>
          </div>
        </div>

        {/* Choice Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2.5rem'
        }}>
          {/* Card 1: Loom QR Generator */}
          <div
            className="hover-lift"
            onClick={() => setViewMode('gantt')}
            style={{
              backgroundColor: 'var(--surface-current)',
              border: '1px solid var(--border-current)',
              borderRadius: '16px',
              padding: '2rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute', top: 0, right: 0,
              width: '120px', height: '120px', borderRadius: '0 16px 0 120px',
              background: 'rgba(5, 150, 105, 0.06)', pointerEvents: 'none'
            }} />
            <div style={{
              width: '56px', height: '56px', borderRadius: '14px',
              backgroundColor: 'rgba(5, 150, 105, 0.08)',
              border: '1.5px solid rgba(5, 150, 105, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <QrCode size={28} color="#059669" />
            </div>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-current)' }}>
              Loom QR Generator
            </h2>
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted-current)', fontSize: '0.85rem', lineHeight: '1.6' }}>
              Access loom schedule timelines, view live Airjet and Rapier Gantt charts, and generate QR codes for warp/weft tracking.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#059669', fontWeight: '700', fontSize: '0.875rem' }}>
              Open Loom Timeline <ChevronRight size={16} />
            </div>
          </div>

          {/* Card 2: Loom Greige Input */}
          <div
            className="hover-lift"
            onClick={() => setViewMode('greige_input')}
            style={{
              backgroundColor: 'var(--surface-current)',
              border: '1px solid var(--border-current)',
              borderRadius: '16px',
              padding: '2rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute', top: 0, right: 0,
              width: '120px', height: '120px', borderRadius: '0 16px 0 120px',
              background: 'rgba(37, 99, 235, 0.06)', pointerEvents: 'none'
            }} />
            <div style={{
              width: '56px', height: '56px', borderRadius: '14px',
              backgroundColor: 'rgba(37, 99, 235, 0.08)',
              border: '1.5px solid rgba(37, 99, 235, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <ClipboardList size={28} color="#2563eb" />
            </div>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-current)' }}>
              Loom Greige Input
            </h2>
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted-current)', fontSize: '0.85rem', lineHeight: '1.6' }}>
              Log daily fabric outputs directly from the looms. Record weaver shifts, loom run states, and actual meterage logs.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#2563eb', fontWeight: '700', fontSize: '0.875rem' }}>
              Log Loom Output <ChevronRight size={16} />
            </div>
          </div>

          {/* Card 3: Greige Rolls Details */}
          <div
            className="hover-lift"
            onClick={() => setViewMode('greige_rolls_details')}
            style={{
              backgroundColor: 'var(--surface-current)',
              border: '1px solid var(--border-current)',
              borderRadius: '16px',
              padding: '2rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute', top: 0, right: 0,
              width: '120px', height: '120px', borderRadius: '0 16px 0 120px',
              background: 'rgba(99, 102, 241, 0.06)', pointerEvents: 'none'
            }} />
            <div style={{
              width: '56px', height: '56px', borderRadius: '14px',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1.5px solid rgba(99, 102, 241, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <Layers size={28} color="#6366f1" />
            </div>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-current)' }}>
              Greige Rolls Details
            </h2>
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted-current)', fontSize: '0.85rem', lineHeight: '1.6' }}>
              View all generated fabric rolls. Track scan statuses, location assignments, 4-point inspections, and processing status.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6366f1', fontWeight: '700', fontSize: '0.875rem' }}>
              View Rolls Details <ChevronRight size={16} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Loom Greige Input View ──
  const renderMovementWvofItem = (wo, selectedWv) => {
    const isSelected = selectedWv && selectedWv.id === wo.id;
    const badge = getWvofStatusBadge(wo);
    const yarnBadge = getWeftYarnStatus(wo, deliveries);
    return (
      <div
        key={wo.id}
        onClick={() => setMovementSelectedWvofId(wo.id)}
        style={{
          padding: '0.6rem 0.85rem',
          borderRadius: '8px',
          cursor: 'pointer',
          backgroundColor: isSelected ? 'rgba(5, 150, 105, 0.08)' : 'transparent',
          border: isSelected ? '1.5px solid #2563eb' : '1px solid var(--border-current)',
          transition: 'all 0.15s',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          marginBottom: '0.35rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <span style={{
            fontWeight: '800', fontSize: '0.75rem', fontFamily: 'monospace',
            color: isSelected ? '#2563eb' : 'var(--text-current)',
            wordBreak: 'break-all', whiteSpace: 'normal', flex: 1, marginRight: '0.5rem'
          }}>
            {wo.weaving_number}
          </span>
          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted-current)', fontWeight: '600', flexShrink: 0, whiteSpace: 'nowrap' }}>
            Loom: {wo.machine_name || 'Job Work'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted-current)' }}>
          <span>Order: {wo.order?.order_number || '—'}</span>
          <span>Design: {wo.order?.design_no || wo.design_no || '—'}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '2px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.55rem', fontWeight: '800',
            backgroundColor: badge.bg, color: badge.color,
            border: `1px solid ${badge.border}`,
            padding: '1px 5px', borderRadius: '4px',
            textTransform: 'uppercase'
          }}>
            {badge.label}
          </span>
          <span style={{
            fontSize: '0.55rem', fontWeight: '800',
            backgroundColor: yarnBadge.bg, color: yarnBadge.color,
            border: `1px solid ${yarnBadge.border}`,
            padding: '1px 5px', borderRadius: '4px',
            textTransform: 'uppercase'
          }}>
            Yarn: {yarnBadge.label}
          </span>
        </div>
      </div>
    );
  };

  const matchesFilter = (wo, filterName, excludeName = null) => {
    if (filterName === excludeName) return true;
    
    switch (filterName) {
      case 'status':
        if (movFilterStatus === 'all') return true;
        if (movFilterStatus === 'pending') return wo.status === 'pending';
        if (movFilterStatus === 'on_process') return wo.status === 'on_process';
        if (movFilterStatus === 'completed') return wo.status === 'completed' || wo.status === 'late_complete';
        if (movFilterStatus === 'stopped') return wo.status === 'stopped';
        return true;
        
      case 'wvof':
        if (movFilterSelectedWvofs.length === 0) return true;
        return movFilterSelectedWvofs.includes(wo.weaving_number);
        
      case 'order':
        if (movFilterSelectedOrders.length === 0) return true;
        return movFilterSelectedOrders.includes(wo.order?.order_number || '—');
        
      case 'partner':
        if (movFilterSelectedPartners.length === 0) return true;
        const pName = wo.weaving_type === 'job_work' ? (wo.partner_name || 'Job Work Partner') : 'In-House';
        return movFilterSelectedPartners.includes(pName);
        
      case 'machine':
        if (movFilterSelectedMachines.length === 0) return true;
        const mName = wo.weaving_type === 'in_house' ? (wo.machine_name || 'In-House Loom') : 'Job Work';
        return movFilterSelectedMachines.includes(mName);
        
      case 'scope':
        if (movFilterScope === 'all') return true;
        if (movFilterScope === 'in_house' && wo.weaving_type !== 'in_house') return false;
        if (movFilterScope === 'job_work' && wo.weaving_type !== 'job_work') return false;
        return true;
        
      case 'date':
        if (!movFilterDate) return true;
        const d = movFilterDate;
        if (wo.start_date && wo.end_date) {
          return d >= wo.start_date && d <= wo.end_date;
        } else if (wo.start_date) {
          return wo.start_date === d;
        }
        return false;
        
      default:
        return true;
    }
  };

  const getFilteredWeavingOrders = (excludeName = null) => {
    return weavingOrders.filter(wo => {
      return (
        matchesFilter(wo, 'status', excludeName) &&
        matchesFilter(wo, 'wvof', excludeName) &&
        matchesFilter(wo, 'order', excludeName) &&
        matchesFilter(wo, 'partner', excludeName) &&
        matchesFilter(wo, 'machine', excludeName) &&
        matchesFilter(wo, 'scope', excludeName) &&
        matchesFilter(wo, 'date', excludeName)
      );
    });
  };

  const movWvofOptions = useMemo(() => {
    const orders = getFilteredWeavingOrders('wvof');
    const set = new Set(orders.map(o => o.weaving_number).filter(Boolean));
    return Array.from(set).sort();
  }, [weavingOrders, movFilterStatus, movFilterSelectedOrders, movFilterSelectedPartners, movFilterSelectedMachines, movFilterScope, movFilterDate]);

  const movOrderOptions = useMemo(() => {
    const orders = getFilteredWeavingOrders('order');
    const set = new Set(orders.map(o => o.order?.order_number || '—').filter(Boolean));
    return Array.from(set).sort();
  }, [weavingOrders, movFilterStatus, movFilterSelectedWvofs, movFilterSelectedPartners, movFilterSelectedMachines, movFilterScope, movFilterDate]);

  const movPartnerOptions = useMemo(() => {
    const orders = getFilteredWeavingOrders('partner');
    const set = new Set(orders.map(o => o.weaving_type === 'job_work' ? (o.partner_name || 'Job Work Partner') : 'In-House').filter(Boolean));
    return Array.from(set).sort();
  }, [weavingOrders, movFilterStatus, movFilterSelectedWvofs, movFilterSelectedOrders, movFilterSelectedMachines, movFilterScope, movFilterDate]);

  const movMachineOptions = useMemo(() => {
    const orders = getFilteredWeavingOrders('machine');
    const set = new Set(orders.map(o => o.weaving_type === 'in_house' ? (o.machine_name || 'In-House Loom') : 'Job Work').filter(Boolean));
    return Array.from(set).sort();
  }, [weavingOrders, movFilterStatus, movFilterSelectedWvofs, movFilterSelectedOrders, movFilterSelectedPartners, movFilterScope, movFilterDate]);

  const movStatusCounts = useMemo(() => {
    const counts = { all: 0, pending: 0, on_process: 0, completed: 0, stopped: 0 };
    const orders = weavingOrders.filter(wo => {
      return (
        matchesFilter(wo, 'wvof') &&
        matchesFilter(wo, 'order') &&
        matchesFilter(wo, 'partner') &&
        matchesFilter(wo, 'machine') &&
        matchesFilter(wo, 'scope') &&
        matchesFilter(wo, 'date')
      );
    });
    
    orders.forEach(wo => {
      counts.all++;
      if (wo.status === 'pending') counts.pending++;
      else if (wo.status === 'on_process') counts.on_process++;
      else if (wo.status === 'completed' || wo.status === 'late_complete') counts.completed++;
      else if (wo.status === 'stopped') counts.stopped++;
    });
    return counts;
  }, [weavingOrders, movFilterSelectedWvofs, movFilterSelectedOrders, movFilterSelectedPartners, movFilterSelectedMachines, movFilterScope, movFilterDate]);

  const filteredForMovementMemo = useMemo(() => {
    return getFilteredWeavingOrders();
  }, [weavingOrders, movFilterStatus, movFilterSelectedWvofs, movFilterSelectedOrders, movFilterSelectedPartners, movFilterSelectedMachines, movFilterScope, movFilterDate]);

  // ── Loom Greige Input View ──
  const renderGreigeInputView = () => {
    // All filtering is now handled by the cascading memoized filteredForMovementMemo
    const filteredForMovement = filteredForMovementMemo;

    const airjetWvofs = filteredForMovement.filter(wo => wo.weaving_type === 'in_house' && (wo.machine_name || '').trim().toUpperCase().startsWith('AJ'));
    const rapierWvofs = filteredForMovement.filter(wo => wo.weaving_type === 'in_house' && (wo.machine_name || '').trim().toUpperCase().startsWith('AR'));
    const jobWorkWvofs = filteredForMovement.filter(wo => wo.weaving_type === 'job_work');

    // Grouping helper logic
    const airjetGroups = {};
    airjetWvofs.forEach(wo => {
      const loom = wo.machine_name || 'Unassigned Loom';
      if (!airjetGroups[loom]) airjetGroups[loom] = [];
      airjetGroups[loom].push(wo);
    });

    const rapierGroups = {};
    rapierWvofs.forEach(wo => {
      const loom = wo.machine_name || 'Unassigned Loom';
      if (!rapierGroups[loom]) rapierGroups[loom] = [];
      rapierGroups[loom].push(wo);
    });

    const jobWorkGroups = {};
    jobWorkWvofs.forEach(wo => {
      const partner = wo.partner_name || 'Job Work Partner';
      if (!jobWorkGroups[partner]) jobWorkGroups[partner] = [];
      jobWorkGroups[partner].push(wo);
    });

    const toggleSubgroup = (name) => {
      setExpandedSubgroups(prev => ({
        ...prev,
        [name]: prev[name] === false ? true : false
      }));
    };
    
    let selectedWv = null;
    if (movementSelectedWvofId) {
      selectedWv = weavingOrders.find(w => w.id === movementSelectedWvofId);
    }
    if (!selectedWv && filteredForMovement.length > 0) {
      selectedWv = filteredForMovement[0];
    }

    return (
      <div style={{ width: '100%', padding: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setViewMode('menu')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', borderRadius: '10px',
              border: '1px solid var(--border-current)', background: 'var(--surface-current)',
              cursor: 'pointer', color: 'var(--text-current)', transition: 'all 0.15s'
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-current)' }}>
              Loom Greige Input
            </h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.825rem', color: 'var(--text-muted-current)' }}>
              Input fabric rolls from looms and view movement summaries to the inspection area
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.75rem' }}>
          <button
            onClick={() => setGreigeTab('scan')}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '8px',
              border: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: '700',
              transition: 'all 0.15s',
              backgroundColor: greigeTab === 'scan' ? '#059669' : 'transparent',
              color: greigeTab === 'scan' ? 'white' : 'var(--text-muted-current)',
              boxShadow: greigeTab === 'scan' ? '0 4px 6px -1px rgba(5,150,105,0.2)' : 'none'
            }}
          >
            🔍 Scan QR / Receive Greige
          </button>
          <button
            onClick={() => setGreigeTab('movement')}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '8px',
              border: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: '700',
              transition: 'all 0.15s',
              backgroundColor: greigeTab === 'movement' ? '#059669' : 'transparent',
              color: greigeTab === 'movement' ? 'white' : 'var(--text-muted-current)',
              boxShadow: greigeTab === 'movement' ? '0 4px 6px -1px rgba(5,150,105,0.2)' : 'none'
            }}
          >
            📦 Fabric Movement Dashboard
          </button>
        </div>

        {greigeTab === 'scan' && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', alignItems: 'start' }}>
            {/* Scan Card */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem', fontWeight: '800', color: 'var(--text-current)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <QrCode size={18} color="#059669" /> Scan Barcode / QR Code
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div className="input-group">
                  <label className="input-label" style={{ fontWeight: '700', fontSize: '0.8rem' }}>Scan or Enter Fabric Roll ID</label>
                  <form onSubmit={handleManualAdd} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Scan QR or type ID..."
                      className="input-field"
                      autoFocus
                      value={scanInput}
                      onChange={e => setScanInput(e.target.value)}
                      style={{ flex: 1, fontSize: '0.9rem', padding: '0.5rem 0.75rem' }}
                    />
                    <button
                      type="submit"
                      className="btn"
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#059669',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      Add
                    </button>
                  </form>
                  <small style={{ color: 'var(--text-muted-current)', marginTop: '6px', display: 'block', fontSize: '0.72rem' }}>
                    Scanner automatically adds the roll. For manual entry, type the full Roll ID and press Enter or "Add".
                  </small>
                </div>
                
                <div style={{ borderTop: '1px solid var(--border-current)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                    <strong>Scanned Count:</strong> {scannedRolls.length} rolls ready for receipt.
                  </div>
                  
                  <button
                    onClick={handleReceiveScannedRolls}
                    disabled={isReceivingRolls || scannedRolls.length === 0}
                    style={{
                      width: '100%', padding: '0.75rem',
                      fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      backgroundColor: scannedRolls.length > 0 ? '#10b981' : '#cbd5e1',
                      color: 'white', border: 'none', borderRadius: '8px',
                      transition: 'background-color 0.2s',
                      boxShadow: scannedRolls.length > 0 ? '0 4px 12px -1px rgba(16,185,129,0.2)' : 'none'
                    }}
                  >
                    {isReceivingRolls ? (
                      <><Loader size={18} className="spin" /> Updating Status...</>
                    ) : (
                      <><CheckCircle size={18} /> Receive Scanned Rolls</>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Scanned Table */}
            <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem', fontWeight: '800', color: 'var(--text-current)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📋 Scanned Fabric Rolls Queue
              </h3>
              
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {scannedRolls.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px', color: 'var(--text-muted-current)' }}>
                    <QrCode size={48} style={{ opacity: 0.25, marginBottom: '1rem' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>No fabric rolls scanned yet.</span>
                    <span style={{ fontSize: '0.75rem', marginTop: '4px' }}>Scan labels or enter roll IDs to queue them.</span>
                  </div>
                ) : (
                  <table className="table" style={{ fontSize: '0.75rem', width: '100%', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '30%', padding: '0.5rem' }}>Roll ID / Order No</th>
                        <th style={{ width: '25%', padding: '0.5rem' }}>WVOF / Loom</th>
                        <th style={{ width: '15%', padding: '0.5rem' }}>Design</th>
                        <th style={{ width: '10%', textAlign: 'right', padding: '0.5rem' }}>Qty</th>
                        <th style={{ width: '12%', padding: '0.5rem' }}>Location</th>
                        <th style={{ textAlign: 'center', width: '8%', padding: '0.5rem' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scannedRolls.map((roll, idx) => (
                        <tr key={roll.id || idx}>
                          <td style={{ padding: '0.5rem', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: '800', fontFamily: 'monospace', color: '#1e293b', wordBreak: 'break-all', whiteSpace: 'normal', lineHeight: '1.2' }}>
                              {roll.id}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                              Order: {roll.weavingOrder?.order?.order_number || '—'}
                            </div>
                          </td>
                          <td style={{ padding: '0.5rem', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: '700', color: '#059669', wordBreak: 'break-all', whiteSpace: 'normal', lineHeight: '1.2' }}>
                              {roll.weavingOrder?.weaving_number}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                              Loom: {roll.weavingOrder?.machine_name || 'Job Work'}
                            </div>
                          </td>
                          <td style={{ padding: '0.5rem', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: '600', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.2' }}>
                              {roll.weavingOrder?.order?.design_no || roll.weavingOrder?.design_no || '—'}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)', whiteSpace: 'normal', wordBreak: 'break-word', marginTop: '2px' }}>
                              {roll.weavingOrder?.order?.design_name || '—'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '800', color: '#800000', padding: '0.5rem', verticalAlign: 'middle' }}>
                            {roll.qty} m
                          </td>
                          <td style={{ padding: '0.5rem', verticalAlign: 'middle' }}>
                            <select
                              value={roll.location_id || ''}
                              onChange={e => {
                                const val = e.target.value;
                                const loc = locations.find(l => l.id === val);
                                setScannedRolls(prev => prev.map(r => r.id === roll.id ? {
                                  ...r,
                                  location_id: val,
                                  location_name: loc ? loc.location_name : ''
                                } : r));
                              }}
                              style={{
                                padding: '0.25rem 0.4rem',
                                border: '1px solid var(--border-current)',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                background: 'var(--surface-current)',
                                color: 'var(--text-current)',
                                width: '100%',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="">— Select —</option>
                              {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.location_name}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ textAlign: 'center', padding: '0.5rem', verticalAlign: 'middle' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setScannedRolls(prev => prev.filter(r => r.id !== roll.id));
                              }}
                              style={{
                                border: 'none', background: 'none', color: '#ef4444',
                                fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer',
                                padding: '4px 6px', borderRadius: '4px'
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {greigeTab === 'movement' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Status Filter Cards */}
            {(() => {
              const statuses = [
                { id: 'all', label: 'All Forms', count: movStatusCounts.all, color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', hoverBg: '#e2e8f0', icon: '📋' },
                { id: 'pending', label: 'Pending', count: movStatusCounts.pending, color: '#d97706', bg: '#fef3c7', border: '#fde68a', hoverBg: '#fef08a', icon: '⏳' },
                { id: 'on_process', label: 'On Process', count: movStatusCounts.on_process, color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd', hoverBg: '#bfdbfe', icon: '⚡' },
                { id: 'completed', label: 'Completed', count: movStatusCounts.completed, color: '#166534', bg: '#dcfce7', border: '#86efac', hoverBg: '#bbf7d0', icon: '✅' },
                { id: 'stopped', label: 'Stopped', count: movStatusCounts.stopped, color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', hoverBg: '#e2e8f0', icon: '🛑' }
              ];

              return (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {statuses.map(s => {
                    const isActive = movFilterStatus === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setMovFilterStatus(s.id)}
                        style={{
                          flex: '1 1 120px',
                          minWidth: '120px',
                          backgroundColor: isActive ? s.bg : 'white',
                          border: isActive ? `2px solid ${s.color}` : '1.5px solid var(--border-current)',
                          borderRadius: '12px',
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: isActive ? `0 4px 12px -2px ${s.color}25` : 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          transform: isActive ? 'scale(1.02)' : 'none',
                        }}
                        className="hover-lift"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                          <span style={{
                            fontSize: '1.1rem', fontWeight: '900', color: isActive ? s.color : 'var(--text-current)'
                          }}>
                            {s.count}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: '800', 
                          color: isActive ? s.color : 'var(--text-muted-current)',
                          textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '2px'
                        }}>
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Expandable Filter Box */}
            <div className="glass-panel" style={{ padding: '1rem 1.5rem', position: 'relative', zIndex: 10 }}>
              <div 
                onClick={() => setIsMovementFiltersExpanded(!isMovementFiltersExpanded)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-current)' }}>
                  <Search size={16} color="#059669" /> Filter Weaving Order Forms (WVOF)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted-current)', fontWeight: '700' }}>
                  {isMovementFiltersExpanded ? 'Hide Filters' : 'Show Filters'}
                  <ChevronDown size={14} style={{ transform: isMovementFiltersExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>
              </div>
              
              {isMovementFiltersExpanded && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem', borderTop: '1px solid var(--border-current)', paddingTop: '1rem' }}>
                  <MultiSelectDropdown
                    label="Weaving Order Forms (WVOF)"
                    options={movWvofOptions}
                    selectedValues={movFilterSelectedWvofs}
                    onChange={setMovFilterSelectedWvofs}
                    placeholder="Select WVOF numbers..."
                  />

                  <MultiSelectDropdown
                    label="Order Number"
                    options={movOrderOptions}
                    selectedValues={movFilterSelectedOrders}
                    onChange={setMovFilterSelectedOrders}
                    placeholder="Select Order numbers..."
                  />

                  <MultiSelectDropdown
                    label="Partner Name"
                    options={movPartnerOptions}
                    selectedValues={movFilterSelectedPartners}
                    onChange={setMovFilterSelectedPartners}
                    placeholder="Select Partners..."
                  />

                  <MultiSelectDropdown
                    label="Loom / Machine"
                    options={movMachineOptions}
                    selectedValues={movFilterSelectedMachines}
                    onChange={setMovFilterSelectedMachines}
                    placeholder="Select Looms..."
                  />

                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label" style={{ fontSize: '0.75rem', fontWeight: '700' }}>Scope / Type</label>
                    <select
                      className="input-field"
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem', height: '38px' }}
                      value={movFilterScope}
                      onChange={e => setMovFilterScope(e.target.value)}
                    >
                      <option value="all">All (In-House & Job Work)</option>
                      <option value="in_house">In-House Only</option>
                      <option value="job_work">Job Work Only</option>
                    </select>
                  </div>
                  
                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label" style={{ fontSize: '0.75rem', fontWeight: '700' }}>Schedule Date</label>
                    <input
                      type="date"
                      className="input-field"
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem', height: '38px' }}
                      value={movFilterDate}
                      onChange={e => setMovFilterDate(e.target.value)}
                    />
                  </div>
                  
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setMovFilterStatus('all');
                        setMovFilterSelectedWvofs([]);
                        setMovFilterSelectedOrders([]);
                        setMovFilterSelectedPartners([]);
                        setMovFilterSelectedMachines([]);
                        setMovFilterScope('all');
                        setMovFilterDate('');
                      }}
                      style={{
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        borderRadius: '6px',
                        border: '1px solid var(--border-current)',
                        backgroundColor: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      Reset Filters
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Split Screen Panel */}
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>
              
              {/* Left Column: Grouped WVOFs List */}
              <div className="glass-panel" style={{ padding: '1.25rem', maxHeight: '650px', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-current)', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>
                  📋 Select Weaving Form (WVOF)
                </h3>

                {/* Pill-shaped Status Filter */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-current)' }}>
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'on_process', label: 'On Process' },
                    { id: 'stopped', label: 'Stopped' },
                    { id: 'completed', label: 'Completed' }
                  ].map(p => {
                    const isActive = movFilterStatus === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setMovFilterStatus(p.id)}
                        style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: '999px',
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          border: isActive ? '1.5px solid #059669' : '1.5px solid var(--border-current)',
                          backgroundColor: isActive ? 'rgba(5, 150, 105, 0.08)' : 'var(--surface-current)',
                          color: isActive ? '#059669' : 'var(--text-muted-current)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {/* Airjet top-level category */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div 
                    onClick={() => setIsAirjetExpanded(prev => !prev)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '0.5rem 0.6rem', 
                      backgroundColor: 'rgba(5, 150, 105, 0.04)', 
                      borderRadius: '8px', 
                      cursor: 'pointer', 
                      fontSize: '0.78rem', 
                      fontWeight: '800', 
                      color: '#059669',
                      border: '1px solid rgba(5, 150, 105, 0.15)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {isAirjetExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>⚡ Airjet Looms</span>
                    </div>
                    <span style={{ backgroundColor: 'rgba(5, 150, 105, 0.08)', padding: '1px 6px', borderRadius: '8px', fontSize: '0.7rem' }}>
                      {airjetWvofs.length}
                    </span>
                  </div>
                  
                  {isAirjetExpanded && (
                    <div style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {Object.keys(airjetGroups).length === 0 ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontStyle: 'italic', paddingLeft: '0.5rem' }}>
                          No matching Airjet forms
                        </span>
                      ) : (
                        Object.entries(airjetGroups).map(([loomName, groupWvofs]) => {
                          const isSubgroupExpanded = expandedSubgroups[loomName] !== false;
                          return (
                            <div key={loomName} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div
                                onClick={() => toggleSubgroup(loomName)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.25rem 0.4rem',
                                  cursor: 'pointer',
                                  fontSize: '0.72rem',
                                  fontWeight: '700',
                                  color: 'var(--text-current)',
                                  backgroundColor: 'var(--surface-muted-current)',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-current)'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  {isSubgroupExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  <span>{loomName}</span>
                                </div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', padding: '1px 4px' }}>
                                  {groupWvofs.length}
                                </span>
                              </div>
                              {isSubgroupExpanded && (
                                <div style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  {groupWvofs.map(wo => renderMovementWvofItem(wo, selectedWv))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Rapier top-level category */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div 
                    onClick={() => setIsRapierExpanded(prev => !prev)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '0.5rem 0.6rem', 
                      backgroundColor: 'rgba(59, 130, 246, 0.04)', 
                      borderRadius: '8px', 
                      cursor: 'pointer', 
                      fontSize: '0.78rem', 
                      fontWeight: '800', 
                      color: '#3b82f6',
                      border: '1px solid rgba(59, 130, 246, 0.15)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {isRapierExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>⚙️ Rapier Looms</span>
                    </div>
                    <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', padding: '1px 6px', borderRadius: '8px', fontSize: '0.7rem' }}>
                      {rapierWvofs.length}
                    </span>
                  </div>
                  
                  {isRapierExpanded && (
                    <div style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {Object.keys(rapierGroups).length === 0 ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontStyle: 'italic', paddingLeft: '0.5rem' }}>
                          No matching Rapier forms
                        </span>
                      ) : (
                        Object.entries(rapierGroups).map(([loomName, groupWvofs]) => {
                          const isSubgroupExpanded = expandedSubgroups[loomName] !== false;
                          return (
                            <div key={loomName} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div
                                onClick={() => toggleSubgroup(loomName)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.25rem 0.4rem',
                                  cursor: 'pointer',
                                  fontSize: '0.72rem',
                                  fontWeight: '700',
                                  color: 'var(--text-current)',
                                  backgroundColor: 'var(--surface-muted-current)',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-current)'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  {isSubgroupExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  <span>{loomName}</span>
                                </div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', padding: '1px 4px' }}>
                                  {groupWvofs.length}
                                </span>
                              </div>
                              {isSubgroupExpanded && (
                                <div style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  {groupWvofs.map(wo => renderMovementWvofItem(wo, selectedWv))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Job Work top-level category */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div 
                    onClick={() => setIsJobWorkExpanded(prev => !prev)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '0.5rem 0.6rem', 
                      backgroundColor: 'rgba(217, 119, 6, 0.04)', 
                      borderRadius: '8px', 
                      cursor: 'pointer', 
                      fontSize: '0.78rem', 
                      fontWeight: '800', 
                      color: '#d97706',
                      border: '1px solid rgba(217, 119, 6, 0.15)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {isJobWorkExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>🤝 Job Work</span>
                    </div>
                    <span style={{ backgroundColor: 'rgba(217, 119, 6, 0.08)', padding: '1px 6px', borderRadius: '8px', fontSize: '0.7rem' }}>
                      {jobWorkWvofs.length}
                    </span>
                  </div>
                  
                  {isJobWorkExpanded && (
                    <div style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {Object.keys(jobWorkGroups).length === 0 ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontStyle: 'italic', paddingLeft: '0.5rem' }}>
                          No matching Job Work forms
                        </span>
                      ) : (
                        Object.entries(jobWorkGroups).map(([partnerName, groupWvofs]) => {
                          const isSubgroupExpanded = expandedSubgroups[partnerName] !== false;
                          return (
                            <div key={partnerName} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div
                                onClick={() => toggleSubgroup(partnerName)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.25rem 0.4rem',
                                  cursor: 'pointer',
                                  fontSize: '0.72rem',
                                  fontWeight: '700',
                                  color: 'var(--text-current)',
                                  backgroundColor: 'var(--surface-muted-current)',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-current)'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  {isSubgroupExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  <span>{partnerName}</span>
                                </div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', padding: '1px 4px' }}>
                                  {groupWvofs.length}
                                </span>
                              </div>
                              {isSubgroupExpanded && (
                                <div style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  {groupWvofs.map(wo => renderMovementWvofItem(wo, selectedWv))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Summaries & Roll Details */}
              <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '500px' }}>
                {!selectedWv ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-muted-current)' }}>
                    <ClipboardList size={56} style={{ opacity: 0.2, marginBottom: '1.25rem' }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>No Weaving Form Selected</span>
                    <span style={{ fontSize: '0.78rem', marginTop: '4px' }}>Select a WVOF from the left side panel to view summary and movement logs.</span>
                  </div>
                ) : (
                  (() => {
                    const wvofQty = Number(selectedWv.qty || 0);
                    const weavedQty = (selectedWv.production_logs || []).reduce((sum, log) => sum + Number(log.qty || 0), 0);
                    const qrGeneratedQty = (selectedWv.fabric_rolls || []).reduce((sum, roll) => sum + Number(roll.qty || 0), 0);
                    const numQrGenerated = selectedWv.fabric_rolls?.length || 0;
                    
                    const greigeInputRolls = (selectedWv.fabric_rolls || []).filter(roll => roll.status === 'greige received' || roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing');
                    const greigeInputQty = greigeInputRolls.reduce((sum, roll) => sum + Number(roll.qty || 0), 0);
                    const numScannedGreige = greigeInputRolls.length;

                    // 4-Point Inspection Qty calculations
                    const inspectedRolls = (selectedWv.fabric_rolls || []).filter(roll => roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing');
                    const totalInspectedQty = inspectedRolls.reduce((sum, roll) => sum + Number(roll.actual_qty || roll.actual_length || 0), 0);
                    const numInspected = inspectedRolls.length;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Header metadata */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-current)', paddingBottom: '1rem' }}>
                          <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-current)' }}>
                              Form: <span style={{ fontFamily: 'monospace', color: '#059669' }}>{selectedWv.weaving_number}</span>
                            </h2>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted-current)', marginTop: '4px', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <span><strong>Order:</strong> {selectedWv.order?.order_number || '—'}</span>
                              <span><strong>Design:</strong> {selectedWv.order?.design_no || selectedWv.design_no || '—'} ({selectedWv.order?.design_name || 'No Design Name'})</span>
                              <span><strong>Loom:</strong> {selectedWv.machine_name || 'Job Work'} {selectedWv.partner_name ? `(${selectedWv.partner_name})` : ''}</span>
                            </div>
                          </div>
                          
                          <span style={{
                            fontSize: '0.72rem', fontWeight: '800',
                            backgroundColor: selectedWv.status === 'completed' ? '#dcfce7' : '#fef3c7',
                            color: selectedWv.status === 'completed' ? '#166534' : '#d97706',
                            padding: '3px 10px', borderRadius: '12px',
                            border: `1px solid ${selectedWv.status === 'completed' ? '#86efac' : '#fde68a'}`,
                            textTransform: 'uppercase'
                          }}>
                            {selectedWv.status}
                          </span>
                        </div>
                        
                        {/* 7 Grid Summary Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                          {[
                            { label: 'WVOF Qty', val: `${wvofQty.toLocaleString()} m`, desc: 'Target Length', color: 'var(--text-current)' },
                            { label: 'Weaved Qty', val: `${weavedQty.toLocaleString()} m`, desc: 'Daily Logs Sum', color: '#059669' },
                            { label: 'QR Generated Qty', val: `${qrGeneratedQty.toLocaleString()} m`, desc: 'Total Roll Length', color: '#800000' },
                            { label: 'Number of QR Generated', val: `${numQrGenerated} rolls`, desc: 'Roll Labels Printed', color: '#800000' },
                            { label: 'Greige Input Qty', val: `${greigeInputQty.toLocaleString()} m`, desc: 'Received at Inspection', color: '#2563eb' },
                            { label: 'Greige Input Rolls', val: `${numScannedGreige} / ${numQrGenerated}`, desc: 'Rolls Received', color: '#2563eb' },
                            { label: '4-Point Inspected Qty', val: `${totalInspectedQty.toLocaleString()} m`, desc: `${numInspected} / ${numQrGenerated} rolls`, color: '#047857' }
                          ].map((card, cIdx) => (
                            <div key={cIdx} style={{
                              backgroundColor: 'var(--surface-current)',
                              border: '1px solid var(--border-current)',
                              borderRadius: '10px',
                              padding: '0.75rem',
                              textAlign: 'center'
                            }}>
                              <span style={{ display: 'block', fontSize: '0.62rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.2rem' }}>
                                {card.label}
                              </span>
                              <span style={{ display: 'block', fontSize: '1.05rem', fontWeight: '850', color: card.color }}>
                                {card.val}
                              </span>
                              <span style={{ display: 'block', fontSize: '0.58rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                {card.desc}
                              </span>
                            </div>
                          ))}
                        </div>
                        
                        {/* GFRR History (Reprint) */}
                        {(() => {
                          const receivedGfrrs = {};
                          if (selectedWv.fabric_rolls) {
                            selectedWv.fabric_rolls.forEach(roll => {
                              if ((roll.status === 'greige received' || roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing') && roll.gfrr_no) {
                                if (!receivedGfrrs[roll.gfrr_no]) {
                                  receivedGfrrs[roll.gfrr_no] = [];
                                }
                                receivedGfrrs[roll.gfrr_no].push(roll);
                              }
                            });
                          }
                          
                          if (Object.keys(receivedGfrrs).length === 0) return null;
                          
                          return (
                            <div style={{ backgroundColor: '#fcfcfc', border: '1px solid var(--border-current)', borderRadius: '10px', padding: '1rem' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                                📜 GFRR Receipt History (Reprint)
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {Object.keys(receivedGfrrs).map(gfrrNo => {
                                  const rolls = receivedGfrrs[gfrrNo];
                                  const totalQty = rolls.reduce((sum, r) => sum + Number(r.qty || 0), 0);
                                  return (
                                    <div key={gfrrNo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.78rem' }}>
                                      <div>
                                        <strong style={{ fontFamily: 'monospace', color: '#800000' }}>{gfrrNo}</strong>
                                        <span style={{ color: 'var(--text-muted-current)', marginLeft: '0.5rem' }}>
                                          ({rolls.length} rolls, {totalQty.toLocaleString()} m)
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleReprintGfrrReceipt(gfrrNo, rolls, selectedWv)}
                                        style={{
                                          padding: '3px 10px', borderRadius: '6px', border: '1px solid #800000',
                                          background: 'rgba(128,0,0,0.04)', color: '#800000',
                                          fontSize: '0.68rem', fontWeight: '800', cursor: 'pointer',
                                          transition: 'all 0.15s'
                                        }}
                                      >
                                        🖨️ Print Receipt
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Roll Status Detail Table */}
                        <div>
                          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', fontWeight: '800', color: 'var(--text-current)' }}>
                            📦 Fabric Roll QR Generation & Greige Input Status
                          </h3>
                          
                          <style>{`
                            .qc-tooltip-trigger {
                              position: relative;
                            }
                            .qc-tooltip-trigger:hover .qc-tooltip-content {
                              display: block !important;
                            }
                          `}</style>
                          <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'visible' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-current)' }}>
                                  <th style={{ padding: '0.5rem 0.75rem' }}>Roll ID</th>
                                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Roll Qty (m)</th>
                                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', width: '120px' }}>QR Generated ✔️</th>
                                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', width: '140px' }}>Fabric Greige Input</th>
                                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', width: '150px' }}>4 Point Inspection</th>
                                </tr>
                              </thead>
                              <tbody>
                                {!selectedWv.fabric_rolls || selectedWv.fabric_rolls.length === 0 ? (
                                  <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                      No rolls generated for this weaving order yet. Go to Loom QR Generator to create rolls.
                                    </td>
                                  </tr>
                                ) : (
                                  [...selectedWv.fabric_rolls]
                                    .sort((a, b) => a.roll_no - b.roll_no)
                                    .map(roll => {
                                      const isReceived = roll.status === 'greige received' || roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing';
                                      const isInspected = roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing';
                                      return (
                                        <tr key={roll.id} style={{ borderBottom: '1px solid var(--border-current)', backgroundColor: 'white' }}>
                                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', fontFamily: 'monospace' }}>
                                            {roll.id}
                                          </td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#800000' }}>
                                            {roll.qty} m
                                          </td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#10b981', fontWeight: '800' }}>
                                            ✔️
                                          </td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                            {isReceived ? (
                                              <span style={{
                                                backgroundColor: '#dcfce7', color: '#166534',
                                                padding: '2px 8px', borderRadius: '4px',
                                                fontSize: '0.7rem', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '0.2rem'
                                              }}>
                                                ✔️ Scanned {roll.location_name ? `(${roll.location_name})` : ''}
                                              </span>
                                            ) : (
                                              <span style={{
                                                backgroundColor: '#fee2e2', color: '#b91c1c',
                                                padding: '2px 8px', borderRadius: '4px',
                                                fontSize: '0.7rem', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '0.2rem'
                                              }}>
                                                ❌ Pending
                                              </span>
                                            )}
                                          </td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                            {isInspected ? (
                                              <div className="qc-tooltip-trigger" style={{ display: 'inline-block' }}>
                                                <span style={{
                                                  backgroundColor: '#ecfdf5', color: '#047857',
                                                  padding: '2px 8px', borderRadius: '4px',
                                                  fontSize: '0.7rem', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                                  cursor: 'help'
                                                }}>
                                                  ✔️ Inspected
                                                </span>
                                                <div className="qc-tooltip-content" style={{
                                                  display: 'none', position: 'absolute', right: '105%', top: '50%', transform: 'translateY(-50%)',
                                                  backgroundColor: '#1e293b', color: 'white', padding: '0.75rem 1rem', borderRadius: '8px',
                                                  width: '280px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
                                                  zIndex: 1000, fontSize: '0.72rem', textAlign: 'left', lineHeight: '1.4', fontStyle: 'normal',
                                                  border: '1px solid #334155'
                                                }}>
                                                  <div style={{ borderBottom: '1px solid #334155', paddingBottom: '4px', marginBottom: '6px', fontWeight: '800', color: '#38bdf8', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span>🔍 4-Point QC Details</span>
                                                    <span style={{ fontSize: '0.6rem', color: '#94a3b8', marginLeft: 'auto' }}>
                                                      {roll.inspected_at ? new Date(roll.inspected_at).toLocaleDateString('en-IN') : ''}
                                                    </span>
                                                  </div>
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                      <span style={{ color: '#94a3b8' }}>Greige Qty:</span>
                                                      <strong style={{ color: 'white' }}>{roll.qty} m</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                      <span style={{ color: '#94a3b8' }}>Actual Qty:</span>
                                                      <strong style={{ color: 'white' }}>{roll.actual_qty || roll.actual_length || '—'} m</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                      <span style={{ color: '#94a3b8' }}>Shortage:</span>
                                                      <strong style={{ color: (roll.shortage || 0) > 0 ? '#fbbf24' : '#34d399' }}>{roll.shortage || 0} m</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                      <span style={{ color: '#94a3b8' }}>Mistakes:</span>
                                                      <strong style={{ color: '#f87171' }}>{roll.mistake || 0} m</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                      <span style={{ color: '#94a3b8' }}>Approved Qty:</span>
                                                      <strong style={{ color: '#34d399' }}>{roll.approved_qty || 0} m</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #334155', paddingTop: '4px', marginTop: '2px' }}>
                                                      <span style={{ color: '#94a3b8' }}>Inspectors:</span>
                                                      <strong style={{ color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                                                        {roll.inspector_1 || '—'} {roll.inspector_2 ? `& ${roll.inspector_2}` : ''}
                                                      </strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                      <span style={{ color: '#94a3b8' }}>Fitter:</span>
                                                      <strong style={{ color: 'white' }}>{roll.attended_fitter || '—'}</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                      <span style={{ color: '#94a3b8' }}>Result:</span>
                                                      <strong style={{ color: roll.roll_ok ? '#34d399' : '#f87171' }}>
                                                        {roll.roll_ok ? '🟢 Roll OK' : '🔴 Defects Observed'}
                                                      </strong>
                                                    </div>
                                                    {!roll.roll_ok && roll.warp_comments?.length > 0 && (
                                                      <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px dashed #334155', paddingTop: '2px', marginTop: '2px' }}>
                                                        <span style={{ color: '#f87171', fontSize: '0.65rem', fontWeight: '700' }}>Warp Comments:</span>
                                                        <span style={{ color: '#e2e8f0', fontSize: '0.65rem' }}>{roll.warp_comments.join(', ')}</span>
                                                      </div>
                                                    )}
                                                    {!roll.roll_ok && roll.weft_comments?.length > 0 && (
                                                      <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px dashed #334155', paddingTop: '2px', marginTop: '2px' }}>
                                                        <span style={{ color: '#f87171', fontSize: '0.65rem', fontWeight: '700' }}>Weft Comments:</span>
                                                        <span style={{ color: '#e2e8f0', fontSize: '0.65rem' }}>{roll.weft_comments.join(', ')}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            ) : (
                                              <span style={{
                                                backgroundColor: '#f1f5f9', color: '#475569',
                                                padding: '2px 8px', borderRadius: '4px',
                                                fontSize: '0.7rem', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '0.2rem'
                                              }}>
                                                ⏳ Pending
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── MultiSelectDropdown Helper Component ──
  const MultiSelectDropdown = ({ label, options, selected, selectedValues, onChange, placeholder = "Search..." }) => {
    const activeSelected = selected || selectedValues || [];
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filteredOptions = useMemo(() => {
      return options.filter(opt =>
        String(opt || '').toLowerCase().includes(search.toLowerCase())
      );
    }, [options, search]);

    const toggleOption = (opt) => {
      if (activeSelected.includes(opt)) {
        onChange(activeSelected.filter(val => val !== opt));
      } else {
        onChange([...activeSelected, opt]);
      }
    };

    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          {label}
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--border-current)',
            borderRadius: '8px',
            backgroundColor: 'var(--surface-current)',
            color: 'var(--text-current)',
            fontSize: '0.825rem',
            textAlign: 'left',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            height: '38px',
            transition: 'all 0.15s'
          }}
        >
          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '85%' }}>
            {activeSelected.length === 0 ? `All ${label}s` : `${activeSelected.length} Selected`}
          </span>
          <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted-current)' }} />
        </button>

        {isOpen && (
          <>
            <div 
              onClick={() => setIsOpen(false)} 
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, cursor: 'default' }} 
            />
            <div style={{
              position: 'absolute',
              top: '105%',
              left: 0,
              right: 0,
              backgroundColor: 'var(--surface-current)',
              border: '1px solid var(--border-current)',
              borderRadius: '10px',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
              padding: '0.5rem',
              zIndex: 1000,
              maxHeight: '260px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              animation: 'fadeIn 0.15s ease-out'
            }}>
              <input
                type="text"
                placeholder={placeholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  border: '1px solid var(--border-current)',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  outline: 'none',
                  background: 'rgba(0,0,0,0.02)',
                  color: 'var(--text-current)',
                  boxSizing: 'border-box'
                }}
              />
              
              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => onChange(options)}
                  style={{
                    flex: 1, padding: '3px 0', fontSize: '0.68rem', fontWeight: '750',
                    border: 'none', background: 'rgba(128,0,0,0.05)', color: '#800000', borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  style={{
                    flex: 1, padding: '3px 0', fontSize: '0.68rem', fontWeight: '750',
                    border: 'none', background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted-current)', borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingRight: '2px' }} className="custom-scrollbar">
                {filteredOptions.length === 0 ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', textAlign: 'center', padding: '0.5rem 0' }}>
                    No options found
                  </span>
                ) : (
                  filteredOptions.map(opt => {
                    const isChecked = activeSelected.includes(opt);
                    return (
                      <label
                        key={opt}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          backgroundColor: isChecked ? 'rgba(128,0,0,0.04)' : 'transparent',
                          transition: 'background-color 0.15s',
                          color: isChecked ? '#800000' : 'var(--text-current)',
                          fontWeight: isChecked ? '700' : '500'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOption(opt)}
                          style={{ accentColor: '#800000', cursor: 'pointer' }}
                        />
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {opt}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const getRollQuantity = (roll) => {
    let processedQty = null;
    for (const po of processingOrders) {
      if (Array.isArray(po.received_rolls)) {
        const rx = po.received_rolls.find(r => r.greige_roll_id === roll.id || r.id === roll.id);
        if (rx) {
          processedQty = Number(rx.qty || 0);
          break;
        }
      }
    }
    if (processedQty !== null) {
      return processedQty;
    }
    return Number(roll.actual_qty || roll.actual_length || roll.qty || 0);
  };

  const getRollLocation = (roll) => {
    const latestMovement = (fabricMovements || []).find(m =>
      Array.isArray(m.rolls) && m.rolls.some(r => r.id === roll.id || r.greige_roll_id === roll.id || r.id === roll.greige_roll_id)
    );
    if (latestMovement) {
      return latestMovement.to_location;
    }
    let processedLoc = null;
    for (const po of processingOrders) {
      if (Array.isArray(po.received_rolls)) {
        const rx = po.received_rolls.find(r => r.greige_roll_id === roll.id || r.id === roll.id);
        if (rx) {
          processedLoc = rx.location_name;
          break;
        }
      }
    }
    if (processedLoc) {
      return processedLoc;
    }
    return roll.location_name || 'Factory';
  };

  // ── Greige Rolls Details: computed values (hooks must be at top level) ──
  const allRolls = useMemo(() => {
    const rolls = [];
    weavingOrders.forEach(wo => {
      const orderRolls = Array.isArray(wo.fabric_rolls) ? wo.fabric_rolls : [];
      orderRolls.forEach(roll => {
        const isSentToProcessing = processingRollIds.has(roll.id);
        const latestMovement = (fabricMovements || []).find(m =>
          Array.isArray(m.rolls) && m.rolls.some(r => r.id === roll.id)
        );
        const currentLoc = latestMovement ? latestMovement.to_location : (roll.location_name || 'Factory');
        
        rolls.push({
          ...roll,
          weavingOrder: wo,
          weaving_number: wo.weaving_number,
          weaving_type: wo.weaving_type === 'job_work' ? 'Job Work' : 'In-House',
          partner_name: wo.weaving_type === 'job_work' ? (wo.partner_name || 'Job Work Partner') : 'In-House',
          machine_name: wo.weaving_type === 'job_work' ? 'Job Work' : (wo.machine_name || '—'),
          isProcessed: false, // so location updates for this greige roll target weaving_orders
          isSentToProcessing,
          order_number: wo.order?.order_number || '—',
          design_no: wo.order?.design_no || wo.design_no || '—',
          design_name: wo.order?.design_name || '—',
          movement_qty: Number(roll.actual_qty || roll.actual_length || roll.qty || 0),
          location_name: currentLoc
        });
      });
    });

    // Append processed received rolls as distinct items
    processingOrders.forEach(po => {
      const receivedRolls = Array.isArray(po.received_rolls) ? po.received_rolls : [];
      receivedRolls.forEach(rx => {
        // Find matching parent greige roll to inherit metadata
        let greigeRoll = null;
        let weavingOrder = null;
        for (const wo of weavingOrders) {
          const orderRolls = Array.isArray(wo.fabric_rolls) ? wo.fabric_rolls : [];
          const match = orderRolls.find(r => r.id === rx.greige_roll_id);
          if (match) {
            greigeRoll = match;
            weavingOrder = wo;
            break;
          }
        }

        const latestMovement = (fabricMovements || []).find(m =>
          Array.isArray(m.rolls) && m.rolls.some(r => r.id === rx.id || r.greige_roll_id === rx.id || r.id === rx.greige_roll_id)
        );
        const currentLoc = latestMovement ? latestMovement.to_location : (rx.location_name || po.received_place || greigeRoll?.location_name || 'Factory');

        rolls.push({
          id: rx.id,
          greige_roll_id: rx.greige_roll_id,
          qty: Number(rx.qty || 0),
          movement_qty: Number(rx.qty || 0),
          isProcessed: true, // it is a processed roll
          isProcessedRoll: true,
          location_name: currentLoc,
          order_number: greigeRoll?.order_number || weavingOrder?.order?.order_number || '—',
          design_name: greigeRoll?.design_name || weavingOrder?.order?.design_name || '—',
          design_no: greigeRoll?.design_no || weavingOrder?.order?.design_no || weavingOrder?.design_no || '—',
          weaving_number: weavingOrder?.weaving_number || '—',
          pof_number: po.pof_number || '—',
          partner_name: po.partner_name || '—',
          weaving_type: weavingOrder?.weaving_type === 'job_work' ? 'Job Work' : 'In-House',
          machine_name: weavingOrder?.weaving_type === 'job_work' ? 'Job Work' : (weavingOrder?.machine_name || '—'),
          created_at: rx.received_at || po.updated_at || null
        });
      });
    });

    return rolls.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [weavingOrders, processingRollIds, processingOrders, fabricMovements]);

  const rollIdOptions = useMemo(() => {
    const filtered = allRolls.filter(r => {
      if (r.isProcessedRoll) return false;
      if (selectedFilterTypes.length > 0 && !selectedFilterTypes.includes(r.weaving_type)) return false;
      if (selectedFilterPartners.length > 0 && !selectedFilterPartners.includes(r.partner_name)) return false;
      if (selectedFilterWvofs.length > 0 && !selectedFilterWvofs.includes(r.weaving_number)) return false;
      if (selectedFilterOrderNumbers.length > 0 && !selectedFilterOrderNumbers.includes(r.order_number)) return false;
      if (selectedFilterDesignNames.length > 0 && !selectedFilterDesignNames.includes(r.design_name)) return false;
      if (selectedFilterDesignNos.length > 0 && !selectedFilterDesignNos.includes(r.design_no)) return false;
      return true;
    });
    return [...new Set(filtered.map(r => r.id))].sort();
  }, [allRolls, selectedFilterTypes, selectedFilterPartners, selectedFilterWvofs, selectedFilterOrderNumbers, selectedFilterDesignNames, selectedFilterDesignNos]);

  const typeOptions = useMemo(() => {
    const filtered = allRolls.filter(r => {
      if (r.isProcessedRoll) return false;
      if (selectedFilterRollIds.length > 0 && !selectedFilterRollIds.includes(r.id)) return false;
      if (selectedFilterPartners.length > 0 && !selectedFilterPartners.includes(r.partner_name)) return false;
      if (selectedFilterWvofs.length > 0 && !selectedFilterWvofs.includes(r.weaving_number)) return false;
      if (selectedFilterOrderNumbers.length > 0 && !selectedFilterOrderNumbers.includes(r.order_number)) return false;
      if (selectedFilterDesignNames.length > 0 && !selectedFilterDesignNames.includes(r.design_name)) return false;
      if (selectedFilterDesignNos.length > 0 && !selectedFilterDesignNos.includes(r.design_no)) return false;
      return true;
    });
    return [...new Set(filtered.map(r => r.weaving_type))].sort();
  }, [allRolls, selectedFilterRollIds, selectedFilterPartners, selectedFilterWvofs, selectedFilterOrderNumbers, selectedFilterDesignNames, selectedFilterDesignNos]);

  const partnerOptions = useMemo(() => {
    const filtered = allRolls.filter(r => {
      if (r.isProcessedRoll) return false;
      if (selectedFilterRollIds.length > 0 && !selectedFilterRollIds.includes(r.id)) return false;
      if (selectedFilterTypes.length > 0 && !selectedFilterTypes.includes(r.weaving_type)) return false;
      if (selectedFilterWvofs.length > 0 && !selectedFilterWvofs.includes(r.weaving_number)) return false;
      if (selectedFilterOrderNumbers.length > 0 && !selectedFilterOrderNumbers.includes(r.order_number)) return false;
      if (selectedFilterDesignNames.length > 0 && !selectedFilterDesignNames.includes(r.design_name)) return false;
      if (selectedFilterDesignNos.length > 0 && !selectedFilterDesignNos.includes(r.design_no)) return false;
      return true;
    });
    return [...new Set(filtered.map(r => r.partner_name))].sort();
  }, [allRolls, selectedFilterRollIds, selectedFilterTypes, selectedFilterWvofs, selectedFilterOrderNumbers, selectedFilterDesignNames, selectedFilterDesignNos]);

  const wvofOptions = useMemo(() => {
    const filtered = allRolls.filter(r => {
      if (r.isProcessedRoll) return false;
      if (selectedFilterRollIds.length > 0 && !selectedFilterRollIds.includes(r.id)) return false;
      if (selectedFilterTypes.length > 0 && !selectedFilterTypes.includes(r.weaving_type)) return false;
      if (selectedFilterPartners.length > 0 && !selectedFilterPartners.includes(r.partner_name)) return false;
      if (selectedFilterOrderNumbers.length > 0 && !selectedFilterOrderNumbers.includes(r.order_number)) return false;
      if (selectedFilterDesignNames.length > 0 && !selectedFilterDesignNames.includes(r.design_name)) return false;
      if (selectedFilterDesignNos.length > 0 && !selectedFilterDesignNos.includes(r.design_no)) return false;
      return true;
    });
    return [...new Set(filtered.map(r => r.weaving_number))].sort();
  }, [allRolls, selectedFilterRollIds, selectedFilterTypes, selectedFilterPartners, selectedFilterOrderNumbers, selectedFilterDesignNames, selectedFilterDesignNos]);

  const orderNumberOptions = useMemo(() => {
    const filtered = allRolls.filter(r => {
      if (r.isProcessedRoll) return false;
      if (selectedFilterRollIds.length > 0 && !selectedFilterRollIds.includes(r.id)) return false;
      if (selectedFilterTypes.length > 0 && !selectedFilterTypes.includes(r.weaving_type)) return false;
      if (selectedFilterPartners.length > 0 && !selectedFilterPartners.includes(r.partner_name)) return false;
      if (selectedFilterWvofs.length > 0 && !selectedFilterWvofs.includes(r.weaving_number)) return false;
      if (selectedFilterDesignNames.length > 0 && !selectedFilterDesignNames.includes(r.design_name)) return false;
      if (selectedFilterDesignNos.length > 0 && !selectedFilterDesignNos.includes(r.design_no)) return false;
      return true;
    });
    return [...new Set(filtered.map(r => r.order_number))].sort();
  }, [allRolls, selectedFilterRollIds, selectedFilterTypes, selectedFilterPartners, selectedFilterWvofs, selectedFilterDesignNames, selectedFilterDesignNos]);

  const designNameOptions = useMemo(() => {
    const filtered = allRolls.filter(r => {
      if (r.isProcessedRoll) return false;
      if (selectedFilterRollIds.length > 0 && !selectedFilterRollIds.includes(r.id)) return false;
      if (selectedFilterTypes.length > 0 && !selectedFilterTypes.includes(r.weaving_type)) return false;
      if (selectedFilterPartners.length > 0 && !selectedFilterPartners.includes(r.partner_name)) return false;
      if (selectedFilterWvofs.length > 0 && !selectedFilterWvofs.includes(r.weaving_number)) return false;
      if (selectedFilterOrderNumbers.length > 0 && !selectedFilterOrderNumbers.includes(r.order_number)) return false;
      if (selectedFilterDesignNos.length > 0 && !selectedFilterDesignNos.includes(r.design_no)) return false;
      return true;
    });
    return [...new Set(filtered.map(r => r.design_name))].sort();
  }, [allRolls, selectedFilterRollIds, selectedFilterTypes, selectedFilterPartners, selectedFilterWvofs, selectedFilterOrderNumbers, selectedFilterDesignNos]);

  const designNoOptions = useMemo(() => {
    const filtered = allRolls.filter(r => {
      if (r.isProcessedRoll) return false;
      if (selectedFilterRollIds.length > 0 && !selectedFilterRollIds.includes(r.id)) return false;
      if (selectedFilterTypes.length > 0 && !selectedFilterTypes.includes(r.weaving_type)) return false;
      if (selectedFilterPartners.length > 0 && !selectedFilterPartners.includes(r.partner_name)) return false;
      if (selectedFilterWvofs.length > 0 && !selectedFilterWvofs.includes(r.weaving_number)) return false;
      if (selectedFilterOrderNumbers.length > 0 && !selectedFilterOrderNumbers.includes(r.order_number)) return false;
      if (selectedFilterDesignNames.length > 0 && !selectedFilterDesignNames.includes(r.design_name)) return false;
      return true;
    });
    return [...new Set(filtered.map(r => r.design_no))].sort();
  }, [allRolls, selectedFilterRollIds, selectedFilterTypes, selectedFilterPartners, selectedFilterWvofs, selectedFilterOrderNumbers, selectedFilterDesignNames]);

  const displayedRolls = useMemo(() => {
    return allRolls.filter(r => {
      if (r.isProcessedRoll) return false;
      if (selectedFilterRollIds.length > 0 && !selectedFilterRollIds.includes(r.id)) return false;
      if (selectedFilterTypes.length > 0 && !selectedFilterTypes.includes(r.weaving_type)) return false;
      if (selectedFilterPartners.length > 0 && !selectedFilterPartners.includes(r.partner_name)) return false;
      if (selectedFilterWvofs.length > 0 && !selectedFilterWvofs.includes(r.weaving_number)) return false;
      if (selectedFilterOrderNumbers.length > 0 && !selectedFilterOrderNumbers.includes(r.order_number)) return false;
      if (selectedFilterDesignNames.length > 0 && !selectedFilterDesignNames.includes(r.design_name)) return false;
      if (selectedFilterDesignNos.length > 0 && !selectedFilterDesignNos.includes(r.design_no)) return false;
      return true;
    });
  }, [allRolls, selectedFilterRollIds, selectedFilterTypes, selectedFilterPartners, selectedFilterWvofs, selectedFilterOrderNumbers, selectedFilterDesignNames, selectedFilterDesignNos]);

  const hasActiveFilters = useMemo(() => {
    return selectedFilterRollIds.length > 0 ||
      selectedFilterTypes.length > 0 ||
      selectedFilterPartners.length > 0 ||
      selectedFilterWvofs.length > 0 ||
      selectedFilterOrderNumbers.length > 0 ||
      selectedFilterDesignNames.length > 0 ||
      selectedFilterDesignNos.length > 0;
  }, [selectedFilterRollIds, selectedFilterTypes, selectedFilterPartners, selectedFilterWvofs, selectedFilterOrderNumbers, selectedFilterDesignNames, selectedFilterDesignNos]);

  const totalFilteredQty = useMemo(() => {
    return displayedRolls.reduce((sum, r) => sum + Number(r.qty || 0), 0);
  }, [displayedRolls]);

  const totalGreigeRollsCount = useMemo(() => {
    return allRolls.filter(r => !r.isProcessedRoll).length;
  }, [allRolls]);

  const totalGreigeRollsQty = useMemo(() => {
    return allRolls.filter(r => !r.isProcessedRoll).reduce((sum, r) => sum + Number(r.qty || 0), 0);
  }, [allRolls]);

  const handleClearAllFilters = () => {
    setSelectedFilterRollIds([]);
    setSelectedFilterTypes([]);
    setSelectedFilterPartners([]);
    setSelectedFilterWvofs([]);
    setSelectedFilterOrderNumbers([]);
    setSelectedFilterDesignNames([]);
    setSelectedFilterDesignNos([]);
  };

  // ── Greige Rolls Details View ──
  const renderGreigeRollsDetailsView = () => {
    return (
      <div style={{ width: '100%', padding: '1.5rem', boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <button
            onClick={() => {
              setViewMode('menu');
              handleClearAllFilters();
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', borderRadius: '10px',
              border: '1px solid var(--border-current)', background: 'var(--surface-current)',
              cursor: 'pointer', color: 'var(--text-current)', transition: 'all 0.15s'
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-current)' }}>
              Greige Rolls Details
            </h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.825rem', color: 'var(--text-muted-current)' }}>
              Monitor status, locations, quality inspection logs, and processing allocations for all generated rolls
            </p>
          </div>
        </div>

        {/* Expandable Filter Box */}
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'visible', position: 'relative', zIndex: 50 }}>
          <div 
            onClick={() => setIsFilterPanelExpanded(!isFilterPanelExpanded)} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
          >
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-current)' }}>
              <span>🔍 Search & Filters</span>
              {(selectedFilterRollIds.length > 0 || selectedFilterTypes.length > 0 || selectedFilterPartners.length > 0 || selectedFilterWvofs.length > 0 || selectedFilterOrderNumbers.length > 0 || selectedFilterDesignNames.length > 0 || selectedFilterDesignNos.length > 0) && (
                <span style={{ fontSize: '0.7rem', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>
                  Active
                </span>
              )}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ChevronDown size={18} style={{ transform: isFilterPanelExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted-current)' }} />
            </div>
          </div>

          {isFilterPanelExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderTop: '1px solid var(--border-current)', paddingTop: '1rem', animation: 'fadeIn 0.2s' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem'
              }}>
                <MultiSelectDropdown
                  label="Greige Roll ID"
                  options={rollIdOptions}
                  selected={selectedFilterRollIds}
                  onChange={setSelectedFilterRollIds}
                  placeholder="Search Roll ID..."
                />
                
                <MultiSelectDropdown
                  label="Weaving Type"
                  options={typeOptions}
                  selected={selectedFilterTypes}
                  onChange={setSelectedFilterTypes}
                  placeholder="Search Type..."
                />

                <MultiSelectDropdown
                  label="Partner Name"
                  options={partnerOptions}
                  selected={selectedFilterPartners}
                  onChange={setSelectedFilterPartners}
                  placeholder="Search Partner..."
                />

                <MultiSelectDropdown
                  label="WVOF Name"
                  options={wvofOptions}
                  selected={selectedFilterWvofs}
                  onChange={setSelectedFilterWvofs}
                  placeholder="Search WVOF..."
                />

                <MultiSelectDropdown
                  label="Order Number"
                  options={orderNumberOptions}
                  selected={selectedFilterOrderNumbers}
                  onChange={setSelectedFilterOrderNumbers}
                  placeholder="Search Order No..."
                />

                <MultiSelectDropdown
                  label="Design Name"
                  options={designNameOptions}
                  selected={selectedFilterDesignNames}
                  onChange={setSelectedFilterDesignNames}
                  placeholder="Search Design Name..."
                />

                <MultiSelectDropdown
                  label="Design Number"
                  options={designNoOptions}
                  selected={selectedFilterDesignNos}
                  onChange={setSelectedFilterDesignNos}
                  placeholder="Search Design No..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  disabled={selectedFilterRollIds.length === 0 && selectedFilterTypes.length === 0 && selectedFilterPartners.length === 0 && selectedFilterWvofs.length === 0 && selectedFilterOrderNumbers.length === 0 && selectedFilterDesignNames.length === 0 && selectedFilterDesignNos.length === 0}
                  style={{
                    padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid var(--border-current)',
                    background: 'var(--surface-current)', color: 'var(--text-current)', fontSize: '0.78rem',
                    fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s',
                    opacity: (selectedFilterRollIds.length === 0 && selectedFilterTypes.length === 0 && selectedFilterPartners.length === 0 && selectedFilterWvofs.length === 0 && selectedFilterOrderNumbers.length === 0 && selectedFilterDesignNames.length === 0 && selectedFilterDesignNos.length === 0) ? 0.5 : 1
                  }}
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Table Results */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
          
          {/* Summary Stats Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
            gap: '1rem', 
            marginBottom: '1.25rem' 
          }}>
            {/* Rolls Count Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(128, 0, 0, 0.04) 0%, rgba(128, 0, 0, 0.01) 100%)',
              border: '1px solid var(--border-current)',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem'
            }}>
              <div style={{
                backgroundColor: 'rgba(128, 0, 0, 0.08)',
                color: '#800000',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Layers size={18} />
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: '750', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block' }}>
                  {hasActiveFilters ? 'Filtered Rolls' : 'Total Rolls'}
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-current)', marginTop: '2px', lineHeight: 1 }}>
                  {displayedRolls.length}{' '}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontWeight: '500' }}>
                    / {totalGreigeRollsCount}
                  </span>
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', display: 'block', marginTop: '2px' }}>
                  {hasActiveFilters ? 'Active filters applied' : 'Across all looms & partners'}
                </span>
              </div>
            </div>

            {/* Total Quantity Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.04) 0%, rgba(5, 150, 105, 0.01) 100%)',
              border: '1px solid var(--border-current)',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem'
            }}>
              <div style={{
                backgroundColor: 'rgba(5, 150, 105, 0.08)',
                color: '#059669',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ClipboardList size={18} />
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: '750', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block' }}>
                  {hasActiveFilters ? 'Filtered Quantity' : 'Total Quantity'}
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-current)', marginTop: '2px', lineHeight: 1 }}>
                  {totalFilteredQty.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{' '}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontWeight: '500' }}>
                    / {totalGreigeRollsQty.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m
                  </span>
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', display: 'block', marginTop: '2px' }}>
                  Total meters of greige rolls
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted-current)' }}>
              Showing {displayedRolls.length} of {totalGreigeRollsCount} rolls
            </span>
          </div>

          <div style={{ flex: 1, overflowX: 'hidden' }}>
            <style>{`
              .qc-tooltip-trigger {
                position: relative;
                display: inline-block;
              }
              .qc-tooltip-trigger:hover .qc-tooltip-content {
                display: block !important;
              }
            `}</style>
            <table className="table" style={{ fontSize: '0.78rem', width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--border-current)' }}>
                  <th style={{ padding: '0.6rem 0.75rem', width: '23%' }}>Roll ID & Date</th>
                  <th style={{ padding: '0.6rem 0.75rem', width: '18%' }}>Order & Design</th>
                  <th style={{ padding: '0.6rem 0.75rem', width: '22%' }}>Weaving / Source</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', width: '7%' }}>Qty (m)</th>
                  <th style={{ padding: '0.6rem 0.75rem', width: '10%' }}>Location</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', width: '12%' }}>Milestones</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', width: '8%' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedRolls.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                      No greige fabric rolls found matching search query or filters.
                    </td>
                  </tr>
                ) : (
                  <>
                    {displayedRolls.map((roll, idx) => {
                      const isReceived = roll.status === 'greige received' || roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing';
                      const isInspected = roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing';
                      const dateStr = roll.created_at ? new Date(roll.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

                      let tooltipAlign = 'center';
                      if (idx <= 1) {
                        tooltipAlign = 'top';
                      } else if (idx >= displayedRolls.length - 2) {
                        tooltipAlign = 'bottom';
                      }

                      return (
                        <tr key={roll.id || idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                          {/* Roll ID & Date */}
                          <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle', overflow: 'visible' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '0.78rem', color: 'var(--text-current)', wordBreak: 'break-all' }}>
                                {roll.id}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                {dateStr}
                              </span>
                            </div>
                          </td>

                          {/* Order & Design */}
                          <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: '700', fontSize: '0.78rem', color: '#1e3a8a' }}>
                                {roll.order_number}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={`${roll.design_name} (${roll.design_no})`}>
                                {roll.design_name} <span style={{ fontSize: '0.68rem', backgroundColor: '#f1f5f9', padding: '1px 4px', borderRadius: '3px', color: '#334155' }}>{roll.design_no}</span>
                              </span>
                            </div>
                          </td>

                          {/* Weaving / Source */}
                          <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: '700', fontSize: '0.78rem', color: '#047857', wordBreak: 'break-all' }}>
                                {roll.weaving_number}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={`${roll.weaving_type} | ${roll.weaving_type === 'Job Work' ? roll.partner_name : roll.machine_name}`}>
                                <span style={{ fontWeight: '600', color: roll.weaving_type === 'Job Work' ? '#b45309' : '#4f46e5' }}>
                                  {roll.weaving_type === 'Job Work' ? 'JW' : 'IH'}
                                </span>
                                {roll.weaving_type === 'Job Work' ? ` - ${roll.partner_name}` : ` - Loom: ${roll.machine_name}`}
                              </span>
                            </div>
                          </td>

                          {/* Qty (m) */}
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', verticalAlign: 'middle', fontWeight: '800', color: '#800000', fontSize: '0.82rem' }}>
                            {roll.qty}
                          </td>

                          {/* Location */}
                          <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle', fontSize: '0.78rem', color: 'var(--text-current)' }}>
                            {roll.location_name || 'Factory'}
                          </td>

                          {/* Milestones */}
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', overflow: 'visible', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                              {/* QR Code Generated */}
                              <RollQRTooltip rollId={roll.id} align={tooltipAlign}>
                                <span 
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '26px', height: '18px', borderRadius: '4px',
                                    fontSize: '0.62rem', fontWeight: '800', border: '1px solid #a7f3d0',
                                    backgroundColor: '#ecfdf5', color: '#047857', cursor: 'pointer'
                                  }}
                                >
                                  QR
                                </span>
                              </RollQRTooltip>

                              {/* Greige Input Scanned */}
                              <RollScanTooltip roll={roll} isReceived={isReceived} align={tooltipAlign}>
                                <span 
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '26px', height: '18px', borderRadius: '4px',
                                    fontSize: '0.62rem', fontWeight: '800',
                                    border: isReceived ? '1px solid #a7f3d0' : '1px solid #e5e7eb',
                                    backgroundColor: isReceived ? '#ecfdf5' : '#f3f4f6',
                                    color: isReceived ? '#047857' : '#9ca3af',
                                    cursor: 'pointer'
                                  }}
                                >
                                  IN
                                </span>
                              </RollScanTooltip>

                              {/* 4-Point QC Inspected */}
                              {isInspected ? (
                                <div className="qc-tooltip-trigger" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span 
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      width: '26px', height: '18px', borderRadius: '4px',
                                      fontSize: '0.62rem', fontWeight: '800', border: '1px solid #a7f3d0',
                                      backgroundColor: '#ecfdf5', color: '#047857', cursor: 'help'
                                    }}
                                  >
                                    QC
                                  </span>
                                  <div className="qc-tooltip-content" style={{
                                    display: 'none', position: 'absolute', right: '105%',
                                    backgroundColor: '#1e293b', color: 'white', padding: '0.75rem 1rem', borderRadius: '8px',
                                    width: '280px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
                                    zIndex: 1000, fontSize: '0.72rem', textAlign: 'left', lineHeight: '1.4', fontStyle: 'normal',
                                    border: '1px solid #334155',
                                    ...(tooltipAlign === 'top' ? { top: '0px', transform: 'none' } :
                                       tooltipAlign === 'bottom' ? { bottom: '0px', transform: 'none' } :
                                       { top: '50%', transform: 'translateY(-50%)' })
                                  }}>
                                    <div style={{ borderBottom: '1px solid #334155', paddingBottom: '4px', marginBottom: '6px', fontWeight: '800', color: '#38bdf8', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span>🔍 4-Point QC Details</span>
                                      <span style={{ fontSize: '0.6rem', color: '#94a3b8', marginLeft: 'auto' }}>
                                        {roll.inspected_at ? new Date(roll.inspected_at).toLocaleDateString('en-IN') : ''}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#94a3b8' }}>Greige Qty:</span>
                                        <strong style={{ color: 'white' }}>{roll.qty} m</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#94a3b8' }}>Actual Qty:</span>
                                        <strong style={{ color: 'white' }}>{roll.actual_qty || roll.actual_length || '—'} m</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#94a3b8' }}>Shortage:</span>
                                        <strong style={{ color: (roll.shortage || 0) > 0 ? '#fbbf24' : '#34d399' }}>{roll.shortage || 0} m</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#94a3b8' }}>Mistakes:</span>
                                        <strong style={{ color: '#f87171' }}>{roll.mistake || 0} m</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#34d399' }}>Approved Qty:</span>
                                        <strong style={{ color: '#34d399' }}>{roll.approved_qty || 0} m</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #334155', paddingTop: '4px', marginTop: '2px' }}>
                                        <span style={{ color: '#94a3b8' }}>Inspectors:</span>
                                        <strong style={{ color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                                          {roll.inspector_1 || '—'} {roll.inspector_2 ? `& ${roll.inspector_2}` : ''}
                                        </strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#94a3b8' }}>Fitter:</span>
                                        <strong style={{ color: 'white' }}>{roll.attended_fitter || '—'}</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#94a3b8' }}>Result:</span>
                                        <strong style={{ color: roll.roll_ok ? '#34d399' : '#f87171' }}>
                                          {roll.roll_ok ? '🟢 Roll OK' : '🔴 Defects Observed'}
                                        </strong>
                                      </div>
                                      {!roll.roll_ok && roll.warp_comments?.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px dashed #334155', paddingTop: '2px', marginTop: '2px' }}>
                                          <span style={{ color: '#f87171', fontSize: '0.65rem', fontWeight: '700' }}>Warp Comments:</span>
                                          <span style={{ color: '#e2e8f0', fontSize: '0.65rem' }}>{roll.warp_comments.join(', ')}</span>
                                        </div>
                                      )}
                                      {!roll.roll_ok && roll.weft_comments?.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px dashed #334155', paddingTop: '2px', marginTop: '2px' }}>
                                          <span style={{ color: '#f87171', fontSize: '0.65rem', fontWeight: '700' }}>Weft Comments:</span>
                                          <span style={{ color: '#e2e8f0', fontSize: '0.65rem' }}>{roll.weft_comments.join(', ')}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span 
                                  title="QC Inspection Pending" 
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '26px', height: '18px', borderRadius: '4px',
                                    fontSize: '0.62rem', fontWeight: '800', border: '1px solid #e5e7eb',
                                    backgroundColor: '#f3f4f6', color: '#9ca3af'
                                  }}
                                >
                                  QC
                                </span>
                              )}

                              {/* Processing Sent */}
                              <RollProcessingTooltip roll={roll} processingOrders={processingOrders} align={tooltipAlign}>
                                <span 
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '26px', height: '18px', borderRadius: '4px',
                                    fontSize: '0.62rem', fontWeight: '800',
                                    border: (roll.isProcessed || roll.isSentToProcessing) ? '1px solid #a7f3d0' : '1px solid #e5e7eb',
                                    backgroundColor: (roll.isProcessed || roll.isSentToProcessing) ? '#ecfdf5' : '#f3f4f6',
                                    color: (roll.isProcessed || roll.isSentToProcessing) ? '#047857' : '#9ca3af',
                                    cursor: 'pointer'
                                  }}
                                >
                                  PRC
                                </span>
                              </RollProcessingTooltip>
                            </div>
                          </td>

                          {/* Print Action Button */}
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                            <button
                              onClick={() => handlePrintRollLabels([roll])}
                              className="btn btn-secondary"
                              title="Print Roll Label"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                gap: '3px',
                                border: '1px solid #800000',
                                backgroundColor: 'transparent',
                                color: '#800000',
                                height: '24px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(128, 0, 0, 0.08)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <Printer size={11} /> Print
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ── Fabric Movement View ──
  const renderFabricMovementView = () => {
    const autoSearchAndAddRoll = (val) => {
      const cleanedId = val.trim();
      if (!cleanedId) return;

      let foundRoll = allRolls.find(r => r.id === cleanedId);

      if (!foundRoll) {
        for (const po of processingOrders) {
          if (Array.isArray(po.received_rolls)) {
            const rx = po.received_rolls.find(r => r.id === cleanedId || r.greige_roll_id === cleanedId);
            if (rx) {
              const greigeRoll = allRolls.find(gr => gr.id === rx.greige_roll_id);
              foundRoll = {
                id: rx.id,
                greige_roll_id: rx.greige_roll_id,
                qty: Number(rx.qty || 0),
                isProcessed: true,
                isProcessedRoll: true,
                location_name: rx.location_name || po.received_place || greigeRoll?.location_name || 'Factory',
                order_number: greigeRoll?.order_number || '—',
                design_name: greigeRoll?.design_name || '—',
                design_no: greigeRoll?.design_no || '—',
                weaving_number: greigeRoll?.weaving_number || '—',
                pof_number: po.pof_number || '—'
              };
              break;
            }
          }
        }
      }

      if (foundRoll) {
        if (!foundRoll.isProcessed) {
          const isInspected = foundRoll.status === '4_point_inspected' || foundRoll.status === 'sent_to_processing' || foundRoll.status === 'received_from_processing';
          if (!isInspected) {
            alert(`Cannot add roll "${cleanedId}". Greige fabric rolls must be 4-point inspected before they can be moved.`);
            setSearchMoveRollId('');
            return;
          }
        }

        if (movingRolls.some(r => r.id === foundRoll.id)) {
          return;
        }

        const rollLocation = foundRoll.location_name || 'Factory';
        if (rollLocation !== fromLocation) {
          alert(`Cannot add roll "${cleanedId}". This roll is located at "${rollLocation}", but the transfer source is set to "${fromLocation}".`);
          setSearchMoveRollId('');
          return;
        }

        const qty = foundRoll.isProcessed ? foundRoll.qty : Number(foundRoll.actual_qty || foundRoll.actual_length || foundRoll.qty || 0);

        setMovingRolls(prev => [...prev, {
          id: foundRoll.id,
          order_number: foundRoll.order_number,
          design_name: foundRoll.design_name,
          design_no: foundRoll.design_no,
          weaving_number: foundRoll.weaving_number,
          pof_number: foundRoll.pof_number || null,
          isProcessedRoll: !!foundRoll.isProcessedRoll,
          qty: qty,
          location_name: rollLocation,
          isProcessed: !!foundRoll.isProcessed
        }]);

        setSearchMoveRollId('');
      }
    };

    const handleSearchAndAddRoll = (e) => {
      if (e) e.preventDefault();
      const cleanedId = searchMoveRollId.trim();
      if (!cleanedId) return;

      if (movingRolls.some(r => r.id === cleanedId)) {
        alert('Roll already added to the moving list.');
        setSearchMoveRollId('');
        return;
      }

      let foundRoll = allRolls.find(r => r.id === cleanedId);

      if (!foundRoll) {
        for (const po of processingOrders) {
          if (Array.isArray(po.received_rolls)) {
            const rx = po.received_rolls.find(r => r.id === cleanedId || r.greige_roll_id === cleanedId);
            if (rx) {
              const greigeRoll = allRolls.find(gr => gr.id === rx.greige_roll_id);
              foundRoll = {
                id: rx.id,
                greige_roll_id: rx.greige_roll_id,
                qty: Number(rx.qty || 0),
                isProcessed: true,
                isProcessedRoll: true,
                location_name: rx.location_name || po.received_place || greigeRoll?.location_name || 'Factory',
                order_number: greigeRoll?.order_number || '—',
                design_name: greigeRoll?.design_name || '—',
                design_no: greigeRoll?.design_no || '—',
                weaving_number: greigeRoll?.weaving_number || '—',
                pof_number: po.pof_number || '—'
              };
              break;
            }
          }
        }
      }

      if (foundRoll) {
        if (!foundRoll.isProcessed) {
          const isInspected = foundRoll.status === '4_point_inspected' || foundRoll.status === 'sent_to_processing' || foundRoll.status === 'received_from_processing';
          if (!isInspected) {
            alert(`Cannot add roll "${cleanedId}". Greige fabric rolls must be 4-point inspected before they can be moved.`);
            setSearchMoveRollId('');
            return;
          }
        }

        const rollLocation = foundRoll.location_name || 'Factory';
        if (rollLocation !== fromLocation) {
          alert(`Cannot add roll "${cleanedId}". This roll is located at "${rollLocation}", but the transfer source is set to "${fromLocation}".`);
          return;
        }

        const qty = foundRoll.isProcessed ? foundRoll.qty : Number(foundRoll.actual_qty || foundRoll.actual_length || foundRoll.qty || 0);

        setMovingRolls(prev => [...prev, {
          id: foundRoll.id,
          order_number: foundRoll.order_number,
          design_name: foundRoll.design_name,
          design_no: foundRoll.design_no,
          weaving_number: foundRoll.weaving_number,
          pof_number: foundRoll.pof_number || null,
          isProcessedRoll: !!foundRoll.isProcessedRoll,
          qty: qty,
          location_name: rollLocation,
          isProcessed: !!foundRoll.isProcessed
        }]);

        setSearchMoveRollId('');
      } else {
        alert(`Roll ID "${cleanedId}" not found in inventory.`);
      }
    };

    const handleCreateChallan = async (e) => {
      e.preventDefault();
      if (movingRolls.length === 0) {
        alert('Please add at least one roll to move.');
        return;
      }
      if (!sentBy.trim()) {
        alert('Please enter the name of the person sending the fabric.');
        return;
      }
      const fromLoc = fromLocation;
      if (fromLoc === toLocation) {
        alert(`Cannot move rolls to the same location (${toLocation}). Please select a different target location.`);
        return;
      }

      let nextNum = 1;
      fabricMovements.forEach(m => {
        const match = m.fmdc_number?.match(/FMDC\/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= nextNum) {
            nextNum = num + 1;
          }
        }
      });
      const fmdcNumber = `AT/2026/FMDC/${String(nextNum).padStart(5, '0')}`;

      const newMovement = {
        fmdc_number: fmdcNumber,
        from_location: fromLoc,
        to_location: toLocation,
        sent_by: sentBy,
        vehicle_number: vehicleNumber.trim() || null,
        status: 'SENT - YET TO RECEIVE',
        rolls: movingRolls
      };

      try {
        const { data, error } = await supabase
          .from('fabric_movements')
          .insert(newMovement)
          .select();

        if (error) {
          alert('Error saving fabric movement: ' + error.message);
          return;
        }

        // Immediately update database roll location records to match movement destination
        const weavingUpdates = {};
        const processingUpdates = {};

        for (const roll of movingRolls) {
          if (roll.isProcessed) {
            const targetPo = processingOrders.find(po =>
              Array.isArray(po.received_rolls) &&
              po.received_rolls.some(rx => rx.id === roll.id || rx.greige_roll_id === roll.id)
            );
            if (targetPo) {
              if (!processingUpdates[targetPo.id]) processingUpdates[targetPo.id] = [];
              processingUpdates[targetPo.id].push(roll.id);
            }
          } else {
            const targetWo = weavingOrders.find(wo =>
              Array.isArray(wo.fabric_rolls) &&
              wo.fabric_rolls.some(r => r.id === roll.id)
            );
            if (targetWo) {
              if (!weavingUpdates[targetWo.id]) weavingUpdates[targetWo.id] = [];
              weavingUpdates[targetWo.id].push(roll.id);
            }
          }
        }

        for (const woId of Object.keys(weavingUpdates)) {
          const targetWo = weavingOrders.find(wo => wo.id === woId);
          if (targetWo) {
            const rollIdsToUpdate = weavingUpdates[woId];
            const updatedFabricRolls = targetWo.fabric_rolls.map(r => {
              if (rollIdsToUpdate.includes(r.id)) {
                return { ...r, location_name: toLocation };
              }
              return r;
            });
            await supabase
              .from('weaving_orders')
              .update({ fabric_rolls: updatedFabricRolls })
              .eq('id', woId);
          }
        }

        for (const poId of Object.keys(processingUpdates)) {
          const targetPo = processingOrders.find(po => po.id === poId);
          if (targetPo) {
            const rollIdsToUpdate = processingUpdates[poId];
            const updatedReceivedRolls = targetPo.received_rolls.map(rx => {
              if (rollIdsToUpdate.includes(rx.id) || rollIdsToUpdate.includes(rx.greige_roll_id)) {
                return { ...rx, location_name: toLocation };
              }
              return rx;
            });
            await supabase
              .from('processing_orders')
              .update({ received_rolls: updatedReceivedRolls })
              .eq('id', poId);
          }
        }

        alert(`Challan ${fmdcNumber} created successfully!`);
        setActiveChallan(data?.[0] || newMovement);
        setShowMoveFabricModal(false);
        setMovingRolls([]);
        setSentBy('');
        setVehicleNumber('');
        setShowPrintChallanModal(true);
        fetchData();
      } catch (err) {
        console.error('Error during challan creation:', err);
        alert('An unexpected error occurred during challan creation.');
      }
    };

    const toggleChallan = (id) => {
      setExpandedChallans(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleReceiveChallan = async (challan) => {
      const confirmReceive = window.confirm(`Are you sure you want to receive challan ${challan.fmdc_number}? This will update all ${challan.rolls.length} rolls' location to "${challan.to_location}".`);
      if (!confirmReceive) return;
      try {
        const nextStatus = challan.to_location === 'Factory' ? 'RECEIVED IN FACTORY' : 'RECEIVED IN OFFICE';
        const { error: fmdcError } = await supabase
          .from('fabric_movements')
          .update({ status: nextStatus })
          .eq('id', challan.id);

        if (fmdcError) {
          alert('Error updating challan status: ' + fmdcError.message);
          return;
        }

        // 1. Group rolls by Weaving Order ID and Processing Order ID to prevent overwrite race conditions
        const weavingUpdates = {};
        const processingUpdates = {};

        for (const roll of (challan.rolls || [])) {
          if (roll.isProcessed) {
            const targetPo = processingOrders.find(po =>
              Array.isArray(po.received_rolls) &&
              po.received_rolls.some(rx => rx.id === roll.id || rx.greige_roll_id === roll.id)
            );
            if (targetPo) {
              if (!processingUpdates[targetPo.id]) {
                processingUpdates[targetPo.id] = [];
              }
              processingUpdates[targetPo.id].push(roll.id);
            }
          } else {
            const targetWo = weavingOrders.find(wo =>
              Array.isArray(wo.fabric_rolls) &&
              wo.fabric_rolls.some(r => r.id === roll.id)
            );
            if (targetWo) {
              if (!weavingUpdates[targetWo.id]) {
                weavingUpdates[targetWo.id] = [];
              }
              weavingUpdates[targetWo.id].push(roll.id);
            }
          }
        }

        // 2. Perform updates for each unique Weaving Order
        for (const woId of Object.keys(weavingUpdates)) {
          const targetWo = weavingOrders.find(wo => wo.id === woId);
          if (targetWo) {
            const rollIdsToUpdate = weavingUpdates[woId];
            const updatedFabricRolls = targetWo.fabric_rolls.map(r => {
              if (rollIdsToUpdate.includes(r.id)) {
                return { ...r, location_name: challan.to_location };
              }
              return r;
            });
            await supabase
              .from('weaving_orders')
              .update({ fabric_rolls: updatedFabricRolls })
              .eq('id', woId);
          }
        }

        // 3. Perform updates for each unique Processing Order
        for (const poId of Object.keys(processingUpdates)) {
          const targetPo = processingOrders.find(po => po.id === poId);
          if (targetPo) {
            const rollIdsToUpdate = processingUpdates[poId];
            const updatedReceivedRolls = targetPo.received_rolls.map(rx => {
              if (rollIdsToUpdate.includes(rx.id) || rollIdsToUpdate.includes(rx.greige_roll_id)) {
                return { ...rx, location_name: challan.to_location };
              }
              return rx;
            });
            await supabase
              .from('processing_orders')
              .update({ received_rolls: updatedReceivedRolls })
              .eq('id', poId);
          }
        }

        alert(`Challan ${challan.fmdc_number} has been received and inventory locations have been updated successfully!`);
        fetchData();
      } catch (err) {
        console.error('Error during challan receiving:', err);
        alert('An unexpected error occurred while receiving the challan.');
      }
    };

    return (
      <div style={{ width: '100%', padding: '1.5rem', boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => {
                if (defaultView === 'fabric_movement') {
                  navigate('/production');
                } else {
                  setViewMode('menu');
                }
                setMovingRolls([]);
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '36px', height: '36px', borderRadius: '10px',
                border: '1px solid var(--border-current)', background: 'var(--surface-current)',
                cursor: 'pointer', color: 'var(--text-current)', transition: 'all 0.15s'
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-current)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshCw size={22} color="#10b981" />
                Fabric Movement
              </h1>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.825rem', color: 'var(--text-muted-current)' }}>
                Track inventory locations and transfer fabric rolls between Factory and Office
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setMovingRolls([]);
              setSentBy('');
              setFromLocation('Factory');
              setToLocation('Office');
              setShowMoveFabricModal(true);
            }}
            style={{
              padding: '0.6rem 1.2rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '800',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
              transition: 'all 0.2s'
            }}
            className="hover-lift"
          >
            <Plus size={16} /> Move Fabric
          </button>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.75rem' }}>
          <button
            onClick={() => setFabricMovementTab('rolls')}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '8px',
              border: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: '700',
              transition: 'all 0.15s',
              backgroundColor: fabricMovementTab === 'rolls' ? '#10b981' : 'transparent',
              color: fabricMovementTab === 'rolls' ? 'white' : 'var(--text-muted-current)',
              boxShadow: fabricMovementTab === 'rolls' ? '0 4px 6px -1px rgba(16,185,129,0.2)' : 'none'
            }}
          >
            📦 Active Rolls Inventory
          </button>
          <button
            onClick={() => setFabricMovementTab('fmdc')}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '8px',
              border: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: '700',
              transition: 'all 0.15s',
              backgroundColor: fabricMovementTab === 'fmdc' ? '#10b981' : 'transparent',
              color: fabricMovementTab === 'fmdc' ? 'white' : 'var(--text-muted-current)',
              boxShadow: fabricMovementTab === 'fmdc' ? '0 4px 6px -1px rgba(16,185,129,0.2)' : 'none'
            }}
          >
            📄 Movement Challans (FMDCs)
          </button>
        </div>

        {/* Tab 1: Rolls Inventory */}
        {fabricMovementTab === 'rolls' && (
          <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted-current)' }}>
                Total Available Rolls: {allRolls.length}
              </span>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: '0.78rem', width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--border-current)' }}>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', width: '25%' }}>Roll ID</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', width: '15%' }}>Order Number</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', width: '25%' }}>Design Details</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', width: '15%' }}>Order Forms</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', width: '10%' }}>Qty (m)</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', width: '10%' }}>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {allRolls.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                        No fabric rolls found.
                      </td>
                    </tr>
                  ) : (
                    allRolls.map((roll, idx) => {
                      const qty = roll.movement_qty;
                      return (
                        <tr key={roll.id || idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                          <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontWeight: '700', color: 'var(--text-current)' }}>
                            {roll.id}
                            {roll.isSentToProcessing && (
                              <span style={{ marginLeft: '6px', fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: '800' }}>
                                PROCESSED
                              </span>
                            )}
                            {roll.isProcessedRoll && (
                              <span style={{ marginLeft: '6px', fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: '800' }}>
                                PROCESSED ROLL
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#1e3a8a' }}>
                            {roll.order_number}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong style={{ fontSize: '0.78rem' }}>{roll.design_name}</strong>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>Number: {roll.design_no}</span>
                            </div>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', color: '#047857' }}>
                            {roll.isProcessedRoll ? roll.pof_number : roll.weaving_number}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '800', color: '#800000' }}>
                            {qty.toFixed(2)} m
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              backgroundColor: (roll.location_name || 'Factory') === 'Factory' ? '#ecfdf5' : '#eff6ff',
                              border: '1px solid ' + ((roll.location_name || 'Factory') === 'Factory' ? '#a7f3d0' : '#bfdbfe'),
                              color: (roll.location_name || 'Factory') === 'Factory' ? '#047857' : '#1e40af'
                            }}>
                              {roll.location_name || 'Factory'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Movement Challans */}
        {fabricMovementTab === 'fmdc' && (
          <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted-current)' }}>
                Total Challans: {fabricMovements.length}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: '0.78rem', width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--border-current)' }}>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', width: '15%' }}>FMDC Number</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', width: '10%' }}>From</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', width: '10%' }}>To</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', width: '12%' }}>Sent By</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', width: '10%' }}>Total Rolls</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', width: '13%' }}>Total Qty</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', width: '15%' }}>Status</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', width: '10%' }}>Date</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', width: '5%' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {fabricMovements.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                        No fabric movement challans found.
                      </td>
                    </tr>
                  ) : (
                    fabricMovements.map((m, idx) => {
                      const dateStr = m.created_at ? new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                      const rollsCount = (m.rolls || []).length;
                      const rollsQty = (m.rolls || []).reduce((sum, r) => sum + Number(r.qty || 0), 0);
                      const isChallanExpanded = expandedChallans[m.id];
                      return (
                        <React.Fragment key={m.id || idx}>
                          <tr style={{ borderBottom: '1px solid var(--border-current)' }}>
                            <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontWeight: '805' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: '#059669' }} onClick={() => toggleChallan(m.id)}>
                                {isChallanExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                {m.fmdc_number}
                              </div>
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>
                              {m.from_location}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>
                              {m.to_location}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem' }}>
                              {m.sent_by}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '700', color: 'var(--text-current)' }}>
                              {rollsCount}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '800', color: '#800000' }}>
                              {rollsQty.toFixed(2)} m
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.68rem',
                                fontWeight: '700',
                                backgroundColor: m.status.startsWith('RECEIVED') ? '#ecfdf5' : '#fffbeb',
                                border: '1px solid ' + (m.status.startsWith('RECEIVED') ? '#a7f3d0' : '#fde68a'),
                                color: m.status.startsWith('RECEIVED') ? '#047857' : '#b45309'
                              }}>
                                {m.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem' }}>
                              {dateStr}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}>
                                <button
                                  onClick={() => {
                                    setActiveChallan(m);
                                    setShowPrintChallanModal(true);
                                  }}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                    backgroundColor: 'rgba(5, 150, 105, 0.06)', border: '1px solid #059669',
                                    color: '#059669', padding: '4px 10px', borderRadius: '6px',
                                    fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer'
                                  }}
                                  className="hover-lift"
                                >
                                  <Printer size={12} /> View & Print
                                </button>
                                {m.status === 'SENT - YET TO RECEIVE' && (
                                  <button
                                    onClick={() => handleReceiveChallan(m)}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                      backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981',
                                      color: '#047857', padding: '4px 10px', borderRadius: '6px',
                                      fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer'
                                    }}
                                    className="hover-lift"
                                  >
                                    Receive
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isChallanExpanded && (
                            <tr style={{ backgroundColor: '#f9fafb' }}>
                              <td colSpan="9" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-current)' }}>
                                <div style={{
                                  backgroundColor: 'white',
                                  border: '1px solid var(--border-current)',
                                  borderRadius: '8px',
                                  padding: '1rem',
                                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 0.75rem 0' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.78rem', fontWeight: '850', color: '#111827', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      📦 Challan Fabric Rolls Details ({rollsCount} rolls)
                                    </h4>
                                    {m.vehicle_number && (
                                      <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#047857', backgroundColor: '#ecfdf5', padding: '2px 8px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                                        🚛 Vehicle No: {m.vehicle_number}
                                      </span>
                                    )}
                                  </div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                    <thead>
                                      <tr style={{ borderBottom: '1.5px solid var(--border-current)', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted-current)' }}>
                                        <th style={{ padding: '0.4rem 0.5rem', width: '30%' }}>Roll ID</th>
                                        <th style={{ padding: '0.4rem 0.5rem', width: '20%' }}>Order Number</th>
                                        <th style={{ padding: '0.4rem 0.5rem', width: '35%' }}>Design Name & Number</th>
                                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', width: '15%' }}>Qty (m)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(m.rolls || []).map((roll, rIdx) => (
                                        <tr key={roll.id || rIdx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                          <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace', fontWeight: '700', color: 'var(--text-current)' }}>
                                            {roll.id}
                                            {roll.isProcessed && (
                                              <span style={{ marginLeft: '4px', fontSize: '0.55rem', padding: '1px 3px', borderRadius: '3px', backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: '800' }}>
                                                P
                                              </span>
                                            )}
                                          </td>
                                          <td style={{ padding: '0.4rem 0.5rem', fontWeight: '600' }}>{roll.order_number}</td>
                                          <td style={{ padding: '0.4rem 0.5rem' }}>{roll.design_name} ({roll.design_no})</td>
                                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: '700', color: '#800000' }}>{Number(roll.qty || 0).toFixed(2)} m</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr style={{ fontWeight: '800', borderTop: '1.5px solid var(--border-current)', backgroundColor: '#fcfcfc' }}>
                                        <td colSpan="3" style={{ padding: '0.5rem 0.5rem', textAlign: 'left' }}>Total</td>
                                        <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', color: '#800000' }}>{rollsQty.toFixed(2)} m</td>
                                      </tr>
                                    </tfoot>
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
            </div>
          </div>
        )}

        {/* ── Move Fabric Modal ── */}
        {showMoveFabricModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem', boxSizing: 'border-box'
          }}>
            <div className="glass-panel" style={{
              width: '100%', maxWidth: '950px', maxHeight: '90%', overflowY: 'auto',
              backgroundColor: 'white', padding: '2rem', borderRadius: '16px',
              display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-current)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🚚 Move Fabric Rolls
                </h2>
                <button
                  onClick={() => setShowMoveFabricModal(false)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted-current)' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Add Roll form */}
              <form onSubmit={handleSearchAndAddRoll} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-current)' }}>Scan or Enter Fabric Roll ID</label>
                  <input
                    type="text"
                    placeholder="Enter Roll ID..."
                    value={searchMoveRollId}
                    onChange={e => {
                      const val = e.target.value;
                      setSearchMoveRollId(val);
                      autoSearchAndAddRoll(val);
                    }}
                    style={{
                      padding: '0.5rem 0.75rem', borderRadius: '8px',
                      border: '1px solid var(--border-current)', fontSize: '0.85rem', width: '100%', outline: 'none'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.25rem', backgroundColor: '#10b981', color: 'white',
                    border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer',
                    fontSize: '0.85rem', height: '38px'
                  }}
                >
                  Search & Add
                </button>
              </form>

              {/* Selected Rolls Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>
                  Selected Rolls ({movingRolls.length})
                </h4>
                {movingRolls.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                    backgroundColor: '#f9fafb',
                    border: '1px solid var(--border-current)',
                    borderRadius: '10px',
                    padding: '1rem',
                    marginBottom: '0.5rem'
                  }}>
                    <div style={{ textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '750', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Total Rolls Added</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#059669', marginTop: '2px' }}>{movingRolls.length}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '750', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Total Quantity Added</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#800000', marginTop: '2px' }}>
                        {movingRolls.reduce((sum, r) => sum + Number(r.qty || 0), 0).toFixed(2)} m
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '35%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '7%' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid var(--border-current)', fontWeight: '700' }}>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Roll ID</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Order Number</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Design</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Qty (m)</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Location</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movingRolls.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                            Add rolls by entering Roll ID above.
                          </td>
                        </tr>
                      ) : (
                        movingRolls.map((r, idx) => (
                          <tr key={r.id || idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontWeight: '700', wordBreak: 'break-all' }}>{r.id}</td>
                            <td style={{ padding: '0.5rem 0.75rem', wordBreak: 'break-all' }}>{r.order_number}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{r.design_name} ({r.design_no})</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '800' }}>{r.qty.toFixed(2)} m</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{r.location_name}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => setMovingRolls(prev => prev.filter(item => item.id !== r.id))}
                                style={{ border: 'none', background: 'none', color: '#ef4444', fontWeight: '700', cursor: 'pointer' }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {movingRolls.length > 0 && (
                      <tfoot>
                        <tr style={{ fontWeight: '850', borderTop: '2.5px solid var(--border-current)', fontSize: '0.8rem', backgroundColor: '#fafafa', color: 'var(--text-current)' }}>
                          <td colSpan="3" style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>
                            Total Rolls: {movingRolls.length}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: '#800000', fontWeight: '900' }}>
                            {movingRolls.reduce((sum, r) => sum + Number(r.qty || 0), 0).toFixed(2)} m
                          </td>
                          <td colSpan="2" />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Movement configurations */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderTop: '1px solid #eee', paddingTop: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-current)' }}>FROM LOCATION</label>
                    <select
                      value={fromLocation}
                      onChange={e => {
                        const newFrom = e.target.value;
                        setFromLocation(newFrom);
                        setToLocation(newFrom === 'Factory' ? 'Office' : 'Factory');
                      }}
                      disabled={movingRolls.length > 0}
                      style={{
                        padding: '0.5rem 0.75rem', borderRadius: '8px',
                        border: '1px solid var(--border-current)', fontSize: '0.85rem', outline: 'none', height: '38px',
                        cursor: movingRolls.length > 0 ? 'not-allowed' : 'pointer',
                        backgroundColor: movingRolls.length > 0 ? '#f3f4f6' : 'white'
                      }}
                    >
                      <option value="Factory">Factory</option>
                      <option value="Office">Office</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-current)' }}>TO LOCATION</label>
                    <select
                      value={toLocation}
                      onChange={e => setToLocation(e.target.value)}
                      style={{
                        padding: '0.5rem 0.75rem', borderRadius: '8px',
                        border: '1px solid var(--border-current)', fontSize: '0.85rem', outline: 'none', height: '38px', cursor: 'pointer'
                      }}
                    >
                      <option value="Factory">Factory</option>
                      <option value="Office">Office</option>
                      {partners.map(p => (
                        <option key={p.id} value={p.partner_name}>{p.partner_name} (Vendor)</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-current)' }}>SENT BY (PERSON NAME)</label>
                    <input
                      type="text"
                      placeholder="Enter person name..."
                      value={sentBy}
                      onChange={e => setSentBy(e.target.value)}
                      style={{
                        padding: '0.5rem 0.75rem', borderRadius: '8px',
                        border: '1px solid var(--border-current)', fontSize: '0.85rem', outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-current)' }}>VEHICLE NUMBER</label>
                    <input
                      type="text"
                      placeholder="Enter vehicle number..."
                      value={vehicleNumber}
                      onChange={e => setVehicleNumber(e.target.value)}
                      style={{
                        padding: '0.5rem 0.75rem', borderRadius: '8px',
                        border: '1px solid var(--border-current)', fontSize: '0.85rem', outline: 'none',
                        textTransform: 'uppercase'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>STATUS</span>
                    <div style={{
                      padding: '0.5rem 0.75rem', borderRadius: '8px',
                      border: '1px solid #fde68a', backgroundColor: '#fffbeb',
                      fontSize: '0.85rem', fontWeight: '800', color: '#b45309'
                    }}>
                      SENT - YET TO RECEIVE
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #eee', paddingTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setShowMoveFabricModal(false)}
                  style={{
                    padding: '0.5rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border-current)',
                    background: 'white', color: 'var(--text-current)', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateChallan}
                  disabled={movingRolls.length === 0 || !sentBy.trim()}
                  style={{
                    padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none',
                    background: (movingRolls.length === 0 || !sentBy.trim()) ? '#cbd5e1' : '#10b981',
                    color: 'white', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  Create Challan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Print Challan Modal ── */}
        {showPrintChallanModal && activeChallan && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem', boxSizing: 'border-box'
          }}>
            {!showEwayPrintModal && (
              <style>{`
                @media print {
                  @page {
                    size: landscape;
                    margin: 10mm;
                  }
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-challan-box, #printable-challan-box * {
                    visibility: visible !important;
                  }
                  #printable-challan-box {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    max-width: none !important;
                    max-height: none !important;
                    height: auto !important;
                    overflow: visible !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    box-shadow: none !important;
                    background: white !important;
                    color: black !important;
                  }
                  .no-print-btn {
                    display: none !important;
                  }
                }
              `}</style>
            )}
            
            <div id="printable-challan-box" style={{
              width: '100%', maxWidth: '1050px', maxHeight: '95vh', overflowY: 'auto',
              backgroundColor: 'white', padding: '2.5rem', borderRadius: '12px',
              border: '1px solid #ddd', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex', flexDirection: 'column', gap: '2rem'
            }}>
              
              {/* Logo & Document Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3.5px solid #059669', paddingBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <img
                    src="/logo.png"
                    alt="Ashok Textiles"
                    style={{ maxHeight: '64px', objectFit: 'contain' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                  <div style={{ display: 'none' }}>
                    <div style={{ fontSize: '2.2rem', fontWeight: '950', letterSpacing: '1px', margin: 0, color: '#1a1a1a', lineHeight: '1.1' }}>ASHOK TEXTILES</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '2rem', fontWeight: '950', letterSpacing: '1px', color: '#111827', lineHeight: '1.1' }}>ASHOK TEXTILES</div>
                    <span style={{ fontSize: '0.8rem', color: '#059669', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                      Fabric Movement Division
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '900', color: '#111827', letterSpacing: '0.5px' }}>FABRIC DELIVERY CHALLAN</h1>
                  <span style={{ fontSize: '0.95rem', fontWeight: '900', color: '#059669', fontFamily: 'monospace', display: 'block', marginTop: '4px' }}>
                    {activeChallan.fmdc_number}
                  </span>
                </div>
              </div>

              {/* Challan Metadata Fields */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)', 
                gap: '1.5rem', 
                fontSize: '0.85rem', 
                backgroundColor: '#f9fafb', 
                padding: '1.25rem', 
                borderRadius: '10px', 
                border: '1px solid #e5e7eb' 
              }}>
                <div>
                  <span style={{ color: '#4b5563', display: 'block', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Movement From</span>
                  <strong style={{ fontSize: '0.95rem', color: '#111827' }}>{activeChallan.from_location}</strong>
                </div>
                <div>
                  <span style={{ color: '#4b5563', display: 'block', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Movement To</span>
                  <strong style={{ fontSize: '0.95rem', color: '#111827' }}>{activeChallan.to_location}</strong>
                </div>
                <div>
                  <span style={{ color: '#4b5563', display: 'block', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Challan Date</span>
                  <strong style={{ fontSize: '0.95rem', color: '#111827' }}>
                    {activeChallan.created_at ? new Date(activeChallan.created_at).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#4b5563', display: 'block', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Sent By</span>
                  <strong style={{ fontSize: '0.95rem', color: '#111827' }}>{activeChallan.sent_by}</strong>
                </div>
                <div>
                  <span style={{ color: '#4b5563', display: 'block', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Status</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#b45309', textTransform: 'uppercase' }}>{activeChallan.status}</span>
                </div>
                <div>
                  <span style={{ color: '#4b5563', display: 'block', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Total Rolls</span>
                  <strong style={{ fontSize: '0.95rem', color: '#111827' }}>{(activeChallan.rolls || []).length} Rolls</strong>
                </div>
                <div>
                  <span style={{ color: '#4b5563', display: 'block', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Vehicle Number</span>
                  <strong style={{ fontSize: '0.95rem', color: '#111827' }}>{activeChallan.vehicle_number || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: '#4b5563', display: 'block', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Total Outbound Qty</span>
                  <strong style={{ fontSize: '1.1rem', color: '#800000' }}>
                    {((activeChallan.rolls || []).reduce((sum, r) => sum + Number(r.qty || 0), 0)).toFixed(2)} m
                  </strong>
                </div>
              </div>

              {/* Challan Rolls Details table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '900', color: '#111827', textTransform: 'uppercase', borderBottom: '2.5px solid #111827', paddingBottom: '0.4rem', letterSpacing: '0.5px' }}>
                  Outbound Fabric Rolls Summary
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #111827', backgroundColor: '#f9fafb', textAlign: 'left', fontWeight: '800', color: '#111827' }}>
                      <th style={{ padding: '0.75rem 0.5rem', width: '25%' }}>Roll ID</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '15%' }}>Order Number</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '25%' }}>Design Name & Number</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '15%' }}>Order Forms</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', width: '20%' }}>Qty (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeChallan.rolls || []).map((roll, idx) => (
                      <tr key={roll.id || idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontWeight: '700', fontSize: '0.85rem' }}>
                          {roll.id}
                          {roll.isProcessed && <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: '#0369a1', fontWeight: '800', backgroundColor: '#e0f2fe', padding: '1px 4px', borderRadius: '4px' }}>(P)</span>}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>{roll.order_number}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{roll.design_name} ({roll.design_no})</td>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600', color: '#4b5563' }}>
                          {roll.isProcessedRoll ? roll.pof_number : roll.weaving_number}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '800', fontSize: '0.9rem' }}>{Number(roll.qty || 0).toFixed(2)} m</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: '900', borderTop: '2.5px solid #111827', fontSize: '0.9rem', backgroundColor: '#f9fafb' }}>
                      <td colSpan="4" style={{ padding: '1rem 0.5rem', textAlign: 'left' }}>Total Outbound Fabric ({(activeChallan.rolls || []).length} Rolls)</td>
                      <td style={{ padding: '1rem 0.5rem', textAlign: 'right', color: '#800000', fontSize: '1.05rem' }}>
                        {(activeChallan.rolls || []).reduce((sum, r) => sum + Number(r.qty || 0), 0).toFixed(2)} m
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signature section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', marginTop: '4rem', borderTop: '1px dashed #cbd5e1', paddingTop: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#4b5563', fontWeight: '700', letterSpacing: '0.5px' }}>Dispatched By Signature</span>
                  <div style={{ borderBottom: '2px solid #111827', width: '200px' }}></div>
                  <strong style={{ fontSize: '0.85rem', color: '#111827' }}>{activeChallan.sent_by}</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#4b5563', fontWeight: '700', letterSpacing: '0.5px' }}>Received By Signature</span>
                  <div style={{ borderBottom: '2px solid #111827', width: '200px' }}></div>
                  <strong style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Yet To Receive</strong>
                </div>
              </div>

              {/* Print buttons */}
              <div className="no-print-btn" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #eee', paddingTop: '1.25rem', marginTop: '1rem' }}>
                <button
                  onClick={() => setShowPrintChallanModal(false)}
                  style={{
                    padding: '0.5rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border-current)',
                    background: 'white', color: 'var(--text-current)', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                {activeChallan.eway_bill_no ? (
                  <button
                    onClick={() => setShowEwayPrintModal(true)}
                    style={{
                      padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none',
                      background: '#0284c7', color: 'white', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
                    }}
                  >
                    <Printer size={16} /> Print E-Way Bill
                  </button>
                ) : (
                  <button
                    onClick={() => setShowEwayModal(true)}
                    style={{
                      padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none',
                      background: '#800000', color: 'white', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
                    }}
                  >
                    Generate E-Way Bill
                  </button>
                )}
                <button
                  onClick={() => window.print()}
                  style={{
                    padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none',
                    background: '#059669', color: 'white', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
                  }}
                >
                  <Printer size={16} /> Print Challan
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Eway Bill Generation Modal */}
        {showEwayModal && activeChallan && (() => {
          const totalQty = (activeChallan.rolls || []).reduce((sum, r) => sum + Number(r.qty || 0), 0);
          const items = [{
            productName: 'Processed Fabric',
            hsnCode: '5208',
            quantity: totalQty,
            qtyUnit: 'MTR',
            ratePerKg: 120,
            taxableAmount: Math.round(totalQty * 120)
          }];
          const toLoc = (activeChallan.to_location || '').toLowerCase();
          const isToOffice = toLoc.includes('office');
          const isToFactory = toLoc.includes('factory');

          const consigneeAddress = isToOffice
            ? '12/1 JAGADESN KADU, GUGAI, SALEM, 636006'
            : (isToFactory ? '6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, 636308' : '12/1 JAGADESN KADU, GUGAI, SALEM, 636006');

          const consigneePincode = isToOffice ? '636006' : (isToFactory ? '636308' : '636006');
          const consigneePlace = isToOffice ? 'GUGAI, SALEM' : 'VEERAPANDI, SALEM';

          const defaults = {
            docNo: activeChallan.fmdc_number,
            docDate: activeChallan.created_at,
            partnerName: 'ASHOK TEXTILES',
            partnerGstin: '33AAZFA6086D1Z6',
            partnerAddress: consigneeAddress,
            partnerPlace: consigneePlace,
            partnerPincode: consigneePincode,
            partnerStateCode: '33',
            vehicleNo: activeChallan.vehicle_number || '',
            items: items,
            totalQty: totalQty,
            qtyUnit: 'MTR',
            productName: 'Processed Fabric'
          };
          return (
            <EwayBillModal
              isOpen={showEwayModal}
              onClose={() => setShowEwayModal(false)}
              type="branch"
              record={activeChallan}
              defaultDetails={defaults}
              onSuccess={(res) => {
                setActiveChallan(prev => ({
                  ...prev,
                  eway_bill_no: res.ewayBillNo || prev.eway_bill_no,
                  eway_bill_status: res.eway_bill_status || 'generated',
                  eway_bill_date: res.ewayBillDate || prev.eway_bill_date
                }));
                setShowEwayModal(false);
                if (typeof fetchData === 'function') fetchData();
              }}
            />
          );
        })()}

        {/* Eway Bill Print Modal */}
        {showEwayPrintModal && activeChallan && (
          <EwayBillPrintModal
            isOpen={showEwayPrintModal}
            onClose={() => setShowEwayPrintModal(false)}
            type="branch"
            record={activeChallan}
          />
        )}

      </div>
    );
  };

  if (viewMode === 'menu') {
    return renderLandingMenu();
  }
  if (viewMode === 'greige_input') {
    return renderGreigeInputView();
  }
  if (viewMode === 'greige_rolls_details') {
    return renderGreigeRollsDetailsView();
  }
  if (viewMode === 'fabric_movement') {
    return renderFabricMovementView();
  }

  return (
    <div style={{ width: '100%', padding: '1rem' }}>
      {/* Back Header & Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setViewMode('menu')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', borderRadius: '10px',
              border: '1px solid var(--border-current)', background: 'var(--surface-current)',
              cursor: 'pointer', color: 'var(--text-current)', transition: 'all 0.15s'
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-current)' }}>
              <Layers size={22} color="#059669" />
              Fabric Input
            </h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted-current)' }}>
              Loom scheduling, daily logs, and production timeline tracker
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={fetchData}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 0.9rem', borderRadius: '8px',
              border: '1px solid var(--border-current)', background: 'var(--surface-current)',
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700',
              color: 'var(--text-current)', transition: 'all 0.15s'
            }}
          >
            <RefreshCw size={14} /> Refresh Data
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {[
          { label: 'Total Weaving Orders', val: weavingOrders.length, desc: 'All issued forms', color: '#1e293b' },
          { label: 'Active on Loom', val: weavingOrders.filter(o => o.status === 'on_process').length, desc: 'Running in sheds', color: '#3b82f6' },
          { label: 'Pending Start', val: weavingOrders.filter(o => ['pending', 'weft_yarn_allotted', 'weft_yarn_delivered'].includes(o.status)).length, desc: 'Allocated looms', color: '#d97706' },
          { label: 'Completed Today', val: weavingOrders.filter(o => ['completed', 'late_complete'].includes(o.status)).length, desc: 'Completed orders', color: '#10b981' }
        ].map((c, i) => (
          <div key={i} style={{
            backgroundColor: 'var(--surface-current)',
            border: '1px solid var(--border-current)',
            borderRadius: '12px', padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</span>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0.25rem 0', color: c.color }}>{c.val}</div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)' }}>{c.desc}</span>
          </div>
        ))}
      </div>

      {/* Search & Tabs Row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: '1.25rem', marginBottom: '1.25rem', flexWrap: 'wrap',
        borderBottom: '1px solid var(--border-current)', paddingBottom: '0.75rem'
      }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {[
            { id: 'airjet', label: 'Airjet Looms' },
            { id: 'rapier', label: 'Rapier Looms' },
            { id: 'job_work', label: 'Job Work Partners' },
            { id: 'wvof', label: 'Weaving Order Forms' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setCurrentTab(t.id)}
              style={{
                padding: '0.5rem 1rem', borderRadius: '8px',
                border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: '700',
                transition: 'all 0.15s',
                backgroundColor: currentTab === t.id ? '#059669' : 'transparent',
                color: currentTab === t.id ? 'white' : 'var(--text-muted-current)'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)' }} />
          <input
            type="text"
            placeholder="Search by WVOF, design, loom..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{
              width: '100%', padding: '0.45rem 1rem 0.45rem 2.25rem',
              borderRadius: '8px', border: '1px solid var(--border-current)',
              backgroundColor: 'var(--surface-current)', color: 'var(--text-current)',
              fontSize: '0.825rem', boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Date Navigation Bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1rem', padding: '0.75rem 1rem',
        backgroundColor: 'var(--surface-current)',
        border: '1px solid var(--border-current)',
        borderRadius: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={16} color="#059669" />
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
              cursor: 'pointer', color: 'var(--text-current)', transition: 'all 0.15s'
            }}
            title="Previous 7 days"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToToday}
            style={{
              padding: '0.35rem 0.85rem', borderRadius: '8px',
              border: '1px solid #059669', background: 'rgba(5,150,105,0.06)',
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700',
              color: '#059669', transition: 'all 0.15s'
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
              cursor: 'pointer', color: 'var(--text-current)', transition: 'all 0.15s'
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

      {/* Gantt Timeline View */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Loader size={32} color="#059669" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'var(--text-muted-current)' }}>Loading scheduling records...</p>
        </div>
      ) : (
        <div style={{
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#fff',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          marginBottom: '2rem'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: `${LABEL_COL_WIDTH + (DAY_COL_WIDTH * TOTAL_DAYS)}px` }}>
              
              {/* Timeline Header Month Row */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-current)',
                backgroundColor: '#059669'
              }}>
                <div style={{
                  width: `${LABEL_COL_WIDTH}px`, minWidth: `${LABEL_COL_WIDTH}px`,
                  padding: '0.5rem 1.25rem', fontWeight: '800',
                  fontSize: '0.72rem', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.95)',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  borderRight: '1px solid rgba(255,255,255,0.15)',
                  boxSizing: 'border-box'
                }}>
                  {currentTab === 'job_work' ? '🤝 Partner Sheds / Looms' : currentTab === 'wvof' ? '📋 Weaving Order Forms' : '⚙️ Loom Machine'}
                </div>
                {monthGroups.map((mg, i) => (
                  <div key={i} style={{
                    width: `${mg.count * DAY_COL_WIDTH}px`,
                    minWidth: `${mg.count * DAY_COL_WIDTH}px`,
                    padding: '0.5rem 0.5rem',
                    fontWeight: '800', fontSize: '0.7rem',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: 'rgba(255,255,255,0.95)',
                    textAlign: 'center',
                    borderRight: '1px solid rgba(255,255,255,0.1)',
                    boxSizing: 'border-box'
                  }}>
                    {mg.label}
                  </div>
                ))}
              </div>

              {/* Timeline Header Day Row */}
              <div style={{
                display: 'flex',
                borderBottom: '2px solid var(--border-current)',
                backgroundColor: '#f8fafc'
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
                      borderRight: '1px solid #f1f5f9',
                      backgroundColor: today ? 'rgba(5,150,105,0.08)' : isSunday ? '#fee2e2' : 'transparent',
                      color: today ? '#059669' : isSunday ? '#dc2626' : 'var(--text-muted-current)',
                      boxSizing: 'border-box'
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

              {/* Timeline Data Row Renderers */}
              {currentTab === 'airjet' && (
                airjetLooms.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted-current)' }}>
                    No Airjet looms configured.
                  </div>
                ) : (
                  airjetLooms.map(machine => renderLoomRow(machine, airjetOrdersByMachine[machine.id] || []))
                )
              )}

              {currentTab === 'rapier' && (
                rapierLooms.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted-current)' }}>
                    No Rapier looms configured.
                  </div>
                ) : (
                  rapierLooms.map(machine => renderLoomRow(machine, rapierOrdersByMachine[machine.id] || []))
                )
              )}

              {currentTab === 'job_work' && (
                jobWorkData.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted-current)' }}>
                    No Job Work partner records found.
                  </div>
                ) : (
                  jobWorkData.map(partnerGroup => renderPartnerGroupRow(partnerGroup))
                )
              )}

              {currentTab === 'wvof' && (
                filteredOrders.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted-current)' }}>
                    No Weaving Order Forms found.
                  </div>
                ) : (
                  filteredOrders.map(wvof => renderWvofDirectRow(wvof))
                )
              )}

            </div>
          </div>
        </div>
      )}

      {/* Selected WVOF Detail Modal Overlay */}
      {selectedWvof && renderDetailModal()}
    </div>
  );

  // --- RENDERING HELPERS FOR TOW TIMELINE ROWS ---

  // Renders a Machine/Loom Row for Airjet or Rapier
  function renderLoomRow(machine, machineWofs) {
    const isExpanded = expandedMachines[machine.id];
    
    // Allocate horizontal lanes for items
    const { itemLanes, totalLanes } = allocateLanes(machineWofs);
    const LANE_HEIGHT = 28;
    const ROW_PADDING = 12;
    const rowHeight = totalLanes * LANE_HEIGHT + ROW_PADDING;

    return (
      <div key={machine.id} style={{ borderBottom: '1px solid var(--border-current)' }}>
        {/* Machine Main Heading Row */}
        <div
          onClick={() => toggleMachine(machine.id)}
          style={{
            display: 'flex', cursor: 'pointer',
            backgroundColor: isExpanded ? '#f6fbf9' : '#fafafa',
            transition: 'background-color 0.15s'
          }}
        >
          {/* Machine Label Column */}
          <div style={{
            width: `${LABEL_COL_WIDTH}px`, minWidth: `${LABEL_COL_WIDTH}px`,
            padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
            borderRight: '1px solid var(--border-current)',
            fontWeight: '700', fontSize: '0.82rem', color: 'var(--text-current)',
            boxSizing: 'border-box'
          }}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span style={{ fontSize: '1.1rem' }}>⚙️</span>
            <div style={{ flex: 1 }}>
              <div>Loom {machine.machine_name}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', fontWeight: '600', marginTop: '1px' }}>
                {machine.scope === 'in_house' ? 'In-House Loom Shed' : 'Job Work Shed'}
              </div>
            </div>
            <span style={{
              backgroundColor: machineWofs.length > 0 ? 'rgba(5,150,105,0.1)' : '#f1f5f9',
              color: machineWofs.length > 0 ? '#059669' : '#94a3b8',
              padding: '2px 8px', borderRadius: '12px',
              fontSize: '0.65rem', fontWeight: '800'
            }}>
              {machineWofs.length} Form{machineWofs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Timeline Lanes Overlay (compact view) */}
          <div style={{ display: 'flex', position: 'relative', flex: 1, height: `${rowHeight}px` }}>
            {days.map((d, i) => (
              <div key={i} style={{
                width: `${DAY_COL_WIDTH}px`, minWidth: `${DAY_COL_WIDTH}px`,
                borderRight: '1px solid #f8fafc',
                backgroundColor: isToday(d) ? 'rgba(5,150,105,0.03)' : d.getDay() === 0 ? '#fffefc' : 'transparent',
                height: '100%', boxSizing: 'border-box'
              }} />
            ))}

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
        </div>

        {/* Expanded Row: show individual Weaving Order Forms for this Loom */}
        {isExpanded && (
          <div style={{ borderTop: '1px solid #f1f5f9', backgroundColor: '#fcfcfc' }}>
            {machineWofs.length === 0 ? (
              <div style={{ padding: '1rem 2rem', color: 'var(--text-muted-current)', fontSize: '0.75rem', fontStyle: 'italic', borderLeft: '3px solid #059669' }}>
                No active weaving order forms scheduled on Loom {machine.machine_name} in this time window.
              </div>
            ) : (
              machineWofs.map(wof => renderWvofGanttRow(wof))
            )}
          </div>
        )}
      </div>
    );
  }

  // Renders a Partner Group in Job Work tab (Partner -> Machine -> WVOF)
  function renderPartnerGroupRow(partnerGroup) {
    const isExpanded = expandedPartners[partnerGroup.partnerId];
    const totalOrdersCount = partnerGroup.machines.reduce((sum, m) => sum + m.orders.length, 0) + partnerGroup.ordersWithoutMachine.length;

    return (
      <div key={partnerGroup.partnerId} style={{ borderBottom: '2px solid var(--border-current)' }}>
        {/* Partner Header Row */}
        <div
          onClick={() => togglePartner(partnerGroup.partnerId)}
          style={{
            display: 'flex', cursor: 'pointer',
            backgroundColor: isExpanded ? '#f0faf6' : '#f8fafc',
            borderLeft: '4px solid #059669',
            alignItems: 'center', padding: '0.75rem 1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span style={{ fontSize: '1.2rem' }}>🤝</span>
            <div style={{ fontWeight: '800', fontSize: '0.92rem', color: '#1e293b' }}>
              {partnerGroup.partnerName}
            </div>
            <span style={{
              backgroundColor: totalOrdersCount > 0 ? 'rgba(5,150,105,0.1)' : '#cbd5e1',
              color: totalOrdersCount > 0 ? '#059669' : '#64748b',
              padding: '2px 8px', borderRadius: '12px',
              fontSize: '0.65rem', fontWeight: '850', marginLeft: '0.5rem'
            }}>
              {totalOrdersCount} Active Order{totalOrdersCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Expanded Partner: Show Partner Machines */}
        {isExpanded && (
          <div style={{ paddingLeft: '1.5rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
            {partnerGroup.machines.length === 0 && partnerGroup.ordersWithoutMachine.length === 0 ? (
              <div style={{ padding: '1.25rem', color: 'var(--text-muted-current)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                No active weaving machines or forms assigned to this partner.
              </div>
            ) : (
              <>
                {/* Render Partner Machines */}
                {partnerGroup.machines.map(machine => {
                  const mKey = `${partnerGroup.partnerId}-${machine.id}`;
                  const isMachineExpanded = expandedMachines[mKey];
                  const { itemLanes, totalLanes } = allocateLanes(machine.orders);
                  const LANE_HEIGHT = 28;
                  const ROW_PADDING = 12;
                  const rowHeight = totalLanes * LANE_HEIGHT + ROW_PADDING;

                  return (
                    <div key={machine.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                      {/* Machine row under Partner */}
                      <div
                        onClick={() => toggleMachine(mKey)}
                        style={{
                          display: 'flex', cursor: 'pointer',
                          backgroundColor: isMachineExpanded ? '#f6fbf9' : '#fff',
                          transition: 'background-color 0.15s'
                        }}
                      >
                        {/* Machine label */}
                        <div style={{
                          width: `${LABEL_COL_WIDTH - 24}px`, minWidth: `${LABEL_COL_WIDTH - 24}px`,
                          padding: '0.65rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                          borderRight: '1px solid var(--border-current)',
                          fontWeight: '700', fontSize: '0.78rem', color: 'var(--text-current)',
                          boxSizing: 'border-box'
                        }}>
                          {isMachineExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          <span>⚙️</span>
                          <div style={{ flex: 1 }}>
                            <div>Machine: {machine.name}</div>
                          </div>
                          <span style={{
                            backgroundColor: 'rgba(5,150,105,0.08)', color: '#059669',
                            padding: '1px 6px', borderRadius: '10px',
                            fontSize: '0.62rem', fontWeight: '800'
                          }}>
                            {machine.orders.length}
                          </span>
                        </div>

                        {/* Machine compact Gantt overlay */}
                        <div style={{ display: 'flex', position: 'relative', flex: 1, height: `${rowHeight}px` }}>
                          {days.map((d, i) => (
                            <div key={i} style={{
                              width: `${DAY_COL_WIDTH}px`, minWidth: `${DAY_COL_WIDTH}px`,
                              borderRight: '1px solid #f8fafc',
                              backgroundColor: isToday(d) ? 'rgba(5,150,105,0.03)' : d.getDay() === 0 ? '#fffefc' : 'transparent',
                              height: '100%', boxSizing: 'border-box'
                            }} />
                          ))}
                          {machine.orders.map(wof => {
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
                      </div>

                      {/* Expanding Partner Machine shows its WVOF list */}
                      {isMachineExpanded && (
                        <div style={{ borderTop: '1px solid #edf2f7', backgroundColor: '#fafafa' }}>
                          {machine.orders.map(wof => renderWvofGanttRow(wof, true))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Render unassigned machine orders for this partner */}
                {partnerGroup.ordersWithoutMachine.length > 0 && (() => {
                  const mKey = `${partnerGroup.partnerId}-unassigned`;
                  const isMachineExpanded = expandedMachines[mKey];
                  const { itemLanes, totalLanes } = allocateLanes(partnerGroup.ordersWithoutMachine);
                  const LANE_HEIGHT = 28;
                  const ROW_PADDING = 12;
                  const rowHeight = totalLanes * LANE_HEIGHT + ROW_PADDING;

                  return (
                    <div style={{ borderBottom: '1px solid #edf2f7' }}>
                      <div
                        onClick={() => toggleMachine(mKey)}
                        style={{
                          display: 'flex', cursor: 'pointer',
                          backgroundColor: isMachineExpanded ? '#f6fbf9' : '#fff',
                          transition: 'background-color 0.15s'
                        }}
                      >
                        <div style={{
                          width: `${LABEL_COL_WIDTH - 24}px`, minWidth: `${LABEL_COL_WIDTH - 24}px`,
                          padding: '0.65rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                          borderRight: '1px solid var(--border-current)',
                          fontWeight: '700', fontSize: '0.78rem', color: '#94a3b8',
                          boxSizing: 'border-box'
                        }}>
                          {isMachineExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          <span>⚠️</span>
                          <div style={{ flex: 1, fontStyle: 'italic' }}>Unassigned Machines</div>
                          <span style={{
                            backgroundColor: '#f1f5f9', color: '#64748b',
                            padding: '1px 6px', borderRadius: '10px',
                            fontSize: '0.62rem', fontWeight: '800'
                          }}>
                            {partnerGroup.ordersWithoutMachine.length}
                          </span>
                        </div>
                        <div style={{ display: 'flex', position: 'relative', flex: 1, height: `${rowHeight}px` }}>
                          {days.map((d, i) => (
                            <div key={i} style={{
                              width: `${DAY_COL_WIDTH}px`, minWidth: `${DAY_COL_WIDTH}px`,
                              borderRight: '1px solid #f8fafc',
                              backgroundColor: isToday(d) ? 'rgba(5,150,105,0.03)' : d.getDay() === 0 ? '#fffefc' : 'transparent',
                              height: '100%', boxSizing: 'border-box'
                            }} />
                          ))}
                          {partnerGroup.ordersWithoutMachine.map(wof => {
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
                      </div>
                      {isMachineExpanded && (
                        <div style={{ borderTop: '1px solid #edf2f7', backgroundColor: '#fafafa' }}>
                          {partnerGroup.ordersWithoutMachine.map(wof => renderWvofGanttRow(wof, true))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // Renders a Weaving Order Form Gantt details sub-row
  function renderWvofGanttRow(wof, isJobWorkNested = false) {
    const sc = getWvofStatusBadge(wof);
    const todayStr = getLocalDateString(new Date());

    return (
      <div key={wof.id} style={{
        display: 'flex', borderBottom: '1px solid #f3f3f3',
        transition: 'background-color 0.15s', minHeight: '60px'
      }}>
        {/* Weaving Form Left details metadata */}
        <div
          onClick={() => setSelectedWvof(wof)}
          style={{
            width: `${LABEL_COL_WIDTH - (isJobWorkNested ? 24 : 0)}px`,
            minWidth: `${LABEL_COL_WIDTH - (isJobWorkNested ? 24 : 0)}px`,
            padding: `0.55rem 1rem 0.55rem ${isJobWorkNested ? '1.5rem' : '2.25rem'}`,
            borderRight: '1px solid var(--border-current)',
            borderLeft: '3px solid #059669',
            fontSize: '0.75rem', cursor: 'pointer', boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '800', color: '#059669', fontFamily: 'monospace', fontSize: '0.72rem' }}>
              {wof.weaving_number}
            </span>
            <span style={{
              backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
              padding: '1px 6px', borderRadius: '10px', fontSize: '0.55rem', fontWeight: '800'
            }}>
              {sc.label}
            </span>
            {(() => {
              const weftBadge = getWeftYarnStatus(wof, deliveries);
              return (
                <span style={{
                  backgroundColor: weftBadge.bg, color: weftBadge.color, border: `1px solid ${weftBadge.border}`,
                  padding: '1px 6px', borderRadius: '10px', fontSize: '0.55rem', fontWeight: '800'
                }}>
                  Weft: {weftBadge.label}
                </span>
              );
            })()}
          </div>
          <div style={{ color: 'var(--text-muted-current)', fontSize: '0.68rem', lineHeight: '1.45' }}>
            <span style={{ fontWeight: '600' }}>Order:</span> {wof.order?.order_number || '—'}
            {' · '}
            <span style={{ fontWeight: '600' }}>Design:</span> {wof.order?.design_no || wof.design_no || '—'}
          </div>
          {(() => {
            const totalProduced = (wof.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
            const qrQty = (wof.fabric_rolls || []).reduce((sum, roll) => sum + (parseFloat(roll.qty) || 0), 0);
            const rolls = wof.fabric_rolls?.length || 0;
            return (
              <div style={{ color: '#059669', fontWeight: '750', fontSize: '0.68rem', marginTop: '1px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>Qty: {wof.qty ? `${Number(wof.qty).toLocaleString()} m` : '—'}</span>
                  <span style={{ color: '#047857' }}>Prod Qty: {totalProduced.toLocaleString()} m</span>
                </div>
                <div style={{ color: '#800000', fontWeight: '700', fontSize: '0.65rem' }}>
                  QR Qty: {qrQty.toLocaleString()} m ({rolls} {rolls === 1 ? 'Roll' : 'Rolls'})
                </div>
              </div>
            );
          })()}
        </div>

        {/* Weaving Form Gantt Timeline horizontal bars */}
        <div style={{ display: 'flex', position: 'relative', flex: 1, minHeight: '60px' }}>
          {days.map((d, i) => (
            <div key={i} style={{
              width: `${DAY_COL_WIDTH}px`, minWidth: `${DAY_COL_WIDTH}px`,
              borderRight: '1px solid #fafafa',
              backgroundColor: isToday(d) ? 'rgba(5,150,105,0.03)' : d.getDay() === 0 ? '#fefcfc' : 'transparent',
              boxSizing: 'border-box'
            }} />
          ))}
          {(() => {
            // 1. Planned Bar
            const plannedBar = calcBarPositionForDates(wof.start_date, wof.end_date, days);
            const pBg = '#fffbeb';
            const pBorder = '#eab308';
            const pText = '#854d0e';

            // 2. Actual Bar
            const showActual = !!wof.process_started_at || ['on_process', 'completed', 'late_complete', 'stopped'].includes(wof.status);
            let actualBar = null;
            let aBg = '';
            let aBorder = '';
            let aText = '';

            if (showActual) {
              const actualStartStr = getLocalDateString(wof.process_started_at) || wof.start_date || todayStr;
              const actualEndStr = ['completed', 'late_complete', 'stopped'].includes(wof.status)
                ? (getLocalDateString(wof.process_completed_at) || getLocalDateString(wof.updated_at) || todayStr)
                : todayStr;

              actualBar = calcBarPositionForDates(actualStartStr, actualEndStr, days);
              
              const statusVal = resolveWvofStatusValue(wof);
              if (statusVal === 'completed') {
                aBg = '#dcfce7';
                aBorder = '#22c55e';
                aText = '#166534';
              } else if (statusVal === 'stopped') {
                aBg = '#fff7ed';
                aBorder = '#f97316';
                aText = '#c2410c';
              } else if (statusVal === 'late_complete' || statusVal === 'late' || statusVal === 'start_date_exceeded') {
                aBg = '#fee2e2';
                aBorder = '#ef4444';
                aText = '#b91c1c';
              } else {
                aBg = '#e0f2fe';
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
  }

  // Renders Weaving Order Forms directly on WVOF Tab (expandable to show planned vs actual logs table)
  function renderWvofDirectRow(wvof) {
    const isExpanded = expandedWvofs[wvof.id];
    const sc = getWvofStatusBadge(wvof);
    const todayStr = getLocalDateString(new Date());

    return (
      <div key={wvof.id} style={{ borderBottom: '1px solid var(--border-current)' }}>
        {/* WVOF Main Row */}
        <div style={{ display: 'flex', minHeight: '64px' }}>
          {/* WVOF Label */}
          <div
            onClick={() => toggleWvof(wvof.id)}
            style={{
              width: `${LABEL_COL_WIDTH}px`, minWidth: `${LABEL_COL_WIDTH}px`,
              padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
              borderRight: '1px solid var(--border-current)', cursor: 'pointer',
              boxSizing: 'border-box'
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '800', color: '#059669', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                  {wvof.weaving_number}
                </span>
                <span style={{
                  backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                  padding: '1px 5px', borderRadius: '10px', fontSize: '0.55rem', fontWeight: '800'
                }}>
                  {sc.label}
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)', marginTop: '2px', lineHeight: '1.4' }}>
                <span style={{ fontWeight: '600' }}>Order:</span> {wvof.order?.order_number || '—'}
                {' · '}
                <span style={{ fontWeight: '600' }}>Loom:</span> {wvof.machine_name || (wvof.weaving_type === 'in_house' ? 'In-House' : `${wvof.partner_name || 'Partner'}`)}
              </div>
              {(() => {
                const totalProduced = (wvof.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
                const qrQty = (wvof.fabric_rolls || []).reduce((sum, roll) => sum + (parseFloat(roll.qty) || 0), 0);
                const rolls = wvof.fabric_rolls?.length || 0;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '1px' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: '650', color: '#059669', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span>Qty: {wvof.qty ? `${Number(wvof.qty).toLocaleString()} m` : '—'}</span>
                      <span style={{ color: '#047857' }}>Prod Qty: {totalProduced.toLocaleString()} m</span>
                    </div>
                    <div style={{ color: '#800000', fontWeight: '700', fontSize: '0.65rem' }}>
                      QR Qty: {qrQty.toLocaleString()} m ({rolls} {rolls === 1 ? 'Roll' : 'Rolls'})
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* WVOF Gantt Bars */}
          <div style={{ display: 'flex', position: 'relative', flex: 1 }}>
            {days.map((d, i) => (
              <div key={i} style={{
                width: `${DAY_COL_WIDTH}px`, minWidth: `${DAY_COL_WIDTH}px`,
                borderRight: '1px solid #f8fafc',
                backgroundColor: isToday(d) ? 'rgba(5,150,105,0.03)' : d.getDay() === 0 ? '#fffefc' : 'transparent',
                boxSizing: 'border-box'
              }} />
            ))}

            {(() => {
              // Planned Bar
              const plannedBar = calcBarPositionForDates(wvof.start_date, wvof.end_date, days);
              const pBg = '#fffbeb';
              const pBorder = '#eab308';
              const pText = '#854d0e';

              // Actual Bar
              const showActual = !!wvof.process_started_at || ['on_process', 'completed', 'late_complete', 'stopped'].includes(wvof.status);
              let actualBar = null;
              let aBg = '';
              let aBorder = '';
              let aText = '';

              if (showActual) {
                const actualStartStr = getLocalDateString(wvof.process_started_at) || wvof.start_date || todayStr;
                const actualEndStr = ['completed', 'late_complete', 'stopped'].includes(wvof.status)
                  ? (getLocalDateString(wvof.process_completed_at) || getLocalDateString(wvof.updated_at) || todayStr)
                  : todayStr;

                actualBar = calcBarPositionForDates(actualStartStr, actualEndStr, days);
                
                const statusVal = resolveWvofStatusValue(wvof);
                if (statusVal === 'completed') {
                  aBg = '#dcfce7';
                  aBorder = '#22c55e';
                  aText = '#166534';
                } else if (statusVal === 'stopped') {
                  aBg = '#fff7ed';
                  aBorder = '#f97316';
                  aText = '#c2410c';
                } else if (statusVal === 'late_complete' || statusVal === 'late' || statusVal === 'start_date_exceeded') {
                  aBg = '#fee2e2';
                  aBorder = '#ef4444';
                  aText = '#b91c1c';
                } else {
                  aBg = '#e0f2fe';
                  aBorder = '#3b82f6';
                  aText = '#1d4ed8';
                }
              }

              return (
                <>
                  {plannedBar && (
                    <GanttBar
                      key={`${wvof.id}-direct-planned`}
                      wof={wvof}
                      bar={plannedBar}
                      onWofClick={(w) => setSelectedWvof(w)}
                      customBg={pBg}
                      customBorder={pBorder}
                      customTextColor={pText}
                      customLabel={`${wvof.weaving_number} (Plan)`}
                      topOffset="8px"
                      customHeight="20px"
                      tooltipType="planned"
                      deliveries={deliveries}
                    />
                  )}
                  {showActual && actualBar && (
                    <GanttBar
                      key={`${wvof.id}-direct-actual`}
                      wof={wvof}
                      bar={actualBar}
                      onWofClick={(w) => setSelectedWvof(w)}
                      customBg={aBg}
                      customBorder={aBorder}
                      customTextColor={aText}
                      customLabel={`${wvof.weaving_number} (Actual)`}
                      topOffset="34px"
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

        {/* Expand shows Details log (Planned daily vs Actual logs) */}
        {isExpanded && (
          <div style={{ backgroundColor: '#fff', borderTop: '1px solid var(--border-current)' }}>
            <div style={{ padding: '1.25rem 2.25rem' }}>
              <div style={{
                border: '1px solid var(--border-current)',
                borderRadius: '8px', overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-current)' }}>
                      <th style={{ padding: '0.6rem 0.75rem', width: '30px' }}></th>
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
                            style={{ borderBottom: '1px solid var(--border-current)', cursor: 'pointer', backgroundColor: isDateExpanded ? '#f9fcfb' : 'transparent', transition: 'background-color 0.15s' }}
                          >
                            <td style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>
                              {isDateExpanded ? <ChevronDown size={12} style={{ color: '#059669' }} /> : <ChevronRight size={12} />}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>{formattedDate}</td>
                            <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#b45309', textAlign: 'right' }}>{plannedQty > 0 ? `${plannedQty.toLocaleString()} m` : '—'}</td>
                            <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{sumActual > 0 ? `${sumActual.toLocaleString()} m` : '—'}</td>
                          </tr>
                        );
                        
                        if (isDateExpanded) {
                          rows.push(
                            <tr key={`details-${dateStr}`} style={{ backgroundColor: '#fafdfb', borderBottom: '1px solid var(--border-current)' }}>
                              <td colSpan="4" style={{ padding: '0.75rem 1.5rem 0.75rem 2.5rem' }}>
                                <div style={{ border: '1px solid #bbf7d0', borderRadius: '6px', overflow: 'hidden' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: '#f0fdf4', borderBottom: '1px solid #bbf7d0', textAlign: 'left' }}>
                                        <th style={{ padding: '0.4rem 0.6rem', fontWeight: '700', color: '#166534' }}>Time</th>
                                        <th style={{ padding: '0.4rem 0.6rem', fontWeight: '700', color: '#166534' }}>Weaver Name</th>
                                        <th style={{ padding: '0.4rem 0.6rem', fontWeight: '700', color: '#166534', textAlign: 'right' }}>Qty Produced (Mtrs)</th>
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
                                          <tr key={log.id || lIdx} style={{ borderBottom: lIdx !== actualLogs.length - 1 ? '1px solid #bbf7d0' : 'none' }}>
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
                      
                      // Totals row
                      rows.push(
                        <tr key="totals" style={{ backgroundColor: '#f8fafc', fontWeight: '800' }}>
                          <td></td>
                          <td style={{ padding: '0.6rem 0.75rem' }}>Total Summary</td>
                          <td style={{ padding: '0.6rem 0.75rem', color: '#b45309', textAlign: 'right' }}>{totalPlannedSum.toLocaleString()} m</td>
                          <td style={{ padding: '0.6rem 0.75rem', color: '#047857', textAlign: 'right' }}>{totalActualSum.toLocaleString()} m</td>
                        </tr>
                      );
                      
                      return rows;
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Renders the Modal showing details of a selected Weaving Order Form
  function renderDetailModal() {
    const sc = getWvofStatusBadge(selectedWvof);
    const totalProduced = (selectedWvof.production_logs || []).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
    const qrGeneratedQty = (selectedWvof.fabric_rolls || []).reduce((sum, roll) => sum + (parseFloat(roll.qty) || 0), 0);
    const rollsCount = selectedWvof.fabric_rolls?.length || 0;

    return (
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
          width: '95%',
          maxWidth: '1280px',
          maxHeight: '94vh',
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
            backgroundColor: '#800000', // Maroon accent
            color: 'white'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
                Weaving Order Form Details
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)' }}>
                WVOF: <strong style={{ fontFamily: 'monospace' }}>{selectedWvof.weaving_number}</strong>
              </p>
            </div>
            <button
              onClick={() => setSelectedWvof(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '1.5rem',
                fontWeight: '300',
                opacity: 0.8,
                transition: 'opacity 0.2s',
                outline: 'none'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '1'}
              onMouseLeave={(e) => e.target.style.opacity = '0.8'}
            >
              &times;
            </button>
          </div>

          {/* Modal Body */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            overflowX: 'hidden', 
            display: 'flex', 
            backgroundColor: 'var(--bg-current)', 
            flexDirection: 'column' 
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', width: '100%' }}>
              {/* Metadata Info Panel */}
              <div style={{ 
                flex: '1 1 380px', 
                padding: '1.75rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1.5rem', 
                borderRight: '1px solid var(--border-current)', 
                boxSizing: 'border-box' 
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Status</span>
                    <span style={{
                      backgroundColor: sc.bg, color: sc.color,
                      border: `1px solid ${sc.border}`,
                      padding: '2px 10px', borderRadius: '12px',
                      fontSize: '0.75rem', fontWeight: '800', textTransform: 'capitalize',
                      display: 'inline-block'
                    }}>
                      {sc.label}
                    </span>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Order Number</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>{selectedWvof.order?.order_number || '—'}</span>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Design / Pattern</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>
                      {selectedWvof.order?.design_no || selectedWvof.design_no || '—'} {selectedWvof.order?.design_name ? `/ ${selectedWvof.order.design_name}` : ''}
                    </span>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Assigned Loom</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>
                      {selectedWvof.machine_name || 'Loom Unassigned'}
                    </span>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Partner Allocation</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>
                      {selectedWvof.partner_name || (selectedWvof.weaving_type === 'in_house' ? 'In-House Shed' : 'Job Work Partner Unassigned')}
                    </span>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Scheduling Dates</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-current)' }}>
                      {selectedWvof.start_date ? new Date(selectedWvof.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '?'} 
                      {' → '} 
                      {selectedWvof.end_date ? new Date(selectedWvof.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '?'}
                    </span>
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  gap: '1.5rem', 
                  backgroundColor: 'rgba(128, 0, 0, 0.04)', 
                  padding: '0.85rem 1.1rem', 
                  borderRadius: '10px', 
                  border: '1px solid rgba(128, 0, 0, 0.1)',
                  marginTop: 'auto'
                }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Target Qty</span>
                    <span style={{ fontSize: '1.15rem', fontWeight: '850', color: '#800000' }}>{Number(selectedWvof.qty).toLocaleString()} Mtrs</span>
                  </div>
                  <div style={{ flex: 1, borderLeft: '1px solid rgba(128, 0, 0, 0.1)', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Produced Qty</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: '850', color: '#800000' }}>{totalProduced.toLocaleString()} Mtrs</span>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(128, 0, 0, 0.1)', paddingTop: '0.4rem' }}>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.15rem' }}>QR Generated Qty</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: '850', color: '#800000' }}>
                        {qrGeneratedQty.toLocaleString()} Mtrs
                        <span style={{ fontSize: '0.75rem', fontWeight: '650', color: 'var(--text-muted-current)', marginLeft: '0.4rem', whiteSpace: 'nowrap' }}>
                          ({rollsCount} {rollsCount === 1 ? 'Roll' : 'Rolls'})
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weaving Production Logs & Fabric Roll Label Generator Panel */}
              <div style={{ 
                flex: '1 1 380px', 
                padding: '1.75rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1.5rem', 
                boxSizing: 'border-box' 
              }}>
                
                {/* 1. Weaving Production Logs */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.04em' }}>
                    📈 Weaving Production Logs ({selectedWvof.production_logs?.length || 0})
                  </span>
                  <div style={{
                    border: '1px solid var(--border-current)',
                    borderRadius: '8px', 
                    flex: 1, 
                    maxHeight: '260px', 
                    overflowY: 'auto', 
                    overflowX: 'hidden',
                    backgroundColor: 'white'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-current)', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '0.4rem 0.6rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Date & Time</th>
                          <th style={{ padding: '0.4rem 0.6rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Weaver</th>
                          <th style={{ padding: '0.4rem 0.6rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!selectedWvof.production_logs || selectedWvof.production_logs.length === 0 ? (
                          <tr>
                            <td colSpan="3" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                              No production log entries recorded yet.
                            </td>
                          </tr>
                        ) : (
                          [...selectedWvof.production_logs]
                            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                            .map((log, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.4rem 0.6rem', fontWeight: '600' }}>
                                  {new Date(log.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
                                  {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td style={{ padding: '0.4rem 0.6rem' }}>{log.weaver}</td>
                                <td style={{ padding: '0.4rem 0.6rem', fontWeight: '700', color: '#800000', textAlign: 'right' }}>
                                  {Number(log.qty).toLocaleString()} m
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Greige Fabric Rolls Section */}
                <div style={{ flex: 1.2, borderTop: '1px solid var(--border-current)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                  {isGeneratingRolls ? ( (() => {
                    const newQtySum = rollQuantities.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0);
                    const isExceeded = qrGeneratedQty + newQtySum > totalProduced;
                    const remaining = Math.max(0, totalProduced - qrGeneratedQty);

                    return (
                      <form onSubmit={handleSaveRollLabels} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: '#800000', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            🏷️ Generate Fabric Roll Labels
                          </span>
                          <button 
                            type="button"
                            onClick={() => { setIsGeneratingRolls(false); setRollCountInput(''); setRollQuantities([]); }}
                            style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="input-group" style={{ marginBottom: '0.25rem' }}>
                          <label className="input-label" style={{ fontSize: '0.68rem', fontWeight: '700' }}>How many rolls cut from loom?</label>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            placeholder="e.g. 3"
                            className="input-field"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem' }}
                            value={rollCountInput}
                            onChange={(e) => handleRollCountChange(e.target.value)}
                            required
                          />
                        </div>

                        {rollQuantities.length > 0 && (
                          <div style={{ flex: 1, maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-current)', borderRadius: '6px', padding: '0.5rem', backgroundColor: '#f8fafc' }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                              Roll IDs & Quantities (Meters)
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {rollQuantities.map((item, idx) => (
                                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: '700', color: '#1e293b' }}>
                                    #{idx + 1}: {item.id.split('/').pop()}
                                  </span>
                                  <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    placeholder="Meters"
                                    className="input-field"
                                    style={{ width: '120px', padding: '0.25rem 0.4rem', fontSize: '0.72rem', boxSizing: 'border-box' }}
                                    value={item.qty}
                                    onChange={(e) => {
                                      const updated = [...rollQuantities];
                                      updated[idx].qty = e.target.value;
                                      setRollQuantities(updated);
                                    }}
                                    required
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {rollQuantities.length > 0 && (
                          <div style={{
                            padding: '0.6rem',
                            borderRadius: '6px',
                            border: `1px solid ${isExceeded ? '#fca5a5' : '#cbd5e1'}`,
                            backgroundColor: isExceeded ? '#fef2f2' : '#f8fafc',
                            fontSize: '0.68rem',
                            lineHeight: '1.45',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                          }}>
                            <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Weaving Prod Logs:</span>
                              <span style={{ fontWeight: '700', color: '#1e293b' }}>{totalProduced.toLocaleString()} m</span>
                            </div>
                            <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Already QR Generated:</span>
                              <span style={{ fontWeight: '700', color: '#1e293b' }}>{qrGeneratedQty.toLocaleString()} m</span>
                            </div>
                            <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>New Rolls Total:</span>
                              <span style={{ fontWeight: '750', color: isExceeded ? '#dc2626' : '#047857' }}>{newQtySum.toLocaleString()} m</span>
                            </div>
                            <div style={{ borderTop: '1px dashed #cbd5e1', margin: '4px 0', paddingTop: '4px', display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: '700', color: isExceeded ? '#dc2626' : '#1e293b' }}>
                                {isExceeded ? 'Exceeded Limit By:' : 'Remaining Allowed Qty:'}
                              </span>
                              <span style={{ fontWeight: '800', color: isExceeded ? '#dc2626' : '#059669' }}>
                                {isExceeded 
                                  ? `${(qrGeneratedQty + newQtySum - totalProduced).toLocaleString()} m` 
                                  : `${remaining.toLocaleString()} m`
                                }
                              </span>
                            </div>
                            {isExceeded && (
                              <div style={{ color: '#b91c1c', fontSize: '0.6rem', fontWeight: '750', marginTop: '2px', display: 'flex', gap: '2px', alignItems: 'center' }}>
                                <span>⚠️ Total QR quantity exceeds Weaving Production Logs!</span>
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={isSavingRolls || rollQuantities.length === 0 || isExceeded}
                          style={{
                            width: '100%', padding: '0.5rem',
                            fontWeight: '700', fontSize: '0.78rem', cursor: isExceeded ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                            backgroundColor: isExceeded ? '#cbd5e1' : '#800000', border: 'none', borderRadius: '6px', color: isExceeded ? '#64748b' : 'white',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => { if(!e.currentTarget.disabled && !isExceeded) e.currentTarget.style.backgroundColor = '#991b1b'; }}
                          onMouseLeave={(e) => { if(!e.currentTarget.disabled && !isExceeded) e.currentTarget.style.backgroundColor = '#800000'; }}
                        >
                          {isSavingRolls ? (
                            <><Loader size={12} className="spin" /> Saving & Printing...</>
                          ) : (
                            <><Printer size={12} /> Generate & Print Labels</>
                          )}
                        </button>
                      </form>
                    )
                  })()
                  ) : (
                    /* Render Rolls Registry List */
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          📦 Greige Fabric Rolls ({selectedWvof.fabric_rolls?.length || 0})
                        </span>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {selectedWvof.fabric_rolls?.length > 0 && (
                            <button
                              onClick={() => handlePrintRollLabels(selectedWvof.fabric_rolls)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '0.2rem',
                                padding: '2px 8px', borderRadius: '4px', border: '1px solid #800000',
                                background: 'rgba(128,0,0,0.06)', color: '#800000',
                                fontSize: '0.62rem', fontWeight: '800', cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(128,0,0,0.12)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(128,0,0,0.06)'; }}
                            >
                              <Printer size={10} /> Print All
                            </button>
                          )}
                          <button
                            onClick={() => setIsGeneratingRolls(true)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.2rem',
                              padding: '2px 8px', borderRadius: '4px', border: 'none',
                              backgroundColor: '#800000', color: 'white',
                              fontSize: '0.62rem', fontWeight: '800', cursor: 'pointer',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#991b1b'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#800000'; }}
                          >
                            <Plus size={10} /> Generate Rolls
                          </button>
                        </div>
                      </div>

                      <div style={{
                        border: '1px solid var(--border-current)',
                        borderRadius: '8px', 
                        flex: 1, 
                        maxHeight: '260px', 
                        overflowY: 'auto', 
                        overflowX: 'hidden',
                        backgroundColor: '#f8fafc'
                      }}>
                        {!selectedWvof.fabric_rolls || selectedWvof.fabric_rolls.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted-current)', fontSize: '0.72rem', fontStyle: 'italic' }}>
                            No fabric rolls registered yet. Click Generate Rolls to begin.
                          </div>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', textAlign: 'left', tableLayout: 'fixed' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-current)', position: 'sticky', top: 0 }}>
                                <th style={{ padding: '0.35rem 0.5rem', fontWeight: '700', color: 'var(--text-muted-current)', width: '50%' }}>Roll ID</th>
                                <th style={{ padding: '0.35rem 0.5rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right', width: '20%' }}>Qty</th>
                                <th style={{ padding: '0.35rem 0.5rem', fontWeight: '700', color: 'var(--text-muted-current)', textAlign: 'right', width: '30%' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...selectedWvof.fabric_rolls]
                                .sort((a, b) => b.roll_no - a.roll_no)
                                .map((roll) => (
                                  <tr key={roll.id} style={{ borderBottom: '1px solid #edf2f7', backgroundColor: 'white' }}>
                                    <td style={{ 
                                      padding: '0.35rem 0.5rem', 
                                      fontWeight: '800', 
                                      fontFamily: 'monospace', 
                                      wordBreak: 'break-all', 
                                      whiteSpace: 'normal', 
                                      fontSize: '0.68rem',
                                      color: 'var(--text-current)' 
                                    }}>
                                      {roll.id}
                                    </td>
                                    <td style={{ padding: '0.35rem 0.5rem', fontWeight: '800', color: '#800000', textAlign: 'right' }}>
                                      {roll.qty} m
                                    </td>
                                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', boxSizing: 'border-box' }}>
                                      <button
                                        onClick={() => handlePrintRollLabels([roll])}
                                        style={{
                                          padding: '2px 5px', borderRadius: '4px', border: '1px solid #cbd5e1',
                                          background: 'white', color: '#475569',
                                          fontSize: '0.6rem', fontWeight: '700', cursor: 'pointer',
                                          display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                          transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                                      >
                                        <Printer size={9} /> Print
                                      </button>
                                      <button
                                        onClick={() => handleDeleteRoll(roll.id)}
                                        style={{
                                          padding: '2px 5px', borderRadius: '4px', border: '1px solid #fee2e2',
                                          background: 'white', color: '#ef4444',
                                          fontSize: '0.6rem', fontWeight: '700', cursor: 'pointer',
                                          display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                          transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                                      >
                                        <Trash2 size={9} /> Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
          
          {/* Modal Footer */}
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-current)',
            backgroundColor: '#f8fafc',
            display: 'flex', justifyContent: 'flex-end'
          }}>
            <button
              onClick={() => setSelectedWvof(null)}
              style={{
                padding: '0.45rem 1rem', borderRadius: '8px',
                border: '1px solid var(--border-current)', background: 'white',
                color: 'var(--text-current)', fontWeight: '700', fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
}
