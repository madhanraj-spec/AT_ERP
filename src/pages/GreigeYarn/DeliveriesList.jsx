import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, Eye, Truck, CheckCircle, Clock, AlertCircle, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const hasGreigeBalanceToSend = (form, deliveryItemsMap, returnsMap) => {
  if (!form || !Array.isArray(form.summary) || form.summary.length === 0) {
    return false;
  }
  
  const dofDeliveryItems = deliveryItemsMap[form.id] || [];
  const dofReturns = returnsMap[form.dof_number] || [];
  
  // Check if any summary item has a positive remaining balance to send
  return form.summary.some(s => {
    const required = parseFloat(s.total_kg || 0);
    
    const sentDeliveries = dofDeliveryItems
      .filter(d => d.yarn_count_id === s.countId && d.colour === s.colour)
      .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);
      
    const returned = dofReturns
      .filter(r => r.yarn_count_id === s.countId && r.colour === s.colour)
      .reduce((sum, r) => sum + parseFloat(r.total_weight || 0), 0);
      
    const sent = Math.max(0, sentDeliveries - returned);
    const balance = required - sent;
    
    return balance > 0.01; // Positive balance remaining to send
  });
};

export default function DeliveriesList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dyeing');
  const [loading, setLoading] = useState(true);
  const [dyeingForms, setDyeingForms] = useState([]);
  const [deliveryItemsMap, setDeliveryItemsMap] = useState({});
  const [returnsMap, setReturnsMap] = useState({});

  useEffect(() => {
    fetchDyeingForms();
  }, []);

  const fetchDyeingForms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dyeing_order_forms')
        .select(`
          *,
          dyeing_unit:master_partners(partner_name),
          creator:profiles!dyeing_order_forms_created_by_fkey(full_name)
        `)
        .in('status', ['approved', 'partially_sent', 'fully_sent', 'partially_received', 'received'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const dofIds = (data || []).map(f => f.id);
      const dofNumbers = (data || []).map(f => f.dof_number).filter(Boolean);

      // Fetch linked orders, deliveries, and returns in parallel
      const [formsWithOrders, receiptsResult, returnsResult] = await Promise.all([
        Promise.all((data || []).map(async (form) => {
          if (!form.order_ids || form.order_ids.length === 0) return { ...form, orders: [] };
          const { data: orders } = await supabase
            .from('orders')
            .select('id, order_number, design_no')
            .in('id', form.order_ids);
          return { ...form, orders: orders || [] };
        })),
        dofIds.length > 0
          ? supabase
              .from('greige_yarn_delivery_receipts')
              .select(`
                dof_id,
                greige_yarn_delivery_items(
                  yarn_count_id,
                  colour,
                  quantity_kg
                )
              `)
              .in('dof_id', dofIds)
          : Promise.resolve({ data: [] }),
        dofNumbers.length > 0
          ? supabase
              .from('greige_yarn_receipts')
              .select('order_form_no, yarn_count_id, colour, total_weight')
              .eq('receipt_type', 'production')
              .in('order_form_no', dofNumbers)
          : Promise.resolve({ data: [] })
      ]);

      if (receiptsResult.error) throw receiptsResult.error;
      if (returnsResult.error) throw returnsResult.error;

      // Map delivery items
      const dMap = {};
      (receiptsResult.data || []).forEach(r => {
        if (!dMap[r.dof_id]) {
          dMap[r.dof_id] = [];
        }
        if (r.greige_yarn_delivery_items) {
          dMap[r.dof_id].push(...r.greige_yarn_delivery_items);
        }
      });

      // Map returns
      const rMap = {};
      (returnsResult.data || []).forEach(ret => {
        if (!rMap[ret.order_form_no]) {
          rMap[ret.order_form_no] = [];
        }
        rMap[ret.order_form_no].push(ret);
      });

      setDeliveryItemsMap(dMap);
      setReturnsMap(rMap);
      setDyeingForms(formsWithOrders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getDeliveryStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return { bg: '#dcfce7', text: '#166534', icon: <CheckCircle size={12} />, label: 'APPROVED — READY TO SEND' };
      case 'partially_sent':
        return { bg: '#fef3c7', text: '#92400e', icon: <Clock size={12} />, label: 'PARTIALLY SENT' };
      case 'fully_sent':
        return { bg: '#dbeafe', text: '#1e40af', icon: <Send size={12} />, label: 'FULLY SENT' };
      case 'partially_received':
        return { bg: '#fef3c7', text: '#92400e', icon: <Clock size={12} />, label: 'PARTIALLY RECEIVED' };
      case 'received':
        return { bg: '#f1f5f9', text: '#475569', icon: <CheckCircle size={12} />, label: 'FULLY RECEIVED' };
      default:
        return { bg: '#f1f5f9', text: '#475569', icon: null, label: status?.toUpperCase() };
    }
  };

  const getTotalQty = (allocations) => {
    if (!allocations || !Array.isArray(allocations)) return '0.00';
    return allocations.reduce((s, a) => s + parseFloat(a.total_kg || 0), 0).toFixed(2);
  };

  const tabs = [
    { key: 'dyeing', label: 'Dyeing Order Forms', count: dyeingForms.length },
    { key: 'warping', label: 'Warping Order Forms', count: 0 },
    { key: 'weaving', label: 'Weaving Order Forms', count: 0 },
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem' }} className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/greige-yarn')}
          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', padding: '0', marginBottom: '0.75rem' }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.25rem 0', color: 'var(--text-current)', fontWeight: 'bold' }}>
              Greige Yarn Deliveries
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
              Deliver greige yarn to dyeing, warping, and weaving order forms
            </p>
          </div>
          <button
            onClick={() => navigate('/greige-yarn/new-delivery')}
            className="btn btn-primary"
            style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontWeight: '600' }}
          >
            <Truck size={16} /> New Delivery
          </button>
        </div>
      </div>

      {/* Tabs + Table */}
      <div className="glass-panel" style={{ padding: 0 }}>
        {/* Tab Bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-current)', padding: '0 1.5rem', gap: '2rem' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none', border: 'none', padding: '1.25rem 0', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
                color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--text-muted-current)',
                borderBottom: activeTab === tab.key ? '3px solid var(--color-primary)' : '3px solid transparent',
                transition: 'all 0.2s', whiteSpace: 'nowrap'
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Dyeing Order Forms Tab */}
        {activeTab === 'dyeing' && (
          loading ? (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
              <Loader size={28} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '1rem', color: 'var(--text-muted-current)' }}>Loading approved order forms...</p>
            </div>
          ) : dyeingForms.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted-current)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎨</div>
              <h3>No Approved Dyeing Order Forms</h3>
              <p>There are no approved DOFs ready for greige yarn delivery yet.</p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
              <table className="table" style={{ fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th>DOF Number</th>
                    <th>Created Date</th>
                    <th>Dyeing Unit</th>
                    <th>Linked Orders</th>
                    <th>Counts</th>
                    <th style={{ textAlign: 'right' }}>Total Qty (kg)</th>
                    <th>Delivery Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dyeingForms.map(form => {
                    const badge = getDeliveryStatusBadge(form.status);
                    const canDeliver = hasGreigeBalanceToSend(form, deliveryItemsMap, returnsMap) &&
                      form.status !== 'fully_sent' &&
                      form.status !== 'received';
                    return (
                      <tr key={form.id} className="fade-in">
                        <td>
                          <span style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '0.9rem' }}>
                            {form.dof_number}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {new Date(form.created_at).toLocaleDateString('en-IN')}
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          {form.dyeing_unit?.partner_name || <span style={{ color: 'var(--text-muted-current)' }}>Not set</span>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {form.orders?.map(o => (
                              <span key={o.id} style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-primary)' }}>
                                {o.order_number}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            {[...new Set((form.summary || []).map(s => s.yarnLabel || ''))].slice(0, 3).map((label, i) => (
                              <span key={i} style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', whiteSpace: 'nowrap' }}>
                                {label}
                              </span>
                            ))}
                            {(form.summary || []).length > 3 && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>
                                +{form.summary.length - 3} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                          {getTotalQty(form.yarn_allocations)}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            backgroundColor: badge.bg, color: badge.text,
                            padding: '4px 10px', borderRadius: '4px',
                            fontSize: '0.72rem', fontWeight: '700', whiteSpace: 'nowrap'
                          }}>
                            {badge.icon} {badge.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => navigate(`/greige-yarn/dof-view/${form.id}`)}
                              style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <Eye size={12} /> View
                            </button>
                            {canDeliver ? (
                              <button
                                onClick={() => navigate(`/greige-yarn/deliveries/${form.id}`)}
                                style={{ backgroundColor: '#7f1d1d', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <Truck size={12} /> Deliver Yarn
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <CheckCircle size={12} /> Complete
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Warping Tab */}
        {activeTab === 'warping' && (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted-current)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧵</div>
            <h3>Warping Order Forms</h3>
            <p>Warping order form delivery module coming soon.</p>
          </div>
        )}

        {/* Weaving Tab */}
        {activeTab === 'weaving' && (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted-current)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🪡</div>
            <h3>Weaving Order Forms</h3>
            <p>Weaving order form delivery module coming soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}
