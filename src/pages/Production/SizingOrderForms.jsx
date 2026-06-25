import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ArrowLeft, Loader, Package, Search, RefreshCw, ChevronDown, ChevronRight, Eye, Settings, Calendar, User, ArrowRight, SlidersHorizontal, ChevronUp, X, Printer, Play, CheckCircle, StopCircle, AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PrintableSOF from './PrintableSOF';
import PrintableSOFDC from './PrintableSOFDC';
import { generateWeavingNumbersBulk, insertWeavingOrdersWithRetry } from '../../utils/weaving';



// ── Status badge helper ─────────────────────────────────────────────────────
function getSofStatusBadge(sof) {
  const status = sof.status;
  const todayStr = new Date().toISOString().slice(0, 10);
  const isFinished = status === 'completed' || (status === 'stopped' && !!sof.sofdc_number);

  if (isFinished) {
    const actualEndStr = sof.process_completed_at
      ? sof.process_completed_at.slice(0, 10)
      : (sof.updated_at ? sof.updated_at.slice(0, 10) : todayStr);

    if (sof.end_date && actualEndStr > sof.end_date) {
      return { label: status === 'completed' ? 'Late Completed' : 'Stopped Late', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };
    }
    return status === 'completed'
      ? { label: 'Completed', bg: '#dcfce7', color: '#166534', border: '#86efac' }
      : { label: 'Stopped', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
  }
  
  switch (status) {
    case 'stopped':
      return { label: 'Stopped', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
    case 'on_process':
      if (sof.end_date && todayStr > sof.end_date) {
        return { label: 'Running Late', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };
      }
      return { label: 'On Process', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' };
    case 'created':
    default:
      if (sof.end_date && todayStr > sof.end_date) {
        return { label: 'Late', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };
      }
      return { label: 'Created', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
  }
}

const STATUS_OPTIONS = ['all', 'created', 'on_process', 'completed', 'stopped'];

export default function SizingOrderForms() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [sofs, setSofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  // Expandable filters state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedSofs, setSelectedSofs] = useState([]);
  const [selectedWofs, setSelectedWofs] = useState([]);
  const [selectedDesigns, setSelectedDesigns] = useState([]);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [activeTypeTab, setActiveTypeTab] = useState('in_house'); // 'in_house' | 'job_work'
  const [expandedSofId, setExpandedSofId] = useState(null);
  const [updating, setUpdating] = useState(null);
  
  // Modals / assignment states
  const [partners, setPartners] = useState([]);
  const [inHouseMachines, setInHouseMachines] = useState([]);
  const [jobWorkMachines, setJobWorkMachines] = useState([]);

  // Weaving Forwarding states
  const [forwardSof, setForwardSof] = useState(null);
  const [forwardSubmitting, setForwardSubmitting] = useState(false);
  const [forwardError, setForwardError] = useState('');
  const [loadingModalData, setLoadingModalData] = useState(false);
  const [weavingStartDate, setWeavingStartDate] = useState('');
  const [weavingEndDate, setWeavingEndDate] = useState('');
  const [weavingSplitsCount, setWeavingSplitsCount] = useState(1);
  const [weavingSplitsData, setWeavingSplitsData] = useState([]);

  const totalSplitsQty = weavingSplitsData.reduce((sum, s) => sum + (parseFloat(s.qty) || 0), 0);
  const sofQtyVal = forwardSof ? parseFloat(forwardSof.qty) || 0 : 0;
  const remainingQty = Math.round((sofQtyVal - totalSplitsQty) * 100) / 100;

  const qtyValidationError = (() => {
    if (!forwardSof) return '';
    for (let i = 0; i < weavingSplitsData.length; i++) {
      const qValStr = weavingSplitsData[i].qty;
      if (qValStr === undefined || qValStr === null || qValStr.toString().trim() === '') {
        return `Please enter a quantity for Split #${i + 1}.`;
      }
      const q = parseFloat(qValStr);
      if (isNaN(q) || q < 0) {
        return `Split #${i + 1} quantity is invalid or negative.`;
      }
      if (q === 0 && weavingSplitsData.length > 1) {
        return `Split #${i + 1} quantity cannot be 0.`;
      }
    }
    if (Math.abs(totalSplitsQty - sofQtyVal) > 0.1) {
      return `Total split quantity (${totalSplitsQty} Mtrs) must equal the total SOF quantity (${sofQtyVal} Mtrs).`;
    }
    return '';
  })();
  const [printSof, setPrintSof] = useState(null);
  const [printSofdc, setPrintSofdc] = useState(null);
  const [expandedSofdcId, setExpandedSofdcId] = useState(null);
  const [activeStopSof, setActiveStopSof] = useState(null);
  const [activeReallocateSof, setActiveReallocateSof] = useState(null);

  const isSofReallocated = (sof) => {
    const warpNoToLook = sof.warp_no || sof.sof_number;
    if (!warpNoToLook) return false;
    return sofs.some(other => 
      other.id !== sof.id &&
      other.wof_id === sof.wof_id &&
      other.warp_no &&
      other.warp_no.toLowerCase().startsWith(`${warpNoToLook.toLowerCase()}/r`)
    );
  };

  // Handle weaving splits configuration adjusting when count or dates change
  useEffect(() => {
    if (!forwardSof) return;
    
    const count = parseInt(weavingSplitsCount) || 1;
    const sofQty = parseFloat(forwardSof.qty) || 0;
    
    const newSplits = [];
    let sumOfPreceding = 0;
    
    for (let i = 0; i < count; i++) {
      const existingSplit = weavingSplitsData[i];
      let splitQty = '';
      
      if (count === 1) {
        splitQty = sofQty.toString();
      } else if (i === count - 1) {
        // Last split gets the remainder to ensure exact sum
        const remaining = Math.max(0, Math.round((sofQty - sumOfPreceding) * 100) / 100);
        splitQty = remaining.toString();
      } else {
        // For splits 0 to N-2, keep existing quantity if it exists, otherwise split evenly
        if (existingSplit && existingSplit.qty !== undefined && existingSplit.qty !== null && existingSplit.qty !== '') {
          splitQty = existingSplit.qty;
        } else {
          const remainingToDistribute = sofQty - sumOfPreceding;
          const remainingCount = count - i;
          const portion = Math.round((remainingToDistribute / remainingCount) * 100) / 100;
          splitQty = portion.toString();
        }
      }
      
      sumOfPreceding += parseFloat(splitQty) || 0;
      
      newSplits.push({
        qty: splitQty,
        start_date: existingSplit?.start_date || weavingStartDate || forwardSof.start_date || '',
        end_date: existingSplit?.end_date || weavingEndDate || forwardSof.end_date || '',
        weaving_type: existingSplit?.weaving_type || 'in_house',
        partner_id: existingSplit?.partner_id || '',
        machine_id: existingSplit?.machine_id || ''
      });
    }
    setWeavingSplitsData(newSplits);
  }, [weavingSplitsCount, forwardSof, weavingStartDate, weavingEndDate]);

  // Edit Sizing Form States
  const [editSof, setEditSof] = useState(null);
  const [editSizingType, setEditSizingType] = useState('in_house');
  const [editMachineId, setEditMachineId] = useState('');
  const [editPartnerId, setEditPartnerId] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editBeamName, setEditBeamName] = useState('');
  
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  const [editMachines, setEditMachines] = useState([]);
  const [editPartners, setEditPartners] = useState([]);
  const [loadingEditModalData, setLoadingEditModalData] = useState(false);

  // Load Weaving Machine/Partner options when Forward modal is opened
  useEffect(() => {
    if (!forwardSof) return;

    const loadWeavingOptions = async () => {
      setLoadingModalData(true);
      try {
        // Fetch weaving department machines
        const { data: deptData } = await supabase
          .from('master_departments')
          .select('id')
          .ilike('department_name', '%weaving%');
          
        const weavingDeptIds = (deptData || []).map(d => d.id);
        
        let ihMachineData = [];
        if (weavingDeptIds.length > 0) {
          const { data } = await supabase
            .from('master_machines')
            .select('*, master_departments(department_name)')
            .in('department_id', weavingDeptIds)
            .eq('scope', 'in_house');
          ihMachineData = data || [];
        }
        
        if (ihMachineData.length === 0) {
          const { data } = await supabase
            .from('master_machines')
            .select('*, master_departments(department_name)')
            .eq('scope', 'in_house');
          ihMachineData = data || [];
        }
        setInHouseMachines(ihMachineData);

        // Fetch partners
        const { data: partnerData } = await supabase
          .from('master_partners')
          .select('*')
          .ilike('partner_type', '%weaving%');
        setPartners(partnerData || []);

        // Fetch job work machines
        const { data: jwMachineData } = await supabase
          .from('master_machines')
          .select('*')
          .eq('scope', 'job_work');
        setJobWorkMachines(jwMachineData || []);

      } catch (err) {
        console.error('Error loading weaving options:', err);
      } finally {
        setLoadingModalData(false);
      }
    };

    loadWeavingOptions();
  }, [forwardSof]);

  // Load Sizing Machine/Partner options for editing
  useEffect(() => {
    if (!editSof) return;
    
    const loadSizingOptions = async () => {
      setLoadingEditModalData(true);
      try {
        if (editSizingType === 'in_house') {
          // Fetch sizing department machines
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
          setEditMachines(machineData);
          setEditPartners([]);
        } else {
          // Job Work
          const { data: partnerData } = await supabase
            .from('master_partners')
            .select('*')
            .ilike('partner_type', '%sizing%');
          setEditPartners(partnerData || []);
          
          if (editPartnerId) {
            const { data: machineData } = await supabase
              .from('master_machines')
              .select('*')
              .eq('scope', 'job_work')
              .eq('partner_id', editPartnerId);
            setEditMachines(machineData || []);
          } else {
            setEditMachines([]);
          }
        }
      } catch (err) {
        console.error('Error loading sizing edit options:', err);
      } finally {
        setLoadingEditModalData(false);
      }
    };

    loadSizingOptions();
  }, [editSof, editSizingType, editPartnerId]);


  const fetchSofs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sizing_order_forms')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name),
          wof:warping_order_forms(id, wof_number, warp_splits, warp_splits_count)
        `)
        .order('created_at', { ascending: false });

      if (!error) {
        setSofs(data || []);
      } else {
        console.error("Error fetching SOFs:", error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSofs();
  }, []);

  const updateStatus = async (id, newStatus) => {
    setUpdating(id);
    try {
      const updates = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'on_process') {
        updates.process_started_at = new Date().toISOString();
        updates.process_completed_at = null;
      } else if (newStatus === 'completed') {
        updates.process_completed_at = new Date().toISOString();
        const sof = sofs.find(s => s.id === id);
        if (sof) {
          updates.sofdc_number = sof.sof_number.replace('/SOF/', '/SOFDC/') + '/1';
        }
      } else if (newStatus === 'stopped') {
        updates.process_completed_at = null;
        const sof = sofs.find(s => s.id === id);
        if (sof) {
          updates.sofdc_number = sof.sof_number.replace('/SOF/', '/SOFDC/') + '/1';
        }
      }
      const { error } = await supabase
        .from('sizing_order_forms')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      await fetchSofs();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleForwardSubmit = async () => {
    setForwardSubmitting(true);
    setForwardError('');
    try {
      const totalSplitsQty = weavingSplitsData.reduce((sum, s) => sum + parseFloat(s.qty || 0), 0);
      const sofQty = parseFloat(forwardSof.qty);
      
      for (let i = 0; i < weavingSplitsData.length; i++) {
        const s = weavingSplitsData[i];
        if (!s.qty || parseFloat(s.qty) <= 0 || !s.start_date || !s.end_date) {
          throw new Error(`Please fill out valid details for Weaving Split #${i + 1}`);
        }
        if (s.weaving_type === 'job_work' && !s.partner_id) {
          throw new Error(`Please select a Weaving Partner for Weaving Split #${i + 1}`);
        }
        if (!s.machine_id) {
          throw new Error(`Please select a Loom for Weaving Split #${i + 1}`);
        }
      }

      if (totalSplitsQty > sofQty + 0.1) {
        throw new Error(`Total split quantity (${totalSplitsQty} m) exceeds the SOF quantity (${sofQty} m). Please reduce the quantities.`);
      }
      if (Math.abs(totalSplitsQty - sofQty) > 0.1) {
        if (!window.confirm(`Warning: The sum of split quantities (${totalSplitsQty} m) is less than the SOF quantity (${sofQty} m). Do you still want to proceed?`)) {
          setForwardSubmitting(false);
          return;
        }
      }

      const weavingSplits = weavingSplitsData.map((s, index) => {
        const splitMachine = s.weaving_type === 'in_house' 
          ? inHouseMachines.find(m => m.id === s.machine_id) 
          : jobWorkMachines.find(m => m.id === s.machine_id);
        const splitPartner = s.weaving_type === 'job_work'
          ? partners.find(p => p.id === s.partner_id)
          : null;
        return {
          split_no: `${forwardSof.sof_number}/${index + 1}`,
          qty: parseFloat(s.qty),
          start_date: s.start_date,
          end_date: s.end_date,
          weaving_type: s.weaving_type || 'in_house',
          partner_id: s.partner_id || null,
          partner_name: splitPartner?.partner_name || null,
          machine_id: s.machine_id,
          machine_name: splitMachine?.machine_name || null
        };
      });

      // Generate weaving order numbers bulk-safely by grouping by type/partner
      const orderNumber = forwardSof.order?.order_number || '';
      const groups = {};
      weavingSplits.forEach((s, idx) => {
        const key = `${s.weaving_type}|${s.partner_name || ''}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push({ split: s, index: idx });
      });

      const weavingNumbers = new Array(weavingSplits.length);

      for (const key of Object.keys(groups)) {
        const [wType, pName] = key.split('|');
        const groupItems = groups[key];
        const generated = await generateWeavingNumbersBulk(
          wType,
          pName || null,
          null,
          orderNumber,
          groupItems.length
        );
        groupItems.forEach((item, i) => {
          weavingNumbers[item.index] = generated[i];
        });
      }

      // Insert weaving order forms into weaving_orders (with retry on duplicate key)
      const weavingOrdersPayload = weavingSplits.map((s, index) => ({
        order_id: forwardSof.order_id,
        weaving_number: weavingNumbers[index],
        design_no: forwardSof.order?.design_no || null,
        status: 'pending',
        qty: s.qty,
        start_date: s.start_date,
        end_date: s.end_date,
        weaving_type: s.weaving_type,
        machine_id: s.machine_id || null,
        machine_name: s.machine_name,
        partner_id: s.partner_id || null,
        partner_name: s.partner_name,
        sof_id: forwardSof.id,
        sof_number: forwardSof.sof_number,
        beam_number: forwardSof.beam_name || null,
        weft_allotments: []
      }));

      const { error: insertWeavingErr } = await insertWeavingOrdersWithRetry(
        weavingOrdersPayload, weavingSplits, null, null, null, orderNumber
      );

      if (insertWeavingErr) throw insertWeavingErr;

      const uniqueMachineNames = Array.from(new Set(weavingSplits.map(s => s.machine_name).filter(Boolean)));
      const machineNamesStr = uniqueMachineNames.join(', ');
      
      const uniquePartnerNames = Array.from(new Set(weavingSplits.map(s => s.partner_name).filter(Boolean)));
      const partnerNamesStr = uniquePartnerNames.join(', ');

      const updates = {
        forwarded_to: 'weaving',
        weaving_type: weavingSplits[0]?.weaving_type || 'in_house',
        weaving_machine_id: weavingSplits[0]?.machine_id || null,
        weaving_machine_name: machineNamesStr || null,
        weaving_partner_id: weavingSplits[0]?.partner_id || null,
        weaving_partner_name: partnerNamesStr || null,
        weaving_start_date: weavingSplits[0]?.start_date || weavingStartDate,
        weaving_end_date: weavingSplits[0]?.end_date || weavingEndDate,
        weaving_splits_count: weavingSplits.length,
        weaving_splits: weavingSplits,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('sizing_order_forms')
        .update(updates)
        .eq('id', forwardSof.id);

      if (error) throw error;

      setForwardSof(null);
      await fetchSofs();
    } catch (err) {
      console.error(err);
      setForwardError(err.message || 'Failed to forward to Weaving.');
    } finally {
      setForwardSubmitting(false);
    }
  };

  const handleEditSofSubmit = async () => {
    setEditSubmitting(true);
    setEditError('');
    try {
      const selectedMachine = editMachines.find(m => m.id === editMachineId);
      const selectedPartner = editPartners.find(p => p.id === editPartnerId);

      if (editSizingType === 'in_house' && !editMachineId) {
        throw new Error('Please select an in-house machine.');
      }
      if (editSizingType === 'job_work' && (!editPartnerId || !editMachineId)) {
        throw new Error('Please select both a partner and machine.');
      }
      if (!editStartDate || !editEndDate) {
        throw new Error('Please select both start and end dates.');
      }
      if (!editQty || parseFloat(editQty) <= 0) {
        throw new Error('Please enter a valid quantity.');
      }

      const updates = {
        sizing_type: editSizingType,
        machine_id: editMachineId || null,
        machine_name: selectedMachine?.machine_name || null,
        partner_id: editPartnerId || null,
        partner_name: selectedPartner?.partner_name || null,
        start_date: editStartDate,
        end_date: editEndDate,
        qty: parseFloat(editQty),
        beam_name: editBeamName || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('sizing_order_forms')
        .update(updates)
        .eq('id', editSof.id);

      if (error) throw error;

      // Sync parent warping split
      if (editSof.wof_id) {
        const { data: wof } = await supabase
          .from('warping_order_forms')
          .select('*')
          .eq('id', editSof.wof_id)
          .single();

        if (wof && wof.warp_splits) {
          const { data: siblingSofs } = await supabase
            .from('sizing_order_forms')
            .select('id, sof_number')
            .eq('wof_id', editSof.wof_id);
            
          const sortedSiblings = (siblingSofs || []).sort((a, b) => a.sof_number.localeCompare(b.sof_number));
          const idx = sortedSiblings.findIndex(s => s.id === editSof.id);

          if (idx !== -1 && wof.warp_splits[idx]) {
            const updatedSplits = [...wof.warp_splits];
            updatedSplits[idx] = {
              ...updatedSplits[idx],
              qty: parseFloat(editQty),
              start_date: editStartDate,
              end_date: editEndDate,
              beam_name: editBeamName || ''
            };
            
            await supabase
              .from('warping_order_forms')
              .update({
                warp_splits: updatedSplits,
                updated_at: new Date().toISOString()
              })
              .eq('id', editSof.wof_id);
          }
        }
      }

      setEditSof(null);
      await fetchSofs();
    } catch (err) {
      setEditError(err.message || 'Failed to update Sizing Order Form.');
    } finally {
      setEditSubmitting(false);
    }
  };


  // 1. SOF Options
  const sofOptions = useMemo(() => {
    const matching = sofs.filter(s => {
      const matchWof = selectedWofs.length === 0 || selectedWofs.includes(s.wof?.wof_number || '—');
      const matchDesign = selectedDesigns.length === 0 || selectedDesigns.includes(`${s.order?.design_no || '—'} / ${s.order?.design_name || '—'}`);
      const matchMachine = selectedMachines.length === 0 || selectedMachines.includes(s.sizing_type === 'in_house' ? (s.machine_name || '—') : (s.partner_name || '—'));
      const matchType = s.sizing_type === activeTypeTab;
      return matchWof && matchDesign && matchMachine && matchType;
    });
    return Array.from(new Set(matching.map(s => s.sof_number).filter(Boolean))).sort();
  }, [sofs, selectedWofs, selectedDesigns, selectedMachines, activeTypeTab]);

  // 2. WOF Options (Warping Reference)
  const wofOptions = useMemo(() => {
    const matching = sofs.filter(s => {
      const matchSof = selectedSofs.length === 0 || selectedSofs.includes(s.sof_number);
      const matchDesign = selectedDesigns.length === 0 || selectedDesigns.includes(`${s.order?.design_no || '—'} / ${s.order?.design_name || '—'}`);
      const matchMachine = selectedMachines.length === 0 || selectedMachines.includes(s.sizing_type === 'in_house' ? (s.machine_name || '—') : (s.partner_name || '—'));
      const matchType = s.sizing_type === activeTypeTab;
      return matchSof && matchDesign && matchMachine && matchType;
    });
    return Array.from(new Set(matching.map(s => s.wof?.wof_number || '—').filter(Boolean))).sort();
  }, [sofs, selectedSofs, selectedDesigns, selectedMachines, activeTypeTab]);

  // 3. Design Options
  const designOptions = useMemo(() => {
    const matching = sofs.filter(s => {
      const matchSof = selectedSofs.length === 0 || selectedSofs.includes(s.sof_number);
      const matchWof = selectedWofs.length === 0 || selectedWofs.includes(s.wof?.wof_number || '—');
      const matchMachine = selectedMachines.length === 0 || selectedMachines.includes(s.sizing_type === 'in_house' ? (s.machine_name || '—') : (s.partner_name || '—'));
      const matchType = s.sizing_type === activeTypeTab;
      return matchSof && matchWof && matchMachine && matchType;
    });
    return Array.from(new Set(matching.map(s => `${s.order?.design_no || '—'} / ${s.order?.design_name || '—'}`))).sort();
  }, [sofs, selectedSofs, selectedWofs, selectedMachines, activeTypeTab]);

  // 4. Machine Options
  const machineOptions = useMemo(() => {
    const matching = sofs.filter(s => {
      const matchSof = selectedSofs.length === 0 || selectedSofs.includes(s.sof_number);
      const matchWof = selectedWofs.length === 0 || selectedWofs.includes(s.wof?.wof_number || '—');
      const matchDesign = selectedDesigns.length === 0 || selectedDesigns.includes(`${s.order?.design_no || '—'} / ${s.order?.design_name || '—'}`);
      const matchType = s.sizing_type === activeTypeTab;
      return matchSof && matchWof && matchDesign && matchType;
    });
    return Array.from(new Set(matching.map(s => s.sizing_type === 'in_house' ? (s.machine_name || '—') : (s.partner_name || '—')).filter(Boolean))).sort();
  }, [sofs, selectedSofs, selectedWofs, selectedDesigns, activeTypeTab]);

  // Summary counts matching filters (excluding status tab itself)
  const baseFilteredForCounts = useMemo(() => {
    return sofs.filter(s => {
      const matchSearch = !searchText ||
        s.sof_number?.toLowerCase().includes(searchText.toLowerCase()) ||
        s.wof?.wof_number?.toLowerCase().includes(searchText.toLowerCase()) ||
        s.order?.order_number?.toLowerCase().includes(searchText.toLowerCase());

      const matchSof = selectedSofs.length === 0 || selectedSofs.includes(s.sof_number);
      const matchWof = selectedWofs.length === 0 || selectedWofs.includes(s.wof?.wof_number || '—');
      const matchDesign = selectedDesigns.length === 0 || selectedDesigns.includes(`${s.order?.design_no || '—'} / ${s.order?.design_name || '—'}`);
      const matchMachine = selectedMachines.length === 0 || selectedMachines.includes(s.sizing_type === 'in_house' ? (s.machine_name || '—') : (s.partner_name || '—'));
      const matchType = s.sizing_type === activeTypeTab;

      return matchSearch && matchSof && matchWof && matchDesign && matchMachine && matchType;
    });
  }, [sofs, searchText, selectedSofs, selectedWofs, selectedDesigns, selectedMachines, activeTypeTab]);

  const filtered = useMemo(() => {
    return baseFilteredForCounts.filter(s => {
      return statusFilter === 'all' || s.status === statusFilter;
    });
  }, [baseFilteredForCounts, statusFilter]);

  const counts = useMemo(() => {
    const res = { all: baseFilteredForCounts.length };
    STATUS_OPTIONS.slice(1).forEach(s => {
      res[s] = baseFilteredForCounts.filter(sof => sof.status === s).length;
    });
    return res;
  }, [baseFilteredForCounts]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
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
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-current)' }}>Sizing Order Forms</h1>
              <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>{sofs.length} total sizing orders</p>
            </div>
          </div>
          <button onClick={fetchSofs} style={{ background: 'none', border: '1px solid var(--border-current)', borderRadius: '8px', padding: '0.5rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Type Tabs: In-House / Job Work */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border-current)', marginBottom: '1.5rem', gap: '2rem' }}>
        <button
          onClick={() => {
            setActiveTypeTab('in_house');
            setSelectedSofs([]);
            setSelectedWofs([]);
            setSelectedDesigns([]);
            setSelectedMachines([]);
            setSearchText('');
            setStatusFilter('all');
          }}
          style={{
            padding: '0.75rem 0.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTypeTab === 'in_house' ? '3px solid #800000' : '3px solid transparent',
            color: activeTypeTab === 'in_house' ? '#800000' : 'var(--text-muted-current)',
            fontWeight: '800',
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          In-House ({sofs.filter(s => s.sizing_type === 'in_house').length})
        </button>
        <button
          onClick={() => {
            setActiveTypeTab('job_work');
            setSelectedSofs([]);
            setSelectedWofs([]);
            setSelectedDesigns([]);
            setSelectedMachines([]);
            setSearchText('');
            setStatusFilter('all');
          }}
          style={{
            padding: '0.75rem 0.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTypeTab === 'job_work' ? '3px solid #800000' : '3px solid transparent',
            color: activeTypeTab === 'job_work' ? '#800000' : 'var(--text-muted-current)',
            fontWeight: '800',
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          Job Work ({sofs.filter(s => s.sizing_type === 'job_work').length})
        </button>
      </div>

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

      {/* Search & Advanced Filters Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)' }} />
          <input
            type="text"
            placeholder="Search SOF number, WOF number or order..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '0.75rem', paddingTop: '0.6rem', paddingBottom: '0.6rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', background: 'var(--surface-current)', color: 'var(--text-current)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

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
            label="SOF Number" 
            options={sofOptions} 
            selectedValues={selectedSofs} 
            onChange={setSelectedSofs} 
            placeholder="All SOFs"
          />
          <MultiSelectDropdown 
            label="Warp Ref (WOF)" 
            options={wofOptions} 
            selectedValues={selectedWofs} 
            onChange={setSelectedWofs} 
            placeholder="All WOF References"
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
                setSelectedSofs([]);
                setSelectedWofs([]);
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

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: 'var(--text-muted-current)', gap: '0.75rem' }}>
          <Loader size={20} className="spin" /> Loading sizing order forms…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--surface-current)', borderRadius: '12px', border: '1px dashed var(--border-current)' }}>
          <Package size={48} style={{ color: 'var(--text-muted-current)', opacity: 0.3, marginBottom: '1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-muted-current)' }}>No sizing order forms found</h3>
          <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>Forward a completed warping order form to sizing to populate this list.</p>
        </div>
      ) : (
        <div style={{ borderRadius: '12px', border: '1px solid var(--border-current)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '2px solid var(--border-current)', textAlign: 'left' }}>
                <th style={{ width: '40px', padding: '0.875rem 0.5rem' }}></th>
                {['SOF & Warping Ref', 'Order & Design', 'Allocation', 'Qty (Mtrs)', 'Completed Qty (Mtrs)', 'Timeline', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.875rem 1rem', fontWeight: '800', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted-current)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((sof, idx) => {
                const badge = getSofStatusBadge(sof);
                const isExpanded = expandedSofId === sof.id;
                
                return (
                  <React.Fragment key={sof.id}>
                    <tr
                      onClick={() => setExpandedSofId(isExpanded ? null : sof.id)}
                      style={{
                        borderBottom: '1px solid var(--border-current)',
                        backgroundColor: idx % 2 === 0 ? 'var(--surface-current)' : 'transparent',
                        transition: 'background-color 0.2s',
                        cursor: 'pointer'
                      }}
                    >
                      <td onClick={e => { e.stopPropagation(); setExpandedSofId(isExpanded ? null : sof.id); }} style={{ textAlign: 'center', padding: '0.875rem 0.5rem' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ fontWeight: '700', color: '#800000', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {sof.sof_number} {sof.beam_name ? `(${sof.beam_name})` : ''}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', fontFamily: 'monospace', fontWeight: '600', marginTop: '2px' }}>Warp Ref: {sof.wof?.wof_number || '—'}</div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ fontWeight: '600', fontSize: '0.8rem' }}>{sof.order?.order_number || '—'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                          {sof.order?.design_no || '—'} {sof.order?.design_name ? `/ ${sof.order.design_name}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                          <span style={{ backgroundColor: sof.sizing_type === 'in_house' ? 'rgba(128,0,0,0.08)' : 'rgba(16,185,129,0.08)', color: sof.sizing_type === 'in_house' ? '#800000' : '#059669', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '700' }}>
                            {sof.sizing_type === 'in_house' ? 'In-House' : 'Job Work'}
                          </span>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
                            {sof.partner_name ? (
                              <div>
                                <div style={{ fontWeight: '700', color: 'var(--text-current)' }}>{sof.partner_name}</div>
                                <div style={{ fontSize: '0.7rem', fontWeight: '500' }}>{sof.machine_name || 'Unassigned Machine'}</div>
                              </div>
                            ) : sof.machine_name ? (
                              <span style={{ fontWeight: '700', color: 'var(--text-current)' }}>{sof.machine_name}</span>
                            ) : (
                              <span style={{ color: '#d97706', fontStyle: 'italic', fontWeight: '600', fontSize: '0.75rem' }}>⚠️ Not Assigned</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: '700', fontSize: '0.85rem' }}>{Number(sof.original_qty || sof.qty).toLocaleString()}</td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: '700', fontSize: '0.85rem', color: (sof.status === 'completed' || sof.status === 'stopped') ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                        {sof.status === 'completed' || sof.status === 'stopped' ? Number(sof.qty || 0).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem' }}>
                          <div><span style={{ color: 'var(--text-muted-current)', fontWeight: '500' }}>Start:</span> <span style={{ fontWeight: '600' }}>{sof.start_date || '—'}</span></div>
                          <div><span style={{ color: 'var(--text-muted-current)', fontWeight: '500' }}>End:</span> <span style={{ fontWeight: '600' }}>{sof.end_date || '—'}</span></div>
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => setPrintSof(sof)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.35rem 0.75rem',
                              backgroundColor: 'transparent',
                              border: '1px solid var(--border-current)',
                              borderRadius: '6px',
                              color: '#800000',
                              fontWeight: '600',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <Eye size={13} /> View
                          </button>
                          {(sof.status === 'completed' || sof.status === 'stopped') && (
                            <button
                              onClick={() => setPrintSofdc(sof)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.35rem 0.75rem',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--border-current)',
                                borderRadius: '6px',
                                color: '#0284c7',
                                fontWeight: '600',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              <Printer size={13} /> SOFDC
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditSizingType(sof.sizing_type || 'in_house');
                              setEditPartnerId(sof.partner_id || '');
                              setEditMachineId(sof.machine_id || '');
                              setEditStartDate(sof.start_date || '');
                              setEditEndDate(sof.end_date || '');
                              setEditQty(sof.qty?.toString() || '');
                              setEditBeamName(sof.beam_name || '');
                              setEditSof(sof);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.35rem 0.75rem',
                              backgroundColor: 'transparent',
                              border: '1px solid var(--border-current)',
                              borderRadius: '6px',
                              color: '#800000',
                              fontWeight: '600',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <Settings size={13} /> Edit
                          </button>
                          {sof.sizing_type === 'job_work' && sof.status === 'created' && (
                            <button
                              onClick={() => updateStatus(sof.id, 'on_process')}
                              disabled={updating === sof.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.35rem 0.75rem',
                                backgroundColor: '#059669',
                                border: '1px solid #059669',
                                borderRadius: '6px',
                                color: 'white',
                                fontWeight: '600',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                opacity: updating === sof.id ? 0.7 : 1
                              }}
                            >
                              {updating === sof.id ? <Loader size={13} className="spin" /> : <Play size={13} />} Start Process
                            </button>
                          )}
                          {sof.sizing_type === 'job_work' && sof.status === 'on_process' && (
                            <>
                              <button
                                onClick={() => updateStatus(sof.id, 'completed')}
                                disabled={updating === sof.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  padding: '0.35rem 0.75rem',
                                  backgroundColor: '#166534',
                                  border: '1px solid #166534',
                                  borderRadius: '6px',
                                  color: 'white',
                                  fontWeight: '600',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  opacity: updating === sof.id ? 0.7 : 1
                                }}
                              >
                                {updating === sof.id ? <Loader size={13} className="spin" /> : <CheckCircle size={13} />} Complete
                              </button>
                              <button
                                onClick={() => setActiveStopSof(sof)}
                                disabled={updating === sof.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  padding: '0.35rem 0.75rem',
                                  backgroundColor: '#c2410c',
                                  border: '1px solid #c2410c',
                                  borderRadius: '6px',
                                  color: 'white',
                                  fontWeight: '600',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  opacity: updating === sof.id ? 0.7 : 1
                                }}
                              >
                                {updating === sof.id ? <Loader size={13} className="spin" /> : <StopCircle size={13} />} Stop
                              </button>
                            </>
                          )}
                          {sof.sizing_type === 'job_work' && sof.status === 'stopped' && !sof.sofdc_number && (
                            <button
                              onClick={() => updateStatus(sof.id, 'on_process')}
                              disabled={updating === sof.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.35rem 0.75rem',
                                backgroundColor: '#1d4ed8',
                                border: '1px solid #1d4ed8',
                                borderRadius: '6px',
                                color: 'white',
                                fontWeight: '600',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                opacity: updating === sof.id ? 0.7 : 1
                              }}
                            >
                              {updating === sof.id ? <Loader size={13} className="spin" /> : <Play size={13} />} Resume
                            </button>
                          )}
                          {sof.status === 'stopped' && !!sof.sofdc_number && !isSofReallocated(sof) && (
                            <button
                              onClick={() => setActiveReallocateSof(sof)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.35rem 0.75rem',
                                backgroundColor: '#ea580c',
                                border: '1px solid #ea580c',
                                borderRadius: '6px',
                                color: 'white',
                                fontWeight: '600',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              <RefreshCw size={13} /> Reallocate
                            </button>
                          )}
                          {sof.forwarded_to ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.35rem 0.6rem',
                              backgroundColor: 'rgba(16,185,129,0.1)',
                              color: '#059669',
                              border: '1px solid rgba(16,185,129,0.2)',
                              borderRadius: '6px',
                              fontWeight: '700',
                              fontSize: '0.7rem',
                              textTransform: 'capitalize'
                            }}>
                              → {sof.forwarded_to}
                            </span>
                          ) : (sof.status === 'stopped' && sof.sofdc_number) ? null : (
                            <button
                              onClick={() => {
                                setWeavingStartDate(sof.end_date || '');
                                setWeavingEndDate(sof.end_date || '');
                                setWeavingSplitsCount(1);
                                setWeavingSplitsData([]);
                                setForwardSof(sof);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.35rem 0.75rem',
                                backgroundColor: '#800000',
                                border: '1px solid #800000',
                                borderRadius: '6px',
                                color: 'white',
                                fontWeight: '600',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              <ArrowRight size={13} /> Forward
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: '#fff' }}>
                        <td colSpan={8} style={{ padding: '1.5rem', borderLeft: '3px solid #800000' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', width: '100%' }}>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Design Ref</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>
                                {sof.order?.design_no || '—'} {sof.order?.design_name ? `/ ${sof.order.design_name}` : ''}
                              </span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Allocated Unit / Partner</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: sof.partner_name ? 'var(--text-current)' : (sof.sizing_type === 'in_house' ? 'var(--text-current)' : 'var(--text-muted-current)') }}>
                                {sof.partner_name || (sof.sizing_type === 'in_house' ? 'In-House Sizing Unit' : 'Not Assigned')}
                              </span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Allocated Machine</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: sof.machine_name ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                {sof.machine_name || 'Not Assigned'}
                              </span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>WOF Quantity Reference</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>
                                {sof.wof?.qty ? `${Number(sof.wof.qty).toLocaleString()} m` : (sof.qty ? `${Number(sof.qty).toLocaleString()} m` : '—')}
                              </span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Beam Number</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: sof.beam_name ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                {sof.beam_name || '—'}
                              </span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Sizer Name</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: sof.sizer_name ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                {sof.sizer_name || '—'}
                              </span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Actual Start</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: sof.process_started_at ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                {sof.process_started_at ? new Date(sof.process_started_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Actual End</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: sof.process_completed_at ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                {sof.process_completed_at ? new Date(sof.process_completed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </span>
                            </div>

                            {sof.forwarded_to === 'weaving' && (
                              <div style={{ colSpan: 4, gridColumn: 'span 4', borderTop: '1px solid var(--border-current)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                                <h6 style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', fontWeight: '800', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <span>→</span> Forwarded to Weaving
                                </h6>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '1rem' }}>
                                  <div>
                                    <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Weaving Type</span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>
                                      {sof.weaving_type === 'in_house' ? 'In-House Weaving' : 'Job Work Weaving'}
                                    </span>
                                  </div>
                                  <div>
                                    <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                                      {sof.weaving_type === 'in_house' ? 'Weaving Loom' : 'Weaving Partner'}
                                    </span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>
                                      {sof.weaving_type === 'in_house' ? (sof.weaving_machine_name || '—') : (sof.weaving_partner_name || '—')}
                                    </span>
                                  </div>
                                </div>

                                {sof.weaving_splits && sof.weaving_splits.length > 0 && (
                                  <div style={{ marginTop: '0.75rem' }}>
                                    <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                                      Weaving Splits ({sof.weaving_splits_count})
                                    </span>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left', border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '1px solid var(--border-current)' }}>
                                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Split Number</th>
                                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Type</th>
                                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Qty (Mtrs)</th>
                                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Loom / Partner</th>
                                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Schedule</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {sof.weaving_splits.map((ws, idx) => (
                                          <tr key={idx} style={{ borderBottom: idx !== sof.weaving_splits.length - 1 ? '1px solid var(--border-current)' : 'none' }}>
                                            <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontWeight: '700' }}>{ws.split_no}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', textTransform: 'capitalize' }}>
                                              {(ws.weaving_type || 'in_house').replace('_', ' ')}
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>{Number(ws.qty).toLocaleString()} m</td>
                                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>
                                              {ws.weaving_type === 'job_work' 
                                                ? `${ws.partner_name || '—'} / ${ws.machine_name || '—'}`
                                                : (ws.machine_name || '—')}
                                            </td>
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
                          </div>

                          {/* Collapsible SOFDC Delivery Receipt */}
                          {(sof.status === 'completed' || sof.status === 'stopped') && (
                            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-current)', paddingTop: '1.25rem' }}>
                              <div 
                                onClick={() => setExpandedSofdcId(expandedSofdcId === sof.id ? null : sof.id)}
                                style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center', 
                                  backgroundColor: 'rgba(2,132,199,0.04)', 
                                  padding: '0.75rem 1rem', 
                                  borderRadius: '8px', 
                                  border: '1px solid #0284c7', 
                                  cursor: 'pointer',
                                  userSelect: 'none'
                                }}
                              >
                                <span style={{ fontWeight: '800', color: '#0284c7', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  📄 Delivery Receipt (SOFDC): {sof.sofdc_number || '—'}
                                </span>
                                <span style={{ fontSize: '0.75rem', fontWeight: '750', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  {expandedSofdcId === sof.id ? 'Collapse Details ▲' : 'Expand Details ▼'}
                                </span>
                              </div>
                              
                              {expandedSofdcId === sof.id && (
                                <div style={{ marginTop: '1rem' }}>
                                  <PrintableSOFDC 
                                    sof={sof} 
                                    order={sof.order} 
                                    machineName={sof.machine_name} 
                                    partnerName={sof.partner_name}
                                    allSofs={sofs}
                                  />
                                </div>
                              )}
                            </div>
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

      {/* Forward Weaving Modal Overlay */}
      {activeStopSof && (
        <SofStopWizardModal
          sof={activeStopSof}
          onClose={() => setActiveStopSof(null)}
          onSuccess={() => fetchSofs()}
        />
      )}

      {activeReallocateSof && (
        <SofReallocateModal
          sof={activeReallocateSof}
          onClose={() => setActiveReallocateSof(null)}
          onSuccess={fetchSofs}
        />
      )}

      {forwardSof && (
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
            maxWidth: '700px',
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
                  Forward Sizing Form to Weaving
                </h3>
                 <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted-current)', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>Sizing Ref: <strong style={{ color: '#800000', fontFamily: 'monospace' }}>{forwardSof.sof_number} {forwardSof.beam_name ? `(${forwardSof.beam_name})` : ''}</strong></span>
                  <span style={{ color: 'var(--border-current)' }}>|</span>
                  <span>Total Qty: <strong style={{ color: 'var(--text-current)', fontWeight: '800' }}>{forwardSof.qty} Mtrs</strong></span>
                </p>
              </div>
              <button
                onClick={() => setForwardSof(null)}
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
              {forwardError && (
                <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem 1rem', color: '#b91c1c', fontSize: '0.825rem' }}>
                  {forwardError}
                </div>
              )}

              {/* Target Process */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '800', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted-current)' }}>
                  Forward Process To
                </label>
                <div style={{
                  border: '2px solid #10b981',
                  borderRadius: '10px',
                  padding: '1rem',
                  backgroundColor: 'rgba(16,185,129,0.04)'
                }}>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#059669' }}>Weaving</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>Forward directly to Weaving department for loom scheduling</div>
                </div>
              </div>

              {/* Weaving Allocation Options */}
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
                  Weaving Loom & Schedule Allocation
                </h4>

                {/* Allocation Summary Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '0.75rem',
                  backgroundColor: 'var(--surface-current)',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-current)',
                  marginTop: '0.25rem'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Total SOF Qty</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#800000', marginTop: '0.2rem' }}>{forwardSof?.qty} Mtrs</div>
                  </div>
                  <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-current)', borderRight: '1px solid var(--border-current)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Allocated Qty</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-current)', marginTop: '0.2rem' }}>{totalSplitsQty} Mtrs</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Remaining Qty</div>
                    <div style={{ 
                      fontSize: '0.95rem', 
                      fontWeight: '800', 
                      color: Math.abs(remainingQty) < 0.1 ? '#10b981' : (remainingQty < 0 ? '#ef4444' : '#f59e0b'),
                      marginTop: '0.2rem' 
                    }}>
                      {remainingQty} Mtrs
                    </div>
                  </div>
                </div>

                {/* Validation Message */}
                {qtyValidationError ? (
                  <div style={{ 
                    backgroundColor: 'rgba(239, 68, 68, 0.05)', 
                    border: '1px solid rgba(239, 68, 68, 0.25)', 
                    borderRadius: '8px', 
                    padding: '0.6rem 0.8rem', 
                    color: '#ef4444', 
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    ⚠️ {qtyValidationError}
                  </div>
                ) : (
                  weavingSplitsCount > 1 && (
                    <div style={{ 
                      backgroundColor: 'rgba(16, 185, 129, 0.05)', 
                      border: '1px solid rgba(16, 185, 129, 0.25)', 
                      borderRadius: '8px', 
                      padding: '0.6rem 0.8rem', 
                      color: '#10b981', 
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}>
                      ✅ Allocation matches total quantity perfectly!
                    </div>
                  )
                )}

                {loadingModalData ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                    <Loader size={14} className="spin" /> Loading weaving options...
                  </div>
                ) : (
                  <>
                    {/* Weaving Splits Count */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-current)' }}>
                        Number of Loom Splits to Forward <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        value={weavingSplitsCount}
                        onChange={e => setWeavingSplitsCount(parseInt(e.target.value))}
                        style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', background: 'var(--surface-current)', color: 'var(--text-current)', cursor: 'pointer' }}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                          <option key={n} value={n}>{n} Split{n > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>

                    {/* Splits Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted-current)' }}>
                        Weaving Splits Configuration
                      </label>
                      {weavingSplitsData.map((split, index) => (
                        <div
                          key={index}
                          style={{
                            backgroundColor: 'var(--surface-current)',
                            border: '1px solid var(--border-current)',
                            borderRadius: '8px',
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                          }}
                        >
                          <div style={{ fontWeight: '800', fontSize: '0.75rem', color: '#800000', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.25rem', fontFamily: 'monospace' }}>
                            Split #{index + 1}: {forwardSof.sof_number}/{index + 1}
                          </div>
                          
                          {/* Row 1: Type, Partner, Loom */}
                          <div style={{ display: 'grid', gridTemplateColumns: split.weaving_type === 'job_work' ? '1fr 1.2fr 1fr' : '1fr 1fr', gap: '0.5rem' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.2rem', color: 'var(--text-muted-current)' }}>Weaving Type</label>
                              <select
                                value={split.weaving_type || 'in_house'}
                                onChange={e => setWeavingSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, weaving_type: e.target.value, partner_id: '', machine_id: '' } : s))}
                                style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.75rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box' }}
                              >
                                <option value="in_house">In-House</option>
                                <option value="job_work">Job Work</option>
                              </select>
                            </div>
                            
                            {split.weaving_type === 'job_work' && (
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.2rem', color: 'var(--text-muted-current)' }}>Partner</label>
                                <select
                                  value={split.partner_id || ''}
                                  onChange={e => setWeavingSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, partner_id: e.target.value, machine_id: '' } : s))}
                                  required
                                  style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.75rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box' }}
                                >
                                  <option value="">— Select Partner —</option>
                                  {partners.map(p => (
                                    <option key={p.id} value={p.id}>
                                      {p.partner_name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div>
                              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.2rem', color: 'var(--text-muted-current)' }}>Loom Name</label>
                              <select
                                value={split.machine_id || ''}
                                onChange={e => setWeavingSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, machine_id: e.target.value } : s))}
                                required
                                disabled={split.weaving_type === 'job_work' && !split.partner_id}
                                style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.75rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box', opacity: (split.weaving_type === 'job_work' && !split.partner_id) ? 0.5 : 1 }}
                              >
                                <option value="">— Select Loom —</option>
                                {(split.weaving_type === 'in_house' ? inHouseMachines : jobWorkMachines.filter(m => m.partner_id === split.partner_id)).map(m => (
                                  <option key={m.id} value={m.id}>
                                    {m.machine_name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Row 2: Qty, Start, End Dates */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.2rem', color: 'var(--text-muted-current)' }}>Qty (Mtrs)</label>
                              <input
                                type="number"
                                value={split.qty}
                                disabled={weavingSplitsCount === 1}
                                onChange={e => {
                                  const sofQty = parseFloat(forwardSof?.qty) || 0;
                                  const newVal = e.target.value;
                                  setWeavingSplitsData(prev => {
                                    const updated = prev.map((s, idx) => idx === index ? { ...s, qty: newVal } : s);
                                    // Auto-balance: if more than 1 split, allot remaining quantity to the target split
                                    if (updated.length > 1) {
                                      const targetIndex = index < updated.length - 1 ? index + 1 : index - 1;
                                      const otherSum = updated.reduce((sum, s, idx) => idx !== targetIndex ? sum + (parseFloat(s.qty) || 0) : sum, 0);
                                      const remaining = Math.max(0, Math.round((sofQty - otherSum) * 100) / 100);
                                      updated[targetIndex] = { ...updated[targetIndex], qty: remaining.toString() };
                                    }
                                    return updated;
                                  });
                                }}
                                required
                                min="0"
                                max={parseFloat(forwardSof?.qty) || ''}
                                style={{
                                  width: '100%',
                                  padding: '0.4rem 0.5rem',
                                  border: '1px solid var(--border-current)',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  background: weavingSplitsCount === 1 ? 'rgba(0, 0, 0, 0.05)' : 'var(--bg-current)',
                                  color: 'var(--text-current)',
                                  boxSizing: 'border-box',
                                  cursor: weavingSplitsCount === 1 ? 'not-allowed' : 'text',
                                  opacity: weavingSplitsCount === 1 ? 0.7 : 1
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.2rem', color: 'var(--text-muted-current)' }}>Start Date</label>
                              <input
                                type="date"
                                value={split.start_date}
                                onChange={e => setWeavingSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, start_date: e.target.value } : s))}
                                required
                                style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.75rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.2rem', color: 'var(--text-muted-current)' }}>End Date</label>
                              <input
                                type="date"
                                value={split.end_date}
                                min={split.start_date}
                                onChange={e => setWeavingSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, end_date: e.target.value } : s))}
                                required
                                style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.75rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>

                          {split.weaving_type === 'job_work' && !split.partner_id && (
                            <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                              Select a weaving partner first to see available looms.
                            </div>
                          )}
                          {split.weaving_type === 'in_house' && inHouseMachines.length === 0 && (
                            <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                              No in-house weaving looms found.
                            </div>
                          )}
                          {split.weaving_type === 'job_work' && split.partner_id && jobWorkMachines.filter(m => m.partner_id === split.partner_id).length === 0 && (
                            <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                              No job work looms found for this partner.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-current)', backgroundColor: 'var(--surface-current)' }}>
              <button
                onClick={() => setForwardSof(null)}
                style={{ border: '1px solid var(--border-current)', backgroundColor: 'transparent', color: 'var(--text-current)', padding: '0.55rem 1.25rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleForwardSubmit}
                disabled={forwardSubmitting || loadingModalData || !!qtyValidationError}
                style={{
                  backgroundColor: '#800000',
                  border: 'none',
                  color: 'white',
                  padding: '0.55rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.825rem',
                  cursor: (forwardSubmitting || loadingModalData || !!qtyValidationError) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: (forwardSubmitting || loadingModalData || !!qtyValidationError) ? 0.5 : 1
                }}
              >
                {forwardSubmitting ? <Loader size={14} className="spin" /> : null}
                Forward to Weaving
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Printable Modal Overlay */}
      {printSof && (
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
                Print Sizing Order Form
              </h3>
              <button
                onClick={() => setPrintSof(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted-current)', cursor: 'pointer', fontSize: '1.5rem', fontWeight: '300', lineHeight: 1, padding: '4px' }}
              >
                &times;
              </button>
            </div>
            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-current)' }}>
              <PrintableSOF
                sof={printSof}
                order={printSof.order}
                machineName={printSof.machine_name}
                partnerName={printSof.partner_name}
                allSofs={sofs}
              />
            </div>
          </div>
        </div>
      )}

      {printSofdc && (
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
                Print Sizing Delivery Challan (SOFDC)
              </h3>
              <button
                onClick={() => setPrintSofdc(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted-current)', cursor: 'pointer', fontSize: '1.5rem', fontWeight: '300', lineHeight: 1, padding: '4px' }}
              >
                &times;
              </button>
            </div>
            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-current)' }}>
              <PrintableSOFDC
                sof={printSofdc}
                order={printSofdc.order}
                machineName={printSofdc.machine_name}
                partnerName={printSofdc.partner_name}
                allSofs={sofs}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Sizing Form Modal Overlay */}
      {editSof && (
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
            maxWidth: '520px',
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
                  Edit Sizing Order Form
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                  SOF: <strong style={{ color: '#800000', fontFamily: 'monospace' }}>{editSof.sof_number} {editSof.beam_name ? `(${editSof.beam_name})` : ''}</strong>
                </p>
              </div>
              <button
                onClick={() => setEditSof(null)}
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

              {/* Sizing Type Select */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '800', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted-current)' }}>
                  Sizing Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {[
                    { id: 'in_house', label: 'In-House Sizing', sub: 'Process in-house sizing units' },
                    { id: 'job_work', label: 'Job Work Sizing', sub: 'Send to outsource sizing partner' }
                  ].map(opt => {
                    const isStarted = editSof && editSof.status !== 'created';
                    return (
                      <div
                        key={opt.id}
                        onClick={() => {
                          if (isStarted) return;
                          setEditSizingType(opt.id);
                          setEditMachineId('');
                          setEditPartnerId('');
                        }}
                        style={{
                          border: `2px solid ${editSizingType === opt.id ? '#800000' : 'var(--border-current)'}`,
                          borderRadius: '10px',
                          padding: '1rem',
                          cursor: isStarted ? 'not-allowed' : 'pointer',
                          opacity: isStarted ? 0.6 : 1,
                          backgroundColor: editSizingType === opt.id ? 'rgba(128,0,0,0.04)' : 'var(--surface-current)',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: editSizingType === opt.id ? '#800000' : 'var(--text-current)' }}>{opt.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>{opt.sub}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sizing Allocation Options */}
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
                  Allocation details
                </h4>

                {loadingEditModalData ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                    <Loader size={14} className="spin" /> Loading options...
                  </div>
                ) : (
                  <>
                    {editSizingType === 'job_work' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-current)' }}>
                          Sizing Partner <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                          value={editPartnerId}
                          onChange={e => { setEditPartnerId(e.target.value); setEditMachineId(''); }}
                          disabled={editSof && editSof.status !== 'created'}
                          style={{
                            width: '100%',
                            padding: '0.55rem 0.75rem',
                            border: '1px solid var(--border-current)',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            background: 'var(--surface-current)',
                            color: 'var(--text-current)',
                            cursor: (editSof && editSof.status !== 'created') ? 'not-allowed' : 'pointer',
                            opacity: (editSof && editSof.status !== 'created') ? 0.6 : 1
                          }}
                        >
                          <option value="">— Select Sizing Partner —</option>
                          {editPartners.map(p => <option key={p.id} value={p.id}>{p.partner_name}</option>)}
                        </select>
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-current)' }}>
                        {editSizingType === 'in_house' ? 'In-House Sizing Machine' : 'Machine at Partner'} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        value={editMachineId}
                        onChange={e => setEditMachineId(e.target.value)}
                        disabled={(editSizingType === 'job_work' && !editPartnerId) || (editSof && editSof.status !== 'created')}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          border: '1px solid var(--border-current)',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          background: 'var(--surface-current)',
                          color: 'var(--text-current)',
                          cursor: ((editSizingType === 'job_work' && !editPartnerId) || (editSof && editSof.status !== 'created')) ? 'not-allowed' : 'pointer',
                          opacity: ((editSizingType === 'job_work' && !editPartnerId) || (editSof && editSof.status !== 'created')) ? 0.5 : 1
                        }}
                      >
                        <option value="">— Select Machine —</option>
                        {editMachines.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.machine_name} {m.master_departments?.department_name ? `(${m.master_departments.department_name})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Quantity and Beam Number */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-current)' }}>Sizing Quantity (Mtrs) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="number"
                      value={editQty}
                      onChange={e => setEditQty(e.target.value)}
                      required
                      disabled={editSof && editSof.status !== 'created'}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid var(--border-current)',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        background: 'var(--surface-current)',
                        color: 'var(--text-current)',
                        boxSizing: 'border-box',
                        cursor: (editSof && editSof.status !== 'created') ? 'not-allowed' : 'text',
                        opacity: (editSof && editSof.status !== 'created') ? 0.75 : 1
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-current)' }}>Beam Number</label>
                    <input
                      type="text"
                      placeholder="e.g. BM-01"
                      value={editBeamName}
                      onChange={e => setEditBeamName(e.target.value)}
                      disabled={editSof && editSof.status !== 'created'}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid var(--border-current)',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        background: 'var(--surface-current)',
                        color: 'var(--text-current)',
                        boxSizing: 'border-box',
                        cursor: (editSof && editSof.status !== 'created') ? 'not-allowed' : 'text',
                        opacity: (editSof && editSof.status !== 'created') ? 0.75 : 1
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-current)' }}>Start Date <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={e => setEditStartDate(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', background: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-current)' }}>End Date <span style={{ color: '#ef4444' }}>*</span></label>
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
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-current)', backgroundColor: 'var(--surface-current)' }}>
              <button
                onClick={() => setEditSof(null)}
                style={{ border: '1px solid var(--border-current)', backgroundColor: 'transparent', color: 'var(--text-current)', padding: '0.55rem 1.25rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditSofSubmit}
                disabled={editSubmitting || loadingEditModalData}
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
                  opacity: (editSubmitting || loadingEditModalData) ? 0.7 : 1
                }}
              >
                {editSubmitting ? <Loader size={14} className="spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
                    backgroundColor: isChecked ? 'rgba(128,0,0,0.04)' : '#fff',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(128,0,0,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(128,0,0,0.04)' : '#fff'}
                >
                  <input 
                    type="checkbox" 
                    checked={isChecked}
                    readOnly
                    style={{ accentColor: '#800000', cursor: 'pointer' }}
                  />
                  <span>{opt}</span>
                </div>
              );
            })}
            {options.length === 0 && (
              <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                No options available
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Stop Wizard Modal ────────────────────────────────────────────────────────
function SofStopWizardModal({ sof, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [sofDetail, setSofDetail] = useState(null);
  const [saving, setSaving] = useState(false);

  // Wizard states
  const [stopStep, setStopStep] = useState('confirm_type'); // 'confirm_type' | 'ask_splits' | 'splits_table' | 'reallocate' | 'confirm_stop'
  const [stopHasSplits, setStopHasSplits] = useState(null);
  const [stopSplits, setStopSplits] = useState([]);
  const [loadingStopSplits, setLoadingStopSplits] = useState(false);
  const [reallocWhen, setReallocWhen] = useState(null); // 'now' | 'later' | null
  const [reallocQty, setReallocQty] = useState('');

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
  const [reallocSplitsCount, setReallocSplitsCount] = useState(1);
  const [reallocSplits, setReallocSplits] = useState([]);

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
    }
  }, [sofDetail]);

  // Calculate the balance qty available for reallocation
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
    const balanceQty = getBalanceQty();
    const evenQty = Math.round((balanceQty / count) * 100) / 100;

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

      // Fetch sizing machines and partners for reallocation
      try {
        // Get sizing department IDs
        const { data: deptData } = await supabase
          .from('master_departments')
          .select('id')
          .ilike('department_name', '%sizing%');
        const sizingDeptIds = (deptData || []).map(d => d.id);

        // Fetch sizing machines filtered by department
        let machineData = [];
        if (sizingDeptIds.length > 0) {
          const { data } = await supabase
            .from('master_machines')
            .select('*, master_departments(department_name)')
            .in('department_id', sizingDeptIds);
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

  const loadStopSplits = async () => {
    setLoadingStopSplits(true);
    try {
      const { data, error } = await supabase
        .from('weaving_orders')
        .select('*')
        .eq('sof_id', sof.id)
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
      onSuccess();
      onClose();
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
      const completedSum = stopHasSplits 
        ? stopSplits.reduce((sum, s) => sum + parseFloat(s.completedQty || 0), 0)
        : 0;
      
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

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error stopping sizing process:', err);
      alert('Failed to stop sizing process: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '600' }}>
          <Loader className="spin" size={18} /> Loading details...
        </div>
      </div>
    );
  }

  const originalQty = Number(sofDetail.original_qty || sofDetail.qty);
  const completedSum = stopHasSplits 
    ? stopSplits.reduce((sum, s) => sum + parseFloat(s.completedQty || 0), 0)
    : 0;
  const remainingQty = originalQty - completedSum;

  return (
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
        maxWidth: '700px',
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
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-current)' }}>
              Stop Sizing Process
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
              Sizing Ref: <strong style={{ color: '#800000', fontFamily: 'monospace' }}>{sofDetail.sof_number}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
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
          {/* STEP 1: Pause vs Stop Permanently */}
          {stopStep === 'confirm_type' && (
            <div>
              <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem', color: 'var(--text-current)', fontWeight: '500', lineHeight: '1.5' }}>
                Do you want to <strong>Pause</strong> the process temporarily (so you can resume it later) or <strong>Stop Permanently</strong>?
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={onClose}
                  style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted-current)', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleTemporaryStop}
                  disabled={saving}
                  style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', backgroundColor: '#1d4ed8', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700' }}
                >
                  Pause (Temporary)
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
              <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem', color: 'var(--text-current)', fontWeight: '500', lineHeight: '1.5' }}>
                Are there any weaving splits configured/completed for this Sizing Order Form?
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setStopStep('confirm_type')}
                  style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted-current)', fontWeight: '600' }}
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    setStopHasSplits(false);
                    setStopStep('ask_realloc_now_later');
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

          {/* STEP 2.5: Ask reallocate now or later */}
          {stopStep === 'ask_realloc_now_later' && (
            <div>
              <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem', color: 'var(--text-current)', fontWeight: '500', lineHeight: '1.5' }}>
                Do you want to reallocate this Sizing Order Form <strong>Now</strong> or <strong>Later</strong>?
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setStopStep(stopHasSplits ? 'splits_table' : 'ask_splits')}
                  style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted-current)', fontWeight: '600' }}
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
                    // Recalculate balance qty and initialize realloc splits
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
              {loadingStopSplits ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 0' }}>
                  <Loader className="spin" size={16} /> Loading configured splits...
                </div>
              ) : stopSplits.length === 0 ? (
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                    No weaving splits configured for this Sizing Order Form. Click next to reallocate the full quantity.
                  </p>
                </div>
              ) : (
                <div style={{ marginBottom: '1.25rem', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-current)', color: 'var(--text-current)', fontWeight: '700' }}>
                        <th style={{ padding: '0.4rem' }}>Split Number</th>
                        <th style={{ padding: '0.4rem' }}>Type</th>
                        <th style={{ padding: '0.4rem' }}>Partner / Loom</th>
                        <th style={{ padding: '0.4rem' }}>Planned</th>
                        <th style={{ padding: '0.4rem' }}>Completed *</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stopSplits.map((split, sIdx) => (
                        <tr key={split.id || sIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
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
                                border: '1px solid var(--border-current)',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                backgroundColor: 'var(--bg-current)',
                                color: 'var(--text-current)'
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
                  style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted-current)', fontWeight: '600' }}
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    let sum = 0;
                    for (const split of stopSplits) {
                      const completedQty = parseFloat(split.completedQty || 0);
                      if (isNaN(completedQty) || completedQty < 0) {
                        alert('Please enter a valid non-negative completed quantity for all splits.');
                        return;
                      }
                      sum += completedQty;
                    }
                    if (sum > originalQty) {
                      alert(`The sum of completed quantities (${sum} m) cannot exceed the original SOF quantity (${originalQty} m).`);
                      return;
                    }
                    if (originalQty - sum > 0) {
                      setStopStep('ask_realloc_now_later');
                    } else {
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
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
                Configure reallocation for the unfinished quantity.
              </p>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                  Number of Splits *
                </label>
                <select
                  value={reallocSplitsCount}
                  onChange={e => handleSplitsCountChange(parseInt(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.85rem', fontWeight: '700', backgroundColor: 'var(--bg-current)', color: 'var(--text-current)' }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'Split' : 'Splits'}</option>
                  ))}
                </select>
              </div>

              <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '1.25rem', border: '1px solid var(--border-current)', borderRadius: '8px', padding: '0.5rem', backgroundColor: 'var(--surface-current)' }}>
                {reallocSplits.map((split, idx) => (
                  <div key={idx} style={{ padding: '0.75rem', border: '1px solid var(--border-current)', borderRadius: '6px', marginBottom: '0.75rem', backgroundColor: 'var(--bg-current)' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: '800', color: '#ea580c' }}>
                      Split #{idx + 1}
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                      {/* Quantity */}
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                          Quantity (Mtrs) * <span style={{ fontWeight: '400', fontSize: '0.65rem', color: '#666' }}>(Balance: {getBalanceQty()} m)</span>
                        </label>
                        <input
                          type="number"
                          value={split.qty}
                          onChange={e => {
                            const balanceQty = getBalanceQty();
                            const newVal = e.target.value;
                            setReallocSplits(prev => {
                              const updated = prev.map((s, i) => i === idx ? { ...s, qty: newVal } : s);
                              // Auto-balance: fill last split with remaining
                              if (updated.length > 1 && idx !== updated.length - 1) {
                                const otherSum = updated.reduce((sum, s, i) => i !== updated.length - 1 ? sum + (parseFloat(s.qty) || 0) : sum, 0);
                                const remaining = Math.max(0, Math.round((balanceQty - otherSum) * 100) / 100);
                                updated[updated.length - 1] = { ...updated[updated.length - 1], qty: remaining.toString() };
                              }
                              return updated;
                            });
                          }}
                          min="0"
                          max={getBalanceQty()}
                          style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '700', boxSizing: 'border-box', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
                        />
                      </div>

                      {/* Sizing Type */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Sizing Type</label>
                        <select
                          value={split.sizing_type}
                          onChange={e => updateReallocSplit(idx, 'sizing_type', e.target.value)}
                          style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
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
                            style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
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
                              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
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
                              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
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
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
                        />
                      </div>

                      {/* End Date */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>End Date *</label>
                        <input
                          type="date"
                          value={split.end_date}
                          onChange={e => updateReallocSplit(idx, 'end_date', e.target.value)}
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
                        />
                      </div>

                      {/* Beam Name */}
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Beam Name</label>
                        <input
                          type="text"
                          value={split.beam_name}
                          onChange={e => updateReallocSplit(idx, 'beam_name', e.target.value)}
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', boxSizing: 'border-box', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
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
                  style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted-current)', fontWeight: '600' }}
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    const parentRemainingQty = getBalanceQty();

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
              <div style={{ backgroundColor: 'rgba(254,215,170,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid #fed7aa', marginBottom: '1.25rem', fontSize: '0.8rem', lineHeight: '1.5', color: 'var(--text-current)' }}>
                <div><strong>Form to Stop:</strong> {sofDetail.sof_number}</div>
                <div><strong>Original Qty:</strong> {originalQty.toLocaleString()} m</div>
                <div><strong>Completed Qty:</strong> {completedSum.toLocaleString()} m</div>
                <div><strong>Remaining Qty:</strong> {stopHasSplits ? (originalQty - completedSum) : (reallocWhen === 'later' ? originalQty : reallocSplits.reduce((sum, s) => sum + parseFloat(s.qty || 0), 0))} m</div>
                
                {reallocWhen === 'later' ? (
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
                    if (reallocWhen === 'later') {
                      setStopStep('ask_realloc_now_later');
                    } else {
                      const originalQty = Number(sofDetail.original_qty || sofDetail.qty);
                      const sum = stopHasSplits ? stopSplits.reduce((sum, s) => sum + parseFloat(s.completedQty || 0), 0) : 0;
                      if (originalQty - sum > 0 || !stopHasSplits) {
                        setStopStep('reallocate');
                      } else {
                        setStopStep('splits_table');
                      }
                    }
                  }}
                  style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted-current)', fontWeight: '600' }}
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
      </div>
    </div>
  );
}

// ── Sizing Reallocate Modal ──────────────────────────────────────────────────
function SofReallocateModal({ sof, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [sofDetail, setSofDetail] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [reallocType, setReallocType] = useState('in_house');
  const [reallocMachineId, setReallocMachineId] = useState('');
  const [reallocMachineName, setReallocMachineName] = useState('');
  const [reallocPartnerId, setReallocPartnerId] = useState('');
  const [reallocPartnerName, setReallocPartnerName] = useState('');
  const [reallocStartDate, setReallocStartDate] = useState('');
  const [reallocEndDate, setReallocEndDate] = useState('');
  const [reallocBeamName, setReallocBeamName] = useState('');
  const [reallocQty, setReallocQty] = useState('');

  const [sizingMachines, setSizingMachines] = useState([]);
  const [sizingPartners, setSizingPartners] = useState([]);
  const [reallocSplitsCount, setReallocSplitsCount] = useState(1);
  const [reallocSplits, setReallocSplits] = useState([]);

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
    }
  }, [sofDetail]);

  const handleSplitsCountChange = (count) => {
    setReallocSplitsCount(count);
    const defaultQty = sofDetail.qty > 0 
      ? (Number(sofDetail.original_qty || sofDetail.qty) - sofDetail.qty)
      : (sofDetail.original_qty || sofDetail.qty || 0);

    const evenQty = Math.round((defaultQty / count) * 100) / 100;

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
      
      for (let i = 0; i < next.length; i++) {
        next[i].qty = evenQty.toString();
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
          order:orders(id, order_number, design_no, design_name, total_quantity)
        `)
        .eq('id', sof.id)
        .single();
      if (error) throw error;
      setSofDetail(data);

      // Fetch sizing machines and partners
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

  const handleConfirmReallocate = async () => {
    const parentRemainingQty = sofDetail.qty > 0 
      ? (Number(sofDetail.original_qty || sofDetail.qty) - sofDetail.qty)
      : (sofDetail.original_qty || sofDetail.qty || 0);

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

    setSaving(true);
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

      onSuccess();
      onClose();
      alert('Sizing Order Form reallocated successfully!');
    } catch (err) {
      console.error('Error reallocating stopped SOF:', err);
      alert('Failed to reallocate: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '600' }}>
          <Loader className="spin" size={18} /> Loading details...
        </div>
      </div>
    );
  }

  const originalQty = Number(sofDetail.original_qty || sofDetail.qty);
  const isQtyEditable = !(sofDetail.qty > 0);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '2rem', boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: 'var(--surface-current)', borderRadius: '16px',
        width: '100%', maxWidth: '700px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden', border: '1px solid var(--border-current)'
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-current)',
          backgroundColor: 'var(--surface-current)'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-current)' }}>
              Reallocate Sizing Order Form
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
              Stopped Ref: <strong style={{ color: '#800000', fontFamily: 'monospace' }}>{sofDetail.sof_number}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted-current)', cursor: 'pointer', fontSize: '1.5rem', fontWeight: '300', padding: '4px' }}>
            &times;
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-current)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
              Number of Splits *
            </label>
            <select
              value={reallocSplitsCount}
              onChange={e => handleSplitsCountChange(parseInt(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.85rem', fontWeight: '700', backgroundColor: 'var(--bg-current)', color: 'var(--text-current)' }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n} {n === 1 ? 'Split' : 'Splits'}</option>
              ))}
            </select>
          </div>

          <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '0.25rem', border: '1px solid var(--border-current)', borderRadius: '8px', padding: '0.5rem', backgroundColor: 'var(--surface-current)' }}>
            {reallocSplits.map((split, idx) => (
              <div key={idx} style={{ padding: '0.75rem', border: '1px solid var(--border-current)', borderRadius: '6px', marginBottom: '0.75rem', backgroundColor: 'var(--bg-current)' }}>
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
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '700', boxSizing: 'border-box', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
                    />
                  </div>

                  {/* Sizing Type */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Sizing Type</label>
                    <select
                      value={split.sizing_type}
                      onChange={e => updateReallocSplit(idx, 'sizing_type', e.target.value)}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
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
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
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
                          style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
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
                          style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
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
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
                    />
                  </div>

                  {/* End Date */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>End Date *</label>
                    <input
                      type="date"
                      value={split.end_date}
                      onChange={e => updateReallocSplit(idx, 'end_date', e.target.value)}
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
                    />
                  </div>

                  {/* Beam Name */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Beam Name</label>
                    <input
                      type="text"
                      value={split.beam_name}
                      onChange={e => updateReallocSplit(idx, 'beam_name', e.target.value)}
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: '600', boxSizing: 'border-box', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-current)', justifyContent: 'flex-end', backgroundColor: 'var(--surface-current)' }}>
          <button onClick={onClose} disabled={saving} style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
            Cancel
          </button>
          <button onClick={handleConfirmReallocate} disabled={saving} style={{ padding: '0.5rem 1.5rem', border: 'none', borderRadius: '8px', backgroundColor: '#ea580c', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontSize: '0.82rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />}
            {saving ? 'Reallocating...' : 'Confirm Reallocate'}
          </button>
        </div>
      </div>
    </div>
  );
}
