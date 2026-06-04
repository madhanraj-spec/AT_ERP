import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const STEPS = ['Select Orders', 'Dyeing Unit & Dates', 'Colour & Yarn Qty', 'Summary & Submit'];

export default function CreateDyeingForm() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Master data
  const [myOrders, setMyOrders] = useState([]);
  const [dyeingUnits, setDyeingUnits] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);

  // Conflict map: key = "orderId|type|countId|colour" => { dofNumber, totalKg }
  const [allocatedColours, setAllocatedColours] = useState({});

  // Form state
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [dyeingUnitId, setDyeingUnitId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [selectedColours, setSelectedColours] = useState([]);
  const [allocations, setAllocations] = useState([]);

  const basePath = profile?.role === 'admin' ? '/admin' : '/merchandiser';
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchMasterData();
  }, []);

  // Rebuild allocations whenever colour selection changes
  useEffect(() => {
    if (selectedColours.length === 0) { setAllocations([]); return; }
    const newAllocations = selectedColours.map(sc => {
      const order = myOrders.find(o => o.id === sc.orderId);
      const yarnReq = (order?.yarn_requirements || []).find(
        yr => yr.type === sc.type && yr.countId === sc.countId && yr.color === sc.colour
      );
      const original_required_kg = parseFloat(yarnReq?.kg || 0);

      // Look up already allotted from the conflict map
      const key = `${sc.orderId}|${sc.type}|${sc.countId}|${sc.colour}`;
      const conflict = allocatedColours[key];
      const already_allotted = conflict ? conflict.already_allotted_base : 0;
      const remaining_kg = Math.max(0, original_required_kg - already_allotted);

      // Preserve user state if already existing in allocations list
      const existing = allocations.find(
        a => a.orderId === sc.orderId && a.countId === sc.countId && a.colour === sc.colour && a.type === sc.type
      );

      const base_kg = existing !== undefined ? existing.base_kg : remaining_kg;
      const excess_pct = existing?.excess_pct ?? 0;
      const parsedBase = parseFloat(base_kg) || 0;
      const total_kg = parsedBase + (parsedBase * excess_pct / 100);

      return {
        ...sc,
        original_required_kg,
        already_allotted,
        remaining_kg,
        base_kg,
        excess_pct,
        total_kg
      };
    });
    setAllocations(newAllocations);
  }, [selectedColours, allocatedColours, myOrders]);

  const fetchMasterData = async () => {
    setFetching(true);
    try {
      const [ordersRes, partnersRes, countsRes, dofsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, master_brands(brand_name)')
          .eq('merchandiser_id', profile.id)
          .in('status', ['active', 'draft'])
          .order('created_at', { ascending: false }),
        supabase.from('master_partners').select('*').eq('partner_type', 'Dyeing Unit'),
        supabase.from('master_yarn_counts').select('*'),
        // Fetch all existing DOFs (not rejected) to check for colour conflicts
        supabase
          .from('dyeing_order_forms')
          .select('dof_number, yarn_allocations')
          .neq('status', 'rejected'),
      ]);

      setMyOrders(ordersRes.data || []);
      setDyeingUnits(partnersRes.data || []);
      setYarnCounts(countsRes.data || []);

      // Build conflict map from existing DOFs by aggregating allocated base weights
      const conflictMap = {};
      (dofsRes.data || []).forEach(dof => {
        (dof.yarn_allocations || []).forEach(alloc => {
          const key = `${alloc.orderId}|${alloc.type}|${alloc.countId}|${alloc.colour}`;
          const allocBase = parseFloat(alloc.base_kg || 0);
          if (!conflictMap[key]) {
            conflictMap[key] = {
              dofNumbers: [dof.dof_number],
              already_allotted_base: allocBase,
              already_allotted_total: parseFloat(alloc.total_kg || 0)
            };
          } else {
            if (!conflictMap[key].dofNumbers.includes(dof.dof_number)) {
              conflictMap[key].dofNumbers.push(dof.dof_number);
            }
            conflictMap[key].already_allotted_base += allocBase;
            conflictMap[key].already_allotted_total += parseFloat(alloc.total_kg || 0);
          }
        });
      });
      setAllocatedColours(conflictMap);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  const formatYarn = (yarn) => {
    if (!yarn) return '';
    return `${yarn.count_value} - ${yarn.material} - ${yarn.product_type}`;
  };

  const getShortCounts = (specs) => {
    if (!specs) return '-';
    const warpIds = specs.warp_selections?.flat() || [];
    const weftIds = specs.weft_selections?.flat() || [];
    const w1 = warpIds.map(id => yarnCounts.find(y => y.id === id)?.count_value).filter(Boolean).join(' + ');
    const w2 = weftIds.map(id => yarnCounts.find(y => y.id === id)?.count_value).filter(Boolean).join(' + ');
    return `${w1 || '-'} X ${w2 || '-'}`;
  };

  const getConflict = (entry) => {
    const key = `${entry.orderId}|${entry.type}|${entry.countId}|${entry.colour}`;
    return allocatedColours[key] || null;
  };

  const toggleOrder = (id) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    if (selectedOrderIds.includes(id)) {
      setSelectedColours(prev => prev.filter(c => c.orderId !== id));
    }
  };

  const toggleColour = (entry) => {
    const key = c => `${c.orderId}-${c.type}-${c.countId}-${c.colour}`;
    const eKey = key(entry);
    const conflict = getConflict(entry);
    const alreadySelected = selectedColours.some(c => key(c) === eKey);

    if (!alreadySelected && conflict) {
      // Calculate remaining quantity
      const order = myOrders.find(o => o.id === entry.orderId);
      const yarnReq = (order?.yarn_requirements || []).find(
        yr => yr.type === entry.type && yr.countId === entry.countId && yr.color === entry.colour
      );
      const original_base = parseFloat(yarnReq?.kg || 0);
      const already_allotted = conflict.already_allotted_base;
      const remaining = Math.max(0, original_base - already_allotted);

      if (remaining <= 0) {
        // Show warning if user attempts to select a fully allotted colour
        const confirmed = window.confirm(
          `⚠️ This colour has already been FULLY allotted!\n\n` +
          `DOF(s): ${conflict.dofNumbers.join(', ')}\n` +
          `Qty Already Allotted: ${already_allotted.toFixed(2)} kg / ${original_base.toFixed(2)} kg\n\n` +
          `Do you still want to select it anyway? (Remaining amount is 0 kg)`
        );
        if (!confirmed) return;
      }
    }

    setSelectedColours(prev =>
      alreadySelected
        ? prev.filter(c => key(c) !== eKey)
        : [...prev, entry]
    );
  };

  const isColourSelected = (entry) => {
    return selectedColours.some(
      c => c.orderId === entry.orderId && c.type === entry.type &&
           c.countId === entry.countId && c.colour === entry.colour
    );
  };

  const updateBaseQty = (idx, val) => {
    setAllocations(prev => {
      const updated = [...prev];
      if (val === '') {
        updated[idx] = { ...updated[idx], base_kg: '', total_kg: 0 };
        return updated;
      }
      let base_kg = parseFloat(val);
      if (isNaN(base_kg)) base_kg = 0;
      if (base_kg < 0) base_kg = 0;

      const excess_pct = updated[idx].excess_pct;
      const total_kg = base_kg + (base_kg * excess_pct / 100);
      updated[idx] = { ...updated[idx], base_kg, total_kg };
      return updated;
    });
  };

  const updateExcess = (idx, val) => {
    setAllocations(prev => {
      const updated = [...prev];
      const base_kg = parseFloat(updated[idx].base_kg) || 0;
      const excess_pct = parseFloat(val) || 0;
      const total_kg = base_kg + (base_kg * excess_pct / 100);
      updated[idx] = { ...updated[idx], excess_pct, total_kg };
      return updated;
    });
  };

  const handleNext = () => {
    if (currentStep === 0 && selectedOrderIds.length === 0) {
      alert('Please select at least one order.'); return;
    }
    if (currentStep === 1 && !dyeingUnitId) {
      alert('Please select a Dyeing Unit.'); return;
    }
    if (currentStep === 2) {
      if (allocations.length === 0) {
        alert('Please select at least one color/yarn to allocate.'); return;
      }
      if (allocations.some(a => !a.base_kg || parseFloat(a.base_kg) <= 0)) {
        alert('Please enter a valid allotted base quantity greater than 0 for all selected items.'); return;
      }
    }
    setCurrentStep(s => s + 1);
  };

  const handleBack = () => setCurrentStep(s => s - 1);

  const buildSummary = () => {
    const map = {};
    allocations.forEach(a => {
      const yarn = yarnCounts.find(y => y.id === a.countId);
      const key = `${a.countId}||${a.colour}`;
      if (!map[key]) map[key] = { countId: a.countId, yarnLabel: formatYarn(yarn), colour: a.colour, total_kg: 0 };
      map[key].total_kg += parseFloat(a.total_kg || 0);
    });
    return Object.values(map);
  };

  const handleSubmit = async () => {
    if (allocations.some(a => !a.base_kg || parseFloat(a.base_kg) <= 0)) {
      alert('Please enter a valid base quantity greater than 0 for all selected items.');
      return;
    }
    setLoading(true);
    try {
      const { data: dofNumber, error: numErr } = await supabase.rpc('get_next_dof_number', { p_year: currentYear });
      if (numErr) throw numErr;

      const summary = buildSummary();
      // Prepare clean allocation payload matching JSONB schema
      const sanitizedAllocations = allocations.map(a => ({
        orderId: a.orderId,
        type: a.type,
        countId: a.countId,
        colour: a.colour,
        base_kg: parseFloat(a.base_kg) || 0,
        excess_pct: parseFloat(a.excess_pct) || 0,
        total_kg: parseFloat(a.total_kg) || 0
      }));

      const payload = {
        dof_number: dofNumber,
        created_by: profile.id,
        dyeing_unit_id: dyeingUnitId,
        expected_delivery_date: deliveryDate || null,
        order_ids: selectedOrderIds,
        yarn_allocations: sanitizedAllocations,
        summary,
        status: 'pending',
      };

      const { error } = await supabase.from('dyeing_order_forms').insert([payload]);
      if (error) throw error;

      alert(`Dyeing Order Form Created!\nDOF No: ${dofNumber}\nStatus: Pending Admin Approval.`);
      navigate(`${basePath}/dyeing-forms`);
    } catch (err) {
      console.error(err);
      alert('Error creating DOF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedOrders = myOrders.filter(o => selectedOrderIds.includes(o.id));

  const renderColourCard = (req, order, type) => {
    const yarn = yarnCounts.find(y => y.id === req.countId);
    const entry = { orderId: order.id, type, countId: req.countId, colour: req.color };
    const selected = isColourSelected(entry);
    const conflict = getConflict(entry);

    const original_base = parseFloat(req.kg || 0);
    const already_allotted = conflict ? conflict.already_allotted_base : 0;
    const remaining = Math.max(0, original_base - already_allotted);

    const isFullyAllocated = conflict && remaining <= 0;
    const isPartiallyAllocated = conflict && remaining > 0;

    return (
      <div
        key={`${type}-${req.countId}-${req.color}`}
        onClick={() => toggleColour(entry)}
        style={{
          padding: '0.6rem 0.75rem',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${selected ? 'var(--color-primary)' : isFullyAllocated ? '#f59e0b' : isPartiallyAllocated ? '#3b82f6' : 'var(--border-current)'}`,
          backgroundColor: selected
            ? 'rgba(var(--color-primary-rgb, 128,0,0), 0.05)'
            : isFullyAllocated ? '#fffbeb' : isPartiallyAllocated ? '#eff6ff' : 'transparent',
          cursor: 'pointer',
          marginBottom: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          {selected
            ? <CheckSquare size={16} color="var(--color-primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
            : <Square size={16} color={isFullyAllocated ? '#f59e0b' : isPartiallyAllocated ? '#3b82f6' : 'var(--text-muted-current)'} style={{ marginTop: '2px', flexShrink: 0 }} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>{req.color}</span>
              {remaining > 0 && remaining < original_base && (
                <span style={{ color: '#2563eb', fontSize: '0.75rem', fontWeight: 'bold' }}>{remaining.toFixed(2)} kg left</span>
              )}
              {isFullyAllocated && (
                <span style={{ color: '#d97706', fontSize: '0.75rem', fontWeight: 'bold' }}>Fully Allotted</span>
              )}
            </div>
            <div style={{ color: 'var(--text-muted-current)', fontSize: '0.75rem', marginTop: '2px' }}>
              {formatYarn(yarn)} — Total: {original_base.toFixed(2)} kg
            </div>
            {conflict && (
              <div style={{
                marginTop: '0.3rem',
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem',
                color: isFullyAllocated ? '#92400e' : '#1e3a8a', fontSize: '0.7rem', fontWeight: '600',
                backgroundColor: isFullyAllocated ? '#fef3c7' : '#dbeafe', padding: '2px 6px', borderRadius: '3px'
              }}>
                <AlertTriangle size={10} />
                <span>
                  Allotted: {already_allotted.toFixed(2)} kg in {conflict.dofNumbers.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (fetching) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <Loader size={32} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-muted-current)' }}>Loading orders and master data...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={() => currentStep === 0 ? navigate(`${basePath}/dyeing-forms`) : handleBack()}
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.8rem' }}
        >
          <ArrowLeft size={16} /> {currentStep === 0 ? 'Back to DOF List' : 'Previous'}
        </button>
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>New Dyeing Order Form</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{
              width: '2rem', height: '2rem', borderRadius: '50%',
              backgroundColor: i === currentStep ? 'var(--color-primary)' : i < currentStep ? '#16a34a' : 'var(--border-current)',
              color: i <= currentStep ? 'white' : 'var(--text-muted-current)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.3s'
            }} title={label}>{i + 1}</div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-muted-current)', margin: 0, fontSize: '0.875rem' }}>
          Step {currentStep + 1} of {STEPS.length}
        </p>
        <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem' }}>{STEPS[currentStep]}</h2>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>

        {/* ── STEP 0: Select Orders ── */}
        {currentStep === 0 && (
          <div className="fade-in">
            <p style={{ color: 'var(--text-muted-current)', marginBottom: '1rem' }}>
              Select one or more of your active orders to include in this Dyeing Order Form.
            </p>
            {myOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                No active orders found. Please create an order first.
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Order No.</th>
                      <th>Design No.</th>
                      <th>Design Name</th>
                      <th>Buyer</th>
                      <th>Count</th>
                      <th>Qty (Mtrs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myOrders.map(order => (
                      <tr
                        key={order.id}
                        onClick={() => toggleOrder(order.id)}
                        style={{ cursor: 'pointer', backgroundColor: selectedOrderIds.includes(order.id) ? 'rgba(128,0,0,0.05)' : '' }}
                      >
                        <td>
                          {selectedOrderIds.includes(order.id)
                            ? <CheckSquare size={18} color="var(--color-primary)" />
                            : <Square size={18} color="var(--text-muted-current)" />}
                        </td>
                        <td style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{order.order_number}</td>
                        <td>{order.design_no}</td>
                        <td>{order.design_name}</td>
                        <td>{order.master_brands?.brand_name}</td>
                        <td style={{ fontWeight: 'bold' }}>{getShortCounts(order.technical_specs)}</td>
                        <td>{order.total_quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
                {selectedOrderIds.length} order(s) selected
              </span>
              <button onClick={handleNext} className="btn btn-primary" disabled={selectedOrderIds.length === 0}>
                Next <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 1: Dyeing Unit & Dates ── */}
        {currentStep === 1 && (
          <div className="fade-in">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', maxWidth: '700px' }}>
              <div className="input-group">
                <label className="input-label">Dyeing Unit (from Masters)</label>
                <select className="input-field" value={dyeingUnitId} onChange={e => setDyeingUnitId(e.target.value)} required>
                  <option value="">Select Dyeing Unit...</option>
                  {dyeingUnits.map(d => (
                    <option key={d.id} value={d.id}>{d.partner_name}</option>
                  ))}
                </select>
                {dyeingUnits.length === 0 && (
                  <small style={{ color: '#f59e0b' }}>No Dyeing Units found. Add one under Masters → Partners.</small>
                )}
              </div>
              <div className="input-group">
                <label className="input-label">Expected Delivery Date</label>
                <input type="date" className="input-field" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-muted-current)' }}>Selected Orders</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {selectedOrders.map(o => (
                  <span key={o.id} style={{ backgroundColor: 'var(--surface-current)', border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.8rem', fontSize: '0.875rem', fontWeight: '600' }}>
                    {o.order_number} — {o.design_name}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={handleNext} className="btn btn-primary">
                Next <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Colour Selection & Yarn Quantity ── */}
        {currentStep === 2 && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', padding: '0.75rem 1rem', backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 'var(--radius-md)' }}>
              <AlertTriangle size={16} color="#d97706" />
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#92400e' }}>
                <strong>Amber cards</strong> indicate a colour already allocated to another DOF. You can still select it, but you will be asked to confirm.
              </p>
            </div>

            {selectedOrders.map(order => {
              const reqs = order.yarn_requirements || [];
              if (reqs.length === 0) return (
                <div key={order.id} style={{ marginBottom: '1.5rem', opacity: 0.6 }}>
                  <h4>{order.order_number} — No yarn requirements found</h4>
                </div>
              );
              const warpReqs = reqs.filter(r => r.type === 'warp');
              const weftReqs = reqs.filter(r => r.type === 'weft');

              return (
                <div key={order.id} style={{ marginBottom: '2rem', border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--color-primary)' }}>
                    {order.order_number} — {order.design_no} / {order.design_name}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                      <p style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.3rem' }}>🔵 Warp Colours</p>
                      {warpReqs.length === 0
                        ? <p style={{ color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>None</p>
                        : warpReqs.map(req => renderColourCard(req, order, 'warp'))}
                    </div>
                    <div>
                      <p style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.3rem' }}>🟠 Weft Colours</p>
                      {weftReqs.length === 0
                        ? <p style={{ color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>None</p>
                        : weftReqs.map(req => renderColourCard(req, order, 'weft'))}
                    </div>
                  </div>
                </div>
              );
            })}

            {allocations.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>Yarn Requirement Details</h4>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Order No.</th>
                        <th>Type</th>
                        <th>Yarn Count</th>
                        <th>Colour</th>
                        <th style={{ textAlign: 'right' }}>Req Qty (kg)</th>
                        <th style={{ textAlign: 'right' }}>Already Allotted (kg)</th>
                        <th style={{ textAlign: 'right' }}>Remaining (kg)</th>
                        <th style={{ textAlign: 'center', width: '130px' }}>Allotted Base Qty (kg)</th>
                        <th style={{ textAlign: 'center' }}>Excess %</th>
                        <th style={{ textAlign: 'right' }}>Total Qty (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((a, idx) => {
                        const order = myOrders.find(o => o.id === a.orderId);
                        const yarn = yarnCounts.find(y => y.id === a.countId);
                        const isExceeded = parseFloat(a.base_kg || 0) > a.remaining_kg;
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600', color: 'var(--color-primary)' }}>{order?.order_number}</td>
                            <td style={{ textTransform: 'capitalize' }}>{a.type}</td>
                            <td>{formatYarn(yarn)}</td>
                            <td>{a.colour}</td>
                            <td style={{ textAlign: 'right' }}>{a.original_required_kg.toFixed(2)}</td>
                            <td style={{ textAlign: 'right', color: a.already_allotted > 0 ? '#b45309' : '' }}>
                              {a.already_allotted.toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '600', color: a.remaining_kg > 0 ? '#1d4ed8' : '#6b7280' }}>
                              {a.remaining_kg.toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="number" min="0" step="0.01"
                                value={a.base_kg}
                                onChange={e => updateBaseQty(idx, e.target.value)}
                                className="input-field"
                                style={{
                                  maxWidth: '110px',
                                  textAlign: 'center',
                                  padding: '0.3rem 0.5rem',
                                  fontWeight: 'bold',
                                  borderColor: isExceeded ? '#dc2626' : '',
                                  backgroundColor: isExceeded ? '#fef2f2' : ''
                                }}
                              />
                              {isExceeded && (
                                <div style={{ color: '#dc2626', fontSize: '0.7rem', marginTop: '2px', fontWeight: '600' }}>
                                  Exceeds remaining ({a.remaining_kg.toFixed(2)} kg)
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="number" min="0" max="100" step="0.5"
                                value={a.excess_pct}
                                onChange={e => updateExcess(idx, e.target.value)}
                                className="input-field"
                                style={{ maxWidth: '80px', textAlign: 'center', padding: '0.3rem 0.5rem' }}
                              />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                              {(parseFloat(a.total_kg) || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{ backgroundColor: 'var(--surface-current)' }}>
                        <td colSpan={9} style={{ textAlign: 'right', fontWeight: '700' }}>Grand Total:</td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--color-primary)' }}>
                          {allocations.reduce((s, a) => s + (parseFloat(a.total_kg) || 0), 0).toFixed(2)} kg
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={handleNext} className="btn btn-primary" disabled={allocations.length === 0}>
                Next <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Summary & Submit ── */}
        {currentStep === 3 && (() => {
          const dyeingUnit = dyeingUnits.find(d => d.id === dyeingUnitId);
          const summary = buildSummary();
          return (
            <div className="fade-in">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    ['Dyeing Unit', dyeingUnit?.partner_name],
                    ['Expected Delivery', deliveryDate ? new Date(deliveryDate).toLocaleDateString() : 'Not set'],
                    ['Orders Linked', selectedOrders.length],
                    ['Total Qty', `${allocations.reduce((s, a) => s + (a.total_kg || 0), 0).toFixed(2)} kg`],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-muted-current)' }}>{label}:</span>
                      <span style={{ fontWeight: 'bold' }}>{val}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Linked Orders:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {selectedOrders.map(o => (
                      <span key={o.id} style={{ backgroundColor: 'var(--surface-current)', border: '1px solid var(--border-current)', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.6rem', fontSize: '0.8125rem', fontWeight: '600' }}>
                        {o.order_number}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <h4 style={{ marginBottom: '0.75rem' }}>Yarn Allocation Summary</h4>
              <div className="table-container" style={{ marginBottom: '2rem' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order No.</th><th>Type</th><th>Yarn Count</th><th>Colour</th>
                      <th style={{ textAlign: 'right' }}>Allotted Base (kg)</th>
                      <th style={{ textAlign: 'center' }}>Excess %</th>
                      <th style={{ textAlign: 'right' }}>Total (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((a, i) => {
                      const order = myOrders.find(o => o.id === a.orderId);
                      const yarn = yarnCounts.find(y => y.id === a.countId);
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: '600', color: 'var(--color-primary)' }}>{order?.order_number}</td>
                          <td style={{ textTransform: 'capitalize' }}>{a.type}</td>
                          <td>{formatYarn(yarn)}</td>
                          <td>{a.colour}</td>
                          <td style={{ textAlign: 'right' }}>{(parseFloat(a.base_kg) || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'center' }}>{a.excess_pct}%</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{(parseFloat(a.total_kg) || 0).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <h4 style={{ marginBottom: '0.75rem' }}>Count & Colour Wise Total</h4>
              <div className="table-container" style={{ maxWidth: '700px', marginBottom: '2rem' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Yarn Count</th><th>Colour</th>
                      <th style={{ textAlign: 'right' }}>Total Qty (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((s, i) => (
                      <tr key={i}>
                        <td><span style={{ fontWeight: '500' }}>{s.yarnLabel}</span></td>
                        <td>{s.colour}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)' }}>{s.total_kg.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: 'var(--surface-current)' }}>
                      <td colSpan={2} style={{ textAlign: 'right', fontWeight: '700' }}>Grand Total:</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--color-primary)' }}>
                        {summary.reduce((s, r) => s + r.total_kg, 0).toFixed(2)} kg
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '1rem', backgroundColor: '#fef3c7', borderRadius: 'var(--radius-md)', border: '1px solid #fcd34d', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                ⚠️ Once submitted, this DOF will be sent to the <strong>Admin for approval</strong>. Status: <strong>Pending</strong>.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleSubmit} className="btn btn-primary" disabled={loading} style={{ minWidth: '220px' }}>
                  {loading ? <><Loader size={16} /> Submitting...</> : <><Check size={18} /> Submit for Approval</>}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
