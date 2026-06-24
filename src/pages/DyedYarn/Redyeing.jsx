import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Search, Repeat, 
  AlertCircle, CheckCircle, Loader, User, Calendar, ClipboardList
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { printDydr } from '../../utils/printDydr';

export default function AllotToRedyeing() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Loader states
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Masters
  const [partners, setPartners] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [yarnWorkers, setYarnWorkers] = useState([]);

  // Form State
  const [dofNumber, setDofNumber] = useState('');
  const [selectedDof, setSelectedDof] = useState(null);
  const [orders, setOrders] = useState([]);
  const [lotStock, setLotStock] = useState([]);

  // Shipment Details
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Checklist of selected lots for redyeing
  // Key: order_id-yarn_count_id-colour-lot_number
  // Value: { quantity: '', selected: false }
  const [redyeQuantities, setRedyeQuantities] = useState({});

  useEffect(() => {
    fetchMasters();
  }, []);

  const fetchMasters = async () => {
    try {
      const [partnersRes, countsRes, deptRes] = await Promise.all([
        supabase.from('master_partners').select('*').eq('partner_type', 'Dyeing Unit'),
        supabase.from('master_yarn_counts').select('*'),
        supabase.from('master_departments').select('id').ilike('department_name', '%yarn%')
      ]);

      setPartners(partnersRes.data || []);
      setYarnCounts(countsRes.data || []);

      const deptIds = (deptRes.data || []).map(d => d.id);
      if (deptIds.length > 0) {
        const { data: workersData } = await supabase
          .from('master_workers')
          .select('*')
          .in('department_id', deptIds)
          .order('worker_name', { ascending: true });
        setYarnWorkers(workersData || []);
      }
    } catch (err) {
      console.error('Error fetching masters:', err);
    }
  };

  const handleSearchDof = async (e) => {
    e?.preventDefault();
    if (!dofNumber.trim()) return;

    setFetching(true);
    setSelectedDof(null);
    setOrders([]);
    setLotStock([]);
    setRedyeQuantities({});
    setSelectedPartnerId('');

    try {
      // 1. Fetch DOF Details
      const { data: dof, error: dofError } = await supabase
        .from('dyeing_order_forms')
        .select('*, dyeing_unit:master_partners(partner_name)')
        .eq('dof_number', dofNumber.trim())
        .single();

      if (dofError || !dof) {
        alert('Dyeing Order Form not found.');
        setFetching(false);
        return;
      }

      setSelectedDof(dof);
      setSelectedPartnerId(dof.dyeing_unit_id || '');

      // 2. Fetch linked orders metadata
      if (dof.order_ids && dof.order_ids.length > 0) {
        const { data: orderData } = await supabase
          .from('orders')
          .select('id, order_number, design_no, design_name')
          .in('id', dof.order_ids);
        setOrders(orderData || []);
      }

      // 3. Fetch receipts (DYRR) of this DOF
      const { data: receipts } = await supabase
        .from('dyed_yarn_receipts')
        .select('id')
        .eq('dof_id', dof.id);

      const receiptIds = receipts?.map(r => r.id) || [];

      // 4. Fetch receipt items (received quantities by count, color, lot)
      let receivedItems = [];
      if (receiptIds.length > 0) {
        const { data: dyri } = await supabase
          .from('dyed_yarn_receipt_items')
          .select('*, order:orders(order_number, design_no, design_name)')
          .in('receipt_id', receiptIds);
        receivedItems = dyri || [];
      }

      // 5. Fetch existing redyeing deliveries for this DOF to subtract
      const { data: redyeDeliveries } = await supabase
        .from('dyed_yarn_delivery_items')
        .select('*, delivery:dyed_yarn_deliveries(dof_id)')
        .eq('process_type', 'redyeing')
        .eq('delivery.dof_id', dof.id);

      // Aggregate received qty grouped by count, color, lot, order_id
      const stockMap = {};
      receivedItems.forEach(item => {
        // Exclude excess or production returns from our calculations
        if (item.is_excess) return;

        const key = `${item.order_id || 'null'}-${item.yarn_count_id}-${item.colour}-${item.lot_number || '—'}`;
        if (!stockMap[key]) {
          stockMap[key] = {
            order_id: item.order_id,
            order_number: item.order?.order_number || 'MISC',
            design_info: item.order ? `${item.order.design_no} / ${item.order.design_name}` : '—',
            yarn_count_id: item.yarn_count_id,
            colour: item.colour,
            lot_number: item.lot_number || '—',
            received_qty: 0,
            redyed_qty: 0
          };
        }
        stockMap[key].received_qty += parseFloat(item.quantity_kg || 0);
      });

      // Aggregate already redyed qty to subtract
      redyeDeliveries?.forEach(item => {
        const key = `${item.order_id || 'null'}-${item.yarn_count_id}-${item.colour}-${item.lot_number || '—'}`;
        if (stockMap[key]) {
          stockMap[key].redyed_qty += parseFloat(item.quantity_kg || 0);
        }
      });

      // Filter out lots that have 0 remaining stock
      const availableLots = Object.values(stockMap).map(lot => ({
        ...lot,
        remaining_qty: Math.max(0, lot.received_qty - lot.redyed_qty)
      })).filter(lot => lot.remaining_qty > 0.01);

      setLotStock(availableLots);

      // Initialize allotment inputs
      const initialRedye = {};
      availableLots.forEach(lot => {
        const key = `${lot.order_id || 'null'}-${lot.yarn_count_id}-${lot.colour}-${lot.lot_number}`;
        initialRedye[key] = { quantity: '', selected: false };
      });
      setRedyeQuantities(initialRedye);

    } catch (err) {
      console.error(err);
      alert('Error fetching DOF details.');
    } finally {
      setFetching(false);
    }
  };

  const handleCheckboxChange = (key, val) => {
    setRedyeQuantities(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        selected: val,
        quantity: val ? prev[key].quantity : '' // clear if deselected
      }
    }));
  };

  const handleQtyChange = (key, val, maxVal) => {
    if (parseFloat(val) > maxVal) {
      val = maxVal.toString();
    }
    setRedyeQuantities(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        quantity: val
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const selectedLots = Object.keys(redyeQuantities).filter(k => redyeQuantities[k].selected);
    if (selectedLots.length === 0) {
      alert('Please select at least one lot to send for redyeing.');
      return;
    }

    // Validate quantities
    const validItems = [];
    for (const key of selectedLots) {
      const lotData = redyeQuantities[key];
      const matchingStock = lotStock.find(lot => `${lot.order_id || 'null'}-${lot.yarn_count_id}-${lot.colour}-${lot.lot_number}` === key);
      const qty = parseFloat(lotData.quantity || 0);

      if (isNaN(qty) || qty <= 0) {
        alert(`Please enter a valid quantity to redye for lot ${matchingStock.lot_number} (${matchingStock.colour}).`);
        return;
      }

      if (qty > matchingStock.remaining_qty) {
        alert(`Quantity to redye (${qty} kg) exceeds remaining received quantity (${matchingStock.remaining_qty} kg) for lot ${matchingStock.lot_number}.`);
        return;
      }

      validItems.push({
        ...matchingStock,
        quantity_kg: qty
      });
    }

    if (!selectedPartnerId) {
      alert('Please select a dyeing partner.');
      return;
    }

    if (!deliveredBy) {
      alert('Please enter or select the Delivered By person.');
      return;
    }

    setLoading(true);

    try {
      const year = new Date().getFullYear();

      // 1. Generate DYDR Number
      const { data: dydrNumber, error: dydrNoErr } = await supabase.rpc('get_next_dydr_number', { p_year: year });
      if (dydrNoErr) throw new Error("Failed to generate DYDR number: " + dydrNoErr.message);

      // 2. Insert delivery header
      const { data: delivery, error: deliveryErr } = await supabase
        .from('dyed_yarn_deliveries')
        .insert([{
          dydr_number: dydrNumber,
          delivered_date: new Date().toISOString().split('T')[0],
          delivered_by: deliveredBy,
          vehicle_no: vehicleNo || null,
          remarks: remarks || `Returned for redyeing from DOF ${selectedDof.dof_number}`,
          dof_id: selectedDof.id,
          dof_number: selectedDof.dof_number,
          dyeing_unit_id: selectedPartnerId,
          delivery_type: 'redyeing',
          created_by: profile.id
        }])
        .select()
        .single();

      if (deliveryErr) throw deliveryErr;

      // 3. Insert delivery items
      const itemsToInsert = validItems.map(item => {
        // Resolve type (warp/weft) from DOF's allocations
        const type = selectedDof.yarn_allocations.find(a => a.countId === item.yarn_count_id && a.colour === item.colour)?.type || 'warp';

        return {
          delivery_id: delivery.id,
          order_id: item.order_id === 'null' ? null : item.order_id,
          yarn_count_id: item.yarn_count_id,
          colour: item.colour,
          quantity_kg: item.quantity_kg,
          lot_number: item.lot_number !== '—' ? item.lot_number : null,
          process_type: 'redyeing',
          yarn_type: type
        };
      });

      const { error: itemsErr } = await supabase.from('dyed_yarn_delivery_items').insert(itemsToInsert);
      if (itemsErr) throw itemsErr;

      // 4. Update DOF Status to 'partially_received'
      const { error: dofStatusErr } = await supabase
        .from('dyeing_order_forms')
        .update({ status: 'partially_received' })
        .eq('id', selectedDof.id);

      if (dofStatusErr) throw dofStatusErr;

      // 5. Trigger Print
      const printObj = {
        dydr_number: dydrNumber,
        delivered_date: new Date().toISOString().split('T')[0],
        delivered_by: deliveredBy,
        vehicle_no: vehicleNo || 'In-House',
        remarks: remarks || `Returned for redyeing from DOF ${selectedDof.dof_number}`,
        target_process: 'redyeing',
        doc_no: selectedDof.dof_number,
        order_no: Array.from(new Set(validItems.map(i => i.order_number))).join(', '),
        design_no: Array.from(new Set(validItems.map(i => i.design_info.split(' / ')[0]))).join(', '),
        design_name: Array.from(new Set(validItems.map(i => i.design_info.split(' / ')[1]).filter(Boolean))).join(', '),
        items: validItems.map(i => ({
          yarn_count_id: i.yarn_count_id,
          colour: i.colour,
          quantity_kg: i.quantity_kg,
          lot_number: i.lot_number,
          yarn_count: yarnCounts.find(yc => yc.id === i.yarn_count_id)
        }))
      };

      alert(`Redyeing delivery saved successfully. Generated DYDR: ${dydrNumber}`);
      printDydr(printObj, yarnCounts);

      // Reset & go back
      navigate('/dyed-yarn');

    } catch (err) {
      console.error(err);
      alert('Error creating redyeing allotment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getFormatCount = (id) => {
    const yc = yarnCounts.find(y => y.id === id);
    return yc ? `${yc.count_value} ${yc.material}` : '—';
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
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => navigate('/dyed-yarn')} className="btn-icon">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>Allot Dyed Yarn to Redyeing</h1>
          <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>Send dyed yarn back to dyeing unit for correction</p>
        </div>
      </div>

      {/* DOF Search Panel */}
      <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2.5rem', border: '1px solid #e2e8f0', borderRadius: '16px', backgroundColor: '#fff', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Search Dyeing Order Form
        </h3>
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
      </div>

      {selectedDof && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Form Header / Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div style={{ padding: '1.25rem', backgroundColor: '#fdf8f8', border: '1px solid #fee2e2', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#991b1b', textTransform: 'uppercase' }}>Dyeing Unit (From DOF)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#7f1d1d', marginTop: '0.25rem' }}>
                {selectedDof.dyeing_unit?.partner_name || 'N/A'}
              </div>
            </div>

            <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Linked Orders</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#334155', marginTop: '0.25rem' }}>
                {orders.map(o => o.order_number).join(', ') || 'N/A'}
              </div>
            </div>
          </div>

          {/* Allocation lots list */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '900', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardList size={20} color="#7f1d1d" /> Available Lots for Redyeing
            </h3>

            {lotStock.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>
                No received dyed yarn stock available to redye for this DOF.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...premiumThStyle, width: '40px' }}>Select</th>
                      <th style={premiumThStyle}>Yarn Count</th>
                      <th style={premiumThStyle}>Colour</th>
                      <th style={premiumThStyle}>Lot Number</th>
                      <th style={premiumThStyle}>Order Number</th>
                      <th style={premiumThStyle}>Design</th>
                      <th style={premiumThStyleRight}>Total Received (kg)</th>
                      <th style={premiumThStyleRight}>Already Redyed (kg)</th>
                      <th style={premiumThStyleRight}>Current Stock (kg)</th>
                      <th style={{ ...premiumThStyleRight, width: '150px' }}>Allot to Redye (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotStock.map((lot, idx) => {
                      const key = `${lot.order_id || 'null'}-${lot.yarn_count_id}-${lot.colour}-${lot.lot_number}`;
                      const lotState = redyeQuantities[key] || { quantity: '', selected: false };

                      return (
                        <tr key={idx} className="premium-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ ...premiumTdStyle, textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={lotState.selected}
                              onChange={e => handleCheckboxChange(key, e.target.checked)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ ...premiumTdStyle, fontWeight: '700' }}>{getFormatCount(lot.yarn_count_id)}</td>
                          <td style={{ ...premiumTdStyle, color: '#7f1d1d', fontWeight: '800' }}>{lot.colour}</td>
                          <td style={{ ...premiumTdStyle, fontWeight: '600' }}>{lot.lot_number}</td>
                          <td style={{ ...premiumTdStyle, color: '#475569' }}>{lot.order_number}</td>
                          <td style={{ ...premiumTdStyle, fontSize: '0.75rem', color: '#64748b' }}>{lot.design_info}</td>
                          <td style={premiumTdStyleRight}>{lot.received_qty.toFixed(2)}</td>
                          <td style={{ ...premiumTdStyleRight, color: '#dc2626' }}>{lot.redyed_qty.toFixed(2)}</td>
                          <td style={{ ...premiumTdStyleRight, fontWeight: '700', color: '#16a34a' }}>{lot.remaining_qty.toFixed(2)}</td>
                          <td style={premiumTdStyleRight}>
                            <input 
                              type="number" 
                              step="0.01"
                              disabled={!lotState.selected}
                              placeholder="0.00"
                              className="premium-input"
                              value={lotState.quantity}
                              onChange={e => handleQtyChange(key, e.target.value, lot.remaining_qty)}
                              style={{ 
                                textAlign: 'right', 
                                fontWeight: '700',
                                width: '120px',
                                borderColor: lotState.selected ? '#7f1d1d' : '#cbd5e1',
                                backgroundColor: lotState.selected ? '#fff' : '#f1f5f9'
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Delivery logistics and submit */}
          {lotStock.length > 0 && (
            <div className="glass-panel" style={{ padding: '2rem', border: '1px solid #e2e8f0', borderRadius: '16px', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                <Save size={20} color="#7f1d1d" /> Redyeing Delivery Details
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Dyeing Partner
                  </label>
                  <select 
                    className="premium-select"
                    value={selectedPartnerId}
                    onChange={e => setSelectedPartnerId(e.target.value)}
                    style={{ fontWeight: '700', height: '42px' }}
                  >
                    <option value="">Select Dyeing Partner...</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.partner_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Delivered By (Driver/Worker) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input 
                      type="text"
                      list="workers-list"
                      className="premium-input"
                      placeholder="Enter or select worker..."
                      value={deliveredBy}
                      onChange={e => setDeliveredBy(e.target.value)}
                      style={{ paddingLeft: '36px', fontWeight: '700', height: '42px' }}
                    />
                    <datalist id="workers-list">
                      {yarnWorkers.map(w => (
                        <option key={w.id} value={w.worker_name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Vehicle Number
                  </label>
                  <input 
                    type="text"
                    className="premium-input"
                    placeholder="Enter Vehicle Number (e.g. TN-37-AA-1234)..."
                    value={vehicleNo}
                    onChange={e => setVehicleNo(e.target.value)}
                    style={{ fontWeight: '700', height: '42px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Remarks / Reasons for redyeing
                </label>
                <textarea 
                  className="premium-input"
                  placeholder="Enter failure details, colour shade issues or other quality check failure notes..."
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  style={{ height: '80px', padding: '10px 12px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => navigate('/dyed-yarn')}
                  className="btn premium-btn"
                  style={{ border: '1px solid #cbd5e1', backgroundColor: '#fff', padding: '0 2rem', height: '44px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  disabled={loading}
                  type="submit" 
                  className="btn btn-primary premium-btn"
                  style={{ backgroundColor: '#7f1d1d', border: 'none', color: '#fff', padding: '0 2.5rem', height: '44px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
                >
                  {loading ? <Loader size={18} className="spin" /> : (
                    <>
                      <Repeat size={18} />
                      Send to Redyeing
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

// Table cell style variables to keep code clean and readable
const premiumThStyle = {
  padding: '1rem 0.75rem',
  textAlign: 'left',
  fontSize: '0.8rem',
  fontWeight: '800',
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '2px solid #e2e8f0',
  backgroundColor: '#f8fafc'
};

const premiumThStyleRight = {
  ...premiumThStyle,
  textAlign: 'right'
};

const premiumTdStyle = {
  padding: '0.875rem 0.75rem',
  verticalAlign: 'middle',
  fontSize: '0.875rem',
  color: '#334155'
};

const premiumTdStyleRight = {
  ...premiumTdStyle,
  textAlign: 'right',
  fontWeight: '600'
};
