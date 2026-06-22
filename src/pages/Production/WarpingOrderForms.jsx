import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ArrowLeft, Loader, Layers, Search, Eye, Settings, RefreshCw, ChevronDown, ChevronRight, Printer, ArrowRight, Send, SlidersHorizontal, ChevronUp, Play, CheckCircle, StopCircle, AlertCircle, Clock, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PrintableWOF from './PrintableWOF';
import { generateWeavingNumbersBulk } from '../../utils/weaving';

import PrintableWOFDC from './PrintableWOFDC';
import DYDRDetail from '../../components/DYDRDetail';
import { printDydr } from '../../utils/printDydr';

function getLocalDateString(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWofStatusBadge(wof) {
  const todayStr = getLocalDateString(new Date());

  if (wof.status === 'completed') {
    // Completed late?
    const actualEndStr = wof.process_completed_at
      ? getLocalDateString(wof.process_completed_at)
      : (getLocalDateString(wof.updated_at) || todayStr);
    if (wof.end_date && actualEndStr > wof.end_date) {
      return { label: 'Completed Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return { label: 'Completed', bg: '#dcfce7', color: '#166534', border: '#86efac' };
  }
  if (wof.status === 'stopped') {
    return { label: 'Stopped', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
  }
  if (wof.status === 'on_process') {
    // Late?
    if (wof.end_date && todayStr > wof.end_date) {
      return { label: 'Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return { label: 'On Process', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' };
  }
  // created
  if (wof.status === 'created') {
    if (wof.end_date && todayStr > wof.end_date) {
      return { label: 'Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return { label: 'Created', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
  }
  return { label: wof.status, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
}

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

const STATUS_OPTIONS = ['all', 'created', 'on_process', 'completed', 'stopped'];

export default function WarpingOrderForms() {
  const navigate = useNavigate();
  const [wofs, setWofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  // Expandable filters state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedWofs, setSelectedWofs] = useState([]);
  const [selectedDesigns, setSelectedDesigns] = useState([]);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [activeTypeTab, setActiveTypeTab] = useState('in_house'); // 'in_house' | 'job_work'
  const [updating, setUpdating] = useState(null); // id of WOF being status-updated
  // Expanded row details state
  const [yarnCounts, setYarnCounts] = useState([]);
  const [expandedWofId, setExpandedWofId] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState('yarn');
  const [dydrsByWof, setDydrsByWof] = useState({}); // { wofId: [dydrItems] }
  const [loadingDydrs, setLoadingDydrs] = useState(false);
  const [printWof, setPrintWof] = useState(null);
  const [expandedWofdcId, setExpandedWofdcId] = useState(null);

  // Completion form states for job work warping
  const [showCompleteForm, setShowCompleteForm] = useState(null); // holds the WOF being completed
  const [completeDate, setCompleteDate] = useState(new Date().toISOString().slice(0, 16));
  const [completeSplits, setCompleteSplits] = useState([]);
  const [yarnReturns, setYarnReturns] = useState([]);
  const [beams, setBeams] = useState([]);
  const [savingComplete, setSavingComplete] = useState(false);

  // Stop process wizard states
  const [stopWof, setStopWof] = useState(null);
  const [stopStep, setStopStep] = useState(null); // null | 'confirm_type' | 'ask_splits' | 'splits_table' | 'yarn_returns'
  const [stopIsPermanent, setStopIsPermanent] = useState(false);
  const [stopHasSplits, setStopHasSplits] = useState(false);
  const [stopSplits, setStopSplits] = useState([]);
  const [loadingStopSplits, setLoadingStopSplits] = useState(false);

  const [forwardWof, setForwardWof] = useState(null);
  const [forwardTo, setForwardTo] = useState('sizing');
  const [splitCount, setSplitCount] = useState(1);
  const [splitsData, setSplitsData] = useState([]);
  const [forwardSubmitting, setForwardSubmitting] = useState(false);
  const [forwardError, setForwardError] = useState('');

  // Forwarding Modal specific options
  const [fSizingPartners, setFSizingPartners] = useState([]);
  const [fInHouseSizingMachines, setFInHouseSizingMachines] = useState([]);
  const [fJobWorkSizingMachines, setFJobWorkSizingMachines] = useState([]);

  const [fWeavingPartners, setFWeavingPartners] = useState([]);
  const [fInHouseWeavingMachines, setFInHouseWeavingMachines] = useState([]);
  const [fJobWorkWeavingMachines, setFJobWorkWeavingMachines] = useState([]);
  const [loadingModalData, setLoadingModalData] = useState(false);

  // Edit WOF States
  const [editWof, setEditWof] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editWofType, setEditWofType] = useState('in_house');
  const [editMachineId, setEditMachineId] = useState('');
  const [editPartnerId, setEditPartnerId] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  
  const [editForwardedTo, setEditForwardedTo] = useState('');
  const [editForwardSizingType, setEditForwardSizingType] = useState('in_house');
  const [editForwardMachineId, setEditForwardMachineId] = useState('');
  const [editForwardPartnerId, setEditForwardPartnerId] = useState('');
  const [editForwardSplitsCount, setEditForwardSplitsCount] = useState(1);
  const [editForwardSplits, setEditForwardSplits] = useState([]);
  const [editForwardSplitsData, setEditForwardSplitsData] = useState([]);
  
  const [editWofSubmitting, setEditWofSubmitting] = useState(false);
  const [editWofError, setEditWofError] = useState('');

  const [warpingMachines, setWarpingMachines] = useState([]);
  const [warpingPartners, setWarpingPartners] = useState([]);
  const [sizingMachines, setSizingMachines] = useState([]);
  const [sizingPartners, setSizingPartners] = useState([]);
  const [loadingEditModalData, setLoadingEditModalData] = useState(false);

  // Load Sizing/Weaving options when Forward or Edit modal is opened
  useEffect(() => {
    if (!forwardWof && !editWof) return;

    const loadForwardOptions = async () => {
      setLoadingModalData(true);
      try {
        // --- Load Sizing Options ---
        const { data: sizingDeptData } = await supabase
          .from('master_departments')
          .select('id')
          .ilike('department_name', '%sizing%');
          
        const sizingDeptIds = (sizingDeptData || []).map(d => d.id);
        
        let ihSizingData = [];
        if (sizingDeptIds.length > 0) {
          const { data } = await supabase
            .from('master_machines')
            .select('*, master_departments(department_name)')
            .in('department_id', sizingDeptIds)
            .eq('scope', 'in_house');
          ihSizingData = data || [];
        }
        if (ihSizingData.length === 0) {
          const { data } = await supabase
            .from('master_machines')
            .select('*, master_departments(department_name)')
            .eq('scope', 'in_house');
          ihSizingData = data || [];
        }
        setFInHouseSizingMachines(ihSizingData);

        const { data: sPartnerData } = await supabase
          .from('master_partners')
          .select('*')
          .ilike('partner_type', '%sizing%');
        setFSizingPartners(sPartnerData || []);

        const { data: jwSizingData } = await supabase
          .from('master_machines')
          .select('*')
          .eq('scope', 'job_work');
        setFJobWorkSizingMachines(jwSizingData || []);

        // --- Load Weaving Options ---
        const { data: weavingDeptData } = await supabase
          .from('master_departments')
          .select('id')
          .ilike('department_name', '%weaving%');
          
        const weavingDeptIds = (weavingDeptData || []).map(d => d.id);
        
        let ihWeavingData = [];
        if (weavingDeptIds.length > 0) {
          const { data } = await supabase
            .from('master_machines')
            .select('*, master_departments(department_name)')
            .in('department_id', weavingDeptIds)
            .eq('scope', 'in_house');
          ihWeavingData = data || [];
        }
        if (ihWeavingData.length === 0) {
          const { data } = await supabase
            .from('master_machines')
            .select('*, master_departments(department_name)')
            .eq('scope', 'in_house');
          ihWeavingData = data || [];
        }
        setFInHouseWeavingMachines(ihWeavingData);

        const { data: wPartnerData } = await supabase
          .from('master_partners')
          .select('*')
          .ilike('partner_type', '%weaving%');
        setFWeavingPartners(wPartnerData || []);

        const { data: jwWeavingData } = await supabase
          .from('master_machines')
          .select('*')
          .eq('scope', 'job_work');
        setFJobWorkWeavingMachines(jwWeavingData || []);

        // --- Load Beams ---
        const { data: beamsData } = await supabase
          .from('master_beams')
          .select('*')
          .order('beam_name');
        setBeams(beamsData || []);

      } catch (err) {
        console.error('Error loading forward options:', err);
      } finally {
        setLoadingModalData(false);
      }
    };

    loadForwardOptions();
  }, [forwardWof, editWof]);

  // Handle splits configuration adjusting when count or dates change
  useEffect(() => {
    if (!forwardWof) return;
    const count = parseInt(splitCount) || 1;
    const avgQty = Math.round((parseFloat(forwardWof.qty) / count) * 100) / 100;
    
    const newSplits = [];
    for (let i = 0; i < count; i++) {
      const existingSplit = splitsData[i];
      const hasTargetChanged = existingSplit && (
        (forwardTo === 'sizing' && existingSplit.sizing_type === undefined) ||
        (forwardTo === 'weaving' && existingSplit.weaving_type === undefined)
      );

      newSplits.push({
        qty: hasTargetChanged ? avgQty.toString() : (existingSplit?.qty || avgQty.toString()),
        start_date: hasTargetChanged ? (forwardWof.start_date || '') : (existingSplit?.start_date || forwardWof.start_date || ''),
        end_date: hasTargetChanged ? (forwardWof.end_date || '') : (existingSplit?.end_date || forwardWof.end_date || ''),
        weaving_type: hasTargetChanged ? 'in_house' : (existingSplit?.weaving_type || 'in_house'),
        sizing_type: hasTargetChanged ? 'in_house' : (existingSplit?.sizing_type || 'in_house'),
        partner_id: hasTargetChanged ? '' : (existingSplit?.partner_id || ''),
        machine_id: hasTargetChanged ? '' : (existingSplit?.machine_id || ''),
        beam_id: hasTargetChanged ? '' : (existingSplit?.beam_id || ''),
        beam_name: hasTargetChanged ? '' : (existingSplit?.beam_name || '')
      });
    }
    setSplitsData(newSplits);
  }, [splitCount, forwardWof, forwardTo]);

  // Load Warping Machine/Partner options for core WOF editing
  useEffect(() => {
    if (!editWof) return;
    
    const loadWarpingOptions = async () => {
      setLoadingEditModalData(true);
      try {
        if (editWofType === 'in_house') {
          const { data: deptData } = await supabase
            .from('master_departments')
            .select('id')
            .ilike('department_name', '%warping%');
          const warpingDeptIds = (deptData || []).map(d => d.id);
          
          let mData = [];
          if (warpingDeptIds.length > 0) {
            const { data } = await supabase
              .from('master_machines')
              .select('*')
              .in('department_id', warpingDeptIds)
              .eq('scope', 'in_house');
            mData = data || [];
          }
          if (mData.length === 0) {
            const { data } = await supabase
              .from('master_machines')
              .select('*')
              .eq('scope', 'in_house');
            mData = data || [];
          }
          setWarpingMachines(mData);
          setWarpingPartners([]);
        } else {
          const { data: pData } = await supabase
            .from('master_partners')
            .select('*')
            .ilike('partner_type', '%warping%');
          setWarpingPartners(pData || []);
          setWarpingMachines([]);
        }
      } catch (err) {
        console.error('Error loading warping options:', err);
      } finally {
        setLoadingEditModalData(false);
      }
    };
    
    loadWarpingOptions();
  }, [editWof, editWofType]);

  // Load partner machines for warping edit when editPartnerId changes
  useEffect(() => {
    if (!editWof || editWofType !== 'job_work' || !editPartnerId) {
      if (editWofType === 'job_work') setWarpingMachines([]);
      return;
    }
    
    const loadWarpingPartnerMachines = async () => {
      const { data } = await supabase
        .from('master_machines')
        .select('*')
        .eq('scope', 'job_work')
        .eq('partner_id', editPartnerId);
      setWarpingMachines(data || []);
    };
    
    loadWarpingPartnerMachines();
  }, [editWof, editWofType, editPartnerId]);

  // Handle splits configuration adjusting when count or dates change
  useEffect(() => {
    if (!editWof || !editForwardedTo) return;
    
    const count = parseInt(editForwardSplitsCount) || 1;
    const currentWofQty = parseFloat(editQty) || parseFloat(editWof.qty) || 0;
    const avgQty = Math.round((currentWofQty / count) * 100) / 100;
    
    const newSplits = [];
    for (let i = 0; i < count; i++) {
      const existingSplit = editForwardSplits[i];
      const hasTargetChanged = existingSplit && (
        (editForwardedTo === 'sizing' && existingSplit.sizing_type === undefined) ||
        (editForwardedTo === 'weaving' && existingSplit.weaving_type === undefined)
      );

      newSplits.push({
        qty: hasTargetChanged ? avgQty.toString() : (existingSplit?.qty?.toString() || avgQty.toString()),
        start_date: hasTargetChanged ? (editStartDate || editWof.start_date || '') : (existingSplit?.start_date || editStartDate || editWof.start_date || ''),
        end_date: hasTargetChanged ? (editEndDate || editWof.end_date || '') : (existingSplit?.end_date || editEndDate || editWof.end_date || ''),
        weaving_type: hasTargetChanged ? 'in_house' : (existingSplit?.weaving_type || 'in_house'),
        sizing_type: hasTargetChanged ? 'in_house' : (existingSplit?.sizing_type || 'in_house'),
        partner_id: hasTargetChanged ? '' : (existingSplit?.partner_id || ''),
        machine_id: hasTargetChanged ? '' : (existingSplit?.machine_id || ''),
        beam_id: hasTargetChanged ? '' : (existingSplit?.beam_id || ''),
        beam_name: hasTargetChanged ? '' : (existingSplit?.beam_name || '')
      });
    }
    setEditForwardSplitsData(newSplits);
  }, [editForwardSplitsCount, editWof, editQty, editStartDate, editEndDate, editForwardedTo]);

  const handleForwardSubmit = async () => {
    setForwardSubmitting(true);
    setForwardError('');
    try {
      const totalSplitsQty = splitsData.reduce((sum, s) => sum + parseFloat(s.qty || 0), 0);
      const wofQty = parseFloat(forwardWof.qty);
      
      if (forwardTo === 'sizing') {
        for (let i = 0; i < splitsData.length; i++) {
          const s = splitsData[i];
          if (!s.qty || parseFloat(s.qty) <= 0 || !s.start_date || !s.end_date) {
            throw new Error(`Please fill out valid details for Warp Split #${i + 1}`);
          }
          if (s.sizing_type === 'job_work' && !s.partner_id) {
            throw new Error(`Please select a Sizing Partner for Warp Split #${i + 1}`);
          }
          if (!s.machine_id) {
            throw new Error(`Please select a Sizing Machine for Warp Split #${i + 1}`);
          }
        }
      } else {
        for (let i = 0; i < splitsData.length; i++) {
          const s = splitsData[i];
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
      }

      if (Math.abs(totalSplitsQty - wofQty) > 0.1) {
        if (!window.confirm(`Warning: The sum of split quantities (${totalSplitsQty} m) does not match the original WOF quantity (${wofQty} m). Do you still want to proceed?`)) {
          setForwardSubmitting(false);
          return;
        }
      }

      const warpSplits = splitsData.map((s, index) => {
        if (forwardTo === 'sizing') {
          const splitMachine = s.sizing_type === 'in_house' 
            ? fInHouseSizingMachines.find(m => m.id === s.machine_id) 
            : fJobWorkSizingMachines.find(m => m.id === s.machine_id);
          const splitPartner = s.sizing_type === 'job_work'
            ? fSizingPartners.find(p => p.id === s.partner_id)
            : null;
          return {
            warp_no: `${forwardWof.wof_number}/${index + 1}`,
            qty: parseFloat(s.qty),
            start_date: s.start_date,
            end_date: s.end_date,
            sizing_type: s.sizing_type || 'in_house',
            partner_id: s.partner_id || null,
            partner_name: splitPartner?.partner_name || null,
            machine_id: s.machine_id,
            machine_name: splitMachine?.machine_name || null,
            beam_name: s.beam_name || ''
          };
        } else {
          const splitMachine = s.weaving_type === 'in_house' 
            ? fInHouseWeavingMachines.find(m => m.id === s.machine_id) 
            : fJobWorkWeavingMachines.find(m => m.id === s.machine_id);
          const splitPartner = s.weaving_type === 'job_work'
            ? fWeavingPartners.find(p => p.id === s.partner_id)
            : null;
          return {
            warp_no: `${forwardWof.wof_number}/${index + 1}`,
            qty: parseFloat(s.qty),
            start_date: s.start_date,
            end_date: s.end_date,
            weaving_type: s.weaving_type || 'in_house',
            partner_id: s.partner_id || null,
            partner_name: splitPartner?.partner_name || null,
            machine_id: s.machine_id,
            machine_name: splitMachine?.machine_name || null
          };
        }
      });

      const { error: updateErr } = await supabase
        .from('warping_order_forms')
        .update({
          forwarded_to: forwardTo,
          sizing_type: forwardTo === 'sizing' ? warpSplits[0]?.sizing_type : null,
          warp_splits_count: warpSplits.length,
          warp_splits: warpSplits,
          updated_at: new Date().toISOString()
        })
        .eq('id', forwardWof.id);

      if (updateErr) throw updateErr;

      if (forwardTo === 'sizing') {
        const year = new Date().getFullYear();
        const baseCounts = {};

        for (const s of warpSplits) {
          if (s.sizing_type === 'in_house') {
            if (baseCounts['in_house'] === undefined) {
              const { count } = await supabase
                .from('sizing_order_forms')
                .select('id', { count: 'exact', head: true })
                .eq('sizing_type', 'in_house')
                .gte('created_at', `${year}-01-01`)
                .lt('created_at', `${year + 1}-01-01`);
              baseCounts['in_house'] = count || 0;
            }
          } else {
            const partnerId = s.partner_id;
            if (baseCounts[partnerId] === undefined) {
              const slug = (s.partner_name || 'PARTNER').replace(/\s+/g, '').toUpperCase();
              const prefix = `AT/${year}/SOF/JB/${slug}/`;
              const { count } = await supabase
                .from('sizing_order_forms')
                .select('id', { count: 'exact', head: true })
                .eq('sizing_type', 'job_work')
                .eq('partner_id', partnerId)
                .ilike('sof_number', `${prefix}%`);
              baseCounts[partnerId] = count || 0;
            }
          }
        }

        const sizingFormsPayload = warpSplits.map((s, index) => {
          let sofNumber = '';
          if (s.sizing_type === 'in_house') {
            const currentSeq = ++baseCounts['in_house'];
            const seqStr = String(currentSeq).padStart(5, '0');
            sofNumber = `AT/${year}/SOF/${seqStr}`;
          } else {
            const partnerId = s.partner_id;
            const currentSeq = ++baseCounts[partnerId];
            const seqStr = String(currentSeq).padStart(5, '0');
            const slug = (s.partner_name || 'PARTNER').replace(/\s+/g, '').toUpperCase();
            sofNumber = `AT/${year}/SOF/JB/${slug}/${seqStr}`;
          }

          return {
            sof_number: sofNumber,
            wof_id: forwardWof.id,
            order_id: forwardWof.order_id,
            sizing_type: s.sizing_type,
            qty: s.qty,
            start_date: s.start_date,
            end_date: s.end_date,
            status: 'created',
            created_by: forwardWof.created_by,
            machine_id: s.machine_id || null,
            machine_name: s.machine_name,
            partner_id: s.partner_id || null,
            partner_name: s.partner_name,
            beam_name: s.beam_name || null
          };
        });

        const { error: insertErr } = await supabase
          .from('sizing_order_forms')
          .insert(sizingFormsPayload);

        if (insertErr) throw insertErr;
      } else if (forwardTo === 'weaving') {
        const orderNumber = forwardWof.order?.order_number || '';
        const groups = {};
        warpSplits.forEach((s, idx) => {
          const key = `${s.weaving_type}|${s.partner_name || ''}`;
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push({ split: s, index: idx });
        });

        const weavingNumbers = new Array(warpSplits.length);

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

        const weavingOrdersPayload = warpSplits.map((s, index) => ({
          order_id: forwardWof.order_id,
          weaving_number: weavingNumbers[index],
          design_no: forwardWof.order?.design_no || null,
          status: 'pending',
          qty: s.qty,
          start_date: s.start_date,
          end_date: s.end_date,
          weaving_type: s.weaving_type,
          machine_id: s.machine_id || null,
          machine_name: s.machine_name,
          partner_id: s.partner_id || null,
          partner_name: s.partner_name,
          wof_id: forwardWof.id,
          wof_number: forwardWof.wof_number,
          beam_number: forwardWof.beam_name || null,
          weft_allotments: []
        }));

        const { error: insertWeavingErr } = await supabase
          .from('weaving_orders')
          .insert(weavingOrdersPayload);

        if (insertWeavingErr) throw insertWeavingErr;
      }

      setForwardWof(null);
      await fetchWofs();
    } catch (err) {
      console.error(err);
      setForwardError(err.message || 'Failed to forward Warping Order Form.');
    } finally {
      setForwardSubmitting(false);
    }
  };

  const handleOpenEditWof = async (wof) => {
    setEditWof(wof);
    setEditQty(wof.qty ? wof.qty.toString() : '');
    setEditWofType(wof.wof_type || 'in_house');
    setEditMachineId(wof.machine_id || '');
    setEditPartnerId(wof.partner_id || '');
    setEditStartDate(wof.start_date || '');
    setEditEndDate(wof.end_date || '');
    
    setEditForwardedTo(wof.forwarded_to || '');
    setEditForwardSizingType(wof.sizing_type || 'in_house');
    setEditForwardSplits(wof.warp_splits ? JSON.parse(JSON.stringify(wof.warp_splits)) : []);
    setEditForwardSplitsCount(wof.warp_splits_count || 1);
    setEditWofError('');

    // Pre-fill existing sizing allocation details
    if (wof.forwarded_to === 'sizing') {
      const { data: sofs } = await supabase
        .from('sizing_order_forms')
        .select('*')
        .eq('wof_id', wof.id)
        .order('sof_number', { ascending: true });
        
      if (sofs && sofs.length > 0) {
        const firstSof = sofs[0];
        setEditForwardSizingType(firstSof.sizing_type || 'in_house');
        setEditForwardPartnerId(firstSof.partner_id || '');
        setEditForwardMachineId(firstSof.machine_id || '');
      }
    }
  };

  const handleEditWofSubmit = async () => {
    setEditWofSubmitting(true);
    setEditWofError('');
    try {
      const wofId = editWof.id;
      const status = editWof.status;
      const isCoreEditable = status === 'created';
      
      let finalWofQty = parseFloat(editQty);
      if (isNaN(finalWofQty) || finalWofQty <= 0) {
        throw new Error('Please enter a valid warping quantity.');
      }
      
      const wofUpdates = {
        updated_at: new Date().toISOString()
      };
      
      const selectedMachine = warpingMachines.find(m => m.id === editMachineId);
      const selectedPartner = warpingPartners.find(p => p.id === editPartnerId);
      
      if (isCoreEditable) {
        if (editWofType === 'in_house' && !editMachineId) {
          throw new Error('Please select an in-house machine.');
        }
        if (editWofType === 'job_work' && (!editPartnerId || !editMachineId)) {
          throw new Error('Please select both a partner and machine.');
        }
        
        wofUpdates.qty = finalWofQty;
        wofUpdates.wof_type = editWofType;
        wofUpdates.machine_id = editMachineId || null;
        wofUpdates.machine_name = selectedMachine?.machine_name || null;
        wofUpdates.partner_id = editPartnerId || null;
        wofUpdates.partner_name = selectedPartner?.partner_name || null;
        wofUpdates.start_date = editStartDate;
        wofUpdates.end_date = editEndDate;
      }
      
      // Handle forward details updates
      const { data: existingSofs } = await supabase
        .from('sizing_order_forms')
        .select('*')
        .eq('wof_id', wofId)
        .order('sof_number', { ascending: true });
        
      const sofsList = existingSofs || [];

      if (editForwardedTo) {
        for (let i = 0; i < editForwardSplitsData.length; i++) {
          const s = editForwardSplitsData[i];
          if (!s.qty || parseFloat(s.qty) <= 0 || !s.start_date || !s.end_date) {
            throw new Error(`Please fill out valid details for Warp Split #${i + 1}`);
          }
          if (editForwardedTo === 'sizing') {
            if (s.sizing_type === 'job_work' && !s.partner_id) {
              throw new Error(`Please select a Sizing Partner for Warp Split #${i + 1}`);
            }
            if (!s.machine_id) {
              throw new Error(`Please select a Sizing Machine for Warp Split #${i + 1}`);
            }
          } else {
            if (s.weaving_type === 'job_work' && !s.partner_id) {
              throw new Error(`Please select a Weaving Partner for Weaving Split #${i + 1}`);
            }
            if (!s.machine_id) {
              throw new Error(`Please select a Loom for Weaving Split #${i + 1}`);
            }
          }
        }
        
        const totalSplitsQty = editForwardSplitsData.reduce((sum, s) => sum + parseFloat(s.qty || 0), 0);
        const refQty = isCoreEditable ? finalWofQty : parseFloat(editWof.qty);
        
        if (Math.abs(totalSplitsQty - refQty) > 0.1) {
          if (!window.confirm(`Warning: The sum of split quantities (${totalSplitsQty} m) does not match the warping quantity (${refQty} m). Do you still want to proceed?`)) {
            setEditWofSubmitting(false);
            return;
          }
        }
        
        const newWarpSplits = editForwardSplitsData.map((s, index) => {
          if (editForwardedTo === 'sizing') {
            const splitMachine = s.sizing_type === 'in_house' 
              ? fInHouseSizingMachines.find(m => m.id === s.machine_id) 
              : fJobWorkSizingMachines.find(m => m.id === s.machine_id);
            const splitPartner = s.sizing_type === 'job_work'
              ? fSizingPartners.find(p => p.id === s.partner_id)
              : null;
            return {
              warp_no: `${editWof.wof_number}/${index + 1}`,
              qty: parseFloat(s.qty),
              start_date: s.start_date,
              end_date: s.end_date,
              sizing_type: s.sizing_type || 'in_house',
              partner_id: s.partner_id || null,
              partner_name: splitPartner?.partner_name || null,
              machine_id: s.machine_id,
              machine_name: splitMachine?.machine_name || null,
              beam_name: s.beam_name || ''
            };
          } else {
            const splitMachine = s.weaving_type === 'in_house' 
              ? fInHouseWeavingMachines.find(m => m.id === s.machine_id) 
              : fJobWorkWeavingMachines.find(m => m.id === s.machine_id);
            const splitPartner = s.weaving_type === 'job_work'
              ? fWeavingPartners.find(p => p.id === s.partner_id)
              : null;
            return {
              warp_no: `${editWof.wof_number}/${index + 1}`,
              qty: parseFloat(s.qty),
              start_date: s.start_date,
              end_date: s.end_date,
              weaving_type: s.weaving_type || 'in_house',
              partner_id: s.partner_id || null,
              partner_name: splitPartner?.partner_name || null,
              machine_id: s.machine_id,
              machine_name: splitMachine?.machine_name || null
            };
          }
        });
        
        wofUpdates.forwarded_to = editForwardedTo;
        wofUpdates.sizing_type = editForwardedTo === 'sizing' ? newWarpSplits[0]?.sizing_type : null;
        wofUpdates.warp_splits_count = newWarpSplits.length;
        wofUpdates.warp_splits = newWarpSplits;

        const { error: wofErr } = await supabase
          .from('warping_order_forms')
          .update(wofUpdates)
          .eq('id', wofId);
          
        if (wofErr) throw wofErr;

        if (editForwardedTo === 'sizing') {
          // Sync database with sizing order forms splits
          // First, delete any weaving orders if they exist (clean switch)
          const { data: exWeaving } = await supabase
            .from('weaving_orders')
            .select('*')
            .eq('wof_id', wofId);
            
          if (exWeaving && exWeaving.length > 0) {
            if (exWeaving.some(w => w.status !== 'pending')) {
              throw new Error("Cannot change forward process to Sizing because some weaving orders have already started or completed.");
            }
            const { error: deleteWeavingErr } = await supabase
              .from('weaving_orders')
              .delete()
              .eq('wof_id', wofId);
            if (deleteWeavingErr) throw deleteWeavingErr;
          }

          const year = new Date().getFullYear();
          const baseCounts = {};

          for (const s of newWarpSplits) {
            if (s.sizing_type === 'in_house') {
              if (baseCounts['in_house'] === undefined) {
                const { count } = await supabase
                  .from('sizing_order_forms')
                  .select('id', { count: 'exact', head: true })
                  .eq('sizing_type', 'in_house')
                  .gte('created_at', `${year}-01-01`)
                  .lt('created_at', `${year + 1}-01-01`);
                baseCounts['in_house'] = count || 0;
              }
            } else {
              const partnerId = s.partner_id;
              if (baseCounts[partnerId] === undefined) {
                const slug = (s.partner_name || 'PARTNER').replace(/\s+/g, '').toUpperCase();
                const prefix = `AT/${year}/SOF/JB/${slug}/`;
                const { count } = await supabase
                  .from('sizing_order_forms')
                  .select('id', { count: 'exact', head: true })
                  .eq('sizing_type', 'job_work')
                  .eq('partner_id', partnerId)
                  .ilike('sof_number', `${prefix}%`);
                baseCounts[partnerId] = count || 0;
              }
            }
          }

          const maxLength = Math.max(newWarpSplits.length, sofsList.length);
          
          for (let i = 0; i < maxLength; i++) {
            if (i < newWarpSplits.length && i < sofsList.length) {
              // Update existing SOF
              const s = newWarpSplits[i];
              const { error: updateSofErr } = await supabase
                .from('sizing_order_forms')
                .update({
                  qty: s.qty,
                  start_date: s.start_date,
                  end_date: s.end_date,
                  sizing_type: s.sizing_type,
                  machine_id: s.machine_id || null,
                  machine_name: s.machine_name,
                  partner_id: s.partner_id || null,
                  partner_name: s.partner_name,
                  beam_name: s.beam_name || null,
                  updated_at: new Date().toISOString()
                })
                .eq('id', sofsList[i].id);
                
              if (updateSofErr) throw updateSofErr;
            } else if (i < newWarpSplits.length && i >= sofsList.length) {
              // Insert new SOF
              const s = newWarpSplits[i];
              let sofNumber = '';
              
              if (s.sizing_type === 'in_house') {
                const currentSeq = ++baseCounts['in_house'];
                const seqStr = String(currentSeq).padStart(5, '0');
                sofNumber = `AT/${year}/SOF/${seqStr}`;
              } else {
                const partnerId = s.partner_id;
                const currentSeq = ++baseCounts[partnerId];
                const seqStr = String(currentSeq).padStart(5, '0');
                const slug = (s.partner_name || 'PARTNER').replace(/\s+/g, '').toUpperCase();
                sofNumber = `AT/${year}/SOF/JB/${slug}/${seqStr}`;
              }
              
              const { error: insertSofErr } = await supabase
                .from('sizing_order_forms')
                .insert({
                  sof_number: sofNumber,
                  wof_id: wofId,
                  order_id: editWof.order_id,
                  sizing_type: s.sizing_type,
                  qty: s.qty,
                  start_date: s.start_date,
                  end_date: s.end_date,
                  status: 'created',
                  created_by: editWof.created_by,
                  machine_id: s.machine_id || null,
                  machine_name: s.machine_name,
                  partner_id: s.partner_id || null,
                  partner_name: s.partner_name,
                  beam_name: s.beam_name || null
                });
                
              if (insertSofErr) throw insertSofErr;
            } else if (i >= newWarpSplits.length && i < sofsList.length) {
              // Delete excess SOF (check status)
              if (sofsList[i].status !== 'created') {
                throw new Error(`Cannot delete split warp ${sofsList[i].sof_number} because its sizing process has already started or completed.`);
              }
              const { error: deleteSofErr } = await supabase
                .from('sizing_order_forms')
                .delete()
                .eq('id', sofsList[i].id);
                
              if (deleteSofErr) throw deleteSofErr;
            }
          }
        } else if (editForwardedTo === 'weaving') {
          // Sync database with weaving orders splits
          if (sofsList.some(s => s.status !== 'created')) {
            throw new Error("Cannot change forward process to Weaving because some sizing order forms have already started or completed.");
          }
          if (sofsList.length > 0) {
            const { error: deleteSofsErr } = await supabase
              .from('sizing_order_forms')
              .delete()
              .eq('wof_id', wofId);
            if (deleteSofsErr) throw deleteSofsErr;
          }

          const { data: existingWeaving } = await supabase
            .from('weaving_orders')
            .select('*')
            .eq('wof_id', wofId)
            .order('weaving_number', { ascending: true });
            
          const weavingList = existingWeaving || [];
          const maxLength = Math.max(newWarpSplits.length, weavingList.length);

          for (let i = 0; i < maxLength; i++) {
            if (i < newWarpSplits.length && i < weavingList.length) {
              // Update existing weaving order
              const s = newWarpSplits[i];
              if (weavingList[i].status !== 'pending') {
                throw new Error(`Cannot modify weaving order ${weavingList[i].weaving_number} because its weaving process has already started or completed.`);
              }
              const { error: updateWeavingErr } = await supabase
                .from('weaving_orders')
                .update({
                  qty: s.qty,
                  start_date: s.start_date,
                  end_date: s.end_date,
                  weaving_type: s.weaving_type,
                  machine_id: s.machine_id || null,
                  machine_name: s.machine_name,
                  partner_id: s.partner_id || null,
                  partner_name: s.partner_name,
                  updated_at: new Date().toISOString()
                })
                .eq('id', weavingList[i].id);
                
              if (updateWeavingErr) throw updateWeavingErr;
            } else if (i < newWarpSplits.length && i >= weavingList.length) {
              // Insert new weaving order
              const s = newWarpSplits[i];
              const orderNumber = editWof.order?.order_number || '';
              const generated = await generateWeavingNumbersBulk(
                s.weaving_type,
                s.partner_name || null,
                null,
                orderNumber,
                1
              );
              
              const { error: insertWeavingErr } = await supabase
                .from('weaving_orders')
                .insert({
                  order_id: editWof.order_id,
                  weaving_number: generated[0],
                  design_no: editWof.order?.design_no || null,
                  status: 'pending',
                  qty: s.qty,
                  start_date: s.start_date,
                  end_date: s.end_date,
                  weaving_type: s.weaving_type,
                  machine_id: s.machine_id || null,
                  machine_name: s.machine_name,
                  partner_id: s.partner_id || null,
                  partner_name: s.partner_name,
                  wof_id: wofId,
                  wof_number: editWof.wof_number,
                  beam_number: editWof.beam_name || null,
                  weft_allotments: []
                });
                
              if (insertWeavingErr) throw insertWeavingErr;
            } else if (i >= newWarpSplits.length && i < weavingList.length) {
              // Delete excess weaving order
              if (weavingList[i].status !== 'pending') {
                throw new Error(`Cannot delete weaving order ${weavingList[i].weaving_number} because its weaving process has already started or completed.`);
              }
              const { error: deleteWeavingErr } = await supabase
                .from('weaving_orders')
                .delete()
                .eq('id', weavingList[i].id);
                
              if (deleteWeavingErr) throw deleteWeavingErr;
            }
          }
        }
      } else {
        // Clear forwarding
        if (sofsList.some(s => s.status !== 'created')) {
          throw new Error("Cannot remove forwarding configuration because some sizing order forms have already started or completed.");
        }
        
        const { data: exWeaving } = await supabase
          .from('weaving_orders')
          .select('*')
          .eq('wof_id', wofId);
          
        if (exWeaving && exWeaving.length > 0) {
          if (exWeaving.some(w => w.status !== 'pending')) {
            throw new Error("Cannot remove forwarding configuration because some weaving orders have already started or completed.");
          }
          const { error: deleteWeavingErr } = await supabase
            .from('weaving_orders')
            .delete()
            .eq('wof_id', wofId);
          if (deleteWeavingErr) throw deleteWeavingErr;
        }
        
        wofUpdates.forwarded_to = null;
        wofUpdates.sizing_type = null;
        wofUpdates.warp_splits_count = 0;
        wofUpdates.warp_splits = [];
        
        const { error: wofErr } = await supabase
          .from('warping_order_forms')
          .update(wofUpdates)
          .eq('id', wofId);
          
        if (wofErr) throw wofErr;
        
        if (sofsList.length > 0) {
          const { error: deleteSofsErr } = await supabase
            .from('sizing_order_forms')
            .delete()
            .eq('wof_id', wofId);
          if (deleteSofsErr) throw deleteSofsErr;
        }
      }
      
      setEditWof(null);
      await fetchWofs();
    } catch (err) {
      console.error(err);
      setEditWofError(err.message || 'Failed to update Warping Order Form.');
    } finally {
      setEditWofSubmitting(false);
    }
  };

  const fetchWofs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('warping_order_forms')
      .select(`
        *,
        order:orders(id, order_number, design_no, design_name, total_quantity, yarn_requirements),
        machine:master_machines(machine_name),
        partner:master_partners(partner_name)
      `)
      .order('created_at', { ascending: false });

    if (!error) {
      setWofs(data || []);
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
        setDydrsByWof(grouped);
        setLoadingDydrs(false);
      }
    }
    setLoading(false);
  };

  const fetchYarnCounts = async () => {
    const { data } = await supabase.from('master_yarn_counts').select('*');
    setYarnCounts(data || []);
  };

  useEffect(() => {
    fetchWofs();
    fetchYarnCounts();
  }, []);

  const handleToggleExpand = async (wofId) => {
    if (expandedWofId === wofId) {
      setExpandedWofId(null);
    } else {
      setExpandedWofId(wofId);
      setActiveDetailTab('yarn');
      if (!dydrsByWof[wofId]) {
        setLoadingDydrs(true);
        const { data, error } = await supabase
          .from('dyed_yarn_delivery_items')
          .select(`
            id,
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
          .eq('production_form_id', wofId);
        
        if (!error && data) {
          setDydrsByWof(prev => ({ ...prev, [wofId]: data }));
        } else {
          setDydrsByWof(prev => ({ ...prev, [wofId]: [] }));
        }
        setLoadingDydrs(false);
      }
    }
  };

  const getPrevAllotted = (countId, countValue, colour, currentWof) => {
    const otherWofs = wofs.filter(w => w.order_id === currentWof.order_id && w.id !== currentWof.id);
    return otherWofs.reduce((sum, w) => {
      const allotment = (w.colour_allotments || []).find(
        a => (a.countId && countId && a.countId === countId) || (a.colour === colour && a.countValue === countValue)
      );
      return sum + parseFloat(allotment?.allotted_qty || 0);
    }, 0);
  };

  const updateStatus = async (id, newStatus) => {
    setUpdating(id);
    const updates = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'on_process') {
      updates.process_started_at = new Date().toISOString();
      updates.process_completed_at = null;
    } else if (newStatus === 'completed') {
      updates.process_completed_at = new Date().toISOString();
    } else if (newStatus === 'stopped') {
      updates.process_completed_at = null;
    }
    await supabase.from('warping_order_forms').update(updates).eq('id', id);
    await fetchWofs();
    setUpdating(null);
  };

  const openStopWizard = async (wof) => {
    setStopWof(wof);
    setStopStep('confirm_type');
    setStopIsPermanent(false);
    setStopHasSplits(false);
    setStopSplits([]);
    
    try {
      const { data: dydrItems } = await supabase
        .from('dyed_yarn_delivery_items')
        .select(`
          id,
          yarn_count_id,
          quantity_kg,
          colour,
          lot_number,
          yarn_count:master_yarn_counts(count_value, material, product_type)
        `)
        .eq('production_form_id', wof.id);

      const groupedReturns = [];
      const seen = new Set();
      (dydrItems || []).forEach(item => {
        const key = `${item.yarn_count_id}_${item.colour}_${item.lot_number || '—'}`;
        if (!seen.has(key)) {
          seen.add(key);
          const countVal = item.yarn_count ? `${item.yarn_count.count_value} ${item.yarn_count.material || ''} ${item.yarn_count.product_type || ''}`.trim() : item.yarn_count_id || '—';
          
          const totalReceived = (dydrItems || [])
            .filter(d => d.yarn_count_id === item.yarn_count_id && d.colour === item.colour && (d.lot_number || '—') === (item.lot_number || '—'))
            .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

          groupedReturns.push({
            yarn_count_id: item.yarn_count_id,
            count_display: countVal,
            colour: item.colour,
            lot_number: item.lot_number || '—',
            quantity_received: totalReceived,
            quantity_returned: 0
          });
        }
      });
      setYarnReturns(groupedReturns);
    } catch (err) {
      console.error('Error opening stop wizard:', err);
    }
  };

  const loadStopSplits = async () => {
    if (!stopWof) return;
    setLoadingStopSplits(true);
    try {
      if (stopWof.forwarded_to === 'sizing') {
        const { data, error } = await supabase
          .from('sizing_order_forms')
          .select('*')
          .eq('wof_id', stopWof.id)
          .order('sof_number', { ascending: true });
        const parentSplits = stopWof.warp_splits || [];
        setStopSplits((data || []).map((item, idx) => ({
          ...item,
          warp_no: item.warp_no || parentSplits[idx]?.warp_no || `${stopWof.wof_number}/${idx + 1}`,
          completedQty: item.qty ? item.qty.toString() : '0'
        })));
      } else if (stopWof.forwarded_to === 'weaving') {
        const { data, error } = await supabase
          .from('weaving_orders')
          .select('*')
          .eq('wof_id', stopWof.id)
          .order('weaving_number', { ascending: true });
        if (error) throw error;
        const parentSplits = stopWof.warp_splits || [];
        setStopSplits((data || []).map((item, idx) => ({
          ...item,
          warp_no: item.warp_no || parentSplits[idx]?.warp_no || `${stopWof.wof_number}/${idx + 1}`,
          completedQty: item.qty ? item.qty.toString() : '0'
        })));
      } else {
        setStopSplits([]);
      }
    } catch (err) {
      console.error('Error fetching sibling splits:', err);
      alert('Error fetching splits: ' + err.message);
    } finally {
      setLoadingStopSplits(false);
    }
  };

  const handleTemporaryStop = async () => {
    if (!stopWof) return;
    setUpdating(stopWof.id);
    try {
      const { error } = await supabase
        .from('warping_order_forms')
        .update({
          status: 'stopped',
          updated_at: new Date().toISOString()
        })
        .eq('id', stopWof.id);

      if (error) throw error;
      setStopStep(null);
      setStopWof(null);
      await fetchWofs();
    } catch (err) {
      console.error('Error stopping process temporarily:', err);
      alert('Failed to stop process temporarily: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handlePermanentStop = async () => {
    if (!stopWof) return;
    for (let i = 0; i < yarnReturns.length; i++) {
      const ret = yarnReturns[i];
      const retQty = parseFloat(ret.quantity_returned || 0);
      if (isNaN(retQty) || retQty < 0) {
        alert(`Please enter a valid return quantity for Colour ${ret.colour}, Lot ${ret.lot_number}`);
        return;
      }
      if (retQty > ret.quantity_received) {
        alert(`Return quantity (${retQty} kg) cannot exceed received quantity (${ret.quantity_received} kg) for Colour ${ret.colour}, Lot ${ret.lot_number}`);
        return;
      }
    }

    setUpdating(stopWof.id);
    try {
      const wofdcNumber = stopWof.wof_number.replace('/WOF/', '/WOFDC/') + '/1';
      let finalWarpSplits = [];

      if (stopHasSplits) {
        for (const split of stopSplits) {
          const completedQty = parseFloat(split.completedQty || 0);
          if (completedQty <= 0) {
            if (stopWof.forwarded_to === 'sizing') {
              const { error: delErr } = await supabase
                .from('sizing_order_forms')
                .delete()
                .eq('id', split.id);
              if (delErr) throw delErr;
            } else if (stopWof.forwarded_to === 'weaving') {
              const { error: delErr } = await supabase
                .from('weaving_orders')
                .delete()
                .eq('id', split.id);
              if (delErr) throw delErr;
            }
          } else {
            if (stopWof.forwarded_to === 'sizing') {
              const { error: updErr } = await supabase
                .from('sizing_order_forms')
                .update({
                  qty: completedQty,
                  updated_at: new Date().toISOString()
                })
                .eq('id', split.id);
              if (updErr) throw updErr;
            } else if (stopWof.forwarded_to === 'weaving') {
              const { error: updErr } = await supabase
                .from('weaving_orders')
                .update({
                  qty: completedQty,
                  updated_at: new Date().toISOString()
                })
                .eq('id', split.id);
              if (updErr) throw updErr;
            }

            finalWarpSplits.push({
              warp_no: split.sof_number || split.weaving_number || split.warp_no,
              qty: completedQty,
              beam_id: split.beam_id || null,
              beam_name: split.beam_name || split.beam_number || '',
              start_date: split.start_date || '',
              end_date: split.end_date || '',
              sizing_type: split.sizing_type || null,
              weaving_type: split.weaving_type || null,
              partner_id: split.partner_id || null,
              partner_name: split.partner_name || null,
              machine_id: split.machine_id || null,
              machine_name: split.machine_name || null
            });
          }
        }
      } else {
        if (stopWof.forwarded_to === 'sizing') {
          const { error: delAllErr } = await supabase
            .from('sizing_order_forms')
            .delete()
            .eq('wof_id', stopWof.id);
          if (delAllErr) throw delAllErr;
        } else if (stopWof.forwarded_to === 'weaving') {
          const { error: delAllErr } = await supabase
            .from('weaving_orders')
            .delete()
            .eq('wof_id', stopWof.id);
          if (delAllErr) throw delAllErr;
        }
        finalWarpSplits = [];
      }

      const isForwardedCleared = finalWarpSplits.length === 0;
      const finalWofQty = stopHasSplits
        ? finalWarpSplits.reduce((sum, s) => sum + parseFloat(s.qty || 0), 0)
        : 0;

      const { error: wofUpdateErr } = await supabase
        .from('warping_order_forms')
        .update({
          status: 'stopped',
          qty: finalWofQty,
          process_completed_at: new Date().toISOString(),
          wofdc_number: wofdcNumber,
          warp_splits: finalWarpSplits,
          warp_splits_count: finalWarpSplits.length,
          forwarded_to: isForwardedCleared ? null : stopWof.forwarded_to,
          sizing_type: isForwardedCleared ? null : (stopWof.sizing_type || null),
          yarn_returns: yarnReturns,
          updated_at: new Date().toISOString()
        })
        .eq('id', stopWof.id);

      if (wofUpdateErr) throw wofUpdateErr;

      setExpandedWofdcId(stopWof.id);
      setStopStep(null);
      setStopWof(null);
      await fetchWofs();
    } catch (err) {
      console.error('Error stopping process permanently:', err);
      alert('Failed to stop process permanently: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  // Open completion form for job work WOF
  const openCompleteForm = async (wof) => {
    setSavingComplete(true);
    setShowCompleteForm(wof);
    setCompleteDate(new Date().toISOString().slice(0, 16));
    try {
      // Fetch beams from master_beams
      const { data: beamData } = await supabase
        .from('master_beams')
        .select('*')
        .order('beam_name');
      setBeams(beamData || []);

      // Fetch yarn delivery items for this WOF
      const { data: dydrItems } = await supabase
        .from('dyed_yarn_delivery_items')
        .select(`
          id,
          yarn_count_id,
          quantity_kg,
          colour,
          lot_number,
          yarn_count:master_yarn_counts(count_value, material, product_type)
        `)
        .eq('production_form_id', wof.id);

      // Build warp splits for completion form
      const splits = (wof.warp_splits || []).map(s => ({
        ...s,
        beam_id: '',
        qty: s.qty?.toString() || ''
      }));
      setCompleteSplits(splits.length > 0 ? splits : [{ warp_no: wof.wof_number, beam_id: '', qty: wof.qty?.toString() || '' }]);

      // Build yarn returns from delivered items
      const returns = (dydrItems || []).map(item => ({
        colour: item.colour || '—',
        count_display: item.yarn_count ? `${item.yarn_count.count_value} ${item.yarn_count.material} ${item.yarn_count.product_type}` : '—',
        lot_number: item.lot_number || '—',
        quantity_received: parseFloat(item.quantity_kg || 0),
        quantity_returned: '0'
      }));
      setYarnReturns(returns);
    } catch (err) {
      console.error('Error loading completion form data:', err);
      alert('Failed to load completion form data: ' + err.message);
    } finally {
      setSavingComplete(false);
    }
  };

  // Handle complete process with yarn returns and WOFDC
  const handleCompleteProcess = async () => {
    if (!completeDate) {
      alert('Please enter the completion date and time');
      return;
    }
    for (let i = 0; i < completeSplits.length; i++) {
      const split = completeSplits[i];
      const parsedQty = parseFloat(split.qty);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        alert(`Please enter a valid quantity for ${split.warp_no}`);
        return;
      }
    }
    for (let i = 0; i < yarnReturns.length; i++) {
      const ret = yarnReturns[i];
      const retQty = parseFloat(ret.quantity_returned || 0);
      if (isNaN(retQty) || retQty < 0) {
        alert(`Please enter a valid return quantity for Colour ${ret.colour}, Lot ${ret.lot_number}`);
        return;
      }
      if (retQty > ret.quantity_received) {
        alert(`Return quantity (${retQty} kg) cannot exceed received quantity (${ret.quantity_received} kg) for Colour ${ret.colour}, Lot ${ret.lot_number}`);
        return;
      }
    }

    setSavingComplete(true);
    try {
      const wof = showCompleteForm;
      const wofdcNumber = wof.wof_number.replace('/WOF/', '/WOFDC/') + '/1';

      const updatedSplits = completeSplits.map(s => {
        const beam = beams.find(b => b.id === s.beam_id);
        return {
          ...s,
          qty: parseFloat(s.qty),
          beam_name: beam ? beam.beam_name : s.beam_name || ''
        };
      });

      const { error } = await supabase
        .from('warping_order_forms')
        .update({
          status: 'completed',
          process_completed_at: new Date(completeDate).toISOString(),
          warp_splits: updatedSplits,
          yarn_returns: yarnReturns,
          wofdc_number: wofdcNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', wof.id);

      if (error) throw error;

      // Update corresponding Sizing Order Forms if any
      const { data: siblingSofs } = await supabase
        .from('sizing_order_forms')
        .select('id, sof_number')
        .eq('wof_id', wof.id);

      if (siblingSofs && siblingSofs.length > 0) {
        const sortedSiblings = [...siblingSofs].sort((a, b) => a.sof_number.localeCompare(b.sof_number));
        for (let i = 0; i < sortedSiblings.length; i++) {
          const splitData = updatedSplits[i];
          if (splitData) {
            await supabase
              .from('sizing_order_forms')
              .update({
                qty: parseFloat(splitData.qty),
                beam_name: splitData.beam_name || null,
                updated_at: new Date().toISOString()
              })
              .eq('id', sortedSiblings[i].id);
          }
        }
      }

      setExpandedWofdcId(wof.id);
      setShowCompleteForm(null);
      await fetchWofs();
    } catch (err) {
      console.error('Error completing process:', err);
      alert('Failed to complete process: ' + err.message);
    } finally {
      setSavingComplete(false);
    }
  };


  // 1. WOF Number Options
  const wofOptions = useMemo(() => {
    const matching = wofs.filter(w => {
      const matchDesign = selectedDesigns.length === 0 || selectedDesigns.includes(`${w.order?.design_no || '—'} / ${w.order?.design_name || '—'}`);
      const matchMachine = selectedMachines.length === 0 || selectedMachines.includes(w.wof_type === 'in_house' ? (w.machine?.machine_name || w.machine_name || '—') : (w.partner?.partner_name || w.partner_name || '—'));
      const matchType = w.wof_type === activeTypeTab;
      return matchDesign && matchMachine && matchType;
    });
    return Array.from(new Set(matching.map(w => w.wof_number).filter(Boolean))).sort();
  }, [wofs, selectedDesigns, selectedMachines, activeTypeTab]);

  // 2. Design Options
  const designOptions = useMemo(() => {
    const matching = wofs.filter(w => {
      const matchWof = selectedWofs.length === 0 || selectedWofs.includes(w.wof_number);
      const matchMachine = selectedMachines.length === 0 || selectedMachines.includes(w.wof_type === 'in_house' ? (w.machine?.machine_name || w.machine_name || '—') : (w.partner?.partner_name || w.partner_name || '—'));
      const matchType = w.wof_type === activeTypeTab;
      return matchWof && matchMachine && matchType;
    });
    return Array.from(new Set(matching.map(w => `${w.order?.design_no || '—'} / ${w.order?.design_name || '—'}`))).sort();
  }, [wofs, selectedWofs, selectedMachines, activeTypeTab]);

  // 3. Machine/Partner Options
  const machineOptions = useMemo(() => {
    const matching = wofs.filter(w => {
      const matchWof = selectedWofs.length === 0 || selectedWofs.includes(w.wof_number);
      const matchDesign = selectedDesigns.length === 0 || selectedDesigns.includes(`${w.order?.design_no || '—'} / ${w.order?.design_name || '—'}`);
      const matchType = w.wof_type === activeTypeTab;
      return matchWof && matchDesign && matchType;
    });
    return Array.from(new Set(matching.map(w => w.wof_type === 'in_house' ? (w.machine?.machine_name || w.machine_name || '—') : (w.partner?.partner_name || w.partner_name || '—')).filter(Boolean))).sort();
  }, [wofs, selectedWofs, selectedDesigns, activeTypeTab]);

  // Summary counts matching filters (excluding status tab itself)
  const baseFilteredForCounts = useMemo(() => {
    return wofs.filter(w => {
      const matchSearch = !searchText ||
        w.wof_number?.toLowerCase().includes(searchText.toLowerCase()) ||
        w.order?.order_number?.toLowerCase().includes(searchText.toLowerCase());
      
      const matchWof = selectedWofs.length === 0 || selectedWofs.includes(w.wof_number);
      const matchDesign = selectedDesigns.length === 0 || selectedDesigns.includes(`${w.order?.design_no || '—'} / ${w.order?.design_name || '—'}`);
      const matchMachine = selectedMachines.length === 0 || selectedMachines.includes(w.wof_type === 'in_house' ? (w.machine?.machine_name || w.machine_name || '—') : (w.partner?.partner_name || w.partner_name || '—'));
      const matchType = w.wof_type === activeTypeTab;

      return matchSearch && matchWof && matchDesign && matchMachine && matchType;
    });
  }, [wofs, searchText, selectedWofs, selectedDesigns, selectedMachines, activeTypeTab]);

  const filtered = useMemo(() => {
    return baseFilteredForCounts.filter(w => {
      return statusFilter === 'all' || w.status === statusFilter;
    });
  }, [baseFilteredForCounts, statusFilter]);

  const counts = useMemo(() => {
    const res = { all: baseFilteredForCounts.length };
    STATUS_OPTIONS.slice(1).forEach(s => {
      res[s] = baseFilteredForCounts.filter(w => w.status === s).length;
    });
    return res;
  }, [baseFilteredForCounts]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => navigate('/production')}
          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', padding: 0, marginBottom: '0.75rem' }}
        >
          <ArrowLeft size={15} /> Back to Production
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg,#800000,#4d0000)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={20} color="white" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-current)' }}>Warping Order Forms</h1>
              <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>{wofs.length} total forms</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={fetchWofs} style={{ background: 'none', border: '1px solid var(--border-current)', borderRadius: '8px', padding: '0.5rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={() => navigate('/production/warping-forms/new')}
              style={{ background: 'linear-gradient(135deg,#800000,#4d0000)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', fontSize: '0.875rem' }}
            >
              <Plus size={16} /> Create WOF
            </button>
          </div>
        </div>
      </div>

      {/* Type Tabs: In-House / Job Work */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border-current)', marginBottom: '1.5rem', gap: '2rem' }}>
        <button
          onClick={() => {
            setActiveTypeTab('in_house');
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
          In-House ({wofs.filter(w => w.wof_type === 'in_house').length})
        </button>
        <button
          onClick={() => {
            setActiveTypeTab('job_work');
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
          Job Work ({wofs.filter(w => w.wof_type === 'job_work').length})
        </button>
      </div>
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
            placeholder="Search WOF number or order number…"
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: '1rem', 
          padding: '1.25rem', 
          backgroundColor: '#fff', 
          border: '1px solid var(--border-current)', 
          borderRadius: '8px', 
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <MultiSelectDropdown 
            label="WOF Number" 
            options={wofOptions} 
            selectedValues={selectedWofs} 
            onChange={setSelectedWofs} 
            placeholder="All WOFs"
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
          <Loader size={20} className="spin" /> Loading warping order forms…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--surface-current)', borderRadius: '12px', border: '1px dashed var(--border-current)' }}>
          <Layers size={48} style={{ color: 'var(--text-muted-current)', opacity: 0.3, marginBottom: '1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-muted-current)' }}>No warping order forms found</h3>
          <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>Create your first warping order form to get started.</p>
          <button
            onClick={() => navigate('/production/warping-forms/new')}
            style={{ background: '#800000', color: 'white', border: 'none', borderRadius: '8px', padding: '0.65rem 1.5rem', cursor: 'pointer', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} /> Create WOF
          </button>
        </div>
      ) : (
        <div style={{ borderRadius: '12px', border: '1px solid var(--border-current)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '2px solid var(--border-current)', textAlign: 'left' }}>
                <th style={{ width: '40px', padding: '0.875rem 0.5rem' }}></th>
                {['WOF & Order Ref','Design','Allocation','Qty (Mtrs)','Timeline','Status & Yarn','Action'].map(h => (
                  <th key={h} style={{ padding: '0.875rem 1rem', fontWeight: '800', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted-current)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((wof, idx) => {
                const badge = getWofStatusBadge(wof);
                const isExpanded = expandedWofId === wof.id;
                
                // Get warp requirements for the order
                const warpReqs = wof.order?.yarn_requirements?.filter(y => y.type === 'warp') || [];
                const associatedDydrs = dydrsByWof[wof.id] || [];
                const yarnBadge = getYarnStatusBadge(wof.colour_allotments, associatedDydrs);

                return (
                  <React.Fragment key={wof.id}>
                    <tr 
                      onClick={() => handleToggleExpand(wof.id)}
                      style={{ 
                        borderBottom: isExpanded ? 'none' : '1px solid var(--border-current)', 
                        backgroundColor: idx % 2 === 0 ? 'var(--surface-current)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      className="wof-row"
                    >
                      <td style={{ padding: '0.875rem 0.5rem', textAlign: 'center', width: '40px' }} onClick={(e) => { e.stopPropagation(); handleToggleExpand(wof.id); }}>
                        {isExpanded ? <ChevronDown size={16} color="var(--text-muted-current)" /> : <ChevronRight size={16} color="var(--text-muted-current)" />}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ fontWeight: '700', color: '#800000', fontFamily: 'monospace', fontSize: '0.8rem' }}>{wof.wof_number}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', fontWeight: '600', marginTop: '2px' }}>Order: {wof.order?.order_number || '—'}</div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-current)', fontSize: '0.8rem' }}>{wof.order?.design_no || '—'}</div>
                        {wof.order?.design_name && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>{wof.order.design_name}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                          <span style={{ backgroundColor: wof.wof_type === 'in_house' ? 'rgba(128,0,0,0.08)' : 'rgba(16,185,129,0.08)', color: wof.wof_type === 'in_house' ? '#800000' : '#059669', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '700' }}>
                            {wof.wof_type === 'in_house' ? 'In-House' : 'Job Work'}
                          </span>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
                            {wof.wof_type === 'in_house' ? (wof.machine?.machine_name || wof.machine_name || '—') : (
                              <div>
                                <div style={{ fontWeight: '700', color: 'var(--text-current)' }}>{wof.partner?.partner_name || wof.partner_name || '—'}</div>
                                <div style={{ fontSize: '0.7rem', fontWeight: '500' }}>{wof.machine?.machine_name || wof.machine_name || ''}</div>
                              </div>
      )}

      {/* Complete Process Modal (Job Work Warping) */}
      {showCompleteForm && (
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
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>Complete Warping Process</h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', opacity: 0.85 }}>
                  WOF: <strong style={{ fontFamily: 'monospace' }}>{showCompleteForm.wof_number}</strong>
                </p>
              </div>
              <button onClick={() => setShowCompleteForm(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '1.3rem' }}>
                &times;
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-current)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Completion Date */}
              <div style={{ maxWidth: '300px' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                  Completion Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={completeDate}
                  onChange={e => setCompleteDate(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Warp Split Configurations */}
              {completeSplits.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Warp Split Configurations ({completeSplits.length})
                  </h4>
                  <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--surface-current)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Warp Split</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Beam Number</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Actual Quantity (Mtrs) *</th>
                        </tr>
                      </thead>
                      <tbody>
                        {completeSplits.map((split, index) => (
                          <tr key={index} style={{ borderBottom: index < completeSplits.length - 1 ? '1px solid var(--border-current)' : 'none' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', fontFamily: 'monospace', color: '#800000' }}>
                              {split.warp_no}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <select
                                value={split.beam_id || ''}
                                onChange={e => {
                                  const updated = [...completeSplits];
                                  updated[index].beam_id = e.target.value;
                                  setCompleteSplits(updated);
                                }}
                                style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1.5px solid var(--border-current)', fontSize: '0.78rem', width: '100%', outline: 'none', background: 'var(--surface-current)', color: 'var(--text-current)' }}
                              >
                                <option value="">Select Beam</option>
                                {beams.map(b => (
                                  <option key={b.id} value={b.id}>{b.beam_name}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <input
                                type="number"
                                value={split.qty}
                                onChange={e => {
                                  const updated = [...completeSplits];
                                  updated[index].qty = e.target.value;
                                  setCompleteSplits(updated);
                                }}
                                style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1.5px solid var(--border-current)', fontSize: '0.78rem', width: '100%', boxSizing: 'border-box', outline: 'none', background: 'var(--surface-current)', color: 'var(--text-current)' }}
                                placeholder="Enter Quantity"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Dyed Yarn Return Details */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Dyed Yarn Return Details
                </h4>
                {yarnReturns.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted-current)', border: '1px dashed var(--border-current)', borderRadius: '8px', backgroundColor: 'var(--surface-current)' }}>
                    No dyed yarn received for this process yet.
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
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', width: '130px' }}>Return Qty (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yarnReturns.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: idx < yarnReturns.length - 1 ? '1px solid var(--border-current)' : 'none' }}>
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
                                  const updated = [...yarnReturns];
                                  updated[idx].quantity_returned = e.target.value;
                                  setYarnReturns(updated);
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
              <button onClick={() => setShowCompleteForm(null)} disabled={savingComplete} style={{ border: '1px solid var(--border-current)', backgroundColor: 'transparent', color: 'var(--text-current)', padding: '0.55rem 1.25rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleCompleteProcess} disabled={savingComplete} style={{ backgroundColor: '#059669', border: 'none', color: 'white', padding: '0.55rem 1.5rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: savingComplete ? 0.7 : 1 }}>
                {savingComplete ? <Loader size={14} className="spin" /> : <CheckCircle size={14} />}
                {savingComplete ? 'Completing...' : 'Confirm & Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: '700' }}>{Number(wof.qty).toLocaleString()}</td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem' }}>
                          <div><span style={{ color: 'var(--text-muted-current)', fontWeight: '500' }}>Start:</span> <span style={{ fontWeight: '600' }}>{wof.start_date || '—'}</span></div>
                          <div><span style={{ color: 'var(--text-muted-current)', fontWeight: '500' }}>End:</span> <span style={{ fontWeight: '600' }}>{wof.end_date || '—'}</span></div>
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                          <span style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                            {badge.label}
                          </span>
                          <span style={{ backgroundColor: yarnBadge.bg, color: yarnBadge.color, border: `1px solid ${yarnBadge.border}`, padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                            Yarn: {yarnBadge.label}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => setPrintWof(wof)}
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
                          <button
                            onClick={() => handleOpenEditWof(wof)}
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
                          {wof.wof_type === 'job_work' && wof.status === 'created' && yarnBadge.label === 'Delivered' && (
                            <button
                              onClick={() => updateStatus(wof.id, 'on_process')}
                              disabled={updating === wof.id}
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
                                opacity: updating === wof.id ? 0.7 : 1
                              }}
                            >
                              {updating === wof.id ? <Loader size={13} className="spin" /> : <Play size={13} />} Start Process
                            </button>
                          )}
                          {wof.wof_type === 'job_work' && wof.status === 'on_process' && (
                            <>
                              <button
                                onClick={() => openCompleteForm(wof)}
                                disabled={updating === wof.id}
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
                                  opacity: updating === wof.id ? 0.7 : 1
                                }}
                              >
                                {updating === wof.id ? <Loader size={13} className="spin" /> : <CheckCircle size={13} />} Complete
                              </button>
                              <button
                                onClick={() => openStopWizard(wof)}
                                disabled={updating === wof.id}
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
                                  opacity: updating === wof.id ? 0.7 : 1
                                }}
                              >
                                {updating === wof.id ? <Loader size={13} className="spin" /> : <StopCircle size={13} />} Stop
                              </button>
                            </>
                          )}
                          {wof.wof_type === 'job_work' && wof.status === 'stopped' && !wof.wofdc_number && (
                            <button
                              onClick={() => updateStatus(wof.id, 'on_process')}
                              disabled={updating === wof.id}
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
                                  opacity: updating === wof.id ? 0.7 : 1
                                }}
                              >
                                {updating === wof.id ? <Loader size={13} className="spin" /> : <Play size={13} />} Resume
                              </button>
                            )}
                            {wof.forwarded_to ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '0.35rem 0.6rem',
                                backgroundColor: wof.forwarded_to === 'sizing' ? 'rgba(14,165,233,0.1)' : 'rgba(16,185,129,0.1)',
                                color: wof.forwarded_to === 'sizing' ? '#0284c7' : '#059669',
                                border: wof.forwarded_to === 'sizing' ? '1px solid rgba(14,165,233,0.2)' : '1px solid rgba(16,185,129,0.2)',
                                borderRadius: '6px',
                                fontWeight: '700',
                                fontSize: '0.7rem',
                                textTransform: 'capitalize'
                              }}>
                                → {wof.forwarded_to}
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setForwardTo('sizing');
                                  setSplitCount(1);
                                  setForwardWof(wof);
                                }}
                                disabled={wof.status === 'stopped' && !!wof.wofdc_number}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  padding: '0.35rem 0.75rem',
                                  backgroundColor: (wof.status === 'stopped' && !!wof.wofdc_number) ? '#d1d5db' : '#800000',
                                  border: (wof.status === 'stopped' && !!wof.wofdc_number) ? '1px solid #d1d5db' : '1px solid #800000',
                                  borderRadius: '6px',
                                  color: (wof.status === 'stopped' && !!wof.wofdc_number) ? '#9ca3af' : 'white',
                                  fontWeight: '600',
                                  fontSize: '0.75rem',
                                  cursor: (wof.status === 'stopped' && !!wof.wofdc_number) ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                <ArrowRight size={13} /> Forward
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded details row */}
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(128,0,0,0.01)', borderBottom: '1px solid var(--border-current)' }}>
                        <td colSpan={8} style={{ padding: '1.5rem', borderLeft: '3px solid #800000' }} onClick={(e) => e.stopPropagation()}>
                          
                          {/* Tabs Header */}
                          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-current)', marginBottom: '1.25rem', gap: '1rem' }}>
                            <button
                              onClick={() => setActiveDetailTab('yarn')}
                              style={{
                                padding: '0.5rem 1rem',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeDetailTab === 'yarn' ? '2.5px solid #800000' : '2.5px solid transparent',
                                color: activeDetailTab === 'yarn' ? '#800000' : 'var(--text-muted-current)',
                                fontWeight: '700',
                                cursor: 'pointer',
                                fontSize: '0.825rem',
                                paddingBottom: '0.75rem',
                                transition: 'all 0.15s'
                              }}
                            >
                              Yarn Requirements & DYDR
                            </button>
                            <button
                              onClick={() => setActiveDetailTab('warping')}
                              style={{
                                padding: '0.5rem 1rem',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeDetailTab === 'warping' ? '2.5px solid #800000' : '2.5px solid transparent',
                                color: activeDetailTab === 'warping' ? '#800000' : 'var(--text-muted-current)',
                                fontWeight: '700',
                                cursor: 'pointer',
                                fontSize: '0.825rem',
                                paddingBottom: '0.75rem',
                                transition: 'all 0.15s'
                              }}
                            >
                              Warping
                            </button>
                          </div>

                          {/* Tab Contents */}
                          {activeDetailTab === 'yarn' && (
                            <div>
                              {/* 1. Allotments Table */}
                              <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yarn Allotments for Warping Order Form</h4>
                                {(!wof.colour_allotments || wof.colour_allotments.length === 0) ? (
                                  <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.8rem', fontStyle: 'italic' }}>No allotments specified for this warping order form.</p>
                                ) : (
                                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                          {['Colour', 'Yarn Count', 'Required Qty (kg)', 'Allotted (This WOF) (kg)', 'Dyed Yarn Delivered (kg)', 'Balance to Deliver (kg)'].map(h => (
                                            <th key={h} style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(wof.colour_allotments || []).map((a, rIdx) => {
                                          const yc = yarnCounts.find(y => y.id === a.countId);
                                          const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (a.countValue || '—');
                                          
                                          const allottedThisWof = parseFloat(a.allotted_qty || 0);

                                          // Dyed yarn delivered (matching both count and colour)
                                          const deliveredItems = associatedDydrs.filter(dItem => {
                                            const matchCount = (dItem.yarn_count_id && a.countId && dItem.yarn_count_id === a.countId) || 
                                                               (dItem.yarn_count?.count_value === a.countValue);
                                            const matchColour = (dItem.colour === a.colour);
                                            return matchCount && matchColour;
                                          });
                                          const deliveredQty = deliveredItems.reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);
                                          
                                          const requiredQty = parseFloat(a.required_qty || 0);
                                          const balanceToDeliver = Math.max(0, allottedThisWof - deliveredQty);

                                          return (
                                            <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>{a.colour || '—'}</td>
                                              <td style={{ padding: '0.6rem 0.75rem' }}>{countDisplay}</td>
                                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>{requiredQty.toFixed(2)}</td>
                                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#800000' }}>{allottedThisWof.toFixed(2)}</td>
                                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857' }}>{deliveredQty.toFixed(2)}</td>
                                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: balanceToDeliver > 0.01 ? '#b45309' : '#047857' }}>
                                                {balanceToDeliver.toFixed(2)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>

                              {/* 2. DYDR Deliveries */}
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
                                    No DYDR delivery receipts have been created for this warping order form yet.
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
                                            target_process: 'warping',
                                            doc_no: wof.wof_number,
                                            machine_name: wof.machine?.machine_name || wof.machine_name || '—',
                                            order_no: wof.order?.order_number || '—',
                                            design_no: wof.order?.design_no || '—',
                                            design_name: wof.order?.design_name || '',
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
                            </div>
                          )}

                          {activeDetailTab === 'warping' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem 0' }}>
                              {/* Production details card */}
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                gap: '1.5rem',
                                backgroundColor: 'var(--surface-current)',
                                padding: '1.25rem',
                                borderRadius: '10px',
                                border: '1px solid var(--border-current)'
                              }}>
                                <div>
                                  <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Warper Name</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: wof.warper_name ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                    {wof.warper_name || 'Not Assigned'}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Actual Start Date</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: wof.process_started_at ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                    {wof.process_started_at
                                      ? new Date(wof.process_started_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                      : '—'}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Actual End Date</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: wof.process_completed_at ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                    {wof.process_completed_at
                                      ? new Date(wof.process_completed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                      : '—'}
                                  </span>
                                </div>
                              </div>

                              {/* Forwarding & Warp Split configuration section */}
                              <div>
                                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Forwarding & Warp Split Configuration
                                </h4>
                                {wof.forwarded_to ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', backgroundColor: 'var(--surface-current)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-current)', fontSize: '0.825rem' }}>
                                      <div>
                                        <span style={{ color: 'var(--text-muted-current)', marginRight: '0.5rem', fontWeight: '500' }}>Forwarded To:</span>
                                        <span style={{
                                          fontWeight: '800',
                                          textTransform: 'uppercase',
                                          color: wof.forwarded_to === 'sizing' ? '#0284c7' : '#059669',
                                          backgroundColor: wof.forwarded_to === 'sizing' ? 'rgba(14,165,233,0.1)' : 'rgba(16,185,129,0.1)',
                                          padding: '0.2rem 0.5rem',
                                          borderRadius: '4px',
                                          fontSize: '0.75rem'
                                        }}>
                                          {wof.forwarded_to}
                                        </span>
                                      </div>
                                      {wof.forwarded_to === 'sizing' && (
                                        <div>
                                          <span style={{ color: 'var(--text-muted-current)', marginRight: '0.5rem', fontWeight: '500' }}>Sizing Type:</span>
                                          <span style={{ fontWeight: '700', textTransform: 'capitalize', color: 'var(--text-current)' }}>
                                            {wof.sizing_type === 'in_house' ? 'In-House' : 'Job Work'}
                                          </span>
                                        </div>
                                      )}
                                      {wof.warp_splits_count > 0 && (
                                        <div>
                                          <span style={{ color: 'var(--text-muted-current)', marginRight: '0.5rem', fontWeight: '500' }}>Number of Splits:</span>
                                          <span style={{ fontWeight: '800', backgroundColor: 'rgba(128,0,0,0.05)', color: '#800000', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                                            {wof.warp_splits_count}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {wof.warp_splits && wof.warp_splits.length > 0 && (
                                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                          <thead>
                                            <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                              {['Warp / SOF Number', 'Type', 'Allocation / Machine', 'Quantity (Mtrs)', 'Scheduled Start Date', 'Scheduled End Date'].map(h => (
                                                <th key={h} style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>{h}</th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {wof.warp_splits.map((split, sIdx) => {
                                              const typeVal = split.sizing_type || split.weaving_type || '—';
                                              const machineVal = split.sizing_type
                                                ? (split.sizing_type === 'in_house'
                                                    ? (split.machine_name || 'In-House Sizing')
                                                    : `Job Work - ${split.partner_name || '—'} (${split.machine_name || '—'})`)
                                                : (split.weaving_type === 'in_house'
                                                    ? (split.machine_name || 'In-House Loom')
                                                    : `Job Work - ${split.partner_name || '—'} (${split.machine_name || '—'})`);
                                              
                                              return (
                                                <tr key={sIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', fontFamily: 'monospace', color: '#0ea5e9' }}>
                                                    {split.warp_no} {split.beam_name ? `(Beam: ${split.beam_name})` : ''}
                                                  </td>
                                                  <td style={{ padding: '0.6rem 0.75rem', textTransform: 'capitalize' }}>
                                                    {typeVal.replace('_', ' ')}
                                                  </td>
                                                  <td style={{ padding: '0.6rem 0.75rem' }}>
                                                    {machineVal}
                                                  </td>
                                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>
                                                    {parseFloat(split.qty || 0).toLocaleString('en-IN')} m
                                                  </td>
                                                  <td style={{ padding: '0.6rem 0.75rem' }}>
                                                    {split.start_date ? new Date(split.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                  </td>
                                                  <td style={{ padding: '0.6rem 0.75rem' }}>
                                                    {split.end_date ? new Date(split.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}

                                  </div>
                                ) : (
                                  !(wof.status === 'stopped' && !!wof.wofdc_number) && (
                                    <div style={{ padding: '1.5rem', border: '1px dashed var(--border-current)', borderRadius: '8px', backgroundColor: 'var(--surface-current)', textAlign: 'center', color: 'var(--text-muted-current)', fontSize: '0.85rem' }}>
                                      No forwarding configurations set. Use the "Forward" button to route this order form to Weaving or Sizing.
                                    </div>
                                  )
                                )}

                                {/* Collapsible WOFDC Delivery Receipt */}
                                {(wof.status === 'completed' || (wof.status === 'stopped' && !!wof.wofdc_number)) && (
                                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-current)', paddingTop: '1.25rem' }}>
                                    <div 
                                      onClick={() => setExpandedWofdcId(expandedWofdcId === wof.id ? null : wof.id)}
                                      style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center', 
                                        backgroundColor: 'rgba(128,0,0,0.04)', 
                                        padding: '0.75rem 1rem', 
                                        borderRadius: '8px', 
                                        border: '1px solid #800000', 
                                        cursor: 'pointer',
                                        userSelect: 'none'
                                      }}
                                    >
                                      <span style={{ fontWeight: '800', color: '#800000', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        📄 Delivery Receipt (WOFDC): {wof.wofdc_number || '—'}
                                      </span>
                                      <span style={{ fontSize: '0.75rem', fontWeight: '750', color: '#800000', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        {expandedWofdcId === wof.id ? 'Collapse Details ▲' : 'Expand Details ▼'}
                                      </span>
                                    </div>
                                    
                                    {expandedWofdcId === wof.id && (
                                      <div style={{ marginTop: '1rem' }}>
                                        <PrintableWOFDC 
                                          wof={wof} 
                                          order={wof.order} 
                                          splits={wof.warp_splits || []} 
                                          yarnReturns={wof.yarn_returns || []} 
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
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
      {/* View/Print Modal Overlay */}
      {printWof && (
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
            maxWidth: '960px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
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
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-current)' }}>
                Warping Order Form details: {printWof.wof_number}
              </h3>
              <button
                onClick={() => setPrintWof(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted-current)',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  fontWeight: '300',
                  lineHeight: 1,
                  padding: '4px'
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              backgroundColor: 'var(--bg-current)'
            }}>
              <PrintableWOF
                wof={printWof}
                order={printWof.order}
                machineName={printWof.machine?.machine_name || printWof.machine_name}
                partnerName={printWof.partner?.partner_name || printWof.partner_name}
                yarnCounts={yarnCounts}
              />
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal Overlay */}
      {forwardWof && (
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
            maxWidth: '600px',
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
                  Forward Warping Order Form
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                  WOF: <strong style={{ color: '#800000', fontFamily: 'monospace' }}>{forwardWof.wof_number}</strong> | Total Qty: {Number(forwardWof.qty).toLocaleString()} Mtrs
                </p>
              </div>
              <button
                onClick={() => setForwardWof(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted-current)',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  fontWeight: '300',
                  lineHeight: 1,
                  padding: '4px'
                }}
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

              {/* Forward To Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '800', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted-current)' }}>
                  Forward Process To
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {[
                    { id: 'sizing', label: 'Sizing', sub: 'Forward to Sizing Department' },
                    { id: 'weaving', label: 'Weaving', sub: 'Forward directly to Weaving Department' }
                  ].map(opt => (
                    <div
                      key={opt.id}
                      onClick={() => setForwardTo(opt.id)}
                      style={{
                        border: `2px solid ${forwardTo === opt.id ? '#800000' : 'var(--border-current)'}`,
                        borderRadius: '10px',
                        padding: '1rem',
                        cursor: 'pointer',
                        backgroundColor: forwardTo === opt.id ? 'rgba(128,0,0,0.04)' : 'var(--surface-current)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', color: forwardTo === opt.id ? '#800000' : 'var(--text-current)' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>{opt.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Number of Warps to split */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '800', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted-current)' }}>
                  Number of Warps to Split
                </label>
                <select
                  value={splitCount}
                  onChange={e => setSplitCount(parseInt(e.target.value))}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.875rem', background: 'var(--surface-current)', color: 'var(--text-current)', cursor: 'pointer' }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n}>{n} Warp{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>

              {/* Splits Details Form */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '800', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted-current)' }}>
                  Warp Splits Configuration
                </label>
                {loadingModalData ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted-current)', padding: '1rem' }}>
                    <Loader size={14} className="spin" /> Loading options...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {splitsData.map((split, index) => (
                      <div
                        key={index}
                        style={{
                          backgroundColor: 'var(--surface-current)',
                          border: '1px solid var(--border-current)',
                          borderRadius: '10px',
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem' }}>
                          <span style={{ fontWeight: '800', fontSize: '0.8rem', color: '#800000' }}>
                            Warp #{index + 1}: <span style={{ fontFamily: 'monospace' }}>{forwardWof.wof_number}/{index + 1}</span>
                          </span>
                        </div>

                        {/* --- SIZING ALLOCATION CONTROLS --- */}
                        {forwardTo === 'sizing' && (
                          <>
                            {/* Row 1: Sizing Type, Partner, Sizing Machine */}
                            <div style={{ display: 'grid', gridTemplateColumns: split.sizing_type === 'job_work' ? '1fr 1.2fr 1fr' : '1fr 1fr', gap: '0.5rem' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Sizing Type</label>
                                <select
                                  value={split.sizing_type || 'in_house'}
                                  onChange={e => setSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, sizing_type: e.target.value, partner_id: '', machine_id: '' } : s))}
                                  style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box' }}
                                >
                                  <option value="in_house">In-House</option>
                                  <option value="job_work">Job Work</option>
                                </select>
                              </div>

                              {split.sizing_type === 'job_work' && (
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Partner</label>
                                  <select
                                    value={split.partner_id || ''}
                                    onChange={e => setSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, partner_id: e.target.value, machine_id: '' } : s))}
                                    required
                                    style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box' }}
                                  >
                                    <option value="">— Select Partner —</option>
                                    {fSizingPartners.map(p => (
                                      <option key={p.id} value={p.id}>{p.partner_name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Sizing Machine</label>
                                <select
                                  value={split.machine_id || ''}
                                  onChange={e => setSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, machine_id: e.target.value } : s))}
                                  required
                                  disabled={split.sizing_type === 'job_work' && !split.partner_id}
                                  style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box', opacity: (split.sizing_type === 'job_work' && !split.partner_id) ? 0.5 : 1 }}
                                >
                                  <option value="">— Select Machine —</option>
                                  {(split.sizing_type === 'in_house' ? fInHouseSizingMachines : fJobWorkSizingMachines.filter(m => m.partner_id === split.partner_id)).map(m => (
                                    <option key={m.id} value={m.id}>{m.machine_name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Row 2: Qty, Dates, Beam */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Qty (Mtrs)</label>
                                <input
                                  type="number"
                                  value={split.qty}
                                  onChange={e => setSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, qty: e.target.value } : s))}
                                  required
                                  style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Start Date</label>
                                <input
                                  type="date"
                                  value={split.start_date}
                                  onChange={e => setSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, start_date: e.target.value } : s))}
                                  required
                                  style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>End Date</label>
                                <input
                                  type="date"
                                  value={split.end_date}
                                  min={split.start_date}
                                  onChange={e => setSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, end_date: e.target.value } : s))}
                                  required
                                  style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Beam Number</label>
                                <select
                                  value={split.beam_id || ''}
                                  onChange={e => {
                                    const beam = beams.find(b => b.id === e.target.value);
                                    setSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, beam_id: e.target.value, beam_name: beam ? beam.beam_name : '' } : s));
                                  }}
                                  style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                >
                                  <option value="">Select Beam</option>
                                  {beams.map(b => (
                                    <option key={b.id} value={b.id}>{b.beam_name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {split.sizing_type === 'job_work' && !split.partner_id && (
                              <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                                Select a sizing partner first to see available machines.
                              </div>
                            )}
                            {split.sizing_type === 'in_house' && fInHouseSizingMachines.length === 0 && (
                              <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                                No in-house sizing machines found.
                              </div>
                            )}
                            {split.sizing_type === 'job_work' && split.partner_id && fJobWorkSizingMachines.filter(m => m.partner_id === split.partner_id).length === 0 && (
                              <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                                No job work sizing machines found for this partner.
                              </div>
                            )}
                          </>
                        )}

                        {/* --- WEAVING ALLOCATION CONTROLS --- */}
                        {forwardTo === 'weaving' && (
                          <>
                            {/* Row 1: Weaving Type, Partner, Loom */}
                            <div style={{ display: 'grid', gridTemplateColumns: split.weaving_type === 'job_work' ? '1fr 1.2fr 1fr' : '1fr 1fr', gap: '0.5rem' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Weaving Type</label>
                                <select
                                  value={split.weaving_type || 'in_house'}
                                  onChange={e => setSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, weaving_type: e.target.value, partner_id: '', machine_id: '' } : s))}
                                  style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box' }}
                                >
                                  <option value="in_house">In-House</option>
                                  <option value="job_work">Job Work</option>
                                </select>
                              </div>

                              {split.weaving_type === 'job_work' && (
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Partner</label>
                                  <select
                                    value={split.partner_id || ''}
                                    onChange={e => setSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, partner_id: e.target.value, machine_id: '' } : s))}
                                    required
                                    style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box' }}
                                  >
                                    <option value="">— Select Partner —</option>
                                    {fWeavingPartners.map(p => (
                                      <option key={p.id} value={p.id}>{p.partner_name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Loom Name</label>
                                <select
                                  value={split.machine_id || ''}
                                  onChange={e => setSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, machine_id: e.target.value } : s))}
                                  required
                                  disabled={split.weaving_type === 'job_work' && !split.partner_id}
                                  style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box', opacity: (split.weaving_type === 'job_work' && !split.partner_id) ? 0.5 : 1 }}
                                >
                                  <option value="">— Select Loom —</option>
                                  {(split.weaving_type === 'in_house' ? fInHouseWeavingMachines : fJobWorkWeavingMachines.filter(m => m.partner_id === split.partner_id)).map(m => (
                                    <option key={m.id} value={m.id}>{m.machine_name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Row 2: Qty, Dates */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Qty (Mtrs)</label>
                                <input
                                  type="number"
                                  value={split.qty}
                                  onChange={e => setSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, qty: e.target.value } : s))}
                                  required
                                  style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Start Date</label>
                                <input
                                  type="date"
                                  value={split.start_date}
                                  onChange={e => setSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, start_date: e.target.value } : s))}
                                  required
                                  style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>End Date</label>
                                <input
                                  type="date"
                                  value={split.end_date}
                                  min={split.start_date}
                                  onChange={e => setSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, end_date: e.target.value } : s))}
                                  required
                                  style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                />
                              </div>
                            </div>

                            {split.weaving_type === 'job_work' && !split.partner_id && (
                              <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                                Select a weaving partner first to see available looms.
                              </div>
                            )}
                            {split.weaving_type === 'in_house' && fInHouseWeavingMachines.length === 0 && (
                              <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                                No in-house weaving looms found.
                              </div>
                            )}
                            {split.weaving_type === 'job_work' && split.partner_id && fJobWorkWeavingMachines.filter(m => m.partner_id === split.partner_id).length === 0 && (
                              <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                                No job work looms found for this partner.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-current)',
              backgroundColor: 'var(--surface-current)'
            }}>
              <button
                onClick={() => setForwardWof(null)}
                style={{
                  border: '1px solid var(--border-current)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-current)',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.825rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleForwardSubmit}
                disabled={forwardSubmitting}
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
                  opacity: forwardSubmitting ? 0.7 : 1
                }}
              >
                {forwardSubmitting ? (
                  <>
                    <Loader size={14} className="spin" /> Submitting...
                  </>
                ) : (
                  'Confirm Forward'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit WOF Modal Overlay */}
      {editWof && (
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
            maxWidth: '650px',
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
                  Edit Warping Order Form
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                  WOF: <strong style={{ color: '#800000', fontFamily: 'monospace' }}>{editWof.wof_number}</strong>
                </p>
              </div>
              <button
                onClick={() => setEditWof(null)}
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
              gap: '1.5rem'
            }}>
              {editWofError && (
                <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem 1rem', color: '#b91c1c', fontSize: '0.825rem' }}>
                  {editWofError}
                </div>
              )}

              {/* Core Details Section */}
              <div style={{ border: '1px solid var(--border-current)', borderRadius: '10px', padding: '1.25rem', backgroundColor: 'var(--surface-current)' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '800', color: '#800000', borderBottom: '1px solid rgba(128,0,0,0.1)', paddingBottom: '0.4rem' }}>
                  Core Warping Details
                </h4>

                {editWof.status !== 'created' && (
                  <div style={{ backgroundColor: 'rgba(128,0,0,0.05)', border: '1px solid rgba(128,0,0,0.1)', color: '#800000', borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.75rem', fontWeight: '600', marginBottom: '1rem' }}>
                    ⚠️ Core warping details cannot be modified because the process has started (Status: {editWof.status.replace('_', ' ')}).
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Quantity */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.3rem' }}>Warping Quantity (Mtrs)</label>
                    <input
                      type="number"
                      value={editQty}
                      onChange={e => setEditQty(e.target.value)}
                      disabled={editWof.status !== 'created'}
                      style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', background: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Scope / Warping Type */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.3rem' }}>Warping Scope</label>
                    <select
                      value={editWofType}
                      onChange={e => { setEditWofType(e.target.value); setEditMachineId(''); setEditPartnerId(''); }}
                      disabled={editWof.status !== 'created'}
                      style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', background: 'var(--surface-current)', color: 'var(--text-current)', cursor: 'pointer' }}
                    >
                      <option value="in_house">In-House Warping</option>
                      <option value="job_work">Job Work Warping</option>
                    </select>
                  </div>

                  {/* Allocation */}
                  {editWofType === 'job_work' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.3rem' }}>Warping Partner</label>
                        <select
                          value={editPartnerId}
                          onChange={e => { setEditPartnerId(e.target.value); setEditMachineId(''); }}
                          disabled={editWof.status !== 'created'}
                          style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', background: 'var(--surface-current)', color: 'var(--text-current)', cursor: 'pointer' }}
                        >
                          <option value="">— Select Partner —</option>
                          {warpingPartners.map(p => <option key={p.id} value={p.id}>{p.partner_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.3rem' }}>Machine at Partner</label>
                        <select
                          value={editMachineId}
                          onChange={e => setEditMachineId(e.target.value)}
                          disabled={editWof.status !== 'created' || !editPartnerId}
                          style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', background: 'var(--surface-current)', color: 'var(--text-current)', cursor: 'pointer' }}
                        >
                          <option value="">— Select Machine —</option>
                          {warpingMachines.map(m => <option key={m.id} value={m.id}>{m.machine_name}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.3rem' }}>In-House Warping Machine</label>
                      <select
                        value={editMachineId}
                        onChange={e => setEditMachineId(e.target.value)}
                        disabled={editWof.status !== 'created'}
                        style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', background: 'var(--surface-current)', color: 'var(--text-current)', cursor: 'pointer' }}
                      >
                        <option value="">— Select Machine —</option>
                        {warpingMachines.map(m => <option key={m.id} value={m.id}>{m.machine_name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Dates */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.3rem' }}>Start Date</label>
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={e => setEditStartDate(e.target.value)}
                        disabled={editWof.status !== 'created'}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', background: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.3rem' }}>End Date</label>
                      <input
                        type="date"
                        value={editEndDate}
                        min={editStartDate}
                        onChange={e => setEditEndDate(e.target.value)}
                        disabled={editWof.status !== 'created'}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', background: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Forward Details Section */}
              <div style={{ border: '1px solid var(--border-current)', borderRadius: '10px', padding: '1.25rem', backgroundColor: 'var(--surface-current)' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '800', color: '#800000', borderBottom: '1px solid rgba(128,0,0,0.1)', paddingBottom: '0.4rem' }}>
                  Forwarding & Split Configuration
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Forward Process Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.3rem' }}>Forward Process To</label>
                    <select
                      value={editForwardedTo}
                      onChange={e => {
                        setEditForwardedTo(e.target.value);
                        if (e.target.value === 'sizing') {
                          setEditForwardSizingType('in_house');
                          setEditForwardSplitsCount(1);
                        } else if (e.target.value === 'weaving') {
                          setEditForwardSplitsCount(1);
                        } else {
                          setEditForwardSplitsCount(0);
                        }
                      }}
                      style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', background: 'var(--surface-current)', color: 'var(--text-current)', cursor: 'pointer' }}
                    >
                      <option value="">Not Forwarded (Clear Forwarding)</option>
                      <option value="sizing">Sizing Department</option>
                      <option value="weaving">Weaving Department</option>
                    </select>
                  </div>

                  {/* Number of splits count */}
                  {editForwardedTo && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.3rem' }}>Number of Split Warps</label>
                        <select
                          value={editForwardSplitsCount}
                          onChange={e => setEditForwardSplitsCount(parseInt(e.target.value))}
                          style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', background: 'var(--surface-current)', color: 'var(--text-current)', cursor: 'pointer' }}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                            <option key={n} value={n}>{n} Warp{n > 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>

                      {/* Splits config inputs */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#800000' }}>Warp Splits Layout</div>
                        {editForwardSplitsData.map((split, index) => (
                          <div
                            key={index}
                            style={{
                              backgroundColor: 'var(--surface-current)',
                              border: '1px solid var(--border-current)',
                              borderRadius: '10px',
                              padding: '1rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem' }}>
                              <span style={{ fontWeight: '800', fontSize: '0.8rem', color: '#800000' }}>
                                Warp #{index + 1}: <span style={{ fontFamily: 'monospace' }}>{editWof.wof_number}/{index + 1}</span>
                              </span>
                              {index < editForwardSplits.length && (
                                <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: '500' }}>Mapped from existing</span>
                              )}
                            </div>

                            {/* --- SIZING ALLOCATION CONTROLS --- */}
                            {editForwardedTo === 'sizing' && (
                              <>
                                {/* Row 1: Sizing Type, Partner, Sizing Machine */}
                                <div style={{ display: 'grid', gridTemplateColumns: split.sizing_type === 'job_work' ? '1fr 1.2fr 1fr' : '1fr 1fr', gap: '0.5rem' }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Sizing Type</label>
                                    <select
                                      value={split.sizing_type || 'in_house'}
                                      onChange={e => setEditForwardSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, sizing_type: e.target.value, partner_id: '', machine_id: '' } : s))}
                                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box' }}
                                    >
                                      <option value="in_house">In-House</option>
                                      <option value="job_work">Job Work</option>
                                    </select>
                                  </div>

                                  {split.sizing_type === 'job_work' && (
                                    <div>
                                      <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Partner</label>
                                      <select
                                        value={split.partner_id || ''}
                                        onChange={e => setEditForwardSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, partner_id: e.target.value, machine_id: '' } : s))}
                                        required
                                        style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box' }}
                                      >
                                        <option value="">— Select Partner —</option>
                                        {fSizingPartners.map(p => (
                                          <option key={p.id} value={p.id}>{p.partner_name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Sizing Machine</label>
                                    <select
                                      value={split.machine_id || ''}
                                      onChange={e => setEditForwardSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, machine_id: e.target.value } : s))}
                                      required
                                      disabled={split.sizing_type === 'job_work' && !split.partner_id}
                                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box', opacity: (split.sizing_type === 'job_work' && !split.partner_id) ? 0.5 : 1 }}
                                    >
                                      <option value="">— Select Machine —</option>
                                      {(split.sizing_type === 'in_house' ? fInHouseSizingMachines : fJobWorkSizingMachines.filter(m => m.partner_id === split.partner_id)).map(m => (
                                        <option key={m.id} value={m.id}>{m.machine_name}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {/* Row 2: Qty, Dates, Beam */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Qty (Mtrs)</label>
                                    <input
                                      type="number"
                                      value={split.qty}
                                      onChange={e => setEditForwardSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, qty: e.target.value } : s))}
                                      required
                                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Start Date</label>
                                    <input
                                      type="date"
                                      value={split.start_date}
                                      onChange={e => setEditForwardSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, start_date: e.target.value } : s))}
                                      required
                                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>End Date</label>
                                    <input
                                      type="date"
                                      value={split.end_date}
                                      min={split.start_date}
                                      onChange={e => setEditForwardSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, end_date: e.target.value } : s))}
                                      required
                                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Beam Number</label>
                                    <select
                                      value={split.beam_id || ''}
                                      onChange={e => {
                                        const beam = beams.find(b => b.id === e.target.value);
                                        setEditForwardSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, beam_id: e.target.value, beam_name: beam ? beam.beam_name : '' } : s));
                                      }}
                                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                    >
                                      <option value="">Select Beam</option>
                                      {beams.map(b => (
                                        <option key={b.id} value={b.id}>{b.beam_name}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {split.sizing_type === 'job_work' && !split.partner_id && (
                                  <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                                    Select a sizing partner first to see available machines.
                                  </div>
                                )}
                                {split.sizing_type === 'in_house' && fInHouseSizingMachines.length === 0 && (
                                  <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                                    No in-house sizing machines found.
                                  </div>
                                )}
                                {split.sizing_type === 'job_work' && split.partner_id && fJobWorkSizingMachines.filter(m => m.partner_id === split.partner_id).length === 0 && (
                                  <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                                    No job work sizing machines found for this partner.
                                  </div>
                                )}
                              </>
                            )}

                            {/* --- WEAVING ALLOCATION CONTROLS --- */}
                            {editForwardedTo === 'weaving' && (
                              <>
                                {/* Row 1: Weaving Type, Partner, Loom */}
                                <div style={{ display: 'grid', gridTemplateColumns: split.weaving_type === 'job_work' ? '1fr 1.2fr 1fr' : '1fr 1fr', gap: '0.5rem' }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Weaving Type</label>
                                    <select
                                      value={split.weaving_type || 'in_house'}
                                      onChange={e => setEditForwardSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, weaving_type: e.target.value, partner_id: '', machine_id: '' } : s))}
                                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box' }}
                                    >
                                      <option value="in_house">In-House</option>
                                      <option value="job_work">Job Work</option>
                                    </select>
                                  </div>

                                  {split.weaving_type === 'job_work' && (
                                    <div>
                                      <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Partner</label>
                                      <select
                                        value={split.partner_id || ''}
                                        onChange={e => setEditForwardSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, partner_id: e.target.value, machine_id: '' } : s))}
                                        required
                                        style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box' }}
                                      >
                                        <option value="">— Select Partner —</option>
                                        {fWeavingPartners.map(p => (
                                          <option key={p.id} value={p.id}>{p.partner_name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Loom Name</label>
                                    <select
                                      value={split.machine_id || ''}
                                      onChange={e => setEditForwardSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, machine_id: e.target.value } : s))}
                                      required
                                      disabled={split.weaving_type === 'job_work' && !split.partner_id}
                                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', cursor: 'pointer', boxSizing: 'border-box', opacity: (split.weaving_type === 'job_work' && !split.partner_id) ? 0.5 : 1 }}
                                    >
                                      <option value="">— Select Loom —</option>
                                      {(split.weaving_type === 'in_house' ? fInHouseWeavingMachines : fJobWorkWeavingMachines.filter(m => m.partner_id === split.partner_id)).map(m => (
                                        <option key={m.id} value={m.id}>{m.machine_name}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {/* Row 2: Qty, Dates */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Qty (Mtrs)</label>
                                    <input
                                      type="number"
                                      value={split.qty}
                                      onChange={e => setEditForwardSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, qty: e.target.value } : s))}
                                      required
                                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Start Date</label>
                                    <input
                                      type="date"
                                      value={split.start_date}
                                      onChange={e => setEditForwardSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, start_date: e.target.value } : s))}
                                      required
                                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>End Date</label>
                                    <input
                                      type="date"
                                      value={split.end_date}
                                      min={split.start_date}
                                      onChange={e => setEditForwardSplitsData(prev => prev.map((s, idx) => idx === index ? { ...s, end_date: e.target.value } : s))}
                                      required
                                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                                    />
                                  </div>
                                </div>

                                {split.weaving_type === 'job_work' && !split.partner_id && (
                                  <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                                    Select a weaving partner first to see available looms.
                                  </div>
                                )}
                                {split.weaving_type === 'in_house' && fInHouseWeavingMachines.length === 0 && (
                                  <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                                    No in-house weaving looms found.
                                  </div>
                                )}
                                {split.weaving_type === 'job_work' && split.partner_id && fJobWorkWeavingMachines.filter(m => m.partner_id === split.partner_id).length === 0 && (
                                  <div style={{ fontSize: '0.65rem', color: '#dc2626', fontStyle: 'italic', marginTop: '2px' }}>
                                    No job work looms found for this partner.
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-current)', backgroundColor: 'var(--surface-current)' }}>
              <button
                onClick={() => setEditWof(null)}
                style={{ border: '1px solid var(--border-current)', backgroundColor: 'transparent', color: 'var(--text-current)', padding: '0.55rem 1.25rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditWofSubmit}
                disabled={editWofSubmitting || loadingEditModalData}
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
                  opacity: (editWofSubmitting || loadingEditModalData) ? 0.7 : 1
                }}
              >
                {editWofSubmitting ? <Loader size={14} className="spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stop Process Modal */}
      {stopStep && stopWof && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1.5rem',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)',
            width: '100%',
            maxWidth: stopStep === 'splits_table' ? '1150px' : stopStep === 'yarn_returns' ? '800px' : '680px',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '85vh',
            border: '1px solid rgba(128, 0, 0, 0.08)',
            overflow: 'hidden',
            transition: 'max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.75rem 2.25rem',
              borderBottom: '1px solid #f3f4f6',
              background: 'linear-gradient(135deg, #800000, #4d0000)',
              color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em' }}>Stop Warping Process</h3>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.825rem', opacity: 0.85, fontWeight: '500' }}>
                  WOF: <strong style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{stopWof.wof_number}</strong>
                </p>
              </div>
              <button 
                onClick={() => setStopStep(null)} 
                style={{ 
                  background: 'rgba(255,255,255,0.12)', 
                  border: 'none', 
                  borderRadius: '50%', 
                  width: '36px', 
                  height: '36px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer', 
                  color: '#fff', 
                  fontSize: '1.25rem', 
                  transition: 'all 0.2s' 
                }} 
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.22)'} 
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem 2.25rem', backgroundColor: '#fcfcfc', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {stopStep === 'confirm_type' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', letterSpacing: '-0.02em' }}>
                      Choose Stop Mode
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
                      Would you like to temporarily pause the warping run or permanently stop the process?
                    </p>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '0.5rem' }}>
                    {/* Option 1: Temporary Pause */}
                    <div style={{
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '18px',
                      padding: '2.25rem 1.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '1.25rem',
                      backgroundColor: '#fff',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
                    }}
                    onMouseEnter={e => { 
                      e.currentTarget.style.transform = 'translateY(-5px)'; 
                      e.currentTarget.style.borderColor = '#800000'; 
                      e.currentTarget.style.boxShadow = '0 16px 28px -10px rgba(128, 0, 0, 0.12)'; 
                    }}
                    onMouseLeave={e => { 
                      e.currentTarget.style.transform = 'translateY(0)'; 
                      e.currentTarget.style.borderColor = '#e5e7eb'; 
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.02)'; 
                    }}
                    onClick={handleTemporaryStop}
                    >
                      <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#fff5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#800000', boxShadow: '0 4px 10px rgba(128, 0, 0, 0.06)' }}>
                        <Clock size={24} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', fontSize: '1.05rem', color: '#111827' }}>Pause Process</h4>
                        <p style={{ margin: 0, fontSize: '0.825rem', color: '#6b7280', lineHeight: '1.5' }}>
                          Temporarily pause the run. You can resume this same process later without losing any configuration.
                        </p>
                      </div>
                      <button style={{
                        width: '100%',
                        padding: '0.65rem 1rem',
                        border: '1.5px solid #800000',
                        borderRadius: '10px',
                        backgroundColor: '#fff',
                        color: '#800000',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = '#800000';
                        e.currentTarget.style.color = '#fff';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = '#fff';
                        e.currentTarget.style.color = '#800000';
                      }}
                      >
                        Pause Process
                      </button>
                    </div>

                    {/* Option 2: Permanent Stop */}
                    <div style={{
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '18px',
                      padding: '2.25rem 1.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '1.25rem',
                      backgroundColor: '#fff',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
                    }}
                    onMouseEnter={e => { 
                      e.currentTarget.style.transform = 'translateY(-5px)'; 
                      e.currentTarget.style.borderColor = '#800000'; 
                      e.currentTarget.style.boxShadow = '0 16px 28px -10px rgba(128, 0, 0, 0.12)'; 
                    }}
                    onMouseLeave={e => { 
                      e.currentTarget.style.transform = 'translateY(0)'; 
                      e.currentTarget.style.borderColor = '#e5e7eb'; 
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.02)'; 
                    }}
                    onClick={() => {
                      setStopIsPermanent(true);
                      if (!stopWof.forwarded_to) {
                        setStopHasSplits(false);
                        const updatedReturns = yarnReturns.map(r => ({
                          ...r,
                          quantity_returned: r.quantity_received.toString()
                        }));
                        setYarnReturns(updatedReturns);
                        setStopStep('yarn_returns');
                      } else {
                        setStopStep('ask_splits');
                      }
                    }}
                    >
                      <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48', boxShadow: '0 4px 10px rgba(225, 29, 72, 0.06)' }}>
                        <StopCircle size={24} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', fontSize: '1.05rem', color: '#e11d48' }}>Stop Permanently</h4>
                        <p style={{ margin: 0, fontSize: '0.825rem', color: '#6b7280', lineHeight: '1.5' }}>
                          Stop the process completely. Generates WOFDC delivery receipt and returns dyed yarn. Cannot be resumed.
                        </p>
                      </div>
                      <button style={{
                        width: '100%',
                        padding: '0.65rem 1rem',
                        border: 'none',
                        borderRadius: '10px',
                        backgroundColor: '#800000',
                        color: '#fff',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(128, 0, 0, 0.15)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#600000'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#800000'}
                      >
                        Stop Permanently
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {stopStep === 'ask_splits' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', letterSpacing: '-0.02em' }}>
                      Are there any splits?
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
                      Choose whether you want to record completed quantities for the forwarded warp split configurations.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '0.5rem' }}>
                    {/* Option 1: No Splits */}
                    <div style={{
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '18px',
                      padding: '2.25rem 1.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '1.25rem',
                      backgroundColor: '#fff',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
                    }}
                    onMouseEnter={e => { 
                      e.currentTarget.style.transform = 'translateY(-5px)'; 
                      e.currentTarget.style.borderColor = '#800000'; 
                      e.currentTarget.style.boxShadow = '0 16px 28px -10px rgba(128, 0, 0, 0.12)'; 
                    }}
                    onMouseLeave={e => { 
                      e.currentTarget.style.transform = 'translateY(0)'; 
                      e.currentTarget.style.borderColor = '#e5e7eb'; 
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.02)'; 
                    }}
                    onClick={() => {
                      setStopHasSplits(false);
                      const updatedReturns = yarnReturns.map(r => ({
                        ...r,
                        quantity_returned: r.quantity_received.toString()
                      }));
                      setYarnReturns(updatedReturns);
                      setStopStep('yarn_returns');
                    }}
                    >
                      <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', boxShadow: '0 4px 10px rgba(75, 85, 99, 0.06)' }}>
                        <X size={24} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', fontSize: '1.05rem', color: '#111827' }}>No splits</h4>
                        <p style={{ margin: 0, fontSize: '0.825rem', color: '#6b7280', lineHeight: '1.5' }}>
                          Clear all split configurations from the database and return the total received warp dyed yarn.
                        </p>
                      </div>
                      <button style={{
                        width: '100%',
                        padding: '0.65rem 1rem',
                        border: '1.5px solid #800000',
                        borderRadius: '10px',
                        backgroundColor: '#fff',
                        color: '#800000',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = '#800000';
                        e.currentTarget.style.color = '#fff';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = '#fff';
                        e.currentTarget.style.color = '#800000';
                      }}
                      >
                        No splits, delete configs
                      </button>
                    </div>

                    {/* Option 2: Yes splits */}
                    <div style={{
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '18px',
                      padding: '2.25rem 1.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '1.25rem',
                      backgroundColor: '#fff',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
                    }}
                    onMouseEnter={e => { 
                      e.currentTarget.style.transform = 'translateY(-5px)'; 
                      e.currentTarget.style.borderColor = '#800000'; 
                      e.currentTarget.style.boxShadow = '0 16px 28px -10px rgba(128, 0, 0, 0.12)'; 
                    }}
                    onMouseLeave={e => { 
                      e.currentTarget.style.transform = 'translateY(0)'; 
                      e.currentTarget.style.borderColor = '#e5e7eb'; 
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.02)'; 
                    }}
                    onClick={async () => {
                      setStopHasSplits(true);
                      await loadStopSplits();
                      setStopStep('splits_table');
                    }}
                    >
                      <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#fff5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#800000', boxShadow: '0 4px 10px rgba(128, 0, 0, 0.06)' }}>
                        <Layers size={24} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', fontSize: '1.05rem', color: '#800000' }}>Yes, splits exist</h4>
                        <p style={{ margin: 0, fontSize: '0.825rem', color: '#6b7280', lineHeight: '1.5' }}>
                          Record completed quantities for each configuration. Entering 0 will delete that split midway.
                        </p>
                      </div>
                      <button style={{
                        width: '100%',
                        padding: '0.65rem 1rem',
                        border: 'none',
                        borderRadius: '10px',
                        backgroundColor: '#800000',
                        color: '#fff',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(128, 0, 0, 0.15)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#600000'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#800000'}
                      >
                        Yes, record splits
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {stopStep === 'splits_table' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#800000', letterSpacing: '-0.01em' }}>
                      Warp Split Configurations Completed Quantities
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: '600' }}>* Required</span>
                  </div>
                  
                  {loadingStopSplits ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: '#6b7280', gap: '0.75rem', fontSize: '0.9rem', fontWeight: '500' }}>
                      <Loader size={20} className="spin" color="#800000" /> Loading splits configurations...
                    </div>
                  ) : stopSplits.length === 0 ? (
                    <div style={{ padding: '3rem 2rem', textAlign: 'center', fontSize: '0.9rem', color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: '16px', backgroundColor: '#fff' }}>
                      No splits found in the database.
                    </div>
                  ) : (
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)' }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#fff5f5', borderBottom: '2px solid #fee2e2', textAlign: 'left' }}>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Config Number</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>SOF/WVOF Number</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Scope</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Partner Name</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Machine</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Beam Number</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000', width: '150px' }}>Completed Qty (m)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stopSplits.map((split, index) => {
                            const isSizing = (stopWof?.forwarded_to) === 'sizing';
                            const configNo = split.warp_no || '';
                            const targetNo = split.sof_number || split.weaving_number || '';
                            const typeLabel = isSizing ? 'SOF' : 'WVOF';
                            const scopeLabel = isSizing ? split.sizing_type : split.weaving_type;
                            const partner = split.partner_name || '—';
                            const machine = split.machine_name || '—';
                            const beam = split.beam_name || split.beam_number || '—';
                            return (
                              <tr key={index} style={{ borderBottom: index < stopSplits.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background-color 0.15s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff9f9'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <td style={{ padding: '1rem 1.25rem', fontWeight: '700', fontFamily: 'monospace', color: '#111827' }}>{configNo}</td>
                                <td style={{ padding: '1rem 1.25rem' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ backgroundColor: isSizing ? '#e0f2fe' : '#dcfce7', color: isSizing ? '#0369a1' : '#15803d', padding: '4px 10px', borderRadius: '8px', fontSize: '0.725rem', fontWeight: '800' }}>
                                      {typeLabel}
                                    </span>
                                    {targetNo && (
                                      <span style={{ fontWeight: '600', fontFamily: 'monospace', color: '#4b5563' }}>
                                        {targetNo}
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td style={{ padding: '1rem 1.25rem', textTransform: 'capitalize', fontWeight: '600', color: '#374151' }}>{scopeLabel ? scopeLabel.replace('_', ' ') : '—'}</td>
                                <td style={{ padding: '1rem 1.25rem', color: '#4b5563', fontWeight: '500' }}>{partner}</td>
                                <td style={{ padding: '1rem 1.25rem', color: '#4b5563', fontWeight: '500' }}>{machine}</td>
                                <td style={{ padding: '1rem 1.25rem', color: '#4b5563', fontWeight: '500' }}>{beam}</td>
                                <td style={{ padding: '0.75rem 1.25rem' }}>
                                  <input
                                    type="number"
                                    value={split.completedQty}
                                    onChange={e => {
                                      const updated = [...stopSplits];
                                      updated[index].completedQty = e.target.value;
                                      setStopSplits(updated);
                                    }}
                                    style={{ 
                                      padding: '0.55rem 0.8rem', 
                                      borderRadius: '10px', 
                                      border: '1.5px solid #e5e7eb', 
                                      fontSize: '0.85rem', 
                                      width: '100%', 
                                      boxSizing: 'border-box', 
                                      outline: 'none', 
                                      transition: 'all 0.2s', 
                                      fontWeight: '600',
                                      color: '#111827'
                                    }}
                                    onFocus={e => {
                                      e.target.style.borderColor = '#800000';
                                      e.target.style.boxShadow = '0 0 0 4px rgba(128, 0, 0, 0.12)';
                                    }}
                                    onBlur={e => {
                                      e.target.style.borderColor = '#e5e7eb';
                                      e.target.style.boxShadow = 'none';
                                    }}
                                    placeholder="0"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  )}
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.8rem', color: '#991b1b', backgroundColor: '#fff5f5', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #fee2e2', lineHeight: '1.4' }}>
                    <AlertCircle size={16} color="#b91c1c" style={{ flexShrink: 0 }} />
                    <span><strong>Note:</strong> Entering 0 for any splits quantity is allowed. That configuration will be deleted (i.e. stopped midway).</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '1.5rem', borderTop: '1px solid #f3f4f6' }}>
                    <button
                      onClick={() => setStopStep('ask_splits')}
                      style={{
                        padding: '0.7rem 1.5rem',
                        border: '1.5px solid #d1d5db',
                        borderRadius: '10px',
                        backgroundColor: '#fff',
                        color: '#4b5563',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        for (const s of stopSplits) {
                          const q = parseFloat(s.completedQty || 0);
                          if (isNaN(q) || q < 0) {
                            alert('Please enter valid completed quantities (0 or more).');
                            return;
                          }
                        }
                        setStopStep('yarn_returns');
                      }}
                      style={{
                        padding: '0.7rem 1.75rem',
                        border: 'none',
                        borderRadius: '10px',
                        backgroundColor: '#800000',
                        color: '#fff',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(128, 0, 0, 0.15)'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#600000'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#800000'}
                    >
                      Next: Yarn Returns
                    </button>
                  </div>
                </div>
              )}

              {stopStep === 'yarn_returns' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#800000', letterSpacing: '-0.01em' }}>
                      Warp Dyed Yarn Return Details
                    </h4>
                  </div>
                  
                  {yarnReturns.length === 0 ? (
                    <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem', border: '2px dashed #e5e7eb', borderRadius: '16px', backgroundColor: '#fff' }}>
                      No dyed yarn received for this process yet.
                    </div>
                  ) : (
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)' }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#fff5f5', borderBottom: '2px solid #fee2e2', textAlign: 'left' }}>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Colour</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Count</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000' }}>Lot Number</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000', textAlign: 'right' }}>Received (kg)</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000', width: '160px' }}>Return Qty (kg)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yarnReturns.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: idx < yarnReturns.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background-color 0.15s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff9f9'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                              <td style={{ padding: '1rem 1.25rem', fontWeight: '750', color: '#111827' }}>{item.colour}</td>
                              <td style={{ padding: '1rem 1.25rem', color: '#4b5563', fontWeight: '600' }}>{item.count_display}</td>
                              <td style={{ padding: '1rem 1.25rem', fontFamily: 'monospace', color: '#6b7280', fontWeight: '500' }}>{item.lot_number}</td>
                              <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: '750', color: '#111827' }}>{Number(item.quantity_received).toFixed(2)}</td>
                              <td style={{ padding: '0.75rem 1.25rem' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.quantity_returned}
                                  onChange={e => {
                                    const updated = [...yarnReturns];
                                    updated[idx].quantity_returned = e.target.value;
                                    setYarnReturns(updated);
                                  }}
                                  style={{ 
                                    padding: '0.55rem 0.8rem', 
                                    borderRadius: '10px', 
                                    border: '1.5px solid #e5e7eb', 
                                    fontSize: '0.85rem', 
                                    width: '100%', 
                                    boxSizing: 'border-box', 
                                    outline: 'none', 
                                    transition: 'all 0.2s', 
                                    fontWeight: '600',
                                    color: '#111827'
                                  }}
                                  onFocus={e => {
                                    e.target.style.borderColor = '#800000';
                                    e.target.style.boxShadow = '0 0 0 4px rgba(128, 0, 0, 0.12)';
                                  }}
                                  onBlur={e => {
                                    e.target.style.borderColor = '#e5e7eb';
                                    e.target.style.boxShadow = 'none';
                                  }}
                                  placeholder="0.00"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '1.5rem', borderTop: '1px solid #f3f4f6' }}>
                    <button
                      onClick={() => {
                        if (!stopWof.forwarded_to) {
                          setStopStep('confirm_type');
                        } else {
                          setStopStep(stopHasSplits ? 'splits_table' : 'ask_splits');
                        }
                      }}
                      style={{
                        padding: '0.7rem 1.5rem',
                        border: '1.5px solid #d1d5db',
                        borderRadius: '10px',
                        backgroundColor: '#fff',
                        color: '#4b5563',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                    >
                      Back
                    </button>
                    <button
                      onClick={handlePermanentStop}
                      disabled={updating === stopWof.id}
                      style={{
                        padding: '0.7rem 1.75rem',
                        border: 'none',
                        borderRadius: '10px',
                        backgroundColor: '#800000',
                        color: '#fff',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(128, 0, 0, 0.15)',
                        opacity: updating === stopWof.id ? 0.75 : 1
                      }}
                      onMouseEnter={e => { if (updating !== stopWof.id) e.currentTarget.style.backgroundColor = '#600000'; }}
                      onMouseLeave={e => { if (updating !== stopWof.id) e.currentTarget.style.backgroundColor = '#800000'; }}
                    >
                      {updating === stopWof.id ? <Loader size={14} className="spin" /> : <StopCircle size={14} />}
                      Confirm & Stop Permanently
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusUpdater({ wof, onUpdate, loading }) {
  const [open, setOpen] = useState(false);
  const nextStatuses = {
    created: ['on_process', 'stopped'],
    on_process: ['completed', 'stopped'],
    completed: [],
    stopped: ['on_process'],
  };

  const options = nextStatuses[wof.status] || [];

  if (options.length === 0) return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>—</span>;

  return (
    <div style={{ position: 'relative' }}>
      {loading ? (
        <Loader size={14} className="spin" />
      ) : (
        <button
          onClick={() => setOpen(!open)}
          style={{ border: '1px solid var(--border-current)', background: 'var(--surface-current)', borderRadius: '6px', padding: '0.3rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted-current)' }}
        >
          Update <ChevronDown size={12} />
        </button>
      )}
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, background: 'var(--surface-current)', border: '1px solid var(--border-current)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '140px', overflow: 'hidden' }}>
          {options.map(s => (
            <button
              key={s}
              onClick={() => { onUpdate(wof.id, s); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-current)', textTransform: 'capitalize' }}
            >
              → {s.replace('_', ' ')}
            </button>
          ))}
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
