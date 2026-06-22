import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ArrowLeft, Loader, Package, Search, RefreshCw, ChevronDown, ChevronRight, Eye, Settings, Calendar, User, ArrowRight, SlidersHorizontal, ChevronUp, X, Printer, Play, CheckCircle, StopCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PrintableSOF from './PrintableSOF';
import PrintableSOFDC from './PrintableSOFDC';
import { generateWeavingNumbersBulk } from '../../utils/weaving';



// ── Status badge helper ─────────────────────────────────────────────────────
function getSofStatusBadge(sof) {
  const status = sof.status;
  const todayStr = new Date().toISOString().slice(0, 10);
  
  if (status === 'completed') {
    const actualEndStr = sof.process_completed_at
      ? sof.process_completed_at.slice(0, 10)
      : (sof.updated_at ? sof.updated_at.slice(0, 10) : todayStr);

    if (sof.end_date && actualEndStr > sof.end_date) {
      return { label: 'Late Completed', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };
    }
    return { label: 'Completed', bg: '#dcfce7', color: '#166534', border: '#86efac' };
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
      if (status === 'created' && sof.end_date && todayStr > sof.end_date) {
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
  const [printSof, setPrintSof] = useState(null);
  const [printSofdc, setPrintSofdc] = useState(null);
  const [expandedSofdcId, setExpandedSofdcId] = useState(null);

  // Handle weaving splits configuration adjusting when count or dates change
  useEffect(() => {
    if (!forwardSof) return;
    
    const count = parseInt(weavingSplitsCount) || 1;
    const sofQty = parseFloat(forwardSof.qty) || 0;
    const avgQty = Math.round((sofQty / count) * 100) / 100;
    
    const newSplits = [];
    for (let i = 0; i < count; i++) {
      const existingSplit = weavingSplitsData[i];
      newSplits.push({
        qty: existingSplit?.qty || avgQty.toString(),
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

      if (Math.abs(totalSplitsQty - sofQty) > 0.1) {
        if (!window.confirm(`Warning: The sum of split quantities (${totalSplitsQty} m) does not match the original SOF quantity (${sofQty} m). Do you still want to proceed?`)) {
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

      // Insert weaving order forms into weaving_orders
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

      const { error: insertWeavingErr } = await supabase
        .from('weaving_orders')
        .insert(weavingOrdersPayload);

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
                {['SOF & Warping Ref', 'Order & Design', 'Allocation', 'Qty (Mtrs)', 'Timeline', 'Status', 'Actions'].map(h => (
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
                      <td style={{ padding: '0.875rem 1rem', fontWeight: '700', fontSize: '0.85rem' }}>{Number(sof.qty).toLocaleString()}</td>
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
                                onClick={() => updateStatus(sof.id, 'stopped')}
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
                          {sof.sizing_type === 'job_work' && sof.status === 'stopped' && (
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
                          ) : (
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
                  Forward Sizing Form to Weaving
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                  Sizing Ref: <strong style={{ color: '#800000', fontFamily: 'monospace' }}>{forwardSof.sof_number} {forwardSof.beam_name ? `(${forwardSof.beam_name})` : ''}</strong>
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
                                onChange={e => setWeavingSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, qty: e.target.value } : s))}
                                required
                                style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.75rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
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
                disabled={forwardSubmitting || loadingModalData}
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
                  opacity: (forwardSubmitting || loadingModalData) ? 0.7 : 1
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
