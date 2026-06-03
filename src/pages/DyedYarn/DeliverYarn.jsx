import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Plus, Trash2, 
  Search, Package, Calendar, Truck, 
  AlertCircle, ChevronDown, CheckCircle,
  Loader, Layers
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function DeliverDyedYarn() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetchingOrders, setFetchingOrders] = useState(false);
  
  // Masters
  const [targetOrders, setTargetOrders] = useState([]); // Warping/Weaving forms
  const [yarnCounts, setYarnCounts] = useState([]);
  const [locations, setLocations] = useState([]);

  // Form State
  const [targetProcess, setTargetProcess] = useState('warping'); // 'warping' or 'weaving'
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [deliveredDate, setDeliveredDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveredBy, setDeliveredBy] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [remarks, setRemarks] = useState('');
  
  // Line Items
  const [items, setItems] = useState([]);
  const [availableStock, setAvailableStock] = useState([]);

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    fetchTargetOrders();
  }, [targetProcess]);

  const fetchMasters = async () => {
    const [yarnRes, locRes] = await Promise.all([
      supabase.from('master_yarn_counts').select('*'),
      supabase.from('master_locations').select('*').eq('warehouse_type', 'dyed_yarn_warehouse')
    ]);
    setYarnCounts(yarnRes.data || []);
    setLocations(locRes.data || []);
  };

  const fetchTargetOrders = async () => {
    setFetchingOrders(true);
    try {
      const table = targetProcess === 'warping' ? 'warping_orders' : 'weaving_orders';
      const { data, error } = await supabase
        .from(table)
        .select('*, order:orders(order_number, design_no, design_name)')
        .eq('status', 'pending');
      
      if (error) throw error;
      setTargetOrders(data || []);
    } catch (err) {
      console.error('Error fetching target orders:', err.message);
    } finally {
      setFetchingOrders(false);
    }
  };

  const handleTargetSelect = async (id) => {
    const target = targetOrders.find(o => o.id === id);
    setSelectedTarget(target);
    if (!target) return;

    // Fetch stock available for this order
    setLoading(true);
    try {
      // 1. Get all receipts for this order
      const { data: receipts } = await supabase
        .from('dyed_yarn_receipt_items')
        .select('*')
        .eq('order_id', target.order_id);
      
      // 2. Get all deliveries already made for this order
      const { data: deliveries } = await supabase
        .from('dyed_yarn_delivery_items')
        .select('*')
        .eq('order_id', target.order_id);
      
      // 3. Summarize stock
      const stockMap = {};
      receipts?.forEach(r => {
        const key = `${r.yarn_count_id}-${r.colour}`;
        if (!stockMap[key]) stockMap[key] = { ...r, available: 0 };
        stockMap[key].available += parseFloat(r.quantity_kg);
      });
      deliveries?.forEach(d => {
        const key = `${d.yarn_count_id}-${d.colour}`;
        if (stockMap[key]) stockMap[key].available -= parseFloat(d.quantity_kg);
      });

      setAvailableStock(Object.values(stockMap).filter(s => s.available > 0.1));
      
      // Auto-populate delivery items with matching stock
      const initialItems = Object.values(stockMap)
        .filter(s => s.available > 0.1)
        .map(s => ({
          yarn_count_id: s.yarn_count_id,
          colour: s.colour,
          stock_kg: s.available,
          quantity_kg: '',
          no_of_bags: ''
        }));
      setItems(initialItems);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) return alert('No items to deliver.');
    const validItems = items.filter(i => parseFloat(i.quantity_kg) > 0);
    if (validItems.length === 0) return alert('Please enter quantities for at least one item.');

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
          vehicle_no: vehicleNo,
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
        no_of_bags: parseInt(i.no_of_bags) || null
      }));

      const { error: itemsError } = await supabase.from('dyed_yarn_delivery_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      alert('Dyed yarn delivery recorded successfully!');
      navigate('/dyed-yarn');
    } catch (err) {
      console.error(err);
      alert('Error saving delivery: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => navigate('/dyed-yarn')} className="btn-icon">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Deliver Dyed Yarn</h1>
          <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>Issue dyed yarn to production units (Warping/Weaving)</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Step 1: Destination Selection */}
        <div style={{ backgroundColor: 'var(--surface-current)', border: '1px solid var(--border-current)', borderRadius: '12px', padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 'bold' }}>
            <Truck size={18} color="var(--color-primary)" />
            Delivery Destination
          </h3>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <button 
              type="button"
              onClick={() => { setTargetProcess('warping'); setSelectedTarget(null); setItems([]); }}
              style={{
                flex: 1, padding: '1rem', borderRadius: '8px', border: '2px solid',
                borderColor: targetProcess === 'warping' ? 'var(--color-primary)' : '#eee',
                backgroundColor: targetProcess === 'warping' ? 'var(--color-primary-light)' : '#fff',
                cursor: 'pointer', textAlign: 'center'
              }}
            >
              <div style={{ fontWeight: '800', fontSize: '0.9rem', color: targetProcess === 'warping' ? 'var(--color-primary)' : '#666' }}>To Warping Unit</div>
            </button>
            <button 
              type="button"
              onClick={() => { setTargetProcess('weaving'); setSelectedTarget(null); setItems([]); }}
              style={{
                flex: 1, padding: '1rem', borderRadius: '8px', border: '2px solid',
                borderColor: targetProcess === 'weaving' ? 'var(--color-primary)' : '#eee',
                backgroundColor: targetProcess === 'weaving' ? 'var(--color-primary-light)' : '#fff',
                cursor: 'pointer', textAlign: 'center'
              }}
            >
              <div style={{ fontWeight: '800', fontSize: '0.9rem', color: targetProcess === 'weaving' ? 'var(--color-primary)' : '#666' }}>To Weaving Unit</div>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '700' }}>Select {targetProcess === 'warping' ? 'Warping' : 'Weaving'} Order</label>
              <select 
                className="form-input" 
                value={selectedTarget?.id || ''} 
                onChange={(e) => handleTargetSelect(e.target.value)}
                style={{ fontWeight: '800' }}
              >
                <option value="">-- Choose Order Form --</option>
                {targetOrders.map(o => (
                  <option key={o.id} value={o.id}>{o[targetProcess === 'warping' ? 'warping_number' : 'weaving_number']} (Order #{o.order?.order_number})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Delivery Date</label>
              <input type="date" className="form-input" value={deliveredDate} onChange={e => setDeliveredDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Delivered By</label>
              <input type="text" className="form-input" value={deliveredBy} onChange={e => setDeliveredBy(e.target.value)} placeholder="Personnel name" />
            </div>
          </div>
        </div>

        {/* Step 2: Stock Allocation */}
        {selectedTarget && (
          <div style={{ backgroundColor: 'var(--surface-current)', border: '1px solid var(--border-current)', borderRadius: '12px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 'bold' }}>
                <Layers size={18} color="var(--color-primary)" />
                Available Stock for Order #{selectedTarget.order?.order_number}
              </h3>
            </div>

            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#999', border: '1px dashed #ddd', borderRadius: '8px' }}>
                <AlertCircle size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p>No dyed yarn stock found for this order in the warehouse.</p>
                <p style={{ fontSize: '0.8rem' }}>Please verify that the dyed yarn receipts have been recorded.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', textAlign: 'left', borderBottom: '2px solid #eee' }}>
                      <th style={{ padding: '0.75rem' }}>Yarn Count & Colour</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right' }}>Current Stock (kg)</th>
                      <th style={{ padding: '0.75rem', width: '150px' }}>Delivery Qty (kg)</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right' }}>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const remaining = parseFloat(item.stock_kg) - (parseFloat(item.quantity_kg) || 0);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: '800' }}>{yarnCounts.find(y => y.id === item.yarn_count_id)?.count_value || '-'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: '700' }}>{item.colour}</div>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700' }}>
                            {parseFloat(item.stock_kg).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <input 
                              type="number" 
                              step="0.01" 
                              max={item.stock_kg}
                              className="form-input" 
                              style={{ fontWeight: '800', textAlign: 'right' }} 
                              value={item.quantity_kg} 
                              onChange={e => updateItem(idx, 'quantity_kg', e.target.value)} 
                              placeholder="0.00" 
                            />
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', color: remaining < 0 ? '#ef4444' : '#6b7280' }}>
                            {remaining.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <button type="button" onClick={() => navigate('/dyed-yarn')} className="btn btn-secondary" style={{ padding: '0.75rem 2rem' }}>Cancel</button>
          <button type="submit" disabled={loading || !selectedTarget || items.length === 0} className="btn btn-primary" style={{ padding: '0.75rem 2rem', minWidth: '150px', backgroundColor: '#450a0a', border: 'none' }}>
            {loading ? <Loader size={18} className="spin" /> : <><Save size={18} /> Issue Yarn</>}
          </button>
        </div>

      </form>
    </div>
  );
}
