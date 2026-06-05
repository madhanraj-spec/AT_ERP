import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Loader, CheckCircle, Clock, XCircle, Eye, Filter, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers for Expected Delivery Dates & Warning Alerts
// ──────────────────────────────────────────────────────────────────────────────
const getTodayString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDofAlertInfo = (form) => {
  const today = getTodayString();
  const expected = form.expected_delivery_date;

  if (form.status === 'received') {
    if (form.maxReceivedDate && expected) {
      if (form.maxReceivedDate <= expected) {
        return {
          type: 'received_on_time',
          label: 'Received On Time',
          color: '#166534',
          bgColor: '#dcfce7',
          borderColor: '#bbf7d0'
        };
      } else {
        return {
          type: 'received_late',
          label: 'Received Late',
          color: '#475569',
          bgColor: '#f1f5f9',
          borderColor: '#cbd5e1'
        };
      }
    }
    return {
      type: 'received_on_time',
      label: 'Received On Time',
      color: '#166534',
      bgColor: '#dcfce7',
      borderColor: '#bbf7d0'
    };
  }

  if (!expected) return null;

  if (expected === today) {
    return {
      type: 'expected_today',
      label: 'Expected Today',
      color: '#b45309',
      bgColor: '#fef3c7',
      borderColor: '#fcd34d'
    };
  } else if (expected < today) {
    return {
      type: 'late',
      label: 'Late',
      color: '#b91c1c',
      bgColor: '#fee2e2',
      borderColor: '#fca5a5'
    };
  }

  return null;
};

export default function DyeingFormsList() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    status: 'all',
    dofNo: '',
    orderNo: '',
    unit: 'all'
  });

  const basePath = profile?.role === 'admin' ? '/admin' : '/merchandiser';
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    fetchForms();
  }, []); // Fetch all forms on mount. Filtering is now client-side for better UX.

  const fetchForms = async () => {
    setLoading(true);
    try {
      const [formsRes, receiptsRes] = await Promise.all([
        supabase
          .from('dyeing_order_forms')
          .select(`
            *,
            dyeing_unit:master_partners(partner_name),
            creator:profiles!dyeing_order_forms_created_by_fkey(full_name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('dyed_yarn_receipts')
          .select('id, dof_id, received_date')
      ]);

      if (formsRes.error) throw formsRes.error;
      const rawForms = formsRes.data || [];
      const receipts = receiptsRes.data || [];

      // For each form, fetch linked orders and compute max received date
      const formsWithOrders = await Promise.all(rawForms.map(async (form) => {
        const formReceipts = receipts.filter(r => r.dof_id === form.id);
        const maxReceivedDate = formReceipts.reduce((max, r) => {
          return (!max || r.received_date > max) ? r.received_date : max;
        }, null);

        let orders = [];
        if (form.order_ids && form.order_ids.length > 0) {
          const { data: oData } = await supabase
            .from('orders')
            .select('id, order_number, design_no, design_name, technical_specs')
            .in('id', form.order_ids);
          orders = oData || [];
        }

        return { 
          ...form, 
          orders, 
          maxReceivedDate 
        };
      }));

      setForms(formsWithOrders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return { bg: '#fef3c7', text: '#92400e', icon: <Clock size={12} />, label: 'PENDING' };
      case 'approved':
        return { bg: '#dcfce7', text: '#166534', icon: <CheckCircle size={12} />, label: 'APPROVED' };
      case 'rejected':
        return { bg: '#fee2e2', text: '#991b1b', icon: <XCircle size={12} />, label: 'REJECTED' };
      case 'partially_sent':
        return { bg: '#fef3c7', text: '#92400e', icon: <Clock size={12} />, label: 'PARTIALLY SENT' };
      case 'fully_sent':
        return { bg: '#dbeafe', text: '#1e40af', icon: <CheckCircle size={12} />, label: 'FULLY SENT' };
      default:
        return { bg: '#f1f5f9', text: '#475569', icon: null, label: status };
    }
  };

  const getTotalQty = (allocations) => {
    if (!allocations || !Array.isArray(allocations)) return '0.00';
    return allocations.reduce((s, a) => s + parseFloat(a.total_kg || 0), 0).toFixed(2);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 'bold' }}>Dyeing Order Forms</h1>
          <p style={{ color: 'var(--text-muted-current)', margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
            Manage and track all dyeing order forms
          </p>
        </div>
        <button
          onClick={() => navigate(`${basePath}/create-dyeing-form`)}
          className="btn btn-primary"
          style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontWeight: 'bold' }}
        >
          <Plus size={18} /> + New Dyeing Order Form
        </button>
      </div>

      {/* Advanced Collapsible Filter Bar */}
      <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', border: '1px solid var(--border-current)' }}>
        <div 
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--color-primary)', fontWeight: '700' }}>
            <Filter size={18} />
            <span>Search & Filters</span>
            {(searchFilters.status !== 'all' || searchFilters.dofNo || searchFilters.orderNo || searchFilters.unit !== 'all') && (
              <span style={{ backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px' }}>
                Active
              </span>
            )}
          </div>
          {isFilterOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>

        {isFilterOpen && (
          <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', borderTop: '1px solid var(--border-current)', paddingTop: '1.25rem' }}>
            {/* Status Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Status</label>
              <select 
                value={searchFilters.status}
                onChange={(e) => setSearchFilters({ ...searchFilters, status: e.target.value })}
                className="input"
                style={{ padding: '0.5rem' }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* DOF Number Search */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>DOF Number</label>
              <input 
                type="text"
                placeholder="Ex: DOF-001..."
                value={searchFilters.dofNo}
                onChange={(e) => setSearchFilters({ ...searchFilters, dofNo: e.target.value })}
                className="input"
                style={{ padding: '0.5rem' }}
              />
            </div>

            {/* Order Number Search */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Order Number</label>
              <input 
                type="text"
                placeholder="Search linked orders..."
                value={searchFilters.orderNo}
                onChange={(e) => setSearchFilters({ ...searchFilters, orderNo: e.target.value })}
                className="input"
                style={{ padding: '0.5rem' }}
              />
            </div>

            {/* Dyeing Unit Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Dyeing Unit</label>
              <select 
                value={searchFilters.unit}
                onChange={(e) => setSearchFilters({ ...searchFilters, unit: e.target.value })}
                className="input"
                style={{ padding: '0.5rem' }}
              >
                <option value="all">All Units</option>
                {[...new Set(forms.map(f => f.dyeing_unit?.partner_name).filter(Boolean))].map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            {/* Clear Button */}
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button 
                onClick={() => setSearchFilters({ status: 'all', dofNo: '', orderNo: '', unit: 'all' })}
                style={{ width: '100%', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}
              >
                <X size={14} /> Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <Loader size={32} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-muted-current)' }}>Loading dyeing forms...</p>
          </div>
        ) : forms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted-current)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎨</div>
            <h3>No Dyeing Order Forms Found</h3>
            <p>Create your first DOF using the button above.</p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>DOF Number</th>
                  <th>Created At</th>
                  <th>Dyeing Unit</th>
                  <th>Delivery Date</th>
                  <th>Order Number(s)</th>
                  <th>Count</th>
                  <th>Colours</th>
                  <th style={{ textAlign: 'right' }}>Total Qty (kg)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = forms.filter(f => {
                    const matchStatus = searchFilters.status === 'all' || f.status === searchFilters.status;
                    const matchDof = !searchFilters.dofNo || f.dof_number?.toLowerCase().includes(searchFilters.dofNo.toLowerCase());
                    const matchUnit = searchFilters.unit === 'all' || f.dyeing_unit?.partner_name === searchFilters.unit;
                    const matchOrder = !searchFilters.orderNo || f.orders?.some(o => o.order_number?.toLowerCase().includes(searchFilters.orderNo.toLowerCase()));
                    return matchStatus && matchDof && matchUnit && matchOrder;
                  });

                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                          No Dyeing Order Forms match your search criteria.
                        </td>
                      </tr>
                    );
                  }

                  return filtered.map(form => {
                    const badge = getStatusBadge(form.status);
                    return (
                      <tr key={form.id} className="fade-in">
                        <td>
                          <span style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '0.9rem' }}>
                            {form.dof_number}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8125rem' }}>
                          {new Date(form.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          {form.dyeing_unit?.partner_name || <span style={{ color: 'var(--text-muted-current)' }}>Not set</span>}
                        </td>
                        <td>
                          {(() => {
                            if (!form.expected_delivery_date) {
                              return <span style={{ color: 'var(--text-muted-current)', fontSize: '0.8125rem' }}>Not set</span>;
                            }
                            const alertInfo = getDofAlertInfo(form);
                            const dateStr = new Date(form.expected_delivery_date).toLocaleDateString();

                            if (alertInfo) {
                              return (
                                <div style={{ 
                                  display: 'inline-flex', 
                                  flexDirection: 'column', 
                                  gap: '0.25rem', 
                                  alignItems: 'flex-start',
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor: alertInfo.bgColor,
                                  border: `1px solid ${alertInfo.borderColor}`,
                                  borderRadius: '6px'
                                }}>
                                  <span style={{ fontSize: '0.8125rem', fontWeight: '700', color: alertInfo.color }}>{dateStr}</span>
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: '800',
                                    textTransform: 'uppercase',
                                    color: alertInfo.color,
                                    opacity: 0.95
                                  }}>
                                    {alertInfo.label}
                                  </span>
                                </div>
                              );
                            }

                            return <span style={{ fontSize: '0.8125rem', fontWeight: '500' }}>{dateStr}</span>;
                          })()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {form.orders?.map(o => (
                              <span key={o.id} style={{ fontWeight: '600', color: 'var(--color-primary)', fontSize: '0.8125rem' }}>
                                {o.order_number}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {form.summary?.map((s, idx) => (
                              <span key={idx} style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', fontWeight: '500' }}>
                                {s.yarnLabel?.split(' - ')[0] || '-'}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {form.summary?.map((s, idx) => (
                              <span key={idx} style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                {s.colour}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {form.summary?.map((s, idx) => (
                              <span key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>
                                {parseFloat(s.total_kg || 0).toFixed(2)}
                              </span>
                            ))}
                            <div style={{ borderTop: '1px solid var(--border-current)', marginTop: '0.1rem', paddingTop: '0.1rem', color: 'var(--color-primary)' }}>
                              {getTotalQty(form.yarn_allocations)}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              backgroundColor: badge.bg, color: badge.text,
                              padding: '3px 8px', borderRadius: '4px',
                              fontSize: '0.75rem', fontWeight: '700'
                            }}>
                              {badge.icon} {badge.label}
                            </span>
                          </div>
                        </td>
                        <td>
                          <button
                            onClick={() => navigate(`${basePath}/dyeing-forms/${form.id}`)}
                            style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Eye size={12} /> View
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
