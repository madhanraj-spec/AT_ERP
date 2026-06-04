import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, ArrowLeft, Trash2, Loader, 
  ChevronDown, ChevronUp, Info, Layers, 
  Zap, Search, Check, Eye, FileText, 
  Truck, ArrowRight, Package, Calculator,
  ExternalLink, X, CheckCircle, Clock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers for Expected Delivery Dates & Warning Alerts
// ──────────────────────────────────────────────────────────────────────────────
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
          color: '#475569',
          bgColor: '#f1f5f9',
          borderColor: '#cbd5e1'
        };
      } else {
        return {
          type: 'received_late',
          label: 'Received Late',
          color: '#475569',
          bgColor: '#f1f5f9',
          borderColor: '#cbd5e1'
        };
      }
    }
    return {
      type: 'received_on_time',
      label: 'Received On Time',
      color: '#475569',
      bgColor: '#f1f5f9',
      borderColor: '#cbd5e1'
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

// ──────────────────────────────────────────────────────────────────────────────
// OrderCard Sub-component
// ──────────────────────────────────────────────────────────────────────────────
function OrderCard({ order, basePath, onDelete, yarnCounts, onViewDOF, onViewGYDR, orderDofs = [], allDyrrs = [] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('order_info');
  const navigate = useNavigate();

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
          padding: '1.25rem 1.5rem',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} />
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.125rem', color: 'var(--text-current)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
              <div style={{ color: 'var(--text-muted-current)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ textTransform: 'capitalize' }}>{order.order_type} Order</span>
                <span>•</span>
                <span>{new Date(order.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
               <button 
                onClick={() => navigate(`${basePath}/edit-order/${order.id}`)}
                className="btn-icon"
                title="Edit Order"
                style={{ color: 'var(--text-muted-current)' }}
              >
                <Eye size={18} />
              </button>
              <button 
                onClick={onDelete}
                className="btn-icon"
                title="Delete Order"
                style={{ color: '#ef4444' }}
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div style={{ color: 'var(--text-muted-current)', display: 'flex', alignItems: 'center' }}>
              {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr', gap: '1.5rem', alignItems: 'center', padding: '0.5rem 0' }}>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Buyer / Brand</label>
            <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-current)' }}>{order.master_brands?.brand_name || 'N/A'}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Fabric Design</label>
            <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{order.design_no} / {order.design_name}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Yarn Count</label>
            <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--color-primary)' }}>{getShortCountsString(order.technical_specs)}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Order Qty</label>
            <div style={{ fontWeight: '800', fontSize: '0.9rem' }}>{order.total_quantity} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>Mtrs</span></div>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Dispatch</label>
            <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{order.dispatch_date ? new Date(order.dispatch_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '-'}</div>
          </div>
        </div>
      </div>

      {/* ── Expansion Section ── */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid var(--border-current)', backgroundColor: '#fafafa' }}>
          {/* Tab Headers */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-current)', padding: '0 1.5rem', gap: '1.5rem' }}>
            {[
              { id: 'order_info', label: 'Order Info', icon: <Info size={16} /> },
              { id: 'dyeing', label: 'Dyeing & Yarn', icon: <Zap size={16} /> },
              { id: 'warping', label: 'Warping & Sizing', icon: <Layers size={16} /> },
              { id: 'weaving', label: 'Weaving', icon: <Package size={16} /> },
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
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ padding: '1.5rem' }}>
            {activeTab === 'order_info' && <TabOrderInfo order={order} />}
            {activeTab === 'dyeing' && (
              <TabDyeing 
                order={order} 
                yarnCounts={yarnCounts} 
                onViewDOF={onViewDOF}
                onViewGYDR={onViewGYDR}
              />
            )}
            {['warping', 'weaving', 'inspection'].includes(activeTab) && <TabUnderDevelopment title={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-Tabs Implementation
// ──────────────────────────────────────────────────────────────────────────────

function TabOrderInfo({ order }) {
  const specs = order.technical_specs || {};
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
      <DetailItem label="Vendor" value={order.vendor?.partner_name} />
      <DetailItem label="Season" value={order.season} />
      <DetailItem label="FOB Date" value={order.fob_date} />
      <DetailItem label="Req Delivery Date" value={order.dispatch_date} />
      <DetailItem label="On Loom Width" value={specs.order_width ? `${specs.order_width}"` : '-'} />
      <DetailItem label="Finished Width" value={specs.finished_width ? `${specs.finished_width}"` : '-'} />
      
      <DetailItem label="Production Qty" value={specs.production_quantity ? `${specs.production_quantity} Mtrs` : '-'} />
      <DetailItem label="Weave Type" value={specs.weave_type} />

      <div style={{ gridColumn: 'span 4', borderTop: '1px dashed #ddd', margin: '0.5rem 0' }}></div>
      
      <DetailItem label="Order Construction" value={`${specs.order_reed} / ${specs.order_pick}`} />
      <DetailItem label="Production Construction" value={`${specs.on_loom_reed} / ${specs.on_loom_pick}`} />
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

function TabDyeing({ order, yarnCounts, onViewDOF, onViewGYDR }) {
  const [dofs, setDofs] = useState([]);
  const [gydrs, setGydrs] = useState([]);
  const [dyrrs, setDyrrs] = useState([]);
  const [deliveryItems, setDeliveryItems] = useState([]);
  const [receiptItems, setReceiptItems] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

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
        let gydiQuery = supabase
          .from('greige_yarn_delivery_items')
          .select('*, receipt:greige_yarn_delivery_receipts(*)');
        
        if (dofIds.length > 0) {
          gydiQuery = gydiQuery.or(`order_id.eq.${order.id},receipt_id.in.(${
            // We need to fetch receipt IDs linked to these DOFs first or do a join
            // For simplicity, let's fetch receipts separately if needed, but 'or' with subquery isn't supported easily.
            // Let's just fetch all items where receipt.dof_id is in dofIds.
            ''
          })`);
        } else {
          gydiQuery = gydiQuery.eq('order_id', order.id);
        }

        // Revised approach: Fetch all receipts for these DOFs
        const { data: relatedReceipts } = await supabase
          .from('greige_yarn_delivery_receipts')
          .select('id')
          .in('dof_id', dofIds);
        
        const receiptIds = relatedReceipts?.map(r => r.id) || [];

        const { data: gydiData } = await supabase
          .from('greige_yarn_delivery_items')
          .select('*, receipt:greige_yarn_delivery_receipts(*)')
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
          .select('*, receipt:dyed_yarn_receipts(*)')
          .eq('order_id', order.id);
        
        setReceiptItems(dyriData || []);
        const uniqueDyrr = Array.from(new Set(dyriData?.map(i => i.receipt?.id))).map(id => dyriData.find(i => i.receipt?.id === id).receipt);
        setDyrrs(uniqueDyrr.filter(Boolean));

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
    
    // Convert to array and sort: Warp first, then Weft
    return Object.values(summary).sort((a, b) => {
      if (a.type === 'warp' && b.type !== 'warp') return -1;
      if (a.type !== 'warp' && b.type === 'warp') return 1;
      return 0;
    });
  }, [dofs, deliveryItems, receiptItems, returns, order.yarn_requirements, order.id]);

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
                const balance = row.netRequired - row.received;
                // Check if we need a section header
                const showWarpHeader = idx === 0 && row.type === 'warp';
                const showWeftHeader = row.type === 'weft' && (idx === 0 || summaryData[idx-1].type !== 'weft');

                return (
                  <React.Fragment key={idx}>
                    {(showWarpHeader || showWeftHeader) && (
                      <tr style={{ backgroundColor: '#f3f4f6' }}>
                        <td colSpan="9" style={{ padding: '0.25rem 1rem', fontWeight: '800', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {row.type} Details
                        </td>
                      </tr>
                    )}
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold' }}>{formatYarnDisplay(row.countId)}</td>
                      <td style={{ padding: '0.75rem 1rem', textTransform: 'capitalize' }}>{row.type}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{row.colour}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#444' }}>{row.dyeingUnit}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>{row.netRequired.toFixed(1)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#666', fontSize: '0.8rem' }}>{row.dyeingReq.toFixed(1)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#6366f1' }}>{row.sent.toFixed(1)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>{row.received.toFixed(1)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold', color: balance > 0 ? '#ef4444' : '#10b981' }}>{balance.toFixed(1)}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
        {/* DOFs List */}
        <section>
          <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Dyeing Order Forms</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {dofs.map(d => {
              const alertInfo = getDofAlertInfo(d, dyrrs);
              const cardBg = alertInfo ? alertInfo.bgColor : '#fff';
              const cardBorder = alertInfo ? `1px solid ${alertInfo.borderColor}` : '1px solid #eee';
              const badgeColor = alertInfo ? alertInfo.color : '#666';
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
              <div key={r.id} style={{ padding: '0.75rem', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.8rem' }}>{r.gydr_number}</div>
                  <div style={{ fontSize: '0.7rem', color: '#666' }}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <button 
                  onClick={() => onViewGYDR(r.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
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
            {dyrrs.map(r => (
              <div key={r.id} style={{ padding: '0.75rem', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.8rem' }}>{r.dyrr_number}</div>
                  <div style={{ fontSize: '0.7rem', color: '#666' }}>{new Date(r.received_date).toLocaleDateString()}</div>
                </div>
                <Check size={14} color="#10b981" />
              </div>
            ))}
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

function TabUnderDevelopment({ title }) {
  return (
    <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px dashed #fecaca' }}>
      <Layers size={48} style={{ color: '#ef4444', marginBottom: '1rem', opacity: 0.5 }} />
      <h3 style={{ margin: '0 0 0.5rem 0', color: '#991b1b' }}>{title} Module</h3>
      <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.9rem', fontWeight: '500' }}>This section is currently under development. Detailed tracking will be available soon.</p>
    </div>
  );
}

export default function OrdersManagement() {
  const [filter, setFilter] = useState('all');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [allDofs, setAllDofs] = useState([]);
  const [allDyrrs, setAllDyrrs] = useState([]);
  
  // Modal tracking
  const [viewDofData, setViewDofData] = useState(null);
  const [viewGydrData, setViewGydrData] = useState(null);
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
      // Fetch Masters for display names and all DOFs/Receipts for warnings
      const [yarnRes, brandRes, dofsRes, dyrrsRes] = await Promise.all([
        supabase.from('master_yarn_counts').select('*'),
        supabase.from('master_brands').select('*'),
        supabase.from('dyeing_order_forms').select('id, dof_number, expected_delivery_date, order_ids, status'),
        supabase.from('dyed_yarn_receipts').select('id, dof_id, received_date')
      ]);
      setYarnCounts(yarnRes.data || []);
      setBrands(brandRes.data || []);
      setAllDofs(dofsRes.data || []);
      setAllDyrrs(dyrrsRes.data || []);

      let query = supabase
        .from('orders')
        .select('*, vendor:master_partners(partner_name), master_brands(brand_name)')
        .order('created_at', { ascending: false });

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
      const [formRes, ordersRes] = await Promise.all([
        supabase.from('dyeing_order_forms').select('*, dyeing_unit:master_partners(partner_name)').eq('id', id).single(),
        supabase.from('dyeing_order_forms').select('order_ids').eq('id', id).single()
      ]);
      
      const { data: ordersData } = await supabase.from('orders').select('id, order_number').in('id', formRes.data.order_ids);
      setViewDofData({ form: formRes.data, orders: ordersData || [] });
    } catch (err) {
      console.error(err);
      alert('Error loading DOF details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchGYDRDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const { data: receipt } = await supabase.from('greige_yarn_delivery_receipts').select('*').eq('id', id).single();
      const { data: items } = await supabase.from('greige_yarn_delivery_items').select('*, location:master_locations(location_name)').eq('receipt_id', id);
      setViewGydrData({ receipt, items });
    } catch (err) {
      console.error(err);
      alert('Error loading delivery details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const deleteOrder = async (id) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
      setOrders(orders.filter(o => o.id !== id));
    } catch (err) {
      alert('Error deleting order: ' + err.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return { bg: '#fef3c7', text: '#92400e' };
      case 'active': return { bg: '#dcfce7', text: '#166534' };
      case 'in_progress': return { bg: '#e0f2fe', text: '#0369a1' };
      case 'completed': return { bg: '#f1f5f9', text: '#475569' };
      default: return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  const getShortCountsString = (specs) => {
    if (!specs) return '-';
    const allWarpIds = specs.warp_selections?.flat() || [];
    const allWeftIds = specs.weft_selections?.flat() || [];
    
    const warpStr = allWarpIds.map(id => yarnCounts.find(y => y.id === id)?.count_value).filter(Boolean).join(' + ');
    const weftStr = allWeftIds.map(id => yarnCounts.find(y => y.id === id)?.count_value).filter(Boolean).join(' + ');
    
    return `${warpStr || '-'} X ${weftStr || '-'}`;
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      
      {/* Top Header Section */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button 
            onClick={() => navigate(basePath)} 
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
            Orders Management
          </h1>
        </div>
        
        <Link 
          to={`${basePath}/create-order`} 
          className="btn btn-primary" 
          style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontWeight: 'bold', padding: '0.625rem 1.25rem' }}
        >
          <Plus size={18} />
          New Order
        </Link>
      </div>

      {/* Filter Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.75rem', 
        padding: '0.75rem 1rem', 
        backgroundColor: 'var(--surface-current)', 
        border: '1px solid var(--border-current)', 
        borderRadius: 'var(--radius-md)', 
        marginBottom: '1rem' 
      }}>
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
        ) : (
          orders.map(order => {
            const orderDofs = allDofs.filter(d => d.order_ids && d.order_ids.includes(order.id));
            return (
              <OrderCard 
                key={order.id} 
                order={order} 
                basePath={basePath} 
                onDelete={() => deleteOrder(order.id)}
                yarnCounts={yarnCounts}
                onViewDOF={fetchDOFDetail}
                onViewGYDR={fetchGYDRDetail}
                orderDofs={orderDofs}
                allDyrrs={allDyrrs}
              />
            );
          })
        )}
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
        <div style={{ padding: '2rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function DOFModal({ data, yarnCounts, onClose }) {
  const { form, orders } = data;
  const formatYarn = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    if (!y) return 'Unknown';
    return `${y.count_value}-${y.material}-${y.product_type}`;
  };

  return (
    <ModalWrapper title={`Dyeing Order Form: ${form.dof_number}`} onClose={onClose}>
      <div style={{ border: '2px solid #7f1d1d', padding: '2rem', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #7f1d1d', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, color: '#7f1d1d', fontWeight: '900' }}>DYEING ORDER FORM</h2>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>{form.dyeing_unit?.partner_name}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: '800' }}>#{form.dof_number}</div>
            <div style={{ fontSize: '0.8rem' }}>Date: {new Date(form.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: '#999', marginBottom: '0.5rem' }}>Dyeing Details</div>
            <p style={{ margin: '0.2rem 0' }}><strong>Unit:</strong> {form.dyeing_unit?.partner_name}</p>
            <p style={{ margin: '0.2rem 0' }}><strong>Expected:</strong> {form.expected_delivery_date || '-'}</p>
          </div>
          <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: '#999', marginBottom: '0.5rem' }}>Order Context</div>
            <p style={{ margin: '0.2rem 0' }}><strong>Linked Orders:</strong> {orders.map(o => o.order_number).join(', ')}</p>
            <p style={{ margin: '0.2rem 0' }}><strong>Status:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{form.status}</span></p>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Order</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Yarn Count</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Colour</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Qty (kg)</th>
            </tr>
          </thead>
          <tbody>
            {form.yarn_allocations?.map((a, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem' }}>{orders.find(o => o.id === a.orderId)?.order_number}</td>
                <td style={{ padding: '0.75rem', textTransform: 'capitalize' }}>{a.type}</td>
                <td style={{ padding: '0.75rem' }}>{formatYarn(a.countId)}</td>
                <td style={{ padding: '0.75rem' }}>{a.colour}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700' }}>{parseFloat(a.total_kg).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModalWrapper>
  );
}

function GYDRModal({ data, yarnCounts, onClose }) {
  const { receipt, items } = data;
  const formatYarn = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    if (!y) return 'Unknown';
    return `${y.count_value}-${y.material}-${y.product_type}`;
  };

  return (
    <ModalWrapper title={`Greige Yarn Delivery Receipt: ${receipt.gydr_number}`} onClose={onClose}>
      <div style={{ border: '2px solid var(--color-primary)', padding: '2rem', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--color-primary)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--color-primary)', fontWeight: '900' }}>DELIVERY RECEIPT</h2>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>ASHOK TEXTILES · Greige Warehouse</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: '800' }}>#{receipt.gydr_number}</div>
            <div style={{ fontSize: '0.8rem' }}>Date: {new Date(receipt.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: '#999', marginBottom: '0.5rem' }}>Logistics</div>
            <p style={{ margin: '0.2rem 0' }}><strong>Delivered By:</strong> {receipt.delivered_by}</p>
            <p style={{ margin: '0.2rem 0' }}><strong>Vehicle No:</strong> {receipt.vehicle_no || '-'}</p>
          </div>
          <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: '#999', marginBottom: '0.5rem' }}>Reference</div>
            <p style={{ margin: '0.2rem 0' }}><strong>DOF Number:</strong> {receipt.dof_number}</p>
            <p style={{ margin: '0.2rem 0' }}><strong>Transferred To:</strong> Dyeing Processing Unit</p>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Yarn Count</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Colour</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>From Location</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Qty (kg)</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem', fontWeight: '600' }}>{formatYarn(item.yarn_count_id)}</td>
                <td style={{ padding: '0.75rem' }}>{item.colour}</td>
                <td style={{ padding: '0.75rem' }}>{item.location?.location_name || '-'}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700' }}>{parseFloat(item.quantity_kg).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <td colSpan="3" style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800' }}>Total Delivered:</td>
              <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800', color: 'var(--color-primary)' }}>
                {items?.reduce((s, i) => s + parseFloat(i.quantity_kg), 0).toFixed(2)} kg
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </ModalWrapper>
  );
}
