import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, ArrowLeft, Trash2, Loader, 
  ChevronDown, ChevronUp, ChevronRight, Info, Layers, 
  Zap, Search, Check, Eye, FileText, 
  Truck, ArrowRight, Package, Calculator,
  ExternalLink, X, CheckCircle, Clock, XCircle,
  SlidersHorizontal, Printer, Edit
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import OrderWarpingTab from './OrderWarpingTab';
import OrderSizingTab from './OrderSizingTab';
import OrderYarnUsageTab from './OrderYarnUsageTab';
import OrderWeavingTab from './OrderWeavingTab';
import DyedReceiptPrintModal from '../DyedYarn/DyedReceiptPrintModal';


// ──────────────────────────────────────────────────────────────────────────────
// Helpers for Expected Delivery Dates & Warning Alerts
// ──────────────────────────────────────────────────────────────────────────────


const isGreigeRollMatch = (rxGreigeRollId, sentRollId) => {
  if (!rxGreigeRollId || !sentRollId) return false;
  const rxLower = rxGreigeRollId.toLowerCase();
  const sentLower = sentRollId.toLowerCase();
  return (
    rxLower === sentLower ||
    sentLower.startsWith(rxLower + '/') ||
    rxLower.startsWith(sentLower + '/')
  );
};

const getTodayString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDofAlertInfo = (dof, dyrrs) => {
  const today = getTodayString();
  const expected = dof.expected_delivery_date;

  if (dof.status === 'received') {
    const dofReceipts = (dyrrs || []).filter(r => r.dof_id === dof.id);
    if (dofReceipts.length > 0 && expected) {
      const maxReceiptDate = dofReceipts.reduce((max, r) => {
        return (!max || r.received_date > max) ? r.received_date : max;
      }, null);

      if (maxReceiptDate && maxReceiptDate <= expected) {
        return {
          type: 'received_on_time',
          label: 'Received On Time',
          color: '#166534',
          bgColor: '#dcfce7',
          borderColor: '#bbf7d0'
        };
      } else {
        return {
          type: 'received_late',
          label: 'Received Late',
          color: '#b91c1c',
          bgColor: '#fee2e2',
          borderColor: '#fca5a5'
        };
      }
    }
    return {
      type: 'received_on_time',
      label: 'Received On Time',
      color: '#166534',
      bgColor: '#dcfce7',
      borderColor: '#bbf7d0'
    };
  }

  if (!expected) return null;

  if (expected === today) {
    return {
      type: 'expected_today',
      label: 'Expected Today',
      color: '#b45309',
      bgColor: '#fef3c7',
      borderColor: '#fcd34d'
    };
  } else if (expected < today) {
    return {
      type: 'late',
      label: 'Late',
      color: '#b91c1c',
      bgColor: '#fee2e2',
      borderColor: '#fca5a5'
    };
  }

  return null;
};

const getApprovalStatus = (status) => {
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'rejected';
  return 'approved';
};

const getYarnStatus = (status) => {
  switch (status) {
    case 'pending':
    case 'rejected':
    case 'approved':           return 'greige_not_sent';
    case 'partially_sent':      return 'greige_partially_sent';
    case 'fully_sent':         return 'greige_sent';
    case 'partially_received': return 'partially_received';
    case 'received':           return 'fully_received';
    default:                   return status || 'greige_not_sent';
  }
};

const getLocalDateString = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getSingleDofStatusLabel = (dof, allDyrrs) => {
  const alertInfo = getDofAlertInfo(dof, allDyrrs);
  if (alertInfo) {
    if (alertInfo.type === 'late') return 'Late';
    if (alertInfo.type === 'expected_today') return 'Expected Today';
  }

  switch (dof.status) {
    case 'pending':           return 'Pending';
    case 'rejected':          return 'Rejected';
    case 'approved':           return 'Approved';
    case 'partially_sent':      return 'Greige Part Sent';
    case 'fully_sent':         return 'Greige Sent';
    case 'partially_received': return 'Part Received';
    case 'received':           return 'Received';
    default:                   return dof.status || 'Draft';
  }
};

const getSingleWofStatusLabel = (wof, orderDydis) => {
  const todayStr = getLocalDateString(new Date());
  let isWofLate = false;
  const isFinished = wof.status === 'completed' || (wof.status === 'stopped' && !!wof.wofdc_number);

  if (isFinished) {
    const actualEndStr = wof.process_completed_at
      ? getLocalDateString(wof.process_completed_at)
      : (getLocalDateString(wof.updated_at) || todayStr);
    if (wof.end_date && actualEndStr > wof.end_date) {
      isWofLate = true;
    }
  } else {
    if (wof.end_date && todayStr > wof.end_date) {
      isWofLate = true;
    }
  }

  if (isWofLate) return isFinished ? 'Late Completed' : 'Late';
  if (wof.status === 'stopped') return 'Stopped';

  const wofDydrs = (orderDydis || []).filter(d => d.production_form_id === wof.id);
  const allotments = wof.colour_allotments || [];
  const totalAllotted = allotments.reduce((sum, a) => sum + parseFloat(a.allotted_qty || a.kg || a.allottedQty || 0), 0);
  const totalDelivered = wofDydrs.reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

  let yarnStatus = 'Not Required';
  if (totalAllotted > 0) {
    if (totalDelivered === 0) {
      yarnStatus = 'Not Delivered';
    } else if (totalDelivered < totalAllotted - 0.05) {
      yarnStatus = 'Partially Delivered';
    } else {
      yarnStatus = 'Delivered';
    }
  }

  if (wof.status === 'on_process') {
    if (yarnStatus === 'Not Delivered') return 'Yarn Not Delivered';
    if (yarnStatus === 'Partially Delivered') return 'Yarn Part-Delivered';
    return 'On Process';
  }
  if (wof.status === 'created') {
    if (yarnStatus === 'Not Delivered') return 'Yarn Not Delivered';
    if (yarnStatus === 'Partially Delivered') return 'Yarn Part-Delivered';
    return 'Ready to Start';
  }
  if (wof.status === 'completed') return 'Completed';
  return wof.status || 'Created';
};

const getSingleSofStatusLabel = (sof) => {
  const todayStr = getLocalDateString(new Date());
  let isSofLate = false;
  const isFinished = sof.status === 'completed' || (sof.status === 'stopped' && !!sof.sofdc_number);

  if (isFinished) {
    const actualEndStr = sof.process_completed_at
      ? getLocalDateString(sof.process_completed_at)
      : (getLocalDateString(sof.updated_at) || todayStr);
    if (sof.end_date && actualEndStr > sof.end_date) {
      isSofLate = true;
    }
  } else {
    if (sof.end_date && todayStr > sof.end_date) {
      isSofLate = true;
    }
  }

  if (isSofLate) return isFinished ? 'Late Completed' : 'Late';
  if (sof.status === 'stopped') return 'Stopped';
  if (sof.status === 'on_process') return 'On Process';
  if (sof.status === 'created') return 'Created';
  if (sof.status === 'completed') return 'Completed';
  return sof.status || 'Created';
};

const getSingleWvofStatusLabel = (wvof) => {
  const todayStr = getLocalDateString(new Date());

  // 1. Completed state
  if (wvof.status === 'completed' || wvof.status === 'late_complete') {
    const actualEndStr = wvof.process_completed_at
      ? getLocalDateString(wvof.process_completed_at)
      : (getLocalDateString(wvof.updated_at) || todayStr);
    
    if (wvof.end_date && actualEndStr > wvof.end_date) {
      return 'Late Completed';
    }
    return 'Completed';
  }
  
  // 2. Stopped state
  if (wvof.status === 'stopped') {
    return 'Stopped';
  }
  
  // 3. Exceeded planned end date (Late)
  if (wvof.end_date && todayStr > wvof.end_date) {
    return 'Late';
  }
  
  // 4. Start date exceeded (Not started yet, but today is after start_date)
  const isStarted = !!wvof.process_started_at || wvof.status === 'on_process';
  if (!isStarted && wvof.start_date && todayStr > wvof.start_date) {
    return 'Start Date Exceeded';
  }

  if (wvof.status === 'on_process') return 'On Process';
  if (wvof.status === 'weft_yarn_allotted') return 'Weft Yarn Allotted';
  if (wvof.status === 'weft_yarn_partially_delivered') return 'Weft Yarn Partially Delivered';
  if (wvof.status === 'weft_yarn_delivered') return 'Weft Yarn Delivered';
  if (wvof.status === 'pending') return 'Pending';
  return wvof.status || 'Pending';
};

const getSinglePofStatusLabel = (pof) => {
  switch (pof.status) {
    case 'sent_to_processing': return 'Sent';
    case 'partially_received': return 'Part Received';
    case 'received': return 'Received';
    default: return pof.status || 'Sent';
  }
};

const getStatusThemeColor = (statusLabel) => {
  switch (statusLabel) {
    case 'Late':
    case 'Late Complete':
    case 'Late Completed':
    case 'Start Date Exceeded':
    case 'Rejected':
    case 'Yarn Not Delivered':
      return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
    
    case 'Expected Today':
    case 'Pending Approval':
    case 'Pending':
    case 'Stopped':
    case 'Yarn Part-Delivered':
    case 'Sent':
      return { bg: '#fffbeb', text: '#d97706', border: '#fcd34d' };
    
    case 'Weft Yarn Allotted':
      return { bg: '#fef9c3', text: '#854d0e', border: '#fde047' };
    case 'Weft Yarn Partially Delivered':
      return { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' };
    case 'Weft Yarn Delivered':
      return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
    
    case 'On Process':
      return { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' };
    
    case 'Ready to Start':
    case 'Greige Sent':
    case 'Greige Part Sent':
    case 'Part Received':
    case 'Approved':
      return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
    
    case 'Received':
    case 'Completed':
      return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
    
    default:
      return { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' };
  }
};

const getAggregatedStatusSummary = (items, resolverFn) => {
  if (!items || items.length === 0) {
    return { label: 'Not Started', bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' };
  }

  const counts = {};
  items.forEach(item => {
    const label = resolverFn(item);
    counts[label] = (counts[label] || 0) + 1;
  });

  const labelParts = Object.entries(counts).map(([label, count]) => {
    return items.length === 1 ? label : `${count} ${label}`;
  });
  const finalLabel = labelParts.join(', ');

  const priorityOrder = [
    'Late', 'Late Completed', 'Late Complete', 'Start Date Exceeded', 'Rejected', 'Yarn Not Delivered',
    'Expected Today', 'Pending Approval', 'Pending', 'Stopped', 'Yarn Part-Delivered',
    'Weft Yarn Allotted', 'Weft Yarn Partially Delivered',
    'On Process',
    'Ready to Start', 'Greige Sent', 'Greige Part Sent', 'Part Received', 'Approved',
    'Weft Yarn Delivered',
    'Received', 'Completed'
  ];

  let selectedLabel = 'Completed';
  for (const pLabel of priorityOrder) {
    if (counts[pLabel] > 0) {
      selectedLabel = pLabel;
      break;
    }
  }

  const theme = getStatusThemeColor(selectedLabel);
  return {
    label: finalLabel,
    bg: theme.bg,
    text: theme.text,
    border: theme.border
  };
};

function ProcessSummaryBadge({ code, name, status }) {
  return (
    <span 
      title={`${name} status: ${status.label}`}
      style={{ 
        backgroundColor: status.bg, 
        color: status.text, 
        border: `1px solid ${status.border || 'transparent'}`,
        padding: '2px 8px', 
        borderRadius: '6px', 
        fontSize: '0.65rem', 
        fontWeight: '800',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        textTransform: 'uppercase',
        letterSpacing: '0.01em',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        transition: 'all 0.2s ease',
        cursor: 'default'
      }}
    >
      <span style={{ opacity: 0.75 }}>{code}:</span>
      <span>{status.label}</span>
    </span>
  );
}

// ──────────────────────────────────────────────
// OrderCard Sub-component
// ──────────────────────────────────────────────
function OrderCard({ 
  order, 
  basePath, 
  onDelete, 
  yarnCounts, 
  onViewDOF, 
  onViewGYDR, 
  onViewDYRR, 
  onViewDYDR, 
  onViewPOF,
  onViewPOFRR,
  orderDofs = [], 
  allDyrrs = [],
  orderWofs = [],
  orderSofs = [],
  orderWvofs = [],
  orderDydis = [],
  allPofs = [],
  hideDeleteButton = false
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('order_info');
  const [showImageLightbox, setShowImageLightbox] = useState(false);
  const navigate = useNavigate();

  const orderPofs = useMemo(() => {
    return (allPofs || []).filter(pof => 
      (pof.weaving_order_ids && pof.weaving_order_ids.some(woId => orderWvofs.some(wv => wv.id === woId))) ||
      (pof.fabric_rolls && pof.fabric_rolls.some(roll => roll.order_number === order.order_number))
    );
  }, [allPofs, orderWvofs, order.order_number]);

  const totalGreigeInputQty = useMemo(() => {
    let sum = 0;
    (orderWvofs || []).forEach(wv => {
      const rolls = Array.isArray(wv.fabric_rolls) ? wv.fabric_rolls : [];
      const greigeRolls = rolls.filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing');
      sum += greigeRolls.reduce((acc, r) => acc + parseFloat(r.qty || 0), 0);
    });
    return sum;
  }, [orderWvofs, order.order_number]);

  const totalWeavedQty = useMemo(() => {
    let sum = 0;
    (orderWvofs || []).forEach(wv => {
      const logs = Array.isArray(wv.production_logs) ? wv.production_logs : [];
      sum += logs.reduce((acc, log) => acc + parseFloat(log.qty || 0), 0);
    });
    return sum;
  }, [orderWvofs]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return { bg: '#fef3c7', text: '#92400e', label: 'Draft' };
      case 'active': return { bg: '#dcfce7', text: '#166534', label: 'Active' };
      case 'in_progress': return { bg: '#e0f2fe', text: '#0369a1', label: 'In Progress' };
      case 'completed': return { bg: '#f1f5f9', text: '#475569', label: 'Completed' };
      default: return { bg: '#f1f5f9', text: '#475569', label: status };
    }
  };

  const statusStyle = getStatusColor(order.status);

  const getShortCountsString = (specs) => {
    if (!specs) return '-';
    const allWarpIds = specs.warp_selections?.flat() || [];
    const allWeftIds = specs.weft_selections?.flat() || [];
    const warpStr = allWarpIds.map(id => yarnCounts.find(y => y.id === id)?.count_value).filter(Boolean).join(' + ');
    const weftStr = allWeftIds.map(id => yarnCounts.find(y => y.id === id)?.count_value).filter(Boolean).join(' + ');
    return `${warpStr || '-'} X ${weftStr || '-'}`;
  };

  return (
    <div style={{ 
      backgroundColor: 'var(--surface-current)', 
      border: '1px solid var(--border-current)', 
      borderRadius: 'var(--radius-lg)', 
      overflow: 'hidden',
      transition: 'all 0.2s ease',
      boxShadow: isExpanded ? '0 10px 25px -5px rgba(0,0,0,0.1)' : 'none'
    }}>
      {/* ── Card Header / Main Info ── */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ 
          padding: '0.625rem 1rem',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}
      >
        <div className="order-card-header-main">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {order.design_image_url ? (
              <div 
                onClick={(e) => { e.stopPropagation(); setShowImageLightbox(true); }}
                style={{ 
                  width: '64px', 
                  height: '64px', 
                  borderRadius: '8px', 
                  overflow: 'hidden', 
                  border: '1px solid var(--border-current)', 
                  cursor: 'zoom-in',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  transition: 'transform 0.15s ease',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <img 
                  src={order.design_image_url} 
                  alt="Design thumbnail" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              </div>
            ) : (
              <div style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', width: '64px', height: '64px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Package size={28} />
              </div>
            )}
            <div>
              <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-current)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {order.order_number}
                <span style={{ 
                  backgroundColor: statusStyle.bg, 
                  color: statusStyle.text, 
                  padding: '2px 10px', 
                  borderRadius: '20px', 
                  fontSize: '0.7rem', 
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.025em'
                }}>
                  {statusStyle.label}
                </span>

                {/* Section Status Summary Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginLeft: '0.5rem' }} onClick={e => e.stopPropagation()}>
                  <ProcessSummaryBadge code="DY" name="Dyeing" status={getAggregatedStatusSummary(orderDofs, dof => getSingleDofStatusLabel(dof, allDyrrs))} />
                  <ProcessSummaryBadge code="WP" name="Warping" status={getAggregatedStatusSummary(orderWofs, wof => getSingleWofStatusLabel(wof, orderDydis))} />
                  <ProcessSummaryBadge code="SZ" name="Sizing" status={getAggregatedStatusSummary(orderSofs, sof => getSingleSofStatusLabel(sof))} />
                  <ProcessSummaryBadge code="WV" name="Weaving" status={getAggregatedStatusSummary(orderWvofs, wvof => getSingleWvofStatusLabel(wvof))} />
                  <ProcessSummaryBadge code="PR" name="Processing" status={getAggregatedStatusSummary(orderPofs, pof => getSinglePofStatusLabel(pof))} />
                </div>
                {(() => {
                  let expectedTodayCount = 0;
                  const lateDofNumbers = [];

                  (orderDofs || []).forEach(dof => {
                    const alertInfo = getDofAlertInfo(dof, allDyrrs);
                    if (alertInfo) {
                      if (alertInfo.type === 'expected_today') {
                        expectedTodayCount++;
                      } else if (alertInfo.type === 'late') {
                        lateDofNumbers.push(dof.dof_number);
                      }
                    }
                  });

                  return (
                    <>
                      {expectedTodayCount > 0 && (
                        <span style={{ 
                          backgroundColor: '#fef3c7', 
                          color: '#b45309', 
                          border: '1px solid #fcd34d',
                          padding: '2px 10px', 
                          borderRadius: '20px', 
                          fontSize: '0.7rem', 
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.025em'
                        }}>
                          {expectedTodayCount === 1 ? '1 DOF expected today' : `${expectedTodayCount} DOFs expected today`}
                        </span>
                      )}
                      {lateDofNumbers.length > 0 && (
                        <span style={{ 
                          backgroundColor: '#fee2e2', 
                          color: '#b91c1c', 
                          border: '1px solid #fca5a5',
                          padding: '2px 10px', 
                          borderRadius: '20px', 
                          fontSize: '0.7rem', 
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.025em'
                        }}>
                          Late: {lateDofNumbers.join(', ')}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
              <div style={{ color: 'var(--text-muted-current)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ textTransform: 'capitalize' }}>{order.order_type} Order</span>
                {order.technical_specs?.order_category && (
                  <>
                    <span>•</span>
                    <span style={{
                      backgroundColor: '#f3e8ff',
                      color: '#7c3aed',
                      border: '1px solid #ddd6fe',
                      padding: '1px 8px',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em'
                    }}>
                      {order.technical_specs.order_category}
                    </span>
                  </>
                )}
                <span>•</span>
                <span>{new Date(order.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          <div className="order-card-actions">
            <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
               <button 
                onClick={() => navigate(`${basePath}/edit-order/${order.id}`)}
                className="btn-icon"
                title={order.status === 'draft' ? "Resume Order (Draft)" : "Edit Order / View Details"}
                style={{ color: order.status === 'draft' ? 'var(--color-primary)' : 'var(--text-muted-current)' }}
              >
                {order.status === 'draft' ? <Edit size={18} /> : <Eye size={18} />}
              </button>
              {!hideDeleteButton && (
                <button 
                  onClick={onDelete}
                  className="btn-icon"
                  title="Delete Order"
                  style={{ color: '#ef4444' }}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
            <div style={{ color: 'var(--text-muted-current)', display: 'flex', alignItems: 'center' }}>
              {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.25rem 0' }}>
          {/* Row 1: Primary Meta */}
          <div className="order-meta-grid-row1" style={{ gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.05rem', display: 'block', letterSpacing: '0.05em' }}>Buyer / Brand</label>
              <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-current)' }}>{order.master_brands?.brand_name || 'N/A'}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.05rem', display: 'block', letterSpacing: '0.05em' }}>Merchandiser</label>
              <div style={{ fontWeight: '700', fontSize: '0.78rem', color: 'var(--text-current)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.merchandiser_name || '—'}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.05rem', display: 'block', letterSpacing: '0.05em' }}>Fabric Design</label>
              <div style={{ fontWeight: '600', fontSize: '0.78rem', color: 'var(--text-current)' }}>{order.design_no} / {order.design_name}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.05rem', display: 'block', letterSpacing: '0.05em' }}>Yarn Count</label>
              <div style={{ fontWeight: '700', fontSize: '0.78rem', color: 'var(--color-primary)' }}>{getShortCountsString(order.technical_specs)}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.05rem', display: 'block', letterSpacing: '0.05em' }}>GSM</label>
              <div style={{ fontWeight: '700', fontSize: '0.78rem', color: 'var(--text-current)' }}>{order.technical_specs?.gsm || '—'}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.05rem', display: 'block', letterSpacing: '0.05em' }}>Dispatch</label>
              <div style={{ fontWeight: '600', fontSize: '0.78rem', color: 'var(--text-current)' }}>{order.dispatch_date ? new Date(order.dispatch_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'}</div>
            </div>
          </div>

          {/* Subtle divider */}
          <div style={{ borderTop: '1px solid var(--border-current)', opacity: 0.3, margin: '0.15rem 0' }}></div>

          {/* Row 2: Quantities & Constructions */}
          <div className="order-meta-grid-row2" style={{ gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.05rem', display: 'block', letterSpacing: '0.05em' }}>Order Qty</label>
              <div style={{ fontWeight: '800', fontSize: '0.8rem', color: 'var(--text-current)' }}>
                {Number(order.total_quantity).toLocaleString()} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>Mtrs</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.05rem', display: 'block', letterSpacing: '0.05em' }}>Weaved Qty</label>
              <div style={{ fontWeight: '800', fontSize: '0.8rem', color: '#16a34a' }}>
                {totalWeavedQty.toLocaleString()} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>Mtrs</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.05rem', display: 'block', letterSpacing: '0.05em' }}>Greige Input Qty</label>
              <div style={{ fontWeight: '800', fontSize: '0.8rem', color: '#0284c7' }}>
                {totalGreigeInputQty.toLocaleString()} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>Mtrs</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.05rem', display: 'block', letterSpacing: '0.05em' }}>Order Construction</label>
              <div style={{ fontWeight: '700', fontSize: '0.78rem', color: 'var(--text-current)' }}>
                {order.technical_specs?.order_reed || '—'} / {order.technical_specs?.order_pick || '—'}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.05rem', display: 'block', letterSpacing: '0.05em' }}>Production Construction</label>
              <div style={{ fontWeight: '700', fontSize: '0.78rem', color: 'var(--text-current)' }}>
                {order.technical_specs?.on_loom_reed || '—'} / {order.technical_specs?.on_loom_pick || '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Expansion Section ── */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid var(--border-current)', backgroundColor: '#fafafa' }}>
          {/* Tab Headers */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-current)', padding: '0 1.5rem', gap: '1.5rem', overflowX: 'auto' }}>
            {[
              { id: 'order_info', label: 'Order Info', icon: <Info size={16} /> },
              { id: 'dyeing', label: 'Dyeing & Yarn', icon: <Zap size={16} /> },
              { id: 'yarn_usage', label: 'Yarn Usage', icon: <Calculator size={16} /> },
              { id: 'warping', label: 'Warping', icon: <Layers size={16} /> },
              { id: 'sizing', label: 'Sizing', icon: <SlidersHorizontal size={16} /> },
              { id: 'weaving', label: 'Weaving', icon: <Package size={16} /> },
              { id: 'processing', label: 'Processing', icon: <Truck size={16} /> },
              { id: 'inspection', label: 'Inspection', icon: <Search size={16} /> },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{ 
                  padding: '1rem 0',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-muted-current)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ padding: '1.5rem' }}>
            {activeTab === 'order_info' && (
              <TabOrderInfo 
                order={order} 
                onImageClick={() => setShowImageLightbox(true)} 
              />
            )}
            {activeTab === 'dyeing' && (
              <TabDyeing 
                order={order} 
                yarnCounts={yarnCounts} 
                onViewDOF={onViewDOF}
                onViewGYDR={onViewGYDR}
                onViewDYRR={onViewDYRR}
              />
            )}
            {activeTab === 'yarn_usage' && (
              <OrderYarnUsageTab 
                order={order} 
                onViewGYDR={onViewGYDR} 
                onViewDYRR={onViewDYRR} 
                onViewDYDR={onViewDYDR} 
              />
            )}
            {activeTab === 'warping' && (
              <OrderWarpingTab order={order} />
            )}
            {activeTab === 'sizing' && (
              <OrderSizingTab order={order} />
            )}
            {activeTab === 'weaving' && (
              <OrderWeavingTab order={order} />
            )}
            {activeTab === 'processing' && (
              <TabProcessing 
                order={order} 
                orderPofs={orderPofs} 
                onViewPOF={onViewPOF} 
                onViewPOFRR={onViewPOFRR} 
              />
            )}
            {activeTab === 'inspection' && <TabInspection order={order} />}
          </div>
        </div>
      )}

      {showImageLightbox && (
        <div 
          onClick={(e) => { e.stopPropagation(); setShowImageLightbox(false); }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '2rem',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              backgroundColor: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <img 
              src={order.design_image_url} 
              alt={`Design ${order.order_number}`}
              style={{ 
                maxWidth: '100%', 
                maxHeight: '75vh', 
                objectFit: 'contain',
                display: 'block'
              }} 
            />
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-current)', backgroundColor: '#fcfcfc' }}>
              <div>
                <strong style={{ fontSize: '1rem', color: 'var(--text-current)' }}>{order.order_number}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted-current)', marginTop: '0.2rem' }}>Design: {order.design_no} / {order.design_name}</div>
              </div>
              <button 
                onClick={() => setShowImageLightbox(false)}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 1rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-Tabs Implementation
// ──────────────────────────────────────────────────────────────────────────────

function TabOrderInfo({ order, onImageClick }) {
  const specs = order.technical_specs || {};
  return (
    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 500px' }} className="grid-4-to-2">
        <DetailItem label="Vendor" value={order.vendor?.partner_name} />
        <DetailItem label="Season" value={order.season} />
        <DetailItem label="FOB Date" value={order.fob_date} />
        <DetailItem label="Req Delivery Date" value={order.dispatch_date} />
        <DetailItem label="On Loom Width" value={specs.order_width ? `${specs.order_width}"` : '-'} />
        <DetailItem label="Finished Width" value={specs.finished_width ? `${specs.finished_width}"` : '-'} />
        
        <DetailItem label="Production Qty" value={specs.production_quantity ? `${specs.production_quantity} Mtrs` : '-'} />
        <DetailItem label="Weave Type" value={specs.weave_type} />
        <DetailItem label="GSM" value={specs.gsm || '-'} />
        <DetailItem label="Order Type" value={specs.order_category || '-'} />
        <DetailItem label="Merchandiser" value={order.merchandiser_name || '-'} />

        <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #ddd', margin: '0.5rem 0' }}></div>
        
        <DetailItem label="Order Construction" value={`${specs.order_reed} / ${specs.order_pick}`} />
        <DetailItem label="Production Construction" value={`${specs.on_loom_reed} / ${specs.on_loom_pick}`} />
      </div>

      {order.design_image_url && (
        <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fabric Design Image</label>
          <div 
            onClick={onImageClick}
            style={{ 
              width: '280px', 
              height: '280px', 
              borderRadius: '12px', 
              overflow: 'hidden', 
              border: '1px solid var(--border-current)', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              cursor: 'zoom-in',
              position: 'relative',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.03)';
              e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
            }}
          >
            <img 
              src={order.design_image_url} 
              alt="Fabric Design" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: '700',
              padding: '0.35rem',
              textAlign: 'center',
              backdropFilter: 'blur(2px)'
            }}>
              Click to view fullscreen
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>{label}</label>
      <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{value || '-'}</div>
    </div>
  );
}

function TabInspection({ order }) {
  const [weavingOrders, setWeavingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedWvofs, setExpandedWvofs] = useState({});

  useEffect(() => {
    async function fetchInspectionData() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('weaving_orders')
          .select(`
            id,
            weaving_number,
            start_date,
            end_date,
            qty,
            weaving_type,
            machine_name,
            partner_name,
            fabric_rolls,
            production_logs,
            machine:master_machines(machine_name),
            partner:master_partners(partner_name)
          `)
          .eq('order_id', order.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setWeavingOrders(data || []);
      } catch (err) {
        console.error('Error fetching inspection weaving orders:', err);
      } finally {
        setLoading(false);
      }
    }

    if (order?.id) {
      fetchInspectionData();
    }
  }, [order?.id]);

  // Calculations
  const productionQty = order.technical_specs?.production_quantity || order.total_quantity || '—';

  const totalDailyLogs = useMemo(() => {
    let sum = 0;
    weavingOrders.forEach(wv => {
      const logs = Array.isArray(wv.production_logs) ? wv.production_logs : [];
      logs.forEach(log => {
        sum += parseFloat(log.qty || 0);
      });
    });
    return sum;
  }, [weavingOrders]);

  const totalGreigeInputQty = useMemo(() => {
    let sum = 0;
    weavingOrders.forEach(wv => {
      const rolls = Array.isArray(wv.fabric_rolls) ? wv.fabric_rolls : [];
      const greigeRolls = rolls.filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing');
      sum += greigeRolls.reduce((acc, r) => acc + parseFloat(r.qty || 0), 0);
    });
    return sum;
  }, [weavingOrders]);

  const totalFourPointQty = useMemo(() => {
    let sum = 0;
    weavingOrders.forEach(wv => {
      const rolls = Array.isArray(wv.fabric_rolls) ? wv.fabric_rolls : [];
      const inspectedRolls = rolls.filter(r => r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing');
      sum += inspectedRolls.reduce((acc, r) => acc + parseFloat(r.actual_qty || r.actual_length || 0), 0);
    });
    return sum;
  }, [weavingOrders]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted-current)', padding: '1rem' }}>
        <Loader size={16} className="spin" /> Loading inspection data...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* ── Top Level Metric Cards ── */}
      <div className="grid-4-to-2" style={{ gap: '1rem' }}>
        <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Production Qty</span>
          <span style={{ fontSize: '1.5rem', fontWeight: '850', color: 'var(--text-current)' }}>
            {typeof productionQty === 'number' ? Number(productionQty).toLocaleString() : productionQty} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>{productionQty !== '—' ? 'Mtrs' : ''}</span>
          </span>
        </div>

        <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Total Daily Production Logs</span>
          <span style={{ fontSize: '1.5rem', fontWeight: '850', color: 'var(--text-current)' }}>
            {totalDailyLogs.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>Mtrs</span>
          </span>
        </div>

        <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Total Greige Input Qty</span>
          <span style={{ fontSize: '1.5rem', fontWeight: '850', color: 'var(--text-current)' }}>
            {totalGreigeInputQty.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>Mtrs</span>
          </span>
        </div>

        <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Total 4-Point Inspection Qty</span>
          <span style={{ fontSize: '1.5rem', fontWeight: '850', color: 'var(--text-current)' }}>
            {totalFourPointQty.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>Mtrs</span>
          </span>
        </div>
      </div>

      {/* ── Details Table ── */}
      <div>
        <h4 style={{ margin: '0 0 1rem 0', fontWeight: '800', fontSize: '0.95rem', color: '#800000', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Weaving Order Forms & Rolls QC Status
        </h4>

        <style>{`
          .qc-tooltip-trigger {
            position: relative;
            display: inline-block;
          }
          .qc-tooltip-trigger:hover .qc-tooltip-content {
            display: block !important;
          }
        `}</style>

        {weavingOrders.length === 0 ? (
          <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', fontStyle: 'italic', padding: '1rem' }}>No Weaving Order Forms found for this order.</p>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '2px solid var(--border-current)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)' }}>Weaving Order Form</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Actual Qty</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'center' }}>Greige Input</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'center' }}>4 Point Inspection</th>
                </tr>
              </thead>
              <tbody>
                {weavingOrders.map(wvof => {
                  const rolls = Array.isArray(wvof.fabric_rolls) ? wvof.fabric_rolls : [];
                  const allocation = wvof.weaving_type === 'in_house' 
                    ? `Loom: ${wvof.machine?.machine_name || wvof.machine_name || '—'}` 
                    : `Job: ${wvof.partner?.partner_name || wvof.partner_name || '—'}`;
                  const startDateStr = wvof.start_date ? new Date(wvof.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                  const endDateStr = wvof.end_date ? new Date(wvof.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

                  const isExpanded = !!expandedWvofs[wvof.id];
                  const totalWvofGreigeQty = rolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
                  const totalWvofActualQty = rolls.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.actual_length || 0), 0);
                  
                  const scannedCount = rolls.filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing').length;
                  const inspectedCount = rolls.filter(r => r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing').length;

                  return (
                    <React.Fragment key={wvof.id}>
                      {/* Weaving Order Form Header Row */}
                      <tr 
                        onClick={() => setExpandedWvofs(prev => ({ ...prev, [wvof.id]: !prev[wvof.id] }))}
                        style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-current)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span style={{ fontWeight: '800', color: '#800000', fontFamily: 'monospace' }}>{wvof.weaving_number}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontWeight: 'normal' }}>({startDateStr} → {endDateStr})</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: '750', color: 'var(--text-current)', marginLeft: '0.5rem' }}>{allocation}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '800' }}>
                          {totalWvofGreigeQty.toLocaleString()} m
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '800', color: '#800000' }}>
                          {totalWvofActualQty > 0 ? `${totalWvofActualQty.toLocaleString()} m` : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted-current)', fontWeight: '700' }}>
                          {scannedCount} / {rolls.length} Scanned
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted-current)', fontWeight: '700' }}>
                          {inspectedCount} / {rolls.length} Inspected
                        </td>
                      </tr>

                      {/* Fabric Rolls rows */}
                      {isExpanded && (
                        rolls.length === 0 ? (
                          <tr style={{ borderBottom: '1px solid var(--border-current)' }}>
                            <td colSpan={5} style={{ padding: '0.75rem 1.5rem', color: 'var(--text-muted-current)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                              No fabric rolls generated for this form yet.
                            </td>
                          </tr>
                        ) : (
                          [...rolls]
                            .sort((a, b) => a.roll_no - b.roll_no)
                            .map(roll => {
                              const isGreigeScanned = roll.status === 'greige received' || roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing';
                              const isQCInspected = roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing';

                              return (
                                <tr key={roll.id} style={{ borderBottom: '1px solid var(--border-current)', backgroundColor: 'white' }}>
                                  {/* Weaving Order Form column shows Roll ID */}
                                  <td style={{ padding: '0.65rem 1.5rem', fontWeight: '600', color: 'var(--text-current)', fontFamily: 'monospace' }}>
                                    Roll ID: {roll.id}
                                  </td>
                                  
                                  {/* Qty column: greige input qty */}
                                  <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: '600' }}>
                                    {roll.qty} m
                                  </td>
                                  
                                  {/* Actual Qty column: actual qty entered in 4-point inspection */}
                                  <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: '600', color: '#800000' }}>
                                    {roll.actual_qty || roll.actual_length || '—'} {isQCInspected ? 'm' : ''}
                                  </td>
                                  
                                  {/* Greige Input Scanned tick mark */}
                                  <td style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>
                                    {isGreigeScanned ? (
                                      <div className="qc-tooltip-trigger">
                                        <span style={{
                                          backgroundColor: '#dcfce7', color: '#166534',
                                          padding: '2px 8px', borderRadius: '4px',
                                          fontSize: '0.7rem', fontWeight: '800', cursor: 'help'
                                        }}>
                                          ✔️ Scanned
                                        </span>
                                        <div className="qc-tooltip-content" style={{
                                          display: 'none', position: 'absolute', right: '105%', top: '50%', transform: 'translateY(-50%)',
                                          backgroundColor: '#1e293b', color: 'white', padding: '0.75rem 1rem', borderRadius: '8px',
                                          width: '240px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
                                          zIndex: 1000, fontSize: '0.72rem', textAlign: 'left', lineHeight: '1.4', fontStyle: 'normal',
                                          border: '1px solid #334155'
                                        }}>
                                          <div style={{ fontWeight: '800', color: '#38bdf8', marginBottom: '4px', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>
                                            📥 Greige Input Scan
                                          </div>
                                          <div>
                                            <span style={{ color: '#94a3b8' }}>Scan Date:</span>{' '}
                                            <strong style={{ color: 'white' }}>
                                              {roll.received_at ? new Date(roll.received_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </strong>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <span style={{
                                        backgroundColor: '#fee2e2', color: '#b91c1c',
                                        padding: '2px 8px', borderRadius: '4px',
                                        fontSize: '0.7rem', fontWeight: '800'
                                      }}>
                                        ❌ Pending
                                      </span>
                                    )}
                                  </td>

                                  {/* 4 Point Inspection Done tick mark */}
                                  <td style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>
                                    {isQCInspected ? (
                                      <div className="qc-tooltip-trigger">
                                        <span style={{
                                          backgroundColor: '#ecfdf5', color: '#047857',
                                          padding: '2px 8px', borderRadius: '4px',
                                          fontSize: '0.7rem', fontWeight: '800', cursor: 'help'
                                        }}>
                                          ✔️ Inspected
                                        </span>
                                        <div className="qc-tooltip-content" style={{
                                          display: 'none', position: 'absolute', right: '105%', top: '50%', transform: 'translateY(-50%)',
                                          backgroundColor: '#1e293b', color: 'white', padding: '0.75rem 1rem', borderRadius: '8px',
                                          width: '300px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
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
                                              <span style={{ color: '#94a3b8' }}>Ok Qty:</span>
                                              <strong style={{ color: '#34d399' }}>{roll.approved_qty || 0} m</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                              <span style={{ color: '#94a3b8' }}>Inspectors:</span>
                                              <strong style={{ color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                                                {roll.inspector_1 || '—'}{roll.inspector_2 ? ` & ${roll.inspector_2}` : ''}
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
                                        backgroundColor: '#fee2e2', color: '#b91c1c',
                                        padding: '2px 8px', borderRadius: '4px',
                                        fontSize: '0.7rem', fontWeight: '800'
                                      }}>
                                        ❌ Pending
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                        )
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
  );
}

function TabDyeing({ order, yarnCounts, onViewDOF, onViewGYDR, onViewDYRR }) {
  const [dofs, setDofs] = useState([]);
  const [gydrs, setGydrs] = useState([]);
  const [dyrrs, setDyrrs] = useState([]);
  const [deliveryItems, setDeliveryItems] = useState([]);
  const [receiptItems, setReceiptItems] = useState([]);
  const [redyeingItems, setRedyeingItems] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRowExpand = (key) => {
    const next = new Set(expandedRows);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedRows(next);
  };

  const getFlowDataFor = (row) => {
    // 1. DOFs
    const relatedDofs = dofs.filter(d => 
      (d.yarn_allocations || []).some(alloc => 
        alloc.orderId === order.id && 
        alloc.countId === row.countId && 
        alloc.colour === row.colour && 
        alloc.type === row.type
      )
    );
    
    const dofFlow = relatedDofs.map(d => {
      const alloc = (d.yarn_allocations || []).find(a => 
        a.orderId === order.id && 
        a.countId === row.countId && 
        a.colour === row.colour && 
        a.type === row.type
      );
      return {
        date: d.created_at || '',
        formattedDate: d.created_at ? new Date(d.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
        typeName: 'DOF (Order)',
        typeColor: { bg: '#e0f2fe', text: '#0369a1' },
        number: d.dof_number,
        unit: d.dyeing_unit?.partner_name || '—',
        lotNumber: '—',
        quantity: parseFloat(alloc?.total_kg || 0),
        details: `Status: ${d.status.toUpperCase()}${d.expected_delivery_date ? ` | Exp Delivery: ${d.expected_delivery_date}` : ''}`,
        onView: () => onViewDOF(d.id)
      };
    });

    // 2. GYDRs
    const relatedGydrs = deliveryItems.filter(item => 
      item.yarn_count_id === row.countId && 
      item.colour === row.colour && 
      (item.yarn_type || 'warp') === row.type
    );
    
    const gydrFlow = relatedGydrs.map(item => {
      const receipt = item.receipt;
      return {
        date: receipt?.created_at || '',
        formattedDate: receipt?.created_at ? new Date(receipt.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
        typeName: 'GYDR (Greige Sent)',
        typeColor: { bg: '#e0e7ff', text: '#4338ca' },
        number: receipt?.gydr_number || '—',
        unit: receipt?.dof?.dyeing_unit?.partner_name || '—',
        lotNumber: '—',
        quantity: parseFloat(item.quantity_kg || 0),
        details: `Delivered By: ${receipt?.delivered_by || '—'}${receipt?.vehicle_no ? ` | Vehicle: ${receipt.vehicle_no}` : ''}${receipt?.challan_no ? ` | Challan: ${receipt.challan_no}` : ''}`,
        onView: receipt?.id ? () => onViewGYDR(receipt.id) : null
      };
    });

    // 3. DYRRs
    const relatedDyrrs = receiptItems.filter(item => 
      item.yarn_count_id === row.countId && 
      item.colour === row.colour && 
      (item.yarn_type || 'warp') === row.type
    );
    
    const dyrrFlow = relatedDyrrs.map(item => {
      const receipt = item.receipt;
      const partnerName = receipt?.source_type === 'production' ? 'In-House' : (receipt?.dyeing_unit?.partner_name || 'In-House');
      return {
        date: receipt?.received_date || receipt?.created_at || '',
        formattedDate: (receipt?.received_date || receipt?.created_at) ? new Date(receipt.received_date || receipt.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
        typeName: 'DYRR (Received)',
        typeColor: { bg: '#dcfce7', text: '#15803d' },
        number: receipt?.dyrr_number || '—',
        unit: partnerName,
        lotNumber: item.lot_number || '—',
        quantity: parseFloat(item.quantity_kg || 0),
        details: `Gate Pass: ${receipt?.gate_pass_no || '—'}${receipt?.vehicle_no ? ` | Vehicle: ${receipt.vehicle_no}` : ''}${receipt?.remarks ? ` | Notes: ${receipt.remarks}` : ''}`,
        onView: receipt?.id ? () => onViewDYRR(receipt.id) : null
      };
    });

    // 4. DYDRs (Redyeing Sent)
    const relatedRedyeings = redyeingItems.filter(item => 
      item.yarn_count_id === row.countId && 
      item.colour === row.colour && 
      (item.yarn_type || 'warp') === row.type
    );
    
    const dydrFlow = relatedRedyeings.map(item => {
      const delivery = item.delivery;
      return {
        date: delivery?.delivered_date || delivery?.created_at || '',
        formattedDate: (delivery?.delivered_date || delivery?.created_at) ? new Date(delivery.delivered_date || delivery.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
        typeName: 'DYDR (Redyeing Sent)',
        typeColor: { bg: '#fee2e2', text: '#b91c1c' },
        number: delivery?.dydr_number || '—',
        unit: delivery?.dyeing_unit?.partner_name || 'In-House',
        lotNumber: item.lot_number || '—',
        quantity: parseFloat(item.quantity_kg || 0),
        details: `Delivered By: ${delivery?.delivered_by || '—'}${delivery?.vehicle_no ? ` | Vehicle: ${delivery.vehicle_no}` : ''}${delivery?.dof_number ? ` | Target DOF: ${delivery.dof_number}` : ''}`,
        onView: null
      };
    });

    const allFlow = [...dofFlow, ...gydrFlow, ...dyrrFlow, ...dydrFlow];
    
    const docPriority = {
      'DOF (Order)': 1,
      'GYDR (Greige Sent)': 2,
      'DYRR (Received)': 3,
      'DYDR (Redyeing Sent)': 4
    };

    return allFlow.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      
      return (docPriority[a.typeName] || 99) - (docPriority[b.typeName] || 99);
    });
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // 1. Fetch DOFs related to this order
        const { data: dofData } = await supabase
          .from('dyeing_order_forms')
          .select('*, dyeing_unit:master_partners(partner_name)')
          .contains('order_ids', [order.id]);
        
        setDofs(dofData || []);
        const dofIds = (dofData || []).map(d => d.id);

        // 2. Fetch GYDI (Greige Delivery Items)
        // Fetch by order_id OR by linked dof_ids

        // Revised approach: Fetch all receipts for these DOFs
        const { data: relatedReceipts } = await supabase
          .from('greige_yarn_delivery_receipts')
          .select('id')
          .in('dof_id', dofIds);
        
        const receiptIds = relatedReceipts?.map(r => r.id) || [];

        const { data: gydiData } = await supabase
          .from('greige_yarn_delivery_items')
          .select('*, receipt:greige_yarn_delivery_receipts(*, dof:dyeing_order_forms(*, dyeing_unit:master_partners(partner_name)))')
          .or(`order_id.eq.${order.id}${receiptIds.length > 0 ? `,receipt_id.in.(${receiptIds.join(',')})` : ''}`);
        
        // 2b. Post-filter gydiData to ensure we only keep items for THIS order
        // This handles cases where a DOF has 2 orders but only one has deliveries.
        // We keep items if:
        // a) order_id matches strictly
        // b) order_id is null but count+colour exists in this order's DOF allocations
        const allocations = (dofData || []).flatMap(d => (d.yarn_allocations || []).filter(a => a.orderId === order.id));
        const filteredGydi = (gydiData || []).filter(item => {
          if (item.order_id === order.id) return true;
          if (!item.order_id) {
             // Legacy fallback: check if this count/colour is required by this order in this DOF
             return allocations.some(a => a.countId === item.yarn_count_id && a.colour === item.colour);
          }
          return false;
        });

        setDeliveryItems(filteredGydi);
        
        // Group receipts for the list - ONLY those from the filtered items
        const uniqueGydrIds = Array.from(new Set(filteredGydi.map(i => i.receipt?.id))).filter(Boolean);
        const uniqueGydr = uniqueGydrIds.map(id => filteredGydi.find(i => i.receipt?.id === id).receipt);
        setGydrs(uniqueGydr);

        // 3. Fetch DYRI (Dyed Yarn Receipt Items)
        const { data: dyriData } = await supabase
          .from('dyed_yarn_receipt_items')
          .select('*, receipt:dyed_yarn_receipts(*, dyeing_unit:master_partners(partner_name))')
          .eq('order_id', order.id);
        
        // Exclude production returns (excess returned from production)
        const filteredDyri = (dyriData || []).filter(item => 
          !item.is_excess && item.receipt?.source_type !== 'production'
        );
        
        setReceiptItems(filteredDyri);
        const uniqueDyrr = Array.from(new Set(filteredDyri.map(i => i.receipt?.id))).map(id => filteredDyri.find(i => i.receipt?.id === id).receipt);
        setDyrrs(uniqueDyrr.filter(Boolean));

        // 3b. Fetch redyeing deliveries to subtract from received
        const { data: redyeingData } = await supabase
          .from('dyed_yarn_delivery_items')
          .select('*, delivery:dyed_yarn_deliveries(*)')
          .eq('order_id', order.id)
          .eq('process_type', 'redyeing');
        setRedyeingItems(redyeingData || []);

        // 4. Fetch returns for this order
        const { data: returnData } = await supabase
          .from('greige_yarn_receipts')
          .select('*')
          .eq('receipt_type', 'production')
          .eq('order_id', order.id);
        
        setReturns(returnData || []);
        
      } catch (err) {
        console.error('Error fetching dyeing details:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [order.id]);

  // Calculate Summary Table
  const summaryData = React.useMemo(() => {
    const allocations = (dofs || []).flatMap(d => (d.yarn_allocations || []).filter(a => a.orderId === order.id));
    
    const summary = {};

    // 1. Initialize summary with all yarn requirements entered during order creation
    (order.yarn_requirements || []).forEach(yr => {
      const key = `${yr.countId}-${yr.color}-${yr.type}`;
      summary[key] = { 
        countId: yr.countId, 
        colour: yr.color, 
        type: yr.type, 
        netRequired: parseFloat(yr.kg || 0), 
        dyeingReq: 0, 
        sent: 0, 
        received: 0,
        dyeingUnit: '-',
        expectedDate: '-'
      };
    });

    // 2. Process allocations from DOFs
    allocations.forEach(a => {
      const key = `${a.countId}-${a.colour}-${a.type}`;
      // Find the parent DOF to get unit/date
      const parentDof = dofs.find(d => (d.yarn_allocations || []).some(alloc => 
        alloc.orderId === a.orderId && 
        alloc.type === a.type && 
        alloc.countId === a.countId && 
        alloc.colour === a.colour
      ));
      
      if (!summary[key]) {
        // Fallback for allocations not present in yarn_requirements
        summary[key] = { 
          countId: a.countId, 
          colour: a.colour, 
          type: a.type, 
          netRequired: 0, 
          dyeingReq: 0, 
          sent: 0, 
          received: 0,
          dyeingUnit: parentDof?.dyeing_unit?.partner_name || '-',
          expectedDate: parentDof?.expected_delivery_date || '-'
        };
      } else {
        if (parentDof && parentDof.dyeing_unit?.partner_name) {
          if (summary[key].dyeingUnit === '-') {
            summary[key].dyeingUnit = parentDof.dyeing_unit.partner_name;
          } else if (!summary[key].dyeingUnit.includes(parentDof.dyeing_unit.partner_name)) {
            summary[key].dyeingUnit += `, ${parentDof.dyeing_unit.partner_name}`;
          }
        }
        if (parentDof && parentDof.expected_delivery_date) {
          if (summary[key].expectedDate === '-') {
            summary[key].expectedDate = parentDof.expected_delivery_date;
          } else if (!summary[key].expectedDate.includes(parentDof.expected_delivery_date)) {
            summary[key].expectedDate += `, ${parentDof.expected_delivery_date}`;
          }
        }
      }

      // If this was a fallback key (not in original yarn_requirements), accumulate the base_kg to netRequired.
      const hasRequirement = (order.yarn_requirements || []).some(yr => `${yr.countId}-${yr.color}-${yr.type}` === key);
      if (!hasRequirement) {
        summary[key].netRequired += parseFloat(a.base_kg || a.total_kg || 0);
      }
      
      summary[key].dyeingReq += parseFloat(a.total_kg || 0);
    });

    deliveryItems.forEach(item => {
      const key = `${item.yarn_count_id}-${item.colour}-${item.yarn_type || 'warp'}`;
      if (summary[key]) {
        summary[key].sent += parseFloat(item.quantity_kg || 0);
      }
    });

    // Deduct returns from sent quantities
    (returns || []).forEach(ret => {
      const key = `${ret.yarn_count_id}-${ret.colour}-${ret.yarn_type || 'warp'}`;
      if (summary[key]) {
        summary[key].sent = Math.max(0, summary[key].sent - parseFloat(ret.total_weight || 0));
      }
    });
    
    receiptItems.forEach(item => {
      const key = `${item.yarn_count_id}-${item.colour}-${item.yarn_type || 'warp'}`;
      if (summary[key]) {
        summary[key].received += parseFloat(item.quantity_kg || 0);
      }
    });

    (redyeingItems || []).forEach(item => {
      const key = `${item.yarn_count_id}-${item.colour}-${item.yarn_type || 'warp'}`;
      if (summary[key]) {
        summary[key].received = Math.max(0, summary[key].received - parseFloat(item.quantity_kg || 0));
      }
    });
    
    // Convert to array and sort: Warp first, then Weft
    return Object.values(summary).sort((a, b) => {
      if (a.type === 'warp' && b.type !== 'warp') return -1;
      if (a.type !== 'warp' && b.type === 'warp') return 1;
      return 0;
    });
  }, [dofs, deliveryItems, receiptItems, redyeingItems, returns, order.yarn_requirements, order.id]);

  // Group returns by receipt_no
  const uniqueReturns = React.useMemo(() => {
    const unique = [];
    const seen = new Set();
    (returns || []).forEach(r => {
      if (!seen.has(r.receipt_no)) {
        seen.add(r.receipt_no);
        unique.push(r);
      }
    });
    return unique;
  }, [returns]);

  const formatYarnDisplay = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    if (!y) return 'Unknown';
    return `${y.count_value}-${y.material}-${y.product_type}`;
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted-current)' }}><Loader size={16} className="spin" /> Loading records...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* ── Summary Table ── */}
      <div>
        <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
          <Calculator size={16} color="var(--color-primary)" />
          Yarn Processing Summary (Warp & Weft)
        </h4>
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #eee' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', textAlign: 'left', borderBottom: '1px solid #eee' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Yarn Details</th>
                <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Colour</th>
                <th style={{ padding: '0.75rem 1rem' }}>Dyeing Unit</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Net Req (kg)</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Dyeing At (kg)</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Sent (kg)</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Rec (kg)</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Bal (kg)</th>
              </tr>
            </thead>
            <tbody>
              {summaryData.length === 0 ? (
                <tr><td colSpan="9" style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>No dyeing allocations found for this order.</td></tr>
              ) : summaryData.map((row, idx) => {
                const balance = row.sent - row.received;
                // Check if we need a section header
                const showWarpHeader = idx === 0 && row.type === 'warp';
                const showWeftHeader = row.type === 'weft' && (idx === 0 || summaryData[idx-1].type !== 'weft');
                const rowKey = `${row.countId}-${row.colour}-${row.type}`;
                const isExpanded = expandedRows.has(rowKey);

                return (
                  <React.Fragment key={idx}>
                    {(showWarpHeader || showWeftHeader) && (
                      <tr style={{ backgroundColor: '#f3f4f6' }}>
                        <td colSpan="9" style={{ padding: '0.25rem 1rem', fontWeight: '800', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {row.type} Details
                        </td>
                      </tr>
                    )}
                    <tr 
                      onClick={() => toggleRowExpand(rowKey)}
                      style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', backgroundColor: isExpanded ? '#f8fafc' : '#fff' }}
                      className="hover-lift"
                    >
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {formatYarnDisplay(row.countId)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textTransform: 'capitalize' }}>{row.type}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{row.colour}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#444' }}>{row.dyeingUnit}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>{row.netRequired.toFixed(1)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#666', fontSize: '0.8rem' }}>{row.dyeingReq.toFixed(1)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#6366f1' }}>{row.sent.toFixed(1)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>{row.received.toFixed(1)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold', color: balance > 0 ? '#ef4444' : '#10b981' }}>{balance.toFixed(1)}</td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: '#fafafa' }}>
                        <td colSpan="9" style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid var(--color-primary)' }}>
                          <div style={{ padding: '0.5rem 0' }}>
                            <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', color: '#475569' }}>
                              Dyeing Processing Flow & Documents ({row.colour})
                            </h5>
                            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', backgroundColor: '#fff' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                    <th style={{ padding: '0.5rem 0.75rem', color: '#475569', fontWeight: '700' }}>Date</th>
                                    <th style={{ padding: '0.5rem 0.75rem', color: '#475569', fontWeight: '700' }}>Doc Type</th>
                                    <th style={{ padding: '0.5rem 0.75rem', color: '#475569', fontWeight: '700' }}>Doc Number</th>
                                    <th style={{ padding: '0.5rem 0.75rem', color: '#475569', fontWeight: '700' }}>Dyeing Partner</th>
                                    <th style={{ padding: '0.5rem 0.75rem', color: '#475569', fontWeight: '700' }}>Lot Number</th>
                                    <th style={{ padding: '0.5rem 0.75rem', color: '#475569', fontWeight: '700', textAlign: 'right' }}>Qty (kg)</th>
                                    <th style={{ padding: '0.5rem 0.75rem', color: '#475569', fontWeight: '700' }}>Details</th>
                                    <th style={{ padding: '0.5rem 0.75rem', color: '#475569', fontWeight: '700', textAlign: 'center' }}>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const flowData = getFlowDataFor(row);
                                    if (flowData.length === 0) {
                                      return (
                                        <tr>
                                          <td colSpan="8" style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                            No document history found for this yarn selection.
                                          </td>
                                        </tr>
                                      );
                                    }
                                    return flowData.map((item, fIdx) => (
                                      <tr key={fIdx} style={{ borderBottom: fIdx < flowData.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                        <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>{item.formattedDate}</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                          <span style={{
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            fontWeight: '700',
                                            backgroundColor: item.typeColor.bg,
                                            color: item.typeColor.text
                                          }}>{item.typeName}</span>
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>{item.number}</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>{item.unit}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>{item.lotNumber}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{item.quantity.toFixed(1)}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', color: '#64748b', fontSize: '0.75rem' }}>{item.details}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                          {item.onView ? (
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                item.onView();
                                              }}
                                              style={{
                                                padding: '2px 6px',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '4px',
                                                backgroundColor: '#fff',
                                                cursor: 'pointer',
                                                fontSize: '0.7rem',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.25rem',
                                                color: 'var(--color-primary)'
                                              }}
                                            >
                                              View <ExternalLink size={10} />
                                            </button>
                                          ) : '—'}
                                        </td>
                                      </tr>
                                    ));
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

      <div className="grid-4-to-1">
        {/* DOFs List */}
        <section>
          <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Dyeing Order Forms</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {dofs.map(d => {
              const alertInfo = getDofAlertInfo(d, dyrrs);
              const cardBg = alertInfo ? alertInfo.bgColor : '#fff';
              const cardBorder = alertInfo ? `1px solid ${alertInfo.borderColor}` : '1px solid #eee';
              const badgeBg = alertInfo ? alertInfo.bgColor : '#f1f5f9';

              return (
                <div key={d.id} style={{ 
                  padding: '0.75rem', 
                  backgroundColor: cardBg, 
                  border: cardBorder, 
                  borderRadius: '8px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {d.dof_number}
                      {alertInfo && (
                        <span style={{
                          backgroundColor: badgeBg,
                          color: alertInfo.color,
                          border: `1px solid ${alertInfo.borderColor}`,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '0.6rem',
                          fontWeight: '800'
                        }}>
                          {alertInfo.label}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>{d.dyeing_unit?.partner_name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>
                      Expected: <strong>{d.expected_delivery_date || 'N/A'}</strong>
                    </div>
                  </div>
                  <button 
                    onClick={() => onViewDOF(d.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              );
            })}
            {dofs.length === 0 && <p style={{ fontSize: '0.8rem', color: '#999' }}>No forms found.</p>}
          </div>
        </section>

        {/* GYDR List */}
        <section>
          <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Greige Delivery Receipts</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {gydrs.map(r => (
              <div key={r.id} style={{ padding: '0.75rem 1rem', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--color-primary)' }}>{r.gydr_number}</div>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>
                      Date: {new Date(r.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '1.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151' }}>
                      Unit: {r.dof?.dyeing_unit?.partner_name || 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>
                      Order Form: {r.dof_number || r.dof?.dof_number || 'N/A'}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => onViewGYDR(r.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="View GYDR Details"
                >
                  <ExternalLink size={14} />
                </button>
              </div>
            ))}
            {gydrs.length === 0 && <p style={{ fontSize: '0.8rem', color: '#999' }}>No deliveries found.</p>}
          </div>
        </section>

        {/* DYRR List */}
        <section>
          <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Dyed Received Receipts</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {dyrrs.map(r => {
              const isProd = r.source_type === 'production';
              const partnerName = isProd ? 'In-House' : (r.dyeing_unit?.partner_name || 'In-House');
              const dofNo = r.dof_number || 'N/A';
              return (
                <div key={r.id} style={{ padding: '0.75rem 1rem', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '750', fontSize: '0.8rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {r.dyrr_number}
                        <span style={{ padding: '1px 5px', borderRadius: '4px', fontSize: '0.55rem', fontWeight: '800', textTransform: 'uppercase', backgroundColor: isProd ? '#fef3c7' : '#dcfce7', color: isProd ? '#b45309' : '#15803d', border: isProd ? '1px solid #fcd34d' : '1px solid #bbf7d0' }}>
                          {isProd ? 'Return' : 'Partner'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>
                        Date: {new Date(r.received_date || r.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '1.5rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151' }}>
                        Unit: {partnerName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>
                        Order Form: {dofNo}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => onViewDYRR(r.id)}
                    style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              );
            })}
            {dyrrs.length === 0 && <p style={{ fontSize: '0.8rem', color: '#999' }}>No receipts found.</p>}
          </div>
        </section>

        {/* GYPRR List */}
        <section>
          <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Greige Return from Dyeing</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {uniqueReturns.map(r => (
              <div key={r.id} style={{ padding: '0.75rem', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.8rem' }}>{r.receipt_no}</div>
                  <div style={{ fontSize: '0.7rem', color: '#666' }}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#b45309' }}>
                  {r.total_weight ? `${Number(r.total_weight).toFixed(1)} kg` : '-'}
                </div>
              </div>
            ))}
            {uniqueReturns.length === 0 && <p style={{ fontSize: '0.8rem', color: '#999' }}>No returns found.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function TabProcessing({ order, orderPofs, onViewPOF, onViewPOFRR }) {
  const [expandedPofId, setExpandedPofId] = useState(null);
  const [expandedPofrrNo, setExpandedPofrrNo] = useState(null);

  // Helper to format processes into a key, e.g., 'overdye' or 'desize + zero-zero'
  const getPofProcessesKey = (pof) => {
    if (!pof.processes || pof.processes.length === 0) return 'Unspecified';
    return pof.processes.map(p => p.trim()).filter(Boolean).join(' + ');
  };

  // Group POFs by processes
  const groupedPofs = useMemo(() => {
    const groups = {};
    (orderPofs || []).forEach(pof => {
      const key = getPofProcessesKey(pof);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(pof);
    });
    return groups;
  }, [orderPofs]);

  const processKeys = useMemo(() => Object.keys(groupedPofs).sort(), [groupedPofs]);
  const [activeProcessTab, setActiveProcessTab] = useState(null);

  // Default to the first key or reset if active key is no longer available
  useEffect(() => {
    if (processKeys.length > 0) {
      if (!activeProcessTab || !processKeys.includes(activeProcessTab)) {
        setActiveProcessTab(processKeys[0]);
      }
    } else {
      setActiveProcessTab(null);
    }
  }, [processKeys, activeProcessTab]);

  const handleTabClick = (key) => {
    setActiveProcessTab(key);
    setExpandedPofId(null);
    setExpandedPofrrNo(null);
  };

  // Get active POFs
  const activePofs = activeProcessTab ? (groupedPofs[activeProcessTab] || []) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Dynamic Process Sub-Tabs UI */}
      {processKeys.length > 0 && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-current)', gap: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {processKeys.map(key => {
            const isActive = activeProcessTab === key;
            const count = groupedPofs[key].length;
            return (
              <button
                key={key}
                onClick={() => handleTabClick(key)}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '800',
                  color: isActive ? '#800000' : 'var(--text-muted-current)',
                  borderBottom: isActive ? '2.5px solid #800000' : '2.5px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  paddingBottom: '0.75rem'
                }}
              >
                <span style={{ textTransform: 'capitalize' }}>{key}</span>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: isActive ? '#800000' : '#f3f4f6',
                  color: isActive ? '#fff' : 'var(--text-muted-current)',
                  fontWeight: '800',
                  transition: 'all 0.15s ease'
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Summary Metrics ── */}
      {(() => {
        let totalSentQty = 0;
        let totalReceivedQty = 0;
        let totalSentRolls = 0;
        let totalReceivedRolls = 0;

        activePofs.forEach(pof => {
          const rolls = pof.fabric_rolls || [];
          totalSentRolls += rolls.length;
          totalSentQty += rolls.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0);

          const rxRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
          totalReceivedRolls += rxRolls.length;
          totalReceivedQty += rxRolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
        });

        const overallShrinkage = totalSentQty > 0 ? ((totalSentQty - totalReceivedQty) / totalSentQty) * 100 : 0;

        return (
          <div className="stats-grid-5">
            <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Total Rolls Sent</span>
              <span style={{ fontSize: '1.5rem', fontWeight: '850', color: 'var(--text-current)' }}>
                {totalSentRolls} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>Rolls</span>
              </span>
            </div>

            <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Total Rolls Received</span>
              <span style={{ fontSize: '1.5rem', fontWeight: '850', color: '#047857' }}>
                {totalReceivedRolls} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>Rolls</span>
              </span>
            </div>

            <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Total Qty Sent</span>
              <span style={{ fontSize: '1.5rem', fontWeight: '850', color: 'var(--text-current)' }}>
                {totalSentQty.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>Mtrs</span>
              </span>
            </div>

            <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Total Qty Received</span>
              <span style={{ fontSize: '1.5rem', fontWeight: '850', color: '#047857' }}>
                {totalReceivedQty.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>Mtrs</span>
              </span>
            </div>

            <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Overall Shrinkage</span>
              <span style={{ fontSize: '1.5rem', fontWeight: '850', color: overallShrinkage > 0 ? '#b45309' : '#047857' }}>
                {totalSentQty > 0 ? `${overallShrinkage.toFixed(2)}%` : '—'}
              </span>
            </div>
          </div>
        );
      })()}

      {/* ── Details Table ── */}
      <div>
        <h4 style={{ margin: '0 0 1rem 0', fontWeight: '800', fontSize: '0.95rem', color: '#800000', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Truck size={18} /> Processing Order Forms (POF) & Received Status
        </h4>

        {(orderPofs || []).length === 0 ? (
          <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', fontStyle: 'italic', padding: '1rem' }}>No Processing Order Forms found for this order.</p>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '2px solid var(--border-current)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)' }}>POF Details</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)' }}>Partner Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Rolls Sent</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Rolls Recd</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Sent</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Qty Recd</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Shrinkage %</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activePofs.map(pof => {
                  const isExpanded = expandedPofId === pof.id;
                  const rolls = pof.fabric_rolls || [];
                  const rollsCount = rolls.length;
                  const qtySent = rolls.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0);
                  
                  const receivedRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
                  const rollsReceivedCount = receivedRolls.length;
                  const qtyReceived = receivedRolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
                  const shrinkagePct = qtySent > 0 ? ((qtySent - qtyReceived) / qtySent) * 100 : 0;

                  const createdDate = new Date(pof.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric'
                  });

                  return (
                    <React.Fragment key={pof.id}>
                      <tr 
                        onClick={() => setExpandedPofId(isExpanded ? null : pof.id)}
                        style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-current)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span style={{ fontWeight: '800', color: '#800000', fontFamily: 'monospace' }}>{pof.pof_number}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontWeight: 'normal' }}>({createdDate})</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>{pof.partner_name}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600' }}>{rollsCount}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: '#047857' }}>
                          {pof.status !== 'sent_to_processing' ? rollsReceivedCount : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700' }}>{qtySent.toFixed(1)} m</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: '#047857' }}>
                          {pof.status !== 'sent_to_processing' ? `${qtyReceived.toFixed(1)} m` : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '750', color: shrinkagePct > 0 ? '#b45309' : '#047857' }}>
                          {pof.status !== 'sent_to_processing' ? `${shrinkagePct.toFixed(2)}%` : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span 
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              border: '1px solid',
                              backgroundColor: pof.status === 'received' ? '#ecfdf5' : pof.status === 'partially_received' ? '#eff6ff' : '#fffbeb',
                              borderColor: pof.status === 'received' ? '#a7f3d0' : pof.status === 'partially_received' ? '#bfdbfe' : '#fde68a',
                              color: pof.status === 'received' ? '#065f46' : pof.status === 'partially_received' ? '#1e40af' : '#92400e'
                            }}
                          >
                            {pof.status === 'received' ? 'Received' : pof.status === 'partially_received' ? 'Partially Received' : 'Sent'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => onViewPOF(pof)}
                              className="btn btn-secondary"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '4px 8px', fontSize: '0.7rem', border: '1px solid var(--border-current)', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff' }}
                              title="Print POF"
                            >
                              <Printer size={12} /> Print POF
                            </button>
                            {pof.status !== 'sent_to_processing' && (
                              <button
                                onClick={() => {
                                  const receiptsMap = {};
                                  const rxRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
                                  rxRolls.forEach(roll => {
                                    const pofrrNo = roll.pofrr_number || pof.pofrr_number || 'N/A';
                                    if (!receiptsMap[pofrrNo]) {
                                      receiptsMap[pofrrNo] = {
                                        pofrr_number: pofrrNo,
                                        received_at: roll.received_at || pof.received_at || pof.updated_at,
                                        received_by: roll.received_by || pof.received_by || 'N/A',
                                        received_place: roll.received_place || pof.received_place || 'N/A',
                                        receive_vehicle_details: roll.receive_vehicle_details || pof.receive_vehicle_details || 'N/A',
                                        rolls: []
                                      };
                                    }
                                    receiptsMap[pofrrNo].rolls.push(roll);
                                  });

                                  const receipts = Object.values(receiptsMap);
                                  if (receipts.length > 1) {
                                    setExpandedPofId(pof.id);
                                    alert(`Multiple POFRR receipts found for POF ${pof.pof_number}. Please choose which POFRR to view or print from the 'Associated POFRR Documents' list in the expanded row below.`);
                                  } else if (receipts.length === 1) {
                                    const receipt = receipts[0];
                                    const pofrrDoc = {
                                      pofrr_number: receipt.pofrr_number,
                                      pof_number: pof.pof_number,
                                      partner_name: pof.partner_name,
                                      created_at: pof.created_at,
                                      received_at: receipt.received_at,
                                      expected_delivery_date: pof.expected_delivery_date,
                                      vehicle_details: pof.vehicle_details,
                                      delivered_by: pof.delivered_by,
                                      received_by: receipt.received_by,
                                      received_place: receipt.received_place,
                                      receive_vehicle_details: receipt.receive_vehicle_details,
                                      fabric_rolls: pof.fabric_rolls || [],
                                      received_rolls: receipt.rolls,
                                      all_received_rolls: pof.received_rolls || [],
                                      processes: pof.processes || [],
                                      status: pof.status
                                    };
                                    onViewPOFRR(pofrrDoc);
                                  } else {
                                    alert("No rolls have been received yet for this POF.");
                                  }
                                }}
                                className="btn btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '4px 8px', fontSize: '0.7rem', border: '1px solid var(--border-current)', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff' }}
                                title="Print POFRR"
                              >
                                <FileText size={12} /> Print POFRR
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan="9" style={{ backgroundColor: 'white', padding: '1.5rem', borderBottom: '1px solid var(--border-current)' }}>
                            <div className="grid-2-to-1" style={{ alignItems: 'start' }}>
                              
                              <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', padding: '1rem', backgroundColor: '#fcfcfc' }}>
                                <h5 style={{ margin: '0 0 0.75rem 0', fontWeight: '800', color: '#800000', fontSize: '0.8rem', borderBottom: '1px solid #eee', paddingBottom: '0.3rem' }}>
                                  📤 Dispatched Rolls & Processes
                                </h5>
                                <div className="grid-label-value" style={{ fontSize: '0.78rem', marginBottom: '1rem', borderBottom: '1px dashed #eee', paddingBottom: '0.5rem' }}>
                                  <span style={{ color: 'var(--text-muted-current)' }}>Processes Selected:</span>
                                  <strong style={{ color: 'var(--text-current)' }}>{pof.processes?.join(', ') || '—'}</strong>
                                  <span style={{ color: 'var(--text-muted-current)' }}>Vehicle Details:</span>
                                  <strong>{pof.vehicle_details || '—'}</strong>
                                  <span style={{ color: 'var(--text-muted-current)' }}>Delivered By:</span>
                                  <strong>{pof.delivered_by || '—'}</strong>
                                  <span style={{ color: 'var(--text-muted-current)' }}>Expected Return:</span>
                                  <strong style={{ color: '#b45309' }}>{pof.expected_delivery_date || '—'}</strong>
                                </div>
                                
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1.5px solid #ddd', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted-current)' }}>
                                      <th style={{ padding: '0.4rem 0.25rem' }}>Greige Roll ID</th>
                                      <th style={{ padding: '0.4rem 0.25rem', textAlign: 'right' }}>Greige Qty</th>
                                      <th style={{ padding: '0.4rem 0.25rem', textAlign: 'right' }}>Qty Sent</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rolls.map(roll => (
                                      <tr key={roll.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '0.4rem 0.25rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{roll.id}</td>
                                        <td style={{ padding: '0.4rem 0.25rem', textAlign: 'right' }}>{Number(roll.qty).toFixed(2)} m</td>
                                        <td style={{ padding: '0.4rem 0.25rem', textAlign: 'right', fontWeight: '600' }}>{Number(roll.actual_qty || roll.qty).toFixed(2)} m</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', padding: '1rem', backgroundColor: '#fcfcfc' }}>
                                  <h5 style={{ margin: '0 0 0.75rem 0', fontWeight: '800', color: '#047857', fontSize: '0.8rem', borderBottom: '1px solid #eee', paddingBottom: '0.3rem' }}>
                                    📥 Received Rolls & Details
                                  </h5>
                                  {pof.status !== 'sent_to_processing' && (
                                    <div className="grid-label-value" style={{ fontSize: '0.78rem', marginBottom: '1rem', borderBottom: '1px dashed #eee', paddingBottom: '0.5rem' }}>
                                      <span style={{ color: 'var(--text-muted-current)' }}>POFRR Receipt No:</span>
                                      <strong style={{ color: '#047857', fontFamily: 'monospace' }}>{pof.pofrr_number || '—'}</strong>
                                      <span style={{ color: 'var(--text-muted-current)' }}>Received Date:</span>
                                      <strong>{pof.received_at ? new Date(pof.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</strong>
                                      <span style={{ color: 'var(--text-muted-current)' }}>Received By:</span>
                                      <strong>{pof.received_by || '—'}</strong>
                                      <span style={{ color: 'var(--text-muted-current)' }}>Return Place:</span>
                                      <strong>{pof.received_place || '—'}</strong>
                                      <span style={{ color: 'var(--text-muted-current)' }}>Return Vehicle:</span>
                                      <strong>{pof.receive_vehicle_details || '—'}</strong>
                                    </div>
                                  )}

                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead>
                                      <tr style={{ borderBottom: '1.5px solid #ddd', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted-current)' }}>
                                        <th style={{ padding: '0.4rem 0.25rem' }}>Processed Roll ID</th>
                                        <th style={{ padding: '0.4rem 0.25rem', textAlign: 'right' }}>Qty Received</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rolls.map(roll => {
                                        const rxRolls = receivedRolls.filter(rx => isGreigeRollMatch(rx.greige_roll_id, roll.id));
                                        if (rxRolls.length === 0) {
                                          return (
                                            <tr key={roll.id} style={{ borderBottom: '1px solid #eee' }}>
                                              <td style={{ padding: '0.4rem 0.25rem', color: '#9ca3af', fontFamily: 'monospace' }}>{roll.id} (Pending)</td>
                                              <td style={{ padding: '0.4rem 0.25rem', textAlign: 'right', color: '#9ca3af' }}>—</td>
                                            </tr>
                                          );
                                        }

                                        return rxRolls.map((rxRoll, idx) => {
                                          const recdQty = parseFloat(rxRoll.qty || 0);
                                          
                                          return (
                                            <tr key={`${roll.id}-${idx}`} style={{ borderBottom: '1px solid #eee' }}>
                                              <td style={{ padding: '0.4rem 0.25rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#047857' }}>{rxRoll.id}</td>
                                              <td style={{ padding: '0.4rem 0.25rem', textAlign: 'right', fontWeight: '600', color: '#047857' }}>{recdQty.toFixed(2)} m</td>
                                            </tr>
                                          );
                                        });
                                      })}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Associated POFRR Documents Accordion List */}
                                {(pof.status === 'received' || pof.status === 'partially_received') && (
                                  <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-current)', boxShadow: 'var(--shadow-sm)' }}>
                                    <h5 style={{ margin: '0 0 1rem 0', color: '#047857', fontSize: '0.85rem', fontWeight: '800', borderBottom: '1px solid #eee', paddingBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                      📄 Associated POFRR Documents
                                    </h5>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                      {(() => {
                                        // Group rolls by pofrr_number
                                        const receiptsMap = {};
                                        receivedRolls.forEach(roll => {
                                          const pofrrNo = roll.pofrr_number || pof.pofrr_number || 'N/A';
                                          if (!receiptsMap[pofrrNo]) {
                                            receiptsMap[pofrrNo] = {
                                              pofrr_number: pofrrNo,
                                              received_at: roll.received_at || pof.received_at || pof.updated_at,
                                              received_by: roll.received_by || pof.received_by || 'N/A',
                                              received_place: roll.received_place || pof.received_place || 'N/A',
                                              receive_vehicle_details: roll.receive_vehicle_details || pof.receive_vehicle_details || 'N/A',
                                              rolls: []
                                            };
                                          }
                                          receiptsMap[pofrrNo].rolls.push(roll);
                                        });

                                        const receipts = Object.values(receiptsMap);
                                        if (receipts.length === 0) {
                                          return (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                                              No POFRR documents found.
                                            </div>
                                          );
                                        }

                                        return receipts.map((receipt, idx) => {
                                          const isPofrrExpanded = expandedPofrrNo === receipt.pofrr_number;
                                          const totalReceiptQty = receipt.rolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
                                          return (
                                            <div 
                                              key={receipt.pofrr_number} 
                                              style={{ 
                                                display: 'flex', 
                                                flexDirection: 'column',
                                                backgroundColor: '#f9f9f9', 
                                                borderRadius: '8px', 
                                                border: '1px solid #eee',
                                                fontSize: '0.8rem',
                                                overflow: 'hidden'
                                              }}
                                            >
                                              <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '0.65rem 0.75rem',
                                                cursor: 'pointer',
                                                backgroundColor: isPofrrExpanded ? '#f1f5f9' : 'transparent',
                                                borderBottom: isPofrrExpanded ? '1px solid #e2e8f0' : 'none',
                                                transition: 'background-color 0.15s ease'
                                              }} onClick={() => setExpandedPofrrNo(isPofrrExpanded ? null : receipt.pofrr_number)}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', display: 'inline-block', transform: isPofrrExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                                                    <ChevronRight size={14} />
                                                  </span>
                                                  <div>
                                                    <strong style={{ display: 'block', color: '#047857', fontFamily: 'monospace' }}>
                                                      {receipt.pofrr_number}
                                                    </strong>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>
                                                      Received {receipt.rolls.length} rolls ({totalReceiptQty.toFixed(2)} m) on {new Date(receipt.received_at).toLocaleDateString('en-IN')}
                                                    </span>
                                                  </div>
                                                </div>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const pofrrDoc = {
                                                      pofrr_number: receipt.pofrr_number,
                                                      pof_number: pof.pof_number,
                                                      partner_name: pof.partner_name,
                                                      created_at: pof.created_at,
                                                      received_at: receipt.received_at,
                                                      expected_delivery_date: pof.expected_delivery_date,
                                                      vehicle_details: pof.vehicle_details,
                                                      delivered_by: pof.delivered_by,
                                                      received_by: receipt.received_by,
                                                      received_place: receipt.received_place,
                                                      receive_vehicle_details: receipt.receive_vehicle_details,
                                                      fabric_rolls: pof.fabric_rolls || [],
                                                      received_rolls: receipt.rolls,
                                                      all_received_rolls: pof.received_rolls || [],
                                                      processes: pof.processes || [],
                                                      status: pof.status
                                                    };
                                                    onViewPOFRR(pofrrDoc);
                                                  }}
                                                  style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                                    backgroundColor: '#ecfdf5', border: '1px solid #10b981',
                                                    color: '#047857', padding: '4px 10px', borderRadius: '6px',
                                                    fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer'
                                                  }}
                                                >
                                                  <Printer size={12} /> View & Print
                                                </button>
                                              </div>

                                              {isPofrrExpanded && (
                                                <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fff', borderTop: '1px solid #eee' }} onClick={e => e.stopPropagation()}>
                                                  {/* Metadata summary */}
                                                  <div className="grid-2-to-1" style={{ gap: '0.5rem 1.5rem', marginBottom: '0.75rem', fontSize: '0.75rem', borderBottom: '1px dashed #eee', paddingBottom: '0.5rem' }}>
                                                    <div>
                                                      <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', marginRight: '4px' }}>Received By:</span>
                                                      <strong style={{ color: '#111827' }}>{receipt.received_by}</strong>
                                                    </div>
                                                    <div>
                                                      <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', marginRight: '4px' }}>Place:</span>
                                                      <strong style={{ color: '#111827' }}>{receipt.received_place}</strong>
                                                    </div>
                                                    <div>
                                                      <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', marginRight: '4px' }}>Vehicle No:</span>
                                                      <strong style={{ color: '#111827' }}>{receipt.receive_vehicle_details}</strong>
                                                    </div>
                                                    <div>
                                                      <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', marginRight: '4px' }}>Date Received:</span>
                                                      <strong style={{ color: '#111827' }}>{new Date(receipt.received_at).toLocaleString('en-IN')}</strong>
                                                    </div>
                                                  </div>

                                                  {/* Rolls list */}
                                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                                                    <thead>
                                                      <tr style={{ borderBottom: '1.5px solid #eee', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted-current)' }}>
                                                        <th style={{ padding: '0.25rem' }}>S.No</th>
                                                        <th style={{ padding: '0.25rem' }}>Processed Roll ID</th>
                                                        <th style={{ padding: '0.25rem', textAlign: 'right' }}>Qty Received (m)</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {receipt.rolls.map((roll, rollIdx) => (
                                                        <tr key={roll.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                                                          <td style={{ padding: '0.25rem' }}>{rollIdx + 1}</td>
                                                          <td style={{ padding: '0.25rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#047857' }}>{roll.id}</td>
                                                          <td style={{ padding: '0.25rem', textAlign: 'right', fontWeight: '600', color: '#047857' }}>{parseFloat(roll.qty || 0).toFixed(2)} m</td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        });
                                      })()}
                                    </div>
                                  </div>
                                )}
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
        )}
      </div>
    </div>
  );
}

function TabUnderDevelopment({ title }) {
  return (
    <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px dashed #fecaca' }}>
      <Layers size={48} style={{ color: '#ef4444', marginBottom: '1rem', opacity: 0.5 }} />
      <h3 style={{ margin: '0 0 0.5rem 0', color: '#991b1b' }}>{title} Module</h3>
      <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.9rem', fontWeight: '500' }}>This section is currently under development. Detailed tracking will be available soon.</p>
    </div>
  );
}

export default function OrdersManagement({ hideNewOrderButton = false, showAllMerchandisers = false, backPath = '' }) {
  const [filter, setFilter] = useState('all');
  const [isPrintingSheet, setIsPrintingSheet] = useState(false);

  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPrintingSheet(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const handlePrintSheet = () => {
    setIsPrintingSheet(true);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [allDofs, setAllDofs] = useState([]);
  const [allDyrrs, setAllDyrrs] = useState([]);
  const [partners, setPartners] = useState([]);
  const [allWofs, setAllWofs] = useState([]);
  const [allSofs, setAllSofs] = useState([]);
  const [allWvofs, setAllWvofs] = useState([]);
  const [allDydi, setAllDydi] = useState([]);
  const [allPofs, setAllPofs] = useState([]);
  
  // Collapsible Filters State
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [searchOrderNumber, setSearchOrderNumber] = useState('');
  const [searchMerchandiser, setSearchMerchandiser] = useState('');
  const [searchBuyer, setSearchBuyer] = useState('');
  const [searchVendor, setSearchVendor] = useState('');
  const [searchSeason, setSearchSeason] = useState('');
  const [searchWeaveType, setSearchWeaveType] = useState('');
  const [searchOrderCategory, setSearchOrderCategory] = useState('');

  // Unique filter values derived from orders
  const uniqueMerchandisers = useMemo(() => {
    return [...new Set(orders.map(o => o.merchandiser_name).filter(Boolean))].sort();
  }, [orders]);

  const uniqueSeasons = useMemo(() => {
    return [...new Set(orders.map(o => o.season).filter(Boolean))].sort();
  }, [orders]);

  const uniqueWeaveTypes = useMemo(() => {
    return [...new Set(orders.map(o => o.technical_specs?.weave_type).filter(Boolean))].sort();
  }, [orders]);

  const uniqueOrderCategories = useMemo(() => {
    return [...new Set(orders.map(o => o.technical_specs?.order_category).filter(Boolean))].sort();
  }, [orders]);

  // Filtered Orders calculation
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (searchOrderNumber && !order.order_number?.toLowerCase().includes(searchOrderNumber.toLowerCase())) {
        return false;
      }
      if (searchMerchandiser && order.merchandiser_name !== searchMerchandiser) {
        return false;
      }
      if (searchBuyer && order.master_brands?.brand_name !== searchBuyer) {
        return false;
      }
      if (searchVendor && order.vendor?.partner_name !== searchVendor) {
        return false;
      }
      if (searchSeason && order.season !== searchSeason) {
        return false;
      }
      if (searchWeaveType && order.technical_specs?.weave_type !== searchWeaveType) {
        return false;
      }
      if (searchOrderCategory && order.technical_specs?.order_category !== searchOrderCategory) {
        return false;
      }
      return true;
    });
  }, [orders, searchOrderNumber, searchMerchandiser, searchBuyer, searchVendor, searchSeason, searchWeaveType, searchOrderCategory]);
  
  // Modal tracking
  const [viewDofData, setViewDofData] = useState(null);
  const [viewGydrData, setViewGydrData] = useState(null);
  const [viewDyrrData, setViewDyrrData] = useState(null);
  const [viewDydrData, setViewDydrData] = useState(null);
  const [viewPofData, setViewPofData] = useState(null);
  const [viewPofrrData, setViewPofrrData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const basePath = profile?.role === 'admin' ? '/admin' : '/merchandiser';

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Fetch Masters for display names and all DOFs/Receipts/WOFs/SOFs/Weaving orders/DYDR deliveries
      const [yarnRes, brandRes, dofsRes, dyrrsRes, partnersRes, wofsRes, sofsRes, wvofsRes, dydiRes, pofsRes] = await Promise.all([
        supabase.from('master_yarn_counts').select('*'),
        supabase.from('master_brands').select('*'),
        supabase.from('dyeing_order_forms').select('id, dof_number, expected_delivery_date, order_ids, status'),
        supabase.from('dyed_yarn_receipts').select('id, dof_id, received_date, source_type'),
        supabase.from('master_partners').select('*'),
        supabase.from('warping_order_forms').select('id, wof_number, order_id, status, end_date, process_completed_at, updated_at, colour_allotments, wofdc_number'),
        supabase.from('sizing_order_forms').select('id, sof_number, order_id, status, end_date, process_completed_at, updated_at, sofdc_number'),
        supabase.from('weaving_orders').select('id, weaving_number, order_id, status, start_date, end_date, process_started_at, process_completed_at, updated_at, weft_allotments, fabric_rolls, production_logs'),
        supabase.from('dyed_yarn_delivery_items').select('id, production_form_id, quantity_kg, process_type, order_id'),
        supabase.from('processing_orders').select('*')
      ]);
      setYarnCounts(yarnRes.data || []);
      setBrands(brandRes.data || []);
      setAllDofs(dofsRes.data || []);
      setAllDyrrs((dyrrsRes.data || []).filter(r => r.source_type !== 'production'));
      setPartners(partnersRes.data || []);
      setAllWofs(wofsRes.data || []);
      setAllSofs(sofsRes.data || []);
      setAllWvofs(wvofsRes.data || []);
      setAllDydi(dydiRes.data || []);
      setAllPofs(pofsRes.data || []);

      let query = supabase
        .from('orders')
        .select('*, vendor:master_partners(partner_name), master_brands(brand_name)')
        .order('created_at', { ascending: false });

      if (profile?.role === 'merchandiser' && !showAllMerchandisers) {
        query = query.eq('merchandiser_id', profile.id);
      }

      if (filter === 'drafts') {
        query = query.eq('status', 'draft');
      } else if (filter === 'completed') {
        query = query.eq('status', 'completed');
      } else if (filter === 'active') {
        query = query.eq('status', 'active');
      } else if (filter === 'bulk') {
        query = query.eq('order_type', 'bulk');
      } else if (filter === 'sample') {
        query = query.eq('order_type', 'sample');
      }

      const { data, error } = await query;
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Detail Fetchers
  const fetchDOFDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const formRes = await supabase
        .from('dyeing_order_forms')
        .select(`
          *,
          dyeing_unit:master_partners(partner_name),
          creator:profiles!dyeing_order_forms_created_by_fkey(full_name),
          approver:profiles!dyeing_order_forms_approved_by_fkey(full_name)
        `)
        .eq('id', id)
        .single();
      
      if (formRes.error) throw formRes.error;

      let ordersData = [];
      if (formRes.data?.order_ids?.length) {
        const ords = await supabase
          .from('orders')
          .select('id, order_number, design_no, design_name, technical_specs, master_brands(brand_name)')
          .in('id', formRes.data.order_ids);
        if (ords.error) throw ords.error;
        ordersData = ords.data || [];
      }
      
      setViewDofData({ form: formRes.data, orders: ordersData });
    } catch (err) {
      console.error(err);
      alert('Error loading DOF details: ' + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchGYDRDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const { data: receipt } = await supabase
        .from('greige_yarn_delivery_receipts')
        .select(`
          *,
          dof:dyeing_order_forms(
            *,
            dyeing_unit:master_partners(partner_name)
          )
        `)
        .eq('id', id)
        .single();
        
      const { data: items } = await supabase
        .from('greige_yarn_delivery_items')
        .select(`
          *,
          master_yarn_counts(*),
          master_locations(*),
          spinning_mill:master_partners(partner_name)
        `)
        .eq('receipt_id', id);

      let linkedOrders = [];
      if (receipt?.dof?.order_ids && receipt.dof.order_ids.length > 0) {
        const { data: ords } = await supabase
          .from('orders')
          .select('id, order_number, design_no, design_name')
          .in('id', receipt.dof.order_ids);
        linkedOrders = ords || [];
      }

      setViewGydrData({ receipt, items, orders: linkedOrders });
    } catch (err) {
      console.error(err);
      alert('Error loading delivery details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchDYRRDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const { data: receipt, error } = await supabase
        .from('dyed_yarn_receipts')
        .select('*, dyeing_unit:master_partners(partner_name), items:dyed_yarn_receipt_items(*, orders(*), master_yarn_counts(*), master_locations(*))')
        .eq('id', id)
        .single();
      if (error) throw error;
      setViewDyrrData(receipt);
    } catch (err) {
      console.error(err);
      alert('Error loading receipt details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchDYDRDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const { data: receipt } = await supabase.from('dyed_yarn_deliveries').select('*').eq('id', id).single();
      const { data: items } = await supabase.from('dyed_yarn_delivery_items').select('*, location:master_locations(location_name)').eq('delivery_id', id);
      setViewDydrData({ receipt, items });
    } catch (err) {
      console.error(err);
      alert('Error loading delivery details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const deleteOrder = async (id) => {
    // 1. Check if at least 1 DOF exists for this order
    const associatedDofs = allDofs.filter(d => d.order_ids && d.order_ids.includes(id));
    if (associatedDofs.length > 0) {
      if (profile?.role !== 'admin') {
        alert('Cannot delete this order because at least 1 Dyeing Order Form (DOF) has already been created for it. Only administrators can delete orders with associated DOFs.');
        return;
      }
    }

    // 2. Double-confirm delete
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    if (!window.confirm('WARNING: Deleting this order will remove it permanently. Are you absolutely sure you want to proceed?')) return;

    try {
      const { data, error } = await supabase.from('orders').delete().eq('id', id).select();
      if (error) throw error;
      if (!data || data.length === 0) {
        alert('Could not delete order. This usually happens if you do not have deletion permissions (missing Row Level Security DELETE policy) or if the order is referenced by other records.');
        return;
      }
      setOrders(orders.filter(o => o.id !== id));
    } catch (err) {
      alert('Error deleting order: ' + err.message);
    }
  };



  return (
    <div style={{ width: '100%', padding: '1.5rem', boxSizing: 'border-box' }}>
      <div className="no-print">
      {/* Top Header Section */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button 
            onClick={() => navigate(backPath || basePath)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--color-primary)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              cursor: 'pointer',
              padding: '0',
              marginBottom: '0.5rem'
            }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
          <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--text-current)', fontWeight: 'bold' }}>
            {hideNewOrderButton ? 'Order Details' : 'Orders Management'}
          </h1>
        </div>
        
        {!hideNewOrderButton && (
          <Link 
            to={`${basePath}/create-order`} 
            className="btn btn-primary" 
            style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontWeight: 'bold', padding: '0.625rem 1.25rem' }}
          >
            <Plus size={18} />
            New Order
          </Link>
        )}
      </div>

      {/* Filter Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '0.75rem 1rem', 
        backgroundColor: 'var(--surface-current)', 
        border: '1px solid var(--border-current)', 
        borderRadius: 'var(--radius-md)', 
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', marginRight: '0.5rem' }}>Filter:</span>
          {['all', 'drafts', 'active', 'completed', 'bulk', 'sample'].map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.5rem 1rem',
                border: filter === f ? '1px solid var(--color-primary)' : '1px solid var(--border-current)',
                backgroundColor: filter === f ? 'var(--color-primary)' : 'transparent',
                color: filter === f ? 'white' : 'var(--text-current)',
                borderRadius: 'var(--radius-md)',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {f}
            </button>
          ))}
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handlePrintSheet}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid var(--border-current)',
              backgroundColor: '#e2e8f0',
              color: '#1e293b',
              borderRadius: 'var(--radius-md)',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Printer size={16} />
            Print Filtered Sheet
          </button>
          
          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid var(--border-current)',
              backgroundColor: isFilterExpanded ? 'var(--color-primary)' : 'transparent',
              color: isFilterExpanded ? 'white' : 'var(--text-current)',
              borderRadius: 'var(--radius-md)',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <SlidersHorizontal size={16} />
            {isFilterExpanded ? 'Hide Filters' : 'Advanced Filters'}
          </button>
        </div>
      </div>

      {/* Expandable filter panel */}
      {isFilterExpanded && (
        <div style={{
          backgroundColor: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          marginBottom: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }} className="fade-in">
          {/* Filter by Order Number */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Order Number</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. AT/2026/S/00001"
              value={searchOrderNumber}
              onChange={e => setSearchOrderNumber(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '0.5rem', width: '100%' }}
            />
          </div>

          {/* Filter by Merchandiser Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Merchandiser</label>
            <select
              className="input"
              value={searchMerchandiser}
              onChange={e => setSearchMerchandiser(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '0.5rem', width: '100%' }}
            >
              <option value="">All Merchandisers</option>
              {uniqueMerchandisers.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Filter by Buyer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Buyer / Brand</label>
            <select
              className="input"
              value={searchBuyer}
              onChange={e => setSearchBuyer(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '0.5rem', width: '100%' }}
            >
              <option value="">All Buyers</option>
              {brands.map(b => (
                <option key={b.id} value={b.brand_name}>{b.brand_name}</option>
              ))}
            </select>
          </div>

          {/* Filter by Vendor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Vendor Partner</label>
            <select
              className="input"
              value={searchVendor}
              onChange={e => setSearchVendor(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '0.5rem', width: '100%' }}
            >
              <option value="">All Vendors</option>
              {partners.map(p => (
                <option key={p.id} value={p.partner_name}>{p.partner_name}</option>
              ))}
            </select>
          </div>

          {/* Filter by Season */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Season</label>
            <select
              className="input"
              value={searchSeason}
              onChange={e => setSearchSeason(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '0.5rem', width: '100%' }}
            >
              <option value="">All Seasons</option>
              {uniqueSeasons.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Filter by Weave Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Weave Type</label>
            <select
              className="input"
              value={searchWeaveType}
              onChange={e => setSearchWeaveType(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '0.5rem', width: '100%' }}
            >
              <option value="">All Weave Types</option>
              {uniqueWeaveTypes.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* Filter by Order Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Order Type</label>
            <select
              className="input"
              value={searchOrderCategory}
              onChange={e => setSearchOrderCategory(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '0.5rem', width: '100%' }}
            >
              <option value="">All Order Types</option>
              {uniqueOrderCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters button */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              onClick={() => {
                setSearchOrderNumber('');
                setSearchMerchandiser('');
                setSearchBuyer('');
                setSearchVendor('');
                setSearchSeason('');
                setSearchWeaveType('');
                setSearchOrderCategory('');
              }}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: '600' }}
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Orders List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Loader size={32} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-muted-current)' }}>Fetching orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--surface-current)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-current)' }}>
            <p style={{ color: 'var(--text-muted-current)' }}>No orders found for this filter.</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--surface-current)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-current)' }}>
            <p style={{ color: 'var(--text-muted-current)', fontWeight: '500' }}>No orders match the selected search filters.</p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const orderDofs = allDofs.filter(d => d.order_ids && d.order_ids.includes(order.id));
            const orderWofs = allWofs.filter(w => w.order_id === order.id);
            const orderSofs = allSofs.filter(s => s.order_id === order.id);
            const orderWvofs = allWvofs.filter(wv => wv.order_id === order.id);
            const orderDydis = allDydi.filter(d => d.order_id === order.id);

            return (
              <OrderCard 
                key={order.id} 
                order={order} 
                basePath={basePath} 
                onDelete={() => deleteOrder(order.id)}
                hideDeleteButton={hideNewOrderButton}
                yarnCounts={yarnCounts}
                onViewDOF={fetchDOFDetail}
                onViewGYDR={fetchGYDRDetail}
                onViewDYRR={fetchDYRRDetail}
                onViewDYDR={fetchDYDRDetail}
                onViewPOF={(pof) => setViewPofData({ pof, order })}
                onViewPOFRR={(pofrr) => setViewPofrrData({ pofrr, order })}
                orderDofs={orderDofs}
                allDyrrs={allDyrrs}
                orderWofs={orderWofs}
                orderSofs={orderSofs}
                orderWvofs={orderWvofs}
                orderDydis={orderDydis}
                allPofs={allPofs}
              />
            );
          })
        )}
      </div> {/* Close card list container */}
      </div> {/* Close no-print wrapper */}

      {/* Filtered Orders Sheet (visible on print only) */}
      <div 
        className={isPrintingSheet ? "print-container" : ""} 
        style={{ 
          display: isPrintingSheet ? 'block' : 'none', 
          backgroundColor: 'white', 
          color: 'black', 
          padding: '1.5cm',
          boxSizing: 'border-box'
        }}
      >
        {isPrintingSheet && (
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              .print-container, .print-container * {
                visibility: visible !important;
              }
              .print-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0.5cm !important;
                box-shadow: none !important;
                border: none !important;
                background: white !important;
                color: black !important;
              }
              .no-print {
                display: none !important;
              }
              html, body, #root, .app-layout-container, .main-content-wrapper, .main-content {
                height: auto !important;
                overflow: visible !important;
                display: block !important;
              }
              @page {
                size: landscape !important;
                margin: 0.5cm !important;
              }
              body {
                background: white !important;
                color: black !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              table.excel-sheet {
                width: 100% !important;
                border-collapse: collapse !important;
                font-size: 7.5pt !important;
                color: black !important;
              }
              table.excel-sheet th, table.excel-sheet td {
                border: 1px solid #94a3b8 !important;
                padding: 4px 6px !important;
                text-align: left;
                vertical-align: middle;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              table.excel-sheet th {
                background-color: #e2e8f0 !important;
                font-weight: bold;
                text-transform: uppercase;
                font-size: 7.5pt !important;
              }
              table.excel-sheet td {
                font-size: 7.5pt !important;
              }
            }
          `}</style>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #800000', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20pt', color: '#800000', fontFamily: 'system-ui, sans-serif', fontWeight: 'bold' }}>Ashok Textiles</h1>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '10pt', color: '#475569', fontStyle: 'italic' }}>
              Orders Sheet (Filter: <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{filter}</span>)
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '9pt', color: '#475569', fontFamily: 'monospace' }}>
            Generated: {new Date().toLocaleString()}
          </div>
        </div>

        <table className="excel-sheet" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'system-ui, sans-serif' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'center', width: '50px' }}>NUMBER</th>
              <th style={{ textAlign: 'center', width: '70px' }}>PHOTO</th>
              <th>ORDER NUMBER</th>
              <th>TYPE</th>
              <th>BRAND</th>
              <th>COUNT</th>
              <th>ORDER CONST</th>
              <th>ORDER WIDTH</th>
              <th>FOB</th>
              <th style={{ textAlign: 'right' }}>ORDER QTY</th>
              <th style={{ textAlign: 'center' }}>DYEING</th>
              <th style={{ textAlign: 'center' }}>WARPING</th>
              <th style={{ textAlign: 'center' }}>SIZING</th>
              <th style={{ textAlign: 'center' }}>WEAVING</th>
              <th style={{ textAlign: 'center' }}>PROCESSING</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="15" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No orders found matching the filter "{filter}"
                </td>
              </tr>
            ) : (
              filteredOrders.map((order, idx) => {
                const orderDofs = allDofs.filter(d => d.order_ids && d.order_ids.includes(order.id));
                const orderWofs = allWofs.filter(w => w.order_id === order.id);
                const orderSofs = allSofs.filter(s => s.order_id === order.id);
                const orderWvofs = allWvofs.filter(wv => wv.order_id === order.id);
                const orderDydis = allDydi.filter(d => d.order_id === order.id);
                const orderPofs = (allPofs || []).filter(pof => 
                  (pof.weaving_order_ids && pof.weaving_order_ids.some(woId => orderWvofs.some(wv => wv.id === woId))) ||
                  (pof.fabric_rolls && pof.fabric_rolls.some(roll => roll.order_number === order.order_number))
                );

                let totalWeavedQty = 0;
                orderWvofs.forEach(wv => {
                  const logs = Array.isArray(wv.production_logs) ? wv.production_logs : [];
                  totalWeavedQty += logs.reduce((acc, log) => acc + parseFloat(log.qty || 0), 0);
                });

                let totalGreigeInputQty = 0;
                orderWvofs.forEach(wv => {
                  const rolls = Array.isArray(wv.fabric_rolls) ? wv.fabric_rolls : [];
                  const greigeRolls = rolls.filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing');
                  totalGreigeInputQty += greigeRolls.reduce((acc, r) => acc + parseFloat(r.qty || 0), 0);
                });

                const allWarpIds = order.technical_specs?.warp_selections?.flat() || [];
                const allWeftIds = order.technical_specs?.weft_selections?.flat() || [];
                const warpStr = allWarpIds.map(id => yarnCounts.find(y => y.id === id)?.count_value).filter(Boolean).join(' + ');
                const weftStr = allWeftIds.map(id => yarnCounts.find(y => y.id === id)?.count_value).filter(Boolean).join(' + ');
                const countStr = `${warpStr || '-'} X ${weftStr || '-'}`;

                const dyeingStatus = getAggregatedStatusSummary(orderDofs, dof => getSingleDofStatusLabel(dof, allDyrrs));
                const warpingStatus = getAggregatedStatusSummary(orderWofs, wof => getSingleWofStatusLabel(wof, orderDydis));
                const sizingStatus = getAggregatedStatusSummary(orderSofs, sof => getSingleSofStatusLabel(sof));
                const weavingStatus = getAggregatedStatusSummary(orderWvofs, wvof => getSingleWvofStatusLabel(wvof));
                const processingStatus = getAggregatedStatusSummary(orderPofs, pof => getSinglePofStatusLabel(pof));

                return (
                  <React.Fragment key={order.id}>
                    {/* Row 1: General Details */}
                    <tr>
                      {/* Serial Number (rowspan=3) */}
                      <td rowSpan={3} style={{ textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold', fontSize: '8pt' }}>
                        {idx + 1}
                      </td>

                      {/* Design Image (rowspan=3) */}
                      <td rowSpan={3} style={{ textAlign: 'center', verticalAlign: 'middle', padding: '4px' }}>
                        {order.design_image_url ? (
                          <img 
                            src={order.design_image_url} 
                            alt="" 
                            style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0' }} 
                          />
                        ) : (
                          <span style={{ fontSize: '7pt', color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      {/* Order Number */}
                      <td style={{ fontWeight: 'bold', fontSize: '8.5pt' }}>{order.order_number}</td>

                      {/* Type (Order Category) */}
                      <td style={{ fontSize: '8pt', fontWeight: 'bold', color: '#800000' }}>{order.technical_specs?.order_category || '—'}</td>

                      {/* Brand */}
                      <td style={{ fontSize: '8pt', fontWeight: '500' }}>{order.master_brands?.brand_name || '—'}</td>

                      {/* Count */}
                      <td style={{ fontSize: '7.5pt', fontFamily: 'monospace' }}>{countStr}</td>

                      {/* Order Const */}
                      <td style={{ fontSize: '8pt' }}>
                        {order.technical_specs?.order_reed || '—'} / {order.technical_specs?.order_pick || '—'}
                      </td>

                      {/* Order Width */}
                      <td style={{ fontSize: '8pt' }}>
                        {order.technical_specs?.order_width ? `${order.technical_specs.order_width}"` : '—'}
                      </td>

                      {/* FOB Date */}
                      <td style={{ fontSize: '8pt' }}>{order.fob_date || '—'}</td>

                      {/* Order Qty */}
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '8.5pt' }}>
                        {Number(order.total_quantity).toLocaleString()} Mtrs
                      </td>

                      {/* Status columns (rowspan=3) */}
                      <td rowSpan={3} style={{ backgroundColor: dyeingStatus.bg, color: dyeingStatus.text, border: `1px solid ${dyeingStatus.border} !important`, fontWeight: 'bold', fontSize: '7.5pt', textAlign: 'center', verticalAlign: 'middle' }}>
                        {dyeingStatus.label}
                      </td>
                      <td rowSpan={3} style={{ backgroundColor: warpingStatus.bg, color: warpingStatus.text, border: `1px solid ${warpingStatus.border} !important`, fontWeight: 'bold', fontSize: '7.5pt', textAlign: 'center', verticalAlign: 'middle' }}>
                        {warpingStatus.label}
                      </td>
                      <td rowSpan={3} style={{ backgroundColor: sizingStatus.bg, color: sizingStatus.text, border: `1px solid ${sizingStatus.border} !important`, fontWeight: 'bold', fontSize: '7.5pt', textAlign: 'center', verticalAlign: 'middle' }}>
                        {sizingStatus.label}
                      </td>
                      <td rowSpan={3} style={{ backgroundColor: weavingStatus.bg, color: weavingStatus.text, border: `1px solid ${weavingStatus.border} !important`, fontWeight: 'bold', fontSize: '7.5pt', textAlign: 'center', verticalAlign: 'middle' }}>
                        {weavingStatus.label}
                      </td>
                      <td rowSpan={3} style={{ backgroundColor: processingStatus.bg, color: processingStatus.text, border: `1px solid ${processingStatus.border} !important`, fontWeight: 'bold', fontSize: '7.5pt', textAlign: 'center', verticalAlign: 'middle' }}>
                        {processingStatus.label}
                      </td>
                    </tr>

                    {/* Row 2: Subheader Labels */}
                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                      <td style={{ fontWeight: 'bold', fontSize: '7pt', color: '#475569', backgroundColor: '#e2e8f0', textTransform: 'uppercase' }}>DESIGN</td>
                      <td style={{ fontWeight: 'bold', fontSize: '7pt', color: '#475569', backgroundColor: '#e2e8f0', textTransform: 'uppercase' }}>WEAVE</td>
                      <td style={{ fontWeight: 'bold', fontSize: '7pt', color: '#475569', backgroundColor: '#e2e8f0', textTransform: 'uppercase' }}>VENDOR</td>
                      <td style={{ fontWeight: 'bold', fontSize: '7pt', color: '#475569', backgroundColor: '#e2e8f0', textTransform: 'uppercase' }}>GSM</td>
                      <td style={{ fontWeight: 'bold', fontSize: '7pt', color: '#475569', backgroundColor: '#e2e8f0', textTransform: 'uppercase' }}>ON LOOM CONST</td>
                      <td style={{ fontWeight: 'bold', fontSize: '7pt', color: '#475569', backgroundColor: '#e2e8f0', textTransform: 'uppercase' }}>ON LOOM</td>
                      <td style={{ fontWeight: 'bold', fontSize: '7pt', color: '#475569', backgroundColor: '#e2e8f0', textTransform: 'uppercase' }}>DELIVERY</td>
                      <td style={{ fontWeight: 'bold', fontSize: '7pt', color: '#475569', backgroundColor: '#e2e8f0', textTransform: 'uppercase' }}>WEAVED QTY</td>
                    </tr>

                    {/* Row 3: Design & Loom Parameters */}
                    <tr>
                      {/* Design No & Name */}
                      <td style={{ fontSize: '8pt', fontWeight: '500' }}>
                        {order.design_no} / {order.design_name}
                      </td>

                      {/* Weave Type */}
                      <td style={{ fontSize: '8pt' }}>{order.technical_specs?.weave_type || '—'}</td>

                      {/* Vendor Partner */}
                      <td style={{ fontSize: '8pt' }}>{order.vendor?.partner_name || '—'}</td>

                      {/* GSM */}
                      <td style={{ fontSize: '8pt', fontWeight: 'bold' }}>{order.technical_specs?.gsm || '—'}</td>

                      {/* Loom Const */}
                      <td style={{ fontSize: '8pt' }}>
                        {order.technical_specs?.on_loom_reed || '—'} / {order.technical_specs?.on_loom_pick || '—'}
                      </td>

                      {/* Finished/Loom Width */}
                      <td style={{ fontSize: '8pt' }}>
                        {order.technical_specs?.finished_width ? `${order.technical_specs.finished_width}"` : '—'}
                      </td>

                      {/* Delivery Date */}
                      <td style={{ fontSize: '8pt' }}>{order.dispatch_date || '—'}</td>

                      {/* Weaved Qty */}
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '8.5pt' }}>
                        {totalWeavedQty.toLocaleString()} Mtrs
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modals */}
      {viewDofData && (
        <DOFModal 
          data={viewDofData} 
          yarnCounts={yarnCounts} 
          onClose={() => setViewDofData(null)} 
        />
      )}
      {viewGydrData && (
        <GYDRModal 
          data={viewGydrData} 
          yarnCounts={yarnCounts} 
          onClose={() => setViewGydrData(null)} 
        />
      )}
      {viewDyrrData && (
        <DyedReceiptPrintModal 
          receipt={viewDyrrData} 
          onClose={() => setViewDyrrData(null)} 
        />
      )}
      {viewDydrData && (
        <DYDRModal 
          data={viewDydrData} 
          yarnCounts={yarnCounts} 
          onClose={() => setViewDydrData(null)} 
        />
      )}
      {viewPofData && (
        <POFModal 
          data={viewPofData} 
          onClose={() => setViewPofData(null)} 
        />
      )}
      {viewPofrrData && (
        <POFRRModal 
          data={viewPofrrData} 
          onClose={() => setViewPofrrData(null)} 
        />
      )}
      {loadingDetail && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader size={32} className="spin" color="var(--color-primary)" />
        </div>
      )}

    </div>
  );
}

// ──────────────────────────────────────────────
// Modal Sub-components
// ──────────────────────────────────────────────

function ModalWrapper({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="fade-in" style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, backgroundColor: '#fff', borderBottom: '1px solid #eee', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--color-primary)' }}>{title}</h3>
          <X size={24} style={{ cursor: 'pointer', color: '#666' }} onClick={onClose} />
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

function DOFModal({ data, yarnCounts, onClose }) {
  const { form, orders } = data;
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    if (form?.dof_number) {
      import('qrcode').then((QRCode) => {
        QRCode.default.toDataURL(form.dof_number, { margin: 1, width: 100 }, (err, url) => {
          if (!err) setQrCodeUrl(url);
        });
      }).catch(err => console.error("Error loading qrcode", err));
    }
  }, [form?.dof_number]);

  const formatYarn = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    if (!y) return 'Unknown';
    return `${y.count_value} - ${y.material} - ${y.product_type}`;
  };

  const getApprovalStatus = (status) => {
    if (status === 'pending') return 'pending';
    if (status === 'rejected') return 'rejected';
    return 'approved';
  };

  const getYarnStatus = (status) => {
    switch (status) {
      case 'pending':
      case 'rejected':
      case 'approved':           return 'greige_not_sent';
      case 'partially_sent':      return 'greige_partially_sent';
      case 'fully_sent':         return 'greige_sent';
      case 'partially_received': return 'partially_received';
      case 'received':           return 'fully_received';
      default:                   return status || 'greige_not_sent';
    }
  };

  const getTotalKg = () =>
    (form?.yarn_allocations || []).reduce((s, a) => s + parseFloat(a.total_kg || 0), 0).toFixed(2);

  const isApproved = form.status !== 'pending' && form.status !== 'rejected';

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative' }}>
        {/* Screen-only action bar */}
        <div className="no-print" style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: 'var(--color-primary)' }}>
            Dyeing Order Form: {form.dof_number}
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => window.print()}
              style={{ padding: '6px 16px', backgroundColor: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
            >
              🖨 Print DOF
            </button>
            <button onClick={onClose} style={{ padding: '6px 16px', backgroundColor: '#e2e8f0', color: '#374151', border: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div className="print-container" style={{ padding: '2.5rem 3rem', fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: '13px', color: '#000', backgroundColor: '#fff', position: 'relative' }}>
          
          {/* Approved Stamp/Seal */}
          {isApproved && (
            <div style={{
              position: 'absolute',
              top: '2.5rem',
              left: '50%',
              transform: 'translateX(-50%) rotate(-8deg)',
              border: '4px double #16a34a',
              borderRadius: '8px',
              color: '#16a34a',
              padding: '6px 16px',
              fontFamily: "'Montserrat', 'Arial Black', sans-serif",
              fontWeight: '900',
              fontSize: '16px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              backgroundColor: 'rgba(22, 163, 74, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1.2',
              zIndex: 10,
              pointerEvents: 'none',
              boxShadow: '0 0 0 2px #fff',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '2px' }}>VERIFIED & SECURED</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                ✓ APPROVED
              </span>
            </div>
          )}

          {/* Rejected Stamp/Seal */}
          {form.status === 'rejected' && (
            <div style={{
              position: 'absolute',
              top: '2.5rem',
              left: '50%',
              transform: 'translateX(-50%) rotate(-8deg)',
              border: '4px double #dc2626',
              borderRadius: '8px',
              color: '#dc2626',
              padding: '6px 16px',
              fontFamily: "'Montserrat', 'Arial Black', sans-serif",
              fontWeight: '900',
              fontSize: '16px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              backgroundColor: 'rgba(220, 38, 38, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1.2',
              zIndex: 10,
              pointerEvents: 'none',
              boxShadow: '0 0 0 2px #fff',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '2px' }}>DOCUMENT DISAPPROVED</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                ✗ REJECTED
              </span>
            </div>
          )}

          {/* Company Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #7f1d1d', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <img src="/logo.png" alt="Company Logo" style={{ maxHeight: '70px', maxWidth: '220px', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
              <div style={{ display: 'none' }}>
                <h2 style={{ margin: 0, color: '#7f1d1d', fontSize: '1.5rem', fontWeight: '900', letterSpacing: '1px' }}>ASHOK TEXTILES</h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#555' }}>Fabric Manufacturing ERP</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: '#7f1d1d', letterSpacing: '1px' }}>
                  DYEING ORDER FORM
                </h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '1.1rem', fontWeight: '700', color: '#111' }}>{form.dof_number}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#666' }}>
                  Date: {new Date(form.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
              {qrCodeUrl && (
                <img src={qrCodeUrl} alt="QR Code" style={{ width: '70px', height: '70px', border: '1px solid #e5e7eb', padding: '2px', borderRadius: '4px', backgroundColor: '#fff' }} />
              )}
            </div>
          </div>

          {/* Meta Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem' }}>
              <p style={{ margin: 0, fontWeight: '700', fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>Dyeing Unit Details</p>
              {[
                ['Dyeing Unit Name', form.dyeing_unit?.partner_name || '-'],
                ['Expected Delivery', form.expected_delivery_date ? new Date(form.expected_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Not set'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: '#555', minWidth: '140px', flexShrink: 0 }}>{label}:</span>
                  <span style={{ fontWeight: '600' }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem' }}>
              <p style={{ margin: 0, fontWeight: '700', fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>Document Details</p>
              {[
                ['Prepared By', form.creator?.full_name || '-'],
                ['Prepared On', new Date(form.created_at).toLocaleString('en-IN')],
                ['Linked Orders', orders.map(o => o.order_number).join(', ') || '-'],
                ['Approval Status', getApprovalStatus(form.status)?.toUpperCase()],
                ['Yarn Status', getYarnStatus(form.status)?.toUpperCase().replace(/_/g, ' ')],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: '#555', minWidth: '120px', flexShrink: 0 }}>{label}:</span>
                  <span style={{ fontWeight: '600' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Linked Orders Summary */}
          {orders.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7f1d1d', borderBottom: '1px solid #7f1d1d', paddingBottom: '4px', marginBottom: '0.75rem' }}>
                Linked Orders
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Order No.</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Design No.</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Design Name</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Buyer</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => (
                    <tr key={o.id} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '6px 10px', fontWeight: '600' }}>{o.order_number}</td>
                      <td style={{ padding: '6px 10px' }}>{o.design_no}</td>
                      <td style={{ padding: '6px 10px' }}>{o.design_name}</td>
                      <td style={{ padding: '6px 10px' }}>{o.master_brands?.brand_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Yarn Allocations */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7f1d1d', borderBottom: '1px solid #7f1d1d', paddingBottom: '4px', marginBottom: '0.75rem' }}>
              Yarn Allocation Details
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Order No.</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Type</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Yarn Count</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Colour</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700' }}>Base Qty (kg)</th>
                  <th style={{ padding: '6px 10px', textAlign: 'center', fontSize: '11px', fontWeight: '700' }}>Excess %</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700' }}>Total Qty (kg)</th>
                </tr>
              </thead>
              <tbody>
                {(form.yarn_allocations || []).map((a, i) => {
                  const ord = orders.find(o => o.id === a.orderId);
                  return (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '6px 10px', fontWeight: '600' }}>{ord?.order_number || '-'}</td>
                      <td style={{ padding: '6px 10px', textTransform: 'capitalize' }}>{a.type}</td>
                      <td style={{ padding: '6px 10px' }}>{formatYarn(a.countId)}</td>
                      <td style={{ padding: '6px 10px' }}>{a.colour}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right' }}>{parseFloat(a.base_kg || 0).toFixed(2)}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>{a.excess_pct}%</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700' }}>{parseFloat(a.total_kg || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #7f1d1d' }}>
                  <td colSpan={6} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', fontSize: '12px' }}>GRAND TOTAL:</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#7f1d1d', fontSize: '13px' }}>{getTotalKg()} kg</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Count & Colour Summary */}
          {(form.summary || []).length > 0 && (() => {
            const countMap = {};
            form.summary.forEach(s => {
              const label = s.yarnLabel || formatYarn(s.countId);
              if (!countMap[label]) countMap[label] = 0;
              countMap[label] += parseFloat(s.total_kg || 0);
            });
            const countSummary = Object.entries(countMap).map(([label, total_kg]) => ({ label, total_kg }));

            return (
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem', marginBottom: '2rem', alignItems: 'start' }}>
                <div>
                  <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7f1d1d', borderBottom: '1px solid #7f1d1d', paddingBottom: '4px', marginBottom: '0.75rem' }}>
                    Count & Colour Wise Summary
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Yarn Count</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Colour</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700' }}>Total (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.summary.map((s, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '6px 10px', fontWeight: '500', fontSize: '11px' }}>{s.yarnLabel || formatYarn(s.countId)}</td>
                          <td style={{ padding: '6px 10px', fontSize: '11px' }}>{s.colour}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', fontSize: '11px' }}>{parseFloat(s.total_kg || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: '#f3f4f6', borderTop: '1px solid #7f1d1d' }}>
                        <td colSpan={2} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', fontSize: '11px' }}>Total:</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#7f1d1d', fontSize: '11px' }}>
                          {form.summary.reduce((s, r) => s + parseFloat(r.total_kg || 0), 0).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7f1d1d', borderBottom: '1px solid #7f1d1d', paddingBottom: '4px', marginBottom: '0.75rem' }}>
                    Count Wise Summary
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Yarn Count</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700' }}>Total (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {countSummary.map((c, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '6px 10px', fontWeight: '600', fontSize: '11px' }}>{c.label}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', fontSize: '11px' }}>{c.total_kg.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: '#f3f4f6', borderTop: '1px solid #7f1d1d' }}>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', fontSize: '11px' }}>Grand Total:</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#7f1d1d', fontSize: '11px' }}>
                          {countSummary.reduce((s, c) => s + c.total_kg, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Signature / Approval Section */}
          <div style={{ borderTop: '2px solid #7f1d1d', paddingTop: '1.5rem', marginTop: '1rem' }}>
            {form.status === 'pending' && (
              <div style={{ border: '2px dashed #fcd34d', borderRadius: '8px', padding: '1.25rem 1.5rem', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <Clock size={24} color="#d97706" style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontWeight: '800', color: '#92400e', fontSize: '14px' }}>APPROVAL PENDING</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#78350f' }}>
                    This Dyeing Order Form has been submitted and is awaiting approval from the Managing Partner.
                  </p>
                </div>
              </div>
            )}

            {form.status === 'rejected' && (
              <div style={{ border: '2px solid #fca5a5', borderRadius: '8px', padding: '1.25rem 1.5rem', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <XCircle size={24} color="#dc2626" style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontWeight: '800', color: '#991b1b', fontSize: '14px' }}>REJECTED</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#7f1d1d' }}>
                    This Dyeing Order Form was not approved.{form.approval_notes ? ` Reason: ${form.approval_notes}` : ''}
                  </p>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '200px', borderTop: '1px solid #000', paddingTop: '8px', marginTop: '50px' }}>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '12px' }}>{form.creator?.full_name || 'Merchandiser'}</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#666' }}>Prepared By</p>
                  {form.created_at && (
                    <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#888' }}>
                      {new Date(form.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                {isApproved ? (
                  <div style={{ width: '240px', paddingTop: '8px' }}>
                    <div style={{ backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: '6px', padding: '0.6rem 1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                      <CheckCircle size={14} color="#166534" />
                      <span style={{ fontWeight: '700', color: '#166534', fontSize: '12px' }}>APPROVED</span>
                    </div>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '8px' }}>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '13px' }}>{form.approver?.full_name || 'VIJAYAKUMAR'}</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#444' }}>Managing Partner</p>
                      {form.updated_at && (
                        <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#888' }}>
                          {new Date(form.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                ) : form.status === 'rejected' ? (
                  <div style={{ width: '240px', paddingTop: '8px' }}>
                    <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.6rem 1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                      <XCircle size={14} color="#dc2626" />
                      <span style={{ fontWeight: '700', color: '#dc2626', fontSize: '12px' }}>REJECTED</span>
                    </div>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '8px' }}>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '13px' }}>{form.approver?.full_name || 'VIJAYAKUMAR'}</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#444' }}>Managing Partner</p>
                      {form.updated_at && (
                        <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#888' }}>
                          {new Date(form.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ width: '220px', borderTop: '1px dashed #999', paddingTop: '8px', marginTop: '50px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#555', fontWeight: '700' }}>VIJAYAKUMAR</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#888' }}>Managing Partner</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#aaa', fontStyle: 'italic' }}>Approval Signature / Date</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-container, .print-container * { visibility: visible; }
            .print-container { position: absolute; left: 0; top: 0; width: 100%; padding: 1.5rem 2rem; box-shadow: none; border: none; }
            .no-print { display: none !important; }
            @page { margin: 1.5cm; size: A4; }
          }
        `}</style>
      </div>
    </div>
  );
}

function GYDRModal({ data, yarnCounts, onClose }) {
  const { receipt, items, orders = [] } = data;
  const dof = receipt.dof;
  const totalQty = items.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        {/* Screen-only buttons */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: '#374151' }}>
            Greige Yarn Delivery Receipt — {receipt.gydr_number}
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => window.print()}
              style={{ padding: '6px 16px', backgroundColor: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
            >
              🖨 Print Receipt
            </button>
            <button onClick={onClose} style={{ padding: '6px 16px', backgroundColor: '#e2e8f0', color: '#374151', border: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div className="print-container" style={{ padding: '2rem 2.5rem', fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: '13px', color: '#111' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #7f1d1d', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <img src="/logo.png" alt="Logo" style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain' }}
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
              <div style={{ display: 'none' }}>
                <h2 style={{ margin: 0, color: '#7f1d1d', fontSize: '1.35rem', fontWeight: '900' }}>ASHOK TEXTILES</h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#555' }}>Fabric Manufacturing ERP</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: '#7f1d1d' }}>GREIGE YARN DELIVERY RECEIPT</h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '1.05rem', fontWeight: '700', color: '#111' }}>{receipt.gydr_number}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#666' }}>
                Date: {new Date(receipt.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Meta Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem' }}>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: '700', color: '#888', textTransform: 'uppercase' }}>Delivery Details</p>
              {[
                ['DOF Number', dof?.dof_number || receipt.dof_number],
                ['Dyeing Unit', dof?.dyeing_unit?.partner_name || '-'],
                ['Delivered By', receipt.delivered_by],
                ['Vehicle No', receipt.vehicle_no || '-'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', fontSize: '12px' }}>
                  <span style={{ color: '#555', minWidth: '110px', flexShrink: 0 }}>{label}:</span>
                  <span style={{ fontWeight: '600' }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem' }}>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: '700', color: '#888', textTransform: 'uppercase' }}>Linked Orders</p>
              {orders.length > 0 ? orders.map(o => (
                <div key={o.id} style={{ fontSize: '12px', marginBottom: '0.3rem' }}>
                  <span style={{ fontWeight: '700', color: '#7f1d1d' }}>{o.order_number}</span>
                  {o.design_no && <span style={{ color: '#555' }}> — {o.design_no}</span>}
                </div>
              )) : <span style={{ fontSize: '12px', color: '#888' }}>No linked orders</span>}
            </div>
          </div>

          {/* Delivery Items Table */}
          <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#7f1d1d', borderBottom: '1px solid #7f1d1d', paddingBottom: '4px', marginBottom: '0.75rem' }}>
            Yarn Delivery Details
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>S.No</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Yarn Count</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Colour</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Spinning Mill</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Location</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700' }}>Quantity (kg)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{i + 1}</td>
                  <td style={{ padding: '6px 10px', fontSize: '12px', fontWeight: '600' }}>
                    {item.master_yarn_counts
                      ? `${item.master_yarn_counts.count_value} - ${item.master_yarn_counts.material} - ${item.master_yarn_counts.product_type}`
                      : item.yarn_count_id ? (yarnCounts.find(c => c.id === item.yarn_count_id) ? `${yarnCounts.find(c => c.id === item.yarn_count_id).count_value} - ${yarnCounts.find(c => c.id === item.yarn_count_id).material} - ${yarnCounts.find(c => c.id === item.yarn_count_id).product_type}` : '-') : '-'}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{item.colour}</td>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>
                    {item.spinning_mill?.partner_name || (item.spinning_mill_id ? 'Unknown Mill' : 'Production Returns')}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{item.master_locations?.location_name || item.location?.location_name || '-'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', fontSize: '12px' }}>{parseFloat(item.quantity_kg).toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #7f1d1d' }}>
                <td colSpan={5} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', fontSize: '12px' }}>TOTAL:</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#7f1d1d', fontSize: '13px' }}>{totalQty.toFixed(2)} kg</td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '180px', borderTop: '1px solid #000', paddingTop: '8px', marginTop: '40px' }}>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '12px' }}>{receipt.delivered_by}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#666' }}>Delivered By</p>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '180px', borderTop: '1px solid #000', paddingTop: '8px', marginTop: '40px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>Received By</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#888' }}>Signature</p>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-container, .print-container * { visibility: visible; }
            .print-container { position: absolute; left: 0; top: 0; width: 100%; padding: 1.5rem 2rem; box-shadow: none; border: none; }
            .no-print { display: none !important; }
            @page { margin: 1.5cm; size: A4; }
          }
        `}</style>
      </div>
    </div>
  );
}



function DYDRModal({ data, yarnCounts, onClose }) {
  const { receipt, items } = data;
  const formatYarn = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    if (!y) return 'Unknown';
    return `${y.count_value}-${y.material}-${y.product_type}`;
  };

  return (
    <ModalWrapper title={`Dyed Yarn Delivery Receipt: ${receipt.dydr_number}`} onClose={onClose}>
      <div style={{ border: '2px solid #800000', padding: '2rem', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #800000', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, color: '#800000', fontWeight: '900' }}>DYED YARN DELIVERY RECEIPT</h2>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>ASHOK TEXTILES · Dyed Yarn Warehouse</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: '800' }}>#{receipt.dydr_number}</div>
            <div style={{ fontSize: '0.8rem' }}>Date: {new Date(receipt.created_at || receipt.delivered_date).toLocaleDateString()}</div>
          </div>
        </div>

        <div className="grid-2-to-1" style={{ marginBottom: '2rem' }}>
          <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: '#999', marginBottom: '0.5rem' }}>Logistics</div>
            <p style={{ margin: '0.2rem 0' }}><strong>Delivered By:</strong> {receipt.delivered_by || '-'}</p>
            <p style={{ margin: '0.2rem 0' }}><strong>Vehicle No:</strong> {receipt.vehicle_no || '-'}</p>
          </div>
          <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: '#999', marginBottom: '0.5rem' }}>Reference</div>
            <p style={{ margin: '0.2rem 0' }}><strong>Remarks:</strong> {receipt.remarks || '-'}</p>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#800000', color: '#fff' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Yarn Count</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Colour</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Process Type</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Lot Number</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>From Location</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Qty (kg)</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem', fontWeight: '600' }}>{formatYarn(item.yarn_count_id)}</td>
                <td style={{ padding: '0.75rem' }}>{item.colour}</td>
                <td style={{ padding: '0.75rem', textTransform: 'capitalize' }}>{item.process_type || '-'}</td>
                <td style={{ padding: '0.75rem' }}>{item.lot_number || '-'}</td>
                <td style={{ padding: '0.75rem' }}>{item.location?.location_name || '-'}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700' }}>{parseFloat(item.quantity_kg).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <td colSpan="5" style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800' }}>Total Delivered:</td>
              <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800', color: '#800000' }}>
                {items?.reduce((s, i) => s + parseFloat(i.quantity_kg), 0).toFixed(2)} kg
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </ModalWrapper>
  );
}

function POFModal({ data, onClose }) {
  const { pof, order } = data;
  const { profile } = useAuth();

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '1rem'
    }}>
      <div 
        className="print-container"
        style={{
          backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '800px',
          maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
        }}
      >
        {/* Modal Actions (No Print) */}
        <div className="no-print" style={{
          padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb',
          borderTopLeftRadius: '12px', borderTopRightRadius: '12px'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: '800' }}>
            Print Processing Order Form
          </h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={() => window.print()} 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
            >
              <Printer size={16} /> Print Order Form
            </button>
            <button 
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Print Body */}
        <div className="print-body">
          
          {/* Print Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '2.5px solid #000', paddingBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <img src="/logo.png" alt="Ashok Textiles" style={{ maxHeight: '68px', objectFit: 'contain' }} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
              <div style={{ display: 'none' }}>
                <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>ASHOK TEXTILES</h1>
              </div>
              <div>
                <div style={{ fontSize: '2.2rem', fontWeight: '950', letterSpacing: '1px', margin: 0, color: '#000', lineHeight: '1.1' }}>ASHOK TEXTILES</div>
                <div style={{ fontSize: '0.85rem', color: '#800000', fontWeight: '800', marginTop: '0.3rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Greige Fabric Outsource Processing Order
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '900', color: '#800000', letterSpacing: '0.5px' }}>PROCESSING ORDER</h2>
            </div>
          </div>

          {/* POF Metadata info */}
          <div className="grid-print-2col" style={{ marginBottom: '2rem', fontSize: '0.9rem', lineHeight: '1.6' }}>
            <div>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>POF Number:</strong> <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold' }}>{pof.pof_number}</span></p>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>Processing Partner:</strong> {pof.partner_name}</p>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>Expected Delivery Date:</strong> {new Date(pof.expected_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>Order Number:</strong> {order.order_number}</p>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>Design Number:</strong> {order.design_no || '—'}</p>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>Design Name:</strong> {order.design_name || '—'}</p>
            </div>
          </div>

          {/* Processes Panel */}
          <div style={{ border: '1.5px solid #000', padding: '1rem', borderRadius: '6px', marginBottom: '2rem', fontSize: '0.9rem' }}>
            <strong>Required Outsource Processes:</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              {pof.processes?.map((proc, index) => (
                <span key={proc} style={{ border: '1px solid #333', padding: '3px 10px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: '#f9f9f9' }}>
                  {index + 1}. {proc}
                </span>
              ))}
            </div>
          </div>

          {/* Rolls Table */}
          <h3 style={{ fontSize: '1rem', borderBottom: '1.5px solid #000', paddingBottom: '0.35rem', margin: '0 0 1rem 0' }}>
            Fabric Rolls Consignment Details ({(pof.fabric_rolls || []).length} rolls)
          </h3>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2.5rem', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f2f2f2' }}>
                <th style={{ padding: '0.6rem 0.75rem' }}>S.No</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>Fabric Roll QR ID</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Inspected Actual Qty (m)</th>
              </tr>
            </thead>
            <tbody>
              {(pof.fabric_rolls || []).map((roll, idx) => (
                <tr key={roll.id} style={{ borderBottom: '1px solid #ccc' }}>
                  <td style={{ padding: '0.6rem 0.75rem' }}>{idx + 1}</td>
                  <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{roll.id}</td>
                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 'bold' }}>{Number(roll.actual_qty || roll.qty).toFixed(2)} m</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold' }}>
                <td colSpan="2" style={{ padding: '0.75rem', textAlign: 'right' }}>Grand Total Qty:</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.95rem', color: '#000' }}>
                  {(pof.fabric_rolls || []).reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0).toFixed(2)} m
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Delivery and Vehicle info */}
          <div className="grid-print-2col" style={{ borderTop: '2px solid #000', paddingTop: '1.5rem', fontSize: '0.9rem' }}>
            <div>
              <p style={{ margin: '0 0 0.5rem 0' }}><strong>Delivered By:</strong> {pof.delivered_by || 'Hand Delivery'}</p>
              <p style={{ margin: '0 0 0.5rem 0' }}><strong>Vehicle No:</strong> {pof.vehicle_details || 'N/A'}</p>
              <p style={{ margin: '0 0 0.5rem 0' }}><strong>Created By:</strong> {profile?.name || 'Administrator'}</p>
              
              {pof.status === 'received' && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid #ccc', paddingTop: '1rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0' }}><strong>Received By:</strong> {pof.received_by}</p>
                  <p style={{ margin: '0 0 0.5rem 0' }}><strong>Return Vehicle No:</strong> {pof.receive_vehicle_details || 'Same/Hand Delivery'}</p>
                  <p style={{ margin: '0 0 0.5rem 0' }}><strong>Date Received:</strong> {pof.received_at ? new Date(pof.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</p>
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', height: pof.status === 'received' ? '180px' : '100px' }}>
              <div>
                <div style={{ borderBottom: '1px dashed #000', width: '180px', height: '40px' }} />
                <div style={{ width: '180px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Authorized Dispatch Signature
                </div>
              </div>
              {pof.status === 'received' && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ borderBottom: '1px dashed #000', width: '180px', height: '40px' }} />
                  <div style={{ width: '180px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    Authorized Receipt Signature
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Global print style controller */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: visible;
            box-shadow: none;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function POFRRModal({ data, onClose }) {
  const { pofrr, order } = data;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '1rem'
    }}>
      <div 
        className="print-container"
        style={{
          backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '800px',
          maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
        }}
      >
        {/* Modal Actions (No Print) */}
        <div className="no-print" style={{
          padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb',
          borderTopLeftRadius: '12px', borderTopRightRadius: '12px'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: '800' }}>
            Print Processing Order Fabric Receipt Register (POFRR)
          </h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={() => window.print()} 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
            >
              <Printer size={16} /> Print POFRR
            </button>
            <button 
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Print Body */}
        <div className="print-body">
          
          {/* Print Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '2.5px solid #000', paddingBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ fontSize: '2.2rem', fontWeight: '950', letterSpacing: '1px', margin: 0, color: '#000', lineHeight: '1.1' }}>ASHOK TEXTILES</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '900', color: '#800000', letterSpacing: '0.5px' }}>FABRIC RECEIPT REGISTER</h2>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>POFRR</div>
            </div>
          </div>

          {/* POFRR Metadata info */}
          <div className="grid-print-2col" style={{ marginBottom: '2rem', fontSize: '0.9rem', lineHeight: '1.6' }}>
            <div>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>POFRR Number:</strong> <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold' }}>{pofrr.pofrr_number}</span></p>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>POF Reference:</strong> <span style={{ fontFamily: 'monospace', fontSize: '0.95rem' }}>{pofrr.pof_number}</span></p>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>Processing Partner:</strong> {pofrr.partner_name}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>Date Sent:</strong> {new Date(pofrr.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>Date Received:</strong> {new Date(pofrr.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>Expected Return Date:</strong> {new Date(pofrr.expected_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          {/* Summary Metrics */}
          <div className="grid-4-to-2" style={{ border: '1.5px solid #000', padding: '1rem', borderRadius: '6px', marginBottom: '2rem', backgroundColor: '#f9f9f9', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: '#555', display: 'block', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Sent Qty</span>
              <strong style={{ fontSize: '1.1rem' }}>
                {pofrr.fabric_rolls?.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0).toFixed(2)} m
              </strong>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid #ccc' }}>
              <span style={{ fontSize: '0.7rem', color: '#555', display: 'block', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Received Qty</span>
              <strong style={{ fontSize: '1.1rem', color: '#047857' }}>
                {pofrr.received_rolls?.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0).toFixed(2)} m
              </strong>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid #ccc' }}>
              <span style={{ fontSize: '0.7rem', color: '#555', display: 'block', fontWeight: 'bold', textTransform: 'uppercase' }}>Difference (Loss)</span>
              <strong style={{ fontSize: '1.1rem', color: '#b91c1c' }}>
                {(() => {
                  const sent = pofrr.fabric_rolls?.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0) || 0;
                  const recd = pofrr.received_rolls?.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0) || 0;
                  return (sent - recd).toFixed(2);
                })()} m
              </strong>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid #ccc' }}>
              <span style={{ fontSize: '0.7rem', color: '#555', display: 'block', fontWeight: 'bold', textTransform: 'uppercase' }}>Overall Shrinkage</span>
              <strong style={{ fontSize: '1.1rem', color: '#b45309' }}>
                {(() => {
                  const sent = pofrr.fabric_rolls?.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0) || 0;
                  const recd = pofrr.received_rolls?.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0) || 0;
                  const pct = sent > 0 ? ((sent - recd) / sent) * 100 : 0;
                  return `${pct.toFixed(2)}%`;
                })()}
              </strong>
            </div>
          </div>

          {/* Comparison Table */}
          <h3 style={{ fontSize: '1rem', borderBottom: '1.5px solid #000', paddingBottom: '0.35rem', margin: '0 0 1rem 0' }}>
            Rolls Reconciliation Details
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2.5rem', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f2f2f2' }}>
                <th style={{ padding: '0.6rem 0.5rem', width: '80px' }}>S.No</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Fabric Received ID</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', width: '150px' }}>Received Qty (m)</th>
              </tr>
            </thead>
            <tbody>
              {(pofrr.received_rolls || []).map((roll, idx) => {
                const recdQty = parseFloat(roll.qty || 0);

                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '0.6rem 0.5rem' }}>{idx + 1}</td>
                    <td style={{ padding: '0.5rem 0.5rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{roll.id}</td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 'bold', color: '#047857' }}>{recdQty.toFixed(2)} m</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Delivery and Vehicle info */}
          <div className="grid-print-2col" style={{ borderTop: '2px solid #000', paddingTop: '1.5rem', fontSize: '0.9rem' }}>
            <div>
              <p style={{ margin: '0 0 0.5rem 0' }}><strong>Received By:</strong> {pofrr.received_by || 'N/A'}</p>
              <p style={{ margin: '0 0 0.5rem 0' }}><strong>Received Place:</strong> {pofrr.received_place || 'N/A'}</p>
              <p style={{ margin: '0 0 0.5rem 0' }}><strong>Return Vehicle No:</strong> {pofrr.receive_vehicle_details || 'Hand Delivery'}</p>
              <p style={{ margin: '0 0 0.5rem 0' }}><strong>Status:</strong> {pofrr.status === 'received' ? 'Fully Received' : 'Partially Received'}</p>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', height: '120px' }}>
              <div>
                <div style={{ borderBottom: '1px dashed #000', width: '180px', height: '40px' }} />
                <div style={{ width: '180px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Receiver Signature
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Global print style controller */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: visible;
            box-shadow: none;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

