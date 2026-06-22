import React, { useState, useEffect } from 'react';
import { Loader, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PrintableSOFDC from '../Production/PrintableSOFDC';

function getLocalDateString(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getSofStatusBadge(sof) {
  const status = sof.status;
  const todayStr = getLocalDateString(new Date());

  if (status === 'completed') {
    const actualEndStr = sof.process_completed_at
      ? getLocalDateString(sof.process_completed_at)
      : (getLocalDateString(sof.updated_at) || todayStr);

    if (sof.end_date && actualEndStr > sof.end_date) {
      return { label: 'Late Completed', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return { label: 'Completed', bg: '#dcfce7', color: '#166534', border: '#86efac' };
  }

  switch (status) {
    case 'stopped':
      return { label: 'Stopped', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
    case 'on_process':
      if (sof.end_date && todayStr > sof.end_date) {
        return { label: 'Running Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
      }
      return { label: 'On Process', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' };
    case 'created':
    default:
      if (sof.end_date && todayStr > sof.end_date) {
        return { label: 'Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
      }
      return { label: 'Created', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
  }
}

function OrderSizingTab({ order }) {
  const [sofs, setSofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSofId, setExpandedSofId] = useState(null);
  const [expandedSofdcId, setExpandedSofdcId] = useState(null);

  const fetchSofs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sizing_order_forms')
        .select(`
          *,
          wof:warping_order_forms(id, wof_number, qty)
        `)
        .eq('order_id', order.id)
        .order('created_at', { ascending: false });

      if (!error) {
        setSofs(data || []);
      } else {
        console.error("Error fetching SOFs for order:", error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSofs();
  }, [order.id]);

  const handleToggleExpand = (sofId) => {
    setExpandedSofId(expandedSofId === sofId ? null : sofId);
  };

  return (
    <div>
      <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: '800', fontSize: '0.95rem', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        Sizing Modules
      </h4>

      {/* SOF Status Overview */}
      {!loading && sofs.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
          marginBottom: '1.25rem', padding: '0.75rem 1rem',
          backgroundColor: '#fafafa',
          border: '1px solid var(--border-current)',
          borderRadius: '10px'
        }}>
          {sofs.map(sof => {
            const badge = getSofStatusBadge(sof);
            return (
              <div
                key={sof.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.35rem 0.7rem',
                  backgroundColor: '#fff',
                  border: '1px solid var(--border-current)',
                  borderRadius: '8px',
                  fontSize: '0.72rem'
                }}
              >
                <span style={{ fontWeight: '700', color: '#0ea5e9', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                  {sof.sof_number} {sof.beam_name ? `(${sof.beam_name})` : ''}
                </span>
                <span style={{
                  backgroundColor: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                  padding: '1px 8px',
                  borderRadius: '12px',
                  fontSize: '0.58rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em'
                }}>
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted-current)', alignItems: 'center', gap: '0.5rem' }}>
          <Loader size={20} className="spin" /> Loading Sizing Order Forms…
        </div>
      ) : (
        <div>
          {/* Big Text Stats Cards */}
          {(() => {
            const totalSizingQty = sofs.reduce((sum, s) => sum + parseFloat(s.qty || 0), 0);
            const orderQty = order.total_quantity || 0;
            const productionQty = order.technical_specs?.production_quantity || '—';
            return (
              <div className="stats-grid-3" style={{ marginBottom: '2rem' }}>
                <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Order Qty</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '850', color: 'var(--text-current)' }}>
                    {Number(orderQty).toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>Mtrs</span>
                  </span>
                </div>
                <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Production Qty</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '850', color: 'var(--text-current)' }}>
                    {productionQty !== '—' ? `${Number(productionQty).toLocaleString()}` : '—'} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>{productionQty !== '—' ? 'Mtrs' : ''}</span>
                  </span>
                </div>
                <div style={{ padding: '1.25rem', backgroundColor: '#fdfdfd', border: '1px solid var(--border-current)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: '#0ea5e9' }}>Sized Qty</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '850', color: '#0ea5e9' }}>
                    {Number(totalSizingQty).toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#a3a3a3' }}>Mtrs</span>
                  </span>
                </div>
              </div>
            );
          })()}

          <h5 style={{ margin: '0 0 0.75rem 0', fontWeight: '800', fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sizing Order Forms
          </h5>
          
          {sofs.length === 0 ? (
            <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', fontStyle: 'italic' }}>No Sizing Order Forms found for this order.</p>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '2px solid var(--border-current)', textAlign: 'left' }}>
                    <th style={{ width: '40px', padding: '0.75rem 0.5rem' }}></th>
                    {['SOF Number', 'Warping Ref', 'Sizing Type', 'Allocated Machine / Partner', 'Qty (Mtrs)', 'Start Date', 'End Date', 'Status'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted-current)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sofs.map(sof => {
                    const badge = getSofStatusBadge(sof);
                    const isExpanded = expandedSofId === sof.id;

                    return (
                      <React.Fragment key={sof.id}>
                        <tr onClick={() => handleToggleExpand(sof.id)} style={{ cursor: 'pointer', backgroundColor: '#fafafa', borderBottom: '1px solid var(--border-current)' }}>
                          <td onClick={e => { e.stopPropagation(); handleToggleExpand(sof.id); }} style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: '#0ea5e9', fontFamily: 'monospace' }}>{sof.sof_number} {sof.beam_name ? `(${sof.beam_name})` : ''}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: '600', fontFamily: 'monospace' }}>{sof.wof?.wof_number || '—'}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ backgroundColor: sof.sizing_type === 'in_house' ? 'rgba(14,165,233,0.08)' : 'rgba(16,185,129,0.08)', color: sof.sizing_type === 'in_house' ? '#0284c7' : '#059669', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '700' }}>
                              {sof.sizing_type === 'in_house' ? 'In-House' : 'Job Work'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {sof.partner_name ? (
                              <div>
                                <div style={{ fontWeight: '600' }}>{sof.partner_name}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)' }}>{sof.machine_name || 'Unassigned Machine'}</div>
                              </div>
                            ) : sof.machine_name ? (
                              <span style={{ fontWeight: '600' }}>{sof.machine_name}</span>
                            ) : (
                              <span style={{ color: '#d97706', fontStyle: 'italic', fontWeight: '600', fontSize: '0.8rem' }}>⚠️ Not Assigned</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>{sof.qty ? `${Number(sof.qty).toLocaleString()} m` : '—'}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {sof.start_date ? new Date(sof.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {sof.end_date ? new Date(sof.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '700' }}>
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ backgroundColor: '#fff' }}>
                            <td colSpan={9} style={{ padding: '1.5rem', borderLeft: '3px solid #0ea5e9' }}>
                              <div className="grid-4-to-2" style={{ width: '100%' }}>
                                <div>
                                  <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Design Ref</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>
                                    {order?.design_no || '—'} {order?.design_name ? `/ ${order.design_name}` : ''}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Allocated Unit / Partner</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: sof.partner_name ? 'var(--text-current)' : (sof.sizing_type === 'in_house' ? 'var(--text-current)' : 'var(--text-muted-current)') }}>
                                    {sof.partner_name || (sof.sizing_type === 'in_house' ? 'In-House Sizing Unit' : 'Not Assigned')}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Allocated Machine</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: sof.machine_name ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                    {sof.machine_name || 'Not Assigned'}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>WOF Quantity Reference</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>
                                    {sof.wof?.qty ? `${Number(sof.wof.qty).toLocaleString()} m` : '—'}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Beam Number</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: sof.beam_name ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                    {sof.beam_name || '—'}
                                  </span>
                                </div>

                                {sof.forwarded_to === 'weaving' && (
                                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-current)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                                    <h6 style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', fontWeight: '800', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                      <span>→</span> Forwarded to Weaving
                                    </h6>
                                    
                                    <div className="grid-4-to-2" style={{ marginBottom: '1rem' }}>
                                      <div>
                                        <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Weaving Type</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>
                                          {sof.weaving_type === 'in_house' ? 'In-House Weaving' : 'Job Work Weaving'}
                                        </span>
                                      </div>
                                      <div>
                                        <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                                          {sof.weaving_type === 'in_house' ? 'Weaving Loom' : 'Weaving Partner'}
                                        </span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)' }}>
                                          {sof.weaving_type === 'in_house' ? (sof.weaving_machine_name || '—') : (sof.weaving_partner_name || '—')}
                                        </span>
                                      </div>
                                    </div>

                                    {sof.weaving_splits && sof.weaving_splits.length > 0 && (
                                      <div style={{ marginTop: '0.75rem' }}>
                                        <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                                          Weaving Splits ({sof.weaving_splits_count})
                                        </span>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left', border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden' }}>
                                          <thead>
                                            <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '1px solid var(--border-current)' }}>
                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Split Number</th>
                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Qty (Mtrs)</th>
                                              <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Schedule</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {sof.weaving_splits.map((ws, idx) => (
                                              <tr key={idx} style={{ borderBottom: idx !== sof.weaving_splits.length - 1 ? '1px solid var(--border-current)' : 'none' }}>
                                                <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontWeight: '700' }}>{ws.split_no}</td>
                                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>{Number(ws.qty).toLocaleString()} m</td>
                                                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted-current)' }}>
                                                  {ws.start_date ? new Date(ws.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'} to{' '}
                                                  {ws.end_date ? new Date(ws.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Collapsible SOFDC Delivery Receipt */}
                            <div style={{ gridColumn: '1 / -1', marginTop: '1.5rem', borderTop: '1px solid var(--border-current)', paddingTop: '1.25rem' }}>
                              <div 
                                onClick={() => setExpandedSofdcId(expandedSofdcId === sof.id ? null : sof.id)}
                                style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center', 
                                  backgroundColor: 'rgba(2,132,199,0.04)', 
                                  padding: '0.75rem 1rem', 
                                  borderRadius: '8px', 
                                  border: '1px solid #0284c7', 
                                  cursor: 'pointer',
                                  userSelect: 'none'
                                }}
                              >
                                <span style={{ fontWeight: '800', color: '#0284c7', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  📄 Delivery Receipt (SOFDC): {sof.sofdc_number || '—'}
                                </span>
                                <span style={{ fontSize: '0.75rem', fontWeight: '750', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  {expandedSofdcId === sof.id ? 'Collapse Details ▲' : 'Expand Details ▼'}
                                </span>
                              </div>
                              
                              {expandedSofdcId === sof.id && (
                                <div style={{ marginTop: '1rem' }}>
                                  <PrintableSOFDC 
                                    sof={sof} 
                                    order={order} 
                                    machineName={sof.machine_name} 
                                    partnerName={sof.partner_name}
                                    allSofs={sofs}
                                  />
                                </div>
                              )}
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
          )}
        </div>
      )}
    </div>
  );
}

export default OrderSizingTab;
