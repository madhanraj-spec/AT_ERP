import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, Eye, Truck, CheckCircle, Clock, AlertCircle, Send, ChevronRight, ChevronDown } from 'lucide-react';
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
  const [expandedDofs, setExpandedDofs] = useState({});
  const [expandedGydrs, setExpandedGydrs] = useState({});
  const [dofDetails, setDofDetails] = useState({});
  const [yarnCounts, setYarnCounts] = useState([]);

  useEffect(() => {
    fetchDyeingForms();
    fetchYarnCounts();
  }, []);

  const fetchYarnCounts = async () => {
    try {
      const { data } = await supabase.from('master_yarn_counts').select('*');
      setYarnCounts(data || []);
    } catch (err) {
      console.error('Error fetching yarn counts:', err);
    }
  };

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
            .select('id, order_number, design_no, design_name')
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

  const fetchDofDetails = async (dofId, dofNumber) => {
    if (dofDetails[dofId]) return;

    setDofDetails(prev => ({
      ...prev,
      [dofId]: { loading: true, gydrs: [], gydrItems: [], dyrrs: [], dyrrItems: [] }
    }));

    try {
      // 1. Fetch GYDRs
      const { data: gydrsData, error: gydrErr } = await supabase
        .from('greige_yarn_delivery_receipts')
        .select('*')
        .eq('dof_id', dofId)
        .order('created_at', { ascending: false });

      if (gydrErr) throw gydrErr;

      const gydrIds = (gydrsData || []).map(r => r.id);
      let gydrItemsData = [];
      if (gydrIds.length > 0) {
        const { data: itemsData, error: itemsErr } = await supabase
          .from('greige_yarn_delivery_items')
          .select(`
            *,
            master_yarn_counts(count, unit)
          `)
          .in('receipt_id', gydrIds);
        if (itemsErr) throw itemsErr;
        gydrItemsData = itemsData || [];
      }

      // 2. Fetch DYRRs
      const { data: dyrrsData, error: dyrrErr } = await supabase
        .from('dyed_yarn_receipts')
        .select('*')
        .eq('dof_id', dofId)
        .order('received_date', { ascending: false });

      if (dyrrErr) throw dyrrErr;

      const dyrrIds = (dyrrsData || []).map(r => r.id);
      let dyrrItemsData = [];
      if (dyrrIds.length > 0) {
        const { data: itemsData, error: itemsErr } = await supabase
          .from('dyed_yarn_receipt_items')
          .select(`
            *,
            master_yarn_counts(count, unit)
          `)
          .in('receipt_id', dyrrIds);
        if (itemsErr) throw itemsErr;
        dyrrItemsData = itemsData || [];
      }

      setDofDetails(prev => ({
        ...prev,
        [dofId]: {
          loading: false,
          gydrs: gydrsData || [],
          gydrItems: gydrItemsData,
          dyrrs: dyrrsData || [],
          dyrrItems: dyrrItemsData
        }
      }));
    } catch (err) {
      console.error('Error fetching DOF details:', err);
      setDofDetails(prev => ({
        ...prev,
        [dofId]: {
          loading: false,
          error: err.message,
          gydrs: [],
          gydrItems: [],
          dyrrs: [],
          dyrrItems: []
        }
      }));
    }
  };

  const toggleDofExpand = (form) => {
    const isExpanded = !!expandedDofs[form.id];
    setExpandedDofs(prev => ({
      ...prev,
      [form.id]: !isExpanded
    }));
    if (!isExpanded) {
      fetchDofDetails(form.id, form.dof_number);
    }
  };

  const toggleGydrExpand = (gydrId) => {
    setExpandedGydrs(prev => ({
      ...prev,
      [gydrId]: !prev[gydrId]
    }));
  };

  const formatCount = (count) => {
    if (!count) return '';
    return `${count.count}${count.unit}`;
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
                    <th style={{ width: '40px' }}></th>
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
                      <React.Fragment key={form.id}>
                        <tr className="fade-in">
                          <td>
                            <button
                              onClick={() => toggleDofExpand(form)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center',
                                padding: '4px', transform: expandedDofs[form.id] ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s'
                              }}
                            >
                              <ChevronRight size={16} />
                            </button>
                          </td>
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
                      {expandedDofs[form.id] && (
                        <tr>
                          <td colSpan={9} style={{ backgroundColor: 'var(--bg-light-current, #f8fafc)', padding: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                              
                              {/* Section 1: Greige Yarn Delivery Receipts (GYDRs) */}
                              <div>
                                <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-current)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <Truck size={18} /> Greige Yarn Delivery Receipts (GYDR)
                                </h4>
                                
                                {dofDetails[form.id]?.loading ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', color: 'var(--text-muted-current)' }}>
                                    <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading delivery receipts...
                                  </div>
                                ) : dofDetails[form.id]?.error ? (
                                  <div style={{ padding: '1rem', color: '#b91c1c', backgroundColor: '#fee2e2', borderRadius: '4px' }}>
                                    Error loading receipts: {dofDetails[form.id].error}
                                  </div>
                                ) : !dofDetails[form.id]?.gydrs || dofDetails[form.id].gydrs.length === 0 ? (
                                  <p style={{ color: 'var(--text-muted-current)', fontStyle: 'italic', margin: '0 0 0 1.5rem' }}>
                                    No greige yarn deliveries have been made for this DOF yet.
                                  </p>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: '1.5rem' }}>
                                    {dofDetails[form.id].gydrs.map(gydr => {
                                      const gydrItems = (dofDetails[form.id]?.gydrItems || []).filter(item => item.receipt_id === gydr.id);
                                      const isGydrExpanded = !!expandedGydrs[gydr.id];
                                      return (
                                        <div key={gydr.id} className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--border-current)', borderRadius: '6px', backgroundColor: 'var(--bg-panel-current, #fff)' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', gap: '2rem', fontSize: '0.85rem' }}>
                                              <div>
                                                <span style={{ color: 'var(--text-muted-current)' }}>Receipt No:</span>{' '}
                                                <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{gydr.gydr_number}</span>
                                              </div>
                                              <div>
                                                <span style={{ color: 'var(--text-muted-current)' }}>Date:</span>{' '}
                                                <span style={{ fontWeight: '600' }}>{new Date(gydr.created_at).toLocaleDateString('en-IN')}</span>
                                              </div>
                                              <div>
                                                <span style={{ color: 'var(--text-muted-current)' }}>Delivered By:</span>{' '}
                                                <span style={{ fontWeight: '600' }}>{gydr.delivered_by}</span>
                                              </div>
                                              {gydr.vehicle_no && (
                                                <div>
                                                  <span style={{ color: 'var(--text-muted-current)' }}>Vehicle:</span>{' '}
                                                  <span style={{ fontWeight: '600' }}>{gydr.vehicle_no}</span>
                                                </div>
                                              )}
                                            </div>
                                            <button
                                              onClick={() => toggleGydrExpand(gydr.id)}
                                              className="btn btn-secondary"
                                              style={{ padding: '2px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                            >
                                              {isGydrExpanded ? 'Hide Items' : 'View Items'}
                                            </button>
                                          </div>
                                          
                                          {isGydrExpanded && (
                                            <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-current)', paddingTop: '0.75rem' }}>
                                              <table className="table" style={{ fontSize: '0.8rem', width: '100%', margin: 0 }}>
                                                <thead>
                                                  <tr>
                                                    <th style={{ padding: '6px 12px' }}>Count</th>
                                                    <th style={{ padding: '6px 12px' }}>Colour</th>
                                                    <th style={{ padding: '6px 12px', textAlign: 'right' }}>Qty Sent (kg)</th>
                                                    <th style={{ padding: '6px 12px' }}>Date</th>
                                                    <th style={{ padding: '6px 12px' }}>Person</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {gydrItems.map(item => (
                                                    <tr key={item.id}>
                                                      <td style={{ padding: '6px 12px' }}>{formatCount(item.master_yarn_counts)}</td>
                                                      <td style={{ padding: '6px 12px' }}>{item.colour}</td>
                                                      <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 'bold' }}>
                                                        {parseFloat(item.quantity_kg).toFixed(2)} kg
                                                      </td>
                                                      <td style={{ padding: '6px 12px' }}>{new Date(gydr.created_at).toLocaleDateString('en-IN')}</td>
                                                      <td style={{ padding: '6px 12px' }}>{gydr.delivered_by}</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Section 2: Dyeing & Delivery Summary Table */}
                              <div>
                                <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-current)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <CheckCircle size={18} /> Dyeing & Delivery Summary
                                </h4>
                                
                                {dofDetails[form.id]?.loading ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', color: 'var(--text-muted-current)' }}>
                                    <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading summary...
                                  </div>
                                ) : (
                                  <div style={{ paddingLeft: '1.5rem' }}>
                                    <table className="table" style={{ fontSize: '0.8rem', width: '100%', border: '1px solid var(--border-current)' }}>
                                      <thead>
                                        <tr>
                                          <th>Order Number</th>
                                          <th>Design No & Name</th>
                                          <th>Colour</th>
                                          <th>Count</th>
                                          <th style={{ textAlign: 'right' }}>Qty Allotted (kg)</th>
                                          <th style={{ textAlign: 'right' }}>Qty Sent (kg)</th>
                                          <th style={{ textAlign: 'right' }}>Qty Received (kg)</th>
                                          <th style={{ textAlign: 'right' }}>Balance to Receive (kg)</th>
                                          <th>Associated DYRRs</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(form.yarn_allocations || []).map((alloc, idx) => {
                                          const order = (form.orders || []).find(o => o.id === alloc.orderId);
                                          const count = yarnCounts.find(c => c.id === alloc.countId);
                                          
                                          // Get deliveries/sent for this specific allocation
                                          const dofDeliveryItems = dofDetails[form.id]?.gydrItems || [];
                                          const sentQty = dofDeliveryItems
                                            .filter(d => d.order_id === alloc.orderId && d.yarn_count_id === alloc.countId && d.colour === alloc.colour && d.yarn_type === alloc.type)
                                            .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);
                                            
                                          // Subtract production returns if any
                                          const dofReturns = returnsMap[form.dof_number] || [];
                                          const returnedQty = dofReturns
                                            .filter(r => r.order_id === alloc.orderId && r.yarn_count_id === alloc.countId && r.colour === alloc.colour && r.yarn_type === alloc.type)
                                            .reduce((sum, r) => sum + parseFloat(r.total_weight || 0), 0);
                                            
                                          const netSent = Math.max(0, sentQty - returnedQty);

                                          // Get dyed receipts for this specific allocation
                                          const dofDyrrItems = dofDetails[form.id]?.dyrrItems || [];
                                          const receivedQty = dofDyrrItems
                                            .filter(d => d.order_id === alloc.orderId && d.yarn_count_id === alloc.countId && d.colour === alloc.colour && (d.yarn_type || 'warp') === (alloc.type || 'warp'))
                                            .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

                                          const allottedQty = parseFloat(alloc.total_kg || 0);
                                          const balanceToReceive = Math.max(0, allottedQty - receivedQty);

                                          // Find associated DYRRs
                                          const allocDyrrItems = dofDyrrItems.filter(d => 
                                            d.order_id === alloc.orderId && 
                                            d.yarn_count_id === alloc.countId && 
                                            d.colour === alloc.colour && 
                                            (d.yarn_type || 'warp') === (alloc.type || 'warp')
                                          );
                                          const dofDyrrs = dofDetails[form.id]?.dyrrs || [];

                                          return (
                                            <tr key={idx}>
                                              <td style={{ fontWeight: '600', color: 'var(--color-primary)' }}>
                                                {order?.order_number || <span style={{ color: 'var(--text-muted-current)' }}>Unassigned</span>}
                                              </td>
                                              <td>
                                                {order ? `${order.design_no} - ${order.design_name || ''}` : '-'}
                                              </td>
                                              <td>{alloc.colour}</td>
                                              <td>
                                                {count ? formatCount(count) : alloc.yarnLabel}
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', marginLeft: '4px' }}>
                                                  ({alloc.type || 'warp'})
                                                </span>
                                              </td>
                                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{allottedQty.toFixed(2)}</td>
                                              <td style={{ textAlign: 'right' }}>{netSent.toFixed(2)}</td>
                                              <td style={{ textAlign: 'right', color: '#166534', fontWeight: 'bold' }}>{receivedQty.toFixed(2)}</td>
                                              <td style={{ textAlign: 'right', color: balanceToReceive > 0.1 ? '#b91c1c' : 'var(--text-muted-current)', fontWeight: 'bold' }}>
                                                {balanceToReceive.toFixed(2)}
                                              </td>
                                              <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                  {allocDyrrItems.map(item => {
                                                    const r = dofDyrrs.find(rec => rec.id === item.receipt_id);
                                                    return (
                                                      <span key={item.id} style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                                        <span style={{ fontWeight: '600' }}>{r?.dyrr_number || 'Unknown'}</span>: {parseFloat(item.quantity_kg).toFixed(2)} kg
                                                      </span>
                                                    );
                                                  })}
                                                  {allocDyrrItems.length === 0 && <span style={{ color: 'var(--text-muted-current)', fontSize: '0.75rem' }}>-</span>}
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
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
