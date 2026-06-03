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
    yarn_count_id: '',
    spinning_mill_id: '',
    order_form_no: '',
    invoice_no: '',
    invoice_date: new Date().toISOString().split('T')[0],
    invoice_amount: '',
    bag_weight: '',
    bag_count: '',
    cone_weight: '',
    cone_count: '',
    rate_per_kg: '',
    location_id: '',
    vehicle_no: '',
    received_by: ''
  });

  const [verificationWeight, setVerificationWeight] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMasters();
  }, []);

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

  // Auto Calculations
  const computedWeight = useMemo(() => {
    const bags = (parseFloat(formData.bag_weight) || 0) * (parseInt(formData.bag_count) || 0);
    const cones = (parseFloat(formData.cone_weight) || 0) * (parseInt(formData.cone_count) || 0);
    return (bags + cones).toFixed(2);
  }, [formData.bag_weight, formData.bag_count, formData.cone_weight, formData.cone_count]);

  const isVerified = useMemo(() => {
    if (parseFloat(computedWeight) <= 0) return false;
    return parseFloat(computedWeight) === parseFloat(verificationWeight);
  }, [computedWeight, verificationWeight]);

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
    if (!isVerified) return;
    
    setSaving(true);
    const receiptNo = await generateReceiptNumber();

    const payload = {
      receipt_no: receiptNo,
      receipt_type: receiptType,
      yarn_count_id: formData.yarn_count_id,
      total_weight: parseFloat(computedWeight),
      bag_weight: parseFloat(formData.bag_weight) || 0,
      bag_count: parseInt(formData.bag_count) || 0,
      cone_weight: parseFloat(formData.cone_weight) || 0,
      cone_count: parseInt(formData.cone_count) || 0,
      rate_per_kg: parseFloat(formData.rate_per_kg) || 0,
      location_id: formData.location_id,
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

    const { error } = await supabase.from('greige_yarn_receipts').insert([payload]);
    setSaving(false);

    if (error) {
      alert("Database error: " + error.message);
    } else {
      navigate('/greige-yarn/receipts');
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
            <div className="input-group">
              <label className="input-label">Yarn Count Setup</label>
              <select name="yarn_count_id" className="input-field" value={formData.yarn_count_id} onChange={handleChange} required>
                <option value="">Select Count...</option>
                {yarnCounts.map(yc => <option key={yc.id} value={yc.id}>{yc.count_value} ({yc.material} - {yc.product_type})</option>)}
              </select>
            </div>

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

        {/* Step 3: Package Math Details */}
        <div className="glass-panel">
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem' }}>3. Package Details</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#4b5563' }}>Bags (Primary)</h3>
              <div className="input-group">
                <label className="input-label">Weight of 1 Bag (kg)</label>
                <input type="number" step="0.01" name="bag_weight" className="input-field" value={formData.bag_weight} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label className="input-label">Number of Bags</label>
                <input type="number" name="bag_count" className="input-field" value={formData.bag_count} onChange={handleChange} required />
              </div>
            </div>

            <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#4b5563' }}>Cones (Optional/Loose)</h3>
              <div className="input-group">
                <label className="input-label">Weight per Cone (kg)</label>
                <input type="number" step="0.01" name="cone_weight" className="input-field" value={formData.cone_weight} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Number of Cones</label>
                <input type="number" name="cone_count" className="input-field" value={formData.cone_count} onChange={handleChange} />
              </div>
            </div>
            
            <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px', border: '1px dashed #d1d5db', gridColumn: 'span 2' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#4b5563' }}>Pricing Details</h3>
              <div className="input-group" style={{ maxWidth: '50%' }}>
                <label className="input-label">Yarn Price / Rate per KG (₹)</label>
                <input type="number" step="0.01" name="rate_per_kg" className="input-field" value={formData.rate_per_kg} onChange={handleChange} required />
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Weight Verification Gatekeeper */}
        <div className="glass-panel" style={{ backgroundColor: isVerified ? '#f0fdf4' : 'var(--surface-current)', borderColor: isVerified ? '#86efac' : 'var(--border-current)' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', color: isVerified ? '#166534' : 'inherit' }}>4. Verification</h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: 'var(--text-muted-current)' }}>System Calculated Final Weight</p>
              <p style={{ margin: '0', fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{computedWeight} kg</p>
            </div>
            
            <div style={{ minWidth: '300px' }}>
              <div className="input-group">
                <label className="input-label">Verify Invoice Weight</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field" 
                    placeholder="Enter matching weight"
                    value={verificationWeight} 
                    onChange={e => setVerificationWeight(e.target.value)} 
                    style={{ borderColor: isVerified ? '#22c55e' : (verificationWeight && !isVerified ? '#ef4444' : '') }}
                  />
                  {isVerified ? <CheckCircle2 color="#22c55e" /> : <AlertCircle color={verificationWeight ? '#ef4444' : '#9ca3af'} />}
                </div>
                {!isVerified && verificationWeight !== '' && parseFloat(computedWeight) > 0 && <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem' }}>Weights do not match! Check bag/cone counts.</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Step 5: Storage (Locked until verified) */}
        {isVerified && (
          <div className="glass-panel fade-in">
            <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem' }}>5. Storage & Logistics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Select Warehouse Location</label>
                <select name="location_id" className="input-field" value={formData.location_id} onChange={handleChange} required>
                  <option value="">Select Storage Location...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Vehicle Registry No.</label>
                <input type="text" name="vehicle_no" placeholder="TN-XX-XXXX" className="input-field" value={formData.vehicle_no} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label className="input-label">Received By (Personnel)</label>
                <input type="text" name="received_by" className="input-field" value={formData.received_by} onChange={handleChange} required />
              </div>
              <div className="input-group">
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
            disabled={!isVerified || saving}
            style={{ fontSize: '1rem', padding: '0.75rem 2rem', opacity: (!isVerified || saving) ? 0.5 : 1 }}
          >
            {saving ? 'Generating AT/GYRR...' : 'Create Receipt + Print'}
          </button>
        </div>

      </form>
    </div>
  );
}
