import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Loader, CheckCircle, Clock, XCircle, Eye, Filter, ChevronDown, ChevronUp, Search, X, ClipboardList, MoveHorizontal, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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

const getDofAlertInfo = (form, dyrrs) => {
  const today = getTodayString();
  const expected = form.expected_delivery_date;

  if (form.status === 'received') {
    const formReceipts = (dyrrs || []).filter(r => r.dof_id === form.id);
    if (formReceipts.length > 0 && expected) {
      const maxReceiptDate = formReceipts.reduce((max, r) => {
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

// ──────────────────────────────────────────────────────────────────────────────
// Modals for GYDR and DYRR
// ──────────────────────────────────────────────────────────────────────────────
function ModalWrapper({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="fade-in" style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, backgroundColor: '#fff', borderBottom: '1px solid #eee', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--color-primary)' }}>{title}</h3>
          <X size={24} style={{ cursor: 'pointer', color: '#666' }} onClick={onClose} />
        </div>
        <div style={{ padding: '1.5rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function GYDRDetailModal({ data, yarnCounts, onClose }) {
  const { receipt, items } = data;
  const formatYarn = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    return y ? `${y.count_value} ${y.material} ${y.product_type || ''}`.trim() : 'Unknown';
  };

  return (
    <ModalWrapper title={`Greige Yarn Delivery Receipt: ${receipt.gydr_number}`} onClose={onClose}>
      <div style={{ border: '2px solid var(--color-primary)', padding: '1.5rem', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--color-primary)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--color-primary)', fontWeight: '900', fontSize: '1.25rem' }}>GREIGE DELIVERY RECEIPT</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>Ashok Textiles · Greige Yarn Deliveries</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>#{receipt.gydr_number}</div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>Date: {new Date(receipt.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
          <div>
            <p style={{ margin: '0.2rem 0' }}><strong>Delivered By:</strong> {receipt.delivered_by}</p>
            <p style={{ margin: '0.2rem 0' }}><strong>Vehicle No:</strong> {receipt.vehicle_no || '-'}</p>
          </div>
          <div>
            <p style={{ margin: '0.2rem 0' }}><strong>Remarks:</strong> {receipt.remarks || '-'}</p>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Yarn Count</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Colour</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Qty (kg)</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem', fontWeight: '600' }}>{formatYarn(item.yarn_count_id)}</td>
                <td style={{ padding: '0.5rem' }}>{item.colour}</td>
                <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{item.yarn_type || 'warp'}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{parseFloat(item.quantity_kg).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f8fafc', fontWeight: '800' }}>
              <td colSpan="3" style={{ padding: '0.5rem', textAlign: 'right' }}>Total Weight:</td>
              <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--color-primary)' }}>
                {items?.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0).toFixed(2)} kg
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </ModalWrapper>
  );
}

function DYRRDetailModal({ data, yarnCounts, locations, onClose }) {
  const { receipt, items } = data;
  const formatYarn = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    return y ? `${y.count_value} ${y.material} ${y.product_type || ''}`.trim() : 'Unknown';
  };
  const formatLocation = (id) => {
    const l = locations.find(loc => loc.id === id);
    return l ? l.location_name : '-';
  };

  return (
    <ModalWrapper title={`Dyed Yarn Receipt: ${receipt.dyrr_number}`} onClose={onClose}>
      <div style={{ border: '2px solid #16a34a', padding: '1.5rem', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #16a34a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, color: '#16a34a', fontWeight: '900', fontSize: '1.25rem' }}>DYED RECEIPT</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>Dyed Yarn Receipt</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>#{receipt.dyrr_number}</div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>Date: {new Date(receipt.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
          <div>
            <p style={{ margin: '0.2rem 0' }}><strong>DC Number:</strong> {receipt.dc_number || '-'}</p>
            <p style={{ margin: '0.2rem 0' }}><strong>Received By:</strong> {receipt.received_by}</p>
          </div>
          <div>
            <p style={{ margin: '0.2rem 0' }}><strong>Vehicle No:</strong> {receipt.vehicle_no || '-'}</p>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#16a34a', color: '#fff' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Yarn Count</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Colour</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Lot Number</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Location</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Qty (kg)</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem', fontWeight: '600' }}>{formatYarn(item.yarn_count_id)}</td>
                <td style={{ padding: '0.5rem' }}>{item.colour}</td>
                <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{item.yarn_type || 'warp'}</td>
                <td style={{ padding: '0.5rem' }}>{item.lot_number || '-'}</td>
                <td style={{ padding: '0.5rem' }}>{formatLocation(item.location_id)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{parseFloat(item.quantity_kg).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f8fafc', fontWeight: '800' }}>
              <td colSpan="5" style={{ padding: '0.5rem', textAlign: 'right' }}>Total Weight:</td>
              <td style={{ padding: '0.5rem', textAlign: 'right', color: '#16a34a' }}>
                {items?.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0).toFixed(2)} kg
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </ModalWrapper>
  );
}

// Styles
const subThStyle = { padding: '0.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#475569' };
const subNumericThStyle = { padding: '0.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', color: '#475569' };

// Main Component
export default function DyeingFormsList() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('list');
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    approvalStatus: 'all',
    yarnStatus: 'all',
    dofNo: '',
    orderNo: '',
    unit: 'all'
  });

  // Expansions & Sub-data states
  const [expandedDofId, setExpandedDofId] = useState(null);
  const [expandedFinanceDofId, setExpandedFinanceDofId] = useState(null);
  const [allDyrrs, setAllDyrrs] = useState([]);
  const [allGydrs, setAllGydrs] = useState([]);
  const [allGydrItems, setAllGydrItems] = useState([]);
  const [allDyrrItems, setAllDyrrItems] = useState([]);
  const [allReturns, setAllReturns] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [locations, setLocations] = useState([]);

  // Modals state
  const [activeGydrDetail, setActiveGydrDetail] = useState(null);
  const [activeDyrrDetail, setActiveDyrrDetail] = useState(null);
  const [submittingDof, setSubmittingDof] = useState(null);
  const [billNo, setBillNo] = useState('');
  const [inputPrices, setInputPrices] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const basePath = profile?.role === 'admin' ? '/admin' : '/merchandiser';

  useEffect(() => {
    fetchForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchForms = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('dyeing_order_forms')
        .select(`
          *,
          dyeing_unit:master_partners(partner_name),
          creator:profiles!dyeing_order_forms_created_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (profile?.role === 'merchandiser') {
        query = query.eq('created_by', profile.id);
      }

      const [formsRes, receiptsRes, gydrsRes, gydrItemsRes, dyrrItemsRes, returnsRes, yarnRes, locRes] = await Promise.all([
        query,
        supabase
          .from('dyed_yarn_receipts')
          .select('id, dof_id, dof_number, received_date, dyrr_number, dc_number, vehicle_no, received_by, created_at'),
        supabase
          .from('greige_yarn_delivery_receipts')
          .select('id, dof_id, dof_number, gydr_number, delivered_by, vehicle_no, remarks, created_at'),
        supabase
          .from('greige_yarn_delivery_items')
          .select('*, receipt:greige_yarn_delivery_receipts(*)'),
        supabase
          .from('dyed_yarn_receipt_items')
          .select('*, receipt:dyed_yarn_receipts(*)'),
        supabase
          .from('greige_yarn_receipts')
          .select('*')
          .eq('receipt_type', 'production'),
        supabase
          .from('master_yarn_counts')
          .select('*'),
        supabase
          .from('master_locations')
          .select('*')
      ]);

      if (formsRes.error) throw formsRes.error;
      const rawForms = formsRes.data || [];
      const receipts = receiptsRes.data || [];

      // For each form, compute max received date and load linked orders
      const formsWithOrders = await Promise.all(rawForms.map(async (form) => {
        const formReceipts = receipts.filter(r => r.dof_id === form.id || (r.dof_number && r.dof_number === form.dof_number));
        const maxReceivedDate = formReceipts.reduce((max, r) => {
          return (!max || r.received_date > max) ? r.received_date : max;
        }, null);

        let orders = [];
        if (form.order_ids && form.order_ids.length > 0) {
          const { data: oData } = await supabase
            .from('orders')
            .select('id, order_number, design_no, design_name, technical_specs')
            .in('id', form.order_ids);
          orders = oData || [];
        }

        return { 
          ...form, 
          orders, 
          maxReceivedDate 
        };
      }));

      setForms(formsWithOrders);
      setAllDyrrs(receipts);
      setAllGydrs(gydrsRes.data || []);
      setAllGydrItems(gydrItemsRes.data || []);
      setAllDyrrItems(dyrrItemsRes.data || []);
      setAllReturns(returnsRes.data || []);
      setYarnCounts(yarnRes.data || []);
      setLocations(locRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDof = async (id, dofNumber) => {
    const confirmed = window.confirm(`Are you sure you want to delete Dyeing Order Form ${dofNumber}? This will release the allocated colors.`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('dyeing_order_forms')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert(`Dyeing Order Form ${dofNumber} deleted successfully.`);
      fetchForms();
    } catch (err) {
      console.error('Error deleting DOF:', err);
      alert('Error deleting Dyeing Order Form: ' + err.message);
    }
  };

  const getApprovalStatus = (status) => {
    if (status === 'pending') return 'pending';
    if (status === 'rejected') return 'rejected';
    return 'approved';
  };

  const getApprovalStatusBadge = (status) => {
    const approval = getApprovalStatus(status);
    switch (approval) {
      case 'pending':  return { bg: '#fef3c7', text: '#92400e', icon: <Clock size={12} />, label: 'PENDING' };
      case 'approved': return { bg: '#dcfce7', text: '#166534', icon: <CheckCircle size={12} />, label: 'APPROVED' };
      case 'rejected': return { bg: '#fee2e2', text: '#991b1b', icon: <XCircle size={12} />, label: 'REJECTED' };
      default:         return { bg: '#f1f5f9', text: '#475569', icon: null, label: approval.toUpperCase() };
    }
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

  const getYarnStatusBadge = (status) => {
    const yarn = getYarnStatus(status);
    switch (yarn) {
      case 'greige_not_sent':       return { bg: '#f1f5f9', text: '#475569', icon: null, label: 'GREIGE NOT SENT' };
      case 'greige_partially_sent': return { bg: '#fef3c7', text: '#92400e', icon: <Clock size={12} />, label: 'GREIGE PARTIALLY SENT' };
      case 'greige_sent':           return { bg: '#dbeafe', text: '#1e40af', icon: <CheckCircle size={12} />, label: 'GREIGE SENT' };
      case 'partially_received':    return { bg: '#e0f2fe', text: '#0369a1', icon: <Clock size={12} />, label: 'PARTIALLY RECEIVED' };
      case 'fully_received':        return { bg: '#dcfce7', text: '#166534', icon: <CheckCircle size={12} />, label: 'FULLY RECEIVED' };
      default:                      return { bg: '#f1f5f9', text: '#475569', icon: null, label: yarn.toUpperCase().replace(/_/g, ' ') };
    }
  };

  const getFinanceStatusBadge = (status) => {
    switch (status) {
      case 'awaiting_approval':
        return { bg: '#fef3c7', text: '#92400e', icon: <Clock size={12} />, label: 'AWAITING APPROVAL' };
      case 'approved':
        return { bg: '#dbeafe', text: '#1e40af', icon: <CheckCircle size={12} />, label: 'APPROVED' };
      case 'settled':
        return { bg: '#dcfce7', text: '#166534', icon: <CheckCircle size={12} />, label: 'SETTLED' };
      default:
        return { bg: '#f1f5f9', text: '#475569', icon: <Clock size={12} />, label: 'PENDING' };
    }
  };

  const getTotalQty = (allocations) => {
    if (!allocations || !Array.isArray(allocations)) return '0.00';
    return allocations.reduce((s, a) => s + parseFloat(a.total_kg || 0), 0).toFixed(2);
  };

  const openGydrModal = async (gydr) => {
    try {
      const { data: items } = await supabase
        .from('greige_yarn_delivery_items')
        .select('*')
        .eq('receipt_id', gydr.id);
      setActiveGydrDetail({ receipt: gydr, items: items || [] });
    } catch (err) {
      console.error(err);
      alert('Error fetching delivery details');
    }
  };

  const openDyrrModal = async (dyrr) => {
    try {
      const { data: items } = await supabase
        .from('dyed_yarn_receipt_items')
        .select('*')
        .eq('receipt_id', dyrr.id);
      setActiveDyrrDetail({ receipt: dyrr, items: items || [] });
    } catch (err) {
      console.error(err);
      alert('Error fetching dyed receipt details');
    }
  };

  // Group allocations for the Submit for Finance Approval Modal
  const financeSummary = useMemo(() => {
    if (!submittingDof) return [];
    
    const groups = {};
    
    (submittingDof.yarn_allocations || []).forEach(alloc => {
      const key = `${alloc.colour}_${alloc.countId}`;
      if (!groups[key]) {
        const y = yarnCounts.find(c => c.id === alloc.countId);
        const countLabel = y ? `${y.count_value} ${y.material} ${y.product_type || ''}`.trim() : 'Unknown';
        
        groups[key] = {
          key,
          colour: alloc.colour,
          countId: alloc.countId,
          countLabel,
          allottedQty: 0,
          sentQty: 0,
          recQty: 0
        };
      }
      
      groups[key].allottedQty += parseFloat(alloc.total_kg || 0);
      
      // Calculate raw sent delivery weight
      const rawSentValue = allGydrItems
        .filter(item => item.receipt?.dof_id === submittingDof.id && 
          item.yarn_count_id === alloc.countId && 
          item.colour === alloc.colour && 
          (item.yarn_type || 'warp') === (alloc.type || 'warp') &&
          (item.order_id === alloc.orderId || !item.order_id)
        )
        .reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);

      // Calculate returns to subtract
      const returnedValue = allReturns
        .filter(item => item.order_form_no === submittingDof.dof_number &&
          item.yarn_count_id === alloc.countId &&
          item.colour === alloc.colour &&
          (item.yarn_type || 'warp') === (alloc.type || 'warp') &&
          (item.order_id === alloc.orderId || !item.order_id)
        )
        .reduce((sum, item) => sum + parseFloat(item.total_weight || 0), 0);

      const sentValue = Math.max(0, rawSentValue - returnedValue);
      
      // Calculate received weight
      const recValue = allDyrrItems
        .filter(item => item.receipt?.dof_id === submittingDof.id && 
          item.yarn_count_id === alloc.countId && 
          item.colour === alloc.colour && 
          (item.yarn_type || 'warp') === (alloc.type || 'warp') &&
          (item.order_id === alloc.orderId || !item.order_id)
        )
        .reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);

      groups[key].sentQty += sentValue;
      groups[key].recQty += recValue;
    });
    
    return Object.values(groups);
  }, [submittingDof, allGydrItems, allDyrrItems, allReturns, yarnCounts]);

  // Sync modal price inputs when modal opens
  useEffect(() => {
    if (submittingDof) {
      const initial = {};
      financeSummary.forEach(item => {
        initial[item.key] = submittingDof.finance_prices?.[item.key] || '';
      });
      setInputPrices(initial);
      setBillNo(submittingDof.finance_bill_no || '');
    }
  }, [submittingDof, financeSummary]);

  // Handle finance approval submission
  const handleSubmitFinanceApproval = async () => {
    if (!billNo.trim()) {
      alert('Please enter the bill number from the dyeing unit.');
      return;
    }

    for (const item of financeSummary) {
      const price = parseFloat(inputPrices[item.key]);
      if (isNaN(price) || price <= 0) {
        alert(`Please enter a valid price/kg for ${item.colour} (${item.countLabel})`);
        return;
      }
    }

    setSubmitting(true);
    try {
      let totalDofPrice = 0;
      const parsedPrices = {};
      
      financeSummary.forEach(item => {
        const price = parseFloat(inputPrices[item.key]) || 0;
        parsedPrices[item.key] = price;
        totalDofPrice += price * item.sentQty;
      });

      const { error } = await supabase
        .from('dyeing_order_forms')
        .update({
          finance_status: 'awaiting_approval',
          finance_bill_no: billNo.trim(),
          finance_prices: parsedPrices,
          finance_total_price: totalDofPrice,
          finance_submitted_at: new Date().toISOString(),
          finance_submitted_by: profile.id
        })
        .eq('id', submittingDof.id);

      if (error) throw error;

      alert(`✅ Dyeing Order Form submitted for finance approval!\nDOF No: ${submittingDof.dof_number}\nBill No: ${billNo}\nTotal Price: ₹${totalDofPrice.toFixed(2)}`);
      setSubmittingDof(null);
      fetchForms();
    } catch (err) {
      console.error(err);
      alert('Error submitting for finance approval: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  function AllocationTable({ allocations, form, showShortage = false }) {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginTop: '0.25rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <th style={subThStyle}>Yarn Count</th>
            <th style={subThStyle}>Colour</th>
            <th style={subNumericThStyle}>Allotted Qty (kg)</th>
            <th style={subNumericThStyle}>Sent Qty (kg)</th>
            <th style={subNumericThStyle}>Rec Qty (kg)</th>
            {showShortage ? (
              <th style={subNumericThStyle}>Shortage %</th>
            ) : (
              <th style={subNumericThStyle}>Balance to Rec. (kg)</th>
            )}
          </tr>
        </thead>
        <tbody>
          {allocations.map((alloc, idx) => {
            const formatCount = (id) => {
              const y = yarnCounts.find(c => c.id === id);
              return y ? `${y.count_value} ${y.material} ${y.product_type || ''}`.trim() : '-';
            };

            // Calculate raw sent delivery weight
            const rawSentValue = allGydrItems
              .filter(item => item.receipt && (item.receipt.dof_id === form.id || (item.receipt.dof_number && item.receipt.dof_number === form.dof_number)) && 
                item.yarn_count_id === alloc.countId && 
                item.colour === alloc.colour && 
                (item.yarn_type || 'warp') === (alloc.type || 'warp') &&
                (item.order_id === alloc.orderId || !item.order_id)
              )
              .reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);

            // Calculate returns to subtract
            const returnedValue = allReturns
              .filter(item => item.order_form_no === form.dof_number &&
                item.yarn_count_id === alloc.countId &&
                item.colour === alloc.colour &&
                (item.yarn_type || 'warp') === (alloc.type || 'warp') &&
                (item.order_id === alloc.orderId || !item.order_id)
              )
              .reduce((sum, item) => sum + parseFloat(item.total_weight || 0), 0);

            const sentValue = Math.max(0, rawSentValue - returnedValue);

            // Calculate received weight
            const recValue = allDyrrItems
              .filter(item => item.receipt && (item.receipt.dof_id === form.id || (item.receipt.dof_number && item.receipt.dof_number === form.dof_number)) && 
                item.yarn_count_id === alloc.countId && 
                item.colour === alloc.colour && 
                (item.yarn_type || 'warp') === (alloc.type || 'warp') &&
                (item.order_id === alloc.orderId || !item.order_id)
              )
              .reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);

            const balance = Math.max(0, sentValue - recValue);
            const shortagePct = sentValue > 0 ? ((sentValue - recValue) / sentValue) * 100 : 0;

            return (
              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.5rem', fontWeight: '500' }}>{formatCount(alloc.countId)}</td>
                <td style={{ padding: '0.5rem', color: 'var(--color-primary)', fontWeight: '700' }}>{alloc.colour}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>{parseFloat(alloc.total_kg || 0).toFixed(2)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: '#4f46e5' }}>{sentValue.toFixed(2)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: '#16a34a' }}>{recValue.toFixed(2)}</td>
                {showShortage ? (
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: shortagePct > 0 ? '#dc2626' : '#16a34a' }}>
                    {shortagePct.toFixed(2)}%
                  </td>
                ) : (
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: balance > 0.01 ? '#dc2626' : '#16a34a' }}>
                    {balance.toFixed(2)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 'bold' }}>Dyeing Order Forms</h1>
          <p style={{ color: 'var(--text-muted-current)', margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
            Manage, track, and approve dyeing order forms
          </p>
        </div>
        <button
          onClick={() => navigate(`${basePath}/create-dyeing-form`)}
          className="btn btn-primary"
          style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontWeight: 'bold' }}
        >
          <Plus size={18} /> + New Dyeing Order Form
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--border-current)', marginBottom: '1.5rem' }}>
        {[
          { key: 'list', label: '📋 Order Forms' },
          { key: 'finance', label: '💵 Finance approval' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setExpandedDofId(null);
              setExpandedFinanceDofId(null);
            }}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--text-muted-current)',
              fontWeight: activeTab === tab.key ? '700' : '500',
              fontSize: '0.9rem',
              cursor: 'pointer',
              marginBottom: '-2px',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'list' && (
        <>
          {/* Advanced Collapsible Filter Bar */}
          <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', border: '1px solid var(--border-current)' }}>
            <div 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--color-primary)', fontWeight: '700' }}>
                <Filter size={18} />
                <span>Search & Filters</span>
                {(searchFilters.approvalStatus !== 'all' || searchFilters.yarnStatus !== 'all' || searchFilters.dofNo || searchFilters.orderNo || searchFilters.unit !== 'all') && (
                  <span style={{ backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px' }}>
                    Active
                  </span>
                )}
              </div>
              {isFilterOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>

            {isFilterOpen && (
              <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', borderTop: '1px solid var(--border-current)', paddingTop: '1.25rem' }}>
                {/* Approval Status Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Approval Status</label>
                  <select 
                    value={searchFilters.approvalStatus}
                    onChange={(e) => setSearchFilters({ ...searchFilters, approvalStatus: e.target.value })}
                    className="input"
                    style={{ padding: '0.5rem' }}
                  >
                    <option value="all">All Approval Statuses</option>
                    <option value="pending">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                {/* Yarn Status Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Yarn Status</label>
                  <select 
                    value={searchFilters.yarnStatus}
                    onChange={(e) => setSearchFilters({ ...searchFilters, yarnStatus: e.target.value })}
                    className="input"
                    style={{ padding: '0.5rem' }}
                  >
                    <option value="all">All Yarn Statuses</option>
                    <option value="greige_not_sent">Greige Not Sent</option>
                    <option value="greige_partially_sent">Greige Partially Sent</option>
                    <option value="greige_sent">Greige Sent</option>
                    <option value="partially_received">Partially Received</option>
                    <option value="fully_received">Fully Received</option>
                  </select>
                </div>

                {/* DOF Number Search */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>DOF Number</label>
                  <input 
                    type="text"
                    placeholder="Ex: DOF-001..."
                    value={searchFilters.dofNo}
                    onChange={(e) => setSearchFilters({ ...searchFilters, dofNo: e.target.value })}
                    className="input"
                    style={{ padding: '0.5rem' }}
                  />
                </div>

                {/* Order Number Search */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Order Number</label>
                  <input 
                    type="text"
                    placeholder="Search linked orders..."
                    value={searchFilters.orderNo}
                    onChange={(e) => setSearchFilters({ ...searchFilters, orderNo: e.target.value })}
                    className="input"
                    style={{ padding: '0.5rem' }}
                  />
                </div>

                {/* Dyeing Unit Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Dyeing Unit</label>
                  <select 
                    value={searchFilters.unit}
                    onChange={(e) => setSearchFilters({ ...searchFilters, unit: e.target.value })}
                    className="input"
                    style={{ padding: '0.5rem' }}
                  >
                    <option value="all">All Units</option>
                    {[...new Set(forms.map(f => f.dyeing_unit?.partner_name).filter(Boolean))].map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                {/* Clear Button */}
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button 
                    onClick={() => setSearchFilters({ approvalStatus: 'all', yarnStatus: 'all', dofNo: '', orderNo: '', unit: 'all' })}
                    style={{ width: '100%', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}
                  >
                    <X size={14} /> Clear All Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="glass-panel" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '4rem' }}>
                <Loader size={32} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: '1rem', color: 'var(--text-muted-current)' }}>Loading dyeing forms...</p>
              </div>
            ) : forms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted-current)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎨</div>
                <h3>No Dyeing Order Forms Found</h3>
                <p>Create your first DOF using the button above.</p>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th>DOF Number</th>
                      <th>Dyeing Unit</th>
                      <th>Delivery Date</th>
                      <th>Order Number(s)</th>
                      <th style={{ textAlign: 'right' }}>Total Qty (kg)</th>
                      <th>Approval Status</th>
                      <th>Yarn Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = forms.filter(f => {
                        const appStatus = getApprovalStatus(f.status);
                        const yStatus = getYarnStatus(f.status);
                        const matchApproval = searchFilters.approvalStatus === 'all' || appStatus === searchFilters.approvalStatus;
                        const matchYarn = searchFilters.yarnStatus === 'all' || yStatus === searchFilters.yarnStatus;
                        const matchDof = !searchFilters.dofNo || f.dof_number?.toLowerCase().includes(searchFilters.dofNo.toLowerCase());
                        const matchUnit = searchFilters.unit === 'all' || f.dyeing_unit?.partner_name === searchFilters.unit;
                        const matchOrder = !searchFilters.orderNo || f.orders?.some(o => o.order_number?.toLowerCase().includes(searchFilters.orderNo.toLowerCase()));
                        return matchApproval && matchYarn && matchDof && matchUnit && matchOrder;
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                              No Dyeing Order Forms match your search criteria.
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map(form => {
                        const approvalBadge = getApprovalStatusBadge(form.status);
                        const yarnBadge = getYarnStatusBadge(form.status);
                        const isExpanded = expandedDofId === form.id;
                        
                        return (
                          <React.Fragment key={form.id}>
                            <tr className="fade-in" style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-current)' }}>
                              <td>
                                <button
                                  onClick={() => setExpandedDofId(isExpanded ? null : form.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                                >
                                  <ChevronDown size={18} style={{ 
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                                    transition: 'transform 0.2s',
                                    color: 'var(--color-primary)'
                                  }} />
                                </button>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '0.9rem' }}>
                                    {form.dof_number}
                                  </span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                    Created: {new Date(form.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </td>
                              <td style={{ fontWeight: '600' }}>
                                {form.dyeing_unit?.partner_name || <span style={{ color: 'var(--text-muted-current)' }}>Not set</span>}
                              </td>
                              <td>
                                {(() => {
                                  if (!form.expected_delivery_date) {
                                    return <span style={{ color: 'var(--text-muted-current)', fontSize: '0.8125rem' }}>Not set</span>;
                                  }
                                  const alertInfo = getDofAlertInfo(form, allDyrrs);
                                  const dateStr = new Date(form.expected_delivery_date).toLocaleDateString();

                                  if (alertInfo) {
                                    return (
                                      <div style={{ 
                                        display: 'inline-flex', 
                                        flexDirection: 'column', 
                                        gap: '0.25rem', 
                                        alignItems: 'flex-start',
                                        padding: '0.25rem 0.5rem',
                                        backgroundColor: alertInfo.bgColor,
                                        border: `1px solid ${alertInfo.borderColor}`,
                                        borderRadius: '6px'
                                      }}>
                                        <span style={{ fontSize: '0.8125rem', fontWeight: '700', color: alertInfo.color }}>{dateStr}</span>
                                        <span style={{
                                          fontSize: '0.65rem',
                                          fontWeight: '800',
                                          textTransform: 'uppercase',
                                          color: alertInfo.color,
                                          opacity: 0.95
                                        }}>
                                          {alertInfo.label}
                                        </span>
                                      </div>
                                    );
                                  }

                                  return <span style={{ fontSize: '0.8125rem', fontWeight: '500' }}>{dateStr}</span>;
                                })()}
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  {form.orders?.map(o => (
                                    <span key={o.id} style={{ fontWeight: '600', color: 'var(--color-primary)', fontSize: '0.8125rem' }}>
                                      {o.order_number}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                {getTotalQty(form.yarn_allocations)} kg
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    backgroundColor: approvalBadge.bg, color: approvalBadge.text,
                                    padding: '3px 8px', borderRadius: '4px',
                                    fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap'
                                  }}>
                                    {approvalBadge.icon} {approvalBadge.label}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    backgroundColor: yarnBadge.bg, color: yarnBadge.text,
                                    padding: '3px 8px', borderRadius: '4px',
                                    fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap'
                                  }}>
                                    {yarnBadge.icon} {yarnBadge.label}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                  <button
                                    onClick={() => navigate(`${basePath}/dyeing-forms/${form.id}`, { state: { from: `${basePath}/dyeing-forms` } })}
                                    style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                  >
                                    <Eye size={12} /> View
                                  </button>
                                  {form.status === 'pending' && (
                                    <button
                                      onClick={() => handleDeleteDof(form.id, form.dof_number)}
                                      style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                    >
                                      <Trash2 size={12} /> Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr>
                                <td colSpan={9} style={{ backgroundColor: '#fcfcfd', padding: '1.5rem', borderBottom: '2px solid var(--border-current)' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    
                                    {/* Order allocations grouped by order */}
                                    <div>
                                      <h4 style={{ margin: '0 0 1rem 0', color: 'var(--color-primary)', fontWeight: '800', fontSize: '0.95rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                                        Order Allocation Details
                                      </h4>
                                      
                                      {form.orders?.map(order => {
                                        const warpAllocations = (form.yarn_allocations || [])
                                          .filter(a => a.orderId === order.id && (a.type || 'warp') === 'warp');
                                        const weftAllocations = (form.yarn_allocations || [])
                                          .filter(a => a.orderId === order.id && a.type === 'weft');

                                        return (
                                          <div key={order.id} style={{ marginBottom: '1.5rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                            <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '700', fontSize: '0.85rem', color: '#334155' }}>
                                              ORDER: {order.order_number} {order.design_no && `· ${order.design_no} / ${order.design_name}`}
                                            </div>
                                            
                                            <div style={{ padding: '1rem' }}>
                                              {warpAllocations.length > 0 && (
                                                <div style={{ marginBottom: '1.25rem' }}>
                                                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#7f1d1d', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Warp Details</h5>
                                                  <AllocationTable allocations={warpAllocations} form={form} />
                                                </div>
                                              )}
                                              
                                              {weftAllocations.length > 0 && (
                                                <div>
                                                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#0d9488', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weft Details</h5>
                                                  <AllocationTable allocations={weftAllocations} form={form} />
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* GYDR and DYRR Associated sections */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                      
                                      {/* GYDR List */}
                                      <div>
                                        <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                                          Greige Yarn Delivery Receipts (GYDR)
                                        </h5>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                          {allGydrs.filter(g => g.dof_id === form.id || (g.dof_number && g.dof_number === form.dof_number)).length === 0 ? (
                                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '0.75rem', border: '1px dashed #e2e8f0', borderRadius: '6px', backgroundColor: '#fff', textAlign: 'center' }}>
                                              No deliveries found.
                                            </div>
                                          ) : (
                                            allGydrs.filter(g => g.dof_id === form.id || (g.dof_number && g.dof_number === form.dof_number)).map(g => (
                                              <div 
                                                key={g.id} 
                                                onClick={() => openGydrModal(g)}
                                                style={{ 
                                                  padding: '0.75rem', 
                                                  backgroundColor: '#fff', 
                                                  border: '1px solid #e2e8f0', 
                                                  borderRadius: '6px', 
                                                  display: 'flex', 
                                                  justifyContent: 'space-between', 
                                                  alignItems: 'center', 
                                                  cursor: 'pointer',
                                                  transition: 'all 0.15s ease'
                                                }}
                                                className="hover-bg-slate"
                                              >
                                                <div>
                                                  <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--color-primary)' }}>{g.gydr_number}</div>
                                                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{new Date(g.created_at).toLocaleDateString()}</div>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '500' }}>
                                                  By: <strong>{g.delivered_by}</strong>
                                                </div>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>

                                      {/* DYRR List */}
                                      <div>
                                        <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                                          Dyed Yarn Received Receipts (DYRR)
                                        </h5>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                          {allDyrrs.filter(d => d.dof_id === form.id || (d.dof_number && d.dof_number === form.dof_number)).length === 0 ? (
                                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '0.75rem', border: '1px dashed #e2e8f0', borderRadius: '6px', backgroundColor: '#fff', textAlign: 'center' }}>
                                              No receipts found.
                                            </div>
                                          ) : (
                                            allDyrrs.filter(d => d.dof_id === form.id || (d.dof_number && d.dof_number === form.dof_number)).map(d => (
                                              <div 
                                                key={d.id} 
                                                onClick={() => openDyrrModal(d)}
                                                style={{ 
                                                  padding: '0.75rem', 
                                                  backgroundColor: '#fff', 
                                                  border: '1px solid #e2e8f0', 
                                                  borderRadius: '6px', 
                                                  display: 'flex', 
                                                  justifyContent: 'space-between', 
                                                  alignItems: 'center', 
                                                  cursor: 'pointer',
                                                  transition: 'all 0.15s ease'
                                                }}
                                                className="hover-bg-slate"
                                              >
                                                <div>
                                                  <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--color-primary)' }}>{d.dyrr_number}</div>
                                                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{new Date(d.created_at).toLocaleDateString()}</div>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '500' }}>
                                                  DC: <strong>{d.dc_number || 'N/A'}</strong>
                                                </div>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>

                                    </div>

                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'finance' && (
        <div className="glass-panel" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <Loader size={32} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '1rem', color: 'var(--text-muted-current)' }}>Loading received forms...</p>
            </div>
          ) : forms.filter(f => getYarnStatus(f.status) === 'fully_received').length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted-current)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💵</div>
              <h3>No Fully Received Dyeing Order Forms</h3>
              <p>Only fully received dyeing order forms are listed here for finance processing.</p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>DOF Number</th>
                    <th>Dyeing Unit</th>
                    <th>Delivery Dates (Planned / Actual)</th>
                    <th>Orders & Designs</th>
                    <th style={{ textAlign: 'right' }}>Total Qty (kg)</th>
                    <th>Finance Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {forms
                    .filter(f => getYarnStatus(f.status) === 'fully_received')
                    .map(form => {
                      const isExpanded = expandedFinanceDofId === form.id;
                      const plannedDateStr = form.expected_delivery_date ? new Date(form.expected_delivery_date).toLocaleDateString() : 'Not set';
                      const actualDateStr = form.maxReceivedDate ? new Date(form.maxReceivedDate).toLocaleDateString() : '-';
                      const inTime = form.maxReceivedDate && form.expected_delivery_date && form.maxReceivedDate <= form.expected_delivery_date;
                      
                      const financeBadge = getFinanceStatusBadge(form.finance_status);
                      
                      return (
                        <React.Fragment key={form.id}>
                          <tr className="fade-in" style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-current)' }}>
                            <td>
                              <button
                                onClick={() => setExpandedFinanceDofId(isExpanded ? null : form.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                              >
                                <ChevronDown size={18} style={{ 
                                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                                  transition: 'transform 0.2s',
                                  color: 'var(--color-primary)'
                                }} />
                              </button>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '0.9rem' }}>
                                  {form.dof_number}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                  Created: {new Date(form.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </td>
                            <td style={{ fontWeight: '600' }}>
                              {form.dyeing_unit?.partner_name || 'Not set'}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted-current)' }}>
                                  Planned: <strong>{plannedDateStr}</strong>
                                </span>
                                {form.maxReceivedDate ? (
                                  <span style={{
                                    alignSelf: 'flex-start',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: inTime ? '#dcfce7' : '#fee2e2',
                                    color: inTime ? '#166534' : '#991b1b',
                                    fontWeight: '700',
                                    fontSize: '0.75rem'
                                  }}>
                                    Actual: {actualDateStr}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>-</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {form.orders?.map(o => (
                                  <div key={o.id} style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
                                    <span style={{ fontWeight: '700', color: 'var(--color-primary)' }}>{o.order_number}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>
                                      {o.design_no} {o.design_name && `/ ${o.design_name}`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                              {getTotalQty(form.yarn_allocations)} kg
                            </td>
                            <td>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                backgroundColor: financeBadge.bg, color: financeBadge.text,
                                padding: '3px 8px', borderRadius: '4px',
                                fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap'
                              }}>
                                {financeBadge.icon} {financeBadge.label}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                <button
                                  onClick={() => navigate(`${basePath}/dyeing-forms/${form.id}`, { state: { from: `${basePath}/dyeing-forms` } })}
                                  style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                  <Eye size={12} /> View
                                </button>
                                {(!form.finance_status || form.finance_status === 'pending') && (
                                  <button
                                    onClick={() => setSubmittingDof(form)}
                                    className="btn btn-primary"
                                    style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                  >
                                    Submit Approval
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={8} style={{ backgroundColor: '#fcfcfd', padding: '1.5rem', borderBottom: '2px solid var(--border-current)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                  
                                  {/* Order allocations grouped by order */}
                                  <div>
                                    <h4 style={{ margin: '0 0 1rem 0', color: 'var(--color-primary)', fontWeight: '800', fontSize: '0.95rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                                      Order Allocation Details
                                    </h4>
                                    
                                    {form.orders?.map(order => {
                                      const warpAllocations = (form.yarn_allocations || [])
                                        .filter(a => a.orderId === order.id && (a.type || 'warp') === 'warp');
                                      const weftAllocations = (form.yarn_allocations || [])
                                        .filter(a => a.orderId === order.id && a.type === 'weft');

                                      return (
                                        <div key={order.id} style={{ marginBottom: '1.5rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '700', fontSize: '0.85rem', color: '#334155' }}>
                                            ORDER: {order.order_number} {order.design_no && `· ${order.design_no} / ${order.design_name}`}
                                          </div>
                                          
                                          <div style={{ padding: '1rem' }}>
                                            {warpAllocations.length > 0 && (
                                              <div style={{ marginBottom: '1.25rem' }}>
                                                <h5 style={{ margin: '0 0 0.5rem 0', color: '#7f1d1d', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Warp Details</h5>
                                                <AllocationTable allocations={warpAllocations} form={form} showShortage={true} />
                                              </div>
                                            )}
                                            
                                            {weftAllocations.length > 0 && (
                                              <div>
                                                <h5 style={{ margin: '0 0 0.5rem 0', color: '#0d9488', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weft Details</h5>
                                                <AllocationTable allocations={weftAllocations} form={form} showShortage={true} />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* GYDR and DYRR Associated sections */}
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                    
                                    {/* GYDR List */}
                                    <div>
                                      <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                                        Greige Yarn Delivery Receipts (GYDR)
                                      </h5>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {allGydrs.filter(g => g.dof_id === form.id || (g.dof_number && g.dof_number === form.dof_number)).length === 0 ? (
                                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '0.75rem', border: '1px dashed #e2e8f0', borderRadius: '6px', backgroundColor: '#fff', textAlign: 'center' }}>
                                            No deliveries found.
                                          </div>
                                        ) : (
                                          allGydrs.filter(g => g.dof_id === form.id || (g.dof_number && g.dof_number === form.dof_number)).map(g => (
                                            <div 
                                              key={g.id} 
                                              onClick={() => openGydrModal(g)}
                                              style={{ 
                                                padding: '0.75rem', 
                                                backgroundColor: '#fff', 
                                                border: '1px solid #e2e8f0', 
                                                borderRadius: '6px', 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center', 
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                              }}
                                              className="hover-bg-slate"
                                            >
                                              <div>
                                                <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--color-primary)' }}>{g.gydr_number}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{new Date(g.created_at).toLocaleDateString()}</div>
                                              </div>
                                              <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '500' }}>
                                                By: <strong>{g.delivered_by}</strong>
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>

                                    {/* DYRR List */}
                                    <div>
                                      <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                                        Dyed Yarn Received Receipts (DYRR)
                                      </h5>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {allDyrrs.filter(d => d.dof_id === form.id || (d.dof_number && d.dof_number === form.dof_number)).length === 0 ? (
                                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '0.75rem', border: '1px dashed #e2e8f0', borderRadius: '6px', backgroundColor: '#fff', textAlign: 'center' }}>
                                            No receipts found.
                                          </div>
                                        ) : (
                                          allDyrrs.filter(d => d.dof_id === form.id || (d.dof_number && d.dof_number === form.dof_number)).map(d => (
                                            <div 
                                              key={d.id} 
                                              onClick={() => openDyrrModal(d)}
                                              style={{ 
                                                padding: '0.75rem', 
                                                backgroundColor: '#fff', 
                                                border: '1px solid #e2e8f0', 
                                                borderRadius: '6px', 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center', 
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                              }}
                                              className="hover-bg-slate"
                                            >
                                              <div>
                                                <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--color-primary)' }}>{d.dyrr_number}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{new Date(d.created_at).toLocaleDateString()}</div>
                                              </div>
                                              <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '500' }}>
                                                DC: <strong>{d.dc_number || 'N/A'}</strong>
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>

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
      )}

      {/* Finance Submission Modal */}
      {submittingDof && (
        <ModalWrapper 
          title={`Submit for Finance Approval: ${submittingDof.dof_number}`} 
          onClose={() => setSubmittingDof(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '700', color: '#475569' }}>Yarn Count & Colour</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#475569' }}>Total Sent (kg)</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#475569' }}>Total Rec (kg)</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#475569' }}>Shortage (kg)</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '700', color: '#475569', width: '130px' }}>Price / kg (₹)</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#475569' }}>Total Price (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {financeSummary.map((item) => {
                    const shortageVal = Math.max(0, item.sentQty - item.recQty);
                    const rate = parseFloat(inputPrices[item.key]) || 0;
                    const rowTotal = rate * item.sentQty;
                    
                    return (
                      <tr key={item.key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '500' }}>
                          <div>{item.countLabel}</div>
                          <div style={{ color: 'var(--color-primary)', fontWeight: '700', fontSize: '0.75rem', marginTop: '2px' }}>
                            {item.colour}
                          </div>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>
                          {item.sentQty.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>
                          {item.recQty.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: shortageVal > 0.01 ? '#dc2626' : '#64748b', fontWeight: '600' }}>
                          {shortageVal.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.4rem 0.75rem', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Price"
                            value={inputPrices[item.key] ?? ''}
                            onChange={(e) => setInputPrices({ ...inputPrices, [item.key]: e.target.value })}
                            className="input-field"
                            style={{
                              width: '100%',
                              textAlign: 'right',
                              padding: '0.3rem 0.5rem',
                              fontSize: '0.8rem',
                              fontWeight: 'bold',
                              borderRadius: '4px',
                              border: '1px solid var(--border-current)'
                            }}
                          />
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '700', color: 'var(--color-primary)' }}>
                          ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Grand Total Row */}
                  <tr style={{ backgroundColor: '#f8fafc', fontWeight: '800', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan="5" style={{ padding: '0.75rem', textAlign: 'right' }}>Total DOF Price:</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--color-primary)', fontSize: '0.9rem' }}>
                      ₹{financeSummary.reduce((sum, item) => {
                        const rate = parseFloat(inputPrices[item.key]) || 0;
                        return sum + (rate * item.sentQty);
                      }, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bill No Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxWidth: '350px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main-current)' }}>
                Bill Number (from Dyeing Unit) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Enter bill / invoice no..."
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
                className="input-field"
                style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button 
                type="button" 
                onClick={() => setSubmittingDof(null)} 
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitFinanceApproval}
                disabled={submitting}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.5rem', fontWeight: '700' }}
              >
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* Detail Modals */}
      {activeGydrDetail && (
        <GYDRDetailModal
          data={activeGydrDetail}
          yarnCounts={yarnCounts}
          onClose={() => setActiveGydrDetail(null)}
        />
      )}
      {activeDyrrDetail && (
        <DYRRDetailModal
          data={activeDyrrDetail}
          yarnCounts={yarnCounts}
          locations={locations}
          onClose={() => setActiveDyrrDetail(null)}
        />
      )}
    </div>
  );
}
