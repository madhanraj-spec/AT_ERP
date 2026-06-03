import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Package, Calendar, 
  Truck, AlertCircle, Save, Printer, 
  X, CheckCircle, Loader, User, 
  FileText, Hash, Info, ChevronRight,
  TrendingUp, Layers, Factory, Users,
  Dna, MoveHorizontal
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import DyedReceiptPrintModal from './DyedReceiptPrintModal';

export default function ReceiveYarn() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  // Loading States
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  
  // Masters
  const [locations, setLocations] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);

  // Workflow State
  const [sourceType, setSourceType] = useState('partner');
  const [step, setStep] = useState(1);
  const [isClosingDof, setIsClosingDof] = useState(false);
  const [dofProgress, setDofProgress] = useState(0); 
  
  // Data State
  const [dofNumber, setDofNumber] = useState('');
  const [selectedDof, setSelectedDof] = useState(null);
  const [orderMap, setOrderMap] = useState({});
  const [receiptItems, setReceiptItems] = useState([]);

  // Final Form State
  const [logistics, setLogistics] = useState({
    dc_number: '',
    vehicle_no: '',
    received_by: profile?.full_name || ''
  });

  const [printData, setPrintData] = useState(null);

  useEffect(() => {
    fetchMasters();
  }, []);

  const fetchMasters = async () => {
    const [locRes, yarnRes] = await Promise.all([
      supabase.from('master_locations').select('*').ilike('warehouse_type', '%dyed%'),
      supabase.from('master_yarn_counts').select('*')
    ]);
    setLocations(locRes.data || []);
    setYarnCounts(yarnRes.data || []);
  };

  const handleSearchDof = async (e) => {
    e?.preventDefault();
    if (!dofNumber.trim()) return;

    setFetching(true);
    try {
      const { data: dof, error: dofError } = await supabase
        .from('dyeing_order_forms')
        .select('*, master_partners(partner_name)')
        .eq('dof_number', dofNumber.trim())
        .single();

      if (dofError || !dof) {
        alert('DOF not found.');
        return;
      }

      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, design_no, design_name')
        .in('id', dof.order_ids);
      
      const oMap = {};
      orders?.forEach(o => oMap[o.id] = o);
      setOrderMap(oMap);

      const { data: gydrs } = await supabase
        .from('greige_yarn_delivery_receipts')
        .select('id').eq('dof_id', dof.id);
      
      const gydrIds = gydrs?.map(g => g.id) || [];
      const sMap = {}; // order-count-color
      const fallbackMap = {}; // count-color

      if (gydrIds.length > 0) {
        const { data: sentItems } = await supabase
          .from('greige_yarn_delivery_items')
          .select('order_id, yarn_count_id, colour, quantity_kg, yarn_type')
          .in('receipt_id', gydrIds);
        
        sentItems?.forEach(item => {
          const key = `${item.order_id}-${item.yarn_count_id}-${item.colour}-${item.yarn_type}`;
          const fKey = `${item.yarn_count_id}-${item.colour}-${item.yarn_type}`;
          
          sMap[key] = (sMap[key] || 0) + parseFloat(item.quantity_kg);
          fallbackMap[fKey] = (fallbackMap[fKey] || 0) + parseFloat(item.quantity_kg);
        });
      }

      // 4. Fetch Historical Dyed Receipts (Total Received)
      const { data: dyrrs } = await supabase
        .from('dyed_yarn_receipts')
        .select('id').eq('dof_id', dof.id);
      
      const dyrrIds = dyrrs?.map(d => d.id) || [];
      const hMap = {}; // historical received

      if (dyrrIds.length > 0) {
        const { data: recItems } = await supabase
          .from('dyed_yarn_receipt_items')
          .select('order_id, yarn_count_id, colour, quantity_kg')
          .in('receipt_id', dyrrIds);
        
        recItems?.forEach(item => {
          const key = `${item.order_id}-${item.yarn_count_id}-${item.colour}`;
          hMap[key] = (hMap[key] || 0) + parseFloat(item.quantity_kg);
        });
      }

      // 5. Map to Receipt Items
      const initialItems = dof.yarn_allocations.map(alloc => {
        const key = `${alloc.orderId}-${alloc.countId}-${alloc.colour}-${alloc.type}`;
        
        // Matches: Type-Specific + Legacy-Order-Specific + Fully-Unassigned
        const sentValue = (sMap[key] || 0) + 
                          (sMap[`${alloc.orderId}-${alloc.countId}-${alloc.colour}-null`] || 0) +
                          (sMap[`null-${alloc.countId}-${alloc.colour}-${alloc.type}`] || 0) +
                          (sMap[`null-${alloc.countId}-${alloc.colour}-null`] || 0);
        const histValue = hMap[key] || 0;

        return {
          order_id: alloc.orderId,
          yarn_count_id: alloc.countId,
          colour: alloc.colour,
          type: alloc.type || 'warp',
          required_qty: alloc.total_kg,
          sent_qty: sentValue,
          historical_qty: histValue, 
          received_weight: '',
          location_id: locations[0]?.id || '',
          order_number: oMap[alloc.orderId]?.order_number || '',
          design_info: `${oMap[alloc.orderId]?.design_no || ''} / ${oMap[alloc.orderId]?.design_name || ''}`
        };
      });

      setSelectedDof(dof);
      setReceiptItems(initialItems);
    } catch (err) {
      console.error(err);
      alert('Error fetching details.');
    } finally {
      setFetching(false);
    }
  };

  const addManualItem = () => {
    setReceiptItems([...receiptItems, {
      order_id: null, order_number: 'MISC', design_info: '',
      yarn_count_id: '', colour: '', type: 'warp',
      required_qty: 0, sent_qty: 0, historical_qty: 0, received_weight: '',
      location_id: locations[0]?.id || ''
    }]);
  };

  const updateItem = (index, field, val) => {
    const newItems = [...receiptItems];
    newItems[index][field] = val;
    setReceiptItems(newItems);
  };

  const handleProceed = () => {
    const valid = receiptItems.some(i => parseFloat(i.received_weight) > 0);
    if (!valid) return alert('Enter received weight for at least one item.');
    
    if (sourceType === 'partner') {
      const totalRequired = receiptItems.reduce((s, i) => s + parseFloat(i.required_qty), 0);
      const totalNow = receiptItems.reduce((s, i) => s + (parseFloat(i.historical_qty) || 0) + (parseFloat(i.received_weight) || 0), 0);
      const perc = (totalNow / totalRequired) * 100;
      setDofProgress(perc);
    }
    
    setStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const { data: dyrrNumber } = await supabase.rpc('get_next_dyrr_number', { p_year: year });

      const { data: receipt, error: headError } = await supabase
        .from('dyed_yarn_receipts')
        .insert([{
          dyrr_number: dyrrNumber,
          dof_id: sourceType === 'partner' ? selectedDof?.id : null,
          dof_number: sourceType === 'partner' ? selectedDof?.dof_number : 'PRODUCTION_RETURN',
          dyeing_unit_id: sourceType === 'partner' ? selectedDof?.dyeing_unit_id : null,
          received_date: new Date().toISOString().split('T')[0],
          vehicle_no: logistics.vehicle_no,
          dc_number: logistics.dc_number,
          received_by: logistics.received_by,
          source_type: sourceType,
          created_by: profile.id
        }]).select().single();

      if (headError) throw headError;

      const itemsToInsert = receiptItems
        .filter(i => parseFloat(i.received_weight) > 0)
        .map(i => ({
          receipt_id: receipt.id,
          order_id: i.order_id,
          yarn_count_id: i.yarn_count_id,
          colour: i.colour,
          quantity_kg: parseFloat(i.received_weight),
          location_id: i.location_id,
          is_excess: sourceType === 'production',
          yarn_type: i.type
        }));

      const { error: itemsError } = await supabase.from('dyed_yarn_receipt_items').insert(itemsToInsert);
      if (itemsError) {
        alert("Failed to save receipt items: " + itemsError.message);
        throw itemsError;
      }

      if (sourceType === 'partner') {
        const newStatus = isClosingDof ? 'received' : 'partially_received';
        const { error: statusError } = await supabase.from('dyeing_order_forms')
          .update({ status: newStatus })
          .eq('id', selectedDof.id);
        if (statusError) {
          alert("Failed to update DOF status: " + statusError.message);
          throw statusError;
        }
      }

      const printObj = {
        receiptNumber: dyrrNumber,
        dof_number: selectedDof.dof_number,
        date: new Date().toLocaleString(),
        source: sourceType === 'partner' ? 'Partner Receipt' : 'Production Return',
        partner_name: sourceType === 'partner' ? selectedDof?.master_partners?.partner_name : 'N/A',
        items: itemsToInsert.map(item => {
          const original = receiptItems.find(ri => ri.yarn_count_id === item.yarn_count_id && ri.colour === item.colour);
          return {
            orderNo: original?.order_number || '-',
            design: original?.design_info || '-',
            count: yarnCounts.find(y => y.id === item.yarn_count_id)?.count_value,
            colour: item.colour,
            type: original?.type,
            weight: item.quantity_kg,
            location: locations.find(l => l.id === item.location_id)?.location_name
          };
        }),
        logistics
      };

      setPrintData(printObj);
      setStep(1); // Hide the finalize modal
      // Removed the immediate window.print() call as the modal will handle it.

    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const groupedItems = () => {
    const groups = {};
    receiptItems.forEach(item => {
      const oid = item.order_number || 'manual';
      if (!groups[oid]) groups[oid] = { info: { number: item.order_number, design: item.design_info }, warp: [], weft: [] };
      if (item.type === 'warp') groups[oid].warp.push(item);
      else groups[oid].weft.push(item);
    });
    return groups;
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
      {printData && (
        <DyedReceiptPrintModal 
          receipt={printData} 
          onClose={() => {
            setPrintData(null);
            navigate('/dyed-yarn');
          }} 
        />
      )}

      <div className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => navigate('/dyed-yarn')} className="btn-icon"><ArrowLeft size={20} /></button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>Receive Dyed Yarn</h1>
            <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>Organized by Order, Warp, and Weft</p>
          </div>
        </div>

        {/* Source Toggle */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => { setSourceType('partner'); setReceiptItems([]); }} style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '2px solid', borderColor: sourceType === 'partner' ? 'var(--color-primary)' : '#eee', backgroundColor: sourceType === 'partner' ? 'var(--color-primary-light)' : '#fff', cursor: 'pointer' }}>
            <div style={{ fontWeight: '800', color: sourceType === 'partner' ? 'var(--color-primary)' : '#666' }}>Receive from Partner</div>
          </button>
          <button onClick={() => { setSourceType('production'); setReceiptItems([]); addManualItem(); }} style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '2px solid', borderColor: sourceType === 'production' ? 'var(--color-primary)' : '#eee', backgroundColor: sourceType === 'production' ? 'var(--color-primary-light)' : '#fff', cursor: 'pointer' }}>
            <div style={{ fontWeight: '800', color: sourceType === 'production' ? 'var(--color-primary)' : '#666' }}>Receive from Production</div>
          </button>
        </div>

        {sourceType === 'partner' && (
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid #eee' }}>
            <form onSubmit={handleSearchDof} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', maxWidth: '600px' }}>
              <input type="text" className="form-input" placeholder="Enter DOF Number..." value={dofNumber} onChange={e => setDofNumber(e.target.value)} style={{ fontWeight: '800' }} />
              <button disabled={fetching} type="submit" className="btn btn-primary">{fetching ? <Loader size={18} className="spin" /> : 'Fetch Details'}</button>
            </form>
            {selectedDof && (
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '2rem', padding: '1.25rem', backgroundColor: '#7f1d1d', borderRadius: '10px', color: '#fff' }}>
                <div><div style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.8 }}>PARTNER</div><div style={{ fontWeight: '900' }}>{selectedDof.dyeing_unit?.partner_name}</div></div>
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '2rem' }}><div style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.8 }}>EXPECTED</div><div style={{ fontWeight: '900' }}>{selectedDof.expected_delivery_date}</div></div>
              </div>
            )}
          </div>
        )}

        {(selectedDof || sourceType === 'production') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {Object.entries(groupedItems()).map(([oid, group]) => (
              <div key={oid} className="glass-panel" style={{ padding: 0, overflow: 'hidden', border: '1px solid #eee' }}>
                <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#fcfaf9', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ backgroundColor: '#7f1d1d', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '800' }}>
                    ORDER: {group.info.number} {group.info.design && `· ${group.info.design}`}
                  </div>
                </div>
                
                <table className="item-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '25%' }}>Yarn Count & Colour</th>
                      <th style={{ width: '10%' }}>Type</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Required (kg)</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Sent / Prev.Rec (kg)</th>
                      <th style={{ width: '15%' }}>Received Weight (kg)</th>
                      <th style={{ width: '20%' }}>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.warp.length > 0 && (
                      <React.Fragment>
                        <tr className="section-row"><td colSpan="6">WARP DETAILS</td></tr>
                        {group.warp.map((item, idx) => (
                          <DataRow key={`warp-${idx}`} item={item} yarnCounts={yarnCounts} locations={locations} updateItem={(f, v) => {
                            const realIdx = receiptItems.findIndex(ri => ri === item);
                            updateItem(realIdx, f, v);
                          }} />
                        ))}
                      </React.Fragment>
                    )}
                    {group.weft.length > 0 && (
                      <React.Fragment>
                        <tr className="section-row" style={{ color: '#0d9488' }}><td colSpan="6">WEFT DETAILS</td></tr>
                        {group.weft.map((item, idx) => (
                          <DataRow key={`weft-${idx}`} item={item} yarnCounts={yarnCounts} locations={locations} updateItem={(f, v) => {
                            const realIdx = receiptItems.findIndex(ri => ri === item);
                            updateItem(realIdx, f, v);
                          }} />
                        ))}
                      </React.Fragment>
                    )}
                  </tbody>
                </table>
              </div>
            ))}

            {sourceType === 'production' && <button onClick={addManualItem} className="btn btn-secondary" style={{ width: 'fit-content' }}>+ Add Return Order</button>}

            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', border: '1px solid #eee' }}>
              <button onClick={() => navigate('/dyed-yarn')} className="btn btn-secondary">Cancel</button>
              <button onClick={handleProceed} className="btn btn-primary" style={{ padding: '0.75rem 3rem', fontWeight: '900', backgroundColor: '#7f1d1d' }}>Confirm Logistics <ChevronRight size={18} /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel" style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '2.5rem', width: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', fontWeight: '900', color: '#7f1d1d' }}>Finalize Receipt</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {sourceType === 'partner' && (
                  <div style={{ padding: '1.25rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#166534' }}>DOF COMPLETION PROGRESS</span>
                      <span style={{ fontSize: '1rem', fontWeight: '900', color: '#166534' }}>{dofProgress.toFixed(1)}%</span>
                    </div>
                    {dofProgress >= 95 && (
                      <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle size={16} /> Within 5% tolerance. System recommends CLOSING this DOF.
                      </div>
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                      <input 
                        type="checkbox" 
                        style={{ width: '20px', height: '20px', accentColor: '#166534' }} 
                        checked={isClosingDof} 
                        onChange={e => setIsClosingDof(e.target.checked)}
                      />
                      <span style={{ fontWeight: '800', fontSize: '0.9rem' }}>Fully Received (Close DOF)</span>
                    </label>
                  </div>
                )}

                <div><label className="form-label">DC Number</label><input className="form-input" placeholder="e.g. DC-12345" value={logistics.dc_number} onChange={e => setLogistics({...logistics, dc_number: e.target.value})} /></div>
                <div><label className="form-label">Vehicle No</label><input className="form-input" placeholder="e.g. TN 01 AB 1234" value={logistics.vehicle_no} onChange={e => setLogistics({...logistics, vehicle_no: e.target.value})} /></div>
                <div><label className="form-label">Received By</label><input className="form-input" value={logistics.received_by} onChange={e => setLogistics({...logistics, received_by: e.target.value})} /></div>
                
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button onClick={() => setStep(1)} className="btn btn-secondary" style={{ flex: 1 }}>Back</button>
                  <button onClick={handleSubmit} className="btn btn-primary" style={{ flex: 2, fontWeight: '900', backgroundColor: '#7f1d1d' }}>{loading ? <Loader size={18} className="spin" /> : 'Confirm & Generate Receipt'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DataRow({ item, yarnCounts, locations, updateItem }) {
  const countObj = yarnCounts.find(y => y.id === item.yarn_count_id);
  
  return (
    <tr>
      <td>
        <div style={{ fontWeight: '800', color: '#1e293b' }}>{countObj?.count_value || 'Select Count...'}</div>
        <div style={{ fontSize: '0.75rem', color: '#7f1d1d', fontWeight: '700', marginTop: '2px' }}>{item.colour}</div>
      </td>
      <td style={{ textTransform: 'capitalize', fontWeight: '700', color: '#64748b' }}>{item.type}</td>
      <td style={{ textAlign: 'right', fontWeight: '600' }}>{item.required_qty.toFixed(2)}</td>
      <td style={{ textAlign: 'right', fontWeight: '700', color: '#334155' }}>
        {item.sent_qty.toFixed(2)} / <span style={{ color: '#16a34a' }}>{item.historical_qty.toFixed(2)}</span>
      </td>
      <td>
        <input 
          type="number" 
          step="0.01" 
          className="form-input" 
          style={{ textAlign: 'right', fontWeight: '900', fontSize: '1rem', padding: '6px 12px' }} 
          value={item.received_weight} 
          onChange={e => updateItem('received_weight', e.target.value)} 
          placeholder="0.00" 
        />
      </td>
      <td>
        <select 
          className="form-input" 
          style={{ fontWeight: '700', fontSize: '0.85rem' }} 
          value={item.location_id} 
          onChange={e => updateItem('location_id', e.target.value)}
        >
          <option value="">Select Location</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
        </select>
      </td>
    </tr>
  );
}
