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

  // Expanded rows state
  const [expandedRowKeys, setExpandedRowKeys] = useState(new Set());
  
  const handleToggleExpand = (key) => {
    const next = new Set(expandedRowKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedRowKeys(next);
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // 1. Fetch Yarn Counts
        const { data: countsData } = await supabase.from('master_yarn_counts').select('*');
        setYarnCounts(countsData || []);

        // 2. Fetch Greige Deliveries
        const { data: gydiData } = await supabase
          .from('greige_yarn_delivery_items')
          .select('*, receipt:greige_yarn_delivery_receipts(*)')
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
          .select('*, receipt:dyed_yarn_receipts(*), location:master_locations(location_name)')
          .eq('order_id', order.id);
        setDyri(dyriData || []);

        // Group unique DYRR receipts for the list
        const uniqueDyrrIds = Array.from(new Set(dyriData?.map(i => i.receipt?.id))).filter(Boolean);
        const uniqueDyrr = uniqueDyrrIds.map(id => dyriData.find(i => i.receipt?.id === id).receipt);
        setDyrrs(uniqueDyrr.sort((a, b) => new Date(b.created_at || b.received_date).getTime() - new Date(a.created_at || a.received_date).getTime()));

        // 5. Fetch Dyed Deliveries to production
        const { data: dydiData } = await supabase
          .from('dyed_yarn_delivery_items')
          .select('*, delivery:dyed_yarn_deliveries(*), location:master_locations(location_name)')
          .eq('order_id', order.id);
        setDydi(dydiData || []);

        // Group unique DYDR receipts for the list
        const uniqueDydrIds = Array.from(new Set(dydiData?.map(i => i.delivery?.id))).filter(Boolean);
        const uniqueDydr = uniqueDydrIds.map(id => dydiData.find(i => i.delivery?.id === id).delivery);
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

    // A. Initialize summary with order requirements
    (order.yarn_requirements || []).forEach(yr => {
      const type = yr.type || 'warp';
      const key = `${yr.countId}-${yr.color}-${type}`;
      summary[key] = {
        countId: yr.countId,
        colour: yr.color,
        type: type,
        required: parseFloat(yr.kg || 0),
        sentToDyeing: 0,
        receivedFromDyeing: 0,
        sentToWarp: 0,
        receivedFromWarping: 0,
        sentToWeaving: 0,
        receivedFromWeaving: 0
      };
    });

    // B. Accumulate Sent to Dyeing (Greige Deliveries)
    gydi.forEach(item => {
      const type = item.yarn_type || 'warp';
      const key = `${item.yarn_count_id}-${item.colour}-${type}`;
      if (!summary[key]) {
        summary[key] = {
          countId: item.yarn_count_id,
          colour: item.colour,
          type: type,
          required: 0,
          sentToDyeing: 0,
          receivedFromDyeing: 0,
          sentToWarp: 0,
          receivedFromWarping: 0,
          sentToWeaving: 0,
          receivedFromWeaving: 0
        };
      }
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

    // C. Accumulate Received from Dyeing, Warping Returns, and Weaving Returns
    dyri.forEach(item => {
      const type = item.yarn_type || 'warp';
      const key = `${item.yarn_count_id}-${item.colour}-${type}`;
      const isExcess = item.is_excess || item.receipt?.source_type === 'production';

      if (!summary[key]) {
        summary[key] = {
          countId: item.yarn_count_id,
          colour: item.colour,
          type: type,
          required: 0,
          sentToDyeing: 0,
          receivedFromDyeing: 0,
          sentToWarp: 0,
          receivedFromWarping: 0,
          sentToWeaving: 0,
          receivedFromWeaving: 0
        };
      }

      if (isExcess) {
        if (type === 'warp') {
          summary[key].receivedFromWarping += parseFloat(item.quantity_kg || 0);
        } else {
          summary[key].receivedFromWeaving += parseFloat(item.quantity_kg || 0);
        }
      } else {
        summary[key].receivedFromDyeing += parseFloat(item.quantity_kg || 0);
      }
    });

    // D. Accumulate Sent to Warp & Sent to Weaving (Dyed Deliveries)
    dydi.forEach(item => {
      // Resolve process/yarn type
      const type = item.yarn_type || (item.process_type === 'warping' ? 'warp' : 'weft');
      const key = `${item.yarn_count_id}-${item.colour}-${type}`;

      if (!summary[key]) {
        summary[key] = {
          countId: item.yarn_count_id,
          colour: item.colour,
          type: type,
          required: 0,
          sentToDyeing: 0,
          receivedFromDyeing: 0,
          sentToWarp: 0,
          receivedFromWarping: 0,
          sentToWeaving: 0,
          receivedFromWeaving: 0
        };
      }

      if (item.process_type === 'warping') {
        summary[key].sentToWarp += parseFloat(item.quantity_kg || 0);
      } else {
        summary[key].sentToWeaving += parseFloat(item.quantity_kg || 0);
      }
    });

    // Convert to sorted list: Warp first, then Weft
    return Object.values(summary).sort((a, b) => {
      if (a.type === 'warp' && b.type !== 'warp') return -1;
      if (a.type !== 'warp' && b.type === 'warp') return 1;
      return 0;
    });

  }, [order.yarn_requirements, gydi, greigeReturns, dyri, dydi]);

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
      const loc = item.location?.location_name || '—';
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
                <th style={numericThStyle}>Sent to Warp (kg)</th>
                <th style={numericThStyle}>Rec. from Warping (kg)</th>
                <th style={numericThStyle}>Sent to Weaving (kg)</th>
                <th style={numericThStyle}>Rec. from Weaving (kg)</th>
                <th style={numericThStyle}>Available (kg)</th>
              </tr>
            </thead>
            <tbody>
              {summaryData.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
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
                  const availableVal = row.receivedFromDyeing - row.sentToWarp - row.sentToWeaving + row.receivedFromWarping + row.receivedFromWeaving;

                  return (
                    <React.Fragment key={idx}>
                      {(showWarpHeader || showWeftHeader) && (
                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                          <td colSpan="11" style={{ padding: '0.4rem 0.75rem', fontWeight: '800', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
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
                        
                        {/* Warping Columns */}
                        <td style={isWarp ? { ...numericTdStyle, color: '#2563eb' } : disabledTdStyle}>
                          {isWarp ? row.sentToWarp.toFixed(2) : '—'}
                        </td>
                        <td style={isWarp ? { ...numericTdStyle, color: '#059669' } : disabledTdStyle}>
                          {isWarp ? row.receivedFromWarping.toFixed(2) : '—'}
                        </td>
                        
                        {/* Weaving Columns */}
                        <td style={!isWarp ? { ...numericTdStyle, color: '#d97706' } : disabledTdStyle}>
                          {!isWarp ? row.sentToWeaving.toFixed(2) : '—'}
                        </td>
                        <td style={!isWarp ? { ...numericTdStyle, color: '#b45309' } : disabledTdStyle}>
                          {!isWarp ? row.receivedFromWeaving.toFixed(2) : '—'}
                        </td>

                        {/* Available Column */}
                        <td style={{ ...numericTdStyle, color: availableVal > 0.001 ? '#16a34a' : 'inherit' }}>
                          {availableVal.toFixed(2)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ backgroundColor: '#fafafa' }}>
                          <td colSpan="11" style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid var(--color-primary)', borderBottom: '1px solid var(--border-current)' }}>
                            <div style={{ maxWidth: '650px' }}>
                              <h6 style={{ margin: '0 0 0.6rem 0', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Calculator size={14} />
                                Available Inventory Breakdown ({row.colour})
                              </h6>
                              {(() => {
                                const breakdown = getRowInventory(row);
                                if (breakdown.length === 0) {
                                  return (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                      No active stock available in warehouse locations for this yarn.
                                    </div>
                                  );
                                }
                                return (
                                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', textAlign: 'left' }}>
                                          <th style={{ padding: '0.4rem 0.75rem', color: '#475569', fontWeight: '700' }}>Lot Number</th>
                                          <th style={{ padding: '0.4rem 0.75rem', color: '#475569', fontWeight: '700' }}>Storage Location</th>
                                          <th style={{ padding: '0.4rem 0.75rem', color: '#475569', fontWeight: '700', textAlign: 'right' }}>Available Qty (kg)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {breakdown.map((item, bIdx) => (
                                          <tr key={bIdx} style={{ borderBottom: bIdx < breakdown.length - 1 ? '1px solid #f1f5f9' : 'none', backgroundColor: '#fff' }}>
                                            <td style={{ padding: '0.4rem 0.75rem', fontWeight: '600', color: '#334155' }}>{item.lotNumber}</td>
                                            <td style={{ padding: '0.4rem 0.75rem', color: '#475569' }}>{item.locationName}</td>
                                            <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#16a34a' }}>
                                              {item.balance.toFixed(2)} kg
                                            </td>
                                          </tr>
                                        ))}
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

      {/* ── Receipts Section ── */}
      <div className="yarn-receipts-grid" style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '1.5rem' }}>
        
        {/* Column 1: GYDRs */}
        <section style={receiptColStyle}>
          <h5 style={receiptHeaderStyle}>Greige Delivery Receipts (GYDR)</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {gydrs.map(r => (
              <div key={r.id} style={receiptCardStyle}>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '0.8rem', color: '#1e293b' }}>{r.gydr_number}</div>
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
                <div key={r.id} style={receiptCardStyle}>
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
              <div key={r.id} style={receiptCardStyle}>
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

const disabledTdStyle = {
  ...tdStyle,
  textAlign: 'right',
  color: '#94a3b8',
  fontWeight: '400',
  fontStyle: 'italic',
  backgroundColor: '#f8fafc'
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
