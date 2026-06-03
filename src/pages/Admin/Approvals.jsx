import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Loader, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminApprovals() {
  const [activeTab, setActiveTab] = useState('dyeing');
  const { profile } = useAuth();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ marginBottom: '0.25rem' }}>Approvals</h1>
      <p style={{ color: 'var(--text-muted-current)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Review and approve production forms submitted by Merchandisers.
      </p>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--border-current)', marginBottom: '1.5rem' }}>
        {[
          { key: 'dyeing', label: '🎨 Dyeing Order Forms' },
          { key: 'production', label: '🏭 Production Forms' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--text-muted-current)',
              fontWeight: activeTab === tab.key ? '700' : '500',
              fontSize: '0.9rem',
              cursor: 'pointer',
              marginBottom: '-2px',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dyeing' && <DyeingFormApprovals adminProfile={profile} />}
      {activeTab === 'production' && <ProductionFormApprovals />}
    </div>
  );
}

// ── Dyeing Order Form Approvals ──────────────────────────────
function DyeingFormApprovals({ adminProfile }) {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const navigate = useNavigate();

  useEffect(() => { fetchForms(); }, []);

  const fetchForms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dyeing_order_forms')
        .select(`
          *,
          dyeing_unit:master_partners(partner_name),
          creator:profiles!dyeing_order_forms_created_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch linked orders for each form
      const enriched = await Promise.all((data || []).map(async form => {
        if (!form.order_ids?.length) return { ...form, orders: [] };
        const { data: orders } = await supabase
          .from('orders')
          .select('id, order_number, design_no, design_name')
          .in('id', form.order_ids);
        return { ...form, orders: orders || [] };
      }));

      setForms(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (form, newStatus) => {
    const verb = newStatus === 'approved' ? 'APPROVE' : 'REJECT';
    if (!window.confirm(`Are you sure you want to ${verb} DOF ${form.dof_number}?`)) return;
    try {
      const { error } = await supabase
        .from('dyeing_order_forms')
        .update({ status: newStatus, approved_by: adminProfile.id, updated_at: new Date().toISOString() })
        .eq('id', form.id);
      if (error) throw error;
      fetchForms();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':  return { bg: '#fef3c7', text: '#92400e', icon: <Clock size={12} />, label: 'PENDING' };
      case 'approved': return { bg: '#dcfce7', text: '#166534', icon: <CheckCircle size={12} />, label: 'APPROVED' };
      case 'rejected': return { bg: '#fee2e2', text: '#991b1b', icon: <XCircle size={12} />, label: 'REJECTED' };
      default:         return { bg: '#f1f5f9', text: '#475569', icon: null, label: status };
    }
  };

  const getTotalKg = (allocations) =>
    (allocations || []).reduce((s, a) => s + parseFloat(a.total_kg || 0), 0).toFixed(2);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <Loader size={28} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {[
          { key: 'all', label: 'All Forms', count: forms.length },
          { key: 'pending', label: 'Pending', count: forms.filter(f => f.status === 'pending').length },
          { key: 'approved', label: 'Approved', count: forms.filter(f => f.status === 'approved').length },
          { key: 'rejected', label: 'Rejected', count: forms.filter(f => f.status === 'rejected').length },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              border: '1px solid ' + (statusFilter === f.key ? 'var(--color-primary)' : 'var(--border-current)'),
              backgroundColor: statusFilter === f.key ? 'var(--color-primary)' : 'white',
              color: statusFilter === f.key ? 'white' : 'var(--text-main-current)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            {f.label}
            <span style={{
              backgroundColor: statusFilter === f.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-current)',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.7rem'
            }}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* DOF List Table */}
      <div className="glass-panel" style={{ padding: 0 }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>DOF Number</th>
                <th>Created By</th>
                <th>Created At</th>
                <th>Dyeing Unit</th>
                <th>Delivery Date</th>
                <th>Orders</th>
                <th>Count</th>
                <th>Colours</th>
                <th style={{ textAlign: 'right' }}>Total Qty (kg)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filtered = forms.filter(f => statusFilter === 'all' || f.status === statusFilter);
                if (filtered.length === 0) {
                  return (
                    <tr>
                      <td colSpan={13} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                        No {statusFilter !== 'all' ? statusFilter : ''} Dyeing Order Forms found.
                      </td>
                    </tr>
                  );
                }
                return filtered.map(form => {
                  const badge = getStatusBadge(form.status);
                  return (
                    <tr key={form.id} className="fade-in">
                      <td style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{form.dof_number}</td>
                      <td style={{ fontSize: '0.8125rem' }}>{form.creator?.full_name || '-'}</td>
                      <td style={{ fontSize: '0.8125rem' }}>{new Date(form.created_at).toLocaleDateString()}</td>
                      <td style={{ fontWeight: '500', fontSize: '0.8125rem' }}>{form.dyeing_unit?.partner_name || '-'}</td>
                      <td style={{ fontSize: '0.8125rem' }}>
                        {form.expected_delivery_date ? new Date(form.expected_delivery_date).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ fontSize: '0.8125rem' }}>
                        {form.orders?.map(o => o.order_number).join(', ') || '-'}
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
                            {getTotalKg(form.yarn_allocations)}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          backgroundColor: badge.bg, color: badge.text,
                          padding: '3px 8px', borderRadius: '4px',
                          fontSize: '0.75rem', fontWeight: '700'
                        }}>
                          {badge.icon} {badge.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => navigate(`/admin/dyeing-forms/${form.id}`)}
                            style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Eye size={11} /> View
                          </button>
                          {form.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleAction(form, 'approved')}
                                style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                              >✓ Approve</button>
                              <button
                                onClick={() => handleAction(form, 'rejected')}
                                style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                              >✗ Reject</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Existing Production Form Approvals (placeholder/mock) ─────
function ProductionFormApprovals() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted-current)' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏭</div>
      <h3>Production Form Approvals</h3>
      <p>Warping, Sizing, and Weaving form approvals will appear here.</p>
    </div>
  );
}
