import React, { useState, useEffect, useMemo } from 'react';
import { Loader, ExternalLink, Calculator, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function OrderYarnUsageTab({ order, onViewGYDR, onViewDYRR, onViewDYDR }) {
  const [loading, setLoading] = useState(true);
  const [yarnCounts, setYarnCounts] = useState([]);
  
  // Data lists
  const [gydi, setGydi] = useState([]);
  const [greigeReturns, setGreigeReturns] = useState([]);
  const [dyri, setDyri] = useState([]);
  const [dydi, setDydi] = useState([]);
  const [gydrs, setGydrs] = useState([]);
  const [dyrrs, setDyrrs] = useState([]);
  const [dydrs, setDydrs] = useState([]);
  const [wofs, setWofs] = useState([]);
  const [weavings, setWeavings] = useState([]);

  // Expanded rows state (Level 1 count+colour)
  const [expandedRowKeys, setExpandedRowKeys] = useState(new Set());
  // Expanded form keys state (Level 2 WOF/WVOF)
  const [expandedFormKeys, setExpandedFormKeys] = useState(new Set());
  
  const handleToggleExpand = (key) => {
    const next = new Set(expandedRowKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedRowKeys(next);
  };

  const handleToggleFormExpand = (key) => {
    const next = new Set(expandedFormKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedFormKeys(next);
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // 1. Fetch Yarn Counts, Warping Order Forms, and Weaving Orders in parallel
        const [countsRes, wofsRes, weavingsRes] = await Promise.all([
          supabase.from('master_yarn_counts').select('*'),
          supabase.from('warping_order_forms').select('*, machine:master_machines(machine_name), partner:master_partners(partner_name)').eq('order_id', order.id),
          supabase.from('weaving_orders').select('*, machine:master_machines(machine_name), partner:master_partners(partner_name)').eq('order_id', order.id)
        ]);
        setYarnCounts(countsRes.data || []);
        const wofsData = wofsRes.data || [];
        const weavingsData = weavingsRes.data || [];
        setWofs(wofsData);
        setWeavings(weavingsData);
        const wofsMap = new Map(wofsData.map(w => [w.id, w]));
        const weavingsMap = new Map(weavingsData.map(w => [w.id, w]));

        // 2. Fetch Greige Deliveries
        const { data: gydiData } = await supabase
          .from('greige_yarn_delivery_items')
          .select('*, receipt:greige_yarn_delivery_receipts(*, dof:dyeing_order_forms(*, dyeing_unit:master_partners(partner_name)))')
          .eq('order_id', order.id);
        setGydi(gydiData || []);

        // Group unique GYDR receipts for the list
        const uniqueGydrIds = Array.from(new Set(gydiData?.map(i => i.receipt?.id))).filter(Boolean);
        const uniqueGydr = uniqueGydrIds.map(id => gydiData.find(i => i.receipt?.id === id).receipt);
        setGydrs(uniqueGydr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

        // 3. Fetch Greige Returns (receipts from dyeing)
        const { data: grData } = await supabase
          .from('greige_yarn_receipts')
          .select('*')
          .eq('receipt_type', 'production')
          .eq('order_id', order.id);
        setGreigeReturns(grData || []);

        // 4. Fetch Dyed Receipts
        const { data: dyriData } = await supabase
          .from('dyed_yarn_receipt_items')
          .select('*, receipt:dyed_yarn_receipts(*, dyeing_unit:master_partners(partner_name)), location:master_locations(location_name)')
          .eq('order_id', order.id);
        setDyri(dyriData || []);

        // Group unique DYRR receipts for the list
        const uniqueDyrrIds = Array.from(new Set(dyriData?.map(i => i.receipt?.id))).filter(Boolean);
        const uniqueDyrr = uniqueDyrrIds.map(id => {
          const receipt = dyriData.find(i => i.receipt?.id === id).receipt;
          return {
            ...receipt,
            partnerName: receipt.source_type === 'production' ? 'In-House' : (receipt.dyeing_unit?.partner_name || 'In-House'),
            dofNo: receipt.dof_number || 'N/A'
          };
        });
        setDyrrs(uniqueDyrr.sort((a, b) => new Date(b.created_at || b.received_date).getTime() - new Date(a.created_at || a.received_date).getTime()));

        // 5. Fetch Dyed Deliveries to production
        const { data: dydiData } = await supabase
          .from('dyed_yarn_delivery_items')
          .select('*, delivery:dyed_yarn_deliveries(*, dyeing_unit:master_partners(partner_name)), location:master_locations(location_name)')
          .eq('order_id', order.id);
        setDydi(dydiData || []);

        // Group unique DYDR receipts for the list
        const uniqueDydrIds = Array.from(new Set(dydiData?.map(i => i.delivery?.id))).filter(Boolean);
        const uniqueDydr = uniqueDydrIds.map(id => {
          const item = dydiData.find(i => i.delivery?.id === id);
          const delivery = item.delivery;
          
          let targetFormNo = '—';
          if (item.process_type === 'warping') {
            const wof = wofsMap.get(item.production_form_id);
            if (wof) targetFormNo = wof.wof_number;
          } else if (item.process_type === 'weaving') {
            const weaving = weavingsMap.get(item.production_form_id);
            if (weaving) targetFormNo = weaving.weaving_number;
          } else if (item.process_type === 'redyeing' || delivery?.delivery_type === 'redyeing') {
            targetFormNo = delivery?.dof_number || '—';
          }

          const isRedyeing = item.process_type === 'redyeing' || delivery?.delivery_type === 'redyeing';
          const partnerName = isRedyeing ? (delivery?.dyeing_unit?.partner_name || 'In-House') : 'In-House';

          return {
            ...delivery,
            targetFormNo,
            partnerName
          };
        });
        setDydrs(uniqueDydr.sort((a, b) => new Date(b.created_at || b.delivered_date).getTime() - new Date(a.created_at || a.delivered_date).getTime()));

      } catch (err) {
        console.error('Error fetching yarn usage data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [order.id]);

  // Aggregate Yarn Usage Data
  const summaryData = useMemo(() => {
    const summary = {};

    // Helper to ensure summary key exists
    const ensureKey = (countId, colour, type) => {
      const key = `${countId}-${colour}-${type}`;
      if (!summary[key]) {
        summary[key] = {
          countId,
          colour,
          type,
          required: 0,
          sentToDyeing: 0,
          receivedFromDyeing: 0,
          sentToWarp: 0,
          receivedFromWarping: 0,
          sentToWeaving: 0,
          receivedFromWeaving: 0
        };
      }
      return key;
    };

    // A. Initialize summary with order requirements
    (order.yarn_requirements || []).forEach(yr => {
      const type = yr.type || 'warp';
      const key = ensureKey(yr.countId, yr.color, type);
      summary[key].required = parseFloat(yr.kg || 0);
    });

    // B. Accumulate Sent to Dyeing (Greige Deliveries)
    gydi.forEach(item => {
      const type = item.yarn_type || 'warp';
      const key = ensureKey(item.yarn_count_id, item.colour, type);
      summary[key].sentToDyeing += parseFloat(item.quantity_kg || 0);
    });

    // Deduct Greige Returns from Sent to Dyeing
    greigeReturns.forEach(ret => {
      const type = ret.yarn_type || 'warp';
      const key = `${ret.yarn_count_id}-${ret.colour}-${type}`;
      if (summary[key]) {
        summary[key].sentToDyeing = Math.max(0, summary[key].sentToDyeing - parseFloat(ret.total_weight || 0));
      }
    });

    // C. Accumulate Received from Dyeing (only non-excess, non-production-return receipts)
    dyri.forEach(item => {
      const type = item.yarn_type || 'warp';
      const isExcess = item.is_excess || item.receipt?.source_type === 'production';
      if (!isExcess) {
        const key = ensureKey(item.yarn_count_id, item.colour, type);
        summary[key].receivedFromDyeing += parseFloat(item.quantity_kg || 0);
      }
    });

    // Deduct redyeing deliveries from receivedFromDyeing
    dydi.forEach(item => {
      const isRedyeing = item.process_type === 'redyeing' || item.delivery?.delivery_type === 'redyeing';
      if (isRedyeing) {
        const type = item.yarn_type || 'warp';
        const key = `${item.yarn_count_id}-${item.colour}-${type}`;
        if (summary[key]) {
          summary[key].receivedFromDyeing = Math.max(0, summary[key].receivedFromDyeing - parseFloat(item.quantity_kg || 0));
        }
      }
    });

    // D. Accumulate Sent to Warp & Received from Warping
    // We sum up all dyed yarn deliveries (DYDI) to warping (excluding redyeing), and all production returns (DYRI) from warping
    dydi.forEach(item => {
      const isRedyeing = item.process_type === 'redyeing' || item.delivery?.delivery_type === 'redyeing';
      if (!isRedyeing && (item.process_type === 'warping' || item.yarn_type === 'warp')) {
        const type = 'warp';
        const key = ensureKey(item.yarn_count_id, item.colour, type);
        summary[key].sentToWarp += parseFloat(item.quantity_kg || 0);
      }
    });

    dyri.forEach(item => {
      const isExcess = item.is_excess || item.receipt?.source_type === 'production';
      if (isExcess && (item.yarn_type === 'warp')) {
        const key = ensureKey(item.yarn_count_id, item.colour, 'warp');
        summary[key].receivedFromWarping += parseFloat(item.quantity_kg || 0);
      }
    });

    // E. Accumulate Sent to Weaving & Received from Weaving
    // We sum up all dyed yarn deliveries (DYDI) to weaving (excluding redyeing), and all production returns (DYRI) from weaving
    dydi.forEach(item => {
      const isRedyeing = item.process_type === 'redyeing' || item.delivery?.delivery_type === 'redyeing';
      if (!isRedyeing && (item.process_type === 'weaving' || item.yarn_type === 'weft')) {
        const type = 'weft';
        const key = ensureKey(item.yarn_count_id, item.colour, type);
        summary[key].sentToWeaving += parseFloat(item.quantity_kg || 0);
      }
    });

    dyri.forEach(item => {
      const isExcess = item.is_excess || item.receipt?.source_type === 'production';
      if (isExcess && (item.yarn_type === 'weft')) {
        const key = ensureKey(item.yarn_count_id, item.colour, 'weft');
        summary[key].receivedFromWeaving += parseFloat(item.quantity_kg || 0);
      }
    });

    // F. Yarn returns from WOFs/Weavings are already captured via DYRI production receipts
    // in Section D/E above (is_excess / source_type === 'production'). Adding wof.yarn_returns
    // here would double-count them. So we skip explicit yarn_returns accumulation.

    // Convert to sorted list: Warp first, then Weft
    return Object.values(summary).sort((a, b) => {
      if (a.type === 'warp' && b.type !== 'warp') return -1;
      if (a.type !== 'warp' && b.type === 'warp') return 1;
      return 0;
    });

  }, [order.yarn_requirements, gydi, greigeReturns, dyri, dydi, wofs, weavings]);

  const formatCount = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    if (!y) return 'Unknown';
    return `${y.count_value} ${y.material}`;
  };

  const getRowInventory = (row) => {
    const matchingReceipts = dyri.filter(item => 
      item.yarn_count_id === row.countId && 
      item.colour === row.colour && 
      (item.yarn_type || 'warp') === row.type
    );

    const matchingDeliveries = dydi.filter(item => 
      item.yarn_count_id === row.countId && 
      item.colour === row.colour && 
      (item.yarn_type || (item.process_type === 'warping' ? 'warp' : 'weft')) === row.type
    );

    const groups = {};
    matchingReceipts.forEach(item => {
      const lot = item.lot_number || '—';
      const loc = item.location?.location_name || '—';
      const key = `${lot}||${loc}`;
      if (!groups[key]) {
        groups[key] = { lotNumber: lot, locationName: loc, received: 0, delivered: 0 };
      }
      groups[key].received += parseFloat(item.quantity_kg || 0);
    });

    matchingDeliveries.forEach(item => {
      const lot = item.lot_number || '—';
      let loc = item.location?.location_name || '—';

      // If the delivery item doesn't have a storage location (like redyeing deliveries),
      // look up the location from matchingReceipts of the same lot.
      if (loc === '—' && lot !== '—') {
        const matchingReceipt = matchingReceipts.find(r => (r.lot_number || '—') === lot);
        if (matchingReceipt && matchingReceipt.location?.location_name) {
          loc = matchingReceipt.location.location_name;
        }
      }

      const key = `${lot}||${loc}`;
      if (!groups[key]) {
        groups[key] = { lotNumber: lot, locationName: loc, received: 0, delivered: 0 };
      }
      groups[key].delivered += parseFloat(item.quantity_kg || 0);
    });

    return Object.values(groups)
      .map(g => ({
        ...g,
        balance: g.received - g.delivered
      }))
      .filter(g => g.balance > 0.001);
  };

  const getAllAvailableLots = () => {
    const groups = {};

    dyri.forEach(item => {
      const countId = item.yarn_count_id;
      const colour = item.colour || '—';
      const lot = item.lot_number || '—';
      const loc = item.location?.location_name || '—';
      const key = `${countId}||${colour}||${lot}||${loc}`;
      if (!groups[key]) {
        groups[key] = { countId, colour, lotNumber: lot, locationName: loc, received: 0, delivered: 0 };
      }
      groups[key].received += parseFloat(item.quantity_kg || 0);
    });

    dydi.forEach(item => {
      const countId = item.yarn_count_id;
      const colour = item.colour || '—';
      const lot = item.lot_number || '—';
      let loc = item.location?.location_name || '—';

      if (loc === '—' && lot !== '—') {
        const matchingReceipt = dyri.find(r => r.yarn_count_id === countId && r.colour === colour && (r.lot_number || '—') === lot);
        if (matchingReceipt && matchingReceipt.location?.location_name) {
          loc = matchingReceipt.location.location_name;
        }
      }

      const key = `${countId}||${colour}||${lot}||${loc}`;
      if (!groups[key]) {
        groups[key] = { countId, colour, lotNumber: lot, locationName: loc, received: 0, delivered: 0 };
      }
      groups[key].delivered += parseFloat(item.quantity_kg || 0);
    });

    // Subtracting returns from delivered is skipped here because returns are already counted in dyri
    // (with is_excess: true / source_type: 'production'), which increases groups[key].received.
    // Subtracting them again here would double-count the available stock balance.


    return Object.values(groups)
      .map(g => ({
        ...g,
        balance: g.received - g.delivered
      }))
      .filter(g => g.balance > 0.001)
      .sort((a, b) => {
        if (a.colour !== b.colour) return a.colour.localeCompare(b.colour);
        if (a.countId !== b.countId) return a.countId - b.countId;
        return a.lotNumber.localeCompare(b.lotNumber);
      });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted-current)', padding: '1rem 0' }}>
        <Loader size={16} className="spin" /> Loading Yarn Usage Summary...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* ── Summary Table ── */}
      <div>
        <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-current)', fontWeight: '800' }}>
          <Calculator size={18} color="var(--color-primary)" />
          Yarn Usage Statistics (Warp & Weft Details)
        </h4>
        
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current, #eee)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-current, #f9fafb)', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ width: '40px' }}></th>
                <th style={thStyle}>Yarn Count</th>
                <th style={thStyle}>Colour</th>
                <th style={numericThStyle}>Required (kg)</th>
                <th style={numericThStyle}>Sent to Dyeing (kg)</th>
                <th style={numericThStyle}>Rec. from Dyeing (kg)</th>
                <th style={numericThStyle}>Used (kg)</th>
                <th style={numericThStyle}>Available (kg)</th>
              </tr>
            </thead>
            <tbody>
              {summaryData.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                    No yarn allocations or specifications found for this order.
                  </td>
                </tr>
              ) : (
                summaryData.map((row, idx) => {
                  const showWarpHeader = idx === 0 && row.type === 'warp';
                  const showWeftHeader = row.type !== 'warp' && (idx === 0 || summaryData[idx - 1].type === 'warp');
                  const isWarp = row.type === 'warp';
                  const rowKey = `${row.countId}-${row.colour}-${row.type}`;
                  const isExpanded = expandedRowKeys.has(rowKey);
                  
                  const usedVal = isWarp 
                    ? (row.sentToWarp - row.receivedFromWarping)
                    : (row.sentToWeaving - row.receivedFromWeaving);
                  
                  const availableVal = row.receivedFromDyeing - usedVal;

                  return (
                    <React.Fragment key={idx}>
                      {(showWarpHeader || showWeftHeader) && (
                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                          <td colSpan="8" style={{ padding: '0.4rem 0.75rem', fontWeight: '800', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
                            {row.type === 'warp' ? 'Warp Yarn Details' : 'Weft Yarn Details'}
                          </td>
                        </tr>
                      )}
                      <tr 
                        onClick={() => handleToggleExpand(rowKey)}
                        style={{ borderBottom: '1px solid var(--border-current, #f3f4f6)', backgroundColor: '#fff', cursor: 'pointer' }}
                      >
                        <td style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>
                          {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--text-muted-current)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted-current)' }} />}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: '700', color: '#1e293b' }}>{formatCount(row.countId)}</td>
                        <td style={{ ...tdStyle, fontWeight: '700', color: 'var(--color-primary)' }}>{row.colour}</td>
                        <td style={numericTdStyle}>{row.required.toFixed(2)}</td>
                        <td style={{ ...numericTdStyle, color: '#4f46e5' }}>{row.sentToDyeing.toFixed(2)}</td>
                        <td style={{ ...numericTdStyle, color: '#16a34a' }}>{row.receivedFromDyeing.toFixed(2)}</td>
                        
                        {/* Used Column (delivered - returned) */}
                        <td style={{ ...numericTdStyle, color: '#d97706' }}>
                          {usedVal.toFixed(2)}
                        </td>

                        {/* Available Column */}
                        <td style={{ ...numericTdStyle, color: availableVal > 0.001 ? '#16a34a' : 'inherit' }}>
                          {availableVal.toFixed(2)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ backgroundColor: '#fafafa' }}>
                          <td colSpan="8" style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid var(--color-primary)', borderBottom: '1px solid var(--border-current)' }}>
                            <div>
                              <h6 style={{ margin: '0 0 0.8rem 0', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Calculator size={14} />
                                Order Forms Yarn Usage & Allotment Details ({row.colour})
                              </h6>
                              {(() => {
                                // Filter WOFs or WVOFs
                                const forms = row.type === 'warp'
                                  ? wofs.filter(wof => {
                                      const hasAllotment = (wof.colour_allotments || []).some(a => a.countId === row.countId && a.colour === row.colour);
                                      const hasDelivery = dydi.some(dItem => 
                                        dItem.production_form_id === wof.id && 
                                        dItem.process_type === 'warping' && 
                                        dItem.yarn_count_id === row.countId && 
                                        dItem.colour === row.colour
                                      );
                                      return hasAllotment || hasDelivery;
                                    })
                                  : weavings.filter(wvof => {
                                      const hasAllotment = (wvof.weft_allotments || []).some(a => 
                                        (a.countId === row.countId || a.yarn_count_id === row.countId) && a.colour === row.colour
                                      );
                                      const hasDelivery = dydi.some(dItem => 
                                        dItem.production_form_id === wvof.id && 
                                        dItem.process_type === 'weaving' && 
                                        dItem.yarn_count_id === row.countId && 
                                        dItem.colour === row.colour
                                      );
                                      return hasAllotment || hasDelivery;
                                    });

                                if (forms.length === 0) {
                                  return (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                      No warping or weaving order forms associated with this yarn count and colour.
                                    </div>
                                  );
                                }

                                return (
                                  <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                                          <th style={{ width: '32px' }}></th>
                                          <th style={subThStyle}>Date</th>
                                          <th style={subThStyle}>Order Form Number</th>
                                          <th style={subThStyle}>In House or Partner</th>
                                          <th style={subThStyle}>Name</th>
                                          <th style={subThStyle}>Machine</th>
                                          <th style={subNumericThStyle}>Allotted Qty (kg)</th>
                                          <th style={subNumericThStyle}>Delivered Qty (kg)</th>
                                          <th style={subNumericThStyle}>Used Qty (kg)</th>
                                          <th style={subNumericThStyle}>Returned Qty (kg)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {forms.map((form) => {
                                          const formKey = `${row.countId}-${row.colour}-${row.type}-${form.id}`;
                                          const isFormExpanded = expandedFormKeys.has(formKey);

                                          // Calculate quantities
                                          const allottedQty = row.type === 'warp'
                                            ? (form.colour_allotments || []).filter(a => a.countId === row.countId && a.colour === row.colour).reduce((sum, a) => sum + parseFloat(a.allotted_qty || 0), 0)
                                            : (form.weft_allotments || []).filter(a => (a.countId === row.countId || a.yarn_count_id === row.countId) && a.colour === row.colour).reduce((sum, a) => sum + parseFloat(a.allotted_qty || a.qty || 0), 0);

                                          const deliveredQty = dydi.filter(d => 
                                            d.production_form_id === form.id && 
                                            d.yarn_count_id === row.countId && 
                                            d.colour === row.colour
                                          ).reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

                                          const returnedQty = form.yarn_returns 
                                            ? (form.yarn_returns || []).filter(r => (r.yarn_count_id === row.countId || r.countId === row.countId) && r.colour === row.colour).reduce((sum, r) => sum + parseFloat(r.quantity_returned || 0), 0)
                                            : 0;

                                          const usedQty = form.yarn_returns ? (deliveredQty - returnedQty) : deliveredQty;

                                          const inHouseOrPartnerLabel = row.type === 'warp'
                                            ? (form.wof_type === 'in_house' ? 'In-House' : 'Partner')
                                            : (form.weaving_type === 'in_house' ? 'In-House' : 'Partner');

                                          const partnerNameDisplay = form.partner?.partner_name || (inHouseOrPartnerLabel === 'In-House' ? '—' : '—');
                                          const machineNameDisplay = form.machine?.machine_name || '—';
                                          const formattedDate = new Date(form.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                                          // Get matching delivery items for level 2 breakdown
                                          const matchingDydi = dydi.filter(d => 
                                            d.production_form_id === form.id && 
                                            d.yarn_count_id === row.countId && 
                                            d.colour === row.colour
                                          );

                                          return (
                                            <React.Fragment key={formKey}>
                                              <tr 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleToggleFormExpand(formKey);
                                                }}
                                                style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: isFormExpanded ? '#fdf8f8' : '#fff', cursor: 'pointer' }}
                                              >
                                                <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem', color: '#94a3b8' }}>
                                                  {isFormExpanded ? <ChevronDown size={13} style={{ color: 'var(--color-primary)' }} /> : <ChevronRight size={13} style={{ color: 'var(--text-muted-current)' }} />}
                                                </td>
                                                <td style={subTdStyle}>{formattedDate}</td>
                                                <td style={{ ...subTdStyle, fontWeight: '700', color: '#1e293b' }}>{form.wof_number || form.weaving_number}</td>
                                                <td style={subTdStyle}>{inHouseOrPartnerLabel}</td>
                                                <td style={subTdStyle}>{partnerNameDisplay}</td>
                                                <td style={subTdStyle}>{machineNameDisplay}</td>
                                                <td style={subNumericTdStyle}>{allottedQty.toFixed(2)}</td>
                                                <td style={{ ...subNumericTdStyle, color: '#2563eb' }}>{deliveredQty.toFixed(2)}</td>
                                                <td style={{ ...subNumericTdStyle, color: '#d97706' }}>{usedQty.toFixed(2)}</td>
                                                <td style={{ ...subNumericTdStyle, color: returnedQty > 0 ? '#b91c1c' : '#475569' }}>{returnedQty.toFixed(2)}</td>
                                              </tr>
                                              {isFormExpanded && (
                                                <tr style={{ backgroundColor: '#fffdfd' }}>
                                                  <td colSpan="10" style={{ padding: '0.75rem 1.25rem', borderLeft: '3px dashed var(--color-primary)', borderBottom: '1px solid #e2e8f0' }}>
                                                    <div style={{ maxWidth: '850px' }}>
                                                      <h6 style={{ margin: '0 0 0.5rem 0', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                        <Calculator size={13} />
                                                        Lot & Delivery Details (Level 2 Breakdown)
                                                      </h6>
                                                      <div style={{ border: '1px solid #fca5a5', borderRadius: '6px', overflow: 'hidden' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                                                          <thead>
                                                            <tr style={{ backgroundColor: '#fef2f2', borderBottom: '1px solid #fca5a5', textAlign: 'left' }}>
                                                              <th style={level2ThStyle}>DYDR</th>
                                                              <th style={level2ThStyle}>Colour</th>
                                                              <th style={level2ThStyle}>Count</th>
                                                              <th style={level2ThStyle}>Lot</th>
                                                              <th style={level2NumericThStyle}>Allotted</th>
                                                              <th style={level2NumericThStyle}>Delivered</th>
                                                              <th style={level2NumericThStyle}>Used</th>
                                                              <th style={level2NumericThStyle}>Returned</th>
                                                            </tr>
                                                          </thead>
                                                          <tbody>
                                                            {(() => {
                                                              if (matchingDydi.length === 0) {
                                                                return (
                                                                  <tr>
                                                                    <td style={level2TdStyle}>—</td>
                                                                    <td style={{ ...level2TdStyle, fontWeight: '700', color: 'var(--color-primary)' }}>{row.colour}</td>
                                                                    <td style={level2TdStyle}>{formatCount(row.countId)}</td>
                                                                    <td style={level2TdStyle}>—</td>
                                                                    <td style={level2NumericTdStyle}>{allottedQty.toFixed(2)}</td>
                                                                    <td style={level2NumericTdStyle}>0.00</td>
                                                                    <td style={level2NumericTdStyle}>0.00</td>
                                                                    <td style={level2NumericTdStyle}>0.00</td>
                                                                  </tr>
                                                                );
                                                              }

                                                              // Build rows for matching deliveries
                                                              const rows = matchingDydi.map((item) => {
                                                                const lotReturn = form.yarn_returns 
                                                                  ? (form.yarn_returns || []).find(r => 
                                                                      (r.yarn_count_id === item.yarn_count_id || r.countId === item.yarn_count_id) && 
                                                                      r.colour === item.colour && 
                                                                      (r.lot_number || '—') === (item.lot_number || '—')
                                                                    )
                                                                  : null;

                                                                const retVal = lotReturn ? parseFloat(lotReturn.quantity_returned || 0) : 0;
                                                                const delVal = parseFloat(item.quantity_kg || 0);
                                                                const usdVal = form.yarn_returns ? (delVal - retVal) : delVal;

                                                                const lotAllottedQty = row.type === 'warp'
                                                                  ? delVal
                                                                  : (() => {
                                                                      const lotAllotment = (form.weft_allotments || []).find(a => 
                                                                        (a.countId === row.countId || a.yarn_count_id === row.countId) && 
                                                                        a.colour === row.colour && 
                                                                        (a.lot_number === item.lot_number || (!a.lot_number && !item.lot_number) || (a.lot_number === '—' && !item.lot_number) || (item.lot_number === '—' && !a.lot_number))
                                                                      );
                                                                      return lotAllotment ? parseFloat(lotAllotment.allotted_qty || lotAllotment.qty || 0) : 0;
                                                                    })();

                                                                return (
                                                                  <tr key={item.id} style={{ borderBottom: '1px solid #fee2e2', backgroundColor: '#fff' }}>
                                                                    <td style={{ ...level2TdStyle, fontWeight: '700', color: '#800000' }}>{item.delivery?.dydr_number || '—'}</td>
                                                                    <td style={level2TdStyle}>{item.colour}</td>
                                                                    <td style={level2TdStyle}>{formatCount(item.yarn_count_id)}</td>
                                                                    <td style={{ ...level2TdStyle, fontWeight: '600' }}>{item.lot_number || '—'}</td>
                                                                    <td style={level2NumericTdStyle}>{lotAllottedQty.toFixed(2)}</td>
                                                                    <td style={level2NumericTdStyle}>{delVal.toFixed(2)}</td>
                                                                    <td style={level2NumericTdStyle}>{usdVal.toFixed(2)}</td>
                                                                    <td style={{ ...level2NumericTdStyle, color: retVal > 0 ? '#b91c1c' : '#451a03' }}>{retVal.toFixed(2)}</td>
                                                                  </tr>
                                                                );
                                                              });

                                                              // Append unmatched returns if any
                                                              const unmatchedReturns = form.yarn_returns
                                                                ? (form.yarn_returns || []).filter(r => 
                                                                    (r.yarn_count_id === row.countId || r.countId === row.countId) && 
                                                                    r.colour === row.colour &&
                                                                    !matchingDydi.some(d => (d.lot_number || '—') === r.lot_number)
                                                                  )
                                                                : [];

                                                              unmatchedReturns.forEach((r, uIdx) => {
                                                                const retVal = parseFloat(r.quantity_returned || 0);
                                                                const lotAllottedQty = row.type === 'warp'
                                                                  ? 0
                                                                  : (() => {
                                                                      const lotAllotment = (form.weft_allotments || []).find(a => 
                                                                        (a.countId === row.countId || a.yarn_count_id === row.countId) && 
                                                                        a.colour === row.colour && 
                                                                        (a.lot_number === r.lot_number || (!a.lot_number && !r.lot_number) || (a.lot_number === '—' && !r.lot_number) || (r.lot_number === '—' && !a.lot_number))
                                                                      );
                                                                      return lotAllotment ? parseFloat(lotAllotment.allotted_qty || lotAllotment.qty || 0) : 0;
                                                                    })();
                                                                rows.push(
                                                                  <tr key={`unmatched-${uIdx}`} style={{ borderBottom: '1px solid #fee2e2', backgroundColor: '#fff' }}>
                                                                    <td style={level2TdStyle}>— (Return Only)</td>
                                                                    <td style={level2TdStyle}>{r.colour}</td>
                                                                    <td style={level2TdStyle}>{r.count_display || formatCount(row.countId)}</td>
                                                                    <td style={{ ...level2TdStyle, fontWeight: '600' }}>{r.lot_number || '—'}</td>
                                                                    <td style={level2NumericTdStyle}>{lotAllottedQty > 0 ? lotAllottedQty.toFixed(2) : '—'}</td>
                                                                    <td style={level2NumericTdStyle}>0.00</td>
                                                                    <td style={level2NumericTdStyle}>{(-retVal).toFixed(2)}</td>
                                                                    <td style={{ ...level2NumericTdStyle, color: '#b91c1c' }}>{retVal.toFixed(2)}</td>
                                                                  </tr>
                                                                );
                                                              });

                                                              return rows;
                                                            })()}
                                                          </tbody>
                                                        </table>
                                                      </div>
                                                    </div>
                                                  </td>
                                                </tr>
                                              )}
                                            </React.Fragment>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Lot Availability Table ── */}
      <div>
        <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-current)', fontWeight: '800' }}>
          <Calculator size={18} color="var(--color-primary)" />
          Dyed Yarn Lot Availability Breakdown
        </h4>
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current, #eee)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-current, #f9fafb)', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
                <th style={thStyle}>Colour</th>
                <th style={thStyle}>Yarn Count</th>
                <th style={thStyle}>Lot Number</th>
                <th style={numericThStyle}>Available Qty (kg)</th>
                <th style={thStyle}>Storage Location</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const availableLots = getAllAvailableLots();
                if (availableLots.length === 0) {
                  return (
                    <tr>
                      <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                        No available dyed yarn stock found in warehouse locations for this order.
                      </td>
                    </tr>
                  );
                }
                return availableLots.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-current, #f3f4f6)', backgroundColor: '#fff' }}>
                    <td style={{ ...tdStyle, fontWeight: '800', color: 'var(--color-primary)' }}>{item.colour}</td>
                    <td style={{ ...tdStyle, fontWeight: '700', color: '#1e293b' }}>{formatCount(item.countId)}</td>
                    <td style={{ ...tdStyle, fontWeight: '700', fontFamily: 'monospace' }}>{item.lotNumber}</td>
                    <td style={{ ...numericTdStyle, color: '#16a34a' }}>{item.balance.toFixed(2)} kg</td>
                    <td style={tdStyle}>{item.locationName}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Receipts Section ── */}
      <div className="yarn-receipts-grid" style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '1.5rem' }}>
        
        {/* Column 1: GYDRs */}
        <section style={receiptColStyle}>
          <h5 style={receiptHeaderStyle}>Greige Delivery Receipts (GYDR)</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {gydrs.map(r => (
              <div key={r.id} style={{ ...receiptCardStyle, flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: '850', fontSize: '0.8rem', color: 'var(--color-primary)' }}>{r.gydr_number}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                      Date: {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <button 
                    onClick={() => onViewGYDR(r.id)}
                    style={viewButtonStyle}
                    title="View GYDR Details"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151' }}>
                    Unit: {r.dof?.dyeing_unit?.partner_name || 'N/A'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Order Form: {r.dof_number || r.dof?.dof_number || 'N/A'}
                  </div>
                </div>
              </div>
            ))}
            {gydrs.length === 0 && <p style={emptyTextStyle}>No Greige Deliveries found.</p>}
          </div>
        </section>

        {/* Column 2: DYRRs */}
        <section style={receiptColStyle}>
          <h5 style={receiptHeaderStyle}>Dyed Received Receipts (DYRR)</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {dyrrs.map(r => {
              const isProd = r.source_type === 'production';
              return (
                <div key={r.id} style={{ ...receiptCardStyle, flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '0.8rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {r.dyrr_number}
                        <span style={{
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontSize: '0.55rem',
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          backgroundColor: isProd ? '#fef3c7' : '#dcfce7',
                          color: isProd ? '#b45309' : '#15803d',
                          border: isProd ? '1px solid #fcd34d' : '1px solid #bbf7d0'
                        }}>
                          {isProd ? 'Return' : 'Partner'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                        Date: {new Date(r.received_date || r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <button 
                      onClick={() => onViewDYRR(r.id)}
                      style={{ ...viewButtonStyle, color: '#16a34a' }}
                      title="View DYRR Details"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151' }}>
                      Unit: {r.partnerName || 'In-House'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Order Form: {r.dofNo || 'N/A'}
                    </div>
                  </div>
                </div>
              );
            })}
            {dyrrs.length === 0 && <p style={emptyTextStyle}>No Dyed Receipts found.</p>}
          </div>
        </section>

        {/* Column 3: DYDRs */}
        <section style={receiptColStyle}>
          <h5 style={receiptHeaderStyle}>Dyed Delivery Receipts (DYDR)</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {dydrs.map(r => (
              <div key={r.id} style={{ ...receiptCardStyle, flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '0.8rem', color: '#1e293b' }}>{r.dydr_number}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                      Date: {new Date(r.delivered_date || r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '1px' }}>
                      By: {r.delivered_by || '—'}
                    </div>
                  </div>
                  <button 
                    onClick={() => onViewDYDR(r.id)}
                    style={{ ...viewButtonStyle, color: '#800000' }}
                    title="View DYDR Details"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151' }}>
                    Unit: {r.partnerName || 'In-House'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Order Form: {r.targetFormNo || 'N/A'}
                  </div>
                </div>
              </div>
            ))}
            {dydrs.length === 0 && <p style={emptyTextStyle}>No Dyed Deliveries found.</p>}
          </div>
        </section>

      </div>

    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────────────────────
const thStyle = {
  padding: '0.6rem 0.75rem',
  fontWeight: '800',
  color: '#475569',
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const numericThStyle = {
  ...thStyle,
  textAlign: 'right'
};

const tdStyle = {
  padding: '0.6rem 0.75rem',
  color: '#334155',
  fontWeight: '500'
};

const numericTdStyle = {
  ...tdStyle,
  textAlign: 'right',
  fontWeight: '700'
};


const receiptColStyle = {
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#fff',
  padding: '1.25rem',
  borderRadius: '10px',
  border: '1px solid #f1f5f9',
  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
};

const receiptHeaderStyle = {
  margin: '0 0 1rem 0',
  color: '#475569',
  fontSize: '0.7rem',
  fontWeight: '800',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '2px solid #f1f5f9',
  paddingBottom: '0.5rem'
};

const receiptCardStyle = {
  padding: '0.75rem',
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
};

const viewButtonStyle = {
  background: 'none',
  color: 'var(--color-primary)',
  cursor: 'pointer',
  padding: '0.35rem',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
};

const emptyTextStyle = {
  margin: 0,
  fontSize: '0.75rem',
  color: '#94a3b8',
  fontStyle: 'italic',
  textAlign: 'center',
  padding: '1rem 0'
};

const subThStyle = {
  padding: '0.4rem 0.5rem',
  fontWeight: '700',
  color: '#475569',
  fontSize: '0.72rem'
};

const subNumericThStyle = {
  ...subThStyle,
  textAlign: 'right'
};

const subTdStyle = {
  padding: '0.4rem 0.5rem',
  color: '#334155',
  fontSize: '0.72rem'
};

const subNumericTdStyle = {
  ...subTdStyle,
  textAlign: 'right',
  fontWeight: '600'
};

const level2ThStyle = {
  padding: '0.3rem 0.4rem',
  fontWeight: '700',
  color: '#7f1d1d',
  fontSize: '0.68rem'
};

const level2NumericThStyle = {
  ...level2ThStyle,
  textAlign: 'right'
};

const level2TdStyle = {
  padding: '0.3rem 0.4rem',
  color: '#451a03',
  fontSize: '0.68rem'
};

const level2NumericTdStyle = {
  ...level2TdStyle,
  textAlign: 'right',
  fontWeight: '600'
};
