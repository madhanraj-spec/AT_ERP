import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, Loader, Layers,
  Building2, Handshake, ChevronDown, Printer,
  Calendar, Package, AlertCircle, CheckCircle2, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PrintableWOF from './PrintableWOF';

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
    const actualEndStr = wof.process_completed_at
      ? getLocalDateString(wof.process_completed_at)
      : (getLocalDateString(wof.updated_at) || todayStr);
    if (wof.end_date && actualEndStr > wof.end_date)
      return { label: 'Completed Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    return { label: 'Completed', bg: '#dcfce7', color: '#166534', border: '#86efac' };
  }
  if (wof.status === 'stopped')
    return { label: 'Stopped', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
  if (wof.status === 'on_process') {
    if (wof.end_date && todayStr > wof.end_date)
      return { label: 'Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    return { label: 'On Process', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' };
  }
  if (wof.status === 'created') {
    if (wof.end_date && todayStr > wof.end_date)
      return { label: 'Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    return { label: 'Created', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
  }
  return { label: wof.status, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
}

// ─── WOF Number Generator ────────────────────────────────────────────────────
async function generateWofNumber(wofType, partnerId, partnerName) {
  const year = new Date().getFullYear();

  if (wofType === 'in_house') {
    // Count all in-house WOFs this year
    const { count } = await supabase
      .from('warping_order_forms')
      .select('id', { count: 'exact', head: true })
      .eq('wof_type', 'in_house')
      .gte('created_at', `${year}-01-01`)
      .lt('created_at', `${year + 1}-01-01`);
    const seq = String((count || 0) + 1).padStart(5, '0');
    return `AT/${year}/WOF/${seq}`;
  } else {
    // Job Work: AT/{YYYY}/WOF/JB/{partner_SLUG}/{seq}
    const slug = (partnerName || 'PARTNER').replace(/\s+/g, '').toUpperCase();
    const prefix = `AT/${year}/WOF/JB/${slug}/`;
    const { count } = await supabase
      .from('warping_order_forms')
      .select('id', { count: 'exact', head: true })
      .eq('wof_type', 'job_work')
      .eq('partner_id', partnerId)
      .ilike('wof_number', `${prefix}%`);
    const seq = String((count || 0) + 1).padStart(5, '0');
    return `${prefix}${seq}`;
  }
}

// ─── Step Indicator ──────────────────────────────────────────────────────────
function StepBar({ current }) {
  const steps = ['Type', 'Order', 'Machine & Dates', 'Colour Allotment', 'Review & Create'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '2.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <React.Fragment key={idx}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                backgroundColor: done ? '#800000' : active ? '#800000' : 'var(--border-current)',
                color: done || active ? 'white' : 'var(--text-muted-current)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '800', fontSize: '0.8rem',
                border: active ? '3px solid #e8b4b4' : 'none',
                transition: 'all 0.2s'
              }}>
                {done ? <Check size={14} /> : idx}
              </div>
              <span style={{ fontSize: '0.68rem', marginTop: '0.3rem', fontWeight: active ? '700' : '500', color: active ? '#800000' : done ? 'var(--text-muted-current)' : 'var(--text-muted-current)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: '2px', backgroundColor: done ? '#800000' : 'var(--border-current)', minWidth: '24px', marginTop: '-18px', transition: 'all 0.2s' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}



// ─── Main Component ──────────────────────────────────────────────────────────
export default function CreateWarpingOrderForm() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Step state
  const [step, setStep] = useState(1);
  const [wofType, setWofType] = useState(null); // 'in_house' | 'job_work'

  // Data
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [existingWofs, setExistingWofs] = useState([]);
  const [machines, setMachines] = useState([]);
  const [partners, setPartners] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [dydi, setDydi] = useState([]);
  const [dyri, setDyri] = useState([]);

  // Form fields
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [wofQty, setWofQty] = useState('');
  const [allotments, setAllotments] = useState([]); // [{countId, countValue, colour, required_qty, received_qty, used_qty, allotted_qty}]

  // UI
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdWof, setCreatedWof] = useState(null); // after creation
  
  // Custom dropdown state
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [isOrderDropdownOpen, setIsOrderDropdownOpen] = useState(false);
  const orderDropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (orderDropdownRef.current && !orderDropdownRef.current.contains(event.target)) {
        setIsOrderDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Load initial data ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchOrders = async () => {
      setLoadingOrders(true);
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, design_no, design_name, total_quantity, technical_specs, yarn_requirements, status')
        .in('status', ['active', 'in_progress', 'approved'])
        .order('created_at', { ascending: false });
        
      if (data && data.length > 0) {
        // Fetch existing WOFs to calculate warped quantity per order
        const { data: wofData } = await supabase
          .from('warping_order_forms')
          .select('order_id, qty')
          .in('order_id', data.map(o => o.id));
          
        const wofQtyMap = {};
        if (wofData) {
          wofData.forEach(w => {
            wofQtyMap[w.order_id] = (wofQtyMap[w.order_id] || 0) + parseFloat(w.qty || 0);
          });
        }
        
        const ordersWithWarpedQty = data.map(o => ({
          ...o,
          warped_qty: wofQtyMap[o.id] || 0
        }));
        setOrders(ordersWithWarpedQty);
      } else {
        setOrders([]);
      }
      setLoadingOrders(false);
    };
    const fetchYarnCounts = async () => {
      const { data } = await supabase.from('master_yarn_counts').select('*');
      setYarnCounts(data || []);
    };
    fetchOrders();
    fetchYarnCounts();
  }, []);

  // ── When order selected: load existing WOFs, deliveries and receipts ────────
  useEffect(() => {
    if (!selectedOrder) {
      setExistingWofs([]);
      setDydi([]);
      setDyri([]);
      return;
    }
    const fetchData = async () => {
      // 1. Fetch existing WOFs
      const { data: wofsData } = await supabase
        .from('warping_order_forms')
        .select('*, machine:master_machines(machine_name), partner:master_partners(partner_name)')
        .eq('order_id', selectedOrder.id)
        .order('created_at', { ascending: true });
      setExistingWofs(wofsData || []);

      // 2. Fetch dyed yarn delivery items
      const { data: deliveryData } = await supabase
        .from('dyed_yarn_delivery_items')
        .select('id, production_form_id, yarn_count_id, quantity_kg, colour, lot_number, process_type')
        .eq('order_id', selectedOrder.id);
      setDydi(deliveryData || []);

      // 3. Fetch dyed yarn receipt items (with receipt source_type for excess filter)
      const { data: receiptData } = await supabase
        .from('dyed_yarn_receipt_items')
        .select('id, yarn_count_id, quantity_kg, colour, is_excess, receipt:dyed_yarn_receipts(source_type)')
        .eq('order_id', selectedOrder.id);
      setDyri(receiptData || []);
    };
    fetchData();
  }, [selectedOrder]);

  // ── Build allotment rows from order yarn_requirements (warp only) ──────────
  useEffect(() => {
    if (!selectedOrder) { setAllotments([]); return; }
    const warpYarns = (selectedOrder.yarn_requirements || []).filter(y => y.type === 'warp');
    const builtAllotments = warpYarns.map(y => {
      const countId = y.countId || y.count_id || '';
      const colour = y.color || y.colour || '';

      // Calculate received from dyeing (excluding excess/production return receipts)
      const receivedQty = dyri.reduce((sum, item) => {
        const itemCountId = item.yarn_count_id || '';
        if (itemCountId !== countId || item.colour !== colour) return sum;
        const isExcess = item.is_excess || item.receipt?.source_type === 'production';
        if (isExcess) return sum;
        return sum + parseFloat(item.quantity_kg || 0);
      }, 0);

      // Calculate total used (delivered - returned qty of each WOF)
      const completedWofIds = new Set();
      let totalUsed = 0;

      // Completed WOFs (using yarn_returns)
      existingWofs.forEach(w => {
        const returns = w.yarn_returns || [];
        if (returns.length > 0) {
          completedWofIds.add(w.id);
          const matchingReturns = returns.filter(r => {
            if (r.yarn_count_id && countId && r.yarn_count_id === countId) {
              return r.colour === colour;
            }
            const yc = yarnCounts.find(ycItem => ycItem.id === countId);
            const ycDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}`.trim().toLowerCase() : '';
            const retDisplay = (r.count_display || '').trim().toLowerCase();
            if (ycDisplay && retDisplay && ycDisplay === retDisplay) {
              return r.colour === colour;
            }
            const reqCountVal = (y.countValue || '').trim().toLowerCase();
            if (reqCountVal && retDisplay.includes(reqCountVal)) {
              return r.colour === colour;
            }
            return false;
          });
          const delivered = matchingReturns.reduce((s, r) => s + parseFloat(r.quantity_received || 0), 0);
          const returned = matchingReturns.reduce((s, r) => s + parseFloat(r.quantity_returned || 0), 0);
          totalUsed += Math.max(0, delivered - returned);
        }
      });

      // In-progress WOFs (using delivery items)
      const wofIds = new Set(existingWofs.map(w => w.id));
      dydi.forEach(item => {
        if (
          item.process_type === 'warping' &&
          item.production_form_id &&
          wofIds.has(item.production_form_id) &&
          !completedWofIds.has(item.production_form_id)
        ) {
          if (item.yarn_count_id === countId && item.colour === colour) {
            totalUsed += parseFloat(item.quantity_kg || 0);
          }
        }
      });

      return {
        countId,
        countValue: y.countValue || '',
        colour,
        required_qty: parseFloat(y.kg || 0),
        received_qty: receivedQty,
        used_qty: totalUsed,
        allotted_qty: '',
      };
    });
    setAllotments(builtAllotments);
  }, [selectedOrder, existingWofs, yarnCounts, dydi, dyri]);

  // ── Load machines based on type / partner ─────────────────────────────────
  useEffect(() => {
    if (!wofType) return;
    if (wofType === 'in_house') {
      const fetch = async () => {
        setLoadingMachines(true);
        const { data: allMachines } = await supabase
          .from('master_machines')
          .select('*, department:master_departments(department_name)')
          .eq('scope', 'in_house');
        // Filter to only warping department machines
        const warpingMachines = (allMachines || []).filter(m =>
          m.department?.department_name?.toLowerCase().includes('warp')
        );
        setMachines(warpingMachines);
        setLoadingMachines(false);
      };
      fetch();
    } else {
      // Load warping partners
      const fetch = async () => {
        setLoadingPartners(true);
        const { data } = await supabase
          .from('master_partners')
          .select('*')
          .ilike('partner_type', '%warp%');
        setPartners(data || []);
        setLoadingPartners(false);
      };
      fetch();
    }
  }, [wofType]);

  // ── Load job-work machines when partner selected ─────────────────────────
  useEffect(() => {
    if (wofType !== 'job_work' || !selectedPartnerId) return;
    const fetch = async () => {
      setLoadingMachines(true);
      const { data } = await supabase
        .from('master_machines')
        .select('*')
        .eq('scope', 'job_work')
        .eq('partner_id', selectedPartnerId);
      setMachines(data || []);
      setLoadingMachines(false);
    };
    fetch();
  }, [selectedPartnerId, wofType]);

  // ── Validation per step ───────────────────────────────────────────────────
  const canProceed = () => {
    if (step === 1) return !!wofType;
    if (step === 2) return !!selectedOrder;
    if (step === 3) {
      if (wofType === 'job_work' && !selectedPartnerId) return false;
      return !!selectedMachineId && !!startDate && !!endDate && !!wofQty && Number(wofQty) > 0;
    }
    if (step === 4) {
      return allotments.every(a => {
        const v = parseFloat(a.allotted_qty || 0);
        const remaining = Math.max(0, (a.received_qty || 0) - (a.used_qty || 0));
        return v >= 0 && v <= remaining + 0.001;
      });
    }
    return true;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const selectedMachine = machines.find(m => m.id === selectedMachineId);
      const selectedPartner = partners.find(p => p.id === selectedPartnerId);

      const wofNumber = await generateWofNumber(
        wofType,
        selectedPartnerId,
        selectedPartner?.partner_name,
        selectedOrder?.order_number
      );

      const payload = {
        wof_number: wofNumber,
        order_id: selectedOrder.id,
        wof_type: wofType,
        machine_id: selectedMachineId || null,
        machine_name: selectedMachine?.machine_name || null,
        partner_id: selectedPartnerId || null,
        partner_name: selectedPartner?.partner_name || null,
        start_date: startDate,
        end_date: endDate,
        qty: parseFloat(wofQty),
        colour_allotments: allotments.map(a => ({
          countId: a.countId,
          countValue: a.countValue,
          colour: a.colour,
          required_qty: a.required_qty,
          allotted_qty: parseFloat(a.allotted_qty || 0),
        })),
        status: 'created',
        created_by: profile?.id || null,
      };

      const { data, error: insertErr } = await supabase
        .from('warping_order_forms')
        .insert(payload)
        .select()
        .single();

      if (insertErr) throw insertErr;
      setCreatedWof(data);
      setStep(6); // success/print step
    } catch (err) {
      setError(err.message || 'Failed to create warping order form.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // ── Success / Print Screen ────────────────────────────────────────────────
  if (step === 6 && createdWof) {
    const selectedMachine = machines.find(m => m.id === createdWof.machine_id);
    const selectedPartner = partners.find(p => p.id === createdWof.partner_id);
    return (
      <div style={{ maxWidth: '100%', padding: '1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <CheckCircle2 size={36} color="#16a34a" />
          </div>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-current)' }}>Warping Order Form Created!</h1>
          <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.9rem' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: '800', color: '#800000' }}>{createdWof.wof_number}</span> has been created successfully.
          </p>
        </div>

        <PrintableWOF
          wof={createdWof}
          order={selectedOrder}
          machineName={selectedMachine?.machine_name || createdWof.machine_name}
          partnerName={selectedPartner?.partner_name || createdWof.partner_name}
          yarnCounts={yarnCounts}
        />

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/production/warping-forms')}
            style={{ border: '1px solid var(--border-current)', background: 'var(--surface-current)', color: 'var(--text-current)', borderRadius: '8px', padding: '0.65rem 1.5rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.875rem' }}
          >
            View All WOFs
          </button>
          <button
            onClick={() => { setStep(1); setWofType(null); setSelectedOrder(null); setSelectedMachineId(''); setSelectedPartnerId(''); setStartDate(''); setEndDate(''); setWofQty(''); setCreatedWof(null); }}
            style={{ background: '#800000', color: 'white', border: 'none', borderRadius: '8px', padding: '0.65rem 1.5rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.875rem' }}
          >
            Create Another WOF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '100%', padding: '1rem' }}>
      {/* Back */}
      <button
        onClick={() => navigate('/production/warping-forms')}
        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', padding: 0, marginBottom: '1.5rem' }}
      >
        <ArrowLeft size={15} /> Back to Warping Order Forms
      </button>

      <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-current)' }}>Create Warping Order Form</h1>
      <p style={{ margin: '0 0 2rem', color: 'var(--text-muted-current)', fontSize: '0.85rem' }}>Follow the steps below to create a new warping order form.</p>

      <StepBar current={step} total={5} />

      {/* Error alert */}
      {error && (
        <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#b91c1c', fontSize: '0.875rem' }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}><X size={14} /></button>
        </div>
      )}

      {/* Card */}
      <div style={{ backgroundColor: 'var(--surface-current)', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '2rem' }}>

        {/* ── STEP 1: Type Selection ─────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '800' }}>Select Warping Type</h2>
            <p style={{ margin: '0 0 2rem', color: 'var(--text-muted-current)', fontSize: '0.85rem' }}>Choose whether this is in-house warping or job work at an external partner.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {[
                { val: 'in_house', label: 'In-House', sub: 'Warping done using your own machines at your facility', icon: Building2, color: '#800000', bg: 'rgba(128,0,0,0.08)' },
                { val: 'job_work', label: 'Job Work', sub: 'Warping outsourced to an external warping partner', icon: Handshake, color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)' },
              ].map(opt => {
                const Icon = opt.icon;
                const selected = wofType === opt.val;
                return (
                  <div
                    key={opt.val}
                    onClick={() => setWofType(opt.val)}
                    style={{
                      border: `2px solid ${selected ? opt.color : 'var(--border-current)'}`,
                      borderRadius: '14px', padding: '1.75rem',
                      cursor: 'pointer',
                      backgroundColor: selected ? opt.bg : 'transparent',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    {selected && (
                      <div style={{ position: 'absolute', top: '1rem', right: '1rem', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: opt.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={13} color="white" />
                      </div>
                    )}
                    <div style={{ width: '48px', height: '48px', borderRadius: '10px', backgroundColor: opt.bg, border: `1.5px solid ${opt.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                      <Icon size={24} color={opt.color} />
                    </div>
                    <h3 style={{ margin: '0 0 0.4rem', fontWeight: '800', fontSize: '1rem', color: selected ? opt.color : 'var(--text-current)' }}>{opt.label}</h3>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted-current)', lineHeight: '1.5' }}>{opt.sub}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 2: Order Selection ───────────────────────────────── */}
        {step === 2 && (
          <div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '800' }}>Select Order</h2>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted-current)', fontSize: '0.85rem' }}>Choose the order for which you want to create a warping order form.</p>

            {loadingOrders ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted-current)' }}><Loader size={16} className="spin" /> Loading orders…</div>
            ) : (
              <div>
                {/* Searchable Dropdown */}
                <div style={{ position: 'relative' }} ref={orderDropdownRef}>
                  <div
                    onClick={() => setIsOrderDropdownOpen(!isOrderDropdownOpen)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: `2px solid ${isOrderDropdownOpen ? '#800000' : 'var(--border-current)'}`,
                      borderRadius: '10px',
                      fontSize: '0.875rem',
                      background: 'var(--surface-current)',
                      color: 'var(--text-current)',
                      cursor: 'pointer',
                      fontWeight: '700',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>
                      {selectedOrder
                        ? `${selectedOrder.order_number} | ${selectedOrder.design_no} - ${selectedOrder.design_name}`
                        : '— Select Order —'}
                    </span>
                    <ChevronDown size={18} style={{ transform: isOrderDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>

                  {isOrderDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '0.5rem',
                      backgroundColor: 'var(--surface-current)',
                      border: '1px solid var(--border-current)',
                      borderRadius: '10px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 10,
                      maxHeight: '300px',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>
                        <input
                          type="text"
                          placeholder="Type to search order..."
                          value={orderSearchTerm}
                          onChange={(e) => setOrderSearchTerm(e.target.value)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid var(--border-current)',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div style={{ overflowY: 'auto', flex: 1 }}>
                        {orders
                          .filter(ord => {
                            const searchLower = orderSearchTerm.toLowerCase();
                            return (
                              ord.order_number.toLowerCase().includes(searchLower) ||
                              ord.design_no?.toLowerCase().includes(searchLower) ||
                              ord.design_name?.toLowerCase().includes(searchLower)
                            );
                          })
                          .map(ord => {
                            const specs = ord.technical_specs || {};
                            const isSelected = selectedOrder?.id === ord.id;
                            return (
                              <div
                                key={ord.id}
                                onClick={() => {
                                  setSelectedOrder(ord);
                                  setIsOrderDropdownOpen(false);
                                  setOrderSearchTerm('');
                                }}
                                style={{
                                  padding: '0.75rem 1rem',
                                  cursor: 'pointer',
                                  backgroundColor: isSelected ? 'rgba(128,0,0,0.05)' : 'transparent',
                                  borderBottom: '1px solid var(--border-current)',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(128,0,0,0.03)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isSelected ? 'rgba(128,0,0,0.05)' : 'transparent'}
                              >
                                <div style={{ fontWeight: '800', color: isSelected ? '#800000' : 'var(--text-current)', marginBottom: '4px' }}>
                                  {ord.order_number} | {ord.design_no} - {ord.design_name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                  <span><strong style={{color: 'var(--text-current)'}}>Ord Qty:</strong> {Number(ord.total_quantity).toLocaleString()} Mtrs</span>
                                  <span><strong style={{color: 'var(--text-current)'}}>Prod Qty:</strong> {specs.production_quantity ? Number(specs.production_quantity).toLocaleString() : '—'} Mtrs</span>
                                  <span><strong style={{color: '#0ea5e9'}}>Warped Qty:</strong> {Number(ord.warped_qty || 0).toLocaleString()} Mtrs</span>
                                  <span><strong style={{color: 'var(--text-current)'}}>Const:</strong> {specs.order_reed || '—'}/{specs.order_pick || '—'}</span>
                                </div>
                              </div>
                            );
                          })}
                        {orders.length > 0 && orders.filter(ord => ord.order_number.toLowerCase().includes(orderSearchTerm.toLowerCase()) || ord.design_no?.toLowerCase().includes(orderSearchTerm.toLowerCase()) || ord.design_name?.toLowerCase().includes(orderSearchTerm.toLowerCase())).length === 0 && (
                          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted-current)', fontSize: '0.85rem' }}>
                            No orders match your search.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {selectedOrder && (
                  <div style={{
                    marginTop: '1.5rem',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    border: '1px solid #e8b4b4',
                    backgroundColor: 'rgba(128,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-current)', paddingBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Selected Order</div>
                        <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#800000', marginTop: '2px' }}>{selectedOrder.order_number}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Design</div>
                        <div style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-current)', marginTop: '2px' }}>{selectedOrder.design_no} / {selectedOrder.design_name}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', fontSize: '0.825rem' }}>
                      <div>
                        <span style={{ display: 'block', color: 'var(--text-muted-current)', fontSize: '0.65rem', fontWeight: '750' }}>ORDER QTY</span>
                        <strong style={{ color: 'var(--text-current)', fontSize: '0.85rem' }}>{Number(selectedOrder.total_quantity).toLocaleString()} Mtrs</strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: 'var(--text-muted-current)', fontSize: '0.65rem', fontWeight: '750' }}>PRODUCTION QTY</span>
                        <strong style={{ color: 'var(--text-current)', fontSize: '0.85rem' }}>
                          {selectedOrder.technical_specs?.production_quantity ? `${Number(selectedOrder.technical_specs.production_quantity).toLocaleString()} Mtrs` : '—'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: 'var(--text-muted-current)', fontSize: '0.65rem', fontWeight: '750' }}>WARPED QTY</span>
                        <strong style={{ color: '#0ea5e9', fontSize: '0.85rem' }}>
                          {Number(selectedOrder.warped_qty || 0).toLocaleString()} Mtrs
                        </strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: 'var(--text-muted-current)', fontSize: '0.65rem', fontWeight: '750' }}>CONSTRUCTION</span>
                        <strong style={{ color: 'var(--text-current)', fontSize: '0.85rem' }}>
                          {selectedOrder.technical_specs?.order_reed || '—'} / {selectedOrder.technical_specs?.order_pick || '—'}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Existing WOFs for selected order */}
            {selectedOrder && existingWofs.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>
                  Existing Warping Order Forms for {selectedOrder.order_number}
                </div>
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)' }}>
                        {['WOF No', 'Type', 'Machine', 'Qty (Mtrs)', 'Dates', 'Status'].map(h => (
                          <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {existingWofs.map(w => {
                        const badge = getWofStatusBadge(w);
                        return (
                          <tr key={w.id} style={{ borderBottom: '1px solid var(--border-current)' }}>
                            <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontWeight: '700', color: '#800000', fontSize: '0.75rem' }}>{w.wof_number}</td>
                            <td style={{ padding: '0.6rem 0.75rem', textTransform: 'capitalize' }}>{w.wof_type?.replace('_', ' ')}</td>
                            <td style={{ padding: '0.6rem 0.75rem' }}>
                              {w.wof_type === 'job_work'
                                ? `${w.partner?.partner_name || w.partner_name || '—'} / ${w.machine?.machine_name || w.machine_name || '—'}`
                                : (w.machine?.machine_name || w.machine_name || '—')}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>{Number(w.qty).toLocaleString()}</td>
                            <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.72rem' }}>{w.start_date} → {w.end_date}</td>
                            <td style={{ padding: '0.6rem 0.75rem' }}>
                              <span style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: '800' }}>{badge.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Machine & Dates ───────────────────────────────── */}
        {step === 3 && (
          <div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '800' }}>
              {wofType === 'job_work' ? 'Partner, Machine & Schedule' : 'Machine & Schedule'}
            </h2>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted-current)', fontSize: '0.85rem' }}>
              {wofType === 'job_work' ? 'Select the warping partner, then the machine at that partner\'s facility.' : 'Select the in-house warping machine and set the schedule.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Partner select (job work only) */}
              {wofType === 'job_work' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem', color: 'var(--text-current)' }}>Warping Partner <span style={{ color: '#ef4444' }}>*</span></label>
                  {loadingPartners ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted-current)', fontSize: '0.85rem' }}><Loader size={14} className="spin" /> Loading partners…</div>
                  ) : (
                    <select
                      value={selectedPartnerId}
                      onChange={e => { setSelectedPartnerId(e.target.value); setSelectedMachineId(''); }}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.875rem', background: 'var(--surface-current)', color: 'var(--text-current)', cursor: 'pointer' }}
                    >
                      <option value="">— Select Warping Partner —</option>
                      {partners.map(p => <option key={p.id} value={p.id}>{p.partner_name}</option>)}
                    </select>
                  )}
                  {partners.length === 0 && !loadingPartners && (
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: '#e55' }}>No warping partners found. Add one in Masters → Partners.</p>
                  )}
                </div>
              )}

              {/* Machine select */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem', color: 'var(--text-current)' }}>
                  {wofType === 'in_house' ? 'In-House Warping Machine' : 'Machine at Partner'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {loadingMachines ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted-current)', fontSize: '0.85rem' }}><Loader size={14} className="spin" /> Loading machines…</div>
                ) : (
                  <select
                    value={selectedMachineId}
                    onChange={e => setSelectedMachineId(e.target.value)}
                    disabled={wofType === 'job_work' && !selectedPartnerId}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.875rem', background: 'var(--surface-current)', color: 'var(--text-current)', cursor: 'pointer', opacity: (wofType === 'job_work' && !selectedPartnerId) ? 0.5 : 1 }}
                  >
                    <option value="">— Select Machine —</option>
                    {machines.map(m => <option key={m.id} value={m.id}>{m.machine_name}{m.department?.department_name ? ` (${m.department.department_name})` : ''}</option>)}
                  </select>
                )}
                {!loadingMachines && machines.length === 0 && (wofType === 'in_house' || selectedPartnerId) && (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: '#e55' }}>No machines found. Add in Masters → Machines.</p>
                )}
              </div>

              {/* Date fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem', color: 'var(--text-current)' }}>Start Date <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.875rem', background: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem', color: 'var(--text-current)' }}>End Date <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.875rem', background: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* WOF Qty */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem', color: 'var(--text-current)' }}>Warping Order Form Qty (Meters) <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="number" min="0" step="0.01"
                  placeholder="Enter warping quantity in meters"
                  value={wofQty} onChange={e => setWofQty(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.875rem', background: 'var(--surface-current)', color: 'var(--text-current)', boxSizing: 'border-box' }}
                />
                {selectedOrder && (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>
                    Order total qty: <strong>{Number(selectedOrder.total_quantity).toLocaleString()} Mtrs</strong>
                    {selectedOrder.technical_specs?.production_quantity ? ` | Production qty: ${Number(selectedOrder.technical_specs.production_quantity).toLocaleString()} Mtrs` : ''}
                    {' | Total Qty Allotted for Warping: '}
                    <strong>
                      {existingWofs.reduce((sum, w) => sum + parseFloat(w.qty || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mtrs
                    </strong>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: Colour Allotment ──────────────────────────────── */}
        {step === 4 && (
          <div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '800' }}>Warp Colour & Count Allotment</h2>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted-current)', fontSize: '0.85rem' }}>
              Allot quantities for each warp colour and count for this warping order form. Allotted quantities cannot exceed remaining stock (received from dyeing minus used).
            </p>

            {allotments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)', backgroundColor: '#fdf8f8', borderRadius: '8px', border: '1px dashed #e8b4b4' }}>
                <Package size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                <p style={{ margin: 0 }}>No warp yarn requirements found for this order. Please check the order's yarn requirements.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '2px solid var(--border-current)' }}>
                      {['#', 'Colour', 'Yarn Count', 'Required Qty (kg)', 'Received (kg)', 'Used (kg)', 'Remaining (kg)', 'Allot for This WOF (kg)'].map(h => (
                        <th key={h} style={{ padding: '0.75rem 0.85rem', textAlign: 'left', fontWeight: '800', fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allotments.map((row, idx) => {
                      const yc = yarnCounts.find(y => y.id === row.countId);
                      const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (row.countValue || row.countId || '—');
                      const remaining = Math.max(0, (row.received_qty || 0) - (row.used_qty || 0));
                      const val = parseFloat(row.allotted_qty || 0);
                      const isOver = val > remaining + 0.001;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                          <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted-current)', fontWeight: '700' }}>{idx + 1}</td>
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <span style={{ backgroundColor: '#f0f9ff', color: '#0369a1', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>{row.colour || '—'}</span>
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.8rem', fontWeight: '600' }}>{countDisplay}</td>
                          <td style={{ padding: '0.75rem 0.85rem', fontWeight: '700', textAlign: 'right' }}>{Number(row.required_qty).toFixed(2)}</td>
                          <td style={{ padding: '0.75rem 0.85rem', fontWeight: '700', textAlign: 'right', color: '#0ea5e9' }}>{Number(row.received_qty || 0).toFixed(2)}</td>
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', color: row.used_qty > 0 ? '#d97706' : 'var(--text-muted-current)' }}>
                            {Number(row.used_qty || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', fontWeight: '700', textAlign: 'right', color: remaining === 0 ? '#16a34a' : '#0369a1' }}>
                            {remaining.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <input
                              type="number" min="0" max={remaining} step="0.01"
                              value={row.allotted_qty}
                              onChange={e => setAllotments(prev => prev.map((a, i) => i === idx ? { ...a, allotted_qty: e.target.value } : a))}
                              disabled={remaining === 0}
                              style={{
                                width: '110px', padding: '0.45rem 0.6rem',
                                border: `1.5px solid ${isOver ? '#ef4444' : 'var(--border-current)'}`,
                                borderRadius: '6px', fontSize: '0.85rem',
                                background: isOver ? '#fef2f2' : 'var(--surface-current)',
                                color: 'var(--text-current)',
                                outline: 'none'
                              }}
                            />
                            {isOver && <div style={{ fontSize: '0.65rem', color: '#ef4444', marginTop: '2px', whiteSpace: 'nowrap' }}>Exceeds remaining!</div>}
                            {remaining === 0 && <div style={{ fontSize: '0.65rem', color: '#16a34a', marginTop: '2px' }}>Fully allotted</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#fdf8f8', borderTop: '2px solid var(--border-current)' }}>
                      <td colSpan={3} style={{ padding: '0.75rem 0.85rem', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase' }}>Totals</td>
                      <td style={{ padding: '0.75rem 0.85rem', fontWeight: '800', textAlign: 'right' }}>
                        {allotments.reduce((s, a) => s + Number(a.required_qty || 0), 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', fontWeight: '800', textAlign: 'right', color: '#0ea5e9' }}>
                        {allotments.reduce((s, a) => s + Number(a.received_qty || 0), 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', fontWeight: '800', textAlign: 'right', color: '#d97706' }}>
                        {allotments.reduce((s, a) => s + Number(a.used_qty || 0), 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', fontWeight: '800', textAlign: 'right', color: '#0369a1' }}>
                        {allotments.reduce((s, a) => s + Math.max(0, (a.received_qty || 0) - (a.used_qty || 0)), 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', fontWeight: '800', color: '#800000' }}>
                        {allotments.reduce((s, a) => s + Number(a.allotted_qty || 0), 0).toFixed(2)} kg
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 5: Review & Create ───────────────────────────────── */}
        {step === 5 && (
          <div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '800' }}>Review & Create</h2>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted-current)', fontSize: '0.85rem' }}>Please review all details before creating the warping order form.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Type', val: wofType === 'in_house' ? '🏭 In-House' : '🤝 Job Work' },
                { label: 'Order', val: selectedOrder?.order_number },
                { label: 'Design', val: `${selectedOrder?.design_no || '—'} / ${selectedOrder?.design_name || '—'}` },
                { label: 'Machine', val: machines.find(m => m.id === selectedMachineId)?.machine_name || '—' },
                ...(wofType === 'job_work' ? [{ label: 'Partner', val: partners.find(p => p.id === selectedPartnerId)?.partner_name || '—' }] : []),
                { label: 'Start Date', val: startDate },
                { label: 'End Date', val: endDate },
                { label: 'WOF Qty', val: `${Number(wofQty).toLocaleString()} Meters` },
              ].map(({ label, val }) => (
                <div key={label} style={{ backgroundColor: '#fdf8f8', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)', fontWeight: '700', marginBottom: '3px' }}>{label}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>{val || '—'}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>Colour Allotments</div>
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)' }}>
                    {['Colour', 'Count', 'Required (kg)', 'Allotted (kg)'].map(h => (
                      <th key={h} style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: '700', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allotments.map((a, idx) => {
                    const yc = yarnCounts.find(y => y.id === a.countId);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: '600' }}>{a.colour}</td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>{yc ? `${yc.count_value} ${yc.material}` : a.countValue || '—'}</td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: '700' }}>{Number(a.required_qty).toFixed(2)}</td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: '800', color: '#800000' }}>{Number(a.allotted_qty || 0).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle2 size={18} color="#16a34a" />
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#166534', fontWeight: '600' }}>
                Everything looks good. Click "Create WOF" to generate the warping order form and WOF number.
              </p>
            </div>
          </div>
        )}

        {/* ── Navigation Buttons ─────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-current)' }}>
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/production/warping-forms')}
            style={{ background: 'none', border: '1px solid var(--border-current)', borderRadius: '8px', padding: '0.65rem 1.25rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-muted-current)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <ArrowLeft size={15} /> {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 5 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              style={{ background: canProceed() ? 'linear-gradient(135deg,#800000,#4d0000)' : '#e5e7eb', color: canProceed() ? 'white' : '#9ca3af', border: 'none', borderRadius: '8px', padding: '0.65rem 1.5rem', cursor: canProceed() ? 'pointer' : 'not-allowed', fontWeight: '700', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
            >
              Next <ArrowRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ background: submitting ? '#e5e7eb' : 'linear-gradient(135deg,#16a34a,#15803d)', color: submitting ? '#9ca3af' : 'white', border: 'none', borderRadius: '8px', padding: '0.65rem 1.75rem', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
            >
              {submitting ? <><Loader size={15} className="spin" /> Creating…</> : <><Check size={15} /> Create WOF</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
