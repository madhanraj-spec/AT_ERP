import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Loader, CheckCircle, Clock, XCircle, Eye, Filter, ChevronDown, ChevronUp, Search, X, ClipboardList, MoveHorizontal, Trash2, Receipt, Edit } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ReceiptPrintModal from '../GreigeYarn/ReceiptPrintModal';
import DyedReceiptPrintModal from '../DyedYarn/DyedReceiptPrintModal';
import GYDRPrintModal from '../GreigeYarn/GYDRPrintModal';


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
function ModalWrapper({ title, onClose, children, maxWidth = '800px' }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="fade-in" style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' }}>
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
  const [expandedBillId, setExpandedBillId] = useState(null);
  const [allDyrrs, setAllDyrrs] = useState([]);
  const [allGydrs, setAllGydrs] = useState([]);
  const [allGydrItems, setAllGydrItems] = useState([]);
  const [allDyrrItems, setAllDyrrItems] = useState([]);
  const [allReturns, setAllReturns] = useState([]);
  const [allRedyeingItems, setAllRedyeingItems] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [locations, setLocations] = useState([]);

  // Modals state
  const [activeGydrDetail, setActiveGydrDetail] = useState(null);
  const [activeDyrrDetail, setActiveDyrrDetail] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedGydr, setSelectedGydr] = useState(null);
  const [selectedDyrr, setSelectedDyrr] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // New DOF Billing States
  const [bills, setBills] = useState([]);
  const [raiseBillOpen, setRaiseBillOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [selectedDofSearch, setSelectedDofSearch] = useState('');
  const [dofDropdownOpen, setDofDropdownOpen] = useState(false);
  const [selectedDofsForBill, setSelectedDofsForBill] = useState([]);
  const [billInvoiceNo, setBillInvoiceNo] = useState('');
  const [billInvoiceDate, setBillInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [billTaxPercent, setBillTaxPercent] = useState(5);
  const [billRates, setBillRates] = useState({});
  const [viewingBillDetails, setViewingBillDetails] = useState(null);
  const [billStep, setBillStep] = useState(1);

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

      const [formsRes, receiptsRes, gydrsRes, gydrItemsRes, dyrrItemsRes, returnsRes, yarnRes, locRes, redyeRes, billsRes] = await Promise.all([
        query,
        supabase
          .from('dyed_yarn_receipts')
          .select('id, dof_id, dof_number, received_date, dyrr_number, dc_number, vehicle_no, received_by, created_at, source_type'),
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
          .select('*'),
        supabase
          .from('dyed_yarn_delivery_items')
          .select('*, delivery:dyed_yarn_deliveries(*)')
          .eq('process_type', 'redyeing'),
        supabase
          .from('dof_bills')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (formsRes.error) throw formsRes.error;
      const rawForms = formsRes.data || [];
      const receipts = (receiptsRes.data || []).filter(r => r.source_type !== 'production');

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
      setAllRedyeingItems(redyeRes.data || []);

      let billsData = [];
      if (billsRes && !billsRes.error) {
        billsData = billsRes.data || [];
      } else if (billsRes && billsRes.error) {
        console.warn('dof_bills table query error:', billsRes.error);
      }
      setBills(billsData);
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
    setSelectedGydr(gydr);
  };

  const openDyrrModal = async (dyrr) => {
    try {
      const { data: items, error } = await supabase
        .from('dyed_yarn_receipt_items')
        .select(`
          *,
          orders (*),
          master_yarn_counts (*),
          master_locations (*)
        `)
        .eq('receipt_id', dyrr.id);
      
      if (error) throw error;

      setSelectedDyrr({
        ...dyrr,
        items: items || []
      });
    } catch (err) {
      console.error(err);
      alert('Error fetching dyed receipt details');
    }
  };

  const openGyrrPrintModal = (gyrr) => {
    setSelectedReceipt(gyrr);
  };

  // Get received quantity for a specific allocation in a DOF
  const getDofAllocReceivedQty = (form, alloc) => {
    const rawRecValue = allDyrrItems
      .filter(item => item.receipt && (item.receipt.dof_id === form.id || (item.receipt.dof_number && item.receipt.dof_number === form.dof_number)) && 
        item.receipt.source_type !== 'production' &&
        item.yarn_count_id === alloc.countId && 
        item.colour === alloc.colour && 
        (item.yarn_type || 'warp') === (alloc.type || 'warp') &&
        (item.order_id === alloc.orderId || !item.order_id)
      )
      .reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);

    const redyeValue = allRedyeingItems
      .filter(item => item.delivery && (item.delivery.dof_id === form.id || (item.delivery.dof_number && item.delivery.dof_number === form.dof_number)) &&
        item.yarn_count_id === alloc.countId && 
        item.colour === alloc.colour && 
        (item.yarn_type || 'warp') === (alloc.type || 'warp') &&
        (item.order_id === alloc.orderId || !item.order_id)
      )
      .reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);

    return Math.max(0, rawRecValue - redyeValue);
  };

  // Aggregate count and total received weight by count & colour across DOFs
  const getAggregatedYarnSummary = (selectedDofs) => {
    const summary = {};
    selectedDofs.forEach(form => {
      (form.yarn_allocations || []).forEach(alloc => {
        const key = `${alloc.countId}_${alloc.colour}`;
        const recQty = getDofAllocReceivedQty(form, alloc);
        if (!summary[key]) {
          const y = yarnCounts.find(c => c.id === alloc.countId);
          const countLabel = y ? `${y.count_value} ${y.material} ${y.product_type || ''}`.trim() : 'Unknown';
          summary[key] = {
            key,
            countId: alloc.countId,
            countLabel,
            colour: alloc.colour,
            quantity_kg: 0
          };
        }
        summary[key].quantity_kg += recQty;
      });
    });
    return Object.values(summary);
  };

  // Calculate Indian financial year suffix e.g. "2627" for FY 2026-2027
  const getFinancialYearPrefix = (dateString) => {
    const d = new Date(dateString || new Date());
    const year = d.getFullYear();
    const month = d.getMonth();
    let startYear, endYear;
    if (month >= 3) {
      startYear = year;
      endYear = year + 1;
    } else {
      startYear = year - 1;
      endYear = year;
    }
    return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
  };

  // Status badge for bills
  const getBillStatusBadge = (status) => {
    switch (status) {
      case 'submitted':
        return { bg: '#fef3c7', text: '#92400e', label: 'SUBMITTED', icon: <Clock size={11} /> };
      case 'approved':
        return { bg: '#dcfce7', text: '#166534', label: 'BILL APPROVED', icon: <CheckCircle size={11} /> };
      case 'settled':
        return { bg: '#dbeafe', text: '#1e40af', label: 'SETTLED', icon: <CheckCircle size={11} /> };
      case 'rejected':
        return { bg: '#fee2e2', text: '#b91c1c', label: 'REJECTED', icon: <XCircle size={11} /> };
      case 'pending':
      default:
        return { bg: '#f1f5f9', text: '#475569', label: 'PENDING', icon: null };
    }
  };

  const handleAddDof = (dof) => {
    if (selectedDofsForBill.length > 0) {
      const firstDof = selectedDofsForBill[0];
      if (firstDof.dyeing_unit?.partner_name !== dof.dyeing_unit?.partner_name) {
        alert("You can only select DOFs from the same Dyeing Unit for a single bill.");
        return;
      }
    }
    setSelectedDofsForBill([...selectedDofsForBill, dof]);
    setSelectedDofSearch('');
  };

  const handleRemoveDof = (dofId) => {
    setSelectedDofsForBill(selectedDofsForBill.filter(f => f.id !== dofId));
  };

  const handleToggleDof = (dof) => {
    const isSelected = selectedDofsForBill.some(sd => sd.id === dof.id);
    if (isSelected) {
      handleRemoveDof(dof.id);
    } else {
      handleAddDof(dof);
    }
  };

  const handleEditBill = (bill) => {
    setEditingBill(bill);
    const linkedDofs = forms.filter(f => (bill.selected_dof_ids || []).includes(f.id));
    setSelectedDofsForBill(linkedDofs);
    setBillInvoiceNo(bill.invoice_number);
    setBillInvoiceDate(bill.invoice_date);
    setBillTaxPercent(bill.tax_percent);
    
    const rates = {};
    (bill.bill_items || []).forEach(item => {
      (item.yarn_details || []).forEach(detail => {
        const key = `${detail.count_id}_${detail.colour}`;
        rates[key] = detail.price_per_kg;
      });
    });
    setBillRates(rates);
    setBillStep(2);
    setRaiseBillOpen(true);
  };

  const handleDeleteBill = async (bill) => {
    if (!window.confirm(`Are you sure you want to delete Bill ${bill.bill_number}?`)) return;
    try {
      const { error: deleteErr } = await supabase
        .from('dof_bills')
        .delete()
        .eq('id', bill.id);
      if (deleteErr) throw deleteErr;

      // Update linked DOFs
      const { error: dofErr } = await supabase
        .from('dyeing_order_forms')
        .update({ bill_status: 'pending', bill_id: null })
        .in('id', bill.selected_dof_ids || []);
      if (dofErr) throw dofErr;

      alert(`✅ Bill ${bill.bill_number} deleted successfully.`);
      fetchForms();
    } catch (err) {
      console.error(err);
      alert('Error deleting bill: ' + err.message);
    }
  };

  const handleSaveBill = async () => {
    if (selectedDofsForBill.length === 0) {
      alert('Please select at least one Dyeing Order Form.');
      return;
    }
    if (!billInvoiceNo.trim()) {
      alert('Please enter the invoice number.');
      return;
    }
    if (!billInvoiceDate) {
      alert('Please select the invoice date.');
      return;
    }

    const aggregated = getAggregatedYarnSummary(selectedDofsForBill);
    for (const item of aggregated) {
      const rate = parseFloat(billRates[item.key]);
      if (isNaN(rate) || rate < 0) {
        alert(`Please enter a valid rate/kg for ${item.colour} (${item.countLabel})`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const firstDof = selectedDofsForBill[0];
      const partnerId = firstDof.dyeing_unit_id || null;
      const partnerName = firstDof.dyeing_unit?.partner_name || 'Unknown Dyeing Unit';

      let calculatedTotal = 0;
      aggregated.forEach(item => {
        const rate = parseFloat(billRates[item.key]) || 0;
        calculatedTotal += item.quantity_kg * rate;
      });

      const taxAmount = calculatedTotal * (parseFloat(billTaxPercent || 0) / 100);
      const billTotal = calculatedTotal + taxAmount;

      const billItems = selectedDofsForBill.map(form => {
        const orderNumbers = (form.orders || []).map(o => o.order_number);
        const designNames = (form.orders || []).map(o => o.design_name || '');
        const designNos = (form.orders || []).map(o => o.design_no || '');
        
        const yarnDetails = (form.yarn_allocations || []).map(alloc => {
          const y = yarnCounts.find(c => c.id === alloc.countId);
          const countLabel = y ? `${y.count_value} ${y.material} ${y.product_type || ''}`.trim() : 'Unknown';
          const qty = getDofAllocReceivedQty(form, alloc);
          const price = parseFloat(billRates[`${alloc.countId}_${alloc.colour}`]) || 0;
          return {
            count_id: alloc.countId,
            count_label: countLabel,
            colour: alloc.colour,
            quantity_kg: qty,
            price_per_kg: price,
            total_price: qty * price
          };
        });

        return {
          dof_id: form.id,
          dof_number: form.dof_number,
          order_numbers: orderNumbers,
          design_names: designNames,
          design_nos: designNos,
          yarn_details: yarnDetails
        };
      });

      let finalBillNumber = '';
      let billId = '';

      if (editingBill) {
        finalBillNumber = editingBill.bill_number;
        billId = editingBill.id;

        const { error: updateErr } = await supabase
          .from('dof_bills')
          .update({
            invoice_number: billInvoiceNo.trim(),
            invoice_date: billInvoiceDate,
            selected_dof_ids: selectedDofsForBill.map(f => f.id),
            bill_items: billItems,
            calculated_total: calculatedTotal,
            tax_percent: parseFloat(billTaxPercent || 0),
            tax_amount: taxAmount,
            bill_total: billTotal,
            status: 'submitted', // Reset to submitted on edit
            updated_at: new Date().toISOString()
          })
          .eq('id', billId);

        if (updateErr) throw updateErr;

        const oldDofIds = editingBill.selected_dof_ids || [];
        const newDofIds = selectedDofsForBill.map(f => f.id);
        const removedDofIds = oldDofIds.filter(id => !newDofIds.includes(id));
        const addedDofIds = newDofIds.filter(id => !oldDofIds.includes(id));

        if (removedDofIds.length > 0) {
          const { error: resetErr } = await supabase
            .from('dyeing_order_forms')
            .update({ bill_status: 'pending', bill_id: null })
            .in('id', removedDofIds);
          if (resetErr) throw resetErr;
        }

        if (addedDofIds.length > 0) {
          const { error: addErr } = await supabase
            .from('dyeing_order_forms')
            .update({ bill_status: 'submitted', bill_id: billId })
            .in('id', addedDofIds);
          if (addErr) throw addErr;
        }
      } else {
        const yearPrefix = getFinancialYearPrefix(billInvoiceDate);
        
        try {
          const { data: nextNum, error: rpcErr } = await supabase.rpc('get_next_dof_bill_number', { p_year_prefix: yearPrefix });
          if (rpcErr) throw rpcErr;
          finalBillNumber = nextNum;
        } catch (err) {
          console.warn('RPC get_next_dof_bill_number failed, generating client-side serial', err);
          const prefix = `AT/${yearPrefix}/DOF/B/`;
          const matchingBills = bills.filter(b => b.bill_number?.startsWith(prefix));
          const maxVal = matchingBills.reduce((max, b) => {
            const numPart = parseInt(b.bill_number.split('/').pop()) || 0;
            return numPart > max ? numPart : max;
          }, 0);
          finalBillNumber = `${prefix}${String(maxVal + 1).padStart(5, '0')}`;
        }

        const { data: inserted, error: insertErr } = await supabase
          .from('dof_bills')
          .insert([{
            bill_number: finalBillNumber,
            partner_id: partnerId,
            partner_name: partnerName,
            invoice_number: billInvoiceNo.trim(),
            invoice_date: billInvoiceDate,
            selected_dof_ids: selectedDofsForBill.map(f => f.id),
            bill_items: billItems,
            calculated_total: calculatedTotal,
            tax_percent: parseFloat(billTaxPercent || 0),
            tax_amount: taxAmount,
            bill_total: billTotal,
            status: 'submitted',
            submitted_by: profile.id
          }])
          .select()
          .single();

        if (insertErr) throw insertErr;
        billId = inserted.id;

        const { error: dofErr } = await supabase
          .from('dyeing_order_forms')
          .update({ bill_status: 'submitted', bill_id: billId })
          .in('id', selectedDofsForBill.map(f => f.id));
        if (dofErr) throw dofErr;
      }

      alert(`✅ Bill ${finalBillNumber} successfully saved!`);
      setRaiseBillOpen(false);
      setEditingBill(null);
      setSelectedDofsForBill([]);
      setBillInvoiceNo('');
      setBillRates({});
      fetchForms();
    } catch (err) {
      console.error(err);
      alert('Error saving bill: ' + err.message);
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

            // Calculate received weight (subtracting redyeing returns)
            const rawRecValue = allDyrrItems
              .filter(item => item.receipt && (item.receipt.dof_id === form.id || (item.receipt.dof_number && item.receipt.dof_number === form.dof_number)) && 
                item.yarn_count_id === alloc.countId && 
                item.colour === alloc.colour && 
                (item.yarn_type || 'warp') === (alloc.type || 'warp') &&
                (item.order_id === alloc.orderId || !item.order_id)
              )
              .reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);

            const redyeValue = allRedyeingItems
              .filter(item => item.delivery && (item.delivery.dof_id === form.id || (item.delivery.dof_number && item.delivery.dof_number === form.dof_number)) &&
                item.yarn_count_id === alloc.countId && 
                item.colour === alloc.colour && 
                (item.yarn_type || 'warp') === (alloc.type || 'warp') &&
                (item.order_id === alloc.orderId || !item.order_id)
              )
              .reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);

            const recValue = Math.max(0, rawRecValue - redyeValue);

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
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => {
              setSelectedDofsForBill([]);
              setBillInvoiceNo('');
              setBillRates({});
              setBillStep(1);
              setRaiseBillOpen(true);
            }}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontWeight: 'bold', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
          >
            Raise New Bill
          </button>
          <button
            onClick={() => navigate(`${basePath}/create-dyeing-form`)}
            className="btn btn-primary"
            style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontWeight: 'bold' }}
          >
            <Plus size={18} /> + New Dyeing Order Form
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--border-current)', marginBottom: '1.5rem' }}>
        {[
          { key: 'list', label: '📋 Order Forms' },
          { key: 'bills', label: '🧾 DOF Bills' },
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

                                      {/* GYRR List */}
                                      <div>
                                        <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                                          Greige Yarn Return Receipts (GYRR)
                                        </h5>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                          {(() => {
                                            const formReturns = allReturns.filter(r => r.order_form_no === form.dof_number);
                                            const uniqueReturns = [];
                                            const seenReceiptNos = new Set();
                                            formReturns.forEach(r => {
                                              if (!seenReceiptNos.has(r.receipt_no)) {
                                                seenReceiptNos.add(r.receipt_no);
                                                uniqueReturns.push(r);
                                              }
                                            });

                                            if (uniqueReturns.length === 0) {
                                              return (
                                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '0.75rem', border: '1px dashed #e2e8f0', borderRadius: '6px', backgroundColor: '#fff', textAlign: 'center' }}>
                                                  No return receipts found.
                                                </div>
                                              );
                                            }

                                            return uniqueReturns.map(r => (
                                              <div 
                                                key={r.id} 
                                                onClick={() => openGyrrPrintModal(r)}
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
                                                  <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--color-primary)' }}>{r.receipt_no}</div>
                                                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{new Date(r.created_at).toLocaleDateString()}</div>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '500' }}>
                                                  By: <strong>{r.received_by || 'N/A'}</strong>
                                                </div>
                                              </div>
                                            ));
                                          })()}
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

      {activeTab === 'bills' && (
        <div className="glass-panel" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <Loader size={32} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '1rem', color: 'var(--text-muted-current)' }}>Loading bills...</p>
            </div>
          ) : bills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted-current)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧾</div>
              <h3>No bills found</h3>
              <p>Create a bill using the "Raise New Bill" button above.</p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>Bill Number</th>
                    <th>Invoice Details</th>
                    <th>Dyeing Unit</th>
                    <th style={{ textAlign: 'right' }}>Calculated Pre-Tax</th>
                    <th style={{ textAlign: 'right' }}>Tax</th>
                    <th style={{ textAlign: 'right' }}>Total Bill Value</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map(bill => {
                    const isExpanded = expandedBillId === bill.id;
                    const statusBadge = getBillStatusBadge(bill.status);
                    
                    return (
                      <React.Fragment key={bill.id}>
                        <tr className="fade-in" style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-current)' }}>
                          <td>
                            <button
                              onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
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
                                {bill.bill_number}
                              </span>
                              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                Raised: {new Date(bill.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: '600' }}>No: {bill.invoice_number}</span>
                              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                Date: {new Date(bill.invoice_date).toLocaleDateString()}
                              </span>
                            </div>
                          </td>
                          <td style={{ fontWeight: '600' }}>
                            {bill.partner_name}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '500' }}>
                            ₹{bill.calculated_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                            ₹{bill.tax_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({bill.tax_percent}%)
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                            ₹{bill.bill_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              backgroundColor: statusBadge.bg, color: statusBadge.text,
                              padding: '3px 8px', borderRadius: '4px',
                              fontSize: '0.725rem', fontWeight: '700', whiteSpace: 'nowrap'
                            }}>
                              {statusBadge.icon} {statusBadge.label}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <button
                                onClick={() => setViewingBillDetails(bill)}
                                style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <Eye size={12} /> View Details
                              </button>
                              {(bill.status === 'submitted' || bill.status === 'rejected') && (
                                <>
                                  <button
                                    onClick={() => handleEditBill(bill)}
                                    style={{ backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                  >
                                    <Edit size={12} /> Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteBill(bill)}
                                    style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                  >
                                    <Trash2 size={12} /> Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} style={{ backgroundColor: '#fcfcfd', padding: '1.5rem', borderBottom: '2px solid var(--border-current)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '700', borderBottom: '1px solid #eee', paddingBottom: '0.5rem', color: '#475569' }}>
                                  Linked Dyeing Order Forms ({bill.selected_dof_ids?.length || 0})
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
                                  {(bill.bill_items || []).map((item, idx) => (
                                    <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff', padding: '0.85rem', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.875rem', color: 'var(--color-primary)', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem', marginBottom: '0.5rem' }}>
                                        <span>DOF: {item.dof_number}</span>
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '0.6rem' }}>
                                        <span><strong>Orders:</strong> {(item.order_numbers || []).join(', ')}</span>
                                        <span><strong>Designs:</strong> {(item.design_nos || []).map((n, i) => `${n} (${item.design_names[i] || 'N/A'})`).join(', ')}</span>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.4rem' }}>
                                        {(item.yarn_details || []).map((yd, yidx) => (
                                          <div key={yidx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', padding: '0.25rem 0', borderBottom: yidx < item.yarn_details.length - 1 ? '1px dotted #f1f5f9' : 'none' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                              <span style={{ fontWeight: '600', color: '#334155' }}>{yd.count_label}</span>
                                              <span style={{ fontSize: '0.675rem', color: '#64748b' }}>Color: <strong style={{ color: 'var(--color-primary)' }}>{yd.colour}</strong></span>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                              <div style={{ fontSize: '0.725rem', color: '#475569' }}>{yd.quantity_kg?.toFixed(2)} kg @ ₹{yd.price_per_kg?.toFixed(2)}/kg</div>
                                              <div style={{ fontWeight: '700', color: 'var(--color-primary)', fontSize: '0.8rem', marginTop: '1px' }}>₹{yd.total_price?.toFixed(2)}</div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
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

      {/* Raise / Edit Bill Modal */}
      {raiseBillOpen && (
        <ModalWrapper
          title={editingBill ? `Edit Bill: ${editingBill.bill_number}` : 'Raise New Bill for Dyeing Order Forms'}
          maxWidth="1200px"
          onClose={() => {
            setRaiseBillOpen(false);
            setEditingBill(null);
            setSelectedDofsForBill([]);
            setBillInvoiceNo('');
            setBillRates({});
            setBillStep(1);
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
            
            {/* Step Progress Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: billStep === 1 ? 'var(--color-primary)' : '#64748b', fontWeight: 'bold', fontSize: '0.875rem' }}>
                <span style={{ display: 'inline-flex', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: billStep === 1 ? 'var(--color-primary)' : '#e2e8f0', color: billStep === 1 ? '#fff' : '#64748b', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>1</span>
                Select Dyeing Order Forms
              </div>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: billStep === 2 ? 'var(--color-primary)' : '#64748b', fontWeight: 'bold', fontSize: '0.875rem' }}>
                <span style={{ display: 'inline-flex', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: billStep === 2 ? 'var(--color-primary)' : '#e2e8f0', color: billStep === 2 ? '#fff' : '#64748b', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>2</span>
                Set Rates & Invoice Details
              </div>
            </div>

            {/* STEP 1: SELECT DOFS */}
            {billStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-main-current)', display: 'block', marginBottom: '0.5rem' }}>
                    Search Fully Completed / Received DOFs (by DOF No., Order No., Design No. or Design Name)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-current)', borderRadius: '6px', padding: '0.25rem 0.75rem', backgroundColor: '#fff', marginBottom: '1rem' }}>
                    <Search size={16} style={{ color: '#64748b', marginRight: '0.5rem' }} />
                    <input
                      type="text"
                      placeholder="Type order number, design, partner or DOF number to filter list below..."
                      value={selectedDofSearch}
                      onChange={(e) => setSelectedDofSearch(e.target.value)}
                      style={{ border: 'none', outline: 'none', width: '100%', padding: '0.5rem 0', fontSize: '0.875rem' }}
                    />
                    {selectedDofSearch && (
                      <button
                        type="button"
                        onClick={() => setSelectedDofSearch('')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Inline list of DOFs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '50px 1.5fr 2fr 3fr 1.2fr',
                      fontWeight: '700',
                      padding: '0.5rem 1rem',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      color: '#475569'
                    }}>
                      <span>Select</span>
                      <span>DOF Details</span>
                      <span>Orders & Designs</span>
                      <span>Yarn Allocation Details</span>
                      <span style={{ textAlign: 'right' }}>Total Qty</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto', padding: '0.25rem' }}>
                      {(() => {
                        const results = forms.filter(f => {
                          const isFullyReceived = getYarnStatus(f.status) === 'fully_received';
                          const isNotAT = f.dyeing_unit?.partner_name !== 'AT';
                          const isPending = !f.bill_status || f.bill_status === 'pending' || (editingBill && f.bill_id === editingBill.id);
                          
                          const query = selectedDofSearch.trim().toLowerCase();
                          const queryMatch = !query || 
                            f.dof_number?.toLowerCase().includes(query) ||
                            (f.orders || []).some(o => 
                              o.order_number?.toLowerCase().includes(query) ||
                              o.design_no?.toLowerCase().includes(query) ||
                              o.design_name?.toLowerCase().includes(query)
                            ) ||
                            f.dyeing_unit?.partner_name?.toLowerCase().includes(query);
                          
                          return isFullyReceived && isNotAT && isPending && queryMatch;
                        });

                        if (results.length === 0) {
                          return (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dotted #cbd5e1' }}>
                              No fully completed DOFs found matching the criteria.
                            </div>
                          );
                        }

                        return results.map(r => {
                          const isSelected = selectedDofsForBill.some(sd => sd.id === r.id);
                          const isSamePartner = selectedDofsForBill.length === 0 || r.dyeing_unit?.partner_name === selectedDofsForBill[0].dyeing_unit?.partner_name;
                          const isDisabled = !isSelected && !isSamePartner;

                          return (
                            <div
                              key={r.id}
                              onClick={() => !isDisabled && handleToggleDof(r)}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '50px 1.5fr 2fr 3fr 1.2fr',
                                alignItems: 'center',
                                padding: '0.75rem 1rem',
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                border: isSelected ? '1px solid var(--color-primary)' : '1px solid #e2e8f0',
                                borderRadius: '6px',
                                backgroundColor: isSelected ? 'rgba(128, 0, 0, 0.02)' : '#fff',
                                opacity: isDisabled ? 0.5 : 1,
                                transition: 'all 0.2s',
                                fontSize: '0.8rem'
                              }}
                              className={isDisabled ? '' : 'hover-bg-slate'}
                            >
                              <div>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onChange={() => {}}
                                  style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontWeight: '700', color: 'var(--color-primary)' }}>{r.dof_number}</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>{r.dyeing_unit?.partner_name}</span>
                                <span style={{ fontSize: '0.675rem', color: '#64748b' }}>
                                  Del: {r.delivery_date ? new Date(r.delivery_date).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingRight: '0.5rem' }}>
                                {(r.orders || []).map((o, oidx) => (
                                  <div key={oidx} style={{ fontSize: '0.725rem', lineHeight: '1.2' }}>
                                    <strong>Ord:</strong> {o.order_number}
                                    <div style={{ color: '#64748b', fontSize: '0.675rem' }}>{o.design_name || 'N/A'} ({o.design_no || 'N/A'})</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {(r.yarn_allocations || []).map((alloc, idx) => {
                                  const y = yarnCounts.find(c => c.id === alloc.countId);
                                  const countLabel = y ? `${y.count_value} ${y.material}` : 'Yarn';
                                  const received = getDofAllocReceivedQty(r, alloc);
                                  return (
                                    <div key={idx} style={{ fontSize: '0.7rem', color: '#475569' }}>
                                      • {countLabel} - <span style={{ fontWeight: '600' }}>{alloc.colour}</span>: {received.toFixed(2)} / {parseFloat(alloc.total_kg || 0).toFixed(2)} kg
                                    </div>
                                  );
                                })}
                              </div>
                              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontWeight: '800', fontSize: '0.85rem' }}>
                                  {getTotalQty(r.yarn_allocations)} kg
                                </span>
                                {isDisabled && (
                                  <span style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: '700' }}>
                                    Different Unit ({r.dyeing_unit?.partner_name})
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {/* Step 1 Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.825rem', color: '#475569' }}>
                    {selectedDofsForBill.length > 0 ? (
                      <span>
                        Selected <strong>{selectedDofsForBill.length}</strong> form(s) from partner: <strong style={{ color: 'var(--color-primary)' }}>{selectedDofsForBill[0].dyeing_unit?.partner_name}</strong>
                      </span>
                    ) : (
                      <span>No forms selected. Select a form to continue.</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setRaiseBillOpen(false);
                        setEditingBill(null);
                        setSelectedDofsForBill([]);
                        setBillInvoiceNo('');
                        setBillRates({});
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={selectedDofsForBill.length === 0}
                      onClick={() => setBillStep(2)}
                      className="btn btn-primary"
                      style={{ padding: '0.5rem 1.5rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      Next: Set Rates & Details →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: SET RATES & INVOICE DETAILS */}
            {billStep === 2 && (() => {
              const aggregated = getAggregatedYarnSummary(selectedDofsForBill);
              let subtotal = 0;
              aggregated.forEach(item => {
                const rate = parseFloat(billRates[item.key]) || 0;
                subtotal += item.quantity_kg * rate;
              });
              const taxAmount = subtotal * (parseFloat(billTaxPercent || 0) / 100);
              const billTotal = subtotal + taxAmount;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Selected summary overview */}
                  <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.825rem' }}>
                      <strong>Dyeing Partner:</strong> {selectedDofsForBill[0]?.dyeing_unit?.partner_name} | 
                      <strong> Selected DOFs:</strong> {selectedDofsForBill.map(f => f.dof_number).join(', ')}
                    </div>
                    <button
                      type="button"
                      onClick={() => setBillStep(1)}
                      className="btn btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: '700', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                    >
                      ← Edit Selected DOFs
                    </button>
                  </div>

                  {/* Rates table */}
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                      Color & Count Summary & Rate Setup
                    </h4>
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '700', color: '#475569' }}>Yarn Count</th>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '700', color: '#475569' }}>Colour</th>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#475569' }}>Total Received Qty (kg)</th>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '700', color: '#475569', width: '160px' }}>Rate / kg (₹)</th>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#475569' }}>Total Price (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aggregated.map(item => {
                            const rate = billRates[item.key] ?? '';
                            const rowTotal = (parseFloat(rate) || 0) * item.quantity_kg;
                            
                            return (
                              <tr key={item.key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '500' }}>{item.countLabel}</td>
                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--color-primary)' }}>{item.colour}</td>
                                <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>
                                  {item.quantity_kg.toFixed(2)} kg
                                </td>
                                <td style={{ padding: '0.4rem 0.75rem', textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Rate ₹/kg"
                                    value={rate}
                                    onChange={(e) => setBillRates({ ...billRates, [item.key]: e.target.value })}
                                    className="input-field"
                                    style={{ width: '100%', padding: '0.3rem 0.5rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 'bold' }}
                                  />
                                </td>
                                <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '700', color: 'var(--color-primary)' }}>
                                  ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Invoice Details Inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main-current)' }}>
                        Tax %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={billTaxPercent}
                        onChange={(e) => setBillTaxPercent(e.target.value)}
                        className="input-field"
                        style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main-current)' }}>
                        Partner Invoice Number <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Invoice No"
                        value={billInvoiceNo}
                        onChange={(e) => setBillInvoiceNo(e.target.value)}
                        className="input-field"
                        style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                        required
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main-current)' }}>
                        Invoice Date <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={billInvoiceDate}
                        onChange={(e) => setBillInvoiceDate(e.target.value)}
                        className="input-field"
                        style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                        required
                      />
                    </div>
                  </div>

                  {/* Calculations breakdown & Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setBillStep(1)}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem' }}
                      >
                        ← Back to DOFs
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRaiseBillOpen(false);
                          setEditingBill(null);
                          setSelectedDofsForBill([]);
                          setBillInvoiceNo('');
                          setBillRates({});
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                      >
                        Cancel
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '300px', fontSize: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Pre-Tax Subtotal:</span>
                        <span style={{ fontWeight: '600' }}>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Tax Amount ({billTaxPercent}%):</span>
                        <span style={{ fontWeight: '600' }}>₹{taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', fontSize: '1rem', fontWeight: 'bold' }}>
                        <span>Total Bill Value:</span>
                        <span style={{ color: 'var(--color-primary)' }}>₹{billTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveBill}
                        disabled={submitting || selectedDofsForBill.length === 0}
                        className="btn btn-primary"
                        style={{ padding: '0.6rem 1.5rem', fontWeight: '800', width: '100%', marginTop: '0.5rem' }}
                      >
                        {submitting ? 'Submitting...' : editingBill ? '✓ Update Bill' : '✓ Submit Bill'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        </ModalWrapper>
      )}

      {/* View Bill Details Modal */}
      {viewingBillDetails && (
        <ModalWrapper
          title={`Bill Details: ${viewingBillDetails.bill_number}`}
          onClose={() => setViewingBillDetails(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '900px', width: '100%' }}>
            
            {/* Header info card */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Dyeing Unit (Partner)</span>
                <div style={{ fontWeight: 'bold', fontSize: '1rem', marginTop: '2px' }}>{viewingBillDetails.partner_name}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Partner Invoice Info</span>
                <div style={{ fontWeight: 'bold', fontSize: '1rem', marginTop: '2px' }}>
                  No: {viewingBillDetails.invoice_number} <br />
                  Date: {new Date(viewingBillDetails.invoice_date).toLocaleDateString()}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Status</span>
                <div style={{ marginTop: '4px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    backgroundColor: getBillStatusBadge(viewingBillDetails.status).bg, color: getBillStatusBadge(viewingBillDetails.status).text,
                    padding: '3px 8px', borderRadius: '4px',
                    fontSize: '0.75rem', fontWeight: '700'
                  }}>
                    {getBillStatusBadge(viewingBillDetails.status).label}
                  </span>
                </div>
              </div>
            </div>

            {/* DOF Wise Items breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-primary)' }}>Items Breakdown By Dyeing Order Form</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(viewingBillDetails.bill_items || []).map((item, idx) => (
                  <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', backgroundColor: '#fff' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '0.9rem', marginBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.25rem' }}>
                      Dyeing Order Form: {item.dof_number}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem' }}>
                      <span>Linked Orders: {(item.order_numbers || []).join(', ')}</span>
                      <span>Designs: {(item.design_nos || []).map((n, i) => `${n} (${item.design_names[i] || 'N/A'})`).join(', ')}</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left' }}>Yarn Count & Colour</th>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Received Weight</th>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Price per kg</th>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Total Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(item.yarn_details || []).map((yd, yidx) => (
                          <tr key={yidx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.5rem' }}>
                              {yd.count_label} - <span style={{ fontWeight: '700', color: 'var(--color-primary)' }}>{yd.colour}</span>
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>{yd.quantity_kg?.toFixed(2)} kg</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{yd.price_per_kg?.toFixed(2)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--color-primary)' }}>₹{yd.total_price?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '300px', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Pre-Tax Subtotal:</span>
                  <span style={{ fontWeight: '600' }}>₹{viewingBillDetails.calculated_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Tax Amount ({viewingBillDetails.tax_percent}%):</span>
                  <span style={{ fontWeight: '600' }}>₹{viewingBillDetails.tax_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', fontSize: '1rem', fontWeight: 'bold' }}>
                  <span>Total Bill Value:</span>
                  <span style={{ color: 'var(--color-primary)' }}>₹{viewingBillDetails.bill_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setViewingBillDetails(null)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1.5rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* Print Modals */}
      {selectedGydr && (
        <GYDRPrintModal
          receipt={selectedGydr}
          onClose={() => setSelectedGydr(null)}
        />
      )}
      {selectedReceipt && (
        <ReceiptPrintModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
      {selectedDyrr && (
        <DyedReceiptPrintModal
          receipt={selectedDyrr}
          onClose={() => setSelectedDyrr(null)}
        />
      )}
    </div>
  );
}
