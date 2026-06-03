import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader, Package, MapPin, CheckCircle, AlertTriangle,
  Eye, X, ChevronRight, Truck, User, FileText
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
const formatCount = (count) => {
  if (!count) return '-';
  return `${count.count_value} - ${count.material} - ${count.product_type}`;
};

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function DeliverYarn() {
  const { id: dofId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Core data
  const [loading, setLoading] = useState(true);
  const [dof, setDof] = useState(null);
  const [orders, setOrders] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [existingDeliveries, setExistingDeliveries] = useState([]); // delivery items already made
  const [existingReceipts, setExistingReceipts] = useState([]); // GYDR receipts for this DOF
  const [globalStock, setGlobalStock] = useState({}); // { countId: availableWgt }
  const [locStock, setLocStock] = useState({}); // { countId: { locationId: quantity } }

  // Modals
  const [allocateModal, setAllocateModal] = useState(null); // { countId, colour, required_kg, sent_kg }
  const [logisticsModal, setLogisticsModal] = useState(null); // { items: [{...}] }
  const [viewReceiptModal, setViewReceiptModal] = useState(null);
  const [view, setView] = useState('summary'); // 'summary' | 'allocation'

  // Allocate form state (consolidated for all counts)
  const [allAllocItems, setAllAllocItems] = useState([]); // [{ countId, colour, orderNo, type, required, qty, location, ... }]
  const [allocError, setAllocError] = useState('');

  // Logistics form state
  const [deliveredBy, setDeliveredBy] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Fetch the DOF
      const { data: dofData, error: dofErr } = await supabase
        .from('dyeing_order_forms')
        .select(`*, dyeing_unit:master_partners(partner_name)`)
        .eq('id', dofId)
        .single();
      if (dofErr) throw dofErr;
      setDof(dofData);

      // 2) Fetch linked orders
      if (dofData.order_ids?.length) {
        const { data: ordersData } = await supabase
          .from('orders')
          .select('id, order_number, design_no, design_name')
          .in('id', dofData.order_ids);
        setOrders(ordersData || []);
      }

      // 3) Fetch yarn counts
      const { data: countsData } = await supabase.from('master_yarn_counts').select('*');
      setYarnCounts(countsData || []);

      // 4) Fetch locations (Greige Warehouse)
      const { data: locData } = await supabase
        .from('master_locations')
        .select('*')
        .eq('warehouse_type', 'Greige Warehouse');
      setLocations(locData || []);

      // 5) Fetch existing delivery items for this DOF
      const { data: receiptsData } = await supabase
        .from('greige_yarn_delivery_receipts')
        .select(`
          *,
          greige_yarn_delivery_items(
            *,
            master_yarn_counts(*),
            master_locations(*)
          )
        `)
        .eq('dof_id', dofId)
        .order('created_at', { ascending: false });

      setExistingReceipts(receiptsData || []);

      // Flatten all delivery items for this DOF
      const allItems = (receiptsData || []).flatMap(r => r.greige_yarn_delivery_items || []);
      setExistingDeliveries(allItems);

      // 6) Global Stock Calculation (Total Receipts - Total Deliveries)
      // We only care about counts in this DOF to save bandwidth
      const countIds = (dofData.summary || []).map(s => s.countId);
      if (countIds.length > 0) {
        const { data: globalRec } = await supabase
          .from('greige_yarn_receipts')
          .select('yarn_count_id, location_id, total_weight')
          .in('yarn_count_id', countIds);
        
        const { data: globalDel } = await supabase
          .from('greige_yarn_delivery_items')
          .select('yarn_count_id, location_id, quantity_kg')
          .in('yarn_count_id', countIds);

        const stockMap = {};
        const lStockMap = {}; // { countId: { locId: qty } }

        (globalRec || []).forEach(r => {
          const w = parseFloat(r.total_weight || 0);
          stockMap[r.yarn_count_id] = (stockMap[r.yarn_count_id] || 0) + w;
          
          if (!lStockMap[r.yarn_count_id]) lStockMap[r.yarn_count_id] = {};
          lStockMap[r.yarn_count_id][r.location_id] = (lStockMap[r.yarn_count_id][r.location_id] || 0) + w;
        });

        (globalDel || []).forEach(d => {
          const w = parseFloat(d.quantity_kg || 0);
          stockMap[d.yarn_count_id] = (stockMap[d.yarn_count_id] || 0) - w;
          
          if (!lStockMap[d.yarn_count_id]) lStockMap[d.yarn_count_id] = {};
          lStockMap[d.yarn_count_id][d.location_id] = (lStockMap[d.yarn_count_id][d.location_id] || 0) - w;
        });

        setGlobalStock(stockMap);
        setLocStock(lStockMap);
      }
    } catch (err) {
      console.error(err);
      alert('Error loading data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [dofId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Build count summary from DOF summary field ──
  const countSummary = React.useMemo(() => {
    if (!dof) return [];
    const summary = dof.summary || [];

    return summary.map(s => {
      const count = yarnCounts.find(c => c.id === s.countId);
      const required = parseFloat(s.total_kg || 0);

      // Sum already sent for this count + colour
      const sent = existingDeliveries
        .filter(d => d.yarn_count_id === s.countId && d.colour === s.colour)
        .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

      const balance = Math.max(0, required - sent);
      const isComplete = balance <= 0;

      return {
        countId: s.countId,
        colour: s.colour,
        countLabel: s.yarnLabel || formatCount(count),
        required_kg: required,
        sent_kg: sent,
        balance_kg: balance,
        isComplete,
        stock_available: globalStock[s.countId] || 0,
      };
    });
  }, [dof, yarnCounts, existingDeliveries, globalStock]);

  // ── Step 1 → Step 2 ──
  const startAllocation = () => {
    const fullAllocList = [];

    // Grouping by Order first as per request
    orders.forEach(order => {
      // Find all allocations for this order from DOF
      const ordAllocations = (dof?.yarn_allocations || []).filter(a => a.orderId === order.id);

      ordAllocations.forEach(a => {
        const count = yarnCounts.find(c => c.id === a.countId);
        const countLabel = formatCount(count);
        
        // Find best initial location with stock
        const sMap = locStock[a.countId] || {};
        const availableLocs = locations.filter(l => (sMap[l.id] || 0) > 0.01);

        // 1. Process match (Order + Type)
        const typeMatch = existingDeliveries.filter(d => d.order_id === order.id && d.yarn_count_id === a.countId && d.colour === a.colour && d.yarn_type === a.type).reduce((s, d) => s + parseFloat(d.quantity_kg || 0), 0);
        // 2. Legacy Order match (Order + No Type)
        const legacyMatch = existingDeliveries.filter(d => d.order_id === order.id && d.yarn_count_id === a.countId && d.colour === a.colour && !d.yarn_type).reduce((s, d) => s + parseFloat(d.quantity_kg || 0), 0);
        // 3. Unassigned Match (No Order)
        const unassignedMatch = existingDeliveries.filter(d => !d.order_id && d.yarn_count_id === a.countId && d.colour === a.colour).reduce((s, d) => s + parseFloat(d.quantity_kg || 0), 0);

        fullAllocList.push({
          orderId: order.id,
          orderNumber: order.order_number,
          countId: a.countId,
          colour: a.colour,
          countLabel,
          type: a.type,
          required_kg: parseFloat(a.total_kg || 0),
          already_allocated_kg: typeMatch + legacyMatch + unassignedMatch,
          delivered_qty: '',
          location_id: availableLocs[0]?.id || '',
        });
      });
    });

    // Handle any "General" or unassigned counts from summary that aren't in yarn_allocations?
    // Usually dof.summary and yarn_allocations are in sync.
    // If there's a count in summary not covered by orders, we can add a 'General' block.
    const summaryItems = dof.summary || [];
    summaryItems.forEach(s => {
      const totalInAllocations = fullAllocList
        .filter(i => i.countId === s.countId && i.colour === s.colour)
        .reduce((sum, i) => sum + i.required_kg, 0);
      
      const diff = parseFloat(s.total_kg || 0) - totalInAllocations;
      if (diff > 0.01) {
        const count = yarnCounts.find(c => c.id === s.countId);
        const sMap = locStock[s.countId] || {};
        const availableLocs = locations.filter(l => (sMap[l.id] || 0) > 0.01);

        // Calculate historical for General items
        const alreadyAllocated = existingDeliveries
          .filter(d => 
            d.order_id === null && 
            d.yarn_count_id === s.countId && 
            d.colour === s.colour
          )
          .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

        fullAllocList.push({
          orderId: null,
          orderNumber: 'Miscellaneous / General',
          countId: s.countId,
          colour: s.colour,
          countLabel: s.yarnLabel || formatCount(count),
          type: 'general',
          required_kg: diff,
          already_allocated_kg: alreadyAllocated,
          delivered_qty: '',
          location_id: availableLocs[0]?.id || '',
        });
      }
    });

    // Final Sort within the list: Sort by orderNumber, then by type (warp before weft)
    fullAllocList.sort((a, b) => {
      if (a.orderNumber !== b.orderNumber) return 0; // Keep order grouping
      if (a.type === 'warp' && b.type === 'weft') return -1;
      if (a.type === 'weft' && b.type === 'warp') return 1;
      return 0;
    });

    setAllAllocItems(fullAllocList);
    setAllocError('');
    setView('allocation');
  };

  const updateAllocItem = (idx, field, value) => {
    setAllAllocItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    setAllocError('');
  };

  const validateAll = () => {
    const totalEntering = allAllocItems.reduce((s, i) => s + parseFloat(i.delivered_qty || 0), 0);
    if (totalEntering <= 0) {
      setAllocError('Please enter at least some quantity to deliver.');
      return false;
    }

    // Validate per-count balances
    for (const summaryRow of countSummary) {
      const enteringForThis = allAllocItems
        .filter(i => i.countId === summaryRow.countId && i.colour === summaryRow.colour)
        .reduce((s, i) => s + parseFloat(i.delivered_qty || 0), 0);
      
      if (enteringForThis > summaryRow.balance_kg + 0.001) {
        setAllocError(`${summaryRow.countLabel} (${summaryRow.colour}): Total entering (${enteringForThis.toFixed(2)}kg) exceeds DOF balance (${summaryRow.balance_kg.toFixed(2)}kg).`);
        return false;
      }

      if (enteringForThis > summaryRow.stock_available + 0.001) {
        setAllocError(`${summaryRow.countLabel} (${summaryRow.colour}): Total entering (${enteringForThis.toFixed(2)}kg) exceeds available warehouse stock (${summaryRow.stock_available.toFixed(2)}kg).`);
        return false;
      }
    }

    // Validate locations AND per-location stock
    for (const item of allAllocItems) {
      const qty = parseFloat(item.delivered_qty || 0);
      if (qty <= 0) continue;

      if (!item.location_id) {
        setAllocError('Please select a location for items with quantity.');
        return false;
      }

      const availableInLoc = (locStock[item.countId] || {})[item.location_id] || 0;
      if (qty > availableInLoc + 0.001) {
        const loc = locations.find(l => l.id === item.location_id);
        setAllocError(`${item.countLabel} (${item.colour}): Qty (${qty.toFixed(2)}kg) exceeds stock available at ${loc?.location_name || 'selected location'} (${availableInLoc.toFixed(2)}kg).`);
        return false;
      }
    }

    return true;
  };

  const handleCreateDelivery = () => {
    if (!validateAll()) return;
    const itemsToSave = allAllocItems
      .filter(i => parseFloat(i.delivered_qty || 0) > 0)
      .map(i => ({
        ...i,
        quantity_kg: parseFloat(i.delivered_qty)
      }));
    setLogisticsModal({ items: itemsToSave });
  };

  // ── Save Delivery ──
  const handleSaveDelivery = async () => {
    if (!deliveredBy.trim()) { alert('Please enter the person name.'); return; }
    if (!logisticsModal) return;

    setSaving(true);
    try {
      const year = new Date().getFullYear();

      // 1) Generate GYDR number
      const { data: gydrNum, error: numErr } = await supabase.rpc('get_next_gydr_number', { p_year: year });
      if (numErr) throw numErr;

      // 2) Insert header receipt
      const { data: receiptData, error: receiptErr } = await supabase
        .from('greige_yarn_delivery_receipts')
        .insert({
          gydr_number: gydrNum,
          dof_id: dofId,
          dof_number: dof.dof_number,
          delivered_by: deliveredBy.trim(),
          vehicle_no: vehicleNo.trim() || null,
          created_by: profile?.id,
        })
        .select()
        .single();
      if (receiptErr) throw receiptErr;

      // 3) Insert line items
      const lineItems = logisticsModal.items.map(item => ({
        receipt_id: receiptData.id,
        yarn_count_id: item.countId,
        colour: item.colour,
        quantity_kg: item.quantity_kg,
        location_id: item.location_id || null,
        order_id: item.orderId || null,
        yarn_type: item.type,
      }));
      const { error: itemsErr } = await supabase
        .from('greige_yarn_delivery_items')
        .insert(lineItems);
      if (itemsErr) throw itemsErr;

      // 4) Recalculate DOF status
      // Re-fetch all delivery items for this DOF after insert
      const { data: allReceiptsData } = await supabase
        .from('greige_yarn_delivery_receipts')
        .select(`greige_yarn_delivery_items(yarn_count_id, colour, quantity_kg)`)
        .eq('dof_id', dofId);

      const allDeliveryItems = (allReceiptsData || []).flatMap(r => r.greige_yarn_delivery_items || []);

      // Compare with DOF summary
      const dofSummary = dof.summary || [];
      let allFullySent = true;
      let anySent = false;

      for (const s of dofSummary) {
        const totalSentForThis = allDeliveryItems
          .filter(d => d.yarn_count_id === s.countId && d.colour === s.colour)
          .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);
        const required = parseFloat(s.total_kg || 0);
        if (totalSentForThis > 0) anySent = true;
        if (totalSentForThis < required - 0.001) allFullySent = false;
      }

      const newStatus = allFullySent ? 'fully_sent' : anySent ? 'partially_sent' : 'approved';
      await supabase
        .from('dyeing_order_forms')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', dofId);

      // 5) Navigate to receipt view
      setLogisticsModal(null);
      setAllAllocItems([]);
      setDeliveredBy('');
      setVehicleNo('');
      setView('summary');
      setSaving(false);

      // Refresh data and show receipt
      await fetchAll();
      setViewReceiptModal(receiptData.id);

    } catch (err) {
      setSaving(false);
      console.error(err);
      alert('Error saving delivery: ' + err.message);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <Loader size={32} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ color: 'var(--text-muted-current)' }}>Loading Dyeing Order Form...</p>
    </div>
  );

  if (!dof) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <p>Order Form not found.</p>
      <button onClick={() => navigate('/greige-yarn/deliveries')} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
        ← Back
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }} className="fade-in">
      {view === 'summary' ? (
        <>
          {/* Header */}
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              onClick={() => navigate('/greige-yarn/deliveries')}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', padding: '0', marginBottom: '0.75rem' }}
            >
              <ArrowLeft size={16} /> Back to Deliveries
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.25rem 0', color: 'var(--text-current)', fontWeight: 'bold' }}>
                  Deliver Yarn: <span style={{ color: 'var(--color-primary)' }}>{dof.dof_number}</span>
                </h1>
                <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
                  Dyeing Unit: <strong>{dof.dyeing_unit?.partner_name || 'Not set'}</strong>
                  {orders.length > 0 && <> &nbsp;·&nbsp; Orders: <strong>{orders.map(o => o.order_number).join(', ')}</strong></>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button
                  onClick={startAllocation}
                  disabled={countSummary.every(r => r.isComplete)}
                  style={{ backgroundColor: '#7f1d1d', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(127, 29, 29, 0.2)' }}
                >
                  Deliver Yarn <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Summary Table ── */}
          <div className="glass-panel" style={{ padding: 0, marginBottom: '2rem' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-current)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Package size={20} color="var(--color-primary)" />
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>Count Delivery Summary</h2>
            </div>
            <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
              <table className="table" style={{ fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th>Count (Full Label)</th>
                    <th>Colour</th>
                    <th style={{ textAlign: 'right' }}>Required (kg)</th>
                    <th style={{ textAlign: 'right' }}>Sent (kg)</th>
                    <th style={{ textAlign: 'right' }}>Balance (kg)</th>
                    <th style={{ textAlign: 'center' }}>Warehouse Stock</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {countSummary.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: '600' }}>{row.countLabel}</td>
                      <td>{row.colour}</td>
                      <td style={{ textAlign: 'right' }}>{row.required_kg.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: '700' }}>{row.sent_kg.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: row.balance_kg > 0 ? '#dc2626' : '#16a34a' }}>
                        {row.balance_kg.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: '700', color: row.stock_available > 0 ? '#16a34a' : '#94a3b8' }}>
                          {row.stock_available.toFixed(2)} kg
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {row.isComplete ? (
                          <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>COMPLETE</span>
                        ) : (
                          <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>PENDING</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Receipts ── */}
          {existingReceipts.length > 0 && (
            <div className="glass-panel" style={{ padding: 0 }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-current)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={20} color="var(--color-primary)" />
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>Delivery History</h2>
              </div>
              <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
                <table className="table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>GYDR No.</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th style={{ textAlign: 'right' }}>Total Weight</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingReceipts.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: '700', color: 'var(--color-primary)' }}>{r.gydr_number}</td>
                        <td>{new Date(r.created_at).toLocaleDateString()}</td>
                        <td>
                          {r.greige_yarn_delivery_items?.length} items
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '700' }}>
                          {(r.greige_yarn_delivery_items || []).reduce((s, i) => s + parseFloat(i.quantity_kg), 0).toFixed(2)} kg
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button onClick={() => setViewReceiptModal(r.id)} style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── NEXT PAGE: ALLOCATION STEP ── */
        <div className="fade-in">
          <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <button
                onClick={() => setView('summary')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted-current)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', padding: 0, marginBottom: '0.5rem' }}
              >
                <ArrowLeft size={16} /> Back to Summary
              </button>
              <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 'bold' }}>Step 2: Allocate Yarn for Delivery</h1>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted-current)' }}>{dof.dof_number} · Entering delivery weights per count and order</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Total Delivery Weight</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#7f1d1d' }}>
                {allAllocItems.reduce((s, i) => s + parseFloat(i.delivered_qty || 0), 0).toFixed(2)} <span style={{ fontSize: '1rem' }}>kg</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Get unique order numbers from allAllocItems to maintain grouping */}
            {[...new Set(allAllocItems.map(i => i.orderNumber))].map((ordNum, oIdx) => {
              const itemsForOrder = allAllocItems.filter(i => i.orderNumber === ordNum);
              
              return (
                <div key={oIdx} className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#fcfaf9', borderBottom: '1px solid var(--border-current)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#7f1d1d', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '800' }}>
                      ORDER: {ordNum}
                    </div>
                  </div>
                  <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
                    <table className="table" style={{ fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th>Yarn Count & Colour</th>
                          <th style={{ width: '100px' }}>Type</th>
                          <th style={{ textAlign: 'right', width: '120px' }}>Required (kg)</th>
                          <th style={{ textAlign: 'right', width: '120px', color: '#64748b' }}>Already Allocated</th>
                          <th style={{ width: '180px' }}>Qty to Deliver (kg)</th>
                          <th style={{ width: '280px' }}>From Location (Available Stock)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allAllocItems.map((item, aIdx) => {
                          if (item.orderNumber !== ordNum) return null;
                          
                          // Filter locations for this specific count
                          const sMap = locStock[item.countId] || {};
                          const availableLocs = locations.filter(l => (sMap[l.id] || 0) > 0.001);

                          return (
                            <tr key={aIdx}>
                              <td>
                                <div style={{ fontWeight: '700' }}>{item.countLabel}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: '600' }}>{item.colour}</div>
                              </td>
                              <td style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{item.type}</td>
                              <td style={{ textAlign: 'right', fontWeight: '600' }}>{item.required_kg.toFixed(2)}</td>
                              <td style={{ textAlign: 'right', fontWeight: '700', color: '#64748b' }}>
                                {item.already_allocated_kg.toFixed(2)} kg
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="input-field"
                                  placeholder="0.00"
                                  value={item.delivered_qty}
                                  onChange={(e) => updateAllocItem(aIdx, 'delivered_qty', e.target.value)}
                                  style={{ width: '100%', padding: '6px 12px' }}
                                />
                              </td>
                              <td>
                                <select
                                  className="input-field"
                                  value={item.location_id}
                                  onChange={(e) => updateAllocItem(aIdx, 'location_id', e.target.value)}
                                  style={{ width: '100%', padding: '6px 12px', borderColor: availableLocs.length === 0 ? '#fca5a5' : 'var(--border-current)' }}
                                >
                                  <option value="">Select Location</option>
                                  {availableLocs.map(loc => {
                                    const stockAtLoc = sMap[loc.id] || 0;
                                    return (
                                      <option key={loc.id} value={loc.id}>
                                        {loc.location_name} ({stockAtLoc.toFixed(2)} kg)
                                      </option>
                                    );
                                  })}
                                </select>
                                {availableLocs.length === 0 && (
                                  <div style={{ fontSize: '0.7rem', color: '#b91c1c', marginTop: '4px', fontWeight: '700' }}>
                                    ⚠ Out of stock in all locations
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* ERROR ALERT */}
            {allocError && (
              <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#b91c1c', fontWeight: '600', fontSize: '0.9rem' }}>
                <AlertTriangle size={20} />
                {allocError}
              </div>
            )}

            {/* SUBMIT SECTION */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                onClick={() => setView('summary')}
                style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid var(--border-current)', backgroundColor: '#fff', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDelivery}
                style={{ backgroundColor: '#7f1d1d', color: '#fff', border: 'none', padding: '10px 32px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(127, 29, 29, 0.2)' }}
              >
                Create Receipt →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          LOGISTICS MODAL
      ═══════════════════════════════════════════════════ */}
      {logisticsModal && !allocateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--surface-current)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-current)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>
                <Truck size={18} style={{ display: 'inline', marginRight: '8px', color: '#7f1d1d' }} />
                Delivery Logistics
              </h2>
              <button onClick={() => setLogisticsModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted-current)' }}><X size={20} /></button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {/* Delivery Summary */}
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.78rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Delivery Summary</p>
                {logisticsModal.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#475569' }}>{item.countLabel} · {item.colour}</span>
                    <span style={{ fontWeight: '700', color: '#7f1d1d' }}>{item.quantity_kg.toFixed(2)} kg</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', paddingTop: '8px', fontWeight: '800' }}>
                  <span>Total</span>
                  <span style={{ color: '#7f1d1d' }}>{logisticsModal.items.reduce((s, i) => s + i.quantity_kg, 0).toFixed(2)} kg</span>
                </div>
              </div>

              {/* Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted-current)', display: 'block', marginBottom: '0.4rem' }}>
                    <User size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    Delivered By (Person Name) *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Enter person name"
                    value={deliveredBy}
                    onChange={e => setDeliveredBy(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted-current)', display: 'block', marginBottom: '0.4rem' }}>
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. TN01AB1234 (optional)"
                    value={vehicleNo}
                    onChange={e => setVehicleNo(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-current)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: '#f8fafc', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
              <button onClick={() => setLogisticsModal(null)} style={{ padding: '0.6rem 1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-current)', background: 'none', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleSaveDelivery}
                disabled={saving}
                style={{ padding: '0.6rem 1.5rem', borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: '#7f1d1d', color: '#fff', fontSize: '0.875rem', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
                {saving ? 'Saving...' : 'OK — Create GYDR Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          VIEW RECEIPT MODAL
      ═══════════════════════════════════════════════════ */}
      {viewReceiptModal && (
        <GYDRReceiptModal
          receiptId={viewReceiptModal}
          dof={dof}
          orders={orders}
          allReceipts={existingReceipts}
          onClose={() => setViewReceiptModal(null)}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Inline GYDR Receipt Modal (Printable)
// ──────────────────────────────────────────────
function GYDRReceiptModal({ receiptId, dof, orders, allReceipts, onClose }) {
  const receipt = allReceipts.find(r => r.id === receiptId);

  if (!receipt) return null;

  const items = receipt.greige_yarn_delivery_items || [];
  const totalQty = items.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        {/* Screen-only buttons */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: '#374151' }}>
            Greige Yarn Delivery Receipt — {receipt.gydr_number}
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => window.print()}
              style={{ padding: '6px 16px', backgroundColor: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
            >
              🖨 Print Receipt
            </button>
            <button onClick={onClose} style={{ padding: '6px 16px', backgroundColor: '#e2e8f0', color: '#374151', border: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div className="print-container" style={{ padding: '2rem 2.5rem', fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: '13px', color: '#111' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #7f1d1d', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <img src="/logo.png" alt="Logo" style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain' }}
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
              <div style={{ display: 'none' }}>
                <h2 style={{ margin: 0, color: '#7f1d1d', fontSize: '1.35rem', fontWeight: '900' }}>ASHOK TEXTILES</h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#555' }}>Fabric Manufacturing ERP</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: '#7f1d1d' }}>GREIGE YARN DELIVERY RECEIPT</h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '1.05rem', fontWeight: '700', color: '#111' }}>{receipt.gydr_number}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#666' }}>
                Date: {new Date(receipt.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Meta Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem' }}>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: '700', color: '#888', textTransform: 'uppercase' }}>Delivery Details</p>
              {[
                ['DOF Number', dof?.dof_number || receipt.dof_number],
                ['Dyeing Unit', dof?.dyeing_unit?.partner_name || '-'],
                ['Delivered By', receipt.delivered_by],
                ['Vehicle No', receipt.vehicle_no || '-'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', fontSize: '12px' }}>
                  <span style={{ color: '#555', minWidth: '110px', flexShrink: 0 }}>{label}:</span>
                  <span style={{ fontWeight: '600' }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem' }}>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: '700', color: '#888', textTransform: 'uppercase' }}>Linked Orders</p>
              {orders.length > 0 ? orders.map(o => (
                <div key={o.id} style={{ fontSize: '12px', marginBottom: '0.3rem' }}>
                  <span style={{ fontWeight: '700', color: '#7f1d1d' }}>{o.order_number}</span>
                  {o.design_no && <span style={{ color: '#555' }}> — {o.design_no}</span>}
                </div>
              )) : <span style={{ fontSize: '12px', color: '#888' }}>No linked orders</span>}
            </div>
          </div>

          {/* Delivery Items Table */}
          <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#7f1d1d', borderBottom: '1px solid #7f1d1d', paddingBottom: '4px', marginBottom: '0.75rem' }}>
            Yarn Delivery Details
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>S.No</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Yarn Count</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Colour</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Location</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700' }}>Quantity (kg)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{i + 1}</td>
                  <td style={{ padding: '6px 10px', fontSize: '12px', fontWeight: '600' }}>
                    {item.master_yarn_counts
                      ? `${item.master_yarn_counts.count_value} - ${item.master_yarn_counts.material} - ${item.master_yarn_counts.product_type}`
                      : '-'}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{item.colour}</td>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{item.master_locations?.location_name || '-'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', fontSize: '12px' }}>{parseFloat(item.quantity_kg).toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #7f1d1d' }}>
                <td colSpan={4} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', fontSize: '12px' }}>TOTAL:</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#7f1d1d', fontSize: '13px' }}>{totalQty.toFixed(2)} kg</td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '180px', borderTop: '1px solid #000', paddingTop: '8px', marginTop: '40px' }}>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '12px' }}>{receipt.delivered_by}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#666' }}>Delivered By</p>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '180px', borderTop: '1px solid #000', paddingTop: '8px', marginTop: '40px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>Received By</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#888' }}>Signature</p>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '180px', borderTop: '1px solid #000', paddingTop: '8px', marginTop: '40px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>Authorised Signatory</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#888' }}>Managing Partner</p>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-container, .print-container * { visibility: visible; }
            .print-container { position: absolute; left: 0; top: 0; width: 100%; padding: 1.5rem 2rem; box-shadow: none; border: none; }
            .no-print { display: none !important; }
            @page { margin: 1.5cm; size: A4; }
          }
        `}</style>
      </div>
    </div>
  );
}
