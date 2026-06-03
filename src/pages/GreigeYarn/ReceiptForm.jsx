import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ReceiptForm() {
  const navigate = useNavigate();
  
  // Masters Data
  const [yarnCounts, setYarnCounts] = useState([]);
  const [mills, setMills] = useState([]);
  const [locations, setLocations] = useState([]);

  // Form State
  const [receiptType, setReceiptType] = useState('spinning_mill');
  const [formData, setFormData] = useState({
    spinning_mill_id: '',
    order_form_no: '',
    invoice_no: '',
    invoice_date: new Date().toISOString().split('T')[0],
    invoice_amount: '',
    vehicle_no: '',
    received_by: ''
  });

  const [items, setItems] = useState([
    {
      yarn_count_id: '',
      bag_weight: '',
      bag_count: '',
      cone_weight: '',
      cone_count: '',
      rate_per_kg: '',
      location_id: '',
      verification_weight: ''
    }
  ]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMasters();
  }, []);

  // Reset items list when receipt source type changes
  useEffect(() => {
    setItems([
      {
        yarn_count_id: '',
        bag_weight: '',
        bag_count: '',
        cone_weight: '',
        cone_count: '',
        rate_per_kg: '',
        location_id: '',
        verification_weight: ''
      }
    ]);
  }, [receiptType]);

  const fetchMasters = async () => {
    const [counts, partners, locs] = await Promise.all([
      supabase.from('master_yarn_counts').select('*'),
      supabase.from('master_partners').select('*').eq('partner_type', 'Spinning Mill'),
      supabase.from('master_locations').select('*').eq('warehouse_type', 'Greige Warehouse')
    ]);
    if (counts.data) setYarnCounts(counts.data);
    if (partners.data) setMills(partners.data);
    if (locs.data) setLocations(locs.data);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Helper calculations for items
  const getItemComputedWeight = (item) => {
    const bags = (parseFloat(item.bag_weight) || 0) * (parseInt(item.bag_count) || 0);
    const cones = (parseFloat(item.cone_weight) || 0) * (parseInt(item.cone_count) || 0);
    return (bags + cones).toFixed(2);
  };

  const isItemVerified = (item) => {
    const weight = parseFloat(getItemComputedWeight(item));
    if (weight <= 0) return false;
    return weight === parseFloat(item.verification_weight);
  };

  // Verification Gatekeepers
  const isAllVerified = useMemo(() => {
    if (items.length === 0) return false;
    return items.every(item => {
      if (!item.yarn_count_id || !item.location_id) return false;
      return isItemVerified(item);
    });
  }, [items]);

  const grandTotalComputedWeight = useMemo(() => {
    return items.reduce((sum, item) => sum + parseFloat(getItemComputedWeight(item)), 0).toFixed(2);
  }, [items]);

  // Submission Logic
  const generateReceiptNumber = async () => {
    // Find the latest receipt number
    const { data } = await supabase
      .from('greige_yarn_receipts')
      .select('receipt_no')
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0 && data[0].receipt_no) {
      const lastStr = data[0].receipt_no;
      const parts = lastStr.split('/');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        return `AT/GYRR/${String(lastNum + 1).padStart(5, '0')}`;
      }
    }
    return `AT/GYRR/00001`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAllVerified) return;
    
    setSaving(true);
    try {
      const receiptNo = await generateReceiptNumber();

      const payloads = items.map(item => {
        const bagsWeight = (parseFloat(item.bag_weight) || 0) * (parseInt(item.bag_count) || 0);
        const conesWeight = (parseFloat(item.cone_weight) || 0) * (parseInt(item.cone_count) || 0);
        const computedItemWeight = bagsWeight + conesWeight;
        
        const payload = {
          receipt_no: receiptNo,
          receipt_type: receiptType,
          yarn_count_id: item.yarn_count_id,
          total_weight: computedItemWeight,
          bag_weight: parseFloat(item.bag_weight) || 0,
          bag_count: parseInt(item.bag_count) || 0,
          cone_weight: parseFloat(item.cone_weight) || 0,
          cone_count: parseInt(item.cone_count) || 0,
          rate_per_kg: parseFloat(item.rate_per_kg) || 0,
          location_id: item.location_id,
          vehicle_no: formData.vehicle_no,
          received_by: formData.received_by
        };

        if (receiptType === 'spinning_mill') {
          payload.spinning_mill_id = formData.spinning_mill_id;
          payload.invoice_no = formData.invoice_no;
          payload.invoice_date = formData.invoice_date;
          payload.invoice_amount = parseFloat(formData.invoice_amount) || 0;
        } else {
          payload.order_form_no = formData.order_form_no;
        }

        return payload;
      });

      const { error } = await supabase.from('greige_yarn_receipts').insert(payloads);
      setSaving(false);

      if (error) {
        alert("Database error: " + error.message);
      } else {
        navigate('/greige-yarn/receipts');
      }
    } catch (err) {
      setSaving(false);
      alert("Error: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }} className="fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <button 
          onClick={() => navigate('/greige-yarn/receipts')} 
          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', padding: '0', marginBottom: '0.5rem' }}
        >
          <ArrowLeft size={16} />
          Back to Receipts List
        </button>
        <h1 style={{ fontSize: '1.75rem', margin: '0', color: 'var(--text-current)', fontWeight: 'bold' }}>
          Receive Greige Yarn
        </h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Step 1: Receipt Source Type */}
        <div className="glass-panel">
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem' }}>1. Receiving Source</h2>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
              <input type="radio" checked={receiptType === 'spinning_mill'} onChange={() => setReceiptType('spinning_mill')} />
              Spinning Mill (Fresh Intake)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
              <input type="radio" checked={receiptType === 'production'} onChange={() => setReceiptType('production')} />
              Production Returns
            </label>
          </div>
        </div>

        {/* Step 2: Invoice / Order Details */}
        <div className="glass-panel">
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem' }}>2. Document Details</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {receiptType === 'spinning_mill' ? (
              <>
                <div className="input-group">
                  <label className="input-label">Spinning Mill Partner</label>
                  <select name="spinning_mill_id" className="input-field" value={formData.spinning_mill_id} onChange={handleChange} required>
                    <option value="">Select Mill...</option>
                    {mills.map(m => <option key={m.id} value={m.id}>{m.partner_name}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Invoice Number</label>
                  <input type="text" name="invoice_no" className="input-field" value={formData.invoice_no} onChange={handleChange} required />
                </div>
                <div className="input-group">
                  <label className="input-label">Invoice Date</label>
                  <input type="date" name="invoice_date" className="input-field" value={formData.invoice_date} onChange={handleChange} required />
                </div>
                <div className="input-group">
                  <label className="input-label">Invoice Amount (₹)</label>
                  <input type="number" step="0.01" name="invoice_amount" className="input-field" value={formData.invoice_amount} onChange={handleChange} required />
                </div>
              </>
            ) : (
              <div className="input-group">
                <label className="input-label">Production Order Form No.</label>
                <input type="text" name="order_form_no" className="input-field" value={formData.order_form_no} onChange={handleChange} required />
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Yarn Counts Received */}
        <div className="glass-panel">
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>3. Yarn Counts Received</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              onClick={() => setItems(prev => [...prev, {
                yarn_count_id: '',
                bag_weight: '',
                bag_count: '',
                cone_weight: '',
                cone_count: '',
                rate_per_kg: '',
                location_id: '',
                verification_weight: ''
              }])}
            >
              + Add Another Yarn Count
            </button>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {items.map((item, idx) => {
              const itemWeight = getItemComputedWeight(item);
              const verified = isItemVerified(item);
              
              return (
                <div key={idx} style={{ border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', padding: '1.5rem', position: 'relative', backgroundColor: verified ? '#f8fafc' : '#ffffff' }}>
                  
                  {/* Item Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px dashed var(--border-current)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>Yarn Count #{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                        style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Item Fields Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="input-group">
                      <label className="input-label">Select Yarn Count</label>
                      <select
                        className="input-field"
                        value={item.yarn_count_id}
                        onChange={e => {
                          const updated = [...items];
                          updated[idx].yarn_count_id = e.target.value;
                          setItems(updated);
                        }}
                        required
                      >
                        <option value="">Select Count...</option>
                        {yarnCounts.map(yc => <option key={yc.id} value={yc.id}>{yc.count_value} ({yc.material} - {yc.product_type})</option>)}
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Storage Location (Bay)</label>
                      <select
                        className="input-field"
                        value={item.location_id}
                        onChange={e => {
                          const updated = [...items];
                          updated[idx].location_id = e.target.value;
                          setItems(updated);
                        }}
                        required
                      >
                        <option value="">Select Storage Location...</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Packaging Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
                    <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                      <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#4b5563', fontWeight: 'bold' }}>Bags (Primary)</h4>
                      <div className="input-group">
                        <label className="input-label">Weight of 1 Bag (kg)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-field"
                          value={item.bag_weight}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].bag_weight = e.target.value;
                            setItems(updated);
                          }}
                          required
                        />
                      </div>
                      <div className="input-group" style={{ marginTop: '0.5rem' }}>
                        <label className="input-label">Number of Bags</label>
                        <input
                          type="number"
                          className="input-field"
                          value={item.bag_count}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].bag_count = e.target.value;
                            setItems(updated);
                          }}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                      <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#4b5563', fontWeight: 'bold' }}>Cones (Optional/Loose)</h4>
                      <div className="input-group">
                        <label className="input-label">Weight per Cone (kg)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-field"
                          value={item.cone_weight}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].cone_weight = e.target.value;
                            setItems(updated);
                          }}
                        />
                      </div>
                      <div className="input-group" style={{ marginTop: '0.5rem' }}>
                        <label className="input-label">Number of Cones</label>
                        <input
                          type="number"
                          className="input-field"
                          value={item.cone_count}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].cone_count = e.target.value;
                            setItems(updated);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pricing & Verification Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
                    {receiptType === 'spinning_mill' ? (
                      <div className="input-group">
                        <label className="input-label">Yarn Price / Rate per KG (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-field"
                          value={item.rate_per_kg}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].rate_per_kg = e.target.value;
                            setItems(updated);
                          }}
                          required
                        />
                      </div>
                    ) : (
                      <div></div> // empty spacer
                    )}

                    <div className="input-group">
                      <label className="input-label">Verify Invoice Weight for Count (kg)</label>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="number"
                          step="0.01"
                          className="input-field"
                          placeholder="Enter weight to verify"
                          value={item.verification_weight}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].verification_weight = e.target.value;
                            setItems(updated);
                          }}
                          required
                          style={{ borderColor: verified ? '#22c55e' : (item.verification_weight && !verified ? '#ef4444' : '') }}
                        />
                        {verified ? <CheckCircle2 color="#22c55e" size={20} /> : <AlertCircle color={item.verification_weight ? '#ef4444' : '#9ca3af'} size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Calculated Weight Preview */}
                  <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: verified ? '#f0fdf4' : '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: verified ? '1px solid #bbf7d0' : '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 'bold' }}>Calculated Count Weight:</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{itemWeight} kg</span>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* Grand Total Weight Banner */}
        <div style={{ backgroundColor: isAllVerified ? '#f0fdf4' : '#fef2f2', border: isAllVerified ? '1px solid #bbf7d0' : '1px solid #fca5a5', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: isAllVerified ? '#15803d' : '#b91c1c' }}>Grand Total Intake Weight</h3>
            <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '2rem', fontWeight: 'bold', color: isAllVerified ? '#166534' : '#991b1b' }}>{grandTotalComputedWeight} kg</h2>
          </div>
          <div>
            {isAllVerified ? (
              <span style={{ color: '#15803d', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={18} /> All Counts Verified</span>
            ) : (
              <span style={{ color: '#b91c1c', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertCircle size={18} /> Verification Pending</span>
            )}
          </div>
        </div>

        {/* Step 5: Storage (Locked until verified) */}
        {isAllVerified && (
          <div className="glass-panel fade-in">
            <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem' }}>4. Storage & Logistics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Vehicle Registry No.</label>
                <input type="text" name="vehicle_no" placeholder="TN-XX-XXXX" className="input-field" value={formData.vehicle_no} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label className="input-label">Received By (Personnel)</label>
                <input type="text" name="received_by" className="input-field" value={formData.received_by} onChange={handleChange} required />
              </div>
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label className="input-label">Invoice Attachment (Optional)</label>
                <input type="file" className="input-field" style={{ padding: '0.5rem' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>Files will be linked to receipt record.</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={!isAllVerified || saving}
            style={{ fontSize: '1rem', padding: '0.75rem 2rem', opacity: (!isAllVerified || saving) ? 0.5 : 1 }}
          >
            {saving ? 'Generating AT/GYRR...' : 'Create Receipt + Print'}
          </button>
        </div>

      </form>
    </div>
  );
}
