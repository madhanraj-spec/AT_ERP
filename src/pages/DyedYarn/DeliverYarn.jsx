import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Search, Truck, 
  AlertCircle, ChevronDown, ChevronRight, CheckCircle,
  Loader, Layers, Calendar, User, Info, Inbox
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import DYDRDetail from '../../components/DYDRDetail';
import { printDydr } from '../../utils/printDydr';

function getYarnStatusBadge(allotments, associatedDydrs) {
  const totalAllotted = (allotments || []).reduce((sum, a) => sum + parseFloat(a.allotted_qty || a.kg || a.allottedQty || 0), 0);
  const totalDelivered = (associatedDydrs || []).reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

  if (totalAllotted === 0) {
    return { label: 'Not Required', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
  }
  if (totalDelivered === 0) {
    return { label: 'Not Delivered', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
  }
  if (totalDelivered < totalAllotted - 0.05) {
    return { label: 'Partially Delivered', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
  }
  return { label: 'Delivered', bg: '#dcfce7', color: '#166534', border: '#86efac' };
}

export default function DeliverDyedYarn() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  // Page states
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [step, setStep] = useState(1); // 1 = Search & Verify, 2 = Stock Allocation & Receipt Info
  const [printDydrData, setPrintDydrData] = useState(null);
  
  // Form step 1: Search WOF / Weaving Order
  const [targetProcess, setTargetProcess] = useState('warping'); // 'warping' or 'weaving'
  const [enteredDocNo, setEnteredDocNo] = useState('');
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [orderFormError, setOrderFormError] = useState('');

  // Form step 2: Delivery Header Details
  const [deliveredDate, setDeliveredDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveredBy, setDeliveredBy] = useState('');
  const [deliveryType, setDeliveryType] = useState('in_house'); // 'in_house' or 'job_work'
  const [vehicleNo, setVehicleNo] = useState('');
  const [remarks, setRemarks] = useState('');
  
  // Delivery Line Items & Masters
  const [items, setItems] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [yarnWorkers, setYarnWorkers] = useState([]);
  const [docList, setDocList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [dydrsByDoc, setDydrsByDoc] = useState({});
  const [loadingDydrs, setLoadingDydrs] = useState(false);

  const handleToggleExpandDoc = (docId) => {
    setExpandedDocId(expandedDocId === docId ? null : docId);
  };
  
  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    fetchDocList();
  }, [targetProcess]);

  const fetchMasters = async () => {
    const { data } = await supabase.from('master_yarn_counts').select('*');
    setYarnCounts(data || []);

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

  const fetchDocList = async () => {
    setLoadingList(true);
    setExpandedDocId(null);
    setDydrsByDoc({});
    try {
      if (targetProcess === 'warping') {
        const { data, error } = await supabase
          .from('warping_order_forms')
          .select(`
            *,
            order:orders(id, order_number, design_no, design_name, yarn_requirements),
            machine:master_machines(machine_name),
            partner:master_partners(partner_name)
          `)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setDocList(data || []);

        const wofIds = (data || []).map(w => w.id);
        if (wofIds.length > 0) {
          setLoadingDydrs(true);
          const { data: dydrData } = await supabase
            .from('dyed_yarn_delivery_items')
            .select(`
              id,
              production_form_id,
              yarn_count_id,
              quantity_kg,
              no_of_bags,
              cone_weight,
              colour,
              lot_number,
              yarn_count:master_yarn_counts(count_value, material, product_type),
              delivery:dyed_yarn_deliveries(
                id,
                dydr_number,
                delivered_date,
                delivered_by,
                vehicle_no,
                remarks
              )
            `)
            .in('production_form_id', wofIds);
          
          const grouped = {};
          wofIds.forEach(id => { grouped[id] = []; });
          dydrData?.forEach(item => {
            if (grouped[item.production_form_id]) {
              grouped[item.production_form_id].push(item);
            }
          });
          setDydrsByDoc(grouped);
        }
      } else {
        const { data, error } = await supabase
          .from('weaving_orders')
          .select(`
            *,
            order:orders(id, order_number, design_no, design_name, yarn_requirements)
          `)
          .neq('status', 'pending')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setDocList(data || []);

        const weavingIds = (data || []).map(w => w.id);
        if (weavingIds.length > 0) {
          setLoadingDydrs(true);
          const { data: dydrData } = await supabase
            .from('dyed_yarn_delivery_items')
            .select(`
              id,
              production_form_id,
              yarn_count_id,
              quantity_kg,
              no_of_bags,
              cone_weight,
              colour,
              lot_number,
              yarn_count:master_yarn_counts(count_value, material, product_type),
              delivery:dyed_yarn_deliveries(
                id,
                dydr_number,
                delivered_date,
                delivered_by,
                vehicle_no,
                remarks
              )
            `)
            .in('production_form_id', weavingIds);
          
          const grouped = {};
          weavingIds.forEach(id => { grouped[id] = []; });
          dydrData?.forEach(item => {
            if (grouped[item.production_form_id]) {
              grouped[item.production_form_id].push(item);
            }
          });
          setDydrsByDoc(grouped);
        }
      }
    } catch (err) {
      console.error('Error fetching document list:', err);
    } finally {
      setLoadingList(false);
      setLoadingDydrs(false);
    }
  };

  const handleSearchOrderForm = async (e) => {
    if (e) e.preventDefault();
    if (!enteredDocNo.trim()) {
      setOrderFormError('Please enter an order form number.');
      return;
    }

    setSearching(true);
    setOrderFormError('');
    setSelectedTarget(null);

    try {
      if (targetProcess === 'warping') {
        const { data, error } = await supabase
          .from('warping_order_forms')
          .select(`
            *,
            order:orders(id, order_number, design_no, design_name, yarn_requirements),
            machine:master_machines(machine_name),
            partner:master_partners(partner_name)
          `)
          .ilike('wof_number', enteredDocNo.trim())
          .single();

        if (error || !data) {
          setOrderFormError('Warping Order Form not found. Please verify the WOF Number.');
        } else {
          setSelectedTarget(data);
          // Auto-set delivery type based on warping form type
          setDeliveryType(data.wof_type || 'in_house');

          // Fetch associated DYDRs for this searched warping order form
          const { data: dydrData } = await supabase
            .from('dyed_yarn_delivery_items')
            .select(`
              id,
              production_form_id,
              yarn_count_id,
              quantity_kg,
              no_of_bags,
              cone_weight,
              colour,
              lot_number,
              yarn_count:master_yarn_counts(count_value, material, product_type),
              delivery:dyed_yarn_deliveries(
                id,
                dydr_number,
                delivered_date,
                delivered_by,
                vehicle_no,
                remarks
              )
            `)
            .eq('production_form_id', data.id);
          if (dydrData) {
            setDydrsByDoc(prev => ({ ...prev, [data.id]: dydrData }));
          }
        }
      } else {
        const { data, error } = await supabase
          .from('weaving_orders')
          .select(`
            *,
            order:orders(id, order_number, design_no, design_name, yarn_requirements)
          `)
          .ilike('weaving_number', enteredDocNo.trim())
          .neq('status', 'pending')
          .single();

        if (error || !data) {
          setOrderFormError('Weaving Order not found or not yet allotted. Please verify the Weaving Order Number.');
        } else {
          setSelectedTarget(data);
          setDeliveryType(data.weaving_type || 'in_house');

          // Fetch associated DYDRs for this searched weaving order
          const { data: dydrData } = await supabase
            .from('dyed_yarn_delivery_items')
            .select(`
              id,
              production_form_id,
              yarn_count_id,
              quantity_kg,
              no_of_bags,
              cone_weight,
              colour,
              lot_number,
              yarn_count:master_yarn_counts(count_value, material, product_type),
              delivery:dyed_yarn_deliveries(
                id,
                dydr_number,
                delivered_date,
                delivered_by,
                vehicle_no,
                remarks
              )
            `)
            .eq('production_form_id', data.id);
          if (dydrData) {
            setDydrsByDoc(prev => ({ ...prev, [data.id]: dydrData }));
          }
        }
      }
    } catch (err) {
      console.error(err);
      setOrderFormError('An error occurred while fetching the order form.');
    } finally {
      setSearching(false);
    }
  };

  const handleProceedToDelivery = async (targetDoc) => {
    // If targetDoc is a React Event or doesn't have an id, default to selectedTarget
    const isEvent = targetDoc && (targetDoc.nativeEvent || targetDoc.preventDefault || targetDoc.stopPropagation);
    const doc = (targetDoc && !isEvent && targetDoc.id) ? targetDoc : selectedTarget;
    if (!doc) return;

    // Safety guard: check if yarn status is already Delivered (complete)
    const allotments = targetProcess === 'warping'
      ? (doc.colour_allotments || [])
      : (doc.weft_allotments || []);
    const associatedDydrs = dydrsByDoc[doc.id] || [];
    const yarnBadge = getYarnStatusBadge(allotments, associatedDydrs);
    if (yarnBadge.label === 'Delivered') {
      alert(`Yarn status is Delivered. You cannot deliver more dyed yarn for this order.`);
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch dyed yarn receipts for this order
      const { data: receipts, error: recErr } = await supabase
        .from('dyed_yarn_receipt_items')
        .select(`
          *,
          receipt:dyed_yarn_receipts(dof_id, dof_number),
          location:master_locations(location_name)
        `)
        .eq('order_id', doc.order_id);

      if (recErr) throw recErr;

      // 2. Fetch dyed yarn deliveries already made for this order
      const { data: deliveries, error: delErr } = await supabase
        .from('dyed_yarn_delivery_items')
        .select(`
          *,
          source_receipt:dyed_yarn_receipts(dof_id)
        `)
        .eq('order_id', doc.order_id);

      if (delErr) throw delErr;

      // Fetch all existing warping and weaving forms for this order to filter out orphaned deliveries
      const [{ data: activeWarping }, { data: activeWeaving }] = await Promise.all([
        supabase.from('warping_order_forms').select('id').eq('order_id', doc.order_id),
        supabase.from('weaving_orders').select('id').eq('order_id', doc.order_id)
      ]);

      const activeFormIds = new Set([
        ...(activeWarping || []).map(w => w.id),
        ...(activeWeaving || []).map(w => w.id)
      ]);

      const validDeliveries = (deliveries || []).filter(d => 
        !d.production_form_id || activeFormIds.has(d.production_form_id)
      );

      // 3. Summarize stock in hand grouped by count, colour, lot, location, and dof_id
      const stockMap = {};
      receipts?.forEach(r => {
        const key = `${r.yarn_count_id}-${r.colour}-${r.lot_number || ''}-${r.location_id || ''}-${r.receipt?.dof_id || ''}`;
        if (!stockMap[key]) {
          stockMap[key] = {
            yarn_count_id: r.yarn_count_id,
            colour: r.colour,
            lot_number: r.lot_number || '—',
            location_id: r.location_id,
            location_name: r.location?.location_name || '—',
            dof_id: r.receipt?.dof_id || null,
            dof_number: r.receipt?.dof_number || '—',
            receipt_id: r.receipt_id,
            available: 0
          };
        }
        stockMap[key].available += parseFloat(r.quantity_kg || 0);
      });

      validDeliveries.forEach(d => {
        const dofId = d.source_receipt?.dof_id || '';
        const key = `${d.yarn_count_id}-${d.colour}-${d.lot_number || ''}-${d.location_id || ''}-${dofId}`;
        if (stockMap[key]) {
          stockMap[key].available -= parseFloat(d.quantity_kg || 0);
        } else {
          // Fallback for legacy deliveries: subtract from any matching stockMap key
          const fallbackKey = Object.keys(stockMap).find(k => k.startsWith(`${d.yarn_count_id}-${d.colour}-${d.lot_number || ''}-${d.location_id || ''}-`));
          if (fallbackKey) {
            stockMap[fallbackKey].available -= parseFloat(d.quantity_kg || 0);
          }
        }
      });

      // 4. Build line items based on WOF/Weaving requirements
      const builtItems = [];

      if (targetProcess === 'warping') {
        const requirements = doc.colour_allotments || [];
        requirements.forEach(req => {
          const countId = req.countId || req.count_id;
          const colour = req.colour || req.color || req.colour;
          const allottedQty = parseFloat(req.allotted_qty || req.kg || 0);

          // Calculate already delivered quantity for this specific requirement of this form
          const formDeliveries = validDeliveries.filter(d => 
            d.production_form_id === doc.id &&
            d.yarn_count_id === countId &&
            d.colour === colour
          );
          const deliveredQty = formDeliveries.reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

          // Find available stock matching this requirement
          const matchingStocks = Object.values(stockMap).filter(s => 
            s.yarn_count_id === countId && 
            s.colour === colour &&
            s.available > 0.01
          );

          let defaultAllocations = [];
          if (matchingStocks.length === 1) {
            defaultAllocations = [{
              lot_number: matchingStocks[0].lot_number,
              location_id: matchingStocks[0].location_id,
              location_name: matchingStocks[0].location_name,
              dof_id: matchingStocks[0].dof_id,
              dof_number: matchingStocks[0].dof_number,
              receipt_id: matchingStocks[0].receipt_id,
              stock_kg: matchingStocks[0].available,
              quantity_kg: '',
              no_of_bags: '',
              selectedIndex: '0'
            }];
          } else if (matchingStocks.length > 1) {
            defaultAllocations = [{
              lot_number: '',
              location_id: null,
              location_name: '',
              dof_id: null,
              dof_number: '',
              receipt_id: null,
              stock_kg: 0,
              quantity_kg: '',
              no_of_bags: '',
              selectedIndex: ''
            }];
          } else {
            defaultAllocations = [{
              lot_number: '',
              location_id: null,
              location_name: 'No stock in warehouse',
              dof_id: null,
              dof_number: '—',
              receipt_id: null,
              stock_kg: 0,
              quantity_kg: '',
              no_of_bags: '',
              disabled: true,
              selectedIndex: ''
            }];
          }

          builtItems.push({
            yarn_count_id: countId,
            colour: colour,
            allotted_qty: allottedQty,
            delivered_qty: deliveredQty,
            availableStocks: matchingStocks,
            allocations: defaultAllocations
          });
        });
      } else {
        // Weaving - load from specific weft_allotments!
        const requirements = doc.weft_allotments || [];
        requirements.forEach(req => {
          const countId = req.yarn_count_id || req.countId || req.count_id;
          const colour = req.colour || req.colour;
          const allottedQty = parseFloat(req.allotted_qty || 0);
          const lotNum = req.lot_number;
          const locId = req.location_id;

          // Calculate already delivered quantity for this specific allotment of this form (matching count, colour, lot, location)
          const formDeliveries = validDeliveries.filter(d => 
            d.production_form_id === doc.id &&
            d.yarn_count_id === countId &&
            d.colour === colour &&
            (d.lot_number === lotNum || (!d.lot_number && !lotNum) || (d.lot_number === '—' && !lotNum) || (lotNum === '—' && !d.lot_number)) &&
            d.location_id === locId
          );
          const deliveredQty = formDeliveries.reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

          // Find available stock matching this count and colour
          const matchingStocks = Object.values(stockMap).filter(s => 
            s.yarn_count_id === countId && 
            s.colour === colour &&
            s.available > 0.01
          );

          let defaultAllocations = [];
          if (matchingStocks.length > 0) {
            // Find stock matching the allotted lot and location by preference
            const matchedIdx = matchingStocks.findIndex(s => 
              (s.lot_number === lotNum || (!s.lot_number && !lotNum) || (s.lot_number === '—' && !lotNum) || (lotNum === '—' && !s.lot_number)) &&
              s.location_id === locId
            );
            
            const selectedIdx = matchedIdx !== -1 ? matchedIdx : 0;
            const defaultStock = matchingStocks[selectedIdx];

            defaultAllocations = [{
              lot_number: defaultStock.lot_number,
              location_id: defaultStock.location_id,
              location_name: defaultStock.location_name,
              dof_id: defaultStock.dof_id,
              dof_number: defaultStock.dof_number,
              receipt_id: defaultStock.receipt_id,
              stock_kg: defaultStock.available,
              quantity_kg: '',
              no_of_bags: '',
              selectedIndex: selectedIdx.toString(),
              disabled: false
            }];
          } else {
            defaultAllocations = [{
              lot_number: lotNum || '—',
              location_id: locId,
              location_name: req.location_name || 'No stock in warehouse',
              dof_id: null,
              dof_number: '—',
              receipt_id: null,
              stock_kg: 0,
              quantity_kg: '',
              no_of_bags: '',
              disabled: true,
              selectedIndex: ''
            }];
          }

          builtItems.push({
            yarn_count_id: countId,
            colour: colour,
            allotted_qty: allottedQty,
            delivered_qty: deliveredQty,
            availableStocks: matchingStocks,
            allocations: defaultAllocations
          });
        });
      }

      setSelectedTarget(doc);
      if (targetProcess === 'warping') {
        setDeliveryType(doc.wof_type || 'in_house');
      } else {
        setDeliveryType(doc.weaving_type || 'in_house');
      }
      setItems(builtItems);
      setStep(2);
    } catch (err) {
      console.error(err);
      alert('Error fetching warehouse stock: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addAllocationRow = (reqIndex) => {
    const newItems = [...items];
    newItems[reqIndex].allocations.push({
      lot_number: '',
      location_id: null,
      location_name: '',
      dof_id: null,
      dof_number: '',
      receipt_id: null,
      stock_kg: 0,
      quantity_kg: '',
      no_of_bags: '',
      selectedIndex: ''
    });
    setItems(newItems);
  };

  const removeAllocationRow = (reqIndex, allocIndex) => {
    const newItems = [...items];
    newItems[reqIndex].allocations.splice(allocIndex, 1);
    if (newItems[reqIndex].allocations.length === 0) {
      newItems[reqIndex].allocations.push({
        lot_number: '',
        location_id: null,
        location_name: '',
        dof_id: null,
        dof_number: '',
        receipt_id: null,
        stock_kg: 0,
        quantity_kg: '',
        no_of_bags: '',
        selectedIndex: ''
      });
    }
    setItems(newItems);
  };

  const updateAllocation = (reqIndex, allocIndex, field, value) => {
    const newItems = [...items];
    const alloc = newItems[reqIndex].allocations[allocIndex];
    const stocks = newItems[reqIndex].availableStocks || [];

    if (field === 'lot_number') {
      const selectedLot = value;
      alloc.lot_number = selectedLot;
      
      // Filter stocks matching the new lot number
      const matching = stocks.filter(s => !selectedLot || s.lot_number === selectedLot);
      
      // If there was a DOF selected, check if it's still valid under the selected lot
      let dofStillValid = false;
      if (alloc.dof_number) {
        dofStillValid = matching.some(s => s.dof_number === alloc.dof_number);
      }
      
      if (!dofStillValid) {
        alloc.dof_number = '';
        alloc.dof_id = null;
      }
      
      // Now find matching stock with both selected lot and selected DOF
      const finalMatch = stocks.find(s => 
        s.lot_number === selectedLot && 
        (!alloc.dof_number || s.dof_number === alloc.dof_number)
      );

      // If we don't have a final match but there's a unique DOF for this lot, auto-select it
      const uniqueDofsForLot = [...new Set(stocks.filter(s => s.lot_number === selectedLot).map(s => s.dof_number))];
      if (selectedLot && !alloc.dof_number && uniqueDofsForLot.length === 1) {
        alloc.dof_number = uniqueDofsForLot[0];
        const autoMatch = stocks.find(s => s.lot_number === selectedLot && s.dof_number === uniqueDofsForLot[0]);
        if (autoMatch) {
          alloc.location_id = autoMatch.location_id;
          alloc.location_name = autoMatch.location_name;
          alloc.dof_id = autoMatch.dof_id;
          alloc.dof_number = autoMatch.dof_number;
          alloc.receipt_id = autoMatch.receipt_id;
          alloc.stock_kg = autoMatch.available;
          alloc.selectedIndex = stocks.indexOf(autoMatch).toString();
          setItems(newItems);
          return;
        }
      }

      if (finalMatch && selectedLot && alloc.dof_number) {
        alloc.location_id = finalMatch.location_id;
        alloc.location_name = finalMatch.location_name;
        alloc.dof_id = finalMatch.dof_id;
        alloc.dof_number = finalMatch.dof_number;
        alloc.receipt_id = finalMatch.receipt_id;
        alloc.stock_kg = finalMatch.available;
        alloc.selectedIndex = stocks.indexOf(finalMatch).toString();
      } else {
        alloc.location_id = null;
        alloc.location_name = '';
        alloc.dof_id = null;
        alloc.receipt_id = null;
        alloc.stock_kg = 0;
        alloc.selectedIndex = '';
      }

    } else if (field === 'dof_number') {
      const selectedDof = value;
      alloc.dof_number = selectedDof;

      // Filter stocks matching the new DOF number
      const matching = stocks.filter(s => !selectedDof || s.dof_number === selectedDof);

      // If there was a lot selected, check if it's still valid under the selected DOF
      let lotStillValid = false;
      if (alloc.lot_number) {
        lotStillValid = matching.some(s => s.lot_number === alloc.lot_number);
      }

      if (!lotStillValid) {
        alloc.lot_number = '';
      }

      // Now find matching stock with both selected lot and selected DOF
      const finalMatch = stocks.find(s => 
        (!alloc.lot_number || s.lot_number === alloc.lot_number) && 
        s.dof_number === selectedDof
      );

      // If we don't have a final match but there's a unique lot for this DOF, auto-select it
      const uniqueLotsForDof = [...new Set(stocks.filter(s => s.dof_number === selectedDof).map(s => s.lot_number))];
      if (selectedDof && !alloc.lot_number && uniqueLotsForDof.length === 1) {
        alloc.lot_number = uniqueLotsForDof[0];
        const autoMatch = stocks.find(s => s.lot_number === uniqueLotsForDof[0] && s.dof_number === selectedDof);
        if (autoMatch) {
          alloc.location_id = autoMatch.location_id;
          alloc.location_name = autoMatch.location_name;
          alloc.dof_id = autoMatch.dof_id;
          alloc.dof_number = autoMatch.dof_number;
          alloc.receipt_id = autoMatch.receipt_id;
          alloc.stock_kg = autoMatch.available;
          alloc.selectedIndex = stocks.indexOf(autoMatch).toString();
          setItems(newItems);
          return;
        }
      }

      if (finalMatch && alloc.lot_number && selectedDof) {
        alloc.location_id = finalMatch.location_id;
        alloc.location_name = finalMatch.location_name;
        alloc.dof_id = finalMatch.dof_id;
        alloc.dof_number = finalMatch.dof_number;
        alloc.receipt_id = finalMatch.receipt_id;
        alloc.stock_kg = finalMatch.available;
        alloc.selectedIndex = stocks.indexOf(finalMatch).toString();
      } else {
        alloc.location_id = null;
        alloc.location_name = '';
        alloc.dof_id = null;
        alloc.receipt_id = null;
        alloc.stock_kg = 0;
        alloc.selectedIndex = '';
      }

    } else if (field === 'quantity_kg') {
      const floatVal = parseFloat(value) || 0;
      if (floatVal > alloc.stock_kg) {
        alloc.quantity_kg = alloc.stock_kg.toString();
      } else if (floatVal < 0) {
        alloc.quantity_kg = '0';
      } else {
        alloc.quantity_kg = value;
      }
    } else {
      alloc[field] = value;
    }
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) return alert('No items to deliver.');

    // Validate that total delivery for each requirement does not exceed remaining allotted quantity
    for (const req of items) {
      const totalAllocated = (req.allocations || []).reduce((sum, a) => sum + (parseFloat(a.quantity_kg) || 0), 0);
      const remainingAllotted = req.allotted_qty - req.delivered_qty;
      if (totalAllocated > remainingAllotted + 0.001) {
        alert(`Entered quantity for ${req.colour} (${totalAllocated.toFixed(2)} kg) exceeds the remaining allotted quantity of ${remainingAllotted.toFixed(2)} kg for this WOF!`);
        return;
      }
    }

    // Extract allocations with positive quantity
    const validItems = [];
    for (const req of items) {
      const allocations = req.allocations || [];
      for (const alloc of allocations) {
        const qty = parseFloat(alloc.quantity_kg) || 0;
        if (qty > 0) {
          // Validate quantity against available stock
          if (qty > alloc.stock_kg) {
            alert(`Entered quantity for ${req.colour} (${qty.toFixed(2)} kg) exceeds available stock of ${alloc.stock_kg.toFixed(2)} kg!`);
            return;
          }
          if (!alloc.lot_number || !alloc.dof_number) {
            alert(`Please select both Lot Number and DOF Number for the allocated quantity of ${req.colour}.`);
            return;
          }
          validItems.push({
            yarn_count_id: req.yarn_count_id,
            colour: req.colour,
            quantity_kg: qty,
            no_of_bags: parseInt(alloc.no_of_bags) || null,
            lot_number: alloc.lot_number,
            location_id: alloc.location_id,
            location_name: alloc.location_name,
            receipt_id: alloc.receipt_id
          });
        }
      }
    }

    if (validItems.length === 0) return alert('Please enter quantities for at least one lot.');

    if (!deliveredBy) return alert('Please enter the Delivered By person name.');
    if (deliveryType === 'job_work' && !vehicleNo) return alert('Please enter the Vehicle Number for job work.');

    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const { data: dydrNumber } = await supabase.rpc('get_next_dydr_number', { p_year: year });

      const { data: delivery, error: headError } = await supabase
        .from('dyed_yarn_deliveries')
        .insert([{
          dydr_number: dydrNumber,
          delivered_date: deliveredDate,
          delivered_by: deliveredBy,
          vehicle_no: deliveryType === 'job_work' ? vehicleNo : null,
          remarks: remarks,
          created_by: profile.id
        }])
        .select()
        .single();
      
      if (headError) throw headError;

      const itemsToInsert = validItems.map(i => ({
        delivery_id: delivery.id,
        order_id: selectedTarget.order_id,
        production_form_id: selectedTarget.id,
        process_type: targetProcess,
        yarn_count_id: i.yarn_count_id,
        colour: i.colour,
        quantity_kg: parseFloat(i.quantity_kg),
        no_of_bags: parseInt(i.no_of_bags) || null,
        lot_number: i.lot_number !== '—' ? i.lot_number : null,
        location_id: i.location_id || null,
        source_receipt_id: i.receipt_id || null
      }));

      const { error: itemsError } = await supabase.from('dyed_yarn_delivery_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // Recalculate yarn delivery status for the current document
      const docId = selectedTarget.id;
      const { data: allDydi } = await supabase
        .from('dyed_yarn_delivery_items')
        .select('quantity_kg')
        .eq('production_form_id', docId);

      const totalDelivered = (allDydi || []).reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);
      const allotments = targetProcess === 'warping'
        ? (selectedTarget.colour_allotments || [])
        : (selectedTarget.weft_allotments || []);
      const totalAllotted = allotments.reduce((sum, a) => sum + parseFloat(a.allotted_qty || a.kg || a.allottedQty || 0), 0);

      let nextYarnStatus = 'not_delivered';
      if (totalAllotted === 0) {
        nextYarnStatus = 'not_required';
      } else if (totalDelivered === 0) {
        nextYarnStatus = 'not_delivered';
      } else if (totalDelivered < totalAllotted - 0.05) {
        nextYarnStatus = 'partially_delivered';
      } else {
        nextYarnStatus = 'delivered';
      }

      if (targetProcess === 'warping') {
        await supabase
          .from('warping_order_forms')
          .update({ yarn_status: nextYarnStatus, updated_at: new Date().toISOString() })
          .eq('id', docId);
      } else {
        let mainStatus = 'weft_yarn_allotted';
        if (nextYarnStatus === 'delivered') {
          mainStatus = 'weft_yarn_delivered';
        } else if (nextYarnStatus === 'partially_delivered') {
          mainStatus = 'weft_yarn_partially_delivered';
        }

        const currentStatus = selectedTarget.status;
        const statusNeedsUpdate = ['weft_yarn_allotted', 'weft_yarn_partially_delivered', 'weft_yarn_delivered', 'pending'].includes(currentStatus);

        const updates = { 
          yarn_status: nextYarnStatus,
          updated_at: new Date().toISOString()
        };
        if (statusNeedsUpdate) {
          updates.status = mainStatus;
        }

        await supabase
          .from('weaving_orders')
          .update(updates)
          .eq('id', docId);
      }

      // Save delivery details to printDydrData to display receipt modal
      setPrintDydrData({
        dydr_number: dydrNumber,
        delivered_date: deliveredDate,
        delivered_by: deliveredBy,
        vehicle_no: deliveryType === 'job_work' ? vehicleNo : null,
        remarks: remarks,
        target_process: targetProcess,
        doc_no: targetProcess === 'warping' ? selectedTarget.wof_number : selectedTarget.weaving_number,
        machine_name: targetProcess === 'warping' ? (selectedTarget.machine?.machine_name || selectedTarget.machine_name || '—') : null,
        order_no: selectedTarget.order?.order_number || '—',
        design_no: selectedTarget.design_no || selectedTarget.order?.design_no || '—',
        design_name: selectedTarget.order?.design_name || '',
        items: validItems.map(i => ({
          yarn_count_id: i.yarn_count_id,
          colour: i.colour,
          quantity_kg: parseFloat(i.quantity_kg),
          lot_number: i.lot_number !== '—' ? i.lot_number : null,
          location_name: i.location_name
        }))
      });
    } catch (err) {
      console.error(err);
      alert('Error saving delivery: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getFormatCount = (id) => {
    const yc = yarnCounts.find(y => y.id === id);
    return yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : '—';
  };

  const selectedAllotments = selectedTarget
    ? (targetProcess === 'warping'
        ? (selectedTarget.colour_allotments || [])
        : (selectedTarget.weft_allotments || []))
    : [];
  const selectedDydrs = selectedTarget ? (dydrsByDoc[selectedTarget.id] || []) : [];
  const selectedYarnBadge = getYarnStatusBadge(selectedAllotments, selectedDydrs);
  const isSelectedTargetDelivered = selectedYarnBadge.label === 'Delivered';

  const hasOverAllocation = items.some(req => {
    const totalAllocated = (req.allocations || []).reduce((sum, a) => sum + (parseFloat(a.quantity_kg) || 0), 0);
    const remainingAllotted = req.allotted_qty - req.delivered_qty;
    return totalAllocated > remainingAllotted + 0.001;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => navigate('/dyed-yarn')} className="btn-icon">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: 'var(--text-current)' }}>Deliver Dyed Yarn</h1>
          <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>Issue dyed yarn to production units (Warping/Weaving)</p>
        </div>
      </div>

      {step === 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Unit Destination Selection */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-current)' }}>
              <Truck size={18} color="var(--color-primary)" />
              1. Delivery Destination Unit
            </h3>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <button 
                type="button"
                onClick={() => { setTargetProcess('warping'); setSelectedTarget(null); setOrderFormError(''); }}
                style={{
                  flex: 1, padding: '1.25rem', borderRadius: '12px', border: '2px solid',
                  borderColor: targetProcess === 'warping' ? '#800000' : 'var(--border-current)',
                  backgroundColor: targetProcess === 'warping' ? 'rgba(128, 0, 0, 0.04)' : 'var(--surface-current)',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                  boxShadow: targetProcess === 'warping' ? '0 4px 12px rgba(128,0,0,0.08)' : 'none'
                }}
              >
                <div style={{ fontWeight: '800', fontSize: '0.95rem', color: targetProcess === 'warping' ? '#800000' : 'var(--text-muted-current)' }}>To Warping Unit</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', marginTop: '0.25rem' }}>Deliver yarn to warping machines/partners</div>
              </button>
              <button 
                type="button"
                onClick={() => { setTargetProcess('weaving'); setSelectedTarget(null); setOrderFormError(''); }}
                style={{
                  flex: 1, padding: '1.25rem', borderRadius: '12px', border: '2px solid',
                  borderColor: targetProcess === 'weaving' ? '#800000' : 'var(--border-current)',
                  backgroundColor: targetProcess === 'weaving' ? 'rgba(128, 0, 0, 0.04)' : 'var(--surface-current)',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                  boxShadow: targetProcess === 'weaving' ? '0 4px 12px rgba(128,0,0,0.08)' : 'none'
                }}
              >
                <div style={{ fontWeight: '800', fontSize: '0.95rem', color: targetProcess === 'weaving' ? '#800000' : 'var(--text-muted-current)' }}>To Weaving Unit</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', marginTop: '0.25rem' }}>Deliver yarn directly for weaving/looms</div>
              </button>
            </div>

            {/* Document Number Entry */}
            <form onSubmit={handleSearchOrderForm} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', maxWidth: '600px' }}>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label className="form-label" style={{ fontWeight: '700' }}>
                  Enter {targetProcess === 'warping' ? 'Warping Order Form (WOF)' : 'Weaving Order'} Number
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={targetProcess === 'warping' ? 'e.g. AT/2026/WOF/00001' : 'e.g. AT/2026/WEV/00001'}
                  value={enteredDocNo}
                  onChange={e => setEnteredDocNo(e.target.value)}
                  style={{ fontWeight: '700', textTransform: 'uppercase' }}
                />
              </div>
              <button type="submit" disabled={searching} className="btn btn-primary" style={{ padding: '0.75rem 2rem', height: '42px', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#800000', border: 'none' }}>
                {searching ? <Loader size={16} className="spin" /> : <Search size={16} />} Find Form
              </button>
            </form>

            {orderFormError && (
              <div style={{ marginTop: '1rem', color: '#b91c1c', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <AlertCircle size={16} /> {orderFormError}
              </div>
            )}
          </div>

          {/* List of Active Order Forms */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-current)' }}>
              <Layers size={18} color="#800000" />
              Active {targetProcess === 'warping' ? 'Warping Order Forms' : 'Weaving Orders'}
            </h3>
            
            {loadingList ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted-current)', alignItems: 'center', gap: '0.5rem' }}>
                <Loader size={18} className="spin" /> Loading forms...
              </div>
            ) : docList.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                No active {targetProcess === 'warping' ? 'warping' : 'weaving'} orders found.
              </p>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '2px solid var(--border-current)', textAlign: 'left' }}>
                      <th style={{ width: '40px', padding: '0.75rem 0.5rem' }}></th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)' }}>Document & Order Details</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)' }}>Destination Unit & Qty</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)' }}>Status Info</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docList.map((doc) => {
                      const isExpanded = expandedDocId === doc.id;
                      const allotments = targetProcess === 'warping'
                        ? (doc.colour_allotments || [])
                        : (doc.weft_allotments || []);
                      const associatedDydrs = dydrsByDoc[doc.id] || [];
                      const yarnBadge = getYarnStatusBadge(allotments, associatedDydrs);

                      return (
                        <React.Fragment key={doc.id}>
                          <tr onClick={() => handleToggleExpandDoc(doc.id)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-current)', backgroundColor: isExpanded ? '#fefefe' : '#fff' }}>
                            <td onClick={e => { e.stopPropagation(); handleToggleExpandDoc(doc.id); }} style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </td>
                            {/* Column 2: Document & Order Details */}
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ fontWeight: '700', color: '#800000', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                {targetProcess === 'warping' ? doc.wof_number : doc.weaving_number}
                              </div>
                              <div style={{ color: 'var(--text-muted-current)', fontSize: '0.7rem', marginTop: '2px', fontWeight: '500' }}>
                                <span>Order: <strong>{doc.order?.order_number || '—'}</strong></span>
                                {Boolean(doc.design_no || doc.order?.design_no) && (
                                  <>
                                    <span style={{ margin: '0 4px', opacity: 0.5 }}>·</span>
                                    <span>Design: <strong>{doc.design_no || doc.order?.design_no}</strong> {doc.order?.design_name ? `(${doc.order.design_name})` : ''}</span>
                                  </>
                                )}
                              </div>
                            </td>
                            {/* Column 3: Destination Unit & Qty */}
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ fontWeight: '650', color: 'var(--text-current)', fontSize: '0.8rem' }}>
                                {(() => {
                                  const type = doc.wof_type || doc.weaving_type;
                                  const machineName = doc.machine?.machine_name || doc.machine_name;
                                  const partnerName = doc.partner?.partner_name || doc.partner_name;
                                  if (type === 'job_work') {
                                    return (
                                      <span style={{ color: '#059669', fontWeight: '600' }}>
                                        🏢 Job Work ({partnerName || '—'})
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span style={{ color: '#800000', fontWeight: '600' }}>
                                        🏠 In-House ({machineName || '—'})
                                      </span>
                                    );
                                  }
                                })()}
                              </div>
                              {doc.qty && (
                                <div style={{ color: 'var(--text-muted-current)', fontSize: '0.7rem', marginTop: '2px', fontWeight: '500' }}>
                                  Target Qty: <strong>{Number(doc.qty).toLocaleString()} m</strong>
                                </div>
                              )}
                            </td>
                            {/* Column 4: Status Info */}
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                <span style={{
                                  backgroundColor: doc.status === 'completed' ? '#dcfce7' : doc.status === 'stopped' ? '#fff7ed' : doc.status === 'on_process' ? '#dbeafe' : '#fef9c3',
                                  color: doc.status === 'completed' ? '#166534' : doc.status === 'stopped' ? '#c2410c' : doc.status === 'on_process' ? '#1d4ed8' : '#854d0e',
                                  padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.02em', border: '1px solid transparent'
                                }}>
                                  {doc.status || 'created'}
                                </span>
                                <span style={{
                                  backgroundColor: yarnBadge.bg, color: yarnBadge.color, border: `1px solid ${yarnBadge.border}`,
                                  padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: '750', letterSpacing: '0.02em'
                                }}>
                                  Yarn: {yarnBadge.label}
                                </span>
                              </div>
                            </td>
                            {/* Column 5: Action */}
                            <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                disabled={yarnBadge.label === 'Delivered'}
                                onClick={() => handleProceedToDelivery(doc)}
                                className="btn btn-primary"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.72rem',
                                  backgroundColor: yarnBadge.label === 'Delivered' ? '#cbd5e1' : '#800000',
                                  color: yarnBadge.label === 'Delivered' ? '#64748b' : '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontWeight: '700',
                                  cursor: yarnBadge.label === 'Delivered' ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                              >
                                <Layers size={11} /> Deliver
                              </button>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr style={{ backgroundColor: '#fff' }}>
                              <td colSpan={5} style={{ padding: '1.5rem', borderLeft: '3px solid #800000' }}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Yarn Allotments & Deliveries
                                  </h4>
                                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                          {['Colour', 'Yarn Count', 'Allotted Qty (kg)', 'Dyed Delivered (kg)', 'Balance to Deliver (kg)'].map(h => (
                                            <th key={h} style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {allotments.map((a, i) => {
                                          const countId = a.countId || a.count_id;
                                          const countValue = a.countValue || a.count_value;
                                          const colourVal = a.colour || a.color || a.colour;
                                          const yc = yarnCounts.find(y => y.id === countId);
                                          const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (countValue || '—');
                                          
                                          const allottedQty = parseFloat(a.allotted_qty || a.kg || 0);
                                          const deliveredItems = associatedDydrs.filter(d => {
                                            const matchCount = (d.yarn_count_id && countId && d.yarn_count_id === countId) || 
                                                               (d.yarn_count?.count_value === countValue);
                                            const matchColour = (d.colour === colourVal);
                                            return matchCount && matchColour;
                                          });
                                          const deliveredQty = deliveredItems.reduce((s, it) => s + parseFloat(it.quantity_kg || 0), 0);
                                          const balance = Math.max(0, allottedQty - deliveredQty);

                                          return (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', color: '#800000' }}>{colourVal || '—'}</td>
                                              <td style={{ padding: '0.6rem 0.75rem' }}>{countDisplay}</td>
                                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>{allottedQty.toFixed(2)}</td>
                                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857' }}>{deliveredQty.toFixed(2)}</td>
                                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: balance > 0.01 ? '#b45309' : '#047857' }}>{balance.toFixed(2)}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                <div>
                                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Associated Dyed Yarn Delivery Receipts (DYDR)
                                  </h4>
                                  {loadingDydrs ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>
                                      <Loader size={14} className="spin" /> Loading associated deliveries…
                                    </div>
                                  ) : associatedDydrs.length === 0 ? (
                                    <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                      No DYDR delivery receipts have been created for this document yet.
                                    </p>
                                  ) : (
                                    <div>
                                      {(() => {
                                        const groupedMap = {};
                                        associatedDydrs.forEach(item => {
                                          const del = item.delivery;
                                          if (!del) return;
                                          if (!groupedMap[del.id]) {
                                            groupedMap[del.id] = {
                                              id: del.id,
                                              dydr_number: del.dydr_number,
                                              delivered_date: del.delivered_date,
                                              delivered_by: del.delivered_by,
                                              vehicle_no: del.vehicle_no,
                                              remarks: del.remarks,
                                              target_process: targetProcess,
                                              doc_no: targetProcess === 'warping' ? doc.wof_number : doc.weaving_number,
                                              machine_name: targetProcess === 'warping' ? (doc.machine?.machine_name || doc.machine_name || '—') : null,
                                              order_no: doc.order?.order_number || '—',
                                              design_no: doc.order?.design_no || '—',
                                              design_name: doc.order?.design_name || '',
                                              items: []
                                            };
                                          }
                                          groupedMap[del.id].items.push(item);
                                        });
                                        const groupedList = Object.values(groupedMap);
                                        return groupedList.map(gDydr => (
                                          <DYDRDetail 
                                            key={gDydr.id} 
                                            dydr={gDydr} 
                                            onPrint={(d) => printDydr(d, yarnCounts)} 
                                          />
                                        ));
                                      })()}
                                    </div>
                                  )}
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

          {/* Details Card and Allotment Summary */}
          {selectedTarget && (
            <div className="glass-panel fade-in" style={{ padding: '1.5rem', borderLeft: '4px solid #800000' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px dashed var(--border-current)', paddingBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {targetProcess === 'warping' ? 'Warping Order Form' : 'Weaving Order'}
                  </div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: '900', color: '#800000', margin: '0.2rem 0' }}>
                    {targetProcess === 'warping' ? selectedTarget.wof_number : selectedTarget.weaving_number}
                  </h2>
                  <span style={{ backgroundColor: deliveryType === 'job_work' ? 'rgba(16,185,129,0.08)' : 'rgba(128,0,0,0.08)', color: deliveryType === 'job_work' ? '#059669' : '#800000', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>
                    {deliveryType === 'job_work' ? 'Job Work' : 'In-House'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', flex: 1, maxWidth: '750px' }}>
                  <div>
                    <label style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Order Number</label>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{selectedTarget.order?.order_number}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Design Spec</label>
                    <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{selectedTarget.order?.design_no} / {selectedTarget.order?.design_name}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Machine / Partner</label>
                    <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>
                      {(() => {
                        const type = selectedTarget.wof_type || selectedTarget.weaving_type;
                        if (type === 'job_work') {
                          return `Job Work (${selectedTarget.partner?.partner_name || selectedTarget.partner_name || '—'})`;
                        } else {
                          return `In-House (${selectedTarget.machine?.machine_name || selectedTarget.machine_name || '—'})`;
                        }
                      })()}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Status</label>
                    <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>
                      <span style={{ textTransform: 'capitalize' }}>{selectedTarget.status}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Allotted Qty Table */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: '800', fontSize: '0.85rem', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Allotted Quantities
                </h4>
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Colour</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Yarn Count</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Allotted Qty (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targetProcess === 'warping' ? (
                        (selectedTarget.colour_allotments || []).map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-current)' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#800000' }}>{row.colour}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{getFormatCount(row.countId || row.count_id)}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{Number(row.allotted_qty || 0).toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        (selectedTarget.order?.yarn_requirements || []).filter(y => y.type === 'weft').map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-current)' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#800000' }}>{row.color || row.colour}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{getFormatCount(row.countId || row.count_id)}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{Number(row.kg || 0).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Button to Step 2 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => handleProceedToDelivery(selectedTarget)} 
                  disabled={loading || isSelectedTargetDelivered}
                  className="btn btn-primary" 
                  style={{ 
                    padding: '0.75rem 2.5rem', 
                    fontWeight: '700', 
                    fontSize: '0.9rem', 
                    backgroundColor: isSelectedTargetDelivered ? '#cbd5e1' : '#800000', 
                    color: isSelectedTargetDelivered ? '#64748b' : '#ffffff',
                    border: 'none', 
                    cursor: isSelectedTargetDelivered ? 'not-allowed' : 'pointer',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem' 
                  }}
                >
                  {loading ? <Loader size={16} className="spin" /> : <><Layers size={16} /> Deliver Dyed Yarn</>}
                </button>
              </div>
            </div>
          )}

        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Step 2 Panel: Stock Allocation Table */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
<h3 style={{ margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-current)' }}>
              <Layers size={18} color="var(--color-primary)" />
              2. Warehouse Stock Allocation
            </h3>
            <p style={{ margin: '-0.75rem 0 1.25rem 0', color: 'var(--text-muted-current)', fontSize: '0.825rem' }}>
              Select lot numbers, locations, and enter quantities to issue for order form <strong>{targetProcess === 'warping' ? selectedTarget.wof_number : selectedTarget.weaving_number}</strong>.
            </p>

            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '2px solid var(--border-current)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Colour</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Yarn Count</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Allotted (kg)</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Already Delivered (kg)</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', width: '150px' }}>Total Allocated (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((req, reqIdx) => {
                    const totalAllocated = (req.allocations || []).reduce((sum, a) => sum + (parseFloat(a.quantity_kg) || 0), 0);
                    const remainingAllotted = req.allotted_qty - req.delivered_qty;
                    const isOverAllotted = totalAllocated > remainingAllotted + 0.001;
                    return (
                      <React.Fragment key={reqIdx}>
                        {/* Requirement Row */}
                        <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '1px solid var(--border-current)', fontWeight: 'bold' }}>
                          <td style={{ padding: '0.75rem 1rem', color: '#800000' }}>{req.colour}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{getFormatCount(req.yarn_count_id)}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{req.allotted_qty.toFixed(2)}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#047857' }}>{req.delivered_qty.toFixed(2)}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: isOverAllotted ? '#ef4444' : '#800000' }}>
                            {totalAllocated.toFixed(2)}
                            {isOverAllotted && <span style={{ fontSize: '0.7rem', color: '#ef4444', display: 'block', fontWeight: 'bold' }}>Exceeds WOF!</span>}
                          </td>
                        </tr>
                        {/* Sub-row for Allocations */}
                        <tr>
                          <td colSpan={5} style={{ padding: '1rem', backgroundColor: '#fafafa', borderBottom: '2px solid var(--border-current)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Lot Allocations for {req.colour} ({getFormatCount(req.yarn_count_id)})
                              </div>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {(req.allocations || []).map((alloc, allocIdx) => {
                                  return (
                                    <div 
                                      key={allocIdx} 
                                      style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: '1fr 1.8fr 1fr 1fr 1.2fr auto', 
                                        gap: '1rem', 
                                        alignItems: 'center', 
                                        backgroundColor: '#fff', 
                                        padding: '0.5rem 0.75rem', 
                                        borderRadius: '6px', 
                                        border: '1px solid var(--border-current)',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                                      }}
                                    >
                                      {/* Lot Number Dropdown */}
                                      <div>
                                        <label style={{ fontSize: '0.62rem', fontWeight: '750', textTransform: 'uppercase', color: 'var(--text-muted-current)', display: 'block', marginBottom: '4px' }}>Lot Number</label>
                                        {req.availableStocks.length === 0 ? (
                                          <span style={{ fontSize: '0.78rem', color: '#ef4444', fontStyle: 'italic', fontWeight: '600' }}>No stock in warehouse</span>
                                        ) : (
                                          <select
                                            className="form-input"
                                            style={{ fontWeight: '750', padding: '0.35rem 0.5rem', fontSize: '0.8rem', width: '100%', backgroundColor: '#fff', border: '1px solid var(--border-current)', borderRadius: '4px', cursor: 'pointer' }}
                                            value={alloc.lot_number || ''}
                                            onChange={e => updateAllocation(reqIdx, allocIdx, 'lot_number', e.target.value)}
                                            disabled={alloc.disabled}
                                          >
                                            <option value="">Select Lot...</option>
                                            {[...new Set(req.availableStocks
                                              .filter(s => !alloc.dof_number || s.dof_number === alloc.dof_number)
                                              .map(s => s.lot_number)
                                            )].map((lot, idx) => {
                                              return (
                                                <option key={idx} value={lot}>
                                                  {lot}
                                                </option>
                                              );
                                            })}
                                          </select>
                                        )}
                                      </div>

                                      {/* DOF Number Dropdown */}
                                      <div>
                                        <label style={{ fontSize: '0.62rem', fontWeight: '750', textTransform: 'uppercase', color: 'var(--text-muted-current)', display: 'block', marginBottom: '4px' }}>DOF Number</label>
                                        {req.availableStocks.length === 0 ? (
                                          <span style={{ fontSize: '0.78rem', color: '#9ca3af', fontStyle: 'italic' }}>—</span>
                                        ) : (
                                          <select
                                            className="form-input"
                                            style={{ fontWeight: '750', padding: '0.35rem 0.5rem', fontSize: '0.8rem', width: '100%', backgroundColor: '#fff', border: '1px solid var(--border-current)', borderRadius: '4px', cursor: 'pointer' }}
                                            value={alloc.dof_number || ''}
                                            onChange={e => updateAllocation(reqIdx, allocIdx, 'dof_number', e.target.value)}
                                            disabled={alloc.disabled}
                                          >
                                            <option value="">Select DOF...</option>
                                            {[...new Set(req.availableStocks
                                              .filter(s => !alloc.lot_number || s.lot_number === alloc.lot_number)
                                              .map(s => s.dof_number)
                                            )].map((dof, idx) => {
                                              return (
                                                <option key={idx} value={dof}>
                                                  {dof}
                                                </option>
                                              );
                                            })}
                                          </select>
                                        )}
                                      </div>

                                      {/* Location */}
                                      <div>
                                        <label style={{ fontSize: '0.62rem', fontWeight: '750', textTransform: 'uppercase', color: 'var(--text-muted-current)', display: 'block', marginBottom: '4px' }}>Location</label>
                                        <span style={{ fontSize: '0.78rem', fontWeight: '600', color: alloc.location_name ? '#374151' : '#9ca3af' }}>
                                          {alloc.location_name || '—'}
                                        </span>
                                      </div>

                                      {/* Available Stock */}
                                      <div>
                                        <label style={{ fontSize: '0.62rem', fontWeight: '750', textTransform: 'uppercase', color: 'var(--text-muted-current)', display: 'block', marginBottom: '4px' }}>Available Stock</label>
                                        <span style={{ fontSize: '0.78rem', fontWeight: '700', color: alloc.stock_kg > 0 ? '#047857' : '#9ca3af' }}>
                                          {alloc.stock_kg > 0 ? `${alloc.stock_kg.toFixed(2)} kg` : '—'}
                                        </span>
                                      </div>

                                      {/* Delivery Qty */}
                                      <div>
                                        <label style={{ fontSize: '0.62rem', fontWeight: '750', textTransform: 'uppercase', color: 'var(--text-muted-current)', display: 'block', marginBottom: '4px' }}>Delivery Qty (kg)</label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max={alloc.stock_kg}
                                          disabled={!alloc.lot_number || !alloc.dof_number || alloc.disabled}
                                          className="form-input"
                                          style={{
                                            fontWeight: '800',
                                            textAlign: 'right',
                                            padding: '0.35rem 0.5rem',
                                            fontSize: '0.8rem',
                                            width: '100%',
                                            borderColor: isOverAllotted ? '#ef4444' : 'var(--border-current)',
                                            backgroundColor: isOverAllotted ? '#fef2f2' : '#fff',
                                            color: isOverAllotted ? '#b91c1c' : 'inherit'
                                          }}
                                          value={alloc.quantity_kg}
                                          onChange={e => updateAllocation(reqIdx, allocIdx, 'quantity_kg', e.target.value)}
                                          placeholder={!alloc.lot_number || !alloc.dof_number ? 'Select lot/DOF' : '0.00'}
                                        />
                                        {isOverAllotted && (
                                          <div style={{ fontSize: '0.65rem', color: '#ef4444', marginTop: '2px', textAlign: 'right', fontWeight: 'bold' }}>
                                            Exceeds WOF limit!
                                          </div>
                                        )}
                                      </div>

                                      {/* Delete Row Button */}
                                      <div style={{ alignSelf: 'end', paddingBottom: '2px' }}>
                                        <button
                                          type="button"
                                          disabled={alloc.disabled || req.allocations.length <= 1}
                                          onClick={() => removeAllocationRow(reqIdx, allocIdx)}
                                          style={{
                                            border: 'none',
                                            background: 'none',
                                            color: (alloc.disabled || req.allocations.length <= 1) ? '#cbd5e1' : '#ef4444',
                                            cursor: (alloc.disabled || req.allocations.length <= 1) ? 'not-allowed' : 'pointer',
                                            padding: '0.25rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1.25rem',
                                            lineHeight: 1
                                          }}
                                          title="Delete allocation row"
                                        >
                                          &times;
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Add Row Button */}
                              {req.availableStocks.length > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                  <button
                                    type="button"
                                    onClick={() => addAllocationRow(reqIdx)}
                                    style={{
                                      fontSize: '0.7rem',
                                      fontWeight: '700',
                                      color: '#800000',
                                      backgroundColor: 'rgba(128, 0, 0, 0.04)',
                                      border: '1px dashed #800000',
                                      padding: '0.2rem 0.6rem',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s'
                                    }}
                                  >
                                    + Add Lot Allocation
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Allocation Summary */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-current)' }}>
              <Layers size={18} color="#800000" />
              Allocation Summary
            </h3>
            
            {(() => {
              const activeAllocations = [];
              items.forEach(req => {
                const allocations = req.allocations || [];
                allocations.forEach(alloc => {
                  const qty = parseFloat(alloc.quantity_kg) || 0;
                  if (qty > 0) {
                    activeAllocations.push({
                      ...alloc,
                      colour: req.colour,
                      yarn_count_id: req.yarn_count_id
                    });
                  }
                });
              });

              if (activeAllocations.length === 0) {
                return (
                  <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.825rem', fontStyle: 'italic' }}>
                    No dyed yarn quantities allocated yet. Enter quantities in the table above to see a summary.
                  </p>
                );
              }

              const totalQty = activeAllocations.reduce((sum, a) => sum + parseFloat(a.quantity_kg || 0), 0);

              const summaryGrouped = activeAllocations.reduce((acc, i) => {
                const key = `${i.colour}_${i.yarn_count_id}`;
                if (!acc[key]) {
                  acc[key] = {
                    colour: i.colour,
                    yarn_count_id: i.yarn_count_id,
                    qty: 0
                  };
                }
                acc[key].qty += parseFloat(i.quantity_kg) || 0;
                return acc;
              }, {});
              const summaryRows = Object.values(summaryGrouped);

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                  
                  {/* Individual Lot Allocations */}
                  <div>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.825rem', fontWeight: '700', color: 'var(--text-current)' }}>
                      Allocated Lots
                    </h4>
                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Colour</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Yarn Count</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Lot Number</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Qty (kg)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeAllocations.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)', backgroundColor: '#fff' }}>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#800000' }}>{item.colour}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{getFormatCount(item.yarn_count_id)}</td>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>{item.lot_number}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>
                                {parseFloat(item.quantity_kg).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ backgroundColor: 'var(--surface-current)', fontWeight: 'bold' }}>
                            <td colSpan={3} style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Total Quantity:</td>
                            <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '800', color: '#800000' }}>
                              {totalQty.toFixed(2)} kg
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Summary by Colour & Count */}
                  <div>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.825rem', fontWeight: '700', color: 'var(--text-current)' }}>
                      Total Qty by Colour & Count
                    </h4>
                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Colour</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Yarn Count</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total Qty (kg)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryRows.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)', backgroundColor: '#fff' }}>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#800000' }}>{row.colour}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{getFormatCount(row.yarn_count_id)}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#047857' }}>
                                {row.qty.toFixed(2)} kg
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              );
            })()}
          </div>

          {/* Delivery Receipt Header Details */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-current)' }}>
              <User size={18} color="var(--color-primary)" />
              3. Dispatch Receipt Info
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '700' }}>Delivered By / Personnel</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', zIndex: 1 }} />
                  <select 
                    required 
                    className="form-input" 
                    style={{ paddingLeft: '2.3rem', fontWeight: '700', backgroundColor: '#fff', cursor: 'pointer' }}
                    value={deliveredBy} 
                    onChange={e => setDeliveredBy(e.target.value)} 
                  >
                    <option value="">Select Personnel...</option>
                    {deliveredBy && !yarnWorkers.some(w => w.worker_name === deliveredBy) && (
                      <option value={deliveredBy}>{deliveredBy}</option>
                    )}
                    {yarnWorkers.map(w => (
                      <option key={w.id} value={w.worker_name}>{w.worker_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Delivery Type (In-house vs Job Work) */}
              <div className="form-group">
                <label className="form-label">Delivery Type</label>
                <div style={{ padding: '0.5rem 0.75rem', border: '1.5px solid var(--border-current)', borderRadius: '6px', backgroundColor: 'var(--surface-current)', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.85rem', color: '#800000', height: '38px', display: 'flex', alignItems: 'center' }}>
                  {((targetProcess === 'warping' ? selectedTarget.wof_type : selectedTarget.weaving_type) === 'job_work') ? 'Job Work (External)' : 'In-House (Internal)'}
                </div>
              </div>

              {/* Vehicle Number (Shown only if job work) */}
              <div className="form-group">
                {deliveryType === 'job_work' ? (
                  <>
                    <label className="form-label" style={{ fontWeight: '700' }}>Vehicle Number</label>
                    <div style={{ position: 'relative' }}>
                      <Truck size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                      <input 
                        type="text" 
                        required 
                        className="form-input" 
                        style={{ paddingLeft: '2.3rem', fontWeight: '700', textTransform: 'uppercase' }}
                        value={vehicleNo} 
                        onChange={e => setVehicleNo(e.target.value)} 
                        placeholder="e.g. TN-37-BY-1234" 
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <label className="form-label" style={{ opacity: 0.5 }}>Vehicle Number</label>
                    <div style={{ padding: '0.5rem 0.75rem', border: '1.5px dashed var(--border-current)', borderRadius: '6px', backgroundColor: 'var(--surface-current)', color: 'var(--text-muted-current)', fontSize: '0.8rem', fontStyle: 'italic', height: '38px', display: 'flex', alignItems: 'center' }}>
                      Not required (In-house delivery)
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.25rem', marginTop: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Delivery Date</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input type="date" className="form-input" style={{ paddingLeft: '2.3rem' }} value={deliveredDate} onChange={e => setDeliveredDate(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Remarks (Optional)</label>
                <input type="text" className="form-input" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="E.g., Delivery notes, specific cones allotment details..." />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button 
              type="button" 
              onClick={() => { setStep(1); setItems([]); }} 
              className="btn btn-secondary" 
              style={{ padding: '0.75rem 2rem' }}
            >
              Back
            </button>
            <button 
              type="submit" 
              disabled={loading || items.length === 0 || hasOverAllocation} 
              className="btn btn-primary" 
              style={{
                padding: '0.75rem 2rem',
                minWidth: '180px',
                backgroundColor: (loading || items.length === 0 || hasOverAllocation) ? '#cbd5e1' : '#800000',
                color: (loading || items.length === 0 || hasOverAllocation) ? '#64748b' : '#fff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                justifyContent: 'center',
                cursor: (loading || items.length === 0 || hasOverAllocation) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? <Loader size={18} className="spin" /> : <><Save size={18} /> Record Delivery</>}
            </button>
          </div>

        </form>
      )}

      {printDydrData && (
        <DYDRReceiptModal 
          receipt={printDydrData} 
          getFormatCount={getFormatCount}
          onClose={() => {
            setPrintDydrData(null);
            navigate('/dyed-yarn');
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Inline DYDR Receipt Modal (Printable)
// ──────────────────────────────────────────────
function DYDRReceiptModal({ receipt, getFormatCount, onClose }) {
  const items = receipt.items || [];
  const totalQty = items.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);

  // Grouped by colour and count
  const groupedByColourAndCount = items.reduce((acc, i) => {
    const key = `${i.colour}_${i.yarn_count_id}`;
    if (!acc[key]) {
      acc[key] = {
        colour: i.colour,
        yarn_count_id: i.yarn_count_id,
        qty: 0
      };
    }
    acc[key].qty += i.quantity_kg;
    return acc;
  }, {});
  const summaryRows = Object.values(groupedByColourAndCount);

  // Get current date/time to show on receipt
  const printTimeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const printDateStr = new Date(receipt.delivered_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        {/* Screen-only buttons */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: '#374151' }}>
            Dyed Yarn Delivery Receipt — {receipt.dydr_number}
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => window.print()}
              style={{ padding: '6px 16px', backgroundColor: '#800000', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #800000', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <img src="/logo.png" alt="Logo" style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain' }}
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
              <div style={{ display: 'none' }}>
                <h2 style={{ margin: 0, color: '#800000', fontSize: '1.35rem', fontWeight: '900' }}>ANTIGRAVITY TEXTILES</h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#555' }}>Fabric Manufacturing ERP</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: '#800000' }}>DYED YARN DELIVERY RECEIPT</h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '1.05rem', fontWeight: '700', color: '#111' }}>{receipt.dydr_number}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#666' }}>
                Date: {printDateStr} &nbsp;·&nbsp; Time: {printTimeStr}
              </p>
            </div>
          </div>

          {/* Meta Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem' }}>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: '700', color: '#888', textTransform: 'uppercase' }}>Delivery Details</p>
              {(() => {
                const metaRows = [
                  [receipt.target_process === 'warping' ? 'Warping Form (WOF)' : 'Weaving Order', receipt.doc_no],
                ];
                if (receipt.target_process === 'warping' && receipt.machine_name) {
                  metaRows.push(['Machine No / Name', receipt.machine_name]);
                }
                metaRows.push(
                  ['Delivered By', receipt.delivered_by],
                  ['Vehicle No', receipt.vehicle_no || 'In-House Delivery']
                );
                return metaRows.map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', fontSize: '12px' }}>
                    <span style={{ color: '#555', minWidth: '130px', flexShrink: 0 }}>{label}:</span>
                    <span style={{ fontWeight: '600' }}>{val}</span>
                  </div>
                ));
              })()}
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem' }}>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: '700', color: '#888', textTransform: 'uppercase' }}>Linked Order Info</p>
              <div style={{ fontSize: '12px', marginBottom: '0.4rem' }}>
                <span style={{ color: '#555', minWidth: '100px', display: 'inline-block' }}>Order No:</span>
                <span style={{ fontWeight: '700', color: '#800000' }}>{receipt.order_no}</span>
              </div>
              <div style={{ fontSize: '12px' }}>
                <span style={{ color: '#555', minWidth: '100px', display: 'inline-block' }}>Design Spec:</span>
                <span style={{ fontWeight: '700' }}>{receipt.design_no} {receipt.design_name ? `/ ${receipt.design_name}` : ''}</span>
              </div>
            </div>
          </div>

          {/* Allocated Lot Details Table */}
          <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#800000', borderBottom: '1px solid #800000', paddingBottom: '4px', marginBottom: '0.75rem' }}>
            Allocated Lot Details
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#800000', color: '#fff' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>S.No</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Colour</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Yarn Count</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Lot Number</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Warehouse Location</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700' }}>Quantity (kg)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{i + 1}</td>
                  <td style={{ padding: '6px 10px', fontSize: '12px', fontWeight: '700', color: '#800000' }}>{item.colour}</td>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{getFormatCount(item.yarn_count_id)}</td>
                  <td style={{ padding: '6px 10px', fontSize: '12px', fontWeight: '600' }}>{item.lot_number || '—'}</td>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{item.location_name || '—'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', fontSize: '12px' }}>{parseFloat(item.quantity_kg).toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #800000' }}>
                <td colSpan={5} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', fontSize: '12px' }}>GRAND TOTAL:</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#800000', fontSize: '13px' }}>{totalQty.toFixed(2)} kg</td>
              </tr>
            </tbody>
          </table>

          {/* Summary by Colour & Count Table */}
          <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#800000', borderBottom: '1px solid #800000', paddingBottom: '4px', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
            Total Quantity by Colour & Count
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#fdf8f8', color: '#800000', borderBottom: '2px solid #800000' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Colour</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Yarn Count</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700' }}>Total Qty (kg)</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px 10px', fontSize: '12px', fontWeight: '700', color: '#800000' }}>{row.colour}</td>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{getFormatCount(row.yarn_count_id)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', color: '#047857', fontSize: '12px' }}>{row.qty.toFixed(2)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Remarks */}
          {receipt.remarks && (
            <div style={{ marginTop: '1.5rem', padding: '0.75rem', backgroundColor: '#fdfdfd', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '11px' }}>
              <strong>Remarks:</strong> {receipt.remarks}
            </div>
          )}

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
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
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '180px', borderTop: '1px solid #000', paddingTop: '8px', marginTop: '40px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>Authorised Signatory</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#888' }}>Managing Partner</p>
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
