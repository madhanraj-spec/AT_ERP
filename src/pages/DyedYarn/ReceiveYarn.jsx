import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Package, Calendar, 
  Truck, AlertCircle, Save, Printer, 
  X, CheckCircle, Loader, User, 
  FileText, Hash, Info, ChevronRight,
  TrendingUp, Layers, Factory, Users,
  Dna, MoveHorizontal, ClipboardList, ChevronDown,
  Clock, XCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import DyedReceiptPrintModal from './DyedReceiptPrintModal';

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

export default function ReceiveYarn() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  // Loading States
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  
  // Masters
  const [locations, setLocations] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);

  // Workflow State
  const [sourceType, setSourceType] = useState('partner');
  const [step, setStep] = useState(1);
  const [isClosingDof, setIsClosingDof] = useState(false);
  const [dofProgress, setDofProgress] = useState(0); 
  
  // Data State
  const [dofNumber, setDofNumber] = useState('');
  const [selectedDof, setSelectedDof] = useState(null);
  const [orderMap, setOrderMap] = useState({});
  const [receiptItems, setReceiptItems] = useState([]);
  const [associatedGydrs, setAssociatedGydrs] = useState([]);

  // Production Return States
  const [productionFormNumber, setProductionFormNumber] = useState('');
  const [selectedProductionForm, setSelectedProductionForm] = useState(null);
  const [productionFormType, setProductionFormType] = useState(''); // 'warping' or 'weaving'

  // DOF List States
  const [allDofs, setAllDofs] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [allGydrItems, setAllGydrItems] = useState([]);
  const [allDyrrItems, setAllDyrrItems] = useState([]);
  const [allDyrrs, setAllDyrrs] = useState([]);
  const [allReturns, setAllReturns] = useState([]);
  const [allRedyeingItems, setAllRedyeingItems] = useState([]);
  const [dofsLoading, setDofsLoading] = useState(false);
  const [expandedDofId, setExpandedDofId] = useState(null);

  // Final Form State
  const [logistics, setLogistics] = useState({
    dc_number: '',
    vehicle_no: '',
    received_by: profile?.full_name || ''
  });

  const [printData, setPrintData] = useState(null);
  const [yarnWorkers, setYarnWorkers] = useState([]);

  const activeDofAlert = selectedDof ? getDofAlertInfo(selectedDof, allDyrrs) : null;

  useEffect(() => {
    fetchMasters();
    fetchAllDofsData();
  }, []);

  const fetchMasters = async () => {
    const [locRes, yarnRes] = await Promise.all([
      supabase.from('master_locations').select('*').ilike('warehouse_type', '%dyed%'),
      supabase.from('master_yarn_counts').select('*')
    ]);
    setLocations(locRes.data || []);
    setYarnCounts(yarnRes.data || []);

    // Fetch Yarn workers
    try {
      const { data: deptData } = await supabase
        .from('master_departments')
        .select('id')
        .ilike('department_name', '%yarn%');
        
      const yarnDeptIds = (deptData || []).map(d => d.id);
      
      if (yarnDeptIds.length > 0) {
        const { data: workersData } = await supabase
          .from('master_workers')
          .select('*')
          .in('department_id', yarnDeptIds)
          .order('worker_name', { ascending: true });
        setYarnWorkers(workersData || []);
      }
    } catch (err) {
      console.error('Error fetching yarn workers:', err);
    }
  };

  const fetchAllDofsData = async () => {
    setDofsLoading(true);
    try {
      const [dofsRes, ordersRes, gydiRes, dyriRes, dyrrsRes, returnsRes, redyeRes] = await Promise.all([
        supabase
          .from('dyeing_order_forms')
          .select('*, dyeing_unit:master_partners(partner_name)')
          .order('created_at', { ascending: false }),
        supabase.from('orders').select('id, order_number, design_no, design_name'),
        supabase.from('greige_yarn_delivery_items').select('*, receipt:greige_yarn_delivery_receipts(*)'),
        supabase.from('dyed_yarn_receipt_items').select('*, receipt:dyed_yarn_receipts(*)'),
        supabase.from('dyed_yarn_receipts').select('*'),
        supabase.from('greige_yarn_receipts').select('*').eq('receipt_type', 'production'),
        supabase
          .from('dyed_yarn_delivery_items')
          .select('*, delivery:dyed_yarn_deliveries(*)')
          .eq('process_type', 'redyeing')
      ]);

      setAllDofs(dofsRes.data || []);
      setAllOrders(ordersRes.data || []);
      setAllGydrItems(gydiRes.data || []);
      const dyriData = dyriRes.data || [];
      const dyrrsData = dyrrsRes.data || [];
      setAllDyrrItems(dyriData);
      setAllDyrrs(dyrrsData.filter(r => dyriData.some(item => item.receipt_id === r.id)));
      setAllReturns(returnsRes.data || []);
      setAllRedyeingItems(redyeRes.data || []);
    } catch (err) {
      console.error('Error fetching all DOFs:', err);
    } finally {
      setDofsLoading(false);
    }
  };

  const handleDirectReceive = async (dof) => {
    if (dof.status === 'received') {
      alert('This Dyeing Order Form has already been fully received.');
      return;
    }
    setDofNumber(dof.dof_number);
    setFetching(true);
    setSelectedDof(null);
    setAssociatedGydrs([]);
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, design_no, design_name')
        .in('id', dof.order_ids);
      
      const oMap = {};
      orders?.forEach(o => oMap[o.id] = o);
      setOrderMap(oMap);

      const { data: gydrs } = await supabase
        .from('greige_yarn_delivery_receipts')
        .select('id, gydr_number, delivered_by, vehicle_no, remarks, created_at')
        .eq('dof_id', dof.id)
        .order('created_at', { ascending: false });
      
      setAssociatedGydrs(gydrs || []);
      const gydrIds = gydrs?.map(g => g.id) || [];
      const sMap = {}; 
      const fallbackMap = {}; 

      if (gydrIds.length > 0) {
        const { data: sentItems } = await supabase
          .from('greige_yarn_delivery_items')
          .select('order_id, yarn_count_id, colour, quantity_kg, yarn_type')
          .in('receipt_id', gydrIds);
        
        sentItems?.forEach(item => {
          const key = `${item.order_id}-${item.yarn_count_id}-${item.colour}-${item.yarn_type}`;
          const fKey = `${item.yarn_count_id}-${item.colour}-${item.yarn_type}`;
          
          sMap[key] = (sMap[key] || 0) + parseFloat(item.quantity_kg);
          fallbackMap[fKey] = (fallbackMap[fKey] || 0) + parseFloat(item.quantity_kg);
        });
      }

      // Fetch returns (GYRR)
      const { data: returnsData } = await supabase
        .from('greige_yarn_receipts')
        .select('order_id, yarn_count_id, colour, total_weight, yarn_type')
        .eq('receipt_type', 'production')
        .eq('order_form_no', dof.dof_number);

      const rMap = {};
      returnsData?.forEach(item => {
        const key = `${item.order_id}-${item.yarn_count_id}-${item.colour}-${item.yarn_type || 'warp'}`;
        rMap[key] = (rMap[key] || 0) + parseFloat(item.total_weight || 0);
      });

      const { data: dyrrs } = await supabase
        .from('dyed_yarn_receipts')
        .select('id').eq('dof_id', dof.id);
      
      const dyrrIds = dyrrs?.map(d => d.id) || [];
      const hMap = {}; 

      if (dyrrIds.length > 0) {
        const { data: recItems } = await supabase
          .from('dyed_yarn_receipt_items')
          .select('order_id, yarn_count_id, colour, quantity_kg, yarn_type')
          .in('receipt_id', dyrrIds);
        
        recItems?.forEach(item => {
          const key = `${item.order_id}-${item.yarn_count_id}-${item.colour}-${item.yarn_type || 'warp'}`;
          hMap[key] = (hMap[key] || 0) + parseFloat(item.quantity_kg);
        });
      }

      // Fetch existing redyeing deliveries to subtract
      const { data: redyeItems } = await supabase
        .from('dyed_yarn_delivery_items')
        .select('order_id, yarn_count_id, colour, quantity_kg, yarn_type, delivery:dyed_yarn_deliveries!inner(dof_id, delivery_type)')
        .eq('delivery.dof_id', dof.id)
        .eq('delivery.delivery_type', 'redyeing');

      redyeItems?.forEach(item => {
        const key = `${item.order_id}-${item.yarn_count_id}-${item.colour}-${item.yarn_type || 'warp'}`;
        hMap[key] = (hMap[key] || 0) - parseFloat(item.quantity_kg);
      });

      const initialItems = dof.yarn_allocations.map(alloc => {
        const key = `${alloc.orderId}-${alloc.countId}-${alloc.colour}-${alloc.type}`;
        
        const rawSentValue = (sMap[key] || 0) + 
                             (sMap[`${alloc.orderId}-${alloc.countId}-${alloc.colour}-null`] || 0) +
                             (sMap[`null-${alloc.countId}-${alloc.colour}-${alloc.type}`] || 0) +
                             (sMap[`null-${alloc.countId}-${alloc.colour}-null`] || 0);

        const returnedValue = (rMap[key] || 0) + 
                              (rMap[`${alloc.orderId}-${alloc.countId}-${alloc.colour}-null`] || 0) +
                              (rMap[`null-${alloc.countId}-${alloc.colour}-${alloc.type}`] || 0) +
                              (rMap[`null-${alloc.countId}-${alloc.colour}-null`] || 0);

        const sentValue = Math.max(0, rawSentValue - returnedValue);
        const histValue = hMap[key] || 0;

        return {
          order_id: alloc.orderId,
          yarn_count_id: alloc.countId,
          colour: alloc.colour,
          type: alloc.type || 'warp',
          required_qty: parseFloat(alloc.base_kg || alloc.total_kg || 0),
          sent_qty: sentValue,
          historical_qty: histValue, 
          received_weight: '',
          lot_number: '',
          location_id: locations[0]?.id || '',
          order_number: oMap[alloc.orderId]?.order_number || '',
          design_info: `${oMap[alloc.orderId]?.design_no || ''} / ${oMap[alloc.orderId]?.design_name || ''}`,
          isSplit: false
        };
      });

      setSelectedDof(dof);
      setReceiptItems(initialItems);
    } catch (err) {
      console.error(err);
      alert('Error fetching details.');
    } finally {
      setFetching(false);
    }
  };

  const handleSearchDof = async (e) => {
    e?.preventDefault();
    if (!dofNumber.trim()) return;

    setFetching(true);
    setSelectedDof(null);
    setAssociatedGydrs([]);
    try {
      const { data: dof, error: dofError } = await supabase
        .from('dyeing_order_forms')
        .select('*, dyeing_unit:master_partners(partner_name)')
        .eq('dof_number', dofNumber.trim())
        .single();

      if (dofError || !dof) {
        alert('DOF not found.');
        return;
      }

      if (dof.status === 'received') {
        alert('This Dyeing Order Form has already been fully received.');
        return;
      }

      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, design_no, design_name')
        .in('id', dof.order_ids);
      
      const oMap = {};
      orders?.forEach(o => oMap[o.id] = o);
      setOrderMap(oMap);

      const { data: gydrs } = await supabase
        .from('greige_yarn_delivery_receipts')
        .select('id, gydr_number, delivered_by, vehicle_no, remarks, created_at')
        .eq('dof_id', dof.id)
        .order('created_at', { ascending: false });
      
      setAssociatedGydrs(gydrs || []);
      const gydrIds = gydrs?.map(g => g.id) || [];
      const sMap = {}; // order-count-color
      const fallbackMap = {}; // count-color

      if (gydrIds.length > 0) {
        const { data: sentItems } = await supabase
          .from('greige_yarn_delivery_items')
          .select('order_id, yarn_count_id, colour, quantity_kg, yarn_type')
          .in('receipt_id', gydrIds);
        
        sentItems?.forEach(item => {
          const key = `${item.order_id}-${item.yarn_count_id}-${item.colour}-${item.yarn_type}`;
          const fKey = `${item.yarn_count_id}-${item.colour}-${item.yarn_type}`;
          
          sMap[key] = (sMap[key] || 0) + parseFloat(item.quantity_kg);
          fallbackMap[fKey] = (fallbackMap[fKey] || 0) + parseFloat(item.quantity_kg);
        });
      }

      // Fetch returns (GYRR)
      const { data: returnsData } = await supabase
        .from('greige_yarn_receipts')
        .select('order_id, yarn_count_id, colour, total_weight, yarn_type')
        .eq('receipt_type', 'production')
        .eq('order_form_no', dof.dof_number);

      const rMap = {};
      returnsData?.forEach(item => {
        const key = `${item.order_id}-${item.yarn_count_id}-${item.colour}-${item.yarn_type || 'warp'}`;
        rMap[key] = (rMap[key] || 0) + parseFloat(item.total_weight || 0);
      });

      // 4. Fetch Historical Dyed Receipts (Total Received)
      const { data: dyrrs } = await supabase
        .from('dyed_yarn_receipts')
        .select('id').eq('dof_id', dof.id);
      
      const dyrrIds = dyrrs?.map(d => d.id) || [];
      const hMap = {}; // historical received

      if (dyrrIds.length > 0) {
        const { data: recItems } = await supabase
          .from('dyed_yarn_receipt_items')
          .select('order_id, yarn_count_id, colour, quantity_kg, yarn_type')
          .in('receipt_id', dyrrIds);
        
        recItems?.forEach(item => {
          const key = `${item.order_id}-${item.yarn_count_id}-${item.colour}-${item.yarn_type || 'warp'}`;
          hMap[key] = (hMap[key] || 0) + parseFloat(item.quantity_kg);
        });
      }

      // Fetch existing redyeing deliveries to subtract
      const { data: redyeItems } = await supabase
        .from('dyed_yarn_delivery_items')
        .select('order_id, yarn_count_id, colour, quantity_kg, yarn_type, delivery:dyed_yarn_deliveries!inner(dof_id, delivery_type)')
        .eq('delivery.dof_id', dof.id)
        .eq('delivery.delivery_type', 'redyeing');

      redyeItems?.forEach(item => {
        const key = `${item.order_id}-${item.yarn_count_id}-${item.colour}-${item.yarn_type || 'warp'}`;
        hMap[key] = (hMap[key] || 0) - parseFloat(item.quantity_kg);
      });

      // 5. Map to Receipt Items
      const initialItems = dof.yarn_allocations.map(alloc => {
        const key = `${alloc.orderId}-${alloc.countId}-${alloc.colour}-${alloc.type}`;
        
        // Matches: Type-Specific + Legacy-Order-Specific + Fully-Unassigned
        const rawSentValue = (sMap[key] || 0) + 
                             (sMap[`${alloc.orderId}-${alloc.countId}-${alloc.colour}-null`] || 0) +
                             (sMap[`null-${alloc.countId}-${alloc.colour}-${alloc.type}`] || 0) +
                             (sMap[`null-${alloc.countId}-${alloc.colour}-null`] || 0);

        const returnedValue = (rMap[key] || 0) + 
                              (rMap[`${alloc.orderId}-${alloc.countId}-${alloc.colour}-null`] || 0) +
                              (rMap[`null-${alloc.countId}-${alloc.colour}-${alloc.type}`] || 0) +
                              (rMap[`null-${alloc.countId}-${alloc.colour}-null`] || 0);

        const sentValue = Math.max(0, rawSentValue - returnedValue);
        const histValue = hMap[key] || 0;

        return {
          order_id: alloc.orderId,
          yarn_count_id: alloc.countId,
          colour: alloc.colour,
          type: alloc.type || 'warp',
          required_qty: parseFloat(alloc.base_kg || alloc.total_kg || 0),
          sent_qty: sentValue,
          historical_qty: histValue, 
          received_weight: '',
          lot_number: '',
          location_id: locations[0]?.id || '',
          order_number: oMap[alloc.orderId]?.order_number || '',
          design_info: `${oMap[alloc.orderId]?.design_no || ''} / ${oMap[alloc.orderId]?.design_name || ''}`,
          isSplit: false
        };
      });

      setSelectedDof(dof);
      setReceiptItems(initialItems);
    } catch (err) {
      console.error(err);
      alert('Error fetching details.');
    } finally {
      setFetching(false);
    }
  };

  const handleSearchProductionForm = async (e) => {
    e?.preventDefault();
    if (!productionFormNumber.trim()) return;

    setFetching(true);
    setSelectedProductionForm(null);
    setReceiptItems([]);

    try {
      // 1. Search in warping order forms
      let form = null;
      let formType = 'warping';

      const { data: wofData, error: wofErr } = await supabase
        .from('warping_order_forms')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name)
        `)
        .ilike('wof_number', productionFormNumber.trim())
        .maybeSingle();

      if (wofData) {
        form = wofData;
      } else {
        // 2. Search in weaving orders
        const { data: weavingData, error: weavingErr } = await supabase
          .from('weaving_orders')
          .select(`
            *,
            order:orders(id, order_number, design_no, design_name)
          `)
          .ilike('weaving_number', productionFormNumber.trim())
          .maybeSingle();

        if (weavingData) {
          form = weavingData;
          formType = 'weaving';
        }
      }

      if (!form) {
        alert('Warping Order Form or Weaving Order not found.');
        return;
      }

      // 3. Fetch dyed yarn delivery items and their source receipts to get dof_id
      const { data: deliveryItems, error: dydiError } = await supabase
        .from('dyed_yarn_delivery_items')
        .select(`
          id,
          order_id,
          yarn_count_id,
          colour,
          quantity_kg,
          lot_number,
          location_id,
          source_receipt:dyed_yarn_receipts(dof_id)
        `)
        .eq('production_form_id', form.id);

      if (dydiError) throw dydiError;

      if (!deliveryItems || deliveryItems.length === 0) {
        alert('No dyed yarn deliveries found for this order form.');
        return;
      }

      // Group deliveries by count, colour, and lot number
      const grouped = {};
      deliveryItems.forEach(item => {
        const key = `${item.yarn_count_id}-${item.colour}-${item.lot_number || ''}`;
        if (!grouped[key]) {
          grouped[key] = {
            order_id: item.order_id || form.order_id,
            yarn_count_id: item.yarn_count_id,
            colour: item.colour,
            lot_number: item.lot_number || '',
            location_id: item.location_id || locations[0]?.id || '',
            delivered_qty: 0,
            dof_id: item.source_receipt?.dof_id || null
          };
        }
        grouped[key].delivered_qty += parseFloat(item.quantity_kg || 0);
      });

      // Map to receiptItems
      const initialItems = Object.values(grouped).map(group => ({
        order_id: group.order_id,
        yarn_count_id: group.yarn_count_id,
        colour: group.colour,
        type: formType === 'warping' ? 'warp' : 'weft',
        required_qty: 0,
        sent_qty: group.delivered_qty, // displayed in table as Delivered Qty
        historical_qty: 0,
        received_weight: '', // user enters return qty here
        lot_number: group.lot_number,
        location_id: group.location_id,
        dof_id: group.dof_id,
        order_number: form.order?.order_number || '',
        design_info: form.order ? `${form.order.design_no || ''} / ${form.order.design_name || ''}` : '',
        isSplit: false
      }));

      setSelectedProductionForm(form);
      setProductionFormType(formType);
      setReceiptItems(initialItems);
    } catch (err) {
      console.error(err);
      alert('Error fetching production form details.');
    } finally {
      setFetching(false);
    }
  };

  const addManualItem = () => {
    setReceiptItems([...receiptItems, {
      order_id: null, order_number: 'MISC', design_info: '',
      yarn_count_id: '', colour: '', type: 'warp',
      required_qty: 0, sent_qty: 0, historical_qty: 0, received_weight: '',
      lot_number: '',
      location_id: locations[0]?.id || '',
      isSplit: false
    }]);
  };

  const updateItem = (index, field, val) => {
    const newItems = [...receiptItems];
    newItems[index][field] = val;
    setReceiptItems(newItems);
  };

  const addLotSplit = (index) => {
    const parentItem = receiptItems[index];
    const newItems = [...receiptItems];
    newItems.splice(index + 1, 0, {
      ...parentItem,
      received_weight: '',
      lot_number: '',
      isSplit: true
    });
    setReceiptItems(newItems);
  };

  const removeLotSplit = (index) => {
    const newItems = [...receiptItems];
    newItems.splice(index, 1);
    setReceiptItems(newItems);
  };

  const handleProceed = () => {
    const valid = receiptItems.some(i => parseFloat(i.received_weight) > 0);
    if (!valid) return alert('Enter received weight for at least one item.');
    
    if (sourceType === 'partner') {
      // Group inputs by allocation key: order_id-yarn_count_id-colour-type to handle split lots
      const groupedInputs = {};
      receiptItems.forEach(item => {
        const key = `${item.order_id}-${item.yarn_count_id}-${item.colour}-${item.type}`;
        groupedInputs[key] = (groupedInputs[key] || 0) + (parseFloat(item.received_weight) || 0);
      });

      // Validate that total weight doesn't exceed the balance
      for (const item of receiptItems) {
        if (item.isSplit) continue; // check grouping
        const key = `${item.order_id}-${item.yarn_count_id}-${item.colour}-${item.type}`;
        const totalInput = groupedInputs[key] || 0;
        const balance = Math.max(0, item.sent_qty - item.historical_qty);
        if (totalInput > balance + 0.001) {
          const countLabel = yarnCounts.find(yc => yc.id === item.yarn_count_id)?.count_value || 'Unknown';
          alert(`Received quantity for ${item.colour} (${countLabel}) of ${totalInput.toFixed(2)} kg exceeds the remaining balance of ${balance.toFixed(2)} kg!`);
          return;
        }
      }

      const totalRequired = receiptItems
        .filter(i => !i.isSplit)
        .reduce((s, i) => s + parseFloat(i.required_qty), 0);
      const totalHist = receiptItems
        .filter(i => !i.isSplit)
        .reduce((s, i) => s + (parseFloat(i.historical_qty) || 0), 0);
      const totalReceivedNow = receiptItems.reduce((s, i) => s + (parseFloat(i.received_weight) || 0), 0);
      const totalNow = totalHist + totalReceivedNow;
      const perc = totalRequired > 0 ? (totalNow / totalRequired) * 100 : 0;
      setDofProgress(perc);
    } else {
      // Group inputs by count, colour, and lot number to validate split lots
      const groupedInputs = {};
      receiptItems.forEach(item => {
        const key = `${item.yarn_count_id}-${item.colour}-${item.lot_number || ''}`;
        groupedInputs[key] = (groupedInputs[key] || 0) + (parseFloat(item.received_weight) || 0);
      });

      // Validate that total returned weight doesn't exceed the delivered qty
      for (const item of receiptItems) {
        if (item.isSplit) continue; // check grouping
        const key = `${item.yarn_count_id}-${item.colour}-${item.lot_number || ''}`;
        const totalInput = groupedInputs[key] || 0;
        const delivered = item.sent_qty; // sent_qty holds group.delivered_qty
        if (totalInput > delivered + 0.001) {
          const countLabel = yarnCounts.find(yc => yc.id === item.yarn_count_id)?.count_value || 'Unknown';
          alert(`Returned quantity for ${item.colour} (${countLabel}) lot "${item.lot_number}" of ${totalInput.toFixed(2)} kg exceeds the delivered quantity of ${delivered.toFixed(2)} kg!`);
          return;
        }
      }
    }
    
    setStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const { data: dyrrNumber } = await supabase.rpc('get_next_dyrr_number', { p_year: year });

      // Resolve dof_id and dof_number for production returns
      const firstDofId = receiptItems.find(i => i.dof_id)?.dof_id || null;
      const docNo = sourceType === 'partner' 
        ? selectedDof?.dof_number 
        : (productionFormType === 'warping' 
            ? selectedProductionForm?.wof_number 
            : selectedProductionForm?.weaving_number);

      const { data: receipt, error: headError } = await supabase
        .from('dyed_yarn_receipts')
        .insert([{
          dyrr_number: dyrrNumber,
          dof_id: sourceType === 'partner' ? selectedDof?.id : firstDofId,
          dof_number: docNo || 'PRODUCTION_RETURN',
          dyeing_unit_id: sourceType === 'partner' ? selectedDof?.dyeing_unit_id : null,
          received_date: new Date().toISOString().split('T')[0],
          vehicle_no: logistics.vehicle_no,
          dc_number: logistics.dc_number,
          received_by: logistics.received_by,
          source_type: sourceType,
          created_by: profile.id
        }]).select().single();

      if (headError) throw headError;

      const itemsToInsert = receiptItems
        .filter(i => parseFloat(i.received_weight) > 0)
        .map(i => ({
          receipt_id: receipt.id,
          order_id: i.order_id,
          yarn_count_id: i.yarn_count_id,
          colour: i.colour,
          quantity_kg: parseFloat(i.received_weight),
          location_id: i.location_id,
          is_excess: sourceType === 'production',
          yarn_type: i.type,
          lot_number: i.lot_number
        }));

      const { error: itemsError } = await supabase.from('dyed_yarn_receipt_items').insert(itemsToInsert);
      if (itemsError) {
        alert("Failed to save receipt items: " + itemsError.message);
        throw itemsError;
      }

      if (sourceType === 'partner') {
        const newStatus = isClosingDof ? 'received' : 'partially_received';
        const { error: statusError } = await supabase.from('dyeing_order_forms')
          .update({ status: newStatus })
          .eq('id', selectedDof.id);
        if (statusError) {
          alert("Failed to update DOF status: " + statusError.message);
          throw statusError;
        }
      }

      const printObj = {
        receiptNumber: dyrrNumber,
        dof_number: docNo || 'PRODUCTION_RETURN',
        date: new Date().toLocaleString(),
        source: sourceType === 'partner' ? 'Partner Receipt' : 'Production Return',
        partner_name: sourceType === 'partner' ? selectedDof?.dyeing_unit?.partner_name : 'N/A',
        items: receiptItems
          .filter(i => parseFloat(i.received_weight) > 0)
          .map(item => ({
            orderNo: item.order_number || '-',
            design: item.design_info || '-',
            count: yarnCounts.find(y => y.id === item.yarn_count_id)?.count_value,
            colour: item.colour,
            type: item.type,
            weight: parseFloat(item.received_weight),
            location: locations.find(l => l.id === item.location_id)?.location_name || '-',
            lot_number: item.lot_number
          })),
        logistics
      };

      setPrintData(printObj);
      setStep(1); // Hide the finalize modal

    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const groupedItemsByOrder = () => {
    const groups = {};
    receiptItems.forEach((item, index) => {
      const oid = item.order_number || 'manual';
      if (!groups[oid]) {
        groups[oid] = {
          info: { 
            number: item.order_number, 
            design: item.design_info 
          }, 
          warp: [], 
          weft: [] 
        };
      }
      
      const itemWithIndex = { ...item, originalIndex: index };
      if (item.type === 'warp') groups[oid].warp.push(itemWithIndex);
      else groups[oid].weft.push(itemWithIndex);
    });
    return groups;
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
      <style>{`
        .premium-input {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 12px;
          outline: none;
          font-family: inherit;
          transition: all 0.2s ease-in-out;
          background-color: #fff;
          color: #1e293b;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          width: 100%;
        }
        .premium-input:focus {
          border-color: #7f1d1d;
          box-shadow: 0 0 0 3px rgba(127, 29, 29, 0.15);
        }
        .premium-select {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 12px;
          outline: none;
          background-color: #fff;
          color: #1e293b;
          transition: all 0.2s ease-in-out;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          cursor: pointer;
          width: 100%;
        }
        .premium-select:focus {
          border-color: #7f1d1d;
          box-shadow: 0 0 0 3px rgba(127, 29, 29, 0.15);
        }
        .premium-row {
          transition: background-color 0.2s ease;
        }
        .premium-row:hover {
          background-color: rgba(248, 250, 252, 0.7);
        }
        .premium-btn {
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .premium-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(127, 29, 29, 0.2);
        }
        .premium-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .premium-toggle-btn {
          transition: all 0.25s ease-in-out;
        }
        .premium-toggle-btn:hover {
          transform: translateY(-1px);
        }
        .premium-toggle-btn:active {
          transform: translateY(0);
        }
        .premium-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .premium-th {
          padding: 1rem 0.75rem;
          text-align: left;
          font-size: 0.8rem;
          font-weight: 800;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid #e2e8f0;
        }
        .premium-th-right {
          text-align: right;
        }
        .premium-td {
          padding: 0.875rem 0.75rem;
          vertical-align: middle;
          font-size: 0.875rem;
          color: #334155;
        }
        .premium-td-right {
          text-align: right;
        }
        .premium-group-header {
          background: linear-gradient(135deg, #7f1d1d, #991b1b);
          color: #fff;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 900;
          box-shadow: 0 4px 6px rgba(127,29,29,0.15);
          letter-spacing: 0.5px;
        }
        .premium-modal-overlay {
          position: fixed;
          inset: 0;
          background-color: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.25s ease-out;
        }
        .premium-modal-card {
          background-color: #fff;
          border-radius: 16px;
          padding: 2.5rem;
          width: 520px;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
          border: 1px solid #f1f5f9;
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      {printData && (
        <DyedReceiptPrintModal 
          receipt={printData} 
          onClose={() => {
            setPrintData(null);
            navigate('/dyed-yarn');
          }} 
        />
      )}

      <div className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => navigate('/dyed-yarn')} className="btn-icon"><ArrowLeft size={20} /></button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>Receive Dyed Yarn</h1>
            <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>Organized by Order, Warp, and Weft</p>
          </div>
        </div>

        {/* Source Toggle */}
        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '2rem' }}>
          <button 
            onClick={() => { setSourceType('partner'); setReceiptItems([]); }} 
            className="premium-toggle-btn"
            style={{ 
              flex: 1, 
              padding: '1.25rem', 
              borderRadius: '12px', 
              border: '1px solid', 
              borderColor: sourceType === 'partner' ? '#7f1d1d' : '#e2e8f0', 
              background: sourceType === 'partner' ? 'linear-gradient(135deg, #7f1d1d, #991b1b)' : '#fff', 
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: sourceType === 'partner' ? '0 10px 15px -3px rgba(127, 29, 29, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              transform: sourceType === 'partner' ? 'scale(1.02)' : 'scale(1)'
            }}
          >
            <Users size={24} color={sourceType === 'partner' ? '#fff' : '#475569'} />
            <div style={{ fontWeight: '800', fontSize: '1rem', color: sourceType === 'partner' ? '#fff' : '#475569' }}>Receive from Partner (Dyeing Unit)</div>
            <div style={{ fontSize: '0.75rem', color: sourceType === 'partner' ? '#fecaca' : '#94a3b8' }}>Process deliveries back from external dyeing partners</div>
          </button>
          
          <button 
            onClick={() => { setSourceType('production'); setReceiptItems([]); setSelectedProductionForm(null); setProductionFormNumber(''); }} 
            className="premium-toggle-btn"
            style={{ 
              flex: 1, 
              padding: '1.25rem', 
              borderRadius: '12px', 
              border: '1px solid', 
              borderColor: sourceType === 'production' ? '#7f1d1d' : '#e2e8f0', 
              background: sourceType === 'production' ? 'linear-gradient(135deg, #7f1d1d, #991b1b)' : '#fff', 
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: sourceType === 'production' ? '0 10px 15px -3px rgba(127, 29, 29, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              transform: sourceType === 'production' ? 'scale(1.02)' : 'scale(1)'
            }}
          >
            <Factory size={24} color={sourceType === 'production' ? '#fff' : '#475569'} />
            <div style={{ fontWeight: '800', fontSize: '1rem', color: sourceType === 'production' ? '#fff' : '#475569' }}>Receive from Production (Internal returns)</div>
            <div style={{ fontSize: '0.75rem', color: sourceType === 'production' ? '#fecaca' : '#94a3b8' }}>Receive excess/unused dyed yarn from warping or weaving</div>
          </button>
        </div>

        {sourceType === 'partner' && (
          <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2.5rem', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)', backgroundColor: '#fff' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Search Dyeing Order Form</h3>
            <form onSubmit={handleSearchDof} style={{ display: 'flex', gap: '0.75rem', maxWidth: '600px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  className="premium-input" 
                  placeholder="Enter DOF Number (e.g. AT/2026/DOF/00001)..." 
                  value={dofNumber} 
                  onChange={e => setDofNumber(e.target.value)} 
                  style={{ fontWeight: '800', paddingLeft: '38px', height: '42px', fontSize: '0.9rem' }} 
                />
              </div>
              <button 
                disabled={fetching} 
                type="submit" 
                className="btn btn-primary premium-btn"
                style={{ height: '42px', padding: '0 2rem', backgroundColor: '#7f1d1d', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '800', cursor: 'pointer' }}
              >
                {fetching ? <Loader size={18} className="spin" /> : 'Fetch Details'}
              </button>
            </form>

            {!selectedDof && (
              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ClipboardList size={18} color="var(--color-primary)" /> Dyeing Order Forms List
                </h3>
                
                {dofsLoading ? (
                  <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                    <Loader size={28} className="spin" color="var(--color-primary)" />
                    <p style={{ marginTop: '0.75rem', color: '#666', fontSize: '0.85rem' }}>Loading Dyeing Order Forms...</p>
                  </div>
                ) : allDofs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8', fontSize: '0.85rem', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>
                    No Dyeing Order Forms found.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {allDofs.map(dof => {
                      const isExpanded = expandedDofId === dof.id;
                      
                      const allocationsStatus = dof.yarn_allocations.map(alloc => {
                        // Greige Sent for this allocation
                        const rawSentValue = allGydrItems
                          .filter(item => item.receipt?.dof_id === dof.id && 
                            item.yarn_count_id === alloc.countId && 
                            item.colour === alloc.colour && 
                            (item.yarn_type || 'warp') === (alloc.type || 'warp') &&
                            (item.order_id === alloc.orderId || !item.order_id)
                          )
                          .reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);

                        // Greige Returns for this allocation
                        const returnedValue = allReturns
                          .filter(item => item.order_form_no === dof.dof_number &&
                            item.yarn_count_id === alloc.countId &&
                            item.colour === alloc.colour &&
                            (item.yarn_type || 'warp') === (alloc.type || 'warp') &&
                            (item.order_id === alloc.orderId || !item.order_id)
                          )
                          .reduce((sum, item) => sum + parseFloat(item.total_weight || 0), 0);

                        const sentValue = Math.max(0, rawSentValue - returnedValue);

                        // Dyed Received for this allocation
                        const rawRecValue = allDyrrItems
                          .filter(item => item.receipt?.dof_id === dof.id && 
                            item.yarn_count_id === alloc.countId && 
                            item.colour === alloc.colour && 
                            (item.yarn_type || 'warp') === (alloc.type || 'warp') &&
                            (item.order_id === alloc.orderId || !item.order_id)
                          )
                          .reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);

                        const redyeValue = allRedyeingItems
                          .filter(item => item.delivery?.dof_id === dof.id &&
                            item.yarn_count_id === alloc.countId &&
                            item.colour === alloc.colour &&
                            (item.yarn_type || 'warp') === (alloc.type || 'warp') &&
                            (item.order_id === alloc.orderId || !item.order_id)
                          )
                          .reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);

                        const recValue = Math.max(0, rawRecValue - redyeValue);

                        const matchedOrder = allOrders.find(o => o.id === alloc.orderId);

                        return {
                          ...alloc,
                          orderNumber: matchedOrder?.order_number || 'MISC',
                          designInfo: matchedOrder ? `${matchedOrder.design_no} / ${matchedOrder.design_name}` : '-',
                          sent: sentValue,
                          received: recValue
                        };
                      });

                      const uniqueOrders = Array.from(new Set(allocationsStatus.map(a => a.orderNumber).filter(o => o && o !== 'MISC')));
                      const uniqueDesigns = Array.from(new Set(allocationsStatus.map(a => a.designInfo).filter(d => d && d !== '-')));

                      const formatCountVal = (id) => {
                        const y = yarnCounts.find(c => c.id === id);
                        return y ? `${y.count_value} ${y.material}` : '-';
                      };

                      const alertInfo = getDofAlertInfo(dof, allDyrrs);
                      const cardBg = alertInfo ? alertInfo.bgColor : '#fff';
                      const cardBorder = alertInfo ? `1px solid ${alertInfo.borderColor}` : '1px solid #e2e8f0';

                      return (
                        <div key={dof.id} style={{ 
                          backgroundColor: cardBg, 
                          border: cardBorder, 
                          borderRadius: '12px',
                          overflow: 'hidden',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                        }}>
                          {/* Header Summary Row */}
                          <div style={{ 
                            padding: '1.25rem', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            cursor: 'pointer',
                            backgroundColor: isExpanded ? (alertInfo && ['received_on_time', 'received_late'].includes(alertInfo.type) ? '#e2e8f0' : '#f8fafc') : 'transparent'
                          }} onClick={() => setExpandedDofId(isExpanded ? null : dof.id)}>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <ChevronRight size={18} style={{ 
                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s',
                                color: '#94a3b8'
                              }} />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: '900', fontSize: '1rem', color: 'var(--color-primary)' }}>
                                    {dof.dof_number}
                                  </span>
                                  {(() => {
                                    const approvalBadge = getApprovalStatusBadge(dof.status);
                                    const yarnBadge = getYarnStatusBadge(dof.status);
                                    return (
                                      <>
                                        <span style={{ 
                                          padding: '0.15rem 0.5rem', 
                                          borderRadius: '4px', 
                                          fontSize: '0.7rem', 
                                          fontWeight: '800',
                                          backgroundColor: approvalBadge.bg,
                                          color: approvalBadge.text,
                                          textTransform: 'uppercase'
                                        }}>
                                          {approvalBadge.label}
                                        </span>
                                        <span style={{ 
                                          padding: '0.15rem 0.5rem', 
                                          borderRadius: '4px', 
                                          fontSize: '0.7rem', 
                                          fontWeight: '800',
                                          backgroundColor: yarnBadge.bg,
                                          color: yarnBadge.text,
                                          textTransform: 'uppercase'
                                        }}>
                                          {yarnBadge.label}
                                        </span>
                                      </>
                                    );
                                  })()}
                                  {alertInfo && (
                                    <span style={{ 
                                      padding: '0.15rem 0.5rem', 
                                      borderRadius: '4px', 
                                      fontSize: '0.7rem', 
                                      fontWeight: '800',
                                      textTransform: 'capitalize',
                                      backgroundColor: alertInfo.bgColor,
                                      color: alertInfo.color,
                                      border: `1px solid ${alertInfo.borderColor}`
                                    }}>
                                      {alertInfo.label}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontWeight: '500', display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.75rem' }}>
                                  <span>Partner: <strong style={{ color: '#334155' }}>{dof.dyeing_unit?.partner_name || 'N/A'}</strong></span>
                                  <span>|</span>
                                  <span>Target Delivery: <strong style={{ color: '#334155' }}>{dof.expected_delivery_date || 'N/A'}</strong></span>
                                  {uniqueOrders.length > 0 && (
                                    <>
                                      <span>|</span>
                                      <span>Order: <strong style={{ color: '#334155' }}>{uniqueOrders.join(', ')}</strong></span>
                                    </>
                                  )}
                                  {uniqueDesigns.length > 0 && (
                                    <>
                                      <span>|</span>
                                      <span>Design: <strong style={{ color: '#334155' }}>{uniqueDesigns.join(', ')}</strong></span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                              {dof.status !== 'received' ? (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDirectReceive(dof);
                                  }}
                                  className="btn"
                                  style={{ 
                                    padding: '0.5rem 1rem', 
                                    fontSize: '0.8rem', 
                                    fontWeight: '800',
                                    backgroundColor: '#7f1d1d',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 6px rgba(127, 29, 29, 0.15)'
                                  }}
                                >
                                  Receive Yarn
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#166534' }}>
                                  Fully Received
                                </span>
                              )}
                            </div>

                          </div>

                          {/* Expanded Table */}
                          {isExpanded && (
                            <div style={{ 
                              padding: '1.25rem', 
                              backgroundColor: '#fff', 
                              borderTop: '1px solid #f1f5f9' 
                            }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                                    <th style={subThStyle}>Order / Design</th>
                                    <th style={subThStyle}>Count</th>
                                    <th style={subThStyle}>Colour</th>
                                    <th style={subThStyle}>Type</th>
                                    <th style={subNumericThStyle}>Allocated (kg)</th>
                                    <th style={subNumericThStyle}>Greige Sent</th>
                                    <th style={subNumericThStyle}>Dyed Received</th>
                                    <th style={subNumericThStyle}>Balance to Rec.</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {allocationsStatus.map((alloc, idx) => {
                                    const balance = Math.max(0, alloc.sent - alloc.received);
                                    return (
                                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={subTdStyle}>
                                          <div style={{ fontWeight: '700', color: '#1e293b' }}>{alloc.orderNumber}</div>
                                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{alloc.designInfo}</div>
                                        </td>
                                        <td style={subTdStyle}>{formatCountVal(alloc.countId)}</td>
                                        <td style={{ ...subTdStyle, fontWeight: '700', color: 'var(--color-primary)' }}>{alloc.colour}</td>
                                        <td style={subTdStyle}>
                                          <span style={{ 
                                            padding: '0.15rem 0.4rem', 
                                            borderRadius: '4px', 
                                            fontSize: '0.65rem', 
                                            fontWeight: '800',
                                            textTransform: 'uppercase',
                                            backgroundColor: alloc.type === 'warp' ? '#eff6ff' : '#ecfdf5',
                                            color: alloc.type === 'warp' ? '#1e40af' : '#047857'
                                          }}>
                                            {alloc.type}
                                          </span>
                                        </td>
                                        <td style={subNumericTdStyle}>{(alloc.total_kg || alloc.base_kg || 0).toFixed(1)}</td>
                                        <td style={subNumericTdStyle}>{alloc.sent.toFixed(1)}</td>
                                        <td style={subNumericTdStyle}>{alloc.received.toFixed(1)}</td>
                                        <td style={{ ...subNumericTdStyle, color: balance > 0 ? '#b45309' : '#16a34a', fontWeight: '800', fontSize: '0.85rem' }}>
                                          {balance.toFixed(1)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {selectedDof && (
              <div style={{ 
                marginTop: '1.5rem', 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                gap: '1.5rem' 
              }}>
                {/* Card 1: DOF Details */}
                <div style={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0', 
                  borderTop: '4px solid #7f1d1d',
                  borderRadius: '12px', 
                  padding: '1.5rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                }}>
                  <h4 style={{ 
                    margin: '0 0 1.25rem 0', 
                    fontSize: '0.9rem', 
                    fontWeight: '900', 
                    color: '#7f1d1d', 
                    textTransform: 'uppercase', 
                    letterSpacing: '1px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <FileText size={18} /> Dyeing Order Form Details
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', fontSize: '0.875rem' }}>
                    <div>
                      <div style={{ color: '#64748b', fontWeight: '700', fontSize: '0.72rem', letterSpacing: '0.5px' }}>DOF NUMBER</div>
                      <div style={{ fontWeight: '800', color: '#0f172a', marginTop: '2px', fontSize: '1rem' }}>{selectedDof.dof_number}</div>
                    </div>
                    
                    <div>
                      <div style={{ color: '#64748b', fontWeight: '700', fontSize: '0.72rem', letterSpacing: '0.5px' }}>STATUS BADGES</div>
                      <div style={{ marginTop: '4px', display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {(() => {
                          const approvalBadge = getApprovalStatusBadge(selectedDof.status);
                          const yarnBadge = getYarnStatusBadge(selectedDof.status);
                          return (
                            <>
                              <span className="premium-badge" style={{ backgroundColor: approvalBadge.bg, color: approvalBadge.text }}>
                                {approvalBadge.label}
                              </span>
                              <span className="premium-badge" style={{ backgroundColor: yarnBadge.bg, color: yarnBadge.text }}>
                                {yarnBadge.label}
                              </span>
                            </>
                          );
                        })()}
                        {activeDofAlert && (
                          <span className="premium-badge" style={{ backgroundColor: activeDofAlert.bgColor, color: activeDofAlert.color, border: `1px solid ${activeDofAlert.borderColor}` }}>
                            {activeDofAlert.label}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {(() => {
                      const uniqueOrders = Array.from(new Set((selectedDof.yarn_allocations || []).map(alloc => {
                        const matchedOrder = allOrders.find(o => o.id === alloc.orderId);
                        return matchedOrder?.order_number;
                      }).filter(Boolean)));
                      const uniqueDesigns = Array.from(new Set((selectedDof.yarn_allocations || []).map(alloc => {
                        const matchedOrder = allOrders.find(o => o.id === alloc.orderId);
                        return matchedOrder ? `${matchedOrder.design_no} / ${matchedOrder.design_name}` : null;
                      }).filter(Boolean)));

                      return (
                        <>
                          {uniqueOrders.length > 0 && (
                            <div style={{ gridColumn: 'span 2', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                              <div style={{ color: '#64748b', fontWeight: '700', fontSize: '0.72rem', letterSpacing: '0.5px' }}>ASSOCIATED ORDERS</div>
                              <div style={{ fontWeight: '800', color: '#334155', marginTop: '2px', wordBreak: 'break-all', whiteSpace: 'normal', fontSize: '0.85rem' }}>
                                {uniqueOrders.join(', ')}
                              </div>
                            </div>
                          )}
                          {uniqueDesigns.length > 0 && (
                            <div style={{ gridColumn: 'span 2', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                              <div style={{ color: '#64748b', fontWeight: '700', fontSize: '0.72rem', letterSpacing: '0.5px' }}>DESIGNS</div>
                              <div style={{ fontWeight: '800', color: '#334155', marginTop: '2px', wordBreak: 'break-all', whiteSpace: 'normal', fontSize: '0.85rem' }}>
                                {uniqueDesigns.join(', ')}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    <div style={{ gridColumn: 'span 2', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                      <div style={{ color: '#64748b', fontWeight: '700', fontSize: '0.72rem', letterSpacing: '0.5px' }}>DYEING PARTNER</div>
                      <div style={{ fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{selectedDof.dyeing_unit?.partner_name || 'N/A'}</div>
                    </div>
                    
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                      <div style={{ color: '#64748b', fontWeight: '700', fontSize: '0.72rem', letterSpacing: '0.5px' }}>EXPECTED DELIVERY</div>
                      <div style={{ fontWeight: '800', color: '#334155', marginTop: '2px' }}>{selectedDof.expected_delivery_date || 'N/A'}</div>
                    </div>
                    
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                      <div style={{ color: '#64748b', fontWeight: '700', fontSize: '0.72rem', letterSpacing: '0.5px' }}>CREATED AT</div>
                      <div style={{ fontWeight: '800', color: '#334155', marginTop: '2px' }}>{new Date(selectedDof.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Associated GYDRs */}
                <div style={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0', 
                  borderTop: '4px solid #7f1d1d',
                  borderRadius: '12px', 
                  padding: '1.5rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <h4 style={{ 
                    margin: '0 0 1.25rem 0', 
                    fontSize: '0.9rem', 
                    fontWeight: '900', 
                    color: '#7f1d1d', 
                    textTransform: 'uppercase', 
                    letterSpacing: '1px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Truck size={18} /> Associated Greige Deliveries (GYDR)
                  </h4>
                  {associatedGydrs.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: '0.875rem', padding: '2rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center', border: '1px dashed #e2e8f0', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      No greige yarn delivery receipts found for this DOF.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px', flex: 1 }}>
                      {associatedGydrs.map((g, i) => (
                        <div key={i} style={{ 
                          padding: '0.75rem 1rem', 
                          backgroundColor: '#f8fafc', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.825rem',
                          transition: 'all 0.2s',
                          cursor: 'default'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        >
                          <div>
                            <div style={{ fontWeight: '800', color: '#7f1d1d' }}>{g.gydr_number}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                              Date: {new Date(g.created_at).toLocaleDateString()} | Veh: {g.vehicle_no || 'N/A'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: '700', color: '#64748b', fontSize: '0.65rem', letterSpacing: '0.5px' }}>DELIVERED BY</div>
                            <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.78rem' }}>{g.delivered_by}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {sourceType === 'production' && (
          <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2.5rem', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)', backgroundColor: '#fff' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Search Production Form (WOF or Weaving Order)</h3>
            <form onSubmit={handleSearchProductionForm} style={{ display: 'flex', gap: '0.75rem', maxWidth: '600px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  className="premium-input" 
                  placeholder="Enter WOF or Weaving Order Number (e.g. AT/2026/WOF/00001)..." 
                  value={productionFormNumber} 
                  onChange={e => setProductionFormNumber(e.target.value)} 
                  style={{ fontWeight: '800', paddingLeft: '38px', height: '42px', fontSize: '0.9rem' }} 
                />
              </div>
              <button 
                disabled={fetching} 
                type="submit" 
                className="btn btn-primary premium-btn" 
                style={{ height: '42px', padding: '0 2rem', backgroundColor: '#7f1d1d', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '800', cursor: 'pointer' }}
              >
                {fetching ? <Loader size={18} className="spin" /> : 'Fetch Details'}
              </button>
            </form>

            {selectedProductionForm && (
              <div style={{ 
                marginTop: '1.5rem', 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                gap: '1.5rem' 
              }}>
                {/* Card: Production Form Details */}
                <div style={{ 
                  backgroundColor: 'var(--surface-current, #fff)', 
                  border: '1px solid var(--border-current, #eee)', 
                  borderRadius: '12px', 
                  padding: '1.5rem',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}>
                  <h4 style={{ 
                    margin: '0 0 1rem 0', 
                    fontSize: '0.9rem', 
                    fontWeight: '900', 
                    color: '#7f1d1d', 
                    textTransform: 'uppercase', 
                    letterSpacing: '1px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <FileText size={16} /> Production Form Details
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
                    <div>
                      <div style={{ color: '#64748b', fontWeight: '600', fontSize: '0.75rem' }}>FORM TYPE</div>
                      <div style={{ fontWeight: '800', color: '#1e293b', marginTop: '2px', textTransform: 'uppercase' }}>
                        {productionFormType === 'warping' ? 'Warping (WOF)' : 'Weaving (WEV)'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontWeight: '600', fontSize: '0.75rem' }}>NUMBER</div>
                      <div style={{ fontWeight: '800', color: '#1e293b', marginTop: '2px' }}>
                        {productionFormType === 'warping' ? selectedProductionForm.wof_number : selectedProductionForm.weaving_number}
                      </div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ color: '#64748b', fontWeight: '600', fontSize: '0.75rem' }}>ORDER NUMBER</div>
                      <div style={{ fontWeight: '800', color: '#1e293b', marginTop: '2px' }}>
                        {selectedProductionForm.order?.order_number || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontWeight: '600', fontSize: '0.75rem' }}>DESIGN NO</div>
                      <div style={{ fontWeight: '800', color: '#1e293b', marginTop: '2px' }}>
                        {selectedProductionForm.design_no || selectedProductionForm.order?.design_no || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontWeight: '600', fontSize: '0.75rem' }}>STATUS</div>
                      <div style={{ marginTop: '2px' }}>
                        <span style={{ 
                          padding: '0.15rem 0.5rem', 
                          borderRadius: '4px', 
                          fontSize: '0.75rem', 
                          fontWeight: '800',
                          backgroundColor: selectedProductionForm.status === 'completed' ? '#dcfce7' : '#fef9c3',
                          color: selectedProductionForm.status === 'completed' ? '#15803d' : '#854d0e',
                          textTransform: 'capitalize'
                        }}>
                          {selectedProductionForm.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {(selectedDof || (sourceType === 'production' && selectedProductionForm)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {Object.entries(groupedItemsByOrder()).map(([oid, group]) => (
              <div key={oid} className="glass-panel" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#fcfaf9', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="premium-group-header">
                    ORDER: {group.info.number} {group.info.design && `· ${group.info.design}`}
                  </div>
                </div>
                
                {group.warp.length > 0 && (
                  <div style={{ padding: '1.5rem' }}>
                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: '900', color: '#7f1d1d', textTransform: 'uppercase', letterSpacing: '0.5px', borderLeft: '4px solid #7f1d1d', paddingLeft: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Dna size={18} />
                      {sourceType === 'partner' ? 'Warp Details' : 'Warp Yarn Returns'}
                    </h4>
                    <table className="item-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        {sourceType === 'partner' ? (
                          <tr>
                            <th className="premium-th" style={{ width: '12%' }}>Count</th>
                            <th className="premium-th" style={{ width: '10%' }}>Colour</th>
                            <th className="premium-th premium-th-right" style={{ width: '10%' }}>Required (kg)</th>
                            <th className="premium-th premium-th-right" style={{ width: '10%' }}>Sent (kg)</th>
                            <th className="premium-th premium-th-right" style={{ width: '10%' }}>Prev. Rec (kg)</th>
                            <th className="premium-th premium-th-right" style={{ width: '10%', color: '#b91c1c' }}>Balance (kg)</th>
                            <th className="premium-th" style={{ width: '10%' }}>Received Weight (kg)</th>
                            <th className="premium-th" style={{ width: '10%' }}>Lot Number</th>
                            <th className="premium-th" style={{ width: '10%' }}>Location</th>
                            <th className="premium-th" style={{ width: '8%', textAlign: 'center' }}>Actions</th>
                          </tr>
                        ) : (
                          <tr>
                            <th className="premium-th" style={{ width: '15%' }}>Count</th>
                            <th className="premium-th" style={{ width: '15%' }}>Colour</th>
                            <th className="premium-th" style={{ width: '15%' }}>Lot Number</th>
                            <th className="premium-th premium-th-right" style={{ width: '15%' }}>Delivered Qty (kg)</th>
                            <th className="premium-th" style={{ width: '15%' }}>Return Qty (kg)</th>
                            <th className="premium-th" style={{ width: '15%' }}>Location</th>
                            <th className="premium-th" style={{ width: '10%', textAlign: 'center' }}>Actions</th>
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {group.warp.map((item, idx) => (
                          sourceType === 'partner' ? (
                            <DataRow 
                              key={`warp-${idx}`} 
                              item={item} 
                              yarnCounts={yarnCounts} 
                              locations={locations} 
                              updateItem={(f, v) => updateItem(item.originalIndex, f, v)}
                              onAddLot={() => addLotSplit(item.originalIndex)}
                              onRemoveLot={() => removeLotSplit(item.originalIndex)}
                            />
                          ) : (
                            <ProductionDataRow 
                              key={`warp-${idx}`} 
                              item={item} 
                              yarnCounts={yarnCounts} 
                              locations={locations} 
                              updateItem={(f, v) => updateItem(item.originalIndex, f, v)}
                              onAddLot={() => addLotSplit(item.originalIndex)}
                              onRemoveLot={() => removeLotSplit(item.originalIndex)}
                            />
                          )
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {group.weft.length > 0 && (
                  <div style={{ padding: '1.5rem' }}>
                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: '900', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px', borderLeft: '4px solid #0d9488', paddingLeft: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Dna size={18} />
                      {sourceType === 'partner' ? 'Weft Details' : 'Weft Yarn Returns'}
                    </h4>
                    <table className="item-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        {sourceType === 'partner' ? (
                          <tr>
                            <th className="premium-th" style={{ width: '12%' }}>Count</th>
                            <th className="premium-th" style={{ width: '10%' }}>Colour</th>
                            <th className="premium-th premium-th-right" style={{ width: '10%' }}>Required (kg)</th>
                            <th className="premium-th premium-th-right" style={{ width: '10%' }}>Sent (kg)</th>
                            <th className="premium-th premium-th-right" style={{ width: '10%' }}>Prev. Rec (kg)</th>
                            <th className="premium-th premium-th-right" style={{ width: '10%', color: '#b91c1c' }}>Balance (kg)</th>
                            <th className="premium-th" style={{ width: '10%' }}>Received Weight (kg)</th>
                            <th className="premium-th" style={{ width: '10%' }}>Lot Number</th>
                            <th className="premium-th" style={{ width: '10%' }}>Location</th>
                            <th className="premium-th" style={{ width: '8%', textAlign: 'center' }}>Actions</th>
                          </tr>
                        ) : (
                          <tr>
                            <th className="premium-th" style={{ width: '15%' }}>Count</th>
                            <th className="premium-th" style={{ width: '15%' }}>Colour</th>
                            <th className="premium-th" style={{ width: '15%' }}>Lot Number</th>
                            <th className="premium-th premium-th-right" style={{ width: '15%' }}>Delivered Qty (kg)</th>
                            <th className="premium-th" style={{ width: '15%' }}>Return Qty (kg)</th>
                            <th className="premium-th" style={{ width: '15%' }}>Location</th>
                            <th className="premium-th" style={{ width: '10%', textAlign: 'center' }}>Actions</th>
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {group.weft.map((item, idx) => (
                          sourceType === 'partner' ? (
                            <DataRow 
                              key={`weft-${idx}`} 
                              item={item} 
                              yarnCounts={yarnCounts} 
                              locations={locations} 
                              updateItem={(f, v) => updateItem(item.originalIndex, f, v)}
                              onAddLot={() => addLotSplit(item.originalIndex)}
                              onRemoveLot={() => removeLotSplit(item.originalIndex)}
                            />
                          ) : (
                            <ProductionDataRow 
                              key={`weft-${idx}`} 
                              item={item} 
                              yarnCounts={yarnCounts} 
                              locations={locations} 
                              updateItem={(f, v) => updateItem(item.originalIndex, f, v)}
                              onAddLot={() => addLotSplit(item.originalIndex)}
                              onRemoveLot={() => removeLotSplit(item.originalIndex)}
                            />
                          )
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <button onClick={() => navigate('/dyed-yarn')} className="btn btn-secondary premium-btn" style={{ height: '42px', padding: '0 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', cursor: 'pointer', fontWeight: '800' }}>Cancel</button>
              <button onClick={handleProceed} className="btn btn-primary premium-btn" style={{ height: '42px', padding: '0 2.5rem', fontWeight: '900', backgroundColor: '#7f1d1d', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 6px rgba(127, 29, 29, 0.15)' }}>Confirm Logistics <ChevronRight size={18} /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="premium-modal-overlay">
            <div className="premium-modal-card">
              <h3 style={{ margin: '0 0 1.5rem 0', fontWeight: '950', fontSize: '1.25rem', color: '#7f1d1d', letterSpacing: '0.5px' }}>Finalize Receipt</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {sourceType === 'partner' && (
                  <div style={{ padding: '1.25rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#166534', letterSpacing: '0.5px' }}>DOF COMPLETION PROGRESS</span>
                      <span style={{ fontSize: '1rem', fontWeight: '900', color: '#166534' }}>{dofProgress.toFixed(1)}%</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden', marginBottom: '1rem' }}>
                      <div style={{ 
                        width: `${Math.min(100, dofProgress)}%`, 
                        height: '100%', 
                        background: 'linear-gradient(90deg, #22c55e, #16a34a)', 
                        borderRadius: '9999px',
                        transition: 'width 0.4s ease-out'
                      }} />
                    </div>
                    {dofProgress >= 95 && (
                      <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle size={16} /> Within 5% tolerance. System recommends CLOSING this DOF.
                      </div>
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                      <input 
                        type="checkbox" 
                        style={{ width: '20px', height: '20px', accentColor: '#166534' }} 
                        checked={isClosingDof} 
                        onChange={e => setIsClosingDof(e.target.checked)}
                      />
                      <span style={{ fontWeight: '800', fontSize: '0.9rem' }}>Fully Received (Close DOF)</span>
                    </label>
                  </div>
                )}

                <div>
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '0.8rem', color: '#475569', marginBottom: '0.35rem', display: 'block' }}>DC Number</label>
                  <input className="premium-input" placeholder="e.g. DC-12345" value={logistics.dc_number} onChange={e => setLogistics({...logistics, dc_number: e.target.value})} style={{ fontWeight: '800' }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '0.8rem', color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Vehicle No</label>
                  <input className="premium-input" placeholder="e.g. TN 01 AB 1234" value={logistics.vehicle_no} onChange={e => setLogistics({...logistics, vehicle_no: e.target.value})} style={{ fontWeight: '800' }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '0.8rem', color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Received By</label>
                  <select
                    className="premium-select"
                    value={logistics.received_by}
                    onChange={e => setLogistics({...logistics, received_by: e.target.value})}
                    style={{ backgroundColor: '#fff', cursor: 'pointer', fontWeight: '800' }}
                  >
                    <option value="">Select Personnel...</option>
                    {logistics.received_by && !yarnWorkers.some(w => w.worker_name === logistics.received_by) && (
                      <option value={logistics.received_by}>{logistics.received_by}</option>
                    )}
                    {yarnWorkers.map(w => (
                      <option key={w.id} value={w.worker_name}>{w.worker_name}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button onClick={() => setStep(1)} className="btn btn-secondary premium-btn" style={{ flex: 1, height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', cursor: 'pointer', fontWeight: '800' }}>Back</button>
                  <button 
                    onClick={handleSubmit} 
                    disabled={loading} 
                    className="btn btn-primary premium-btn" 
                    style={{ 
                      flex: 2, 
                      height: '42px',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: '900', 
                      backgroundColor: '#7f1d1d',
                      color: '#fff',
                      opacity: loading ? 0.7 : 1,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 6px rgba(127, 29, 29, 0.15)'
                    }}
                  >
                    {loading ? <Loader size={18} className="spin" /> : 'Confirm & Generate'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DataRow({ item, yarnCounts, locations, updateItem, onAddLot, onRemoveLot }) {
  const countObj = yarnCounts.find(y => y.id === item.yarn_count_id);
  const balance = Math.max(0, item.sent_qty - item.historical_qty);
  
  return (
    <tr className="premium-row" style={{ backgroundColor: item.isSplit ? '#f8fafc' : 'transparent', borderBottom: '1px solid #f1f5f9' }}>
      <td className="premium-td">
        {item.isSplit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', paddingLeft: '1rem', fontWeight: '700', fontSize: '0.85rem' }}>
            <MoveHorizontal size={14} />
            <span>↳ Lot Split</span>
          </div>
        ) : (
          <span style={{ fontWeight: '800', color: '#1e293b' }}>
            {countObj?.count_value || '-'}
          </span>
        )}
      </td>
      <td className="premium-td" style={{ fontWeight: '700', color: '#7f1d1d' }}>
        {item.isSplit ? '' : item.colour}
      </td>
      <td className="premium-td premium-td-right" style={{ fontWeight: '600' }}>
        {item.isSplit ? '' : item.required_qty.toFixed(2)}
      </td>
      <td className="premium-td premium-td-right" style={{ fontWeight: '600' }}>
        {item.isSplit ? '' : item.sent_qty.toFixed(2)}
      </td>
      <td className="premium-td premium-td-right" style={{ fontWeight: '700', color: '#16a34a' }}>
        {item.isSplit ? '' : item.historical_qty.toFixed(2)}
      </td>
      <td className="premium-td premium-td-right" style={{ fontWeight: '800', color: '#b91c1c' }}>
        {item.isSplit ? '' : balance.toFixed(2)}
      </td>
      <td className="premium-td">
        <input 
          type="number" 
          step="0.01" 
          className="premium-input" 
          style={{ textAlign: 'right', fontWeight: '900', fontSize: '1rem', padding: '6px 12px' }} 
          value={item.received_weight} 
          onChange={e => updateItem('received_weight', e.target.value)} 
          placeholder="0.00" 
        />
      </td>
      <td className="premium-td">
        <input 
          type="text" 
          className="premium-input" 
          style={{ fontWeight: '700', fontSize: '0.875rem', padding: '6px 12px' }} 
          value={item.lot_number || ''} 
          onChange={e => updateItem('lot_number', e.target.value)} 
          placeholder="e.g. Lot 1" 
        />
      </td>
      <td className="premium-td">
        <select 
          className="premium-select" 
          style={{ fontWeight: '700', fontSize: '0.85rem' }} 
          value={item.location_id} 
          onChange={e => updateItem('location_id', e.target.value)}
        >
          <option value="">Select Location</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
        </select>
      </td>
      <td className="premium-td" style={{ textAlign: 'center' }}>
        {item.isSplit ? (
          <button 
            type="button"
            onClick={onRemoveLot}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#ef4444', 
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.2s'
            }}
            title="Remove Lot Split"
            className="premium-btn"
          >
            <X size={18} />
          </button>
        ) : (
          <button 
            type="button"
            onClick={onAddLot}
            className="btn btn-secondary premium-btn"
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.75rem', 
              fontWeight: '800', 
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            + Add Lot
          </button>
        )}
      </td>
    </tr>
  );
}

function ProductionDataRow({ item, yarnCounts, locations, updateItem, onAddLot, onRemoveLot }) {
  const countObj = yarnCounts.find(y => y.id === item.yarn_count_id);
  
  return (
    <tr className="premium-row" style={{ backgroundColor: item.isSplit ? '#f8fafc' : 'transparent', borderBottom: '1px solid #f1f5f9' }}>
      <td className="premium-td">
        {item.isSplit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', paddingLeft: '1rem', fontWeight: '700', fontSize: '0.85rem' }}>
            <MoveHorizontal size={14} />
            <span>↳ Lot Split</span>
          </div>
        ) : (
          <span style={{ fontWeight: '800', color: '#1e293b' }}>
            {countObj?.count_value || '-'}
          </span>
        )}
      </td>
      <td className="premium-td" style={{ fontWeight: '700', color: '#7f1d1d' }}>
        {item.isSplit ? '' : item.colour}
      </td>
      <td className="premium-td">
        <input 
          type="text" 
          className="premium-input" 
          style={{ fontWeight: '700', fontSize: '0.875rem', padding: '6px 12px' }} 
          value={item.lot_number || ''} 
          onChange={e => updateItem('lot_number', e.target.value)} 
          placeholder="e.g. Lot 1" 
        />
      </td>
      <td className="premium-td premium-td-right" style={{ fontWeight: '600' }}>
        {item.isSplit ? '' : item.sent_qty.toFixed(2)}
      </td>
      <td className="premium-td">
        <input 
          type="number" 
          step="0.01" 
          className="premium-input" 
          style={{ textAlign: 'right', fontWeight: '900', fontSize: '1rem', padding: '6px 12px' }} 
          value={item.received_weight} 
          onChange={e => updateItem('received_weight', e.target.value)} 
          placeholder="0.00" 
        />
      </td>
      <td className="premium-td">
        <select 
          className="premium-select" 
          style={{ fontWeight: '700', fontSize: '0.85rem' }} 
          value={item.location_id} 
          onChange={e => updateItem('location_id', e.target.value)}
        >
          <option value="">Select Location</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
        </select>
      </td>
      <td className="premium-td" style={{ textAlign: 'center' }}>
        {item.isSplit ? (
          <button 
            type="button"
            onClick={onRemoveLot}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#ef4444', 
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.2s'
            }}
            title="Remove Lot Split"
            className="premium-btn"
          >
            <X size={18} />
          </button>
        ) : (
          <button 
            type="button"
            onClick={onAddLot}
            className="btn btn-secondary premium-btn"
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.75rem', 
              fontWeight: '800', 
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            + Add Lot
          </button>
        )}
      </td>
    </tr>
  );
}

const subThStyle = {
  padding: '0.6rem 0.8rem',
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: '800',
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const subNumericThStyle = {
  ...subThStyle,
  textAlign: 'right'
};

const subTdStyle = {
  padding: '0.6rem 0.8rem',
  fontSize: '0.75rem',
  color: '#334155',
  fontWeight: '500'
};

const subNumericTdStyle = {
  ...subTdStyle,
  textAlign: 'right',
  fontWeight: '700'
};

